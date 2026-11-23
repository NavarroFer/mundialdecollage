#!/usr/bin/env python3
"""Remove empty COPY blocks from a Supabase data-only dump.

The GV Cloud self-hosted stack already contains Auth and Storage schemas.
Some source-only columns occurred only in empty COPY blocks, so omitting those
blocks preserved every row and avoided target-version column errors.
Keep input and output outside Git: both contain private production data.
"""

import argparse
import os
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("input and output must differ")

    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    total = kept = skipped = 0
    try:
        with args.input.open("r", encoding="utf-8") as source, os.fdopen(
            fd, "w", encoding="utf-8"
        ) as output:
            for line in source:
                if not (line.startswith("COPY ") and line.rstrip().endswith("FROM stdin;")):
                    output.write(line)
                    continue
                total += 1
                body = []
                for body_line in source:
                    if body_line.rstrip("\r\n") == r"\.":
                        terminator = body_line
                        break
                    body.append(body_line)
                else:
                    raise ValueError("unterminated COPY block")

                if not body:
                    skipped += 1
                    continue
                if "auth.one_time_tokens" in line and "link_token_hash" in line:
                    raise ValueError("unexpected nonempty auth.one_time_tokens block")
                if "auth.saml_providers" in line and "dedicated_scope" in line:
                    raise ValueError("unexpected nonempty auth.saml_providers block")
                kept += 1
                output.write(line)
                output.writelines(body)
                output.write(terminator)
    except Exception:
        args.output.unlink(missing_ok=True)
        raise

    print(f"COPY blocks: {total}; kept with rows: {kept}; omitted empty: {skipped}")
    print("Output is sensitive production data; keep mode 600 and delete after use.")


if __name__ == "__main__":
    main()
