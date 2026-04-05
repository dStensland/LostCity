#!/usr/bin/env python3
"""
Repair legacy program rows by backfilling canonical metadata and pruning duplicates.

This is intended for sources that predate strict program identity handling. It:
  1. backfills metadata.content_hash when missing
  2. backfills metadata.program_family_key when missing
  3. groups rows by logical identity (source, portal, venue, name, session_start)
  4. keeps the highest-quality row in each duplicate set

Usage:
    python3 scripts/repair_program_identities.py --source-slug cobb-family-programs
    python3 scripts/repair_program_identities.py --source-slug cobb-family-programs --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable

import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_config, set_database_target  # noqa: E402
from db.programs import build_program_family_key, generate_program_hash  # noqa: E402

DEFAULT_PORTAL_SLUG = "atlanta-families"


@dataclass(frozen=True)
class ProgramIdentity:
    source_id: int
    portal_id: str | None
    venue_id: int
    name: str
    identity_token: str | None


def _connect():
    cfg = get_config()
    database_url = cfg.database.active_database_url
    if not database_url:
        raise RuntimeError(
            f"Missing database URL for target '{cfg.database.active_target}'"
        )
    return psycopg2.connect(database_url)


def _stable_identity_token(row: dict[str, Any]) -> str | None:
    metadata = row.get("metadata") or {}
    for field in ("activity_id", "session_id", "program_id", "registration_id"):
        value = metadata.get(field)
        if value not in (None, ""):
            return f"{field}:{value}"
    return row.get("session_start")


def build_identity(row: dict[str, Any]) -> ProgramIdentity:
    return ProgramIdentity(
        source_id=row["source_id"],
        portal_id=row.get("portal_id"),
        venue_id=row.get("place_id") or row.get("venue_id"),
        name=row["name"],
        identity_token=_stable_identity_token(row),
    )


def _quality_score(row: dict[str, Any]) -> int:
    metadata = row.get("metadata") or {}
    return sum(
        (
            1 if row.get("schedule_days") else 0,
            1 if row.get("registration_opens") else 0,
            1 if row.get("registration_closes") else 0,
            1 if metadata.get("activity_id") else 0,
            1 if metadata.get("session_id") else 0,
            1 if metadata.get("content_hash") else 0,
        )
    )


def _parse_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if not value:
        return datetime.min
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def rank_program_row(row: dict[str, Any]) -> tuple[int, datetime, datetime, str]:
    return (
        _quality_score(row),
        _parse_dt(row.get("updated_at")),
        _parse_dt(row.get("created_at")),
        str(row["id"]),
    )


def select_duplicate_deletes(rows: Iterable[dict[str, Any]]) -> list[str]:
    groups: dict[ProgramIdentity, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[build_identity(row)].append(row)

    deletes: list[str] = []
    for group_rows in groups.values():
        if len(group_rows) < 2:
            continue
        sorted_rows = sorted(group_rows, key=rank_program_row, reverse=True)
        deletes.extend(str(row["id"]) for row in sorted_rows[1:])
    return deletes


def _fetch_rows(source_slug: str, portal_slug: str) -> list[dict[str, Any]]:
    with _connect() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            select
              p.id,
              p.source_id,
              p.portal_id,
              p.place_id,
              p.name,
              p.session_start,
              p.schedule_days,
              p.registration_opens,
              p.registration_closes,
              p.metadata,
              p.updated_at,
              p.created_at
            from programs p
            join sources s on s.id = p.source_id
            join portals po on po.id = p.portal_id
            where s.slug = %s
              and po.slug = %s
              and p.status = 'active'
            order by p.name, p.session_start, p.id
            """,
            (source_slug, portal_slug),
        )
        return list(cur.fetchall())


def _metadata_updates(
    rows: Iterable[dict[str, Any]],
) -> tuple[list[tuple[str, dict[str, Any]]], int, int]:
    updates: list[tuple[str, dict[str, Any]]] = []
    content_hash_updates = 0
    family_key_updates = 0
    for row in rows:
        metadata = dict(row.get("metadata") or {})
        family_key = metadata.get("program_family_key")
        content_hash = metadata.get("content_hash")
        if content_hash and family_key:
            continue
        if not content_hash:
            content_hash = generate_program_hash(
                row["name"],
                row.get("place_id") or row.get("venue_id"),
                row.get("session_start"),
                source_id=row.get("source_id"),
                identity_seed=_stable_identity_token({"metadata": metadata}),
            )
            metadata["content_hash"] = content_hash
            content_hash_updates += 1
        if not family_key:
            metadata["program_family_key"] = build_program_family_key(row)
            family_key_updates += 1
        updates.append((str(row["id"]), metadata))
    return updates, content_hash_updates, family_key_updates


def _apply_updates(
    updates: list[tuple[str, dict[str, Any]]],
    delete_ids: list[str],
) -> None:
    with _connect() as conn, conn.cursor() as cur:
        for program_id, metadata in updates:
            cur.execute(
                "update programs set metadata = %s::jsonb where id = %s",
                (json.dumps(metadata), program_id),
            )
        if delete_ids:
            cur.execute(
                "delete from programs where id = any(%s::uuid[])", (delete_ids,)
            )
        conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-slug", required=True)
    parser.add_argument("--portal-slug", default=DEFAULT_PORTAL_SLUG)
    parser.add_argument(
        "--db-target", choices=("production", "staging"), default="production"
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    set_database_target(args.db_target)

    rows = _fetch_rows(args.source_slug, args.portal_slug)
    if not rows and args.portal_slug == DEFAULT_PORTAL_SLUG:
        print(
            json.dumps(
                {
                    "warning": "No program rows found for atlanta-families. Live Family inventory may still be owned by the legacy 'hooky' slug.",
                    "portal_slug": args.portal_slug,
                    "source_slug": args.source_slug,
                },
                indent=2,
            )
        )
    updates, missing_hash_updates, family_key_updates = _metadata_updates(rows)

    updated_rows = []
    for row in rows:
        metadata = dict(row.get("metadata") or {})
        if not metadata.get("content_hash"):
            metadata["content_hash"] = generate_program_hash(
                row["name"],
                row.get("place_id") or row.get("venue_id"),
                row.get("session_start"),
                source_id=row.get("source_id"),
                identity_seed=_stable_identity_token({"metadata": metadata}),
            )
        if not metadata.get("program_family_key"):
            metadata["program_family_key"] = build_program_family_key(row)
        updated_rows.append({**row, "metadata": metadata})

    delete_ids = select_duplicate_deletes(updated_rows)

    print(
        json.dumps(
            {
                "portal_slug": args.portal_slug,
                "source_slug": args.source_slug,
                "rows_scanned": len(rows),
                "missing_hash_updates": missing_hash_updates,
                "family_key_updates": family_key_updates,
                "duplicate_deletes": len(delete_ids),
                "apply": args.apply,
            },
            indent=2,
        )
    )

    if args.apply and (updates or delete_ids):
        _apply_updates(updates, delete_ids)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
