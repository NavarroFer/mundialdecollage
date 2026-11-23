#!/usr/bin/env python3
"""Point restored public image URLs at the GV Cloud Storage API.

Requires an open SSH tunnel from local 5434 to the target PostgreSQL service.
The LEEME file is a temporary private copy of the remote /LEEME-supabase.txt.
Without --apply, this script only reports counts.
"""

import argparse
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pg8000.dbapi

OLD = "https://jgneduoejygbqtwarynr.supabase.co/storage/v1/object/public/"
NEW = "https://api-mundialdecollage.cloud.gvenue.com.ar/storage/v1/object/public/"
TABLES = ("artworks", "legacy_submissions")


def db_uri(path: Path) -> str:
    values = [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip().startswith("postgresql://")
    ]
    if len(values) != 1:
        raise ValueError("expected exactly one PostgreSQL URI in target info")
    return values[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target-info", type=Path, required=True)
    parser.add_argument("--port", type=int, default=5434)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    uri = urlsplit(db_uri(args.target_info))
    conn = pg8000.dbapi.connect(
        user=unquote(uri.username or ""),
        password=unquote(uri.password or ""),
        host="127.0.0.1",
        port=args.port,
        database=uri.path.lstrip("/"),
    )
    try:
        cursor = conn.cursor()
        for table in TABLES:
            if args.apply:
                cursor.execute(
                    f'UPDATE public."{table}" SET image_url = replace(image_url, %s, %s) '
                    "WHERE image_url LIKE %s",
                    (OLD, NEW, OLD + "%"),
                )
                print(f"{table}: updated {cursor.rowcount}")
            else:
                cursor.execute(
                    f'SELECT count(*) FROM public."{table}" WHERE image_url LIKE %s',
                    (OLD + "%",),
                )
                print(f"{table}: old URLs {cursor.fetchone()[0]}")
        if args.apply:
            conn.commit()
            for table in TABLES:
                cursor.execute(
                    f'SELECT count(*) FROM public."{table}" WHERE image_url LIKE %s',
                    (OLD + "%",),
                )
                print(f"{table}: old URLs remaining {cursor.fetchone()[0]}")
        else:
            conn.rollback()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
