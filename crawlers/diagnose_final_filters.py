#!/usr/bin/env python3
"""
Final diagnostic: Apply ALL frontend filters to match category view query.
This mimics the exact filtering logic from /api/feed/route.ts
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
    result = client.table("portals").select("id").eq("slug", "atlanta").execute()
    atlanta_portal_id = result.data[0]["id"] if result.data else None
    
    print(f"Atlanta portal ID: {atlanta_portal_id}")
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
    
    # Filter: portal_id (Atlanta OR NULL)
    if atlanta_portal_id:
        # Need to manually filter since .or() is complex
        result = client.table("events").select("id,portal_id").gte(
            "start_date", today
        ).lte("start_date", thirty_days).is_("canonical_event_id", "null").execute()
        
        atlanta_or_null = [
            e for e in result.data 
            if e.get("portal_id") == atlanta_portal_id or e.get("portal_id") is None
        ]
        count_after_portal = len(atlanta_or_null)
        print(f"4. After portal filter (Atlanta OR NULL): {count_after_portal:,}")
    
    # Filter: chain venues (is_chain = true venues excluded)
    # First get chain venue IDs
    result = client.table("venues").select("id").eq("is_chain", True).execute()
    chain_venue_ids = [v["id"] for v in result.data] if result.data else []
    
    print(f"   Chain venues found: {len(chain_venue_ids)}")
    
    # Count events at chain venues
    if chain_venue_ids:
        result = client.table("events").select("id", count="exact").gte(
            "start_date", today
        ).lte("start_date", thirty_days).is_(
            "canonical_event_id", "null"
        ).in_("venue_id", chain_venue_ids).execute()
        
        chain_event_count = result.count
        print(f"   Events at chain venues: {chain_event_count:,}")
        
        count_after_chain_filter = count_after_portal - chain_event_count
        print(f"5. After chain venue filter: {count_after_chain_filter:,}")
    else:
        count_after_chain_filter = count_after_portal
        print(f"5. After chain venue filter: {count_after_chain_filter:,} (no chains)")
    
    print()
    print("=" * 80)
    print("EXPECTED COUNT IN ATLANTA CATEGORY VIEWS")
    print("=" * 80)
    print(f"~{count_after_chain_filter:,} events")
    print()
    
    # =========================================================================
    # ADDITIONAL INVESTIGATION: Personalized feed filtering
    # =========================================================================
    print("=" * 80)
    print("IMPORTANT: Feed personalization may reduce count further")
    print("=" * 80)
    print()
    print("The /api/feed endpoint has personalized mode (default ON) which filters to:")
    print("  - Events from followed venues")
    print("  - Events from followed organizations")
    print("  - Events matching favorite categories")
    print("  - Events in favorite neighborhoods")
    print("  - Events where friends are going")
    print()
    print("If the user has NO follows/preferences, personalized feed shows ZERO events.")
    print()
    print("To see ALL events, the frontend must either:")
    print("  1. Pass personalized=0 in the query")
    print("  2. Apply explicit filters (categories, search, tags, neighborhoods)")
    print()
    
    # Check if there are explicit category filters in portal config
    if atlanta_portal_id:
        result = client.table("portals").select("filters").eq("id", atlanta_portal_id).execute()
        if result.data and result.data[0].get("filters"):
            portal_filters = result.data[0]["filters"]
            print("Portal-level filters:")
            print(f"  {portal_filters}")
            
            if portal_filters.get("categories"):
                # Count events matching portal categories
                result = client.table("events").select("id", count="exact").gte(
                    "start_date", today
                ).lte("start_date", thirty_days).is_(
                    "canonical_event_id", "null"
                ).in_("category", portal_filters["categories"]).execute()
                
                category_filtered_count = result.count
                print(f"  Events matching portal categories: {category_filtered_count:,}")
        else:
            print("No portal-level category filters configured.")
    
    print()
    
    # =========================================================================
    # BREAKDOWN BY CATEGORY (Atlanta, non-chain, unique)
    # =========================================================================
    print("=" * 80)
    print("CATEGORY BREAKDOWN (Atlanta portal, next 30 days, non-chain)")
    print("=" * 80)
    
    # Get all Atlanta events (non-chain, non-duplicate)
    result = client.table("events").select("id,category,venue_id,portal_id").gte(
        "start_date", today
    ).lte("start_date", thirty_days).is_("canonical_event_id", "null").execute()
    
    atlanta_events = [
        e for e in result.data
        if (e.get("portal_id") == atlanta_portal_id or e.get("portal_id") is None)
        and (not e.get("venue_id") or e.get("venue_id") not in chain_venue_ids)
    ]
    
    category_counts = {}
    for event in atlanta_events:
        cat = event.get("category") or "NULL"
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    for cat in sorted(category_counts.keys(), key=lambda x: category_counts[x], reverse=True):
        print(f"  {cat}: {category_counts[cat]:,}")
    
    print()
    print(f"Total: {len(atlanta_events):,}")
    print()

if __name__ == "__main__":
    main()
