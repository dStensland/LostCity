#!/usr/bin/env python3
"""
Weekly Data Quality Check
Run this every Tuesday after daily crawl runs to track improvements
"""

import sys
from datetime import datetime
from db import get_client

def main():
    client = get_client()
    today = datetime.now().strftime('%Y-%m-%d')
    
    print("=" * 80)
    print(f"WEEKLY DATA QUALITY CHECK - {today}")
    print("=" * 80)
    print()
    
    # Core metrics
    result = client.table("events").select("id", count="exact").gte("start_date", today).execute()
    total_future = result.count
    
    result_desc = client.table("events").select("id", count="exact").gte("start_date", today).is_("description", "null").execute()
    null_desc = result_desc.count
    
    result_img = client.table("events").select("id", count="exact").gte("start_date", today).is_("image_url", "null").execute()
    null_img = result_img.count
    
    result_time = client.table("events").select("id", count="exact").gte("start_date", today).is_("start_time", "null").execute()
    null_time = result_time.count
    
    result_price = client.table("events").select("id", count="exact").gte("start_date", today).is_("price_min", "null").eq("is_free", False).execute()
    null_price = result_price.count
    
    result_cat = client.table("events").select("id", count="exact").gte("start_date", today).is_("category", "null").execute()
    null_cat = result_cat.count
    
    # Calculate percentages
    desc_pct = (total_future - null_desc) / total_future * 100 if total_future > 0 else 0
    img_pct = (total_future - null_img) / total_future * 100 if total_future > 0 else 0
    time_pct = (total_future - null_time) / total_future * 100 if total_future > 0 else 0
    
    # For price, calculate percentage of paid events with pricing
    result_paid = client.table("events").select("id", count="exact").gte("start_date", today).eq("is_free", False).execute()
    total_paid = result_paid.count
    price_pct = (total_paid - null_price) / total_paid * 100 if total_paid > 0 else 0
    
    cat_pct = (total_future - null_cat) / total_future * 100 if total_future > 0 else 0
    
    # Display results
    print("OVERALL METRICS")
    print("-" * 80)
    print(f"Total future events: {total_future:,}")
    print()
    
    print("QUALITY SCORES")
    print("-" * 80)
    
    def status_icon(pct, target):
        if pct >= target:
            return "✓"
        elif pct >= target - 10:
            return "~"
        else:
            return "✗"
    
    print(f"Category Coverage:    {cat_pct:6.2f}%  {status_icon(cat_pct, 95)}  (target: >95%)")
    print(f"Description Coverage: {desc_pct:6.2f}%  {status_icon(desc_pct, 90)}  (target: >90%)")
    print(f"Image Coverage:       {img_pct:6.2f}%  {status_icon(img_pct, 80)}  (target: >80%)")
    print(f"Time Coverage:        {time_pct:6.2f}%  {status_icon(time_pct, 85)}  (target: >85%)")
    print(f"Price Coverage:       {price_pct:6.2f}%  {status_icon(price_pct, 75)}  (target: >75%)")
    print()
    
    # Count passing metrics
    targets = [
        (cat_pct, 95),
        (desc_pct, 90),
        (img_pct, 80),
        (time_pct, 85),
        (price_pct, 75)
    ]
    passing = sum(1 for pct, target in targets if pct >= target)
    
    print(f"PRODUCTION READINESS: {passing}/5 metrics passing")
    print()
    
    # Top 5 worst offenders across all quality issues
    print("TOP 5 SOURCES NEEDING ATTENTION")
    print("-" * 80)
    
    # Aggregate quality score per source
    result = client.table("events").select(
        "source_id,description,image_url,start_time,price_min,is_free,sources!inner(name,slug)"
    ).gte("start_date", today).execute()
    
    source_issues = {}
    for event in result.data[:5000]:  # Sample first 5000 for performance
        src = event.get("sources")
        if not src:
            continue
        
        slug = src.get("slug", "unknown")
        name = src.get("name", "Unknown")
        
        if slug not in source_issues:
            source_issues[slug] = {"name": name, "total": 0, "issues": 0}
        
        source_issues[slug]["total"] += 1
        
        # Count issues
        if event.get("description") is None:
            source_issues[slug]["issues"] += 1
        if event.get("image_url") is None:
            source_issues[slug]["issues"] += 1
        if event.get("start_time") is None:
            source_issues[slug]["issues"] += 1
        if event.get("price_min") is None and event.get("is_free") == False:
            source_issues[slug]["issues"] += 1
    
    # Calculate issue rate and sort
    for slug, data in source_issues.items():
        data["issue_rate"] = data["issues"] / (data["total"] * 4) * 100 if data["total"] > 0 else 0
    
    # Filter to sources with at least 10 events and sort by issue rate
    significant_sources = {k: v for k, v in source_issues.items() if v["total"] >= 10}
    sorted_sources = sorted(significant_sources.items(), key=lambda x: x[1]["issue_rate"], reverse=True)[:5]
    
    for slug, data in sorted_sources:
        print(f"{data['name']:40s} - {data['issue_rate']:.1f}% issue rate ({data['issues']} issues in {data['total']} events)")
    
    print()
    print("=" * 80)
    print("Legend: ✓ = passing, ~ = close, ✗ = needs work")
    print("Run with --verbose for source-level breakdown")
    print("=" * 80)

if __name__ == "__main__":
    main()
