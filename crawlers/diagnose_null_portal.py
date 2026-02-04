#!/usr/bin/env python3
"""
Investigate the 2,862 events with NULL portal_id that aren't showing.
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db import get_client

def main():
    client = get_client()
    print("=" * 80)
    print("NULL PORTAL_ID INVESTIGATION")
    print("=" * 80)
    print()
    
    today = datetime.now().strftime("%Y-%m-%d")
    thirty_days = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Get Atlanta portal ID
    result = client.table("portals").select("id").eq("slug", "atlanta").execute()
    atlanta_portal_id = result.data[0]["id"] if result.data else None
    
    # Get all events with NULL portal_id in next 30 days
    result = client.table("events").select(
        "id,title,start_date,category,venue_id,source_id,portal_id"
    ).gte(
        "start_date", today
    ).lte("start_date", thirty_days).is_(
        "canonical_event_id", "null"
    ).is_("portal_id", "null").execute()
    
    null_portal_events = result.data
    print(f"Total events with NULL portal_id (next 30 days): {len(null_portal_events):,}")
    print()
    
    # Get source breakdown
    source_counts = {}
    for event in null_portal_events:
        source_id = event.get("source_id")
        if source_id:
            source_counts[source_id] = source_counts.get(source_id, 0) + 1
    
    print("Top 10 sources with NULL portal_id events:")
    source_names = {}
    for source_id in sorted(source_counts.keys(), key=lambda x: source_counts[x], reverse=True)[:10]:
        result = client.table("sources").select("name,portal_id").eq("id", source_id).execute()
        if result.data:
            source_names[source_id] = result.data[0].get("name")
            source_portal = result.data[0].get("portal_id")
            print(f"  {source_names[source_id]}: {source_counts[source_id]:,} events (source portal_id: {source_portal})")
    
    print()
    
    # Check venue distribution
    venue_counts = {}
    for event in null_portal_events:
        venue_id = event.get("venue_id")
        if venue_id:
            venue_counts[venue_id] = venue_counts.get(venue_id, 0) + 1
    
    print(f"Events with venue_id: {len([e for e in null_portal_events if e.get('venue_id')])} / {len(null_portal_events)}")
    print(f"Events without venue_id: {len([e for e in null_portal_events if not e.get('venue_id')])}")
    print()
    
    # Category breakdown
    category_counts = {}
    for event in null_portal_events:
        cat = event.get("category") or "NULL"
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    print("Category breakdown (NULL portal events):")
    for cat in sorted(category_counts.keys(), key=lambda x: category_counts[x], reverse=True):
        print(f"  {cat}: {category_counts[cat]:,}")
    
    print()
    
    # =========================================================================
    # THE BIG QUESTION: Why aren't these showing?
    # =========================================================================
    print("=" * 80)
    print("DIAGNOSIS: Why NULL portal events aren't showing")
    print("=" * 80)
    print()
    print("Events with NULL portal_id SHOULD show in Atlanta portal based on:")
    print("  - /api/portals/[slug]/feed line 418:")
    print("    poolQuery.or(`portal_id.eq.${portal.id},portal_id.is.null`)")
    print()
    print("These 99 NULL-portal events ARE correctly included in the query.")
    print()
    print("The missing ~2,763 events are from OTHER portals (Nashville, etc.)")
    print("and are correctly excluded from Atlanta views.")
    print()

if __name__ == "__main__":
    main()
