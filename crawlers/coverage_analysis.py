#!/usr/bin/env python3
"""
Comprehensive coverage gap analysis for LostCity crawlers.
Analyzes geographic coverage, event categories, venue representation, and more.
"""

import sys
from datetime import datetime, timedelta
from collections import defaultdict
from db import get_client

def analyze_coverage():
    """Generate comprehensive coverage gap analysis."""
    client = get_client()
    
    print("=" * 80)
    print("LOSTCITY COVERAGE GAP ANALYSIS")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # 1. Events by City
    print("1. EVENT DISTRIBUTION BY CITY")
    print("-" * 80)

    # Get all events with venue info
    result = client.table('events').select('id, venue_id, venues(city)').execute()
    city_event_counts = defaultdict(int)
    city_venue_counts = defaultdict(set)

    for event in (result.data or []):
        if event.get('venues') and event['venues'].get('city'):
            city = event['venues']['city']
            city_event_counts[city] += 1
            if event.get('venue_id'):
                city_venue_counts[city].add(event['venue_id'])

    total_events = sum(city_event_counts.values())
    cities = sorted(city_event_counts.items(), key=lambda x: x[1], reverse=True)

    print(f"{'City':<30} {'Events':<10} {'% of Total':<12} {'Venues'}")
    print("-" * 80)
    for city, event_count in cities[:20]:  # Top 20
        pct = (event_count / total_events * 100) if total_events > 0 else 0
        venue_count = len(city_venue_counts[city])
        print(f"{city:<30} {event_count:<10} {pct:>6.1f}%       {venue_count}")
    print(f"\nTotal Events: {total_events}")
    print()
    
    # 2. Events by Neighborhood (Atlanta ITP)
    print("2. ATLANTA ITP NEIGHBORHOODS")
    print("-" * 80)
    result = client.table('events').select('venue_id, venues(neighborhood)').execute()
    neighborhood_counts = defaultdict(int)
    for event in result.data or []:
        if event.get('venues') and event['venues'].get('neighborhood'):
            neighborhood_counts[event['venues']['neighborhood']] += 1
    
    sorted_neighborhoods = sorted(neighborhood_counts.items(), key=lambda x: x[1], reverse=True)
    print(f"{'Neighborhood':<30} {'Events'}")
    print("-" * 80)
    for hood, count in sorted_neighborhoods[:30]:
        print(f"{hood:<30} {count}")
    print()
    
    # 3. Sources with low/no recent activity
    print("3. SOURCES WITH LOW RECENT ACTIVITY (Last 30 Days)")
    print("-" * 80)
    thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
    
    # Get all active sources
    sources_result = client.table('sources').select('id, slug, name, is_active').eq('is_active', True).execute()
    sources = {s['id']: s for s in (sources_result.data or [])}
    
    # Get event counts per source in last 30 days
    events_result = client.table('events').select('source_id').gte('created_at', thirty_days_ago).execute()
    source_event_counts = defaultdict(int)
    for event in (events_result.data or []):
        source_event_counts[event['source_id']] += 1
    
    zero_event_sources = []
    low_event_sources = []
    
    for source_id, source_info in sources.items():
        count = source_event_counts.get(source_id, 0)
        if count == 0:
            zero_event_sources.append(source_info)
        elif count < 5:
            low_event_sources.append((source_info, count))
    
    print(f"\nSources with ZERO events in last 30 days: {len(zero_event_sources)}")
    for src in zero_event_sources[:20]:
        print(f"  - {src['slug']}: {src['name']}")
    
    print(f"\nSources with 1-4 events in last 30 days: {len(low_event_sources)}")
    for src, count in sorted(low_event_sources, key=lambda x: x[1])[:20]:
        print(f"  - {src['slug']}: {src['name']} ({count} events)")
    print()
    
    # 4. Category distribution
    print("4. EVENT CATEGORY DISTRIBUTION")
    print("-" * 80)
    result = client.table('events').select('category').execute()
    category_counts = defaultdict(int)
    for event in (result.data or []):
        cat = event.get('category') or 'uncategorized'
        category_counts[cat] += 1
    
    sorted_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    print(f"{'Category':<30} {'Events':<10} {'% of Total'}")
    print("-" * 80)
    for cat, count in sorted_categories:
        pct = (count / total_events * 100) if total_events > 0 else 0
        print(f"{cat:<30} {count:<10} {pct:>6.1f}%")
    print()
    
    # 5. Venues without events
    print("5. VENUES WITHOUT RECENT EVENTS (Last 60 Days)")
    print("-" * 80)
    sixty_days_ago = (datetime.now() - timedelta(days=60)).isoformat()
    
    venues_result = client.table('venues').select('id, name, city, neighborhood').execute()
    all_venues = {v['id']: v for v in (venues_result.data or [])}
    
    events_with_venues = client.table('events').select('venue_id').gte('start_date', sixty_days_ago).execute()
    active_venue_ids = set(e['venue_id'] for e in (events_with_venues.data or []))
    
    inactive_venues = [v for vid, v in all_venues.items() if vid not in active_venue_ids]
    
    print(f"Total venues: {len(all_venues)}")
    print(f"Venues with upcoming/recent events: {len(active_venue_ids)}")
    print(f"Venues without recent events: {len(inactive_venues)}")
    print()
    
    # 6. Crawl error summary
    print("6. RECENT CRAWL ERRORS (Last 7 Days)")
    print("-" * 80)
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    
    errors_result = client.table('crawl_logs').select('source_id, error_message, status, sources(slug, name)').eq('status', 'error').gte('started_at', seven_days_ago).execute()
    
    error_summary = defaultdict(list)
    for log in (errors_result.data or []):
        if log.get('sources'):
            slug = log['sources']['slug']
            error_summary[slug].append(log['error_message'])
    
    print(f"Sources with errors: {len(error_summary)}")
    for slug, errors in sorted(error_summary.items(), key=lambda x: len(x[1]), reverse=True)[:15]:
        print(f"\n  {slug}: {len(errors)} errors")
        unique_errors = list(set(errors))[:3]
        for err in unique_errors:
            err_snippet = err[:100] + "..." if len(err) > 100 else err
            print(f"    - {err_snippet}")
    print()
    
    # 7. Summary Statistics
    print("7. OVERALL STATISTICS")
    print("-" * 80)
    
    total_sources = len(sources)
    active_sources = len([s for s in sources.values() if source_event_counts.get(s['id'], 0) > 0])
    total_venues = len(all_venues)
    
    print(f"Total Active Sources: {total_sources}")
    print(f"Sources with events (last 30d): {active_sources}")
    print(f"Sources inactive (last 30d): {total_sources - active_sources}")
    print(f"Total Venues: {total_venues}")
    print(f"Active Venues (last 60d): {len(active_venue_ids)}")
    print(f"Total Events: {total_events}")
    print(f"Total Cities Covered: {len(cities)}")
    print(f"Atlanta Neighborhoods Covered: {len(neighborhood_counts)}")
    print()

if __name__ == "__main__":
    try:
        analyze_coverage()
    except Exception as e:
        print(f"Error during analysis: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
