#!/usr/bin/env python3
"""
Audit current Yonder-relevant trail and camping coverage in the venue graph.

This is intentionally read-only. It gives a grounded picture of:
  - how many Georgia venues are typed as trail / park / campground
  - how many venue names look trail-like or camp-like but are not typed cleanly
  - how much current provider-backed overnight coverage exists for state parks

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/audit_yonder_trail_camp_coverage.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client


TRAIL_NAME_RE = re.compile(r"\b(trail|trailhead|greenway|path|beltline|riverwalk)\b", re.IGNORECASE)
CAMP_NAME_RE = re.compile(
    r"\b(campground|camp site|campsite|rv park|backcountry|state park|camp)\b",
    re.IGNORECASE,
)
STATE_PARK_RE = re.compile(r"\bstate park\b", re.IGNORECASE)


def fetch_rows(client: Any, table: str, fields: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        batch = (
            client.table(table)
            .select(fields)
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


def fmt_examples(rows: list[dict[str, Any]], limit: int = 12) -> list[str]:
    lines: list[str] = []
    for row in rows[:limit]:
        lines.append(
            f"- {row.get('name')} [{row.get('place_type') or 'null'}] "
            f"({row.get('city') or 'Unknown city'})"
        )
    return lines


def main() -> int:
    client = get_client()

    venues = [
        row
        for row in fetch_rows(
            client,
            "venues",
            "id,name,slug,venue_type,city,state,description,active",
        )
        if row.get("is_active", True) is not False and row.get("state") == "GA"
    ]

    snapshots = fetch_rows(
        client,
        "current_venue_inventory_snapshots",
        "id,venue_id,provider_id",
    )
    venue_ids_with_inventory = {
        row["venue_id"] for row in snapshots if row.get("venue_id") is not None
    }

    trail_typed = [row for row in venues if row.get("place_type") == "trail"]
    park_typed = [row for row in venues if row.get("place_type") == "park"]
    campground_typed = [row for row in venues if row.get("place_type") == "campground"]

    trail_like = [row for row in venues if TRAIL_NAME_RE.search(row.get("name") or "")]
    trail_like_mismatch = [
        row for row in trail_like if row.get("place_type") not in {"trail", "park"}
    ]

    camp_like = [row for row in venues if CAMP_NAME_RE.search(row.get("name") or "")]
    camp_like_mismatch = [
        row
        for row in camp_like
        if row.get("place_type") not in {"campground", "park", "trail"}
    ]

    state_park_parents = [
        row
        for row in venues
        if STATE_PARK_RE.search(row.get("name") or "") and row.get("place_type") == "park"
    ]
    state_park_campgrounds = [
        row
        for row in venues
        if STATE_PARK_RE.search(row.get("name") or "") and row.get("place_type") == "campground"
    ]
    state_parks_with_inventory = [
        row for row in state_park_parents if row.get("id") in venue_ids_with_inventory
    ]
    state_parks_without_inventory = [
        row for row in state_park_parents if row.get("id") not in venue_ids_with_inventory
    ]

    print("=" * 72)
    print("Yonder Trail / Camp Coverage Audit")
    print("=" * 72)
    print(f"Georgia active venues: {len(venues)}")
    print(f"Typed as trail: {len(trail_typed)}")
    print(f"Typed as park: {len(park_typed)}")
    print(f"Typed as campground: {len(campground_typed)}")
    print("")
    print(f"Trail-like names: {len(trail_like)}")
    print(f"Trail-like names with mismatched type: {len(trail_like_mismatch)}")
    print(f"Camp-like names: {len(camp_like)}")
    print(f"Camp-like names with mismatched type: {len(camp_like_mismatch)}")
    print("")
    print(f"Georgia state-park parent rows: {len(state_park_parents)}")
    print(f"Georgia state-park campground child rows: {len(state_park_campgrounds)}")
    print(
        "State-park rows with current inventory snapshots: "
        f"{len(state_parks_with_inventory)}"
    )
    print(
        "State-park rows without current inventory snapshots: "
        f"{len(state_parks_without_inventory)}"
    )

    if trail_like_mismatch:
        print("")
        print("Trail-like venues not typed as trail/park:")
        for line in fmt_examples(sorted(trail_like_mismatch, key=lambda row: row["name"])):
            print(line)

    if camp_like_mismatch:
        print("")
        print("Camp-like venues not typed as campground/park/trail:")
        for line in fmt_examples(sorted(camp_like_mismatch, key=lambda row: row["name"])):
            print(line)

    if state_parks_without_inventory:
        print("")
        print("State parks without current inventory snapshots:")
        for line in fmt_examples(sorted(state_parks_without_inventory, key=lambda row: row["name"])):
            print(line)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
