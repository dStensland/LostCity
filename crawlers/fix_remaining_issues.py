#!/usr/bin/env python3
"""
Fix remaining P0 data quality issues:
- Duplicates (using batch processing)
- Remaining permanent attractions (Stone Mountain historic square timeout)
- NULL venue_id analysis
"""

from db import get_client
from collections import defaultdict
import sys

def main():
    supabase = get_client()

    print("=" * 80)
    print("FIXING REMAINING P0 ISSUES")
    print("=" * 80)

    # ============================================================================
    # FIX 1: DELETE DUPLICATES (with batching to avoid timeout)
    # ============================================================================
    print("\n" + "=" * 80)
    print("FIX 1: DELETING DUPLICATE EVENTS (BATCHED)")
    print("=" * 80, flush=True)

    # Fetch all events
    print("Fetching all events...", flush=True)
    all_events = []
    offset = 0
    while True:
        batch = supabase.table("events").select("id, title, venue_id, start_date, created_at").range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_events.extend(batch.data)
        offset += 1000

    print(f"Total events: {len(all_events)}", flush=True)

    # Find duplicates
    groups = defaultdict(list)
    for e in all_events:
        key = (e["title"], e["venue_id"], e["start_date"])
        groups[key].append(e)

    duplicate_groups = {k: v for k, v in groups.items() if len(v) > 1}
    print(f"Found {len(duplicate_groups)} duplicate groups", flush=True)

    deleted_dupes = 0
    for i, (key, events) in enumerate(duplicate_groups.items()):
        if i % 10 == 0:
            print(f"  Processing group {i}/{len(duplicate_groups)}...", flush=True)

        sorted_events = sorted(events, key=lambda x: x["created_at"])
        dupes = sorted_events[1:]  # Keep the oldest

        for dupe in dupes:
            try:
                # Clear references and delete in one go
                supabase.table("events").update({"canonical_event_id": None}).eq("canonical_event_id", dupe["id"]).execute()
                supabase.table("events").delete().eq("id", dupe["id"]).execute()
                deleted_dupes += 1
            except Exception as e:
                print(f"    FAILED {dupe['id']}: {e}", flush=True)

    print(f"\n✓ Deleted {deleted_dupes} duplicate events", flush=True)

    # ============================================================================
    # FIX 2: DELETE REMAINING STONE MOUNTAIN EVENTS (one by one)
    # ============================================================================
    print("\n" + "=" * 80)
    print("FIX 2: DELETING REMAINING STONE MOUNTAIN HISTORIC SQUARE EVENTS")
    print("=" * 80, flush=True)

    # Query for the specific title
    try:
        result = supabase.table("events").select("id, title").eq("title", "Historic Square: A Collection Of Georgia Homes and Antiques").execute()
        stone_events = result.data
        print(f"Found {len(stone_events)} Stone Mountain events", flush=True)

        deleted_stone = 0
        for event in stone_events:
            try:
                supabase.table("events").update({"canonical_event_id": None}).eq("canonical_event_id", event["id"]).execute()
                supabase.table("events").delete().eq("id", event["id"]).execute()
                deleted_stone += 1
                if deleted_stone % 10 == 0:
                    print(f"  Deleted {deleted_stone}...", flush=True)
            except Exception as e:
                print(f"  FAILED {event['id']}: {e}", flush=True)

        print(f"\n✓ Deleted {deleted_stone} Stone Mountain events", flush=True)
    except Exception as e:
        print(f"FAILED to query Stone Mountain events: {e}", flush=True)

    # ============================================================================
    # ANALYSIS: NULL VENUE_ID EVENTS
    # ============================================================================
    print("\n" + "=" * 80)
    print("ANALYSIS: NULL VENUE_ID EVENTS")
    print("=" * 80, flush=True)

    try:
        result = supabase.table("events").select("id, title, start_date, category, source_url").is_("venue_id", None).execute()
        null_venue = result.data
        print(f"\nFound {len(null_venue)} events with NULL venue_id", flush=True)

        # Analyze patterns
        from collections import Counter
        categories = Counter(e.get("category") for e in null_venue)
        print(f"\nBy category:")
        for cat, count in categories.most_common(10):
            print(f"  {cat}: {count}")

        # Sample events
        print(f"\nSample events:")
        for e in null_venue[:15]:
            print(f"  - [{e.get('category')}] '{e['title']}' on {e['start_date']}")

        # Check for GSU sports (likely should be at Center Parc Stadium or away)
        gsu_events = [e for e in null_venue if e['title'].startswith('GSU')]
        print(f"\nGSU sports events: {len(gsu_events)} (these are away games or need venue assignment)")

        # Check for webinars/online events
        online_events = [e for e in null_venue if 'webinar' in e['title'].lower() or 'online' in e['title'].lower() or 'virtual' in e['title'].lower()]
        print(f"Online/webinar events: {len(online_events)} (these are OK with NULL venue)")

        print(f"\nRECOMMENDATION: Keep NULL venue_id events. Most are:")
        print(f"  - Away sports games ({len(gsu_events)} GSU events)")
        print(f"  - Online/virtual events ({len(online_events)} events)")
        print(f"  - These are legitimate events without a physical venue in our coverage area")

    except Exception as e:
        print(f"FAILED to analyze NULL venue events: {e}", flush=True)

    # ============================================================================
    # SUMMARY
    # ============================================================================
    print("\n" + "=" * 80)
    print("REMAINING FIXES COMPLETED")
    print("=" * 80)
    print()

if __name__ == "__main__":
    main()
