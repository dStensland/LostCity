#!/usr/bin/env python3
"""
Final diagnostic: Apply ALL frontend filters to match category view query.
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db import get_client

def main():
    client = get_client()
    print("=" * 80)
    print("FINAL FILTER ANALYSIS - Matching Frontend Category View Logic")
    print("=" * 80)
    print()
    
    today = datetime.now().strftime("%Y-%m-%d")
    thirty_days = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Get Atlanta portal ID
    result = client.table("portals").select("id,filters").eq("slug", "atlanta").execute()
    atlanta_portal_id = result.data[0]["id"] if result.data else None
    portal_filters = result.data[0].get("filters", {}) if result.data else {}
    
    print(f"Atlanta portal ID: {atlanta_portal_id}")
    print(f"Portal filters: {portal_filters}")
    print(f"Date range: {today} to {thirty_days}")
    print()
    
    # =========================================================================
    # STEP-BY-STEP FILTERING
    # =========================================================================
    
    # Start with all events
    result = client.table("events").select("id", count="exact").execute()
    total = result.count
    print(f"1. Total events: {total:,}")
    
    # Filter: future dates (next 30 days)
    result = client.table("events").select("id", count="exact").gte(
        "start_date", today
    ).lte("start_date", thirty_days).execute()
    count_after_dates = result.count
    print(f"2. After date filter (next 30 days): {count_after_dates:,}")
    
    # Filter: canonical_event_id IS NULL (no duplicates)
    result = client.table("events").select("id", count="exact").gte(
        "start_date", today
    ).lte("start_date", thirty_days).is_("canonical_event_id", "null").execute()
    count_after_dedup = result.count
    print(f"3. After dedup (canonical_event_id IS NULL): {count_after_dedup:,}")
    
    # Filter: portal_id breakdown
    result = client.table("events").select("id,portal_id").gte(
        "start_date", today
    ).lte("start_date", thirty_days).is_("canonical_event_id", "null").execute()
    
    atlanta_only = [e for e in result.data if e.get("portal_id") == atlanta_portal_id]
    null_portal = [e for e in result.data if e.get("portal_id") is None]
    nashville_events = [e for e in result.data if e.get("portal_id") not in [atlanta_portal_id, None]]
    
    print(f"   - Atlanta portal events: {len(atlanta_only):,}")
    print(f"   - NULL portal events: {len(null_portal):,}")
    print(f"   - Other portals: {len(nashville_events):,}")
    
    atlanta_or_null = len(atlanta_only) + len(null_portal)
    print(f"4. After portal filter (Atlanta OR NULL): {atlanta_or_null:,}")
    
    # Try to check for is_chain column
    try:
        result = client.table("venues").select("id").eq("is_chain", True).limit(1).execute()
        has_chain_column = True
    except:
        has_chain_column = False
    
    if has_chain_column:
        result = client.table("venues").select("id").eq("is_chain", True).execute()
        chain_venue_ids = [v["id"] for v in result.data] if result.data else []
        print(f"   Chain venues found: {len(chain_venue_ids)}")
        
        if chain_venue_ids:
            result = client.table("events").select("id", count="exact").gte(
                "start_date", today
            ).lte("start_date", thirty_days).is_(
                "canonical_event_id", "null"
            ).in_("venue_id", chain_venue_ids).execute()
            
            chain_event_count = result.count
            print(f"   Events at chain venues: {chain_event_count:,}")
            count_after_chain = atlanta_or_null - chain_event_count
        else:
            count_after_chain = atlanta_or_null
    else:
        print("   is_chain column not found - skipping chain filter")
        count_after_chain = atlanta_or_null
    
    print(f"5. After chain venue filter: {count_after_chain:,}")
    
    print()
    print("=" * 80)
    print("EXPECTED COUNT IN ATLANTA CATEGORY VIEWS (no personalization)")
    print("=" * 80)
    print(f"~{count_after_chain:,} events")
    print()
    
    # =========================================================================
    # CATEGORY BREAKDOWN
    # =========================================================================
    print("=" * 80)
    print("CATEGORY BREAKDOWN (Atlanta OR NULL portal, next 30 days)")
    print("=" * 80)
    
    result = client.table("events").select("id,category,portal_id").gte(
        "start_date", today
    ).lte("start_date", thirty_days).is_("canonical_event_id", "null").execute()
    
    atlanta_events = [
        e for e in result.data
        if e.get("portal_id") == atlanta_portal_id or e.get("portal_id") is None
    ]
    
    category_counts = {}
    for event in atlanta_events:
        cat = event.get("category") or "NULL"
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    for cat in sorted(category_counts.keys(), key=lambda x: category_counts[x], reverse=True):
        print(f"  {cat}: {category_counts[cat]:,}")
    
    print()
    
    # =========================================================================
    # WHY ONLY 1000 SHOWING?
    # =========================================================================
    print("=" * 80)
    print("WHY ARE ONLY ~1,000 EVENTS SHOWING?")
    print("=" * 80)
    print()
    print("The /api/feed endpoint has PERSONALIZED mode (default ON).")
    print()
    print("When personalized=true AND no explicit filters are applied:")
    print("  - Feed filters to ONLY events matching user preferences")
    print("  - If user has NO follows/preferences, feed is EMPTY")
    print()
    print("The ~1,000 events you're seeing likely means:")
    print("  1. User has some follows/preferences configured")
    print("  2. OR frontend is passing category filter (personalized=0)")
    print("  3. OR frontend is using a different API endpoint")
    print()
    print("Check which API endpoint powers the category views:")
    print("  - /api/feed (personalized, requires follows)")
    print("  - /api/portals/[slug]/feed (portal-specific)")
    print("  - /api/events/search (search with filters)")
    print()

if __name__ == "__main__":
    main()
