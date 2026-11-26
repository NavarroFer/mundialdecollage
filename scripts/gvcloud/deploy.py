#!/usr/bin/env python3
"""Deploy the current main to GV Cloud: upload what changed, rebuild, wait.

Flow: PR -> merge to main -> `git pull` -> run this script from the repo.

It uploads only the files that changed (or were deleted) between the commit
last deployed, stored on the server in .deployed-commit, and the current HEAD.
It never touches .env.production, node_modules, .next or .git. It requires:
the main branch, no uncommitted tracked changes, HEAD == origin/main and the
CI run of HEAD in green: it waits while that run is going and stops if it
failed (the server build skips the TypeScript check, CI does it). --sin-ci
skips that, for an urgency only.

New files in supabase/migrations/ are applied first, one transaction per file
with psql (ON_ERROR_STOP), through an SSH tunnel the script opens by itself.
The server keeps the list of applied files in .migrations-applied, updated
after each file, so a failure halfway never re-runs what already passed. If a
migration fails nothing is uploaded. Needs `psql` locally and a private copy of
the database connection file (see --db-info). Use --no-migrate to skip them.

First time only: tell it which commit the server already runs with
--mark-deployed <sha>, then deploy normally.
"""

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import unquote, urlsplit

import paramiko

from deploy_provisional import atomic_put
from sync_code import NEVER_UPLOAD, ensure_dirs, remote_size, skipped

MARKER = ".deployed-commit"
APPLIED = ".migrations-applied"
MIG_DIR = "supabase/migrations/"
FAIL_PATTERNS = re.compile(r"Failed to compile|Build error occurred|npm error|ELIFECYCLE")


def git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    ).stdout


def check_git(repo: Path, branch: str, allow_branch: bool) -> str:
    current = git(repo, "rev-parse", "--abbrev-ref", "HEAD").strip()
    if current != branch and not allow_branch:
        sys.exit(f"Estás en '{current}'. Se despliega desde '{branch}' (usá --allow-branch para forzar).")
    if git(repo, "status", "--porcelain", "--untracked-files=no").strip():
        sys.exit("Hay cambios sin commitear en archivos de git. Commiteá o descartalos antes de desplegar.")
    subprocess.run(["git", "-C", str(repo), "fetch", "origin", current], check=True)
    head = git(repo, "rev-parse", "HEAD").strip()
    remote = git(repo, "rev-parse", f"origin/{current}").strip()
    if head != remote:
        sys.exit(f"HEAD ({head[:8]}) no coincide con origin/{current} ({remote[:8]}). Hacé git pull o git push primero.")
    return head


def ci_status(repo: Path, head: str) -> str:
    if not shutil.which("gh"):
        return "no se pudo consultar (gh no está instalado)"
    try:
        out = subprocess.run(
            ["gh", "run", "list", "--limit", "20", "--json", "headSha,conclusion,status,workflowName"],
            cwd=str(repo), capture_output=True, text=True, timeout=30,
        )
        if out.returncode != 0:
            return "no se pudo consultar (revisá `gh auth status`)"
        for run in json.loads(out.stdout):
            if run.get("headSha") == head and run.get("workflowName") == "CI":
                return run.get("conclusion") or run.get("status") or "desconocido"
        return "sin corrida de CI para este commit"
    except Exception:
        return "no se pudo consultar"


# A run still going: wait for it. The server build skips the TypeScript
# check (next.config.mjs: CI runs `tsc --noEmit`), so a commit only goes out
# after CI passed on it.
CI_PENDING = {"queued", "in_progress", "waiting", "requested", "pending", "sin corrida de CI para este commit"}


def require_green_ci(repo: Path, head: str, timeout: int) -> None:
    deadline = time.time() + timeout
    status = ci_status(repo, head)
    print(f"Commit a desplegar: {head[:8]}   CI: {status}", flush=True)
    # A failed query (a network blip) is retried a few times, not taken as red.
    failures = 0
    if status in CI_PENDING:
        print("Esperando a que termine el CI", end="", flush=True)
        while (status in CI_PENDING or (status.startswith("no se pudo consultar") and failures < 5)) and time.time() < deadline:
            time.sleep(20)
            print(".", end="", flush=True)
            status = ci_status(repo, head)
            failures = failures + 1 if status.startswith("no se pudo consultar") else 0
        print(f" {status}", flush=True)
    if status != "success":
        sys.exit(f"El CI de {head[:8]} no está en verde ({status}): no se despliega. "
                 "Con --sin-ci se saltea (solo para una urgencia, con lint, tipos, tests y build corridos a mano).")


def changed_files(repo: Path, base: str, head: str) -> list:
    raw = git(repo, "diff", "--name-status", "-z", "--no-renames", base, head)
    tokens = [t for t in raw.split("\0") if t]
    return [(tokens[i], tokens[i + 1]) for i in range(0, len(tokens) - 1, 2)]


def read_remote(sftp: paramiko.SFTPClient, path: str):
    try:
        with sftp.open(path, "rb") as handle:
            return handle.read().decode("utf-8")
    except IOError:
        return None


