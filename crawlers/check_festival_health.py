#!/usr/bin/env python3
"""
Quick festival health check - run anytime to verify data quality.
Usage: python3 check_festival_health.py
"""

from db import get_client
from collections import defaultdict


def check_health():
    """Run all health checks and print pass/fail status."""
    client = get_client()
    
    print("\n" + "=" * 60)
    print("FESTIVAL DATA HEALTH CHECK")
    print("=" * 60)
    
    all_passed = True
    
    # Check 1: No festival series with 8+ venues (calendar absorption)
    print("\n1. Calendar Absorption Check...")
    series_result = client.table("series")\
        .select("id, title, series_type")\
        .in_("series_type", ["festival", "festival_program"])\
        .execute()

    issues = []
    for series in (series_result.data or []):
        events = client.table("events")\
            .select("venue_id")\
            .eq("series_id", series["id"])\
            .execute()
        venue_count = len(set(e["venue_id"] for e in (events.data or []) if e.get("venue_id")))
        if venue_count >= 8:
            issues.append((series["title"], venue_count))

    if issues:
        print(f"   ❌ FAILED - {len(issues)} festival series with 8+ venues:")
        for title, count in issues:
            print(f"      - {title}: {count} venues")
        all_passed = False
    else:
        print("   ✅ PASSED - No calendar absorption detected")
    
    # Check 2: No source creating 10+ festival_program series
    print("\n2. Festival Fragmentation Check...")
    events_result = client.table("events")\
        .select("source_id, series_id")\
        .not_.is_("series_id", "null")\
        .execute()
    
    source_series_map = defaultdict(set)
    for event in (events_result.data or []):
        source_series_map[event["source_id"]].add(event["series_id"])
    
    series_result = client.table("series")\
        .select("id, title, series_type")\
        .eq("series_type", "festival_program")\
        .execute()
    
    festival_program_ids = set(s["id"] for s in (series_result.data or []))
    
    sources_result = client.table("sources")\
        .select("id, slug")\
        .execute()
    sources_map = {s["id"]: s["slug"] for s in (sources_result.data or [])}
    
    fragmented = []
    for source_id, series_ids in source_series_map.items():
        festival_count = len(series_ids & festival_program_ids)
        if festival_count >= 10:
            fragmented.append((sources_map.get(source_id, f"id:{source_id}"), festival_count))
    
    if fragmented:
        print(f"   ❌ FAILED - {len(fragmented)} sources with 10+ festival_program series:")
        for slug, count in sorted(fragmented, key=lambda x: x[1], reverse=True):
            print(f"      - {slug}: {count} series")
        all_passed = False
    else:
        print("   ✅ PASSED - No festival fragmentation detected")
    
    # Check 3: No classes in festivals
    print("\n3. Classes in Festivals Check...")
    class_events = client.table("events")\
        .select("id, series_id")\
        .eq("is_class", True)\
        .not_.is_("series_id", "null")\
        .execute()
    
    class_in_festival = []
    for event in (class_events.data or []):
        series_id = event["series_id"]
        series = client.table("series")\
            .select("title, series_type")\
            .eq("id", series_id)\
            .execute()
        
        if series.data and series.data[0]["series_type"] in ["festival", "festival_program"]:
            class_in_festival.append(series.data[0]["title"])
    
    if class_in_festival:
        print(f"   ❌ FAILED - {len(class_in_festival)} classes linked to festivals:")
        for title in set(class_in_festival)[:5]:
            print(f"      - {title}")
        all_passed = False
    else:
        print("   ✅ PASSED - No classes in festivals")
    
    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL CHECKS PASSED - Festival data is healthy")
    else:
        print("❌ SOME CHECKS FAILED - See details above")
    print("=" * 60 + "\n")
    
    return all_passed


if __name__ == "__main__":
    import sys
    passed = check_health()
    sys.exit(0 if passed else 1)
