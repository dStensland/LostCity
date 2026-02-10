#!/usr/bin/env python3
"""
Query and analyze all events happening this week (Feb 9-15, 2026).
Provides comprehensive breakdown by category, day, neighborhood, and highlights.
"""

from datetime import datetime, timedelta
from collections import defaultdict, Counter
from config import get_config
from supabase import create_client

def get_day_name(date_str):
    """Convert YYYY-MM-DD to day name."""
    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    return date_obj.strftime("%A")

def format_time(time_str):
    """Format time string."""
    if not time_str:
        return "Time TBA"
    try:
        time_obj = datetime.strptime(time_str, "%H:%M:%S")
        return time_obj.strftime("%I:%M %p").lstrip("0")
    except:
        return time_str

def main():
    # Setup
    cfg = get_config()
    client = create_client(
        cfg.database.supabase_url,
        cfg.database.supabase_service_key
    )
    
    # Date range for this week
    start_date = "2026-02-09"
    end_date = "2026-02-15"
    
    print(f"\n{'='*80}")
    print(f"WEEKLY EVENTS REPORT: February 9-15, 2026")
    print(f"{'='*80}\n")
    
    # Query events with venue information
    result = client.table("events") \
        .select("*, venue:venues(name, neighborhood, venue_type, address, city)") \
        .gte("start_date", start_date) \
        .lte("start_date", end_date) \
        .order("start_date") \
        .order("start_time") \
        .execute()
    
    events = result.data or []
    total_count = len(events)
    
    print(f"TOTAL EVENTS: {total_count}\n")
    
    if total_count == 0:
        print("No events found for this week.")
        return
    
    # Organize data
    by_category = defaultdict(list)
    by_day = defaultdict(list)
    by_neighborhood = defaultdict(list)
    festivals = []
    
    for event in events:
        category = event.get("category") or "uncategorized"
        by_category[category].append(event)
        
        date = event.get("start_date")
        by_day[date].append(event)
        
        venue = event.get("venue") or {}
        neighborhood = venue.get("neighborhood") or "Unknown"
        by_neighborhood[neighborhood].append(event)
        
        # Identify festivals/major events
        if event.get("series_id"):
            festivals.append(event)
    
    # === BREAKDOWN BY CATEGORY ===
    print(f"{'='*80}")
    print("BREAKDOWN BY CATEGORY")
    print(f"{'='*80}\n")
    
    category_counts = Counter({cat: len(evts) for cat, evts in by_category.items()})
    for category, count in category_counts.most_common():
        percentage = (count / total_count) * 100
        print(f"{category.upper():20s} {count:4d} events ({percentage:5.1f}%)")
    
    # === BREAKDOWN BY DAY ===
    print(f"\n{'='*80}")
    print("BREAKDOWN BY DAY OF THE WEEK")
    print(f"{'='*80}\n")
    
    for date in sorted(by_day.keys()):
        day_name = get_day_name(date)
        count = len(by_day[date])
        print(f"{day_name:10s} {date}  {count:4d} events")
    
    # === BREAKDOWN BY NEIGHBORHOOD ===
    print(f"\n{'='*80}")
    print("BREAKDOWN BY NEIGHBORHOOD (Top 15)")
    print(f"{'='*80}\n")
    
    neighborhood_counts = Counter({n: len(evts) for n, evts in by_neighborhood.items()})
    for neighborhood, count in neighborhood_counts.most_common(15):
        percentage = (count / total_count) * 100
        print(f"{neighborhood:30s} {count:4d} events ({percentage:5.1f}%)")
    
    # === DAILY SCHEDULE WITH HIGHLIGHTS ===
    print(f"\n{'='*80}")
    print("DAILY SCHEDULE WITH HIGHLIGHTS")
    print(f"{'='*80}\n")
    
    for date in sorted(by_day.keys()):
        day_name = get_day_name(date)
        day_events = by_day[date]
        
        print(f"\n{day_name.upper()}, {date} ({len(day_events)} events)")
        print("-" * 80)
        
        # Group by category for this day
        day_by_category = defaultdict(list)
        for evt in day_events:
            cat = evt.get("category") or "uncategorized"
            day_by_category[cat].append(evt)
        
        # Show highlights from each category
        for category in sorted(day_by_category.keys()):
            cat_events = day_by_category[category]
            print(f"\n  {category.upper()} ({len(cat_events)} events):")
            
            # Show up to 5 events per category per day
            for evt in cat_events[:5]:
                title = evt.get("title", "Untitled")[:70]
                time_str = format_time(evt.get("start_time"))
                venue = evt.get("venue") or {}
                venue_name = venue.get("name", "Venue TBA")[:40]
                neighborhood = venue.get("neighborhood", "")
                
                location = f"{venue_name}"
                if neighborhood and neighborhood != "Unknown":
                    location += f" ({neighborhood})"
                
                print(f"    • {time_str:12s} {title}")
                print(f"      {location}")
            
            if len(cat_events) > 5:
                print(f"    ... and {len(cat_events) - 5} more {category} events")
    
    # === FESTIVALS & MAJOR EVENTS ===
    print(f"\n{'='*80}")
    print("FESTIVALS & MAJOR EVENT SERIES")
    print(f"{'='*80}\n")
    
    if festivals:
        # Query series info for festivals
        series_ids = list(set(evt.get("series_id") for evt in festivals if evt.get("series_id")))
        series_result = client.table("series") \
            .select("id, title, series_type") \
            .in_("id", series_ids) \
            .execute()
        
        series_map = {s["id"]: s for s in (series_result.data or [])}
        
        # Group events by series
        by_series = defaultdict(list)
        for evt in festivals:
            series_id = evt.get("series_id")
            if series_id:
                by_series[series_id].append(evt)
        
        for series_id, series_events in by_series.items():
            series_info = series_map.get(series_id, {})
            series_title = series_info.get("title", "Unknown Series")
            series_type = series_info.get("series_type", "")
            
            print(f"\n{series_title}")
            if series_type:
                print(f"  Type: {series_type}")
            print(f"  {len(series_events)} events this week")
            
            # Show date range
            dates = [evt.get("start_date") for evt in series_events if evt.get("start_date")]
            if dates:
                print(f"  Dates: {min(dates)} to {max(dates)}")
    else:
        print("No major festival or series events found this week.")
    
    # === NOTABLE EVENTS ===
    print(f"\n{'='*80}")
    print("NOTABLE/INTERESTING EVENTS")
    print(f"{'='*80}\n")
    
    # Find high-profile venues
    notable_venues = {
        "Mercedes-Benz Stadium", "State Farm Arena", "Truist Park",
        "Fox Theatre", "Tabernacle", "The Eastern", "Terminal West",
        "Variety Playhouse", "Atlanta Symphony Hall", "Woodruff Arts Center",
        "High Museum", "Alliance Theatre", "Dad's Garage", "Atlanta Opera",
        "Atlanta Ballet", "Coca-Cola Roxy"
    }
    
    notable_events = []
    for evt in events:
        venue = evt.get("venue") or {}
        venue_name = venue.get("name", "")
        
        # Check for notable venues or large events
        if any(nv.lower() in venue_name.lower() for nv in notable_venues):
            notable_events.append(evt)
            continue
        
        # Check for high-price events (likely major shows)
        price_max = evt.get("price_max")
        if price_max and price_max > 100:
            notable_events.append(evt)
            continue
    
    if notable_events:
        for evt in notable_events[:15]:  # Show top 15
            title = evt.get("title", "Untitled")
            date = evt.get("start_date")
            day = get_day_name(date)
            time_str = format_time(evt.get("start_time"))
            venue = evt.get("venue") or {}
            venue_name = venue.get("name", "Venue TBA")
            category = evt.get("category", "").upper()
            
            print(f"\n  {title}")
            print(f"  {day}, {date} at {time_str}")
            print(f"  {venue_name} | {category}")
            
            if evt.get("price_min") or evt.get("price_max"):
                price_min = evt.get("price_min", 0)
                price_max = evt.get("price_max", 0)
                if price_min == price_max:
                    print(f"  Price: ${price_min}")
                else:
                    print(f"  Price: ${price_min}-${price_max}")
    else:
        print("No particularly notable events identified.")
    
    # === DATA QUALITY NOTES ===
    print(f"\n{'='*80}")
    print("DATA QUALITY NOTES")
    print(f"{'='*80}\n")
    
    missing_time = sum(1 for evt in events if not evt.get("start_time"))
    missing_image = sum(1 for evt in events if not evt.get("image_url"))
    missing_description = sum(1 for evt in events if not evt.get("description"))
    free_events = sum(1 for evt in events if evt.get("is_free"))
    
    print(f"Events missing start_time:  {missing_time:4d} ({(missing_time/total_count)*100:5.1f}%)")
    print(f"Events missing image:       {missing_image:4d} ({(missing_image/total_count)*100:5.1f}%)")
    print(f"Events missing description: {missing_description:4d} ({(missing_description/total_count)*100:5.1f}%)")
    print(f"Free events:                {free_events:4d} ({(free_events/total_count)*100:5.1f}%)")
    
    print(f"\n{'='*80}")
    print("END OF REPORT")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()
