#!/usr/bin/env python3
"""
Get FULL category distribution with manual pagination
"""

from db import get_client

def main():
    client = get_client()
    today = '2026-02-04'
    
    print("\n" + "=" * 80)
    print("FULL CATEGORY DISTRIBUTION (Paginated)")
    print("=" * 80)
    print()
    
    # Get total count first
    count_result = client.table("events").select("id", count="exact").gte("start_date", today).execute()
    total_count = count_result.count
    print(f"Total future events: {total_count:,}")
    print("Fetching in batches of 1000...")
    print()
    
    # Fetch in batches
    all_events = []
    batch_size = 1000
    offset = 0
    
    while offset < total_count:
        print(f"  Fetching batch {offset//batch_size + 1} (offset {offset})...")
        result = client.table("events").select("id,category").gte("start_date", today).range(offset, offset + batch_size - 1).execute()
        
        if not result.data:
            break
            
        all_events.extend(result.data)
        offset += batch_size
    
    print(f"\nFetched {len(all_events):,} events total")
    print()
    
    # Count NULL vs non-NULL
    null_count = sum(1 for e in all_events if e.get("category") is None)
    non_null_count = len(all_events) - null_count
    
    print(f"Events with NULL category: {null_count:,} ({null_count/len(all_events)*100:.2f}%)")
    print(f"Events with assigned category: {non_null_count:,} ({non_null_count/len(all_events)*100:.2f}%)")
    print()
    
    # Get full category breakdown
    category_counts = {}
    for event in all_events:
        cat = event.get("category")
        if cat is None:
            cat = "NULL"
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    print("COMPLETE CATEGORY BREAKDOWN:")
    print("-" * 80)
    sorted_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    for category, count in sorted_cats:
        pct = (count / len(all_events) * 100) if len(all_events) > 0 else 0
        print(f"   {category:20s}: {count:6,} ({pct:6.2f}%)")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()
