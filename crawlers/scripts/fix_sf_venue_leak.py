#!/usr/bin/env python3
"""
Task 2: Suppress "San Francisco" bar crawl events leaking into the Atlanta feed.

Root cause analysis:
  - Events 20631 and 20632 are from source 411 (College Park Main Street /
    Eventbrite org), which is already inactive (is_active=False).
  - The events were produced by a national bar crawl promoter who uses "San
    Francisco [Event Name]" as a brand/template, running the same events in
    multiple cities. The venue (Mayes Oyster House) IS in Atlanta, so setting
    city=SF on the venue would be wrong and would break a legitimate Atlanta venue.
  - The source is already dead; these two orphaned events just need to be
    deactivated so they stop appearing in the feed.
  - Separate finding: 89 upcoming events have venue.city=NULL but are clearly
    Atlanta-area venues (GSU Baseball Complex, Gwinnett Field, Lore, Emory, etc.).
    This is a broader city-backfill gap logged below but not auto-fixed here
    since those venues ARE in Atlanta — the null doesn't cause a leak, it just
    means the column was never populated.

This script:
  1. Confirms the two SF-named events and their venue/source context.
  2. In --apply mode, sets is_active=False on events 20631 and 20632.
  3. Reports the count of null-city Atlanta venues for follow-up.

Usage:
  cd crawlers
  python scripts/fix_sf_venue_leak.py          # dry-run (default)
  python scripts/fix_sf_venue_leak.py --apply  # write to production
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_client

TODAY = date.today().isoformat()

# The two events to deactivate.
SF_EVENT_IDS = [20631, 20632]


def main(apply: bool) -> None:
    client = get_client()

    print("=== Step 1: Inspect the two SF-named events ===")
    resp = (
        client.table("events")
        .select(
            "id, title, start_date, source_id, is_active, "
            "venues!inner(id, name, city, address)"
        )
        .in_("id", SF_EVENT_IDS)
        .execute()
    )
    events = resp.data or []

    if not events:
        print("  WARNING: Neither event found — already removed or IDs changed.")
        return

    for ev in events:
        venue = ev.get("venues") or {}
        print(
            f"  id={ev['id']:>6}  is_active={ev['is_active']}  "
            f"source={ev.get('source_id') or 'NULL'}  "
            f"date={ev['start_date']}"
        )
        print(f"    title={ev['title']!r}")
        print(
            f"    venue id={venue.get('id')}  name={venue.get('name')!r}  "
            f"city={venue.get('city')!r}  address={venue.get('address')!r}"
        )

    # Confirm source 411 is already inactive
    source_resp = (
        client.table("sources")
        .select("id, slug, name, is_active")
        .eq("id", 411)
        .execute()
    )
    source = (source_resp.data or [{}])[0]
    print(
        f"\n  Source 411: slug={source.get('slug')!r}  "
        f"name={source.get('name')!r}  is_active={source.get('is_active')}"
    )

    active_events = [ev for ev in events if ev.get("is_active")]
    if not active_events:
        print("\n  Both events are already inactive — nothing to do.")
        return

    print(f"\n  Will deactivate {len(active_events)} event(s): {[ev['id'] for ev in active_events]}")

    print("\n=== Step 2: Null-city venue summary (informational, not auto-fixed) ===")
    null_city_resp = (
        client.table("events")
        .select("venue_id, venues!inner(id, name, city, address)")
        .gte("start_date", TODAY)
        .is_("venues.city", "null")
        .execute()
    )
    null_city_events = null_city_resp.data or []
    null_venue_ids = {(ev.get("venues") or {}).get("id") for ev in null_city_events if ev.get("venues")}
    print(
        f"  {len(null_city_events)} upcoming events across {len(null_venue_ids)} venues have city=NULL."
    )
    print(
        "  These are mostly legitimate Atlanta venues (GSU Baseball Complex, Gwinnett Field,\n"
        "  Emory, etc.) where the city column was simply never populated. They are not\n"
        "  leaking into wrong portals — just missing the city field. Recommend a follow-up\n"
        "  script to backfill city='Atlanta' / state='GA' from address text on these venues."
    )

    if not apply:
        print("\n[DRY RUN] No changes written. Pass --apply to execute.")
        return

    print("\n=== Applying deactivation ===")
    deactivated = 0
    for ev in active_events:
        resp = (
            client.table("events")
            .update({"is_active": False})
            .eq("id", ev["id"])
            .execute()
        )
        if resp.data:
            print(f"  [APPLIED] Deactivated event id={ev['id']}: {ev['title']!r}")
            deactivated += 1
        else:
            print(f"  [ERROR] Deactivation of id={ev['id']} returned no data: {resp}")

    # Verify
    print("\n=== Verification ===")
    verify_resp = (
        client.table("events")
        .select("id, title, is_active")
        .in_("id", SF_EVENT_IDS)
        .execute()
    )
    all_ok = True
    for row in verify_resp.data or []:
        ok = not row.get("is_active")
        status = "OK  " if ok else "FAIL"
        print(f"  [{status}] id={row['id']}  is_active={row['is_active']}  title={row['title']!r}")
        if not ok:
            all_ok = False

    if all_ok and deactivated == len(active_events):
        print(f"\n  Task 2 COMPLETE — {deactivated} event(s) deactivated.")
    else:
        print(f"\n  Task 2 INCOMPLETE — {deactivated}/{len(active_events)} deactivated. Check above.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Suppress SF bar crawl events leaking into Atlanta feed"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Write changes to production (default: dry-run)",
    )
    args = parser.parse_args()
    main(apply=args.apply)
