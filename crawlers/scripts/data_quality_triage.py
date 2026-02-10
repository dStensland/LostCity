"""
Phase B: Data Quality Triage Script
====================================

Comprehensive analysis of data quality issues across all crawlers.
Produces actionable diagnostic reports for crawler-dev.

Run: python3 scripts/data_quality_triage.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client
from datetime import datetime, timedelta
from collections import defaultdict
import json

def print_section(title):
    """Print a formatted section header."""
    print(f"\n{'='*80}")
    print(f"{title}")
    print(f"{'='*80}\n")

def analyze_source_health(client):
    """Analyze crawler success rates and event production over last 30 days."""
    print_section("CRAWLER SOURCE HEALTH (Last 30 Days)")
    
    thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
    
    # Get all crawl logs
    result = client.table("crawl_logs").select(
        "source_id,status,events_found,events_new,events_updated,started_at,error_message"
    ).gte("started_at", thirty_days_ago).execute()
    
    logs = result.data or []
    
    # Aggregate by source
    source_stats = defaultdict(lambda: {
        "total_runs": 0,
        "success": 0,
        "error": 0,
        "events_found": 0,
        "events_new": 0,
        "events_updated": 0,
        "errors": []
    })
    
    for log in logs:
        sid = log["source_id"]
        source_stats[sid]["total_runs"] += 1
        
        if log["status"] == "success":
            source_stats[sid]["success"] += 1
        elif log["status"] == "error":
            source_stats[sid]["error"] += 1
            if log.get("error_message"):
                source_stats[sid]["errors"].append(log["error_message"])
        
        source_stats[sid]["events_found"] += log.get("events_found") or 0
        source_stats[sid]["events_new"] += log.get("events_new") or 0
        source_stats[sid]["events_updated"] += log.get("events_updated") or 0
    
    # Get source names
    source_ids = list(source_stats.keys())
    source_names = {}
    
    if source_ids:
        for i in range(0, len(source_ids), 100):
            batch = source_ids[i:i+100]
            sr = client.table("sources").select("id,slug,name,is_active").in_("id", batch).execute()
            for s in sr.data:
                source_names[s["id"]] = {
                    "slug": s["slug"],
                    "name": s["name"],
                    "is_active": s.get("is_active", True)
                }
    
    # Calculate health metrics
    health_report = []
    for sid, stats in source_stats.items():
        info = source_names.get(sid, {})
        success_rate = (stats["success"] / stats["total_runs"] * 100) if stats["total_runs"] > 0 else 0
        avg_events = stats["events_found"] / stats["total_runs"] if stats["total_runs"] > 0 else 0
        
        health_report.append({
            "source_id": sid,
            "slug": info.get("slug", f"id:{sid}"),
            "name": info.get("name", "Unknown"),
            "is_active": info.get("is_active", True),
            "total_runs": stats["total_runs"],
            "success_rate": success_rate,
            "avg_events": avg_events,
            "total_events": stats["events_found"],
            "new_events": stats["events_new"],
            "updated_events": stats["events_updated"],
            "errors": stats["errors"][:3]  # Top 3 errors
        })
    
    # Sort by health issues
    health_report.sort(key=lambda x: (x["is_active"], -x["total_runs"], x["success_rate"]))
    
    # Print broken sources (active, multiple runs, low success)
    print("BROKEN SOURCES (Active, >2 runs, <50% success):")
    print(f"{'Source Slug':<40} {'Runs':<6} {'Success':<8} {'Errors':<10}")
    print("-" * 80)
    
    broken = [s for s in health_report if s["is_active"] and s["total_runs"] >= 2 and s["success_rate"] < 50]
    for s in broken[:20]:
        print(f"{s['slug']:<40} {s['total_runs']:<6} {s['success_rate']:>6.1f}%  {len(s['errors']):>3} errors")
    
    print(f"\nTotal broken sources: {len(broken)}")
    
    # Print zero-event sources
    print("\n\nZERO-EVENT SOURCES (Active, >3 runs, 0 events):")
    print(f"{'Source Slug':<40} {'Runs':<6} {'Success':<8} {'Avg Events':<10}")
    print("-" * 80)
    
    zero_event = [s for s in health_report if s["is_active"] and s["total_runs"] >= 3 and s["total_events"] == 0]
    for s in zero_event[:20]:
        print(f"{s['slug']:<40} {s['total_runs']:<6} {s['success_rate']:>6.1f}%  {s['avg_events']:>6.1f}")
    
    print(f"\nTotal zero-event sources: {len(zero_event)}")
    
    # Print low-yield sources
    print("\n\nLOW-YIELD SOURCES (Active, >5 runs, <2 avg events, >0 events):")
    print(f"{'Source Slug':<40} {'Runs':<6} {'Success':<8} {'Avg Events':<10}")
    print("-" * 80)
    
    low_yield = [s for s in health_report if s["is_active"] and s["total_runs"] >= 5 and 0 < s["avg_events"] < 2]
    for s in low_yield[:20]:
        print(f"{s['slug']:<40} {s['total_runs']:<6} {s['success_rate']:>6.1f}%  {s['avg_events']:>6.1f}")
    
    print(f"\nTotal low-yield sources: {len(low_yield)}")
    
    return {
        "broken": broken,
        "zero_event": zero_event,
        "low_yield": low_yield,
        "all_sources": health_report
    }

def analyze_category_distribution(client):
    """Analyze category coverage and NULL categories by source."""
    print_section("CATEGORY DISTRIBUTION & QUALITY")
    
    # Get category distribution
    result = client.table("events").select("category,source_id").execute()
    events = result.data or []
    
    category_counts = defaultdict(int)
    null_by_source = defaultdict(int)
    total_by_source = defaultdict(int)
    
    for event in events:
        cat = event.get("category")
        sid = event.get("source_id")
        
        if cat:
            category_counts[cat] += 1
        else:
            null_by_source[sid] += 1
        
        total_by_source[sid] += 1
    
    print("CATEGORY DISTRIBUTION:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"  {cat:<20} {count:>6} events")
    
    # Sources with high NULL category rates
    print("\n\nSOURCES WITH MISSING CATEGORIES (>10% NULL):")
    
    if null_by_source:
        # Get source names
        source_ids = list(null_by_source.keys())
        source_names = {}
        
        for i in range(0, len(source_ids), 100):
            batch = source_ids[i:i+100]
            sr = client.table("sources").select("id,slug").in_("id", batch).execute()
            for s in sr.data:
                source_names[s["id"]] = s["slug"]
        
        null_sources = []
        for sid, null_count in null_by_source.items():
            total = total_by_source[sid]
            null_rate = (null_count / total * 100) if total > 0 else 0
            if null_rate > 10 and total >= 5:
                null_sources.append({
                    "slug": source_names.get(sid, f"id:{sid}"),
                    "null_count": null_count,
                    "total": total,
                    "null_rate": null_rate
                })
        
        null_sources.sort(key=lambda x: -x["null_rate"])
        
        print(f"{'Source Slug':<40} {'NULL':<8} {'Total':<8} {'NULL %':<8}")
        print("-" * 80)
        
        for s in null_sources[:20]:
            print(f"{s['slug']:<40} {s['null_count']:<8} {s['total']:<8} {s['null_rate']:>6.1f}%")
    
    return {"category_counts": category_counts, "null_sources": null_by_source}

def analyze_missing_fields(client):
    """Find events with missing critical fields."""
    print_section("MISSING CRITICAL FIELDS")
    
    # Sample recent events (last 60 days)
    sixty_days_ago = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
    
    result = client.table("events").select(
        "id,title,start_date,start_time,description,image_url,source_id,category"
    ).gte("start_date", sixty_days_ago).limit(5000).execute()
    
    events = result.data or []
    
    issues = {
        "missing_start_time": [],
        "missing_description": [],
        "missing_image": [],
        "missing_category": []
    }
    
    for event in events:
        if not event.get("start_time") and not event.get("is_all_day"):
            issues["missing_start_time"].append(event["source_id"])
        if not event.get("description"):
            issues["missing_description"].append(event["source_id"])
        if not event.get("image_url"):
            issues["missing_image"].append(event["source_id"])
        if not event.get("category"):
            issues["missing_category"].append(event["source_id"])
    
    print(f"Sample: {len(events)} recent events (last 60 days)")
    print(f"  Missing start_time:   {len(issues['missing_start_time'])} ({len(issues['missing_start_time'])/len(events)*100:.1f}%)")
    print(f"  Missing description:  {len(issues['missing_description'])} ({len(issues['missing_description'])/len(events)*100:.1f}%)")
    print(f"  Missing image:        {len(issues['missing_image'])} ({len(issues['missing_image'])/len(events)*100:.1f}%)")
    print(f"  Missing category:     {len(issues['missing_category'])} ({len(issues['missing_category'])/len(events)*100:.1f}%)")
    
    # Find sources with highest missing field rates
    source_issues = defaultdict(lambda: {"missing_time": 0, "missing_desc": 0, "missing_img": 0, "total": 0})
    
    for event in events:
        sid = event.get("source_id")
        source_issues[sid]["total"] += 1
        if not event.get("start_time"):
            source_issues[sid]["missing_time"] += 1
        if not event.get("description"):
            source_issues[sid]["missing_desc"] += 1
        if not event.get("image_url"):
            source_issues[sid]["missing_img"] += 1
    
    # Get source names
    source_ids = list(source_issues.keys())
    source_names = {}
    
    if source_ids:
        for i in range(0, len(source_ids), 100):
            batch = source_ids[i:i+100]
            sr = client.table("sources").select("id,slug").in_("id", batch).execute()
            for s in sr.data:
                source_names[s["id"]] = s["slug"]
    
    print("\n\nSOURCES WITH HIGHEST MISSING FIELD RATES (>50% missing, >10 events):")
    print(f"{'Source Slug':<40} {'Total':<8} {'Time%':<8} {'Desc%':<8} {'Img%':<8}")
    print("-" * 80)
    
    problematic = []
    for sid, stats in source_issues.items():
        if stats["total"] < 10:
            continue
        time_rate = stats["missing_time"] / stats["total"] * 100
        desc_rate = stats["missing_desc"] / stats["total"] * 100
        img_rate = stats["missing_img"] / stats["total"] * 100
        
        if time_rate > 50 or desc_rate > 50 or img_rate > 50:
            problematic.append({
                "slug": source_names.get(sid, f"id:{sid}"),
                "total": stats["total"],
                "time_rate": time_rate,
                "desc_rate": desc_rate,
                "img_rate": img_rate
            })
    
    problematic.sort(key=lambda x: -(x["time_rate"] + x["desc_rate"] + x["img_rate"]))
    
    for s in problematic[:20]:
        print(f"{s['slug']:<40} {s['total']:<8} {s['time_rate']:>6.1f}% {s['desc_rate']:>6.1f}% {s['img_rate']:>6.1f}%")
    
    return issues

def analyze_venue_completeness(client):
    """Check venue data quality issues."""
    print_section("VENUE DATA COMPLETENESS")
    
    result = client.table("venues").select(
        "id,name,lat,lng,neighborhood,website,venue_type,image_url"
    ).execute()
    
    venues = result.data or []
    
    issues = {
        "missing_coords": 0,
        "missing_neighborhood": 0,
        "missing_website": 0,
        "missing_type": 0,
        "missing_image": 0
    }
    
    for venue in venues:
        if not venue.get("lat") or not venue.get("lng"):
            issues["missing_coords"] += 1
        if not venue.get("neighborhood"):
            issues["missing_neighborhood"] += 1
        if not venue.get("website"):
            issues["missing_website"] += 1
        if not venue.get("venue_type"):
            issues["missing_type"] += 1
        if not venue.get("image_url"):
            issues["missing_image"] += 1
    
    total = len(venues)
    print(f"Total venues: {total}")
    print(f"  Missing coordinates:   {issues['missing_coords']} ({issues['missing_coords']/total*100:.1f}%)")
    print(f"  Missing neighborhood:  {issues['missing_neighborhood']} ({issues['missing_neighborhood']/total*100:.1f}%)")
    print(f"  Missing website:       {issues['missing_website']} ({issues['missing_website']/total*100:.1f}%)")
    print(f"  Missing venue_type:    {issues['missing_type']} ({issues['missing_type']/total*100:.1f}%)")
    print(f"  Missing image:         {issues['missing_image']} ({issues['missing_image']/total*100:.1f}%)")
    
    return issues

def generate_recommendations(source_health, category_data, missing_fields, venue_issues):
    """Generate actionable recommendations based on analysis."""
    print_section("RECOMMENDATIONS & ACTION ITEMS")
    
    print("IMMEDIATE ACTIONS:")
    print()
    
    # 1. Broken crawlers
    broken = source_health["broken"]
    if broken:
        print(f"1. FIX OR DISABLE {len(broken)} BROKEN CRAWLERS")
        print("   These sources have <50% success rate over 30 days:")
        for s in broken[:10]:
            print(f"   - {s['slug']} ({s['success_rate']:.0f}% success, {s['total_runs']} runs)")
        if len(broken) > 10:
            print(f"   ... and {len(broken)-10} more")
        print()
    
    # 2. Zero-event sources
    zero_event = source_health["zero_event"]
    if zero_event:
        print(f"2. INVESTIGATE {len(zero_event)} ZERO-EVENT SOURCES")
        print("   These succeed but find no events. May be:")
        print("   - Seasonal/festival sources (off-season)")
        print("   - Destination venues with no event calendar")
        print("   - Broken extraction logic")
        for s in zero_event[:10]:
            print(f"   - {s['slug']} ({s['total_runs']} runs, 0 events)")
        if len(zero_event) > 10:
            print(f"   ... and {len(zero_event)-10} more")
        print()
    
    # 3. Data quality fixes
    print("3. DATA QUALITY IMPROVEMENTS")
    print(f"   - {venue_issues['missing_coords']} venues need coordinates (run venue_enrich.py)")
    print(f"   - {venue_issues['missing_image']} venues need images (run scrape_venue_images.py)")
    print(f"   - {venue_issues['missing_neighborhood']} venues need neighborhoods")
    print()
    
    print("NEXT STEPS:")
    print("  1. Run: python3 scripts/disable_broken_sources.py --dry-run")
    print("  2. Review output and confirm sources to disable")
    print("  3. Run without --dry-run to disable confirmed broken sources")
    print("  4. Fix extraction logic for high-priority sources")
    print("  5. Run venue enrichment scripts to fill missing data")
    print()

def main():
    """Main triage execution."""
    print(f"\n{'='*80}")
    print("PHASE B: DATA QUALITY TRIAGE")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")
    
    try:
        client = get_client()
        print("✓ Connected to Supabase\n")
    except Exception as e:
        print(f"✗ Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # Run analyses
    source_health = analyze_source_health(client)
    category_data = analyze_category_distribution(client)
    missing_fields = analyze_missing_fields(client)
    venue_issues = analyze_venue_completeness(client)
    
    # Generate recommendations
    generate_recommendations(source_health, category_data, missing_fields, venue_issues)
    
    # Save detailed report
    output_file = f"/Users/coach/Projects/LostCity/crawlers/reports/data_quality_triage_{datetime.now().strftime('%Y-%m-%d')}.md"
    
    with open(output_file, "w") as f:
        f.write("# Data Quality Triage Report\n\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## Executive Summary\n\n")
        f.write(f"- **Broken Sources**: {len(source_health['broken'])} active sources with <50% success rate\n")
        f.write(f"- **Zero-Event Sources**: {len(source_health['zero_event'])} active sources finding no events\n")
        f.write(f"- **Low-Yield Sources**: {len(source_health['low_yield'])} sources averaging <2 events\n")
        f.write(f"- **Venue Issues**: {venue_issues['missing_coords']} missing coords, {venue_issues['missing_image']} missing images\n\n")
        
        f.write("## Broken Sources (Fix or Disable)\n\n")
        f.write("| Source Slug | Runs | Success Rate | Total Events | Errors |\n")
        f.write("|-------------|------|--------------|--------------|--------|\n")
        for s in source_health['broken'][:30]:
            f.write(f"| {s['slug']} | {s['total_runs']} | {s['success_rate']:.1f}% | {s['total_events']} | {len(s['errors'])} |\n")
        
        f.write("\n## Zero-Event Sources\n\n")
        f.write("| Source Slug | Runs | Success Rate | Status |\n")
        f.write("|-------------|------|--------------|--------|\n")
        for s in source_health['zero_event'][:30]:
            f.write(f"| {s['slug']} | {s['total_runs']} | {s['success_rate']:.1f}% | Active |\n")
        
        f.write("\n## Recommended Actions\n\n")
        f.write("### Immediate (This Week)\n")
        f.write("1. Run `python3 scripts/disable_broken_sources.py` to disable permanently broken sources\n")
        f.write("2. Investigate top 10 broken sources for extraction issues\n")
        f.write("3. Review zero-event sources to identify seasonal vs broken\n\n")
        
        f.write("### Short-term (This Month)\n")
        f.write("1. Run venue enrichment scripts for missing coordinates/images\n")
        f.write("2. Fix category inference for sources with high NULL rates\n")
        f.write("3. Improve extraction prompts for sources missing descriptions/times\n\n")
    
    print(f"\n✓ Detailed report saved to: {output_file}\n")

if __name__ == "__main__":
    main()
