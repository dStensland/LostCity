#!/usr/bin/env python3
"""
Data Quality Diagnostic: Portal Filtering Analysis
Investigates portal_id filtering and venue_id NULL issues.
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db import get_client

def main():
    client = get_client()
    print("=" * 80)
    print("PORTAL FILTERING & VENUE ANALYSIS")
    print("=" * 80)
    print()
    
    today = datetime.now().strftime("%Y-%m-%d")
    thirty_days = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    # =========================================================================
    # PORTAL_ID DISTRIBUTION
    # =========================================================================
    print("=" * 80)
    print("1. PORTAL_ID DISTRIBUTION (next 30 days, unique events)")
    print("=" * 80)
    
    result = client.table("events").select("portal_id").is_(
        "canonical_event_id", "null"
    ).gte("start_date", today).lte("start_date", thirty_days).execute()
    
    portal_counts = {}
    null_portal_count = 0
    for event in result.data:
        portal_id = event.get("portal_id")
        if portal_id is None:
            null_portal_count += 1
        else:
            portal_counts[portal_id] = portal_counts.get(portal_id, 0) + 1
    
    # Get portal names
    portal_names = {}
    for portal_id in portal_counts.keys():
        result = client.table("portals").select("name,slug").eq("id", portal_id).execute()
        if result.data:
            portal_names[portal_id] = f"{result.data[0]['name']} ({result.data[0]['slug']})"
    
    print(f"Events with NULL portal_id: {null_portal_count:,}")
    print()
    print("Events by portal:")
    for portal_id, count in sorted(portal_counts.items(), key=lambda x: x[1], reverse=True):
        name = portal_names.get(portal_id, f"Unknown (ID {portal_id})")
        print(f"  {name}: {count:,}")
    
    print()
    
    # =========================================================================
    # VENUE_ID ANALYSIS
    # =========================================================================
    print("=" * 80)
    print("2. VENUE_ID ANALYSIS (next 30 days, unique events)")
    print("=" * 80)
    
    result = client.table("events").select("id,venue_id", count="exact").is_(
        "canonical_event_id", "null"
    ).is_("venue_id", "null").gte(
        "start_date", today
    ).lte("start_date", thirty_days).execute()
    
    null_venue_count = result.count
    print(f"Events with NULL venue_id: {null_venue_count:,}")
    
    result = client.table("events").select("id", count="exact").is_(
        "canonical_event_id", "null"
    ).not_.is_("venue_id", "null").gte(
        "start_date", today
    ).lte("start_date", thirty_days).execute()
    
    has_venue_count = result.count
    print(f"Events with venue_id set: {has_venue_count:,}")
    
    print()
    
    # =========================================================================
    # STATUS FLAGS
    # =========================================================================
    print("=" * 80)
    print("3. STATUS FLAGS (next 30 days, unique events)")
    print("=" * 80)
    
    # Check if is_approved field exists
    try:
        result = client.table("events").select("is_approved", count="exact").is_(
            "canonical_event_id", "null"
        ).gte("start_date", today).lte("start_date", thirty_days).limit(1).execute()
        
        result = client.table("events").select("is_approved").is_(
            "canonical_event_id", "null"
        ).gte("start_date", today).lte("start_date", thirty_days).execute()
        
        approved_counts = {"true": 0, "false": 0, "null": 0}
        for event in result.data:
            val = event.get("is_approved")
            if val is None:
                approved_counts["null"] += 1
            elif val:
                approved_counts["true"] += 1
            else:
                approved_counts["false"] += 1
        
        print("is_approved status:")
        print(f"  Approved (TRUE): {approved_counts['true']:,}")
        print(f"  Not approved (FALSE): {approved_counts['false']:,}")
        print(f"  NULL: {approved_counts['null']:,}")
    except Exception as e:
        print(f"is_approved field not found or error: {e}")
    
    print()
    
    # Check status field
    try:
        result = client.table("events").select("status").is_(
            "canonical_event_id", "null"
        ).gte("start_date", today).lte("start_date", thirty_days).execute()
        
        status_counts = {}
        null_status = 0
        for event in result.data:
            status = event.get("status")
            if status is None:
                null_status += 1
            else:
                status_counts[status] = status_counts.get(status, 0) + 1
        
        print("Status field:")
        print(f"  NULL: {null_status:,}")
        for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {status}: {count:,}")
    except Exception as e:
        print(f"status field not found or error: {e}")
    
    print()
    
    # =========================================================================
    # ATLANTA-SPECIFIC FILTERING
    # =========================================================================
    print("=" * 80)
    print("4. ATLANTA PORTAL SPECIFIC (next 30 days, unique events)")
    print("=" * 80)
    
    # Get Atlanta portal ID
    result = client.table("portals").select("id").eq("slug", "atlanta").execute()
    if result.data:
        atlanta_portal_id = result.data[0]["id"]
        
        # Count Atlanta events
        result = client.table("events").select("id", count="exact").is_(
            "canonical_event_id", "null"
        ).eq("portal_id", atlanta_portal_id).gte(
            "start_date", today
        ).lte("start_date", thirty_days).execute()
        
        atlanta_count = result.count
        print(f"Atlanta portal ID: {atlanta_portal_id}")
        print(f"Events in Atlanta portal: {atlanta_count:,}")
        
        # Category breakdown for Atlanta
        result = client.table("events").select("category").is_(
            "canonical_event_id", "null"
        ).eq("portal_id", atlanta_portal_id).gte(
            "start_date", today
        ).lte("start_date", thirty_days).execute()
        
        atlanta_categories = {}
        for event in result.data:
            cat = event.get("category", "NULL")
            atlanta_categories[cat] = atlanta_categories.get(cat, 0) + 1
        
        print()
        print("Atlanta category breakdown:")
        for cat in sorted(atlanta_categories.keys(), key=lambda x: atlanta_categories[x], reverse=True):
            print(f"  {cat}: {atlanta_categories[cat]:,}")
    else:
        print("Atlanta portal not found!")
    
    print()
    
    # =========================================================================
    # TIME FILTERING HYPOTHESIS
    # =========================================================================
    print("=" * 80)
    print("5. TIME FILTERING (next 30 days, unique Atlanta events)")
    print("=" * 80)
    
    if result.data:
        # Events with start_time before 5pm (17:00)
        result = client.table("events").select("id,start_time").is_(
            "canonical_event_id", "null"
        ).eq("portal_id", atlanta_portal_id).gte(
            "start_date", today
        ).lte("start_date", thirty_days).execute()
        
        daytime_events = 0
        evening_events = 0
        no_time = 0
        
        for event in result.data:
            start_time = event.get("start_time")
            if start_time is None:
                no_time += 1
            else:
                try:
                    # Parse time
                    hour = int(start_time.split(":")[0])
                    if hour < 17:
                        daytime_events += 1
                    else:
                        evening_events += 1
                except:
                    no_time += 1
        
        print(f"Daytime events (before 5pm): {daytime_events:,}")
        print(f"Evening events (5pm+): {evening_events:,}")
        print(f"No time data: {no_time:,}")
    
    print()
    
    # =========================================================================
    # FINAL CALCULATION
    # =========================================================================
    print("=" * 80)
    print("6. FINAL CALCULATION - Expected Atlanta Category View Count")
    print("=" * 80)
    
    print(f"Total unique events in next 30 days: 3,862")
    if result.data:
        print(f"Atlanta portal events: {atlanta_count:,}")
        print(f"Nashville/Other portal events: {3862 - atlanta_count:,}")
        print()
        print(f"EXPECTED in Atlanta category views: ~{atlanta_count:,} events")
        print()
        print("If you're seeing ~1,000 events, additional filters may include:")
        print("  - Venue-based filtering (excluding NULL venue_id)")
        print("  - Time-based filtering (excluding daytime events)")
        print("  - Additional undocumented filters in the frontend")
    
    print()

if __name__ == "__main__":
    main()
