#!/usr/bin/env python3
"""
Collapse one-event yearly wrapper series back into the canonical festival entity.

Safe candidate:
  - active series has a festival_id
  - title looks like "<festival name> 2026"
  - exactly one active linked event
  - linked event title matches the wrapper title

Action:
  - unlink the event from the yearly wrapper series
  - deactivate the wrapper series
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_config, set_database_target  # noqa: E402


def _connect():
    cfg = get_config()
    database_url = cfg.database.active_database_url
    if not database_url:
        raise RuntimeError(
            f"Missing database URL for target '{cfg.database.active_target}'"
        )
    return psycopg2.connect(database_url)


def _normalize_text(value: Any) -> str:
    return re.sub(
        r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())
    ).strip()


def looks_like_yearly_wrapper(series_title: str, festival_name: str) -> bool:
    if not re.search(r"\b20\d{2}\b", series_title or ""):
        return False
    title_norm = _normalize_text(re.sub(r"\b20\d{2}\b", " ", series_title or ""))
    festival_norm = _normalize_text(festival_name)
    return bool(title_norm and festival_norm and festival_norm in title_norm)


def is_safe_wrapper_candidate(
    series_row: dict[str, Any], linked_events: list[dict[str, Any]]
) -> bool:
    if not looks_like_yearly_wrapper(series_row["title"], series_row["festival_name"]):
        return False
    if len(linked_events) != 1:
        return False
    return _normalize_text(linked_events[0]["title"]) == _normalize_text(
        series_row["title"]
    )


def load_candidates(festival_slugs: list[str]) -> list[dict[str, Any]]:
    with _connect() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            select
              s.id,
              s.title,
              s.series_type,
              s.festival_id,
              f.slug as festival_slug,
              f.name as festival_name
            from series s
            join festivals f on f.id = s.festival_id
            where s.is_active = true
              and s.festival_id is not null
              and (%s::text[] is null or f.slug = any(%s::text[]))
            order by f.slug, s.title
            """,
            (festival_slugs or None, festival_slugs or None),
        )
        series_rows = list(cur.fetchall())

        candidates: list[dict[str, Any]] = []
        for row in series_rows:
            cur.execute(
                """
                select id, title, start_date, end_date
                from events
                where series_id = %s
                  and is_active = true
                order by start_date nulls first, title
                """,
                (row["id"],),
            )
            linked_events = list(cur.fetchall())
            if not is_safe_wrapper_candidate(row, linked_events):
                continue
            candidates.append(
                {
                    "series_id": str(row["id"]),
                    "series_title": row["title"],
                    "series_type": row["series_type"],
                    "festival_id": row["festival_id"],
                    "festival_slug": row["festival_slug"],
                    "festival_name": row["festival_name"],
                    "linked_event_id": str(linked_events[0]["id"]),
                    "linked_event_title": linked_events[0]["title"],
                }
            )
        return candidates


def apply_candidates(candidates: list[dict[str, Any]]) -> None:
    with _connect() as conn, conn.cursor() as cur:
        for row in candidates:
            cur.execute(
                "update events set series_id = null where id = %s",
                (row["linked_event_id"],),
            )
            cur.execute(
                "update series set is_active = false where id = %s", (row["series_id"],)
            )
        conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--festival-slug", action="append", default=[])
    parser.add_argument(
        "--db-target", choices=("production", "staging"), default="production"
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    set_database_target(args.db_target)
    candidates = load_candidates(args.festival_slug)

    print(
        json.dumps(
            {
                "candidate_count": len(candidates),
                "festival_slugs": args.festival_slug,
                "apply": args.apply,
                "candidates": candidates,
            },
            indent=2,
        )
    )

    if args.apply and candidates:
        apply_candidates(candidates)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
