#!/usr/bin/env python3
"""
Festival Data Quality Analysis

Analyzes festival records and their linked events/series for data quality issues.
"""

import sys
from datetime import datetime, timedelta
from collections import defaultdict
from db import get_client

def analyze_festivals():
    """Run comprehensive festival data quality checks."""
    client = get_client()
    
    print("=" * 80)
    print("FESTIVAL DATA QUALITY ANALYSIS")
    print("=" * 80)
    print()

    # Fetch all festivals from the festivals table
    festivals_result = client.table("festivals").select("*").order("name").execute()
    festivals = festivals_result.data or []

    if not festivals:
        print("No festivals found in database.")
        return

    print(f"Total festivals found: {len(festivals)}\n")

    # Fetch all festival series (series linked to festivals)
    series_result = client.table("series").select(
        "id, title, series_type, description, image_url, festival_id, created_at"
    ).not_.is_("festival_id", "null").execute()

    series_list = series_result.data or []
    print(f"Total series linked to festivals: {len(series_list)}\n")

    # Build mapping of festival -> series
    festival_series = defaultdict(list)
    for series in series_list:
        festival_id = series.get("festival_id")
        if festival_id:
            festival_series[festival_id].append(series)

    # Fetch events for each series
    series_events = {}
    for series in series_list:
        event_result = client.table("events").select(
            "id, title, start_date, end_date, description, image_url, category"
        ).eq("series_id", series["id"]).execute()
        series_events[series["id"]] = event_result.data or []

    # Issue tracking
    issues = {
        "unreasonably_long": [],
        "confused_dates": [],
        "missing_description": [],
        "short_description": [],
        "no_series": [],
        "no_events": [],
        "missing_image": [],
        "missing_website": [],
        "events_outside_range": [],
        "past_with_future_end": [],
        "missing_dates": [],
    }

    today = datetime.now().date()

    # Analyze each festival
    for fest in festivals:
        fest_id = fest["id"]
        fest_name = fest["name"]

        # Date fields - check announced, pending, and last_year
        announced_start = fest.get("announced_start")
        announced_end = fest.get("announced_end")
        pending_start = fest.get("pending_start")
        pending_end = fest.get("pending_end")
        last_year_start = fest.get("last_year_start")
        last_year_end = fest.get("last_year_end")

        # Use the most appropriate date range for analysis
        start_date = announced_start or pending_start or last_year_start
        end_date = announced_end or pending_end or last_year_end

        description = fest.get("description") or ""
        image_url = fest.get("image_url")
        website = fest.get("website")
        festival_type = fest.get("festival_type")

        # Get series for this festival
        fest_series = festival_series.get(fest_id, [])

        # Get all events across all series for this festival
        all_events = []
        for series in fest_series:
            all_events.extend(series_events.get(series["id"], []))

        # Parse dates
        start = None
        end = None
        try:
            if start_date:
                start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except:
            pass

        try:
            if end_date:
                end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except:
            pass

        # Check 1: Missing dates entirely
        if not start_date and not end_date:
            issues["missing_dates"].append({
                "name": fest_name,
                "series_count": len(fest_series),
                "event_count": len(all_events)
            })

        # Check 2: Unreasonably long duration (>30 days unless it's a season/year-round)
        if start and end:
            duration = (end - start).days
            if duration > 30:
                issues["unreasonably_long"].append({
                    "name": fest_name,
                    "start": start_date,
                    "end": end_date,
                    "days": duration,
                    "type": festival_type
                })

        # Check 3: Confused dates (end before start)
        if start and end and end < start:
            issues["confused_dates"].append({
                "name": fest_name,
                "start": start_date,
                "end": end_date
            })

        # Check 4: Missing description
        if not description:
            issues["missing_description"].append({
                "name": fest_name,
                "series_count": len(fest_series),
                "event_count": len(all_events)
            })

        # Check 5: Very short description (<50 chars)
        elif len(description) < 50:
            issues["short_description"].append({
                "name": fest_name,
                "length": len(description),
                "desc": description[:100]
            })

        # Check 6: No linked series
        if len(fest_series) == 0:
            issues["no_series"].append({
                "name": fest_name,
                "dates": f"{start_date or 'N/A'} to {end_date or 'N/A'}"
            })

        # Check 7: No linked events (across all series)
        if len(all_events) == 0:
            issues["no_events"].append({
                "name": fest_name,
                "series_count": len(fest_series),
                "dates": f"{start_date or 'N/A'} to {end_date or 'N/A'}"
            })

        # Check 8: Missing image
        if not image_url:
            issues["missing_image"].append({
                "name": fest_name,
                "series_count": len(fest_series),
                "event_count": len(all_events)
            })

        # Check 9: Missing website
        if not website:
            issues["missing_website"].append({
                "name": fest_name,
                "series_count": len(fest_series),
                "event_count": len(all_events)
            })

        # Check 10: Events with dates outside festival range
        if start and end and all_events:
            for event in all_events:
                event_date_str = event.get("start_date")
                if event_date_str:
                    try:
                        event_date = datetime.strptime(event_date_str, "%Y-%m-%d").date()
                        if event_date < start or event_date > end:
                            issues["events_outside_range"].append({
                                "festival": fest_name,
                                "festival_range": f"{start_date} to {end_date}",
                                "event": event.get("title"),
                                "event_date": event_date_str
                            })
                    except:
                        pass

        # Check 11: Start date in past but end date far in future
        if start and end:
            if start < today and end > today + timedelta(days=30):
                issues["past_with_future_end"].append({
                    "name": fest_name,
                    "start": start_date,
                    "end": end_date,
                    "days_past": (today - start).days,
                    "days_future": (end - today).days
                })

    # Print summary table
    print("\n" + "=" * 80)
    print("FESTIVAL SUMMARY")
    print("=" * 80)
    print(f"{'Festival Name':<35} {'Start':<12} {'End':<12} {'Days':<6} {'Series':<8} {'Events':<8} {'Desc':<6} {'Img':<5}")
    print("-" * 80)

    for fest in festivals:
        fest_name = fest["name"][:33]

        # Use best available dates
        start_date = fest.get("announced_start") or fest.get("pending_start") or fest.get("last_year_start") or "N/A"
        end_date = fest.get("announced_end") or fest.get("pending_end") or fest.get("last_year_end") or "N/A"

        start_str = start_date[:10] if start_date != "N/A" else "N/A"
        end_str = end_date[:10] if end_date != "N/A" else "N/A"

        # Calculate duration
        days = "N/A"
        try:
            if start_date != "N/A" and end_date != "N/A":
                s = datetime.strptime(start_date, "%Y-%m-%d").date()
                e = datetime.strptime(end_date, "%Y-%m-%d").date()
                days = str((e - s).days)
        except:
            pass

        fest_series = festival_series.get(fest["id"], [])
        all_events = []
        for series in fest_series:
            all_events.extend(series_events.get(series["id"], []))

        series_count = len(fest_series)
        event_count = len(all_events)
        desc_len = len(fest.get("description") or "")
        has_img = "✓" if fest.get("image_url") else "✗"

        print(f"{fest_name:<35} {start_str:<12} {end_str:<12} {days:<6} {series_count:<8} {event_count:<8} {desc_len:<6} {has_img:<5}")

    # Print detailed issue reports
    print("\n\n" + "=" * 80)
    print("ISSUES FOUND")
    print("=" * 80)

    # Issue 0: Missing dates
    if issues["missing_dates"]:
        print(f"\n🚨 MISSING DATES ENTIRELY")
        print("-" * 80)
        for item in issues["missing_dates"][:10]:
            print(f"  • {item['name']}")
            print(f"    {item['series_count']} series, {item['event_count']} events")
        if len(issues["missing_dates"]) > 10:
            print(f"  ... and {len(issues['missing_dates']) - 10} more")
        print(f"\nTotal: {len(issues['missing_dates'])} festivals")

    # Issue 1: Unreasonably long festivals
    if issues["unreasonably_long"]:
        print(f"\n⚠️  UNREASONABLY LONG DURATION (>30 days)")
        print("-" * 80)
        for item in issues["unreasonably_long"]:
            print(f"  • {item['name']}")
            print(f"    Duration: {item['days']} days ({item['start']} to {item['end']})")
            print(f"    Type: {item.get('type') or 'N/A'}")
        print(f"\nTotal: {len(issues['unreasonably_long'])} festivals")

    # Issue 2: Confused dates
    if issues["confused_dates"]:
        print(f"\n🚨 CONFUSED START/END DATES (end before start)")
        print("-" * 80)
        for item in issues["confused_dates"]:
            print(f"  • {item['name']}: {item['start']} → {item['end']}")
        print(f"\nTotal: {len(issues['confused_dates'])} festivals")

    # Issue 3: Missing descriptions
    if issues["missing_description"]:
        print(f"\n📝 MISSING DESCRIPTIONS")
        print("-" * 80)
        for item in issues["missing_description"][:10]:
            print(f"  • {item['name']} ({item['series_count']} series, {item['event_count']} events)")
        if len(issues["missing_description"]) > 10:
            print(f"  ... and {len(issues['missing_description']) - 10} more")
        print(f"\nTotal: {len(issues['missing_description'])} festivals")

    # Issue 4: Short descriptions
    if issues["short_description"]:
        print(f"\n📄 VERY SHORT DESCRIPTIONS (<50 chars)")
        print("-" * 80)
        for item in issues["short_description"][:5]:
            print(f"  • {item['name']} ({item['length']} chars)")
            print(f"    \"{item['desc']}\"")
        if len(issues["short_description"]) > 5:
            print(f"  ... and {len(issues['short_description']) - 5} more")
        print(f"\nTotal: {len(issues['short_description'])} festivals")

    # Issue 5: No series
    if issues["no_series"]:
        print(f"\n🎭 FESTIVALS WITH NO SERIES")
        print("-" * 80)
        for item in issues["no_series"][:10]:
            print(f"  • {item['name']}")
            print(f"    Dates: {item['dates']}")
        if len(issues["no_series"]) > 10:
            print(f"  ... and {len(issues['no_series']) - 10} more")
        print(f"\nTotal: {len(issues['no_series'])} festivals")

    # Issue 6: No events
    if issues["no_events"]:
        print(f"\n🎪 FESTIVALS WITH ZERO EVENTS")
        print("-" * 80)
        for item in issues["no_events"][:10]:
            print(f"  • {item['name']} ({item['series_count']} series)")
            print(f"    Dates: {item['dates']}")
        if len(issues["no_events"]) > 10:
            print(f"  ... and {len(issues['no_events']) - 10} more")
        print(f"\nTotal: {len(issues['no_events'])} festivals")

    # Issue 7: Missing images
    if issues["missing_image"]:
        print(f"\n🖼️  MISSING IMAGES")
        print("-" * 80)
        for item in issues["missing_image"][:10]:
            print(f"  • {item['name']} ({item['series_count']} series, {item['event_count']} events)")
        if len(issues["missing_image"]) > 10:
            print(f"  ... and {len(issues['missing_image']) - 10} more")
        print(f"\nTotal: {len(issues['missing_image'])} festivals")

    # Issue 8: Missing website
    if issues["missing_website"]:
        print(f"\n🌐 MISSING FESTIVAL WEBSITE")
        print("-" * 80)
        for item in issues["missing_website"][:10]:
            print(f"  • {item['name']} ({item['series_count']} series, {item['event_count']} events)")
        if len(issues["missing_website"]) > 10:
            print(f"  ... and {len(issues['missing_website']) - 10} more")
        print(f"\nTotal: {len(issues['missing_website'])} festivals")

    # Issue 9: Events outside festival date range
    if issues["events_outside_range"]:
        print(f"\n📅 EVENTS OUTSIDE FESTIVAL DATE RANGE")
        print("-" * 80)
        for item in issues["events_outside_range"][:10]:
            print(f"  • Festival: {item['festival']}")
            print(f"    Festival range: {item['festival_range']}")
            print(f"    Event: {item['event']} ({item['event_date']})")
        if len(issues["events_outside_range"]) > 10:
            print(f"  ... and {len(issues['events_outside_range']) - 10} more")
        print(f"\nTotal: {len(issues['events_outside_range'])} events")

    # Issue 10: Past start with far future end
    if issues["past_with_future_end"]:
        print(f"\n⏰ PAST START DATE WITH FAR FUTURE END DATE")
        print("-" * 80)
        for item in issues["past_with_future_end"]:
            print(f"  • {item['name']}")
            print(f"    {item['start']} → {item['end']}")
            print(f"    ({item['days_past']} days past, {item['days_future']} days future)")
        print(f"\nTotal: {len(issues['past_with_future_end'])} festivals")

    # Overall statistics
    print("\n\n" + "=" * 80)
    print("OVERALL STATISTICS")
    print("=" * 80)

    total_festivals = len(festivals)
    total_series = len(series_list)
    total_events = sum(len(evts) for evts in series_events.values())
    avg_events_per_festival = total_events / total_festivals if total_festivals > 0 else 0
    avg_series_per_festival = total_series / total_festivals if total_festivals > 0 else 0

    with_desc = sum(1 for f in festivals if f.get("description"))
    with_img = sum(1 for f in festivals if f.get("image_url"))
    with_website = sum(1 for f in festivals if f.get("website"))
    with_dates = sum(1 for f in festivals if f.get("announced_start") or f.get("pending_start") or f.get("last_year_start"))

    print(f"Total festivals: {total_festivals}")
    print(f"Total series linked to festivals: {total_series}")
    print(f"Total events across all festival series: {total_events}")
    print(f"Average series per festival: {avg_series_per_festival:.1f}")
    print(f"Average events per festival: {avg_events_per_festival:.1f}")
    print(f"\nData completeness:")
    if total_festivals > 0:
        print(f"  • With dates: {with_dates}/{total_festivals} ({100*with_dates/total_festivals:.1f}%)")
        print(f"  • With description: {with_desc}/{total_festivals} ({100*with_desc/total_festivals:.1f}%)")
        print(f"  • With image: {with_img}/{total_festivals} ({100*with_img/total_festivals:.1f}%)")
        print(f"  • With website: {with_website}/{total_festivals} ({100*with_website/total_festivals:.1f}%)")
    else:
        print("  • No festivals to analyze")

    print("\n" + "=" * 80)
    print()

if __name__ == "__main__":
    try:
        analyze_festivals()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
