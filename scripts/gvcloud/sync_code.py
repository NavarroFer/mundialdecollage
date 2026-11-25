#!/usr/bin/env python3
"""Compare the git-tracked app code with GV Cloud and upload what differs.

Only top-level entries that already exist on the server are considered, so
docs/, scripts/, tmp/ and the like never travel. node_modules, .next, .git and
every .env* file are never read, written or deleted. Remote files that are not
in git are only reported; the paths in --delete (default: the removed Vercel
Analytics component) are the only ones removed, and only with --apply.

This script does NOT touch .env.production nor reiniciar.txt. After --apply,
run deploy_provisional.py (it sets the site URL and requests the single build).
Run it from the branch whose code should ship. Without --apply it only reads.
"""

import argparse
import hashlib
import subprocess
from pathlib import Path

import paramiko

from deploy_provisional import atomic_put

SKIP = {
    "node_modules", ".next", ".git", ".claude", ".codex", ".local",
    "tmp", "Claude outputs", "logs",
}
DEFAULT_DELETE = ("components/vercel-analytics.tsx",)
# Migration tooling runs from the owner's computer, never on the server.
NEVER_UPLOAD = ("scripts/gvcloud/",)


def skipped(name: str) -> bool:
    return name in SKIP or name.startswith(".env")


def tracked_files(repo: Path) -> list:
    out = subprocess.run(
        ["git", "-C", str(repo), "ls-files", "-z"],
        check=True, capture_output=True,
    ).stdout.decode("utf-8")
    return [p for p in out.split("\0") if p]


def remote_size(sftp: paramiko.SFTPClient, path: str):
    try:
        return sftp.stat(path).st_size
    except IOError:
        return None


def remote_hash(sftp: paramiko.SFTPClient, path: str) -> bytes:
    with sftp.open(path, "rb") as handle:
        handle.prefetch()
        return hashlib.sha256(handle.read()).digest()


def walk_remote(sftp: paramiko.SFTPClient, root: str, rel: str) -> list:
    found = []
    for entry in sftp.listdir_attr(root + "/" + rel if rel else root):
        if skipped(entry.filename):
            continue
        child = rel + "/" + entry.filename if rel else entry.filename
        if entry.st_mode is not None and (entry.st_mode & 0o170000) == 0o040000:
            found.extend(walk_remote(sftp, root, child))
        else:
            found.append(child)
    return found


def ensure_dirs(sftp: paramiko.SFTPClient, root: str, rel_file: str) -> None:
    current = root
    for part in rel_file.split("/")[:-1]:
        current += "/" + part
        try:
            sftp.stat(current)
        except IOError:
            sftp.mkdir(current, 0o755)


def show(title: str, items: list, limit: int = 40) -> None:
    print(f"\n{title}: {len(items)}")
    for item in items[:limit]:
        print("  ", item)
    if len(items) > limit:
        print(f"   ... y {len(items) - limit} más")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--known-hosts", type=Path, required=True)
    parser.add_argument("--ssh-key", type=Path, required=True)
    parser.add_argument("--host", default="100.88.213.117")
    parser.add_argument("--user", default="fnavarro")
    parser.add_argument("--remote-root", default="/sitios/mundialdecollage.com.ar")
    parser.add_argument("--delete", action="append", dest="deletes")
    parser.add_argument(
        "--only", action="append", dest="only",
        help="compare/upload just this repo path (repeatable) instead of everything",
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    repo = args.repo.resolve()
    deletes = tuple(args.deletes or DEFAULT_DELETE)
    for item in deletes:
        if item.startswith("/") or ".." in item.split("/") or skipped(item.split("/")[0]):
            parser.error(f"invalid --delete path: {item}")

    client = paramiko.SSHClient()
    client.load_host_keys(str(args.known_hosts))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(
        args.host, username=args.user, key_filename=str(args.ssh_key),
        look_for_keys=False, allow_agent=False, timeout=15,
    )
    try:
        sftp = client.open_sftp()
        root = args.remote_root
        tops = {
            e.filename: ((e.st_mode or 0) & 0o170000) == 0o040000
            for e in sftp.listdir_attr(root) if not skipped(e.filename)
        }

        local = []
        for rel in (args.only or tracked_files(repo)):
            parts = rel.split("/")
            if parts[0] not in tops or any(skipped(p) for p in parts):
                continue
            if rel.startswith(NEVER_UPLOAD):
                continue
            if not (repo / rel).is_file():
                print("Aviso: figura en git pero no existe en el disco:", rel)
                continue
            local.append(rel)

        new, changed, same = [], [], 0
        print(f"Comparando {len(local)} archivos...", flush=True)
        for index, rel in enumerate(local, 1):
            if index % 100 == 0:
                print(f"  {index}/{len(local)}", flush=True)
            size = remote_size(sftp, root + "/" + rel)
            data_size = (repo / rel).stat().st_size
            if size is None:
                new.append(rel)
            elif size != data_size:
                changed.append(rel)
            elif remote_hash(sftp, root + "/" + rel) != hashlib.sha256(
                (repo / rel).read_bytes()
            ).digest():
                changed.append(rel)
            else:
                same += 1

        local_set = set(local)
        print("Buscando archivos que solo están en el servidor...", flush=True)
        remote_only = []
        for name, is_dir in ({} if args.only else tops).items():
            if is_dir and any(r.split("/")[0] == name for r in local):
                remote_only.extend(
                    r for r in walk_remote(sftp, root, name) if r not in local_set
                )
        to_delete = [d for d in deletes if remote_size(sftp, root + "/" + d) is not None]

        print(f"Iguales: {same}")
        show("Nuevos (no están en el servidor)", new)
        show("Cambiados", changed)
        show("Solo en el servidor (no se tocan)", remote_only)
        show("A borrar del servidor", to_delete)

        if not args.apply:
            print("\nSolo lectura. Revisá la lista y repetí con --apply.")
            return

        for rel in new + changed:
            ensure_dirs(sftp, root, rel)
            atomic_put(sftp, root + "/" + rel, (repo / rel).read_bytes(), 0o644)
            print("Subido y verificado:", rel, flush=True)
        for rel in to_delete:
            sftp.remove(root + "/" + rel)
            print("Borrado:", rel, flush=True)
        print(
            "\nListo. No se pidió el build: corré deploy_provisional.py para fijar "
            "NEXT_PUBLIC_SITE_URL y reiniciar."
        )
    finally:
        client.close()


if __name__ == "__main__":
    main()
