#!/usr/bin/env python3
"""
Data Quality Statistics Report
Runs diagnostic queries against the Supabase database
"""

import sys
from datetime import date
from db import get_client

def main():
    client = get_client()
    today = '2026-02-04'
    
    print("=" * 80)
    print("DATA QUALITY REPORT")
    print(f"Generated: {today}")
    print("=" * 80)
    print()
    
    # 1. Total future events
    result = client.table("events").select("id", count="exact").gte("start_date", today).execute()
    total_future = result.count
    print(f"1. Total future events (start_date >= {today}): {total_future:,}")
    print()
    
    # 2. Future events with NULL description
    result = client.table("events").select("id", count="exact").gte("start_date", today).is_("description", "null").execute()
    null_desc = result.count
    null_desc_pct = (null_desc / total_future * 100) if total_future > 0 else 0
    print(f"2. Future events with NULL description: {null_desc:,} ({null_desc_pct:.2f}%)")
    print()
    
    # 3. Future events with NULL image_url
    result = client.table("events").select("id", count="exact").gte("start_date", today).is_("image_url", "null").execute()
    null_image = result.count
    null_image_pct = (null_image / total_future * 100) if total_future > 0 else 0
    print(f"3. Future events with NULL image_url: {null_image:,} ({null_image_pct:.2f}%)")
    print()
    
    # 4. Future events with NULL start_time
    result = client.table("events").select("id", count="exact").gte("start_date", today).is_("start_time", "null").execute()
    null_time = result.count
    null_time_pct = (null_time / total_future * 100) if total_future > 0 else 0
    print(f"4. Future events with NULL start_time: {null_time:,} ({null_time_pct:.2f}%)")
    print()
    
    # 5. Future events with NULL price_min AND is_free = false
    result = client.table("events").select("id", count="exact").gte("start_date", today).is_("price_min", "null").eq("is_free", False).execute()
    null_price = result.count
    null_price_pct = (null_price / total_future * 100) if total_future > 0 else 0
    print(f"5. Future events with NULL price_min AND is_free=false: {null_price:,} ({null_price_pct:.2f}%)")
    print()
    
    # 6. Total venues
    result = client.table("venues").select("id", count="exact").execute()
    total_venues = result.count
    print(f"6. Total venues: {total_venues:,}")
    print()
    
    # 7. Category breakdown for future events
    print("7. Category breakdown for future events:")
    print("-" * 60)
    result = client.table("events").select("category").gte("start_date", today).execute()
    
    # Count categories
    category_counts = {}
    for event in result.data:
        cat = event.get("category") or "NULL"
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    # Sort by count descending
    sorted_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    for category, count in sorted_cats:
        pct = (count / total_future * 100) if total_future > 0 else 0
        print(f"   {category:20s}: {count:5,} ({pct:5.2f}%)")
    print()
    
    # 8. Events created today
    result = client.table("events").select("id", count="exact").gte("created_at", f"{today}T00:00:00").execute()
    created_today = result.count
    print(f"8. Events created today ({today}): {created_today:,}")
    print()
    
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total future events: {total_future:,}")
    print(f"Missing descriptions: {null_desc:,} ({null_desc_pct:.2f}%)")
    print(f"Missing images: {null_image:,} ({null_image_pct:.2f}%)")
    print(f"Missing times: {null_time:,} ({null_time_pct:.2f}%)")
    print(f"Missing prices (paid events): {null_price:,} ({null_price_pct:.2f}%)")
    print(f"Total venues: {total_venues:,}")
    print(f"Events created today: {created_today:,}")
    print("=" * 80)

if __name__ == "__main__":
    main()
