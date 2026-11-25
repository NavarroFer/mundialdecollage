#!/usr/bin/env python3
"""Copy and count-check Supabase Storage buckets over S3 without a rclone config.

Source credentials come from a private existing .env.local; destination
credentials come from a temporary private copy of /LEEME-supabase.txt.
The original migration used --ignore-times because restored storage.objects
rows do not mean their bytes are already present on the destination.
"""

import argparse
import json
import os
import subprocess
from pathlib import Path


def dotenv_values(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def destination_values(path: Path) -> dict[str, str]:
    labels = {
        "Endpoint": "endpoint",
        "Región": "region",
        "Access key id": "access_id",
        "Secret access key": "secret",
    }
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        for label, name in labels.items():
            if line.strip().startswith(label + ":"):
                out[name] = line.split(":", 1)[1].strip().strip('"').strip("'").strip(chr(96))
    if set(out) != set(labels.values()):
        raise ValueError("destination S3 details missing from target info")
    return out


def rclone_env(args: argparse.Namespace) -> dict[str, str]:
    source = dotenv_values(args.source_env)
    target = destination_values(args.target_info)
    for key in ("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        if not source.get(key):
            raise ValueError(f"source {key} is empty")
    env = os.environ.copy()
    env.update(
        RCLONE_CONFIG="/dev/null",
        RCLONE_CONFIG_SOURCE_TYPE="s3",
        RCLONE_CONFIG_SOURCE_PROVIDER="Other",
        RCLONE_CONFIG_SOURCE_ACCESS_KEY_ID=args.source_project_ref,
        RCLONE_CONFIG_SOURCE_SECRET_ACCESS_KEY=source["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
        RCLONE_CONFIG_SOURCE_SESSION_TOKEN=source["SUPABASE_SERVICE_ROLE_KEY"],
        RCLONE_CONFIG_SOURCE_ENDPOINT=(
            f"https://{args.source_project_ref}.storage.supabase.co/storage/v1/s3"
        ),
        RCLONE_CONFIG_SOURCE_REGION=args.source_region,
        RCLONE_CONFIG_SOURCE_FORCE_PATH_STYLE="true",
        RCLONE_CONFIG_DEST_TYPE="s3",
        RCLONE_CONFIG_DEST_PROVIDER="Other",
        RCLONE_CONFIG_DEST_ACCESS_KEY_ID=target["access_id"],
        RCLONE_CONFIG_DEST_SECRET_ACCESS_KEY=target["secret"],
        RCLONE_CONFIG_DEST_ENDPOINT=target["endpoint"],
        RCLONE_CONFIG_DEST_REGION=target["region"],
        RCLONE_CONFIG_DEST_FORCE_PATH_STYLE="true",
    )
    return env


def run_rclone(env: dict[str, str], *args: str, timeout: int = 180) -> str:
    process = subprocess.run(
        ["rclone", *args], env=env, text=True, capture_output=True, timeout=timeout
    )
    if process.returncode:
        # Do not print stderr: some tools include request details in failures.
        raise RuntimeError(f"rclone {args[0]} failed (exit {process.returncode})")
    return process.stdout


def buckets(env: dict[str, str], remote: str) -> set[str]:
    lines = run_rclone(env, "lsf", remote + ":", "--dirs-only").splitlines()
    return {line.rstrip("/") for line in lines if line.strip()}


def size(env: dict[str, str], remote: str, bucket: str) -> tuple[int, int]:
    result = json.loads(run_rclone(env, "size", f"{remote}:{bucket}", "--json"))
    return int(result.get("count", 0)), int(result.get("bytes", 0))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-env", type=Path, required=True)
    parser.add_argument("--target-info", type=Path, required=True)
    parser.add_argument("--source-project-ref", default="jgneduoejygbqtwarynr")
    parser.add_argument("--source-region", default="us-west-2")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    env = rclone_env(args)

    source_buckets = buckets(env, "source")
    target_buckets = buckets(env, "dest")
    if source_buckets != target_buckets:
        raise RuntimeError("source and destination bucket sets differ")
    print("Matching bucket sets:", len(source_buckets), flush=True)
    ordered = sorted(source_buckets, key=lambda b: size(env, "source", b)[1])
    initial = [size(env, "source", b) for b in ordered]
    print("Source objects:", sum(item[0] for item in initial), flush=True)
    print("Source bytes:", sum(item[1] for item in initial), flush=True)

    if args.apply:
        for index, bucket in enumerate(ordered, 1):
            print(f"Copying bucket {index}/{len(ordered)}", flush=True)
            run_rclone(
                env,
                "copy",
                f"source:{bucket}",
                f"dest:{bucket}",
                "--ignore-times",
                "--transfers=4",
                "--checkers=8",
                "--retries=3",
                "--low-level-retries=5",
                timeout=3600,
            )
            print(f"Copied bucket {index}/{len(ordered)}", flush=True)

    if args.verify or args.apply:
        mismatches = 0
        for index, bucket in enumerate(ordered, 1):
            source_size = size(env, "source", bucket)
            target_size = size(env, "dest", bucket)
            match = source_size == target_size
            mismatches += not match
            print(f"Bucket {index}/{len(ordered)} count+bytes match: {match}", flush=True)
        if mismatches:
            raise RuntimeError(f"{mismatches} buckets differ")
        print("All bucket counts and byte totals match.", flush=True)
    elif not args.apply:
        print("Read-only preflight complete. Use --apply to copy.", flush=True)


if __name__ == "__main__":
    main()
