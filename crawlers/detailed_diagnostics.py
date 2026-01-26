"""
Detailed diagnostics for specific data quality issues.
"""

from db import get_client

def get_source_id(client, slug):
    """Get source ID by slug, return None if not found."""
    try:
        result = client.table("sources").select("id").eq("slug", slug).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]['id']
    except:
        pass
    return None

def check_missing_fields():
    """Examine events missing critical fields in detail."""
    client = get_client()
    
    print("=" * 80)
    print("DETAILED DIAGNOSTIC: MISSING CRITICAL FIELDS")
    print("=" * 80)
    print()
    
    # Get all events missing critical fields grouped by source
    result = client.table("events") \
        .select("id, title, start_date, venue_id, source_id, sources(name, slug), venues(name), raw_text, source_url") \
        .or_("title.is.null,start_date.is.null,venue_id.is.null") \
        .limit(10) \
        .execute()
    
    if result.data:
        # Group by source
        by_source = {}
        for event in result.data:
            source = event.get('sources', {})
            source_name = source.get('name', 'Unknown')
            if source_name not in by_source:
                by_source[source_name] = []
            by_source[source_name].append(event)
        
        for source_name, events in list(by_source.items())[:3]:
            print(f"{source_name} - Sample missing field events")
            print("-" * 80)
            
            for event in events[:3]:
                print(f"\nEvent ID: {event['id']}")
                print(f"  Title: {event.get('title', 'MISSING')}")
                print(f"  Date: {event.get('start_date', 'MISSING')}")
                print(f"  Venue ID: {event.get('venue_id', 'MISSING')}")
                venue = event.get('venues', {})
                if venue:
                    print(f"  Venue: {venue.get('name', 'N/A')}")
                print(f"  URL: {event.get('source_url', 'N/A')[:80]}")
                raw = event.get('raw_text', '')
                if raw:
                    print(f"  Raw text sample: {raw[:200]}")
            
            print()
    
    print()

def check_crawl_errors():
    """Examine recent crawl errors."""
    client = get_client()
    
    print("=" * 80)
    print("DETAILED DIAGNOSTIC: CRAWL ERRORS")
    print("=" * 80)
    print()
    
    # Check 'soup' error pattern
    print("'soup' NameError Pattern")
    print("-" * 80)
    result = client.table("crawl_logs") \
        .select("sources(name, slug), error_message, started_at") \
        .like("error_message", "%soup%") \
        .limit(5) \
        .execute()
    
    if result.data:
        print(f"Found {len(result.data)} instances of 'soup' errors")
        for log in result.data:
            source = log.get('sources', {})
            print(f"\nSource: {source.get('name')} ({source.get('slug')})")
            print(f"  Time: {log.get('started_at')}")
            print(f"  Error: {log.get('error_message')[:200]}")
    
    print("\n")
    
    # Check 404 errors
    print("404 Not Found Errors")
    print("-" * 80)
    result = client.table("crawl_logs") \
        .select("sources(name, slug, url), error_message, started_at") \
        .like("error_message", "%404%") \
        .limit(10) \
        .execute()
    
    if result.data:
        print(f"Found {len(result.data)} 404 errors")
        
        # Group by source
        by_source = {}
        for log in result.data:
            source = log.get('sources', {})
            name = source.get('name', 'Unknown')
            if name not in by_source:
                by_source[name] = {
                    'slug': source.get('slug'),
                    'url': source.get('url'),
                    'count': 0
                }
            by_source[name]['count'] += 1
        
        print("\nSources with 404 errors:")
        for name, info in sorted(by_source.items(), key=lambda x: x[1]['count'], reverse=True):
            print(f"  {name} ({info['slug']}): {info['count']} errors")
            print(f"    URL: {info['url']}")
    
    print("\n")

def check_venue_issues():
    """Examine venue data quality."""
    client = get_client()
    
    print("=" * 80)
    print("DETAILED DIAGNOSTIC: VENUE ISSUES")
    print("=" * 80)
    print()
    
    print("Venues without coordinates")
    print("-" * 80)
    result = client.table("venues") \
        .select("id, name, address, city, zip") \
        .or_("lat.is.null,lng.is.null") \
        .limit(10) \
        .execute()
    
    if result.data:
        for venue in result.data:
            print(f"\nVenue ID {venue['id']}: {venue['name']}")
            print(f"  Address: {venue.get('address', 'Missing')}")
            print(f"  City: {venue.get('city', 'Missing')}")
            print(f"  Zip: {venue.get('zip', 'Missing')}")
            
            # Check how many events use this venue
            event_count = client.table("events") \
                .select("id", count="exact") \
                .eq("venue_id", venue['id']) \
                .execute()
            print(f"  Events using this venue: {event_count.count}")
    
    print("\n")

def check_time_issues():
    """Check midnight time issues."""
    client = get_client()
    
    print("=" * 80)
    print("DETAILED DIAGNOSTIC: SUSPICIOUS MIDNIGHT TIMES")
    print("=" * 80)
    print()
    
    result = client.table("events") \
        .select("id, title, start_date, start_time, category, description, sources(name, slug), raw_text") \
        .eq("start_time", "00:00:00") \
        .eq("is_all_day", False) \
        .not_.in_("category", ["nightlife", "music", "dance"]) \
        .limit(5) \
        .execute()
    
    if result.data:
        for event in result.data:
            print(f"\nEvent ID: {event['id']}")
            print(f"  Title: {event['title']}")
            print(f"  Date/Time: {event['start_date']} at {event['start_time']}")
            print(f"  Category: {event.get('category')}")
            print(f"  Source: {event.get('sources', {}).get('name')}")
            desc = event.get('description', '')
            if desc:
                print(f"  Description: {desc[:150]}")
            raw = event.get('raw_text', '')
            if raw and 'time' in raw.lower():
                # Try to find time mentions in raw text
                lines = raw.split('\n')
                time_lines = [l for l in lines if 'time' in l.lower() or 'pm' in l.lower() or 'am' in l.lower()]
                if time_lines:
                    print("  Raw text time mentions:")
                    for line in time_lines[:3]:
                        print(f"    {line.strip()[:100]}")
    
    print("\n")

if __name__ == "__main__":
    check_missing_fields()
    check_crawl_errors()
    check_venue_issues()
    check_time_issues()