def db_settings(path: Path) -> dict:
    match = re.search(r"postgres(?:ql)?://\S+", path.read_text(encoding="utf-8"))
    if not match:
        sys.exit(f"No encontré la línea postgresql://... en {path}")
    url = urlsplit(match.group(0))
    return {
        "user": unquote(url.username or ""),
        "password": unquote(url.password or ""),
        "port": url.port or 5432,
        "db": (url.path or "/postgres").lstrip("/") or "postgres",
    }


def pending_migrations(repo: Path, base: str, head: str, applied: set):
    added, modified = [], []
    for status, rel in changed_files(repo, base, head):
        if rel.startswith(MIG_DIR) and rel.endswith(".sql"):
            (added if status == "A" else modified if status == "M" else []).append(rel)
    pending = sorted(rel for rel in added if rel.split("/")[-1] not in applied)
    return pending, sorted(modified)


class Tunnel:
    """SSH local forward to the server's PostgreSQL, closed on exit."""

    def __init__(self, args, remote_port: int):
        self.args, self.remote_port, self.proc, self.port = args, remote_port, None, None

    def __enter__(self):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            self.port = probe.getsockname()[1]
        a = self.args
        self.proc = subprocess.Popen(
            ["ssh", "-N", "-L", f"127.0.0.1:{self.port}:127.0.0.1:{self.remote_port}",
             "-i", str(a.ssh_key), "-o", f"UserKnownHostsFile={a.known_hosts}",
             "-o", "StrictHostKeyChecking=yes", "-o", "ExitOnForwardFailure=yes",
             "-o", "BatchMode=yes", f"{a.user}@{a.host}"],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
        )
        for _ in range(30):
            if self.proc.poll() is not None:
                sys.exit("No se pudo abrir el túnel SSH: " + (self.proc.stderr.read() or "").strip())
            try:
                socket.create_connection(("127.0.0.1", self.port), timeout=1).close()
                return self
            except OSError:
                time.sleep(0.5)
        self.proc.terminate()
        sys.exit("Se acabó el tiempo esperando el túnel SSH.")

    def __exit__(self, *exc):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()


def run_psql(repo: Path, rel: str, db: dict, port: int) -> subprocess.CompletedProcess:
    env = dict(os.environ, PGPASSWORD=db["password"], PGCONNECT_TIMEOUT="15")
    return subprocess.run(
        ["psql", "-h", "127.0.0.1", "-p", str(port), "-U", db["user"], "-d", db["db"],
         "-1", "-q", "-v", "ON_ERROR_STOP=1", "-f", str(repo / rel)],
        env=env, capture_output=True, text=True,
    )


