"""
Analyze Eventbrite crawl results to identify candidates for dedicated crawlers.
"""

import os
from datetime import datetime, timedelta
from supabase import create_client
from collections import defaultdict
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env file")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

TODAY = "2026-02-16"

def analyze_category_breakdown():
    """Query 1: Events by category for today's crawl"""
    print("\n" + "="*80)
    print("QUERY 1: EVENTS BY CATEGORY (Today's Crawl)")
    print("="*80)
    
    result = supabase.table("events").select("category").eq("source_id", 1).gte("created_at", TODAY).execute()
    
    categories = defaultdict(int)
    for event in result.data:
        cat = event.get("category") or "uncategorized"
        categories[cat] += 1
    
    # Sort by count
    sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)
    
    print(f"\nTotal events from today's crawl: {len(result.data)}")
    print("\nBreakdown by category:")
    for cat, count in sorted_cats:
        print(f"  {cat:30s} {count:4d}")
    
    return categories

def analyze_top_venues():
    """Query 2: Top venues/organizers by event count"""
    print("\n" + "="*80)
    print("QUERY 2: TOP VENUES/ORGANIZERS (Today's Crawl)")
    print("="*80)
    
    # Get events with venue info
    result = supabase.table("events")\
        .select("venue_id, venues(name, website, venue_type)")\
        .eq("source_id", 1)\
        .gte("created_at", TODAY)\
        .execute()
    
    venue_counts = defaultdict(lambda: {"count": 0, "venue": None})
    for event in result.data:
        venue_id = event.get("venue_id")
        if venue_id and event.get("venues"):
            venue_counts[venue_id]["count"] += 1
            venue_counts[venue_id]["venue"] = event["venues"]
    
    # Sort by count
    sorted_venues = sorted(venue_counts.items(), key=lambda x: x[1]["count"], reverse=True)[:30]
    
    print(f"\nTop 30 venues by event count (today's crawl):")
    print(f"{'Venue Name':50s} {'Events':>8s} {'Website':>10s} {'Type':>20s}")
    print("-" * 90)
    for venue_id, data in sorted_venues:
        venue = data["venue"]
        has_website = "Yes" if venue.get("website") else "No"
        venue_type = venue.get("venue_type") or "unknown"
        print(f"{venue['name'][:48]:50s} {data['count']:8d} {has_website:>10s} {venue_type:>20s}")
    
    return sorted_venues

def analyze_new_category_events():
    """Query 3: Sample events from new high-value categories"""
    print("\n" + "="*80)
    print("QUERY 3: SAMPLE EVENTS FROM HIGH-VALUE CATEGORIES")
    print("="*80)
    
    target_categories = ["health", "fitness", "community", "charity", "wellness"]
    
    for category in target_categories:
        result = supabase.table("events")\
            .select("title, category, venues(name)")\
            .eq("source_id", 1)\
            .eq("category", category)\
            .gte("created_at", TODAY)\
            .limit(10)\
            .execute()
        
        if result.data:
            print(f"\n{category.upper()} ({len(result.data)} events today):")
            for event in result.data:
                venue_name = event.get("venues", {}).get("name", "Unknown") if event.get("venues") else "Unknown"
                print(f"  - {event['title'][:70]} @ {venue_name}")

def analyze_new_venues():
    """Query 4: Venues created today"""
    print("\n" + "="*80)
    print("QUERY 4: NEW VENUES CREATED TODAY")
    print("="*80)
    
    result = supabase.table("venues")\
        .select("name, address, city, venue_type, website")\
        .gte("created_at", TODAY)\
        .execute()
    
    print(f"\nTotal new venues: {len(result.data)}")
    print(f"\n{'Venue Name':50s} {'City':15s} {'Type':20s} {'Website':>10s}")
    print("-" * 100)
    for venue in result.data[:50]:  # Show first 50
        has_website = "Yes" if venue.get("website") else "No"
        city = venue.get("city") or "Unknown"
        venue_type = venue.get("venue_type") or "unknown"
        print(f"{venue['name'][:48]:50s} {city[:13]:15s} {venue_type:20s} {has_website:>10s}")

def analyze_venues_with_websites():
    """Query 5: Eventbrite venues with websites (best crawler candidates)"""
    print("\n" + "="*80)
    print("QUERY 5: EVENTBRITE VENUES WITH WEBSITES")
    print("="*80)
    
    # Get distinct venues from Eventbrite events that have websites
    result = supabase.table("events")\
        .select("venue_id, venues(name, website, venue_type)")\
        .eq("source_id", 1)\
        .execute()
    
    venues_with_websites = {}
    event_counts = defaultdict(int)
    
    for event in result.data:
        venue_id = event.get("venue_id")
        if venue_id and event.get("venues"):
            venue = event["venues"]
            if venue.get("website"):
                venues_with_websites[venue_id] = venue
                event_counts[venue_id] += 1
    
    # Sort by event count
    sorted_venues = sorted(
        [(vid, venues_with_websites[vid], event_counts[vid]) for vid in venues_with_websites],
        key=lambda x: x[2],
        reverse=True
    )
    
    print(f"\nVenues with websites posting to Eventbrite: {len(sorted_venues)}")
    print(f"\n{'Venue Name':50s} {'Events':>8s} {'Type':20s} {'Website':50s}")
    print("-" * 130)
    for venue_id, venue, count in sorted_venues[:50]:  # Top 50
        venue_type = venue.get("venue_type") or "unknown"
        website = venue.get("website", "")[:48]
        print(f"{venue['name'][:48]:50s} {count:8d} {venue_type:20s} {website:50s}")
    
    return sorted_venues

