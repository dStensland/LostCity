#!/usr/bin/env python3
"""Backfill missing festival-linked series descriptions from active event copy."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
CRAWLERS_ROOT = REPO_ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS_ROOT))

from db import get_client


def plan_festival_series_description_backfill(
    series_rows: list[dict[str, Any]],
    event_rows: list[dict[str, Any]],
    *,
    allowed_festival_ids: set[str] | None = None,
    allowed_series_types: set[str] | None = None,
    min_length: int = 80,
) -> list[dict[str, Any]]:
    best_event_by_series: dict[str, dict[str, Any]] = {}
    for row in event_rows:
        if row.get("is_active") is False:
            continue
        description = (row.get("description") or "").strip()
        if len(description) < min_length:
            continue
        series_id = row.get("series_id")
        if not series_id:
            continue
        current = best_event_by_series.get(series_id)
        if current is None or len(description) > len(
            (current.get("description") or "").strip()
        ):
            best_event_by_series[series_id] = row

    candidates: list[dict[str, Any]] = []
    for row in series_rows:
        festival_id = row.get("festival_id")
        if not festival_id:
            continue
        if allowed_festival_ids is not None and festival_id not in allowed_festival_ids:
            continue
        if (
            allowed_series_types is not None
            and row.get("series_type") not in allowed_series_types
        ):
            continue
        if (row.get("description") or "").strip():
            continue
        best_event = best_event_by_series.get(row.get("id"))
        if not best_event:
            continue
        description = (best_event.get("description") or "").strip()
        candidates.append(
            {
                "series_id": row.get("id"),
                "title": row.get("title"),
                "festival_id": festival_id,
                "series_type": row.get("series_type"),
                "source_event_id": best_event.get("id"),
                "source_event_title": best_event.get("title"),
                "description": description,
                "action": "backfill_series_description_from_event",
            }
        )

    candidates.sort(
        key=lambda row: ((row.get("festival_id") or ""), (row.get("title") or ""))
    )
    return candidates


def _fetch_festival_ids(slugs: list[str]) -> set[str]:
    if not slugs:
        return set()
    client = get_client()
    rows = (
        client.table("festivals").select("id,slug").in_("slug", slugs).execute().data
        or []
    )
    return {row["id"] for row in rows if row.get("id")}


def backfill_festival_series_descriptions(
    *,
    execute: bool,
    slugs: list[str],
    series_types: list[str],
    min_length: int,
) -> dict[str, Any]:
    client = get_client()
    allowed_festival_ids = _fetch_festival_ids(slugs)
    allowed_series_types = set(series_types) if series_types else None

    series_rows = (
        client.table("series")
        .select("id,title,festival_id,series_type,description,is_active")
        .not_.is_("festival_id", "null")
        .execute()
        .data
        or []
    )
    series_ids = [row["id"] for row in series_rows if row.get("id")]

    event_rows: list[dict[str, Any]] = []
    chunk_size = 200
    for start in range(0, len(series_ids), chunk_size):
        chunk = series_ids[start : start + chunk_size]
        event_rows.extend(
            client.table("events")
            .select("id,title,series_id,description,is_active")
            .in_("series_id", chunk)
            .execute()
            .data
            or []
        )

    candidates = plan_festival_series_description_backfill(
        series_rows,
        event_rows,
        allowed_festival_ids=allowed_festival_ids if slugs else None,
        allowed_series_types=allowed_series_types,
        min_length=min_length,
    )

    updated = 0
    if execute:
        for row in candidates:
            client.table("series").update({"description": row["description"]}).eq(
                "id", row["series_id"]
            ).execute()
            updated += 1

    return {
        "candidate_count": len(candidates),
        "updated_count": updated,
        "candidates": [
            {k: v for k, v in row.items() if k != "description"}
            for row in candidates[:25]
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill festival-linked series descriptions from active event copy"
    )
    parser.add_argument(
        "--execute", action="store_true", help="Apply updates (default is dry-run)"
    )
    parser.add_argument(
        "--slug",
        action="append",
        default=[],
        help="Restrict to one or more festival slugs",
    )
    parser.add_argument(
        "--series-type",
        action="append",
        default=[],
        help="Restrict to one or more series types",
    )
    parser.add_argument(
        "--min-length",
        type=int,
        default=80,
        help="Minimum event description length to use",
    )
    args = parser.parse_args()
    print(
        backfill_festival_series_descriptions(
            execute=args.execute,
            slugs=args.slug,
            series_types=args.series_type,
            min_length=args.min_length,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
