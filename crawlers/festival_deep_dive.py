"""
Deep dive into specific festival integrity issues.
Focus on the calendar absorption problem described by the user.
"""

from datetime import datetime
from collections import defaultdict
from db import get_client


def check_decatur_calendar_absorption(client):
    """
    Check if Decatur festivals are absorbing all events from Decatur-area sources.
    """
    print("=" * 80)
    print("DECATUR CALENDAR ABSORPTION INVESTIGATION")
    print("=" * 80)
    
    # Find Decatur festival sources
    decatur_sources = []
    sources_result = client.table("sources")\
        .select("id, slug, name")\
        .execute()
    
    for source in (sources_result.data or []):
        slug = source.get("slug", "")
        name = source.get("name", "")
        if "decatur" in slug or "decatur" in name.lower():
            decatur_sources.append(source)
    
    print(f"\nFound {len(decatur_sources)} Decatur-related sources:")
    for source in decatur_sources:
        print(f"  - {source['slug']} ({source['name']})")
    
    # For each Decatur source, check event distribution
    print("\n" + "-" * 80)
    print("EVENT DISTRIBUTION BY SOURCE")
    print("-" * 80)
    
    for source in decatur_sources:
        source_id = source["id"]
        slug = source["slug"]
        
        # Get all events from this source
        events_result = client.table("events")\
            .select("id, title, series_id, venue_id, start_date")\
            .eq("source_id", source_id)\
            .execute()
        
        events = events_result.data or []
        
        if not events:
            print(f"\n{slug}: NO EVENTS")
            continue
        
        # Count events with vs without series links
        events_with_series = [e for e in events if e.get("series_id")]
        events_without_series = [e for e in events if not e.get("series_id")]
        
        # Group by series
        series_groups = defaultdict(list)
        for event in events_with_series:
            series_id = event.get("series_id")
            if series_id:
                series_groups[series_id].append(event)
        
        print(f"\n{slug} ({source['name']}):")
        print(f"  Total events: {len(events)}")
        print(f"  Events with series: {len(events_with_series)}")
        print(f"  Events without series: {len(events_without_series)}")
        
        if series_groups:
            print(f"  Series breakdown:")
            for series_id, series_events in sorted(series_groups.items(), key=lambda x: len(x[1]), reverse=True):
                # Get series info
                series_result = client.table("series")\
                    .select("title, series_type, festival_id")\
                    .eq("id", series_id)\
                    .execute()
                
                if series_result.data:
                    series = series_result.data[0]
                    series_title = series["title"]
                    series_type = series["series_type"]
                    
                    # Get unique venues for this series
                    venue_ids = set(e["venue_id"] for e in series_events if e.get("venue_id"))
                    
                    flag = ""
                    if series_type in ["festival", "festival_program"]:
                        flag = " [FESTIVAL]"
                    
                    print(f"    - {series_title} ({series_type}): {len(series_events)} events across {len(venue_ids)} venues{flag}")
                    
                    # Sample a few event titles
                    sample_titles = [e["title"] for e in series_events[:3] if e.get("title")]
                    if sample_titles:
                        print(f"      Examples: {', '.join(sample_titles)}")


