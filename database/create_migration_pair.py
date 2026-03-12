#!/usr/bin/env python3
"""
Create paired migration files in database/migrations and supabase/migrations.

This keeps both migration tracks moving together and avoids filename collisions.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_DIR = ROOT / "database" / "migrations"
SUPABASE_DIR = ROOT / "supabase" / "migrations"


def _sanitize_stem(value: str) -> str:
    stem = value.strip().lower()
    stem = re.sub(r"[\s\-]+", "_", stem)
    stem = re.sub(r"[^a-z0-9_]+", "", stem)
    stem = re.sub(r"_+", "_", stem).strip("_")
    if not stem:
        raise ValueError("Migration name must contain letters or numbers.")
    return stem


def _next_db_number() -> int:
    numbers: list[int] = []
    for path in DB_DIR.glob("*.sql"):
        match = re.match(r"^(\d+)_", path.name)
        if match:
            numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def _next_supabase_timestamp() -> str:
    timestamps: list[int] = []
    for path in SUPABASE_DIR.glob("*.sql"):
        match = re.match(r"^(\d{14})_", path.name)
        if match:
            timestamps.append(int(match.group(1)))
    return f"{max(timestamps, default=0) + 1:014d}"


def _template(stem: str, title: str | None) -> str:
    header = title or stem.replace("_", " ").title()
    return (
        f"-- Migration: {header}\n"
        "--\n"
        "-- Keep this file mirrored in database/migrations and supabase/migrations.\n"
        "-- Update database/schema.sql in the same change set when schema changes are involved.\n\n"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a paired database/supabase migration.")
    parser.add_argument("name", help="Migration stem, e.g. atlanta_united_fc_schedule")
    parser.add_argument("--title", help="Optional human-readable title for the SQL header")
    parser.add_argument("--dry-run", action="store_true", help="Print planned files without writing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    stem = _sanitize_stem(args.name)
    db_number = _next_db_number()
    supabase_timestamp = _next_supabase_timestamp()

    db_path = DB_DIR / f"{db_number}_{stem}.sql"
    supabase_path = SUPABASE_DIR / f"{supabase_timestamp}_{stem}.sql"
    content = _template(stem, args.title)

    print(f"database: {db_path}")
    print(f"supabase: {supabase_path}")

    if args.dry_run:
        print("\n--- template preview ---\n")
        print(content, end="")
        return 0

    db_path.write_text(content)
    supabase_path.write_text(content)
    print("\nCreated paired migrations.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