def analyze_repeat_organizers():
    """Query 6: Most prolific Eventbrite users (all time)"""
    print("\n" + "="*80)
    print("QUERY 6: MOST PROLIFIC EVENTBRITE ORGANIZERS (ALL TIME)")
    print("="*80)
    
    # Get all Eventbrite events
    result = supabase.table("events")\
        .select("venue_id, venues(name, website, venue_type)")\
        .eq("source_id", 1)\
        .execute()
    
    venue_counts = defaultdict(lambda: {"count": 0, "venue": None})
    for event in result.data:
        venue_id = event.get("venue_id")
        if venue_id and event.get("venues"):
            venue_counts[venue_id]["count"] += 1
            venue_counts[venue_id]["venue"] = event["venues"]
    
    # Filter to venues with 5+ events
    prolific = [(vid, data) for vid, data in venue_counts.items() if data["count"] >= 5]
    prolific.sort(key=lambda x: x[1]["count"], reverse=True)
    
    print(f"\nVenues with 5+ Eventbrite events (all time): {len(prolific)}")
    print(f"\n{'Venue Name':50s} {'Events':>8s} {'Website':>10s} {'Type':20s}")
    print("-" * 90)
    for venue_id, data in prolific[:50]:  # Top 50
        venue = data["venue"]
        has_website = "Yes" if venue.get("website") else "No"
        venue_type = venue.get("venue_type") or "unknown"
        print(f"{venue['name'][:48]:50s} {data['count']:8d} {has_website:>10s} {venue_type:>20s}")
    
    return prolific

def check_existing_crawlers():
    """Check which venues already have dedicated crawlers"""
    print("\n" + "="*80)
    print("EXISTING CRAWLER CHECK")
    print("="*80)
    
    # Get all sources
    result = supabase.table("sources").select("name, slug, is_active").execute()
    
    print(f"\nTotal sources in database: {len(result.data)}")
    active_sources = [s for s in result.data if s.get("is_active")]
    print(f"Active sources: {len(active_sources)}")
    
    return {s["slug"]: s for s in result.data}

def main():
    print("\n" + "="*80)
    print("EVENTBRITE CRAWL ANALYSIS")
    print(f"Analyzing events from source_id=1 created on {TODAY}")
    print("="*80)
    
    # Run all analyses
    categories = analyze_category_breakdown()
    top_venues_today = analyze_top_venues()
    analyze_new_category_events()
    analyze_new_venues()
    venues_with_websites = analyze_venues_with_websites()
    prolific_organizers = analyze_repeat_organizers()
    existing_crawlers = check_existing_crawlers()
    
    # Generate recommendations
    print("\n" + "="*80)
    print("RECOMMENDATIONS: TOP CANDIDATES FOR DEDICATED CRAWLERS")
    print("="*80)
    
    # Combine data: prolific organizers with websites
    recommendations = []
    for venue_id, venue, count in venues_with_websites[:30]:
        # Check if already has crawler
        venue_slug = venue["name"].lower().replace(" ", "-").replace("'", "")
        has_crawler = venue_slug in existing_crawlers
        
        recommendations.append({
            "venue": venue["name"],
            "website": venue.get("website"),
            "events": count,
            "type": venue.get("venue_type"),
            "has_crawler": has_crawler,
            "priority": "HIGH" if count >= 10 and not has_crawler else "MEDIUM" if count >= 5 else "LOW"
        })
    
    # Sort by priority and event count
    recommendations.sort(key=lambda x: (x["priority"] == "HIGH", x["events"]), reverse=True)
    
    print("\nTOP 20 CRAWLER CANDIDATES:")
    print(f"\n{'Priority':10s} {'Venue Name':45s} {'Events':>8s} {'Has Crawler':>12s} {'Type':20s}")
    print("-" * 100)
    for rec in recommendations[:20]:
        crawler_status = "YES" if rec["has_crawler"] else "NO"
        print(f"{rec['priority']:10s} {rec['venue'][:43]:45s} {rec['events']:8d} {crawler_status:>12s} {rec['type'] or 'unknown':20s}")
    
    print("\n" + "="*80)
    print("CATEGORY INSIGHTS")
    print("="*80)
    
    high_value_cats = ["health", "fitness", "community", "charity", "wellness", "education"]
    print(f"\nHigh-value categories for portal strategy:")
    for cat in high_value_cats:
        count = categories.get(cat, 0)
        print(f"  {cat:20s} {count:4d} events")
    
    print("\n" + "="*80)
    print("ANALYSIS COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
