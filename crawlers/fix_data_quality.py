#!/usr/bin/env python3
"""
Data Quality Fix Script - P0 Issues
Fixes duplicates, permanent attractions, invalid categories, and garbage titles.
"""

from db import get_client
from collections import defaultdict, Counter
import re
import sys

def main():
    supabase = get_client()

    print("=" * 80)
    print("DATA QUALITY FIX SCRIPT - P0 ISSUES")
    print("=" * 80)

    # Fetch all events
    print("\nFetching all events...", flush=True)
    all_events = []
    offset = 0
    while True:
        batch = supabase.table("events").select("id, title, venue_id, start_date, created_at, category").range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_events.extend(batch.data)
        offset += 1000
        if offset % 5000 == 0:
            print(f"  Fetched {offset} events...", flush=True)

    print(f"Total events fetched: {len(all_events)}", flush=True)

    # ============================================================================
    # FIX 1: DELETE DUPLICATES
    # ============================================================================
    print("\n" + "=" * 80)
    print("FIX 1: DELETING DUPLICATE EVENTS")
    print("=" * 80, flush=True)

    groups = defaultdict(list)
    for e in all_events:
        key = (e["title"], e["venue_id"], e["start_date"])
        groups[key].append(e)

    duplicate_groups = {k: v for k, v in groups.items() if len(v) > 1}
    deleted_dupes = 0
    failed_dupes = 0

    for key, events in duplicate_groups.items():
        sorted_events = sorted(events, key=lambda x: x["created_at"])
        keeper = sorted_events[0]
        dupes = sorted_events[1:]

        for dupe in dupes:
            try:
                # Clear any canonical_event_id references first
                supabase.table("events").update({"canonical_event_id": None}).eq("canonical_event_id", dupe["id"]).execute()
                # Delete the duplicate
                supabase.table("events").delete().eq("id", dupe["id"]).execute()
                deleted_dupes += 1
                if deleted_dupes % 10 == 0:
                    print(f"  Deleted {deleted_dupes}...", flush=True)
            except Exception as e:
                print(f"  FAILED to delete duplicate {dupe['id']}: {e}", flush=True)
                failed_dupes += 1

    print(f"\n✓ Deleted {deleted_dupes} duplicate events", flush=True)
    if failed_dupes > 0:
        print(f"✗ Failed to delete {failed_dupes} duplicates", flush=True)

    # ============================================================================
    # FIX 2: DELETE PERMANENT ATTRACTIONS
    # ============================================================================
    print("\n" + "=" * 80)
    print("FIX 2: DELETING PERMANENT ATTRACTION EVENTS")
    print("=" * 80, flush=True)

    # Refresh events list after deletions
    print("Refreshing event list...", flush=True)
    all_events = []
    offset = 0
    while True:
        batch = supabase.table("events").select("id, title, venue_id, start_date, created_at, category").range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_events.extend(batch.data)
        offset += 1000

    title_counts = Counter(e["title"] for e in all_events)

    # Permanent attractions to delete (based on analysis)
    permanent_attractions = [
        "Historic Square: A Collection Of Georgia Homes and Antiques",  # 237x - daily operation at Stone Mountain
        "Summer at the Rock",  # 51x - general admission
        "Tours: Truist Park",  # 39x - daily tours
    ]

    deleted_permanent = 0
    for title in permanent_attractions:
        try:
            # Find all events with this title
            events = [e for e in all_events if e["title"] == title]
            print(f"\nDeleting '{title}' ({len(events)} events)...", flush=True)

            for event in events:
                # Clear canonical references
                supabase.table("events").update({"canonical_event_id": None}).eq("canonical_event_id", event["id"]).execute()
                # Delete
                supabase.table("events").delete().eq("id", event["id"]).execute()
                deleted_permanent += 1
        except Exception as e:
            print(f"  FAILED to delete permanent attraction '{title}': {e}", flush=True)

    print(f"\n✓ Deleted {deleted_permanent} permanent attraction events", flush=True)

    # ============================================================================
    # FIX 3: FIX INVALID CATEGORIES
    # ============================================================================
    print("\n" + "=" * 80)
    print("FIX 3: FIXING INVALID CATEGORIES")
    print("=" * 80, flush=True)

    valid_categories = [
        "music","film","comedy","theater","art","sports","food_drink","nightlife",
        "community","fitness","family","learning","dance","tours","meetup","words",
        "religious","markets","wellness","support_group","gaming","outdoors","other"
    ]

    # Refresh events
    print("Refreshing event list...", flush=True)
    all_events = []
    offset = 0
    while True:
        batch = supabase.table("events").select("id, title, venue_id, start_date, created_at, category").range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_events.extend(batch.data)
        offset += 1000

    invalid_cats = [e for e in all_events if e.get("category") not in valid_categories]
    fixed_cats = 0

    for e in invalid_cats:
        try:
            # "literary" -> "words"
            if e.get("category") == "literary":
                supabase.table("events").update({"category": "words"}).eq("id", e["id"]).execute()
                print(f"  Fixed: '{e['title']}' - literary → words", flush=True)
                fixed_cats += 1
            else:
                # Unknown category -> "other"
                supabase.table("events").update({"category": "other"}).eq("id", e["id"]).execute()
                print(f"  Fixed: '{e['title']}' - {e.get('category')} → other", flush=True)
                fixed_cats += 1
        except Exception as e_err:
            print(f"  FAILED to fix category for {e['id']}: {e_err}", flush=True)

    print(f"\n✓ Fixed {fixed_cats} invalid categories", flush=True)

    # ============================================================================
    # FIX 4: DELETE GARBAGE TITLES
    # ============================================================================
    print("\n" + "=" * 80)
    print("FIX 4: DELETING GARBAGE TITLES")
    print("=" * 80, flush=True)

    # Refresh events
    print("Refreshing event list...", flush=True)
    all_events = []
    offset = 0
    while True:
        batch = supabase.table("events").select("id, title, venue_id, start_date, created_at, category").range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_events.extend(batch.data)
        offset += 1000

    garbage = []
    for e in all_events:
        t = e["title"]
        if re.match(r'^\d{1,2}/\d{1,2}/\d{2,4}$', t):  # Date
            garbage.append(e)
        elif re.match(r'^https?://', t):  # URL
            garbage.append(e)
        elif re.match(r'^\(\d{3}\)', t):  # Phone
            garbage.append(e)
        elif len(t) < 3:
            garbage.append(e)
        elif t.lower() in ["event", "events", "show", "performance"]:
            garbage.append(e)

    deleted_garbage = 0
    for g in garbage:
        try:
            print(f"  Deleting: '{g['title']}' (id={g['id']})", flush=True)
            # Clear canonical references
            supabase.table("events").update({"canonical_event_id": None}).eq("canonical_event_id", g["id"]).execute()
            # Delete
            supabase.table("events").delete().eq("id", g["id"]).execute()
            deleted_garbage += 1
        except Exception as e:
            print(f"  FAILED to delete garbage title {g['id']}: {e}", flush=True)

    print(f"\n✓ Deleted {deleted_garbage} garbage title events", flush=True)

    # ============================================================================
    # SUMMARY
    # ============================================================================
    print("\n" + "=" * 80)
    print("FIXES APPLIED SUCCESSFULLY")
    print("=" * 80)
    print(f"\nSummary:")
    print(f"  - Deleted {deleted_dupes} duplicate events")
    print(f"  - Deleted {deleted_permanent} permanent attraction events")
    print(f"  - Fixed {fixed_cats} invalid categories")
    print(f"  - Deleted {deleted_garbage} garbage title events")
    print(f"  - TOTAL CLEANED: {deleted_dupes + deleted_permanent + deleted_garbage} events removed, {fixed_cats} events fixed")
    print()

if __name__ == "__main__":
    main()
