#!/usr/bin/env python3
"""
Deep dive into data quality issues - which sources are responsible?
"""

from db import get_client

def main():
    client = get_client()
    today = '2026-02-04'
    
    print("\n" + "=" * 80)
    print("DATA QUALITY DEEP DIVE - SOURCE ANALYSIS")
    print("=" * 80)
    print()
    
    # Which sources are producing events with NULL descriptions?
    print("TOP 10 SOURCES: Events with NULL description")
    print("-" * 80)
    result = client.table("events").select(
        "source_id,sources!inner(name,slug)"
    ).gte("start_date", today).is_("description", "null").execute()
    
    source_desc_issues = {}
    for event in result.data:
        src = event.get("sources")
        if src:
            slug = src.get("slug", "unknown")
            name = src.get("name", "Unknown")
            source_desc_issues[slug] = source_desc_issues.get(slug, {"name": name, "count": 0})
            source_desc_issues[slug]["count"] += 1
    
    sorted_sources = sorted(source_desc_issues.items(), key=lambda x: x[1]["count"], reverse=True)[:10]
    for slug, data in sorted_sources:
        print(f"   {data['name']:40s} ({slug:30s}): {data['count']:4,} events")
    print()
    
    # Which sources are producing events with NULL image_url?
    print("TOP 10 SOURCES: Events with NULL image_url")
    print("-" * 80)
    result = client.table("events").select(
        "source_id,sources!inner(name,slug)"
    ).gte("start_date", today).is_("image_url", "null").execute()
    
    source_image_issues = {}
    for event in result.data:
        src = event.get("sources")
        if src:
            slug = src.get("slug", "unknown")
            name = src.get("name", "Unknown")
            source_image_issues[slug] = source_image_issues.get(slug, {"name": name, "count": 0})
            source_image_issues[slug]["count"] += 1
    
    sorted_sources = sorted(source_image_issues.items(), key=lambda x: x[1]["count"], reverse=True)[:10]
    for slug, data in sorted_sources:
        print(f"   {data['name']:40s} ({slug:30s}): {data['count']:4,} events")
    print()
    
    # Which sources are producing events with NULL start_time?
    print("TOP 10 SOURCES: Events with NULL start_time")
    print("-" * 80)
    result = client.table("events").select(
        "source_id,sources!inner(name,slug)"
    ).gte("start_date", today).is_("start_time", "null").execute()
    
    source_time_issues = {}
    for event in result.data:
        src = event.get("sources")
        if src:
            slug = src.get("slug", "unknown")
            name = src.get("name", "Unknown")
            source_time_issues[slug] = source_time_issues.get(slug, {"name": name, "count": 0})
            source_time_issues[slug]["count"] += 1
    
    sorted_sources = sorted(source_time_issues.items(), key=lambda x: x[1]["count"], reverse=True)[:10]
    for slug, data in sorted_sources:
        print(f"   {data['name']:40s} ({slug:30s}): {data['count']:4,} events")
    print()
    
    # Which sources have missing prices on paid events?
    print("TOP 10 SOURCES: Events with NULL price_min (is_free=false)")
    print("-" * 80)
    result = client.table("events").select(
        "source_id,sources!inner(name,slug)"
    ).gte("start_date", today).is_("price_min", "null").eq("is_free", False).execute()
    
    source_price_issues = {}
    for event in result.data:
        src = event.get("sources")
        if src:
            slug = src.get("slug", "unknown")
            name = src.get("name", "Unknown")
            source_price_issues[slug] = source_price_issues.get(slug, {"name": name, "count": 0})
            source_price_issues[slug]["count"] += 1
    
    sorted_sources = sorted(source_price_issues.items(), key=lambda x: x[1]["count"], reverse=True)[:10]
    for slug, data in sorted_sources:
        print(f"   {data['name']:40s} ({slug:30s}): {data['count']:4,} events")
    print()
    
    # Check for events with no category (NULL)
    print("Events with NULL category")
    print("-" * 80)
    result = client.table("events").select("id", count="exact").gte("start_date", today).is_("category", "null").execute()
    null_category_count = result.count
    print(f"   Total: {null_category_count:,} events")
    
    if null_category_count > 0:
        print("\n   Top sources with NULL category:")
        result = client.table("events").select(
            "source_id,sources!inner(name,slug)"
        ).gte("start_date", today).is_("category", "null").execute()
        
        source_cat_issues = {}
        for event in result.data:
            src = event.get("sources")
            if src:
                slug = src.get("slug", "unknown")
                name = src.get("name", "Unknown")
                source_cat_issues[slug] = source_cat_issues.get(slug, {"name": name, "count": 0})
                source_cat_issues[slug]["count"] += 1
        
        sorted_sources = sorted(source_cat_issues.items(), key=lambda x: x[1]["count"], reverse=True)[:5]
        for slug, data in sorted_sources:
            print(f"      {data['name']:35s} ({slug:25s}): {data['count']:4,} events")
    print()
    
    print("=" * 80)

if __name__ == "__main__":
    main()
