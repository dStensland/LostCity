"""
Optimized analysis of Feb 13-15, 2026 weekend events.
"""
from collections import defaultdict
from datetime import datetime
from config import get_config
from db import get_client

# Major venues for big events
MAJOR_VENUES = {
    'fox-theatre', 'state-farm-arena', 'mercedes-benz-stadium', 
    'coca-cola-roxy', 'tabernacle', 'center-stage', 'the-eastern',
    'variety-playhouse', 'atlanta-symphony-hall', 'alliance-theatre',
    'cobb-energy-centre', 'cadence-bank-amphitheatre'
}

def main():
    config = get_config()
    client = get_client()
    
    print("Fetching all weekend events...")
    
    # Fetch all events with venue info
    result = client.table("events").select(
        "id, title, start_date, start_time, end_time, category, description, "
        "source_url, is_all_day, venue_id, "
        "venue:venues(slug, name, neighborhood, venue_type)"
    ).gte("start_date", "2026-02-13").lte("start_date", "2026-02-15").order("start_date").execute()
    
    events = result.data or []
    print(f"Found {len(events)} events\n")
    
    # Categorize events
    friday_13th = []
    valentine = []
    big_events = []
    
    # Track unique title+venue combos
    title_venue_map = defaultdict(list)
    
    for event in events:
        title = event.get("title", "").lower()
        desc = (event.get("description") or "").lower()
        venue = event.get("venue") or {}
        venue_slug = venue.get("slug", "")
        venue_name = venue.get("name", "")
        venue_id = event.get("venue_id")
        
        # Group by title+venue for temporal analysis
        key = (event.get("title", ""), venue_id)
        title_venue_map[key].append(event)
        
        # Friday 13th themed
        if any(k in title or k in desc for k in ["friday the 13th", "friday 13th", "horror", "spooky"]):
            friday_13th.append(event)
        
        # Valentine themed  
        if any(k in title or k in desc for k in ["valentine", "love", "couples", "romantic", "date night", "galentine"]):
            valentine.append(event)
        
        # Big events
        if venue_slug in MAJOR_VENUES or "festival" in title or "fest" in title:
            big_events.append(event)
    
    print("\n" + "="*80)
    print(f"FRIDAY THE 13TH THEMED EVENTS ({len(friday_13th)})")
    print("="*80)
    for e in sorted(friday_13th, key=lambda x: (x.get("start_date", ""), x.get("start_time") or ""))[:50]:
        print_event(e)
    
    print("\n" + "="*80)
    print(f"VALENTINE'S THEMED EVENTS ({len(valentine)})")
    print("="*80)
    for e in sorted(valentine, key=lambda x: (x.get("start_date", ""), x.get("start_time") or ""))[:50]:
        print_event(e)
    
    print("\n" + "="*80)
    print(f"BIG/NOTABLE EVENTS ({len(big_events)})")
    print("="*80)
    for e in sorted(big_events, key=lambda x: (x.get("start_date", ""), x.get("start_time") or ""))[:50]:
        print_event(e)
    
    # Temporal analysis - need to query earlier/later dates
    print("\n" + "="*80)
    print("ANALYZING TEMPORAL PATTERNS...")
    print("="*80)
    
    last_weekend_shows = []
    opening_shows = []
    
    # Sample 50 shows for temporal analysis (to avoid too many queries)
    sample_keys = list(title_venue_map.keys())[:50]
    
    for key in sample_keys:
        title, venue_id = key
        if not title or not venue_id:
            continue
        
        weekend_events = title_venue_map[key]
        
        # Check for earlier occurrences (past 2 weeks)
        earlier = client.table("events").select("id").eq(
            "venue_id", venue_id
        ).eq("title", title).lt("start_date", "2026-02-13").gte(
            "start_date", "2026-02-01"
        ).limit(1).execute()
        
        # Check for later occurrences (next week)
        later = client.table("events").select("id").eq(
            "venue_id", venue_id
        ).eq("title", title).gt("start_date", "2026-02-15").lte(
            "start_date", "2026-02-22"
        ).limit(1).execute()
        
        has_earlier = bool(earlier.data)
        has_later = bool(later.data)
        
        if has_earlier and not has_later:
            last_weekend_shows.extend(weekend_events)
        elif not has_earlier:
            opening_shows.extend(weekend_events)
    
    print(f"\nFound {len(last_weekend_shows)} potential closing shows")
    print(f"Found {len(opening_shows)} potential opening shows")
    
    if last_weekend_shows:
        print("\n" + "-"*80)
        print("POTENTIAL CLOSING/LAST WEEKEND SHOWS")
        print("-"*80)
        for e in last_weekend_shows[:20]:
            print_event(e, prefix="[CLOSING] ")
    
    if opening_shows:
        print("\n" + "-"*80)
        print("POTENTIAL OPENING/NEW SHOWS")
        print("-"*80)
        for e in opening_shows[:20]:
            print_event(e, prefix="[NEW] ")
    
    # Category breakdown by day
    print("\n" + "="*80)
    print("EVENTS BY DATE AND CATEGORY")
    print("="*80)
    
    by_date_cat = defaultdict(lambda: defaultdict(list))
    for e in events:
        date = e.get("start_date", "")
        cat = e.get("category", "uncategorized")
        by_date_cat[date][cat].append(e)
    
    for date in sorted(by_date_cat.keys()):
        day_name = datetime.strptime(date, "%Y-%m-%d").strftime("%A, %B %d, %Y")
        print(f"\n{day_name}")
        print("-"*80)
        
        for cat in sorted(by_date_cat[date].keys()):
            cat_events = by_date_cat[date][cat]
            print(f"  {cat.upper()}: {len(cat_events)} events")
    
    # Summary stats
    print("\n" + "="*80)
    print("SUMMARY STATISTICS")
    print("="*80)
    print(f"Total events: {len(events)}")
    print(f"Friday the 13th themed: {len(friday_13th)}")
    print(f"Valentine's themed: {len(valentine)}")
    print(f"Big/notable events: {len(big_events)}")
    
    # Top categories
    cat_counts = defaultdict(int)
    for e in events:
        cat_counts[e.get("category", "uncategorized")] += 1
    
    print("\nTop 15 categories:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"  {cat}: {count}")
    
    # Top neighborhoods
    hood_counts = defaultdict(int)
    for e in events:
        venue = e.get("venue") or {}
        hood = venue.get("neighborhood", "Unknown")
        hood_counts[hood] += 1
    
    print("\nTop 15 neighborhoods:")
    for hood, count in sorted(hood_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"  {hood}: {count}")

def print_event(e, prefix=""):
    venue = e.get("venue") or {}
    venue_name = venue.get("name", "Unknown")
    hood = venue.get("neighborhood", "")
    
    title = e.get("title", "Untitled")
    date = e.get("start_date", "")
    time = e.get("start_time", "TBA")
    cat = e.get("category", "")
    
    loc = f"{venue_name}"
    if hood:
        loc += f" ({hood})"
    
    print(f"{prefix}{title}")
    print(f"  {date} @ {time} | {cat} | {loc}")
    print()

if __name__ == "__main__":
    main()
