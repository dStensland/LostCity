"""
Analyze events for Feb 13-15, 2026 (Friday the 13th through Sunday).
"""

import sys
from datetime import datetime, timedelta
from collections import defaultdict
from config import get_config
from db import get_client

# Major venues for "Big Events" detection
MAJOR_VENUES = {
    'fox-theatre', 'state-farm-arena', 'mercedes-benz-stadium', 
    'coca-cola-roxy', 'tabernacle', 'center-stage', 'the-eastern',
    'variety-playhouse', 'atlanta-symphony-hall', 'alliance-theatre',
    'cobb-energy-centre', 'cadence-bank-amphitheatre', 'lakewood-amphitheatre',
    'truist-park', 'gas-south-arena', 'infinite-energy-arena'
}

def analyze_weekend():
    """Query and analyze events for Feb 13-15, 2026."""
    config = get_config()
    client = get_client()
    
    # Query all weekend events with venue details
    print("Fetching weekend events...")
    result = client.table("events").select(
        "id, title, start_date, start_time, end_time, category, description, "
        "source_url, is_all_day, series_id, "
        "venue:venues(id, slug, name, neighborhood, venue_type)"
    ).gte("start_date", "2026-02-13").lte("start_date", "2026-02-15").order("start_date", desc=False).execute()
    
    events = result.data or []
    print(f"\nFound {len(events)} events for Feb 13-15, 2026\n")
    
    if not events:
        print("No events found for this weekend.")
        return
    
    # Organize events by analysis categories
    friday_13th_themed = []
    valentine_themed = []
    big_events = []
    last_weekend_shows = {}  # title+venue -> list of events
    opening_events = {}  # title+venue -> event
    
    # Track all unique title+venue combos for temporal analysis
    title_venue_dates = defaultdict(list)
    
    for event in events:
        title = event.get("title", "").lower()
        desc = (event.get("description") or "").lower()
        venue = event.get("venue") or {}
        venue_slug = venue.get("slug", "")
        venue_name = venue.get("name", "")
        
        # Track dates for each title+venue combo
        key = f"{event.get('title', '')}|||{venue_name}"
        title_venue_dates[key].append(event)
        
        # Friday the 13th themed
        if any(keyword in title or keyword in desc for keyword in 
               ["friday the 13th", "friday 13th", "horror", "spooky", "unlucky"]):
            friday_13th_themed.append(event)
        
        # Valentine's themed
        if any(keyword in title or keyword in desc for keyword in 
               ["valentine", "love", "couples", "romantic", "date night", "galentine"]):
            valentine_themed.append(event)
        
        # Big/notable events (major venues or festival-like)
        if venue_slug in MAJOR_VENUES or "festival" in title or "fest" in title:
            big_events.append(event)
    
    # Now analyze temporal patterns (last weekend vs opening)
    # We need to query events from the past 2 weeks for each title+venue combo
    print("Analyzing temporal patterns (last shows vs openings)...")
    
    for key, weekend_events in title_venue_dates.items():
        if not weekend_events:
            continue
        
        first_event = weekend_events[0]
        title = first_event.get("title", "")
        venue = first_event.get("venue") or {}
        venue_id = venue.get("id")
        
        if not venue_id or not title:
            continue
        
        # Query for earlier occurrences of this show (past 2 weeks)
        earlier_result = client.table("events").select(
            "id, title, start_date, venue_id"
        ).eq("venue_id", venue_id).eq("title", title).lt("start_date", "2026-02-13").gte("start_date", "2026-02-01").execute()
        
        earlier_events = earlier_result.data or []
        
        # Query for later occurrences (next week)
        later_result = client.table("events").select(
            "id, title, start_date, venue_id"
        ).eq("venue_id", venue_id).eq("title", title).gt("start_date", "2026-02-15").lte("start_date", "2026-02-22").execute()
        
        later_events = later_result.data or []
        
        # If there are earlier events but no later events, it's likely a last weekend
        if earlier_events and not later_events:
            last_weekend_shows[key] = weekend_events
        
        # If no earlier events, it's an opening/new show
        elif not earlier_events:
            opening_events[key] = weekend_events[0]
    
    # Print results organized by category
    print("\n" + "="*80)
    print("WEEKEND EVENT ANALYSIS: Feb 13-15, 2026")
    print("="*80)
    
    # Friday the 13th themed
    print("\n" + "-"*80)
    print(f"FRIDAY THE 13TH THEMED EVENTS ({len(friday_13th_themed)})")
    print("-"*80)
    for event in sorted(friday_13th_themed, key=lambda e: (e.get("start_date", ""), e.get("start_time") or "")):
        print_event(event)
    
    # Valentine's themed
    print("\n" + "-"*80)
    print(f"VALENTINE'S THEMED EVENTS ({len(valentine_themed)})")
    print("-"*80)
    for event in sorted(valentine_themed, key=lambda e: (e.get("start_date", ""), e.get("start_time") or "")):
        print_event(event)
    
    # Big/notable events
    print("\n" + "-"*80)
    print(f"BIG/NOTABLE EVENTS ({len(big_events)})")
    print("-"*80)
    for event in sorted(big_events, key=lambda e: (e.get("start_date", ""), e.get("start_time") or "")):
        print_event(event)
    
    # Last weekend shows
    print("\n" + "-"*80)
    print(f"LAST WEEKEND / CLOSING SHOWS ({len(last_weekend_shows)})")
    print("-"*80)
    for key, weekend_events in sorted(last_weekend_shows.items()):
        for event in weekend_events:
            print_event(event, prefix="[CLOSING] ")
    
    # Opening/new events
    print("\n" + "-"*80)
    print(f"OPENING / NEW EVENTS ({len(opening_events)})")
    print("-"*80)
    for key, event in sorted(opening_events.items()):
        print_event(event, prefix="[NEW] ")
    
    # All events by date and category
    print("\n" + "-"*80)
    print(f"ALL EVENTS BY DATE & CATEGORY ({len(events)})")
    print("-"*80)
    
    events_by_date = defaultdict(lambda: defaultdict(list))
    for event in events:
        date = event.get("start_date", "Unknown")
        category = event.get("category", "uncategorized")
        events_by_date[date][category].append(event)
    
    for date in sorted(events_by_date.keys()):
        day_name = datetime.strptime(date, "%Y-%m-%d").strftime("%A, %B %d")
        print(f"\n{day_name} ({date})")
        print("=" * 80)
        
        for category in sorted(events_by_date[date].keys()):
            cat_events = events_by_date[date][category]
            print(f"\n  {category.upper()} ({len(cat_events)} events)")
            print("  " + "-" * 76)
            for event in sorted(cat_events, key=lambda e: e.get("start_time") or ""):
                print_event(event, indent="    ")
    
    # Summary statistics
    print("\n" + "="*80)
    print("SUMMARY STATISTICS")
    print("="*80)
    print(f"Total events: {len(events)}")
    print(f"Friday the 13th themed: {len(friday_13th_themed)}")
    print(f"Valentine's themed: {len(valentine_themed)}")
    print(f"Big/notable events: {len(big_events)}")
    print(f"Last weekend/closing shows: {len(last_weekend_shows)}")
    print(f"Opening/new events: {len(opening_events)}")
    
    # Category breakdown
    category_counts = defaultdict(int)
    for event in events:
        category = event.get("category", "uncategorized")
        category_counts[category] += 1
    
    print("\nEvents by category:")
    for category, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {category}: {count}")
    
    # Neighborhood breakdown
    neighborhood_counts = defaultdict(int)
    for event in events:
        venue = event.get("venue") or {}
        neighborhood = venue.get("neighborhood", "Unknown")
        neighborhood_counts[neighborhood] += 1
    
    print("\nEvents by neighborhood:")
    for neighborhood, count in sorted(neighborhood_counts.items(), key=lambda x: -x[1])[:20]:
        print(f"  {neighborhood}: {count}")


