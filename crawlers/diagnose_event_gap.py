#!/usr/bin/env python3
"""
Data Quality Diagnostic: Event Count Gap Analysis
Investigates why ~8000 total events only show ~1000 in category views (next 30 days).
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from db import get_client

def main():
    client = get_client()
    print("=" * 80)
    print("DATA QUALITY DIAGNOSTIC: Event Count Gap Analysis")
    print("=" * 80)
    print()
    
    # Get today's date and 30 days from now
    today = datetime.now().strftime("%Y-%m-%d")
    thirty_days = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    print(f"Analysis Date Range: {today} to {thirty_days}")
    print()
    
    # =========================================================================
    # 1. TOTAL EVENT COUNT AND BREAKDOWN
    # =========================================================================
    print("=" * 80)
    print("1. TOTAL EVENT COUNT AND BREAKDOWN")
    print("=" * 80)
    
    # Total events
    result = client.table("events").select("id", count="exact").execute()
    total_count = result.count
    print(f"Total events in database: {total_count:,}")
    
    # Future events (next 30 days)
    result = client.table("events").select("id", count="exact").gte(
        "start_date", today
    ).lte("start_date", thirty_days).execute()
    future_30_count = result.count
    print(f"Events in next 30 days: {future_30_count:,}")
    
    # Past events
    result = client.table("events").select("id", count="exact").lt(
        "start_date", today
    ).execute()
    past_count = result.count
    print(f"Events in the past: {past_count:,}")
    
    # Events with NULL start_date
    result = client.table("events").select("id", count="exact").is_(
        "start_date", "null"
    ).execute()
    null_date_count = result.count
    print(f"Events with NULL start_date: {null_date_count:,}")
    
    # Events far in the future (> 30 days)
    result = client.table("events").select("id", count="exact").gt(
        "start_date", thirty_days
    ).execute()
    far_future_count = result.count
    print(f"Events beyond 30 days: {far_future_count:,}")
    
    print()
    
    # =========================================================================
    # 2. DEDUPLICATION FILTER (canonical_event_id)
    # =========================================================================
    print("=" * 80)
    print("2. DEDUPLICATION FILTER (canonical_event_id)")
    print("=" * 80)
    
    # Events that are duplicates (pointing to another event)
    result = client.table("events").select("id", count="exact").not_.is_(
        "canonical_event_id", "null"
    ).execute()
    duplicate_count = result.count
    print(f"Events marked as duplicates (canonical_event_id IS NOT NULL): {duplicate_count:,}")
    
    # Duplicates in next 30 days
    result = client.table("events").select("id", count="exact").not_.is_(
        "canonical_event_id", "null"
    ).gte("start_date", today).lte("start_date", thirty_days).execute()
    duplicate_future_count = result.count
    print(f"Duplicates in next 30 days: {duplicate_future_count:,}")
    
    # Unique events (no canonical_event_id) in next 30 days
    unique_future = future_30_count - duplicate_future_count
    print(f"Unique events in next 30 days (after dedup): {unique_future:,}")
    
    print()
    
    # =========================================================================
    # 3. CATEGORY COVERAGE
    # =========================================================================
    print("=" * 80)
    print("3. CATEGORY COVERAGE")
    print("=" * 80)
    
    # Events with NULL category in next 30 days
    result = client.table("events").select("id", count="exact").is_(
        "category", "null"
    ).gte("start_date", today).lte("start_date", thirty_days).execute()
    null_category_future = result.count
    print(f"Events with NULL category (next 30 days): {null_category_future:,}")
    
    # Events with category set in next 30 days
    result = client.table("events").select("id", count="exact").not_.is_(
        "category", "null"
    ).gte("start_date", today).lte("start_date", thirty_days).execute()
    has_category_future = result.count
    print(f"Events with category set (next 30 days): {has_category_future:,}")
    
    print()
    print("Breakdown by category (next 30 days, unique events only):")
    
    # Get category breakdown for unique future events
    result = client.table("events").select("category").is_(
        "canonical_event_id", "null"
    ).not_.is_("category", "null").gte(
        "start_date", today
    ).lte("start_date", thirty_days).execute()
    
    category_counts = {}
    for event in result.data:
        cat = event.get("category", "NULL")
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    for cat in sorted(category_counts.keys(), key=lambda x: category_counts[x], reverse=True):
        print(f"  {cat}: {category_counts[cat]:,}")
    
    print()
    
    # =========================================================================
    # 4. RECURRING EVENTS / SERIES ANALYSIS
    # =========================================================================
    print("=" * 80)
    print("4. RECURRING EVENTS / SERIES ANALYSIS")
    print("=" * 80)
    
    # Events that are part of a series
    result = client.table("events").select("id", count="exact").not_.is_(
        "series_id", "null"
    ).execute()
    series_events_count = result.count
    print(f"Events with series_id (total): {series_events_count:,}")
    
    # Events with series_id in next 30 days
    result = client.table("events").select("id", count="exact").not_.is_(
        "series_id", "null"
    ).gte("start_date", today).lte("start_date", thirty_days).execute()
    series_future_count = result.count
    print(f"Events with series_id (next 30 days): {series_future_count:,}")
    
    # Count unique series
    result = client.table("series").select("id", count="exact").execute()
    series_count = result.count
    print(f"Total unique series: {series_count:,}")
    
    print()
    
    # =========================================================================
    # 5. PROBLEM EVENTS ANALYSIS
    # =========================================================================
    print("=" * 80)
    print("5. PROBLEM EVENTS ANALYSIS")
    print("=" * 80)
    
    # Future events with no category (sample)
    print("Sample events with future dates but missing category:")
    result = client.table("events").select(
        "id,title,start_date,venue_id,source_id"
    ).is_("category", "null").is_(
        "canonical_event_id", "null"
    ).gte("start_date", today).lte("start_date", thirty_days).limit(10).execute()
    
    for event in result.data:
        print(f"  ID {event['id']}: {event['title'][:60]} | {event['start_date']} | venue={event['venue_id']} | source={event['source_id']}")
    
    print()
    
    # All-day events in next 30 days
    result = client.table("events").select("id", count="exact").eq(
        "is_all_day", True
    ).gte("start_date", today).lte("start_date", thirty_days).execute()
    all_day_count = result.count
    print(f"All-day events (next 30 days): {all_day_count:,}")
    
    # Events with start_time = "00:00:00" or NULL
    result = client.table("events").select("id,start_time", count="exact").gte(
        "start_date", today
    ).lte("start_date", thirty_days).execute()
    
    midnight_count = 0
    null_time_count = 0
    for event in result.data:
        if event.get("start_time") is None:
            null_time_count += 1
        elif event.get("start_time") == "00:00:00":
            midnight_count += 1
    
    print(f"Events with NULL start_time (next 30 days): {null_time_count:,}")
    print(f"Events with midnight start_time (next 30 days): {midnight_count:,}")
    
    print()
    
    # =========================================================================
    # 6. SOURCE BREAKDOWN
    # =========================================================================
    print("=" * 80)
    print("6. SOURCE BREAKDOWN (Top 15 by event count, next 30 days)")
    print("=" * 80)
    
    result = client.table("events").select("source_id").is_(
        "canonical_event_id", "null"
    ).gte("start_date", today).lte("start_date", thirty_days).execute()
    
    source_counts = {}
    for event in result.data:
        source_id = event.get("source_id")
        source_counts[source_id] = source_counts.get(source_id, 0) + 1
    
    # Get source names
    source_names = {}
    for source_id in source_counts.keys():
        if source_id:
            result = client.table("sources").select("name").eq("id", source_id).execute()
            if result.data:
                source_names[source_id] = result.data[0].get("name", f"Source {source_id}")
    
    # Sort and display top 15
    sorted_sources = sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:15]
    for source_id, count in sorted_sources:
        name = source_names.get(source_id, f"Unknown (ID {source_id})")
        print(f"  {name}: {count:,}")
    
    print()
    
    # =========================================================================
    # 7. FINAL SUMMARY
    # =========================================================================
    print("=" * 80)
    print("7. SUMMARY - Why events aren't showing in category views")
    print("=" * 80)
    
    print(f"Starting with: {total_count:,} total events")
    print(f"Filter to next 30 days: {future_30_count:,} events remain")
    print(f"Remove duplicates: {unique_future:,} events remain")
    print(f"Events with category assigned: {has_category_future:,}")
    print(f"Events missing category: {null_category_future:,}")
    print()
    print("EXPECTED events in category views (unique + categorized): ~{:,}".format(
        has_category_future - duplicate_future_count
    ))
    print()
    print("PRIMARY ISSUE: Check if frontend filters are excluding events based on:")
    print("  - portal_id filtering (Nashville vs Atlanta events)")
    print("  - Additional time filters (e.g., only showing evening events)")
    print("  - is_approved or status flags")
    print("  - venue_id NULL filtering")
    print()

if __name__ == "__main__":
    main()
