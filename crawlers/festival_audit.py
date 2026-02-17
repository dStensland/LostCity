"""
Festival Data Integrity Audit

Comprehensive diagnostic to identify systemic issues with festival series data:
1. Event absorption (unrelated events linked to festivals)
2. Festival vs regular series confusion
3. Festival program integrity
4. Source-level contamination
5. Specific known issues (Decatur, aggregators, classes)
"""

import sys
from datetime import datetime, timedelta
from collections import defaultdict
from difflib import SequenceMatcher
from db import get_client


def similarity_ratio(a: str, b: str) -> float:
    """Calculate string similarity ratio (0.0 to 1.0)."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def calculate_title_overlap(event_titles: list[str], festival_name: str) -> float:
    """Calculate average word overlap between event titles and festival name."""
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


def audit_festival_event_absorption(client):
    """
    Audit Issue 1: Festival Event Absorption
    Detect festivals that have absorbed unrelated events.
    """
    print("\n" + "=" * 80)
    print("ISSUE 1: FESTIVAL EVENT ABSORPTION")
    print("=" * 80)
    
    # Get all festival and festival_program series
    result = client.table("series")\
        .select("id, title, series_type, festival_id")\
        .in_("series_type", ["festival", "festival_program"])\
        .execute()
    
    festival_series = result.data or []
    
    issues = []
    
    for series in festival_series:
        series_id = series["id"]
        series_title = series["title"]
        series_type = series["series_type"]
        
        # Get all events for this series
        events_result = client.table("events")\
            .select("id, title, venue_id, source_id, category, start_date, is_class")\
            .eq("series_id", series_id)\
            .execute()
        
        events = events_result.data or []
        
        if not events:
            continue
        
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
        
        # Count classes linked to festivals
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
            issues.append({
                "series_id": series_id,
                "series_title": series_title,
                "series_type": series_type,
                "event_count": len(events),
                "venue_count": len(venue_ids),
                "source_count": len(source_ids),
                "category_count": len(categories),
                "categories": list(categories),
                "date_spread_days": date_spread_days,
                "title_overlap": title_overlap,
                "class_count": class_count,
                "flags": flags,
                "source_ids": list(source_ids),
            })
    
    # Sort by severity (most flags first, then most events)
    issues.sort(key=lambda x: (len(x["flags"]), x["event_count"]), reverse=True)
    
    print(f"\nFound {len(issues)} problematic festival series:\n")
    
    for issue in issues:
        print(f"Series: {issue['series_title']} ({issue['series_type']})")
        print(f"  Series ID: {issue['series_id']}")
        print(f"  Events: {issue['event_count']}")
        print(f"  Venues: {issue['venue_count']}")
        print(f"  Sources: {issue['source_count']} - IDs: {issue['source_ids']}")
        print(f"  Categories: {issue['category_count']} - {issue['categories']}")
        print(f"  Date spread: {issue['date_spread_days']} days")
        print(f"  Title overlap: {issue['title_overlap']:.2%}")
        if issue['class_count'] > 0:
            print(f"  Classes: {issue['class_count']}")
        print(f"  FLAGS: {', '.join(issue['flags'])}")
        print()
    
    return issues


def audit_festival_vs_regular_series(client):
    """
    Audit Issue 2: Festival vs Regular Series Confusion
    Detect series marked as festival that should be other types.
    """
    print("\n" + "=" * 80)
    print("ISSUE 2: FESTIVAL VS REGULAR SERIES CONFUSION")
    print("=" * 80)
    
    # Get all series marked as festival
    result = client.table("series")\
        .select("id, title, series_type")\
        .eq("series_type", "festival")\
        .execute()
    
    festival_series = result.data or []
    
    issues = []
    
    # Patterns that indicate NOT a festival
    recurring_patterns = [
        r"every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
        r"(weekly|monthly|daily)",
        r"open mic",
        r"trivia night",
        r"karaoke",
        r"happy hour",
    ]
    
    class_patterns = [
        r"class",
        r"workshop",
        r"lesson",
        r"training",
        r"course",
    ]
    
    venue_calendar_patterns = [
        r"events at",
        r"calendar",
        r"schedule",
    ]
    
    import re
    
    for series in festival_series:
        title = series["title"].lower()
        flags = []
        suggested_type = None
        
        for pattern in recurring_patterns:
            if re.search(pattern, title):
                flags.append("LOOKS_LIKE_RECURRING_SHOW")
                suggested_type = "recurring_show"
                break
        
        for pattern in class_patterns:
            if re.search(pattern, title):
                flags.append("LOOKS_LIKE_CLASS_SERIES")
                suggested_type = "class_series"
                break
        
        for pattern in venue_calendar_patterns:
            if re.search(pattern, title):
                flags.append("LOOKS_LIKE_VENUE_CALENDAR")
                suggested_type = None  # Should not be series at all
                break
        
        # Generic names that could match anything
        if len(title.split()) <= 2 and not any(word in title for word in ["fest", "festival", "con", "convention"]):
            flags.append("GENERIC_NAME")
        
        if flags:
            issues.append({
                "series_id": series["id"],
                "series_title": series["title"],
                "flags": flags,
                "suggested_type": suggested_type,
            })
    
    print(f"\nFound {len(issues)} festival series that may be misclassified:\n")
    
    for issue in issues:
        print(f"Series: {issue['series_title']}")
        print(f"  Series ID: {issue['series_id']}")
        print(f"  FLAGS: {', '.join(issue['flags'])}")
        if issue['suggested_type']:
            print(f"  Suggested type: {issue['suggested_type']}")
        print()
    
    return issues


def audit_festival_program_integrity(client):
    """
    Audit Issue 3: Festival Program Integrity
    Verify festival_program series are properly linked and their events belong.
    """
    print("\n" + "=" * 80)
    print("ISSUE 3: FESTIVAL PROGRAM INTEGRITY")
    print("=" * 80)
    
    # Get all festival_program series
    result = client.table("series")\
        .select("id, title, festival_id")\
        .eq("series_type", "festival_program")\
        .execute()
    
    programs = result.data or []
    
    issues = []
    
    for program in programs:
        flags = []
        
        # Check if festival_id is set
        if not program.get("festival_id"):
            flags.append("NO_PARENT_FESTIVAL")
        else:
            # Verify parent festival exists
            parent_result = client.table("festivals")\
                .select("id, name")\
                .eq("id", program["festival_id"])\
                .execute()
            
            if not parent_result.data:
                flags.append("PARENT_FESTIVAL_MISSING")
        
        if flags:
            issues.append({
                "series_id": program["id"],
                "series_title": program["title"],
                "festival_id": program.get("festival_id"),
                "flags": flags,
            })
    
    print(f"\nFound {len(issues)} festival_program series with issues:\n")
    
    for issue in issues:
        print(f"Program: {issue['series_title']}")
        print(f"  Series ID: {issue['series_id']}")
        print(f"  Festival ID: {issue.get('festival_id', 'NULL')}")
        print(f"  FLAGS: {', '.join(issue['flags'])}")
        print()
    
    return issues


def audit_source_contamination(client):
    """
    Audit Issue 4: Source-Level Contamination
    Identify sources where too many events are linked to festivals.
    """
    print("\n" + "=" * 80)
    print("ISSUE 4: SOURCE-LEVEL CONTAMINATION")
    print("=" * 80)
    
    # Get all events grouped by source
    result = client.table("events")\
        .select("id, source_id, series_id, title")\
        .not_.is_("series_id", "null")\
        .execute()
    
    events = result.data or []
    
    # Build source stats
    source_stats = defaultdict(lambda: {
        "total_events": 0,
        "festival_events": 0,
        "festival_series": set(),
    })
    
    for event in events:
        source_id = event.get("source_id")
        series_id = event.get("series_id")
        
        if not source_id:
            continue
        
        source_stats[source_id]["total_events"] += 1
        
        if series_id:
            # Check if this series is a festival or festival_program
            series_result = client.table("series")\
                .select("series_type, title")\
                .eq("id", series_id)\
                .execute()
            
            if series_result.data:
                series_type = series_result.data[0].get("series_type")
                series_title = series_result.data[0].get("title")
                
                if series_type in ["festival", "festival_program"]:
                    source_stats[source_id]["festival_events"] += 1
                    source_stats[source_id]["festival_series"].add(series_title)
    
    # Get source names
    source_names = {}
    for source_id in source_stats.keys():
        result = client.table("sources")\
            .select("id, slug, name")\
            .eq("id", source_id)\
            .execute()
        if result.data:
            source_names[source_id] = {
                "slug": result.data[0].get("slug"),
                "name": result.data[0].get("name"),
            }
    
    issues = []
    
    for source_id, stats in source_stats.items():
        total = stats["total_events"]
        festival = stats["festival_events"]
        
        if total == 0:
            continue
        
        festival_pct = festival / total
        
        flags = []
        
        if festival_pct > 0.5:
            flags.append(f"HIGH_FESTIVAL_PCT({festival_pct:.0%})")
        
        if festival_pct == 1.0 and total > 10:
            flags.append("ALL_EVENTS_FESTIVAL")
        
        if flags:
            source_info = source_names.get(source_id, {})
            issues.append({
                "source_id": source_id,
                "source_slug": source_info.get("slug", "unknown"),
                "source_name": source_info.get("name", "unknown"),
                "total_events": total,
                "festival_events": festival,
                "festival_pct": festival_pct,
                "festival_series": list(stats["festival_series"]),
                "flags": flags,
            })
    
    # Sort by festival percentage descending
    issues.sort(key=lambda x: x["festival_pct"], reverse=True)
    
    print(f"\nFound {len(issues)} sources with high festival linkage:\n")
    
    for issue in issues:
        print(f"Source: {issue['source_name']} ({issue['source_slug']})")
        print(f"  Source ID: {issue['source_id']}")
        print(f"  Events: {issue['festival_events']}/{issue['total_events']} ({issue['festival_pct']:.0%}) linked to festivals")
        print(f"  Festival series: {', '.join(issue['festival_series'][:5])}")
        if len(issue['festival_series']) > 5:
            print(f"  ... and {len(issue['festival_series']) - 5} more")
        print(f"  FLAGS: {', '.join(issue['flags'])}")
        print()
    
    return issues


def audit_specific_issues(client):
    """
    Audit Issue 5: Specific Known Issues
    Check for Decatur contamination, aggregator issues, classes in festivals.
    """
    print("\n" + "=" * 80)
    print("ISSUE 5: SPECIFIC KNOWN ISSUES")
    print("=" * 80)
    
    issues = []
    
    # Issue 5a: Decatur festivals absorbing all Decatur events
    print("\n5a. Decatur Festival Contamination:")
    decatur_festivals = ["decatur-arts-festival", "decatur-book-festival"]
    
    for festival_slug in decatur_festivals:
        # Find the festival
        festival_result = client.table("festivals")\
            .select("id, name")\
            .eq("slug", festival_slug)\
            .execute()
        
        if not festival_result.data:
            continue
        
        festival_id = festival_result.data[0]["id"]
        festival_name = festival_result.data[0]["name"]
        
        # Find series linked to this festival
        series_result = client.table("series")\
            .select("id, title")\
            .eq("festival_id", festival_id)\
            .execute()
        
        for series in series_result.data or []:
            series_id = series["id"]
            
            # Get events and check venues
            events_result = client.table("events")\
                .select("id, title, venue_id, source_id")\
                .eq("series_id", series_id)\
                .execute()
            
            events = events_result.data or []
            venue_ids = set(e["venue_id"] for e in events if e.get("venue_id"))
            source_ids = set(e["source_id"] for e in events if e.get("source_id"))
            
            if len(venue_ids) > 5 or len(source_ids) > 2:
                issues.append({
                    "type": "DECATUR_CONTAMINATION",
                    "festival_name": festival_name,
                    "series_title": series["title"],
                    "event_count": len(events),
                    "venue_count": len(venue_ids),
                    "source_count": len(source_ids),
                })
                print(f"  {festival_name} / {series['title']}: {len(events)} events, {len(venue_ids)} venues, {len(source_ids)} sources")
    
    # Issue 5b: Aggregator contamination (Ticketmaster, Eventbrite)
    print("\n5b. Aggregator Contamination:")
    aggregator_slugs = ["ticketmaster", "eventbrite", "dice"]
    
    for slug in aggregator_slugs:
        source_result = client.table("sources")\
            .select("id, name")\
            .eq("slug", slug)\
            .execute()
        
        if not source_result.data:
            continue
        
        source_id = source_result.data[0]["id"]
        source_name = source_result.data[0]["name"]
        
        # Find events from this source linked to festival series
        events_result = client.table("events")\
            .select("id, series_id")\
            .eq("source_id", source_id)\
            .not_.is_("series_id", "null")\
            .execute()
        
        events = events_result.data or []
        
        if not events:
            continue
        
        # Check if any are festival series
        festival_linked = 0
        festival_series_set = set()
        
        for event in events:
            series_id = event.get("series_id")
            if not series_id:
                continue
            
            series_result = client.table("series")\
                .select("series_type, title")\
                .eq("id", series_id)\
                .execute()
            
            if series_result.data:
                series_type = series_result.data[0].get("series_type")
                series_title = series_result.data[0].get("title")
                
                if series_type in ["festival", "festival_program"]:
                    festival_linked += 1
                    festival_series_set.add(series_title)
        
        if festival_linked > 0:
            issues.append({
                "type": "AGGREGATOR_CONTAMINATION",
                "source_name": source_name,
                "festival_events": festival_linked,
                "festival_series": list(festival_series_set),
            })
            print(f"  {source_name}: {festival_linked} events linked to {len(festival_series_set)} festival series")
            print(f"    Series: {', '.join(list(festival_series_set)[:5])}")
    
    # Issue 5c: Classes linked to festivals
    print("\n5c. Classes Linked to Festivals:")
    
    result = client.table("events")\
        .select("id, title, series_id")\
        .eq("is_class", True)\
        .not_.is_("series_id", "null")\
        .execute()
    
    class_events = result.data or []
    
    class_festival_link = defaultdict(list)
    
    for event in class_events:
        series_id = event.get("series_id")
        if not series_id:
            continue
        
        series_result = client.table("series")\
            .select("series_type, title")\
            .eq("id", series_id)\
            .execute()
        
        if series_result.data:
            series_type = series_result.data[0].get("series_type")
            series_title = series_result.data[0].get("title")
            
            if series_type in ["festival", "festival_program"]:
                class_festival_link[series_title].append(event["title"])
    
    for series_title, event_titles in class_festival_link.items():
        issues.append({
            "type": "CLASS_IN_FESTIVAL",
            "series_title": series_title,
            "class_count": len(event_titles),
        })
        print(f"  {series_title}: {len(event_titles)} classes linked")
        print(f"    Examples: {', '.join(event_titles[:3])}")
    
    return issues


def main():
    """Run all audits."""
    print("\n" + "=" * 80)
    print("FESTIVAL DATA INTEGRITY AUDIT")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    client = get_client()
    
    # Run all audits
    absorption_issues = audit_festival_event_absorption(client)
    confusion_issues = audit_festival_vs_regular_series(client)
    program_issues = audit_festival_program_integrity(client)
    contamination_issues = audit_source_contamination(client)
    specific_issues = audit_specific_issues(client)
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Issue 1 (Event Absorption): {len(absorption_issues)} problematic festival series")
    print(f"Issue 2 (Misclassification): {len(confusion_issues)} festivals that may be other types")
    print(f"Issue 3 (Program Integrity): {len(program_issues)} festival programs with issues")
    print(f"Issue 4 (Source Contamination): {len(contamination_issues)} sources with high festival linkage")
    print(f"Issue 5 (Specific Issues): {len(specific_issues)} specific problems detected")
    
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    
    print("\nHigh Priority Fixes:")
    
    # Festivals with most severe issues
    if absorption_issues:
        severe = [i for i in absorption_issues if len(i["flags"]) >= 3]
        if severe:
            print(f"\n1. Unlink events from {len(severe)} severely contaminated festival series:")
            for issue in severe[:10]:
                print(f"   - {issue['series_title']}: {issue['event_count']} events, flags: {', '.join(issue['flags'])}")
    
    # Aggregator issues
    aggregator_issues = [i for i in specific_issues if i.get("type") == "AGGREGATOR_CONTAMINATION"]
    if aggregator_issues:
        print(f"\n2. Fix {len(aggregator_issues)} aggregator sources linking to festivals")
        for issue in aggregator_issues:
            print(f"   - {issue['source_name']}: {issue['festival_events']} events need unlinking")
    
    # Misclassified festivals
    if confusion_issues:
        print(f"\n3. Reclassify {len(confusion_issues)} festival series:")
        for issue in confusion_issues[:5]:
            print(f"   - {issue['series_title']} -> {issue.get('suggested_type', 'DELETE')}")
    
    print("\n" + "=" * 80)
    print("END OF AUDIT")
    print("=" * 80)


if __name__ == "__main__":
    main()