def print_event(event, prefix="", indent=""):
    """Print formatted event details."""
    venue = event.get("venue") or {}
    venue_name = venue.get("name", "Unknown Venue")
    neighborhood = venue.get("neighborhood", "")
    
    title = event.get("title", "Untitled")
    start_date = event.get("start_date", "")
    start_time = event.get("start_time", "")
    end_time = event.get("end_time", "")
    category = event.get("category", "")
    is_all_day = event.get("is_all_day", False)
    
    # Format time display
    if is_all_day:
        time_str = "All Day"
    elif start_time:
        if end_time:
            time_str = f"{start_time} - {end_time}"
        else:
            time_str = start_time
    else:
        time_str = "Time TBA"
    
    # Build location string
    location = venue_name
    if neighborhood:
        location += f" ({neighborhood})"
    
    # Print formatted output
    print(f"{indent}{prefix}{title}")
    print(f"{indent}  {start_date} @ {time_str} | {category} | {location}")
    
    # Add description preview if available
    desc = event.get("description", "")
    if desc and len(desc) > 100:
        desc_preview = desc[:150].replace("\n", " ") + "..."
        print(f"{indent}  {desc_preview}")
    
    print(f"{indent}  {event.get('source_url', '')}")
    print()


if __name__ == "__main__":
    try:
        analyze_weekend()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
