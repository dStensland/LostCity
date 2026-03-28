#!/usr/bin/env python3
"""
Deactivate active events linked to inactive venues.

Dry-run by default. Use --apply to execute updates.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client

try:
    from closed_venues import CLOSED_VENUE_SLUGS
except Exception:
    CLOSED_VENUE_SLUGS = set()


def _chunked(values: list[int], size: int = 400) -> list[list[int]]:
    return [values[idx : idx + size] for idx in range(0, len(values), size)]


def _has_column(client, table: str, column: str) -> bool:
    try:
        client.table(table).select(column).limit(1).execute()
        return True
    except Exception as exc:
        text = str(exc).lower()
        if "does not exist" in text or "pgrst205" in text or "42703" in text:
            return False
        raise


def _resolve_events_active_column(client) -> str | None:
    if _has_column(client, "events", "is_active"):
        return "is_active"
    return None


def _load_inactive_venues(client, *, registry_only: bool) -> list[dict[str, Any]]:
    query = client.table("places").select("id,name,slug,active").eq("active", False)
    if registry_only and CLOSED_VENUE_SLUGS:
        query = query.in_("slug", sorted(CLOSED_VENUE_SLUGS))
    return query.limit(12000).execute().data or []


def _load_candidate_events(
    client,
    venue_ids: list[int],
    *,
    include_past: bool,
    active_column: str | None,
) -> list[dict[str, Any]]:
    if not venue_ids:
        return []

    today = date.today().isoformat()
    events: list[dict[str, Any]] = []
    for bucket in _chunked(venue_ids):
        query = (
            client.table("events")
            .select("id,title,venue_id,start_date,end_date,canonical_event_id")
            .in_("venue_id", bucket)
        )
        if active_column:
            query = query.eq(active_column, True)
        if not include_past:
            query = query.or_(f"start_date.gte.{today},end_date.gte.{today}")
        events.extend(query.limit(12000).execute().data or [])
    return events


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Deactivate active events on inactive venues."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute updates (default is dry-run).",
    )
    parser.add_argument(
        "--include-past",
        action="store_true",
        help="Also deactivate past active events (default: future/ongoing only).",
    )
    parser.add_argument(
        "--registry-only",
        action="store_true",
        help="Only target inactive venues listed in closed_venues registry.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=25,
        help="Show top N venues by candidate event count (default: 25).",
    )
    args = parser.parse_args()

    client = get_client()
    active_column = _resolve_events_active_column(client)
    inactive_venues = _load_inactive_venues(client, registry_only=args.registry_only)
    venue_ids = [int(v["id"]) for v in inactive_venues if v.get("id")]
    venue_map = {
        int(v["id"]): f'{v.get("name") or "Unknown"} ({v.get("slug") or "no-slug"})'
        for v in inactive_venues
        if v.get("id")
    }

    candidates = _load_candidate_events(
        client,
        venue_ids,
        include_past=args.include_past,
        active_column=active_column,
    )

    candidate_ids = [int(e["id"]) for e in candidates if e.get("id")]
    candidate_visible = [
        e for e in candidates if e.get("canonical_event_id") in (None, 0, "0")
    ]

    by_venue = Counter(int(e["venue_id"]) for e in candidates if e.get("venue_id"))
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(
        f"[{mode}] events_active_column={active_column or 'none'} "
        f"inactive_venues_scanned={len(inactive_venues)} "
        f"candidate_events={len(candidates)} visible_candidates={len(candidate_visible)}"
    )

    if by_venue:
        print("\nTop venues with active events while inactive:")
        for venue_id, count in by_venue.most_common(max(1, args.top)):
            print(f"- {venue_map.get(venue_id, str(venue_id))}: {count}")

    if args.apply and candidate_ids and active_column:
        for bucket in _chunked(candidate_ids):
            (
                client.table("events")
                .update({active_column: False})
                .in_("id", bucket)
                .execute()
            )
        print(f"\nUpdated events.{active_column}=false for {len(candidate_ids)} events.")
    elif args.apply and candidate_ids and not active_column:
        print(
            "\nNo `events.is_active` column in current schema; cannot deactivate events at row level."
        )


if __name__ == "__main__":
    main()
