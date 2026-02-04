#!/usr/bin/env python3
"""
Deep dive into specific sources with high all-day event rates
"""

from db import get_client
from collections import defaultdict

def analyze_source_details(source_slug):
    """Get detailed info about a specific source's events"""
    client = get_client()
    
    # Get source info
    source_result = client.table("sources").select("*").eq("slug", source_slug).execute()
    if not source_result.data:
        print(f"Source not found: {source_slug}")
        return
    
    source = source_result.data[0]
    
    print(f"\n{'='*80}")
    print(f"Source: {source['name']} ({source_slug})")
    print(f"URL: {source.get('url', 'N/A')}")
    print(f"Active: {source['is_active']}")
    print(f"{'='*80}\n")
    
    # Get all recent events from this source
    events = client.table("events").select(
        "id, title, start_date, start_time, end_time, is_all_day, category, raw_text"
    ).eq("source_id", source['id']).gte("start_date", "2026-02-01").limit(50).execute()
    
    if not events.data:
        print("No recent events")
        return
    
    all_day_count = sum(1 for e in events.data if e.get('is_all_day'))
    null_time_count = sum(1 for e in events.data if not e.get('start_time'))
    
    print(f"Total events (Feb 1+): {len(events.data)}")
    print(f"All-day events: {all_day_count} ({all_day_count/len(events.data)*100:.1f}%)")
    print(f"Null start_time: {null_time_count} ({null_time_count/len(events.data)*100:.1f}%)")
    
    print("\n--- Sample Events (first 15) ---\n")
    for i, event in enumerate(events.data[:15], 1):
        title = event['title'][:50] if event.get('title') else 'NO TITLE'
        date = event.get('start_date', 'N/A') or 'N/A'
        time = event.get('start_time') or 'NULL'
        all_day = "ALL-DAY" if event.get('is_all_day') else ""
        category = event.get('category') or 'none'

        print(f"{i:2d}. [{category:10s}] {date} {str(time):8s} {all_day:8s} {title}")
    
    # Check raw_text for time patterns
    print("\n--- Checking raw_text for time patterns ---\n")
    time_patterns_found = 0
    for event in events.data[:5]:
        if event.get('raw_text'):
            raw = event['raw_text'][:500]
            # Look for common time patterns
            import re
            time_matches = re.findall(r'\b\d{1,2}:\d{2}\s*[apAP][mM]\b|\b\d{1,2}\s*[apAP][mM]\b', raw)
            if time_matches:
                time_patterns_found += 1
                print(f"\nEvent: {event['title'][:60]}")
                print(f"Times found in raw_text: {', '.join(time_matches[:5])}")
                print(f"Extracted start_time: {event.get('start_time', 'NULL')}")
    
    if time_patterns_found == 0:
        print("No time patterns found in raw_text samples")

def main():
    # Analyze top offenders from the all-day diagnostic
    sources_to_check = [
        'basement-east',           # Nashville music venue - 88 all-day
        'brooklyn-bowl-nashville', # Nashville music venue - 67 all-day
        'exit-in',                 # Nashville music venue - 49 all-day
        'eddies-attic',            # Music venue - 46 all-day
        '529',                     # Atlanta music venue - 31 all-day
        'district-atlanta',        # Nightlife venue - 24 all-day
        'plaza-theatre',           # Cinema - 19 all-day films (BAD!)
        'helium-comedy',           # Comedy club - 23 all-day
    ]
    
    for source_slug in sources_to_check:
        analyze_source_details(source_slug)
        print("\n")

if __name__ == "__main__":
    main()