def wait_build(sftp: paramiko.SFTPClient, log_path: str, offset: int, timeout: int):
    deadline = time.time() + timeout
    new = ""
    while time.time() < deadline:
        time.sleep(10)
        try:
            with sftp.open(log_path, "rb") as handle:
                handle.seek(offset)
                new = handle.read().decode("utf-8", "replace")
        except IOError:
            continue
        print(".", end="", flush=True)
        if "OK: build" in new:
            return "ok", new
        if FAIL_PATTERNS.search(new):
            return "fail", new
    return "timeout", new


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--known-hosts", type=Path, default=Path.home() / ".gv_known_hosts")
    parser.add_argument("--ssh-key", type=Path, default=Path.home() / "gvenue" / "id_ed25519")
    parser.add_argument("--host", default="100.88.213.117")
    parser.add_argument("--user", default="fnavarro")
    parser.add_argument("--remote-root", default="/sitios/mundialdecollage.com.ar")
    parser.add_argument("--log", default="/logs/mundialdecollage.com.ar/deploy.log")
    parser.add_argument("--branch", default="main")
    parser.add_argument("--allow-branch", action="store_true")
    parser.add_argument("--db-info", type=Path, default=Path.home() / "gvenue" / "LEEME-supabase.txt",
                        help="copia privada (modo 600) de /LEEME-supabase.txt, solo para migraciones")
    parser.add_argument("--no-migrate", action="store_true", help="no aplicar migraciones")
    parser.add_argument("--mark-deployed", metavar="SHA")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true", help="no pedir confirmación")
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--sin-ci", dest="skip_ci", action="store_true",
                        help="no exigir el CI en verde (solo para una urgencia)")
    parser.add_argument("--ci-timeout", type=int, default=1200, help="segundos de espera al CI")
    args = parser.parse_args()
    repo = args.repo.resolve()

    client = paramiko.SSHClient()
    client.load_host_keys(str(args.known_hosts))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())

    if args.mark_deployed:
        sha = git(repo, "rev-parse", args.mark_deployed + "^{commit}").strip()
        client.connect(args.host, username=args.user, key_filename=str(args.ssh_key),
                       look_for_keys=False, allow_agent=False, timeout=15)
        try:
            atomic_put(client.open_sftp(), args.remote_root + "/" + MARKER, (sha + "\n").encode(), 0o644)
        finally:
            client.close()
        print("Marcado como desplegado:", sha)
        return

    head = check_git(repo, args.branch, args.allow_branch)
    if args.dry_run or args.skip_ci:
        print(f"Commit a desplegar: {head[:8]}   CI: {ci_status(repo, head)}"
              + ("   (--sin-ci: no se exige)" if args.skip_ci and not args.dry_run else ""))
    else:
        require_green_ci(repo, head, args.ci_timeout)

    client.connect(args.host, username=args.user, key_filename=str(args.ssh_key),
                   look_for_keys=False, allow_agent=False, timeout=15)
    try:
        sftp = client.open_sftp()
        root = args.remote_root
        try:
            with sftp.open(root + "/" + MARKER, "rb") as handle:
                base = handle.read().decode().strip()
        except IOError:
            sys.exit("No hay marca de lo desplegado. Corré una vez: deploy.py --mark-deployed <commit que corre el servidor>")
        if base == head:
            print("El servidor ya está en este commit. Nada para desplegar.")
            return
        git(repo, "cat-file", "-e", base + "^{commit}")

        tops = {e.filename for e in sftp.listdir_attr(root) if not skipped(e.filename)}
        uploads, deletes = [], []
        for status, rel in changed_files(repo, base, head):
            parts = rel.split("/")
            if parts[0] not in tops or any(skipped(p) for p in parts) or rel.startswith(NEVER_UPLOAD):
                continue
            (deletes if status == "D" else uploads).append(rel)
        deletes = [d for d in deletes if remote_size(sftp, root + "/" + d) is not None]

        applied_text = read_remote(sftp, root + "/" + APPLIED)
        applied = set((applied_text or "").split())
        migrations, modified = ([], []) if args.no_migrate else pending_migrations(repo, base, head, applied)

        print(f"Desde {base[:8]} hasta {head[:8]}")
        print(f"\nMigraciones a aplicar ({len(migrations)}):")
        for rel in migrations:
            print("  ", rel)
        for rel in modified:
            print("   AVISO: migración existente modificada (no se reaplica):", rel)
        print(f"\nA subir ({len(uploads)}):")
        for rel in uploads:
            print("  ", rel)
        print(f"\nA borrar del servidor ({len(deletes)}):")
        for rel in deletes:
            print("  ", rel)
        if not uploads and not deletes and not migrations:
            print("\nNada para el servidor: ni código ni migraciones.")
            return
        if migrations:
            if not shutil.which("psql"):
                sys.exit("Falta psql en esta computadora (brew install libpq y agregarlo al PATH).")
            if not args.db_info.is_file():
                sys.exit(f"Falta {args.db_info}: copiá ahí /LEEME-supabase.txt con modo 600 (ver el runbook).")
        if args.dry_run:
            print("\nSolo lectura (--dry-run).")
            return
        if not args.yes and input("\n¿Subir y reconstruir? [s/N] ").strip().lower() not in ("s", "si", "sí", "y", "yes"):
            print("Cancelado.")
            return

        if migrations:
            db = db_settings(args.db_info)
            with Tunnel(args, db["port"]) as tunnel:
                for rel in migrations:
                    print("Migración:", rel, flush=True)
                    result = run_psql(repo, rel, db, tunnel.port)
                    if result.returncode != 0:
                        print(result.stderr.strip()[-1500:])
                        sys.exit(f"La migración {rel} falló: no se subió código. Lo ya aplicado quedó registrado en el servidor.")
                    applied.add(rel.split("/")[-1])
                    atomic_put(sftp, root + "/" + APPLIED, ("\n".join(sorted(applied)) + "\n").encode(), 0o644)
                    print("  aplicada y registrada", flush=True)
        if not uploads and not deletes:
            atomic_put(sftp, root + "/" + MARKER, (head + "\n").encode(), 0o644)
            print(f"OK: migraciones aplicadas, sin cambios de código. Marcado {head[:8]}.")
            return

        for rel in uploads:
            ensure_dirs(sftp, root, rel)
            atomic_put(sftp, root + "/" + rel, (repo / rel).read_bytes(), 0o644)
            print("Subido y verificado:", rel, flush=True)
        for rel in deletes:
            sftp.remove(root + "/" + rel)
            print("Borrado:", rel, flush=True)

        offset = sftp.stat(args.log).st_size
        with sftp.open(root + "/reiniciar.txt", "w") as handle:
            handle.write("GV Cloud build requested\n")
        print("Build pedido. Esperando el log", end="", flush=True)
        result, text = wait_build(sftp, args.log, offset, args.timeout)
        print()
        if result == "ok":
            atomic_put(sftp, root + "/" + MARKER, (head + "\n").encode(), 0o644)
            print(f"OK: desplegado {head[:8]}.")
        else:
            lines = text.splitlines()[-40:]
            print("\n".join(lines))
            msg = "El build falló" if result == "fail" else "Se acabó el tiempo de espera"
            sys.exit(f"{msg}. El commit desplegado sigue marcado como {base[:8]}. Revisá el log antes de reintentar.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
