#!/usr/bin/env python3
"""Deploy the current main to GV Cloud: upload what changed, rebuild, wait.

Flow: PR -> merge to main -> `git pull` -> run this script from the repo.

It uploads only the files that changed (or were deleted) between the commit
last deployed, stored on the server in .deployed-commit, and the current HEAD.
It never touches .env.production, node_modules, .next or .git. It requires:
the main branch, no uncommitted tracked changes and HEAD == origin/main.

First time only: tell it which commit the server already runs with
--mark-deployed <sha>, then deploy normally.
"""

import argparse
import re
import shutil
import subprocess
import sys
import time
import json
from pathlib import Path

import paramiko

from deploy_provisional import atomic_put
from sync_code import NEVER_UPLOAD, ensure_dirs, remote_size, skipped

MARKER = ".deployed-commit"
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


def changed_files(repo: Path, base: str, head: str) -> list:
    raw = git(repo, "diff", "--name-status", "-z", "--no-renames", base, head)
    tokens = [t for t in raw.split("\0") if t]
    return [(tokens[i], tokens[i + 1]) for i in range(0, len(tokens) - 1, 2)]


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
    parser.add_argument("--mark-deployed", metavar="SHA")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true", help="no pedir confirmación")
    parser.add_argument("--timeout", type=int, default=900)
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
    print(f"Commit a desplegar: {head[:8]}   CI: {ci_status(repo, head)}")

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

        print(f"Desde {base[:8]} hasta {head[:8]}")
        print(f"\nA subir ({len(uploads)}):")
        for rel in uploads:
            print("  ", rel)
        print(f"\nA borrar del servidor ({len(deletes)}):")
        for rel in deletes:
            print("  ", rel)
        if not uploads and not deletes:
            print("\nNingún cambio de código para el servidor. Si igual querés reconstruir, avisame para sumar --force-build.")
            return
        if args.dry_run:
            print("\nSolo lectura (--dry-run).")
            return
        if not args.yes and input("\n¿Subir y reconstruir? [s/N] ").strip().lower() not in ("s", "si", "sí", "y", "yes"):
            print("Cancelado.")
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
