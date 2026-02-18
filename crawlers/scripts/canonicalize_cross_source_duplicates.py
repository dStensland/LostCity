#!/usr/bin/env python3
"""
Mark cross-source duplicate events as non-canonical for feed suppression.

Rule: same venue_id + start_date + start_time + normalized title, but from different sources.
Keeps one canonical row visible (canonical_event_id IS NULL), marks others with canonical_event_id.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_client, get_source_info


AGGREGATOR_SOURCE_PREFIXES = ("ticketmaster", "eventbrite", "mobilize")
AGGREGATOR_SOURCE_SLUGS = {
    "atlanta-recurring-social",
    "instagram-captions",
    "creative-loafing",
}


def normalize_title(value: str | None) -> str:
    text = (value or "").lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^(the|a|an)\s+", "", text)
    text = re.sub(r"[^\w\s]", "", text)
    return text.strip()


def source_priority(slug: str | None, is_active: bool | None = None) -> int:
    s = (slug or "").strip().lower()
    inactive_penalty = 500 if is_active is False else 0
    if not s:
        return 200 + inactive_penalty
    if s.endswith("-test"):
        return 300 + inactive_penalty
    if s in AGGREGATOR_SOURCE_SLUGS:
        return 230 + inactive_penalty
    if s.startswith(AGGREGATOR_SOURCE_PREFIXES):
        return 220 + inactive_penalty
    return 100 + inactive_penalty


def quality_key(row: dict) -> tuple[int, int, int]:
    desc_len = len((row.get("description") or "").strip())
    has_image = 1 if row.get("image_url") else 0
    has_ticket = 1 if row.get("ticket_url") else 0
    return (desc_len, has_image, has_ticket)


def fetch_events(start_date: str | None) -> list[dict]:
    client = get_client()
    rows: list[dict] = []
    offset = 0
    page = 1000
    while True:
        query = client.table("events").select(
            "id,source_id,venue_id,title,start_date,start_time,description,image_url,ticket_url,created_at,canonical_event_id"
        )
        if start_date:
            query = query.gte("start_date", start_date)
        # Stable ordering avoids duplicate/missed rows across pages when data changes.
        batch = query.order("id").range(offset, offset + page - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    unique_by_id = {row["id"]: row for row in rows if row.get("id")}
    return list(unique_by_id.values())


def main() -> None:
    parser = argparse.ArgumentParser(description="Canonicalize cross-source duplicate events")
    parser.add_argument("--start-date", default=date.today().isoformat(), help="Lower bound start_date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write updates")
    parser.add_argument("--limit-groups", type=int, default=0, help="Only process first N groups for testing")
    args = parser.parse_args()

    client = get_client()
    events = fetch_events(args.start_date)
    print(f"Loaded {len(events)} events (start_date >= {args.start_date})")

    groups: dict[tuple, list[dict]] = defaultdict(list)
    for row in events:
        if not row.get("source_id") or not row.get("venue_id") or not row.get("title"):
            continue
        key = (
            row.get("venue_id"),
            row.get("start_date"),
            row.get("start_time"),
            normalize_title(row.get("title")),
        )
        groups[key].append(row)

    dup_groups: list[list[dict]] = []
    for rows in groups.values():
        source_ids = {r.get("source_id") for r in rows if r.get("source_id")}
        if len(source_ids) > 1 and len(rows) > 1:
            dup_groups.append(rows)

    dup_groups.sort(key=lambda g: (g[0].get("start_date") or "", g[0].get("start_time") or ""))
    if args.limit_groups > 0:
        dup_groups = dup_groups[: args.limit_groups]

    print(f"Found {len(dup_groups)} cross-source duplicate groups")

    updates = 0
    canonical_resets = 0
    touched_groups = 0

    for rows in dup_groups:
        def sort_key(row: dict):
            src = get_source_info(row.get("source_id")) or {}
            pri = source_priority(src.get("slug"), src.get("is_active"))
            q = quality_key(row)
            created = row.get("created_at") or ""
            return (pri, -q[0], -q[1], -q[2], created, row.get("id"))

        ordered = sorted(rows, key=sort_key)
        canonical = ordered[0]
        canonical_id = canonical["id"]

        group_touched = False
        if canonical.get("canonical_event_id") is not None:
            canonical_resets += 1
            group_touched = True
            if not args.dry_run:
                client.table("events").update({"canonical_event_id": None}).eq("id", canonical_id).execute()

        for row in ordered[1:]:
            if row.get("canonical_event_id") == canonical_id:
                continue
            group_touched = True
            updates += 1
            if not args.dry_run:
                client.table("events").update({"canonical_event_id": canonical_id}).eq("id", row["id"]).execute()

        if group_touched:
            touched_groups += 1

    print(f"Groups touched: {touched_groups}")
    print(f"Rows marked non-canonical: {updates}")
    print(f"Canonical rows reset to visible: {canonical_resets}")
    print(f"Dry run: {args.dry_run}")


if __name__ == "__main__":
    main()
