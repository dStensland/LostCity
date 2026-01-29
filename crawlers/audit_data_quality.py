#!/usr/bin/env python3
"""
Comprehensive Data Quality Audit for Lost City Events
Analyzes time/date quality, source URLs, content quality, stale data, and duplicates.
"""

from datetime import date, datetime
from collections import defaultdict
from supabase import create_client
from config import get_config
import sys

def get_db_client():
    """Initialize Supabase client."""
    cfg = get_config()
    return create_client(cfg.database.supabase_url, cfg.database.supabase_service_key)

def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def print_subsection(title):
    """Print a formatted subsection header."""
    print(f"\n--- {title} ---")

def audit_time_date_quality(client):
    """Audit 1: Time/Date Quality"""
    print_section("1. TIME/DATE QUALITY AUDIT")
    
    # Count events with NULL start_time
    result = client.table("events").select("id", count="exact").is_("start_time", "null").execute()
    null_time_count = result.count
    print(f"\nEvents with NULL start_time (TBA): {null_time_count:,}")
    
    # Count events with NULL start_date
    result = client.table("events").select("id", count="exact").is_("start_date", "null").execute()
    null_date_count = result.count
    print(f"Events with NULL start_date: {null_date_count:,}")
    
    # Count events with start_date in the past
    today = date.today().isoformat()
    result = client.table("events").select("id", count="exact").lt("start_date", today).execute()
    past_events_count = result.count
    print(f"Events with start_date in the past (before {today}): {past_events_count:,}")
    
    # Breakdown by source of events with missing times
    print_subsection("Breakdown by Source: Events with NULL start_time")
    try:
        result = client.rpc("get_missing_time_by_source").execute()
        for row in result.data:
            print(f"  {row.get('source_name', 'Unknown')}: {row.get('count', 0):,}")
    except Exception:
        # RPC doesn't exist, run manual query
        result = client.table("events").select("source_id, sources(name)").is_("start_time", "null").execute()
        source_counts = defaultdict(int)
        for event in result.data:
            source_name = event.get("sources", {}).get("name", "Unknown")
            source_counts[source_name] += 1

        for source, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {source}: {count:,}")

def audit_source_urls(client):
    """Audit 2: Source URLs"""
    print_section("2. SOURCE URL AUDIT")
    
    # Count events missing source_url
    result = client.table("events").select("id", count="exact").is_("source_url", "null").execute()
    missing_source_url = result.count
    print(f"\nEvents missing source_url: {missing_source_url:,}")
    
    # Count events missing ticket_url
    result = client.table("events").select("id", count="exact").is_("ticket_url", "null").execute()
    missing_ticket_url = result.count
    total_events = client.table("events").select("id", count="exact").execute().count
    print(f"Events missing ticket_url: {missing_ticket_url:,} ({100*missing_ticket_url/total_events:.1f}% of all events)")
    
    # Breakdown by source
    print_subsection("Breakdown by Source: Missing URLs")
    result = client.table("events").select("source_id, source_url, ticket_url, sources(name)").execute()
    
    source_stats = defaultdict(lambda: {"missing_source": 0, "missing_ticket": 0, "total": 0})
    for event in result.data:
        source_name = event.get("sources", {}).get("name", "Unknown")
        source_stats[source_name]["total"] += 1
        if not event.get("source_url"):
            source_stats[source_name]["missing_source"] += 1
        if not event.get("ticket_url"):
            source_stats[source_name]["missing_ticket"] += 1
    
    print("\n  Source | Missing source_url | Missing ticket_url | Total Events")
    print("  " + "-" * 75)
    for source, stats in sorted(source_stats.items(), key=lambda x: x[1]["total"], reverse=True):
        print(f"  {source:30} | {stats['missing_source']:7} | {stats['missing_ticket']:7} | {stats['total']:7}")

