#!/usr/bin/env python3
"""
Promote existing events to preferred sources in cross-source duplicate groups.

Use case:
- Historical rows can remain owned by aggregator sources when dedupe merged records
  before source-priority promotion existed.
- This script finds duplicate slots (same venue/date/time/title) and promotes the
  canonical/root row's source_id to the best-ranked source in that slot.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_client, get_source_info, _source_priority_for_dedupe  # type: ignore


def normalize_title(value: Optional[str]) -> str:
    text = (value or "").lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^(the|a|an)\s+", "", text)
    text = re.sub(r"[^\w\s]", "", text)
    return text.strip()


def quality_key(row: dict) -> tuple[int, int, int]:
    desc_len = len((row.get("description") or "").strip())
    has_image = 1 if row.get("image_url") else 0
    has_ticket = 1 if row.get("ticket_url") else 0
    return (desc_len, has_image, has_ticket)


def fetch_events(start_date: str) -> list[dict]:
    client = get_client()
    rows: list[dict] = []
    offset = 0
    page_size = 1000

    while True:
        batch = (
            client.table("events")
            .select(
                "id,source_id,portal_id,is_sensitive,venue_id,title,start_date,start_time,"
                "description,image_url,ticket_url,created_at,canonical_event_id"
            )
            .gte("start_date", start_date)
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    # De-dup rows in case range paging overlaps due to concurrent writes.
    return list({row["id"]: row for row in rows if row.get("id")}.values())


def best_row(rows: list[dict]) -> dict:
    def sort_key(row: dict):
        source = get_source_info(row.get("source_id")) or {}
        source_priority = _source_priority_for_dedupe(
            source.get("slug"), source.get("is_active")
        )
        quality = quality_key(row)
        created = row.get("created_at") or ""
        return (source_priority, -quality[0], -quality[1], -quality[2], created, row.get("id"))

    return sorted(rows, key=sort_key)[0]


def find_root_row(rows: list[dict]) -> Optional[dict]:
    roots = [row for row in rows if row.get("canonical_event_id") is None]
    if not roots:
        return None
    return sorted(roots, key=lambda row: row.get("created_at") or "")[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote canonical/root rows to preferred source ownership")
    parser.add_argument("--start-date", default=date.today().isoformat(), help="Only process events on/after date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing updates")
    parser.add_argument("--limit-groups", type=int, default=0, help="Only process first N groups for testing")
    args = parser.parse_args()

    client = get_client()
    events = fetch_events(args.start_date)
    print(f"Loaded {len(events)} events (start_date >= {args.start_date})")

    grouped: dict[tuple, list[dict]] = defaultdict(list)
    for row in events:
        if not row.get("venue_id") or not row.get("title") or not row.get("start_date"):
            continue
        key = (
            row.get("venue_id"),
            row.get("start_date"),
            row.get("start_time"),
            normalize_title(row.get("title")),
        )
        grouped[key].append(row)

    candidate_groups = [
        rows for rows in grouped.values()
        if len(rows) > 1 and len({r.get("source_id") for r in rows if r.get("source_id")}) > 1
    ]
    candidate_groups.sort(key=lambda rows: (rows[0].get("start_date") or "", rows[0].get("start_time") or ""))
    if args.limit_groups > 0:
        candidate_groups = candidate_groups[: args.limit_groups]

    print(f"Found {len(candidate_groups)} cross-source groups")

    touched_groups = 0
    source_promotions = 0
    portal_promotions = 0
    sensitive_promotions = 0

    for rows in candidate_groups:
        winner = best_row(rows)
        root = find_root_row(rows)
        if not root:
            continue

        if root.get("source_id") == winner.get("source_id"):
            continue

        root_source = get_source_info(root.get("source_id")) or {}
        winner_source = get_source_info(winner.get("source_id")) or {}
        root_priority = _source_priority_for_dedupe(
            root_source.get("slug"), root_source.get("is_active")
        )
        winner_priority = _source_priority_for_dedupe(
            winner_source.get("slug"), winner_source.get("is_active")
        )

        # Only promote when winner is strictly better.
        if winner_priority >= root_priority:
            continue

        update_payload: dict = {"source_id": winner.get("source_id")}
        source_promotions += 1

        winner_portal = winner_source.get("owner_portal_id")
        if winner_portal and root.get("portal_id") != winner_portal:
            update_payload["portal_id"] = winner_portal
            portal_promotions += 1

        if winner_source.get("is_sensitive") and not root.get("is_sensitive"):
            update_payload["is_sensitive"] = True
            sensitive_promotions += 1

        touched_groups += 1
        if args.dry_run:
            print(
                f"[DRY RUN] event_id={root['id']} source_id {root.get('source_id')} -> "
                f"{winner.get('source_id')} title={root.get('title')!r} date={root.get('start_date')}"
            )
            continue

        client.table("events").update(update_payload).eq("id", root["id"]).execute()

    print(f"Groups touched: {touched_groups}")
    print(f"Source promotions: {source_promotions}")
    print(f"Portal promotions: {portal_promotions}")
    print(f"Sensitive promotions: {sensitive_promotions}")
    print(f"Dry run: {args.dry_run}")


if __name__ == "__main__":
    main()
