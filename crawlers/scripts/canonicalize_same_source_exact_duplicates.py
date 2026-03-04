#!/usr/bin/env python3
"""
Canonicalize exact same-source duplicates for future events.

Duplicate key:
- source_id
- venue_id
- start_date
- start_time (NULL treated as a value)
- normalized title

One row remains canonical (canonical_event_id = NULL); others point to it.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client


def normalize_title(value: str | None) -> str:
    text = (value or "").lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s]", "", text)
    return text.strip()


def normalize_start_time(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return "__none__"
    if text in {"00:00", "00:00:00"}:
        return "__none__"
    return text


def quality_key(row: dict[str, Any]) -> tuple[int, int, int, str, int]:
    desc_len = len((row.get("description") or "").strip())
    has_image = 1 if row.get("image_url") else 0
    has_ticket = 1 if row.get("ticket_url") else 0
    created = str(row.get("created_at") or "")
    row_id = int(row.get("id") or 0)
    return (-desc_len, -has_image, -has_ticket, created, row_id)


def fetch_future_visible_rows(start_date: str) -> list[dict[str, Any]]:
    client = get_client()
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        batch = (
            client.table("events")
            .select(
                "id,source_id,venue_id,title,start_date,start_time,"
                "description,image_url,ticket_url,created_at,canonical_event_id"
            )
            .gte("start_date", start_date)
            .is_("canonical_event_id", "null")
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Canonicalize exact same-source duplicates."
    )
    parser.add_argument(
        "--start-date",
        default=date.today().isoformat(),
        help="Lower bound start_date (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview only (no writes).",
    )
    args = parser.parse_args()

    client = get_client()
    rows = fetch_future_visible_rows(args.start_date)
    print(f"Loaded {len(rows)} visible future rows (start_date >= {args.start_date})")

    grouped: dict[tuple[int, int, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        source_id = int(row.get("source_id") or 0)
        venue_id = int(row.get("venue_id") or 0)
        if source_id <= 0:
            continue
        key = (
            source_id,
            venue_id,
            str(row.get("start_date") or ""),
            normalize_start_time(row.get("start_time")),
            normalize_title(row.get("title")),
        )
        grouped[key].append(row)

    duplicate_groups = [group for group in grouped.values() if len(group) > 1]
    duplicate_groups.sort(key=lambda group: (group[0].get("start_date") or "", group[0].get("id") or 0))
    print(f"Found {len(duplicate_groups)} exact same-source duplicate groups")

    updates = 0
    for group in duplicate_groups:
        ordered = sorted(group, key=quality_key)
        canonical = ordered[0]
        canonical_id = int(canonical["id"])
        for row in ordered[1:]:
            row_id = int(row["id"])
            updates += 1
            if args.dry_run:
                print(f"[DRY-RUN] event {row_id} -> canonical_event_id {canonical_id}")
                continue
            client.table("events").update({"canonical_event_id": canonical_id}).eq("id", row_id).execute()

    print(f"Rows updated: {updates}")
    print(f"Dry run: {args.dry_run}")


if __name__ == "__main__":
    main()