def audit_content_quality(client):
    """Audit 3: Content Quality"""
    print_section("3. CONTENT QUALITY AUDIT")
    
    # Count events with NULL or empty description
    result = client.table("events").select("id, description", count="exact").execute()
    empty_desc_count = sum(1 for e in result.data if not e.get("description") or e.get("description").strip() == "")
    print(f"\nEvents with NULL or empty description: {empty_desc_count:,}")
    
    # Count events with NULL image_url
    result = client.table("events").select("id", count="exact").is_("image_url", "null").execute()
    null_image_count = result.count
    total_events = client.table("events").select("id", count="exact").execute().count
    print(f"Events with NULL image_url: {null_image_count:,} ({100*null_image_count/total_events:.1f}% of all events)")
    
    # Breakdown by source
    print_subsection("Breakdown by Source: Content Quality Issues")
    result = client.table("events").select("source_id, description, image_url, sources(name)").execute()
    
    source_stats = defaultdict(lambda: {"empty_desc": 0, "no_image": 0, "total": 0})
    for event in result.data:
        source_name = event.get("sources", {}).get("name", "Unknown")
        source_stats[source_name]["total"] += 1
        if not event.get("description") or event.get("description").strip() == "":
            source_stats[source_name]["empty_desc"] += 1
        if not event.get("image_url"):
            source_stats[source_name]["no_image"] += 1
    
    print("\n  Source | Empty Description | No Image | Total Events")
    print("  " + "-" * 70)
    for source, stats in sorted(source_stats.items(), key=lambda x: x[1]["total"], reverse=True):
        print(f"  {source:30} | {stats['empty_desc']:8} | {stats['no_image']:8} | {stats['total']:7}")
    
    # Breakdown by category
    print_subsection("Breakdown by Category: Content Quality Issues")
    result = client.table("events").select("category, description, image_url").execute()
    
    category_stats = defaultdict(lambda: {"empty_desc": 0, "no_image": 0, "total": 0})
    for event in result.data:
        category = event.get("category") or "null"
        category_stats[category]["total"] += 1
        if not event.get("description") or event.get("description").strip() == "":
            category_stats[category]["empty_desc"] += 1
        if not event.get("image_url"):
            category_stats[category]["no_image"] += 1
    
    print("\n  Category | Empty Description | No Image | Total Events")
    print("  " + "-" * 70)
    for category, stats in sorted(category_stats.items(), key=lambda x: x[1]["total"], reverse=True):
        print(f"  {category:30} | {stats['empty_desc']:8} | {stats['no_image']:8} | {stats['total']:7}")

def audit_stale_data(client):
    """Audit 4: Stale Data"""
    print_section("4. STALE DATA AUDIT")
    
    # Count events with start_date before today
    today = date.today().isoformat()
    result = client.table("events").select("id", count="exact").lt("start_date", today).execute()
    past_events = result.count
    total_events = client.table("events").select("id", count="exact").execute().count
    print(f"\nTotal events with start_date before {today}: {past_events:,} ({100*past_events/total_events:.1f}% of all events)")
    
    # Breakdown by source
    print_subsection("Breakdown by Source: Past Events")
    result = client.table("events").select("source_id, start_date, sources(name)").lt("start_date", today).execute()
    
    source_counts = defaultdict(int)
    for event in result.data:
        source_name = event.get("sources", {}).get("name", "Unknown")
        source_counts[source_name] += 1
    
    for source, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
        print(f"  {source}: {count:,}")
    
    # Count events from inactive sources
    print_subsection("Events from Inactive Sources")
    result = client.table("sources").select("id, name, is_active").eq("is_active", False).execute()
    inactive_sources = result.data
    
    if inactive_sources:
        print(f"\nFound {len(inactive_sources)} inactive sources:")
        for source in inactive_sources:
            source_id = source["id"]
            source_name = source["name"]
            
            # Count events from this source
            event_result = client.table("events").select("id", count="exact").eq("source_id", source_id).execute()
            event_count = event_result.count
            
            print(f"  {source_name} (ID: {source_id}): {event_count:,} events")
    else:
        print("\nNo inactive sources found.")
    
    # Identify Meetup events specifically
    print_subsection("Meetup Events")
    result = client.table("sources").select("id").eq("slug", "meetup").execute()
    
    if result.data:
        meetup_source_id = result.data[0]["id"]
        event_result = client.table("events").select("id", count="exact").eq("source_id", meetup_source_id).execute()
        meetup_count = event_result.count
        print(f"\nTotal Meetup events: {meetup_count:,}")
        
        # Past vs future
        past_result = client.table("events").select("id", count="exact").eq("source_id", meetup_source_id).lt("start_date", today).execute()
        past_meetup = past_result.count
        future_meetup = meetup_count - past_meetup
        print(f"  Past Meetup events: {past_meetup:,}")
        print(f"  Future Meetup events: {future_meetup:,}")
    else:
        print("\nNo Meetup source found in sources table.")

