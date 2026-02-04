#!/usr/bin/env python3
"""
Data Quality Diagnostic: All-Day Events and Missing Start Times
Analyzes extraction failures for event timing information
"""

from db import get_client
from collections import defaultdict
import re

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def analyze_all_day_events():
    """Analyze events marked as all-day by source"""
    client = get_client()
    
    print_section("1. ALL-DAY EVENTS BY SOURCE")
    
    # Count all-day events by source with examples
    result = client.table("events").select(
        "id, title, start_date, category, source:sources(slug, name)"
    ).eq("is_all_day", True).gte("start_date", "2026-02-01").order("source_id").limit(1000).execute()
    
    if not result.data:
        print("No all-day events found")
        return
    
    # Group by source
    by_source = defaultdict(list)
    for event in result.data:
        source_slug = event['source']['slug'] if event['source'] else 'unknown'
        by_source[source_slug].append(event)
    
    # Sort by count descending
    sorted_sources = sorted(by_source.items(), key=lambda x: len(x[1]), reverse=True)
    
    print(f"Total all-day events: {len(result.data)}")
    print(f"Sources producing all-day events: {len(by_source)}\n")
    
    for source_slug, events in sorted_sources[:15]:
        print(f"{source_slug:40s} {len(events):4d} events")
        # Show 3 example titles
        for event in events[:3]:
            title = event['title'][:60]
            category = event.get('category', 'none')
            print(f"  - [{category:10s}] {title}")
    
    return sorted_sources

def analyze_null_start_time():
    """Analyze events with null start_time by source"""
    client = get_client()
    
    print_section("2. EVENTS WITH NULL START_TIME BY SOURCE")
    
    result = client.table("events").select(
        "id, title, start_date, start_time, category, source:sources(slug, name)"
    ).is_("start_time", "null").gte("start_date", "2026-02-01").order("source_id").limit(1000).execute()
    
    if not result.data:
        print("No events with null start_time found")
        return
    
    by_source = defaultdict(list)
    for event in result.data:
        source_slug = event['source']['slug'] if event['source'] else 'unknown'
        by_source[source_slug].append(event)
    
    sorted_sources = sorted(by_source.items(), key=lambda x: len(x[1]), reverse=True)
    
    print(f"Total events with null start_time: {len(result.data)}")
    print(f"Sources producing null times: {len(by_source)}\n")
    
    for source_slug, events in sorted_sources[:15]:
        print(f"{source_slug:40s} {len(events):4d} events")
        for event in events[:3]:
            title = event['title'][:60]
            category = event.get('category', 'none')
            print(f"  - [{category:10s}] {title}")
    
    return sorted_sources

def analyze_tba_titles():
    """Check for TBA/To Be Announced in titles or descriptions"""
    client = get_client()
    
    print_section("3. EVENTS WITH 'TBA' OR 'TO BE ANNOUNCED'")
    
    # Search for TBA patterns
    tba_patterns = ['TBA', 'T.B.A', 'To Be Announced', 'To be announced', 'TBD', 'T.B.D']
    
    all_tba_events = []
    for pattern in tba_patterns:
        result = client.table("events").select(
            "id, title, description, start_date, category, source:sources(slug)"
        ).ilike("title", f"%{pattern}%").gte("start_date", "2026-02-01").limit(500).execute()
        
        if result.data:
            all_tba_events.extend(result.data)
    
    # Dedupe by ID
    seen_ids = set()
    unique_tba = []
    for event in all_tba_events:
        if event['id'] not in seen_ids:
            seen_ids.add(event['id'])
            unique_tba.append(event)
    
    by_source = defaultdict(list)
    for event in unique_tba:
        source_slug = event['source']['slug'] if event['source'] else 'unknown'
        by_source[source_slug].append(event)
    
    print(f"Total events with TBA/To Be Announced: {len(unique_tba)}\n")
    
    sorted_sources = sorted(by_source.items(), key=lambda x: len(x[1]), reverse=True)
    for source_slug, events in sorted_sources[:10]:
        print(f"{source_slug:40s} {len(events):4d} events")
        for event in events[:2]:
            title = event['title'][:70]
            print(f"  - {title}")

def analyze_suspicious_titles():
    """Check for very short titles or generic titles"""
    client = get_client()
    
    print_section("4. SUSPICIOUS TITLES")
    
    # Get all recent events
    result = client.table("events").select(
        "id, title, category, source:sources(slug)"
    ).gte("start_date", "2026-02-01").limit(2000).execute()
    
    if not result.data:
        print("No events found")
        return
    
    short_titles = []
    generic_titles = []
    
    generic_patterns = [
        r'^event$', r'^show$', r'^performance$', r'^concert$', r'^game$',
        r'^live music$', r'^open mic$', r'^trivia$', r'^comedy show$',
        r'^movie$', r'^film$', r'^exhibit$', r'^exhibition$'
    ]
    
    for event in result.data:
        title = event['title'].strip()
        
        # Very short titles
        if len(title) < 5:
            short_titles.append(event)
        
        # Generic titles
        for pattern in generic_patterns:
            if re.match(pattern, title, re.IGNORECASE):
                generic_titles.append(event)
                break
    
    print(f"Very short titles (< 5 chars): {len(short_titles)}")
    for event in short_titles[:10]:
        source = event['source']['slug'] if event['source'] else 'unknown'
        print(f"  [{source:25s}] \"{event['title']}\"")
    
    print(f"\nGeneric titles: {len(generic_titles)}")
    by_source = defaultdict(list)
    for event in generic_titles:
        source_slug = event['source']['slug'] if event['source'] else 'unknown'
        by_source[source_slug].append(event)
    
    sorted_sources = sorted(by_source.items(), key=lambda x: len(x[1]), reverse=True)
    for source_slug, events in sorted_sources[:8]:
        print(f"  {source_slug:30s} {len(events):3d} generic titles")

