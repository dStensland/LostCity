#!/usr/bin/env python3
"""Delete zero-event festival-linked ghost series.

This is a narrow structural cleanup for the festival quality gate. It only
touches series rows that:
1. are festival-linked and in a safe series type bucket
2. are linked to a festival
3. have zero events linked at all
4. are inert enough to be structurally safe to delete
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
CRAWLERS_ROOT = REPO_ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS_ROOT))

from db import get_client

_SAFE_GHOST_SERIES_TYPES = {
    "festival_program",
    "film",
    "class_series",
    "recurring_show",
}


def plan_ghost_series_cleanup(
    series_rows: list[dict[str, Any]],
    event_counts: dict[str, int],
    *,
    allowed_festival_ids: set[str] | None = None,
    festival_rows_by_id: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for row in series_rows:
        if row.get("series_type") not in _SAFE_GHOST_SERIES_TYPES:
            continue
        if (
            row.get("series_type") != "festival_program"
            and row.get("is_active") is not False
        ):
            continue
        festival_id = row.get("festival_id")
        if not festival_id:
            continue
        if allowed_festival_ids is not None and festival_id not in allowed_festival_ids:
            continue
        if event_counts.get(row.get("id"), 0) != 0:
            continue
        series_description = (row.get("description") or "").strip()
        action = "delete_ghost_series"
        if series_description and row.get("series_type") == "festival_program":
            festival_row = (festival_rows_by_id or {}).get(festival_id) or {}
            if not festival_row.get("id"):
                continue
            action = "delete_ghost_series_and_preserve_festival_description"
        candidates.append(
            {
                "series_id": row.get("id"),
                "title": row.get("title"),
                "festival_id": festival_id,
                "series_type": row.get("series_type"),
                "action": action,
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


def _fetch_event_counts(series_ids: list[str]) -> dict[str, int]:
    if not series_ids:
        return {}
    client = get_client()
    counts: dict[str, int] = {}
    chunk_size = 200
    for start in range(0, len(series_ids), chunk_size):
        chunk = series_ids[start : start + chunk_size]
        rows = (
            client.table("events")
            .select("series_id")
            .in_("series_id", chunk)
            .execute()
            .data
            or []
        )
        for row in rows:
            series_id = row.get("series_id")
            if not series_id:
                continue
            counts[series_id] = counts.get(series_id, 0) + 1
    return counts


def cleanup_ghost_series(*, execute: bool, slugs: list[str]) -> dict[str, Any]:
    client = get_client()
    allowed_festival_ids = _fetch_festival_ids(slugs)
    festival_rows = (
        client.table("festivals").select("id,description").execute().data or []
    )
    festival_rows_by_id = {row["id"]: row for row in festival_rows if row.get("id")}

    series_rows = (
        client.table("series")
        .select("id,title,festival_id,series_type,description,is_active")
        .not_.is_("festival_id", "null")
        .execute()
        .data
        or []
    )
    event_counts = _fetch_event_counts(
        [row["id"] for row in series_rows if row.get("id")]
    )
    candidates = plan_ghost_series_cleanup(
        series_rows,
        event_counts,
        allowed_festival_ids=allowed_festival_ids if slugs else None,
        festival_rows_by_id=festival_rows_by_id,
    )

    deleted = 0
    if execute:
        for row in candidates:
            series_description = (
                next(
                    (
                        series_row.get("description")
                        for series_row in series_rows
                        if series_row.get("id") == row["series_id"]
                    ),
                    None,
                )
                or ""
            ).strip()
            festival_row = festival_rows_by_id.get(row["festival_id"]) or {}
            festival_description = (festival_row.get("description") or "").strip()
            if (
                row.get("action")
                == "delete_ghost_series_and_preserve_festival_description"
                and series_description
                and len(series_description) > len(festival_description)
            ):
                client.table("festivals").update(
                    {"description": series_description}
                ).eq("id", row["festival_id"]).execute()
            client.table("series").delete().eq("id", row["series_id"]).execute()
            deleted += 1

    return {
        "candidate_count": len(candidates),
        "deleted_count": deleted,
        "candidates": candidates[:25],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Delete zero-event ghost festival_program series"
    )
    parser.add_argument(
        "--execute", action="store_true", help="Apply deletes (default is dry-run)"
    )
    parser.add_argument(
        "--slug",
        action="append",
        default=[],
        help="Restrict cleanup to one or more festival slugs",
    )
    args = parser.parse_args()

    stats = cleanup_ghost_series(execute=args.execute, slugs=args.slug)
    print(stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
