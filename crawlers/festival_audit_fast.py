"""
Festival Data Integrity Audit (Optimized)
Batch queries to reduce database round-trips.
"""

from datetime import datetime
from collections import defaultdict
from difflib import SequenceMatcher
from db import get_client


def similarity_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def calculate_title_overlap(event_titles: list[str], festival_name: str) -> float:
    if not event_titles or not festival_name:
        return 0.0
    
    festival_words = set(festival_name.lower().split())
    overlaps = []
    
    for title in event_titles:
        if not title:
            continue
        title_words = set(title.lower().split())
        if not title_words:
            continue
        overlap = len(festival_words & title_words) / len(title_words)
        overlaps.append(overlap)
    
    return sum(overlaps) / len(overlaps) if overlaps else 0.0


def main():
    print("\n" + "=" * 80)
    print("FESTIVAL DATA INTEGRITY AUDIT")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    client = get_client()
    
    # ========================================================================
    # FETCH ALL DATA IN ONE SHOT
    # ========================================================================
    
    print("\nFetching data...")
    
    # Get all series
    print("  - Series...")
    all_series_result = client.table("series")\
        .select("id, title, series_type, festival_id")\
        .execute()
    all_series = {s["id"]: s for s in (all_series_result.data or [])}
    
    # Get all festivals
    print("  - Festivals...")
    all_festivals_result = client.table("festivals")\
        .select("id, name, slug")\
        .execute()
    all_festivals = {f["id"]: f for f in (all_festivals_result.data or [])}
    
    # Get all events with series links
    print("  - Events...")
    all_events_result = client.table("events")\
        .select("id, title, venue_id, source_id, category, start_date, is_class, series_id")\
        .not_.is_("series_id", "null")\
        .execute()
    all_events = all_events_result.data or []
    
    # Get all sources
    print("  - Sources...")
    all_sources_result = client.table("sources")\
        .select("id, slug, name")\
        .execute()
    all_sources = {s["id"]: s for s in (all_sources_result.data or [])}
    
    print(f"\nLoaded {len(all_series)} series, {len(all_festivals)} festivals, {len(all_events)} events with series links, {len(all_sources)} sources\n")
    
    # ========================================================================
    # ISSUE 1: FESTIVAL EVENT ABSORPTION
    # ========================================================================
    
    print("=" * 80)
    print("ISSUE 1: FESTIVAL EVENT ABSORPTION")
    print("=" * 80)
    
    # Group events by series
    events_by_series = defaultdict(list)
    for event in all_events:
        series_id = event.get("series_id")
        if series_id:
            events_by_series[series_id].append(event)
    
    absorption_issues = []
    
    for series_id, events in events_by_series.items():
        series = all_series.get(series_id)
        if not series:
            continue
        
        # Only check festival and festival_program types
        if series["series_type"] not in ["festival", "festival_program"]:
            continue
        
        series_title = series["title"]
        
        # Analyze event distribution
        venue_ids = set(e["venue_id"] for e in events if e.get("venue_id"))
        source_ids = set(e["source_id"] for e in events if e.get("source_id"))
        categories = set(e["category"] for e in events if e.get("category"))
        
        # Calculate date spread
        dates = [e["start_date"] for e in events if e.get("start_date")]
        if dates:
            min_date = min(dates)
            max_date = max(dates)
            date_spread_days = (datetime.fromisoformat(max_date) - datetime.fromisoformat(min_date)).days
        else:
            date_spread_days = 0
        
        # Calculate title overlap
        titles = [e["title"] for e in events if e.get("title")]
        title_overlap = calculate_title_overlap(titles, series_title)
        
        # Count classes
        class_count = sum(1 for e in events if e.get("is_class"))
        
        # Red flags
        flags = []
        
        if len(venue_ids) > 10:
            flags.append(f"TOO_MANY_VENUES({len(venue_ids)})")
        
        if len(categories) >= 5:
            flags.append(f"TOO_MANY_CATEGORIES({len(categories)})")
        
        if len(source_ids) > 3:
            flags.append(f"MULTIPLE_SOURCES({len(source_ids)})")
        
        if date_spread_days > 180:
            flags.append(f"LONG_DATE_SPREAD({date_spread_days}d)")
        
        if title_overlap < 0.1 and len(events) > 5:
            flags.append(f"LOW_TITLE_OVERLAP({title_overlap:.2f})")
        
        if class_count > 0:
            flags.append(f"HAS_CLASSES({class_count})")
        
        if flags:
            source_slugs = [all_sources.get(sid, {}).get("slug", f"id:{sid}") for sid in source_ids]
            absorption_issues.append({
                "series_id": series_id,
                "series_title": series_title,
                "series_type": series["series_type"],
                "event_count": len(events),
                "venue_count": len(venue_ids),
                "source_count": len(source_ids),
                "category_count": len(categories),
                "categories": list(categories),
                "date_spread_days": date_spread_days,
                "title_overlap": title_overlap,
                "class_count": class_count,
                "flags": flags,
                "source_slugs": source_slugs,
            })
    
    # Sort by severity
    absorption_issues.sort(key=lambda x: (len(x["flags"]), x["event_count"]), reverse=True)
    
    print(f"\nFound {len(absorption_issues)} problematic festival series:\n")
    
    for issue in absorption_issues:
        print(f"Series: {issue['series_title']} ({issue['series_type']})")
        print(f"  Series ID: {issue['series_id']}")
        print(f"  Events: {issue['event_count']}")
        print(f"  Venues: {issue['venue_count']}")
        print(f"  Sources: {issue['source_count']} - {', '.join(issue['source_slugs'][:5])}")
        print(f"  Categories: {issue['category_count']} - {issue['categories']}")
        print(f"  Date spread: {issue['date_spread_days']} days")
        print(f"  Title overlap: {issue['title_overlap']:.2%}")
        if issue['class_count'] > 0:
            print(f"  Classes: {issue['class_count']}")
        print(f"  FLAGS: {', '.join(issue['flags'])}")
        print()
    
    # ========================================================================
    # ISSUE 2: AGGREGATOR CONTAMINATION
    # ========================================================================
    
    print("=" * 80)
    print("ISSUE 2: AGGREGATOR CONTAMINATION")
    print("=" * 80)
    
    aggregator_slugs = ["ticketmaster", "eventbrite", "dice", "eventcombo"]
    aggregator_issues = []
    
    for slug in aggregator_slugs:
        # Find source ID
        source_id = None
        for sid, source in all_sources.items():
            if source.get("slug") == slug:
                source_id = sid
                break
        
        if not source_id:
            continue
        
        # Count events from this source linked to festival series
        festival_events = 0
        festival_series_set = set()
        
        for event in all_events:
            if event.get("source_id") != source_id:
                continue
            
            series_id = event.get("series_id")
            if not series_id:
                continue
            
            series = all_series.get(series_id)
            if series and series["series_type"] in ["festival", "festival_program"]:
                festival_events += 1
                festival_series_set.add(series["title"])
        
        if festival_events > 0:
            aggregator_issues.append({
                "source_name": all_sources[source_id]["name"],
                "source_slug": slug,
                "festival_events": festival_events,
                "festival_series": list(festival_series_set),
            })
    
    print(f"\nFound {len(aggregator_issues)} aggregator sources linking to festivals:\n")
    
    for issue in aggregator_issues:
        print(f"Source: {issue['source_name']} ({issue['source_slug']})")
        print(f"  Festival events: {issue['festival_events']}")
        print(f"  Festival series: {', '.join(issue['festival_series'][:10])}")
        if len(issue['festival_series']) > 10:
            print(f"  ... and {len(issue['festival_series']) - 10} more")
        print()
    
    # ========================================================================
    # ISSUE 3: CLASSES IN FESTIVALS
    # ========================================================================
    
    print("=" * 80)
    print("ISSUE 3: CLASSES LINKED TO FESTIVALS")
    print("=" * 80)
    
    class_festival_link = defaultdict(list)
    
    for event in all_events:
        if not event.get("is_class"):
            continue
        
        series_id = event.get("series_id")
        if not series_id:
            continue
        
        series = all_series.get(series_id)
        if series and series["series_type"] in ["festival", "festival_program"]:
            class_festival_link[series["title"]].append(event["title"])
    
    print(f"\nFound {len(class_festival_link)} festival series with classes linked:\n")
    
    for series_title, event_titles in sorted(class_festival_link.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"Series: {series_title}")
        print(f"  Classes: {len(event_titles)}")
        print(f"  Examples: {', '.join(event_titles[:3])}")
        print()
    
    # ========================================================================
    # ISSUE 4: DECATUR CONTAMINATION
    # ========================================================================
    
    print("=" * 80)
    print("ISSUE 4: DECATUR FESTIVAL CONTAMINATION")
    print("=" * 80)
    
    decatur_festivals = ["decatur-arts-festival", "decatur-book-festival"]
    decatur_issues = []
    
    for festival_slug in decatur_festivals:
        festival_id = None
        festival_name = None
        
        for fid, festival in all_festivals.items():
            if festival.get("slug") == festival_slug:
                festival_id = fid
                festival_name = festival["name"]
                break
        
        if not festival_id:
            continue
        
        # Find series linked to this festival
        for series_id, series in all_series.items():
            if series.get("festival_id") != festival_id:
                continue
            
            events = events_by_series.get(series_id, [])
            venue_ids = set(e["venue_id"] for e in events if e.get("venue_id"))
            source_ids = set(e["source_id"] for e in events if e.get("source_id"))
            
            if len(venue_ids) > 5 or len(source_ids) > 2:
                source_slugs = [all_sources.get(sid, {}).get("slug", f"id:{sid}") for sid in source_ids]
                decatur_issues.append({
                    "festival_name": festival_name,
                    "series_title": series["title"],
                    "event_count": len(events),
                    "venue_count": len(venue_ids),
                    "source_count": len(source_ids),
                    "source_slugs": source_slugs,
                })
    
    print(f"\nFound {len(decatur_issues)} Decatur festival series with contamination:\n")
    
    for issue in decatur_issues:
        print(f"Festival: {issue['festival_name']}")
        print(f"  Series: {issue['series_title']}")
        print(f"  Events: {issue['event_count']}")
        print(f"  Venues: {issue['venue_count']}")
        print(f"  Sources: {issue['source_count']} - {', '.join(issue['source_slugs'])}")
        print()
    
    # ========================================================================
    # SUMMARY & RECOMMENDATIONS
    # ========================================================================
    
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Issue 1 (Event Absorption): {len(absorption_issues)} problematic festival series")
    print(f"Issue 2 (Aggregator Contamination): {len(aggregator_issues)} aggregator sources")
    print(f"Issue 3 (Classes in Festivals): {len(class_festival_link)} festival series with classes")
    print(f"Issue 4 (Decatur Contamination): {len(decatur_issues)} Decatur series issues")
    
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    
    print("\nHigh Priority Fixes:")
    
    # Most severe absorption issues
    if absorption_issues:
        severe = [i for i in absorption_issues if len(i["flags"]) >= 3]
        if severe:
            print(f"\n1. Unlink events from {len(severe)} severely contaminated festival series:")
            for issue in severe[:10]:
                print(f"   - {issue['series_title']}: {issue['event_count']} events")
                print(f"     Flags: {', '.join(issue['flags'])}")
                print(f"     Sources: {', '.join(issue['source_slugs'][:5])}")
    
    # Aggregator issues
    if aggregator_issues:
        total_events = sum(i["festival_events"] for i in aggregator_issues)
        print(f"\n2. Fix aggregator sources ({total_events} total events linked to festivals):")
        for issue in aggregator_issues:
            print(f"   - {issue['source_slug']}: {issue['festival_events']} events need unlinking")
    
    # Class contamination
    if class_festival_link:
        total_classes = sum(len(events) for events in class_festival_link.values())
        print(f"\n3. Remove {total_classes} classes from festival series")
    
    # Decatur
    if decatur_issues:
        print(f"\n4. Fix {len(decatur_issues)} Decatur festival series contamination")
    
    print("\n" + "=" * 80)
    print("END OF AUDIT")
    print("=" * 80)


if __name__ == "__main__":
    main()