def check_all_festival_series_venue_diversity(client):
    """
    Check ALL festival/festival_program series for multi-venue spread that suggests calendar absorption.
    """
    print("\n\n" + "=" * 80)
    print("ALL FESTIVAL SERIES - VENUE DIVERSITY CHECK")
    print("=" * 80)
    
    # Get all festival and festival_program series
    series_result = client.table("series")\
        .select("id, title, series_type, festival_id")\
        .in_("series_type", ["festival", "festival_program"])\
        .execute()
    
    all_series = series_result.data or []
    
    print(f"\nAnalyzing {len(all_series)} festival/festival_program series...\n")
    
    suspicious = []
    
    for series in all_series:
        series_id = series["id"]
        series_title = series["title"]
        series_type = series["series_type"]
        
        # Get events for this series
        events_result = client.table("events")\
            .select("id, title, venue_id, source_id, start_date")\
            .eq("series_id", series_id)\
            .execute()
        
        events = events_result.data or []
        
        if len(events) < 5:
            # Skip small series
            continue
        
        # Get unique venues
        venue_ids = set(e["venue_id"] for e in events if e.get("venue_id"))
        
        # Get venue names
        venue_names = []
        for venue_id in venue_ids:
            venue_result = client.table("venues")\
                .select("name")\
                .eq("id", venue_id)\
                .execute()
            if venue_result.data:
                venue_names.append(venue_result.data[0]["name"])
        
        # Get source info
        source_ids = set(e["source_id"] for e in events if e.get("source_id"))
        source_slugs = []
        for source_id in source_ids:
            source_result = client.table("sources")\
                .select("slug")\
                .eq("id", source_id)\
                .execute()
            if source_result.data:
                source_slugs.append(source_result.data[0]["slug"])
        
        # Red flag: many venues suggests calendar absorption
        if len(venue_ids) >= 8:
            suspicious.append({
                "series_title": series_title,
                "series_type": series_type,
                "event_count": len(events),
                "venue_count": len(venue_ids),
                "venue_names": venue_names,
                "source_count": len(source_ids),
                "source_slugs": source_slugs,
            })
    
    # Sort by venue count (most suspicious first)
    suspicious.sort(key=lambda x: x["venue_count"], reverse=True)
    
    print(f"Found {len(suspicious)} festival series with 8+ venues (likely calendar absorption):\n")
    
    for item in suspicious:
        print(f"Series: {item['series_title']} ({item['series_type']})")
        print(f"  Events: {item['event_count']}")
        print(f"  Venues: {item['venue_count']}")
        print(f"  Venues: {', '.join(item['venue_names'][:10])}")
        if len(item['venue_names']) > 10:
            print(f"         ... and {len(item['venue_names']) - 10} more")
        print(f"  Sources: {item['source_count']} - {', '.join(item['source_slugs'])}")
        print()


def check_source_series_linking_patterns(client):
    """
    Check which sources are creating festival series and how.
    """
    print("\n" + "=" * 80)
    print("SOURCE SERIES CREATION PATTERNS")
    print("=" * 80)
    
    # Get all events with series links
    events_result = client.table("events")\
        .select("source_id, series_id")\
        .not_.is_("series_id", "null")\
        .execute()
    
    events = events_result.data or []
    
    # Build source -> series mapping
    source_series_map = defaultdict(set)
    for event in events:
        source_id = event.get("source_id")
        series_id = event.get("series_id")
        if source_id and series_id:
            source_series_map[source_id].add(series_id)
    
    # Get series info
    all_series_result = client.table("series")\
        .select("id, title, series_type")\
        .execute()
    all_series = {s["id"]: s for s in (all_series_result.data or [])}
    
    # Get source info
    all_sources_result = client.table("sources")\
        .select("id, slug, name")\
        .execute()
    all_sources = {s["id"]: s for s in (all_sources_result.data or [])}
    
    # Find sources creating many festival series
    festival_creators = []
    
    for source_id, series_ids in source_series_map.items():
        festival_series_count = 0
        festival_series_titles = []
        
        for series_id in series_ids:
            series = all_series.get(series_id)
            if series and series["series_type"] in ["festival", "festival_program"]:
                festival_series_count += 1
                festival_series_titles.append(series["title"])
        
        if festival_series_count >= 3:
            source = all_sources.get(source_id, {})
            festival_creators.append({
                "source_slug": source.get("slug", f"id:{source_id}"),
                "source_name": source.get("name", "unknown"),
                "festival_series_count": festival_series_count,
                "festival_series": festival_series_titles,
            })
    
    # Sort by count
    festival_creators.sort(key=lambda x: x["festival_series_count"], reverse=True)
    
    print(f"\nFound {len(festival_creators)} sources creating 3+ festival series:\n")
    
    for item in festival_creators:
        print(f"Source: {item['source_slug']} ({item['source_name']})")
        print(f"  Festival series: {item['festival_series_count']}")
        print(f"  Series: {', '.join(item['festival_series'][:5])}")
        if len(item['festival_series']) > 5:
            print(f"         ... and {len(item['festival_series']) - 5} more")
        print()


def main():
    print("\n" + "=" * 80)
    print("FESTIVAL DEEP DIVE - CALENDAR ABSORPTION INVESTIGATION")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    client = get_client()
    
    # Run investigations
    check_decatur_calendar_absorption(client)
    check_all_festival_series_venue_diversity(client)
    check_source_series_linking_patterns(client)
    
    print("\n" + "=" * 80)
    print("END OF INVESTIGATION")
    print("=" * 80)


if __name__ == "__main__":
    main()