def spot_check_top_sources(top_sources):
    """Show detailed examples from top all-day event sources"""
    client = get_client()
    
    print_section("5. SPOT-CHECK: TOP ALL-DAY EVENT SOURCES")
    
    for source_slug, events in top_sources[:5]:
        print(f"\n--- {source_slug} ({len(events)} all-day events) ---\n")
        
        # Show 10 examples with categories
        for i, event in enumerate(events[:10], 1):
            title = event['title'][:65]
            category = event.get('category', 'none')
            date = event.get('start_date', 'unknown')
            print(f"{i:2d}. [{category:10s}] {title:65s} | {date}")

def check_film_events():
    """Check if film events are coming in as all-day (they shouldn't be)"""
    client = get_client()
    
    print_section("6. FILM EVENTS ANALYSIS")
    
    # All film events
    all_films = client.table("events").select(
        "id, title, start_time, is_all_day, source:sources(slug)"
    ).eq("category", "film").gte("start_date", "2026-02-01").limit(1000).execute()
    
    if not all_films.data:
        print("No film events found")
        return
    
    all_day_films = [e for e in all_films.data if e.get('is_all_day')]
    null_time_films = [e for e in all_films.data if not e.get('start_time')]
    
    print(f"Total film events: {len(all_films.data)}")
    print(f"Film events marked all-day: {len(all_day_films)}")
    print(f"Film events with null start_time: {len(null_time_films)}")
    
    if all_day_films:
        print("\nAll-day film events by source:")
        by_source = defaultdict(list)
        for event in all_day_films:
            source_slug = event['source']['slug'] if event['source'] else 'unknown'
            by_source[source_slug].append(event)
        
        for source_slug, events in sorted(by_source.items(), key=lambda x: len(x[1]), reverse=True):
            print(f"  {source_slug:30s} {len(events):3d} all-day films")
            for event in events[:2]:
                print(f"    - {event['title'][:60]}")

def generate_summary():
    """Generate overall summary statistics"""
    client = get_client()
    
    print_section("7. SUMMARY & RECOMMENDATIONS")
    
    # Total events
    total = client.table("events").select("id", count="exact").gte("start_date", "2026-02-01").execute()
    total_count = total.count
    
    # All-day events
    all_day = client.table("events").select("id", count="exact").eq("is_all_day", True).gte("start_date", "2026-02-01").execute()
    all_day_count = all_day.count
    
    # Null start_time
    null_time = client.table("events").select("id", count="exact").is_("start_time", "null").gte("start_date", "2026-02-01").execute()
    null_time_count = null_time.count
    
    # Events with proper times
    with_times = total_count - null_time_count
    
    all_day_pct = (all_day_count / total_count * 100) if total_count > 0 else 0
    null_time_pct = (null_time_count / total_count * 100) if total_count > 0 else 0
    
    print(f"Total upcoming events (Feb 1+): {total_count:,}")
    print(f"Events with specific times:     {with_times:,} ({100-null_time_pct:.1f}%)")
    print(f"Events marked all-day:          {all_day_count:,} ({all_day_pct:.1f}%)")
    print(f"Events with null start_time:    {null_time_count:,} ({null_time_pct:.1f}%)")
    
    print("\n--- PATTERNS OBSERVED ---")
    print("1. Many bar/nightlife crawlers produce all-day events (Playwright extraction likely missing times)")
    print("2. Some sources consistently have null start_time (API response may not include time)")
    print("3. Film events should NEVER be all-day - cinema crawlers may need fixing")
    print("4. TBA titles suggest incomplete event data from source")
    
    print("\n--- RECOMMENDED FIXES ---")
    print("1. Review Playwright-based bar crawlers - check if event time is in HTML but not extracted")
    print("2. Add time parsing fallbacks for common patterns (e.g., '9pm', '9:00 PM', '21:00')")
    print("3. For cinema crawlers, ensure showtime extraction is working correctly")
    print("4. Consider marking sources with >50% all-day events for manual review")
    print("5. Add validation: reject film events without specific times")
    print("6. Check if LLM extraction prompt explicitly asks for event times")

def main():
    print("\n" + "="*80)
    print("  DATA QUALITY DIAGNOSTIC: ALL-DAY EVENTS & TIME EXTRACTION")
    print("="*80)
    
    # Run all analyses
    top_all_day = analyze_all_day_events()
    analyze_null_start_time()
    analyze_tba_titles()
    analyze_suspicious_titles()
    
    if top_all_day:
        spot_check_top_sources(top_all_day)
    
    check_film_events()
    generate_summary()
    
    print("\n" + "="*80)
    print("  DIAGNOSTIC COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
