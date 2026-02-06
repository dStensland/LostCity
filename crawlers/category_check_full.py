#!/usr/bin/env python3
"""
Get FULL category distribution with pagination
"""

from db import get_client

def main():
    client = get_client()
    today = '2026-02-04'
    
    print("\n" + "=" * 80)
    print("FULL CATEGORY DISTRIBUTION (All 9,846+ events)")
    print("=" * 80)
    print()
    
    # Fetch ALL events by using a large limit
    # Supabase has default limit of 1000, we need to override
    result = client.table("events").select("id,category").gte("start_date", today).limit(20000).execute()
    
    total = len(result.data)
    print(f"Total future events fetched: {total:,}")
    print()
    
    # Count NULL vs non-NULL
    null_count = sum(1 for e in result.data if e.get("category") is None)
    non_null_count = total - null_count
    
    print(f"Events with NULL category: {null_count:,} ({null_count/total*100:.2f}%)")
    print(f"Events with assigned category: {non_null_count:,} ({non_null_count/total*100:.2f}%)")
    print()
    
    # Get full category breakdown
    category_counts = {}
    for event in result.data:
        cat = event.get("category")
        if cat is None:
            cat = "NULL"
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    print("FULL CATEGORY BREAKDOWN:")
    print("-" * 80)
    sorted_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    for category, count in sorted_cats:
        pct = (count / total * 100) if total > 0 else 0
        print(f"   {category:20s}: {count:6,} ({pct:6.2f}%)")
    
    print("\n" + "=" * 80)
    
    # Check if there are events beyond what we fetched
    count_result = client.table("events").select("id", count="exact").gte("start_date", today).execute()
    actual_total = count_result.count
    
    if actual_total > total:
        print(f"\nWARNING: Only fetched {total:,} of {actual_total:,} events")
        print("Some events may be missing from category breakdown")
    else:
        print(f"\n✓ Successfully fetched all {total:,} events")

if __name__ == "__main__":
    main()