def audit_duplicates(client):
    """Audit 5: Duplicates"""
    print_section("5. DUPLICATE DETECTION AUDIT")
    
    # Find events with same content_hash
    print_subsection("Events with Duplicate content_hash")
    result = client.table("events").select("content_hash").not_.is_("content_hash", "null").execute()
    
    hash_counts = defaultdict(int)
    for event in result.data:
        hash_val = event.get("content_hash")
        if hash_val:
            hash_counts[hash_val] += 1
    
    duplicate_hashes = {h: c for h, c in hash_counts.items() if c > 1}
    print(f"\nUnique content_hash values with duplicates: {len(duplicate_hashes)}")
    print(f"Total duplicate events (beyond first): {sum(c - 1 for c in duplicate_hashes.values()):,}")
    
    if duplicate_hashes:
        print("\nTop 10 most duplicated content_hashes:")
        for hash_val, count in sorted(duplicate_hashes.items(), key=lambda x: x[1], reverse=True)[:10]:
            # Get sample event with this hash
            sample = client.table("events").select("id, title, start_date, venue_id").eq("content_hash", hash_val).limit(1).execute()
            if sample.data:
                event = sample.data[0]
                print(f"  Hash: {hash_val[:16]}... ({count} duplicates)")
                print(f"    Sample: {event.get('title', 'N/A')} on {event.get('start_date', 'N/A')}")
    
    # Find potential duplicates by title + venue + date
    print_subsection("Potential Duplicates: Same Title + Venue + Date")
    result = client.table("events").select("title, venue_id, start_date").execute()
    
    combo_counts = defaultdict(int)
    combo_ids = defaultdict(list)
    for event in result.data:
        key = (event.get("title", "").lower().strip(), event.get("venue_id"), event.get("start_date"))
        combo_counts[key] += 1
        combo_ids[key].append(event)
    
    duplicate_combos = {k: v for k, v in combo_counts.items() if v > 1}
    print(f"\nUnique (title, venue, date) combinations with duplicates: {len(duplicate_combos)}")
    print(f"Total duplicate events (beyond first): {sum(c - 1 for c in duplicate_combos.values()):,}")
    
    if duplicate_combos:
        print("\nTop 10 most duplicated (title, venue, date) combinations:")
        for combo, count in sorted(duplicate_combos.items(), key=lambda x: x[1], reverse=True)[:10]:
            title, venue_id, start_date = combo
            print(f"  '{title}' at venue_id={venue_id} on {start_date}: {count} duplicates")

def generate_recommendations(client):
    """Generate actionable recommendations based on audit findings."""
    print_section("RECOMMENDATIONS")
    
    print("""
Based on the data quality audit, here are recommended actions:

1. TIME/DATE QUALITY
   - Review sources with high NULL start_time rates
   - Adjust extraction prompts to capture time information more reliably
   - Consider flagging events without times as "TBA" in the UI

2. SOURCE URLS
   - Investigate sources with missing source_url fields (should be rare)
   - ticket_url is optional but valuable - consider improving extraction

3. CONTENT QUALITY
   - Sources with high empty description rates need prompt tuning
   - Consider requiring minimum description length (50+ chars)
   - Missing images hurt engagement - prioritize image extraction
   - Film and music events especially benefit from poster/artist images

4. STALE DATA
   - Implement automated cleanup job to archive past events
   - Consider moving events older than 30 days to archive table
   - Review inactive sources - deactivate or reactivate as needed
   - Meetup events may need special handling if API is deprecated

5. DUPLICATES
   - Events with same content_hash should be deduplicated
   - Review deduplication logic in crawlers/dedupe.py
   - Consider canonical_event_id linking for known duplicates
   - Same title+venue+date likely indicates duplicate needing merge

Next Steps:
- Run this audit weekly to track improvements
- Create Supabase dashboard with key metrics
- Alert on new sources with >20% quality issues
- Document source-specific quirks in crawler code
""")

def main():
    """Run the full data quality audit."""
    print("\n" + "=" * 80)
    print("  LOST CITY - COMPREHENSIVE DATA QUALITY AUDIT")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)
    
    try:
        client = get_db_client()
        
        # Get total event count for context
        total_result = client.table("events").select("id", count="exact").execute()
        total_events = total_result.count
        print(f"\nTotal Events in Database: {total_events:,}")
        
        # Run all audit sections
        audit_time_date_quality(client)
        audit_source_urls(client)
        audit_content_quality(client)
        audit_stale_data(client)
        audit_duplicates(client)
        generate_recommendations(client)
        
        print("\n" + "=" * 80)
        print("  AUDIT COMPLETE")
        print("=" * 80 + "\n")
        
    except Exception as e:
        print(f"\nERROR: Failed to complete audit: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
