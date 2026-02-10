"""Full detailed report of all weekend events."""
from collections import defaultdict
from datetime import datetime
from config import get_config
from db import get_client

def main():
    config = get_config()
    client = get_client()
    
    print("="*100)
    print("COMPLETE WEEKEND EVENT REPORT: February 13-15, 2026")
    print("="*100 + "\n")
    
    # Fetch all events
    result = client.table("events").select(
        "id, title, start_date, start_time, end_time, category, description, "
        "source_url, is_all_day, "
        "venue:venues(slug, name, neighborhood, venue_type)"
    ).gte("start_date", "2026-02-13").lte("start_date", "2026-02-15").order(
        "start_date, start_time"
    ).execute()
    
    events = result.data or []
    
    # Organize by date
    by_date = defaultdict(list)
    for e in events:
        by_date[e.get("start_date", "")].append(e)
    
    for date in sorted(by_date.keys()):
        day_name = datetime.strptime(date, "%Y-%m-%d").strftime("%A, %B %d, %Y")
        day_events = by_date[date]
        
        print("\n" + "="*100)
        print(f"{day_name} ({len(day_events)} events)")
        print("="*100 + "\n")
        
        # Group by category
        by_cat = defaultdict(list)
        for e in day_events:
            cat = e.get("category", "uncategorized")
            by_cat[cat].append(e)
        
        for cat in sorted(by_cat.keys()):
            cat_events = by_cat[cat]
            print(f"\n{cat.upper()} ({len(cat_events)})")
            print("-"*100)
            
            for e in cat_events:
                venue = e.get("venue") or {}
                venue_name = venue.get("name", "Unknown")
                hood = venue.get("neighborhood", "")
                
                title = e.get("title", "Untitled")
                time = e.get("start_time", "Time TBA")
                
                loc = venue_name
                if hood:
                    loc += f" ({hood})"
                
                print(f"\n{title}")
                print(f"  Time: {time}")
                print(f"  Venue: {loc}")
                if e.get("source_url"):
                    print(f"  URL: {e.get('source_url')}")
    
    print("\n\n" + "="*100)
    print("END OF REPORT")
    print("="*100)

if __name__ == "__main__":
    main()
