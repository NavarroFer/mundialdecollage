#!/usr/bin/env python3
"""Upload selected app files and target Supabase settings to GV Cloud over SFTP.

Requires a private copy of /LEEME-supabase.txt. The default file list matches
the three source files uploaded during the 23/11/2026 provisional deploy.
The site URL is mandatory so a final-domain build cannot accidentally use the
provisional URL. Without --apply this script only prints a safe plan.
"""

import argparse
import hashlib
import io
from pathlib import Path

import paramiko

DEFAULT_FILES = (
    "next.config.mjs",
    "proxy.ts",
    "app/api/gallery/attention/route.ts",
)
TARGET_API = "https://api-mundialdecollage.cloud.gvenue.com.ar"


def target_values(path: Path, site_url: str) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        for key in ("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
            if line.startswith(key + "="):
                values[key] = line.split("=", 1)[1]
    if set(values) != {"NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"}:
        raise ValueError("target API keys missing from target info")
    values["NEXT_PUBLIC_SUPABASE_URL"] = TARGET_API
    values["NEXT_PUBLIC_SITE_URL"] = site_url.rstrip("/")
    return values


def atomic_put(sftp: paramiko.SFTPClient, remote: str, data: bytes, mode: int) -> None:
    temp = remote + ".codex.tmp"
    try:
        sftp.putfo(io.BytesIO(data), temp, file_size=len(data), confirm=True)
        sftp.chmod(temp, mode)
        sftp.posix_rename(temp, remote)
    except Exception:
        try:
            sftp.remove(temp)
        except Exception:
            pass
        raise
    with sftp.open(remote, "rb") as handle:
        stored = handle.read()
    if hashlib.sha256(stored).digest() != hashlib.sha256(data).digest():
        raise RuntimeError("remote SHA-256 mismatch")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--target-info", type=Path, required=True)
    parser.add_argument("--known-hosts", type=Path, required=True)
    parser.add_argument("--ssh-key", type=Path, required=True)
    parser.add_argument("--host", default="100.88.213.117")
    parser.add_argument("--user", default="fnavarro")
    parser.add_argument("--remote-root", default="/sitios/mundialdecollage.com.ar")
    parser.add_argument("--site-url", required=True)
    parser.add_argument("--file", action="append", dest="files")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    files = tuple(args.files or DEFAULT_FILES)
    for item in files:
        path = (args.repo / item).resolve()
        if not path.is_file() or not path.is_relative_to(args.repo.resolve()):
            parser.error(f"invalid repo file: {item}")
    print("Files:", ", ".join(files))
    print("Site URL:", args.site_url)
    print("Remote env keys:", ", ".join(sorted(target_values(args.target_info, args.site_url))))
    if not args.apply:
        print("Dry run only. Use --apply after checking the plan.")
        return

    client = paramiko.SSHClient()
    client.load_host_keys(str(args.known_hosts))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(
        args.host, username=args.user, key_filename=str(args.ssh_key),
        look_for_keys=False, allow_agent=False, timeout=15,
    )
    try:
        sftp = client.open_sftp()
        for item in files:
            remote = args.remote_root + "/" + item
            sftp.stat(remote)
            atomic_put(sftp, remote, (args.repo / item).read_bytes(), 0o644)
            print("Uploaded and verified:", item, flush=True)
        env_path = args.remote_root + "/.env.production"
        with sftp.open(env_path, "rb") as handle:
            current = handle.read().decode("utf-8")
        updates = target_values(args.target_info, args.site_url)
        seen = set()
        result = []
        for line in current.splitlines(keepends=True):
            key = line.split("=", 1)[0]
            if key in updates:
                result.append(key + "=" + updates[key] + "\n")
                seen.add(key)
            else:
                result.append(line)
        if seen != set(updates):
            raise RuntimeError("one or more remote environment keys are missing")
        atomic_put(sftp, env_path, "".join(result).encode("utf-8"), 0o600)
        print("Remote environment verified (values hidden).", flush=True)
        with sftp.open(args.remote_root + "/reiniciar.txt", "w") as handle:
            handle.write("GV Cloud build requested\n")
        print("Build requested; inspect deploy.log before testing.", flush=True)
    finally:
        client.close()


if __name__ == "__main__":
    main()
