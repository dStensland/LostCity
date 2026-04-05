#!/usr/bin/env python3
# ruff: noqa: E402
"""Backfill missing descriptions for parent festival_program series.

This targets the remaining structural case where the parent festival-program
series is the real festival container, has linked events, and is missing a
description even though the linked festival row already has one.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
CRAWLERS_ROOT = REPO_ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS_ROOT))

from db import get_client


def _normalize(value: str | None) -> str:
    cleaned = (value or "").strip().lower()
    cleaned = re.sub(r"\b20\d{2}\b", " ", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


_GENERIC_PARENT_TOKENS = {
    "festival",
    "fest",
    "weekend",
    "conference",
    "expo",
    "convention",
    "summit",
}


def _parent_tokens(value: str | None) -> set[str]:
    return {
        token
        for token in _normalize(value).split()
        if token and token not in _GENERIC_PARENT_TOKENS
    }


def _titles_match_parent(series_title: str | None, festival_name: str | None) -> bool:
    series_norm = _normalize(series_title)
    festival_norm = _normalize(festival_name)
    if not series_norm or not festival_norm:
        return False
    if series_norm == festival_norm:
        return True
    if series_norm.startswith(festival_norm) or festival_norm.startswith(series_norm):
        return True
    series_tokens = _parent_tokens(series_title)
    festival_tokens = _parent_tokens(festival_name)
    if series_tokens and series_tokens == festival_tokens:
        return True
    return False


def plan_parent_series_description_backfill(
    series_rows: list[dict[str, Any]],
    event_counts: dict[str, int],
    festival_rows_by_id: dict[str, dict[str, Any]],
    *,
    allowed_festival_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for row in series_rows:
        if row.get("series_type") != "festival_program":
            continue
        if (row.get("description") or "").strip():
            continue
        festival_id = row.get("festival_id")
        if not festival_id:
            continue
        if allowed_festival_ids is not None and festival_id not in allowed_festival_ids:
            continue
        if event_counts.get(row.get("id"), 0) <= 0:
            continue
        festival_row = festival_rows_by_id.get(festival_id) or {}
        festival_description = (festival_row.get("description") or "").strip()
        if not festival_description:
            continue
        if not _titles_match_parent(row.get("title"), festival_row.get("name")):
            continue
        candidates.append(
            {
                "series_id": row.get("id"),
                "title": row.get("title"),
                "festival_id": festival_id,
                "description": festival_description,
                "action": "backfill_parent_series_description",
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


def backfill_parent_series_descriptions(
    *, execute: bool, slugs: list[str]
) -> dict[str, Any]:
    client = get_client()
    allowed_festival_ids = _fetch_festival_ids(slugs)
    festival_rows = (
        client.table("festivals").select("id,name,description").execute().data or []
    )
    festival_rows_by_id = {row["id"]: row for row in festival_rows if row.get("id")}
    series_rows = (
        client.table("series")
        .select("id,title,festival_id,series_type,description")
        .eq("series_type", "festival_program")
        .not_.is_("festival_id", "null")
        .execute()
        .data
        or []
    )
    event_counts = _fetch_event_counts(
        [row["id"] for row in series_rows if row.get("id")]
    )
    candidates = plan_parent_series_description_backfill(
        series_rows,
        event_counts,
        festival_rows_by_id,
        allowed_festival_ids=allowed_festival_ids if slugs else None,
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
        description="Backfill parent festival series descriptions"
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
    args = parser.parse_args()
    print(backfill_parent_series_descriptions(execute=args.execute, slugs=args.slug))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
