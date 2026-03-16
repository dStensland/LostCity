#!/usr/bin/env python3
"""
Apply a targeted set of Supabase migrations against a chosen database.

This is intentionally narrower than `supabase db push`: it lets us roll out
only the entity-graph migrations without dragging in unrelated pending files.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import psycopg2
from dotenv import dotenv_values


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
SUPABASE_MIGRATIONS = ROOT / "supabase" / "migrations"

ENTITY_GRAPH_VERSIONS = [
    "20260314183002",
    "20260314183003",
    "20260314183004",
    "20260315103000",
    "20260315104500",
]


@dataclass(frozen=True)
class Migration:
    version: str
    name: str
    path: Path


def _database_url_for_target(target: str) -> tuple[str | None, str | None]:
    env = dotenv_values(ENV_PATH)
    if target == "production":
        value = env.get("DATABASE_URL")
        if not value:
            return None, "Missing DATABASE_URL in .env"
        return value, None

    value = env.get("STAGING_DATABASE_URL") or env.get("DATABASE_URL_STAGING")
    if not value:
        return None, "Missing STAGING_DATABASE_URL (or DATABASE_URL_STAGING) in .env"
    return value, None


def _resolve_version(version: str) -> Migration:
    matches = sorted(SUPABASE_MIGRATIONS.glob(f"{version}_*.sql"))
    if not matches:
        raise FileNotFoundError(f"No supabase migration found for version {version}")
    if len(matches) > 1:
        raise RuntimeError(f"Multiple supabase migrations found for version {version}: {matches}")

    path = matches[0]
    return Migration(version=version, name=path.stem, path=path)


def _load_migrations(versions: list[str]) -> list[Migration]:
    return [_resolve_version(version) for version in versions]


def _already_applied(cur: psycopg2.extensions.cursor, version: str) -> bool:
    cur.execute(
        """
        select 1
        from supabase_migrations.schema_migrations
        where version = %s
        limit 1
        """,
        (version,),
    )
    return cur.fetchone() is not None


def _record_migration(
    cur: psycopg2.extensions.cursor,
    migration: Migration,
    sql: str,
) -> None:
    cur.execute(
        """
        insert into supabase_migrations.schema_migrations (version, statements, name)
        values (%s, %s::text[], %s)
        """,
        (migration.version, [sql], migration.name),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply a targeted set of Supabase migrations.")
    parser.add_argument(
        "--target",
        choices=("production", "staging"),
        default="production",
        help="Database target to apply against.",
    )
    parser.add_argument(
        "--versions",
        nargs="+",
        help="Explicit migration versions to apply.",
    )
    parser.add_argument(
        "--entity-graph-rollout",
        action="store_true",
        help="Apply the guarded entity-graph rollout migration set.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be applied without executing any SQL.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    versions = args.versions or []
    if args.entity_graph_rollout:
        versions = ENTITY_GRAPH_VERSIONS

    if not versions:
        raise SystemExit("Provide --versions or --entity-graph-rollout")

    database_url, error = _database_url_for_target(args.target)
    if error:
        print(f"ERROR: {error}")
        return 1

    migrations = _load_migrations(versions)

    print(f"Target: {args.target}")
    print(f"Migrations requested: {[migration.name for migration in migrations]}")

    conn = psycopg2.connect(database_url)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            for migration in migrations:
                if _already_applied(cur, migration.version):
                    print(f"SKIP already applied: {migration.name}")
                    continue

                sql = migration.path.read_text()
                if args.dry_run:
                    print(f"DRY RUN apply: {migration.name}")
                    continue

                print(f"APPLY: {migration.name}")
                cur.execute(sql)
                _record_migration(cur, migration, sql)
                conn.commit()
                print(f"OK: {migration.name}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
