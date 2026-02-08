#!/usr/bin/env python
"""
Data Quality Health Check for LostCity Events Database

Generates comprehensive data quality metrics including:
- Overall stats (events, venues, sources)
- Field completeness rates
- Events by category
- Top sources by event count
- Sources with poorest data quality
- Venue completeness
"""

import sys
from datetime import datetime
from collections import defaultdict

# Add parent directory to path
sys.path.insert(0, '/Users/coach/Projects/LostCity/crawlers')

from db import get_client


def format_percentage(numerator, denominator):
    """Format a percentage with color coding."""
    if denominator == 0:
        return "N/A"
    pct = (numerator / denominator) * 100
    return f"{pct:.1f}%"


def get_overall_stats(client):
    """Get total counts for events, venues, and active sources."""
    # Total events
    events_result = client.table("events").select("id", count="exact").execute()
    total_events = events_result.count
    
    # Total venues
    venues_result = client.table("venues").select("id", count="exact").execute()
    total_venues = venues_result.count
    
    # Active sources
    sources_result = client.table("sources").select("id", count="exact").eq("is_active", True).execute()
    active_sources = sources_result.count
    
    return {
        "total_events": total_events,
        "total_venues": total_venues,
        "active_sources": active_sources
    }


def get_field_completeness(client, total_events):
    """Get field completeness rates across all events."""
    
    # We'll need to paginate through all events
    page_size = 1000
    offset = 0
    
    stats = {
        "has_category": 0,
        "has_start_time": 0,
        "has_rich_description": 0,  # >= 80 chars
        "has_image_url": 0,
        "has_ticket_url": 0,
        "fully_rich": 0  # all of: rich desc + image + ticket
    }
    
    print("Analyzing field completeness (this may take a moment)...", file=sys.stderr)
    
    while offset < total_events:
        result = client.table("events").select(
            "category, start_time, description, image_url, ticket_url"
        ).range(offset, offset + page_size - 1).execute()
        
        if not result.data:
            break
        
        for event in result.data:
            if event.get("category"):
                stats["has_category"] += 1
            
            if event.get("start_time"):
                stats["has_start_time"] += 1
            
            description = event.get("description") or ""
            has_rich_desc = len(description) >= 80
            if has_rich_desc:
                stats["has_rich_description"] += 1
            
            has_image = bool(event.get("image_url"))
            if has_image:
                stats["has_image_url"] += 1
            
            has_ticket = bool(event.get("ticket_url"))
            if has_ticket:
                stats["has_ticket_url"] += 1
            
            # Fully rich = all three
            if has_rich_desc and has_image and has_ticket:
                stats["fully_rich"] += 1
        
        offset += page_size
        print(f"  Processed {min(offset, total_events)}/{total_events} events...", file=sys.stderr)
    
    return stats


def get_events_by_category(client):
    """Get event counts per category."""
    # We need to paginate and count manually since we can't GROUP BY directly
    page_size = 1000
    offset = 0
    category_counts = defaultdict(int)
    
    print("Analyzing categories...", file=sys.stderr)
    
    # Get rough total
    count_result = client.table("events").select("id", count="exact").execute()
    total = count_result.count
    
    while True:
        result = client.table("events").select("category").range(offset, offset + page_size - 1).execute()
        
        if not result.data:
            break
        
        for event in result.data:
            cat = event.get("category") or "(no category)"
            category_counts[cat] += 1
        
        offset += page_size
        if offset >= total:
            break
    
    # Sort by count descending
    return sorted(category_counts.items(), key=lambda x: -x[1])


def get_top_sources_by_count(client):
    """Get top 10 sources by event count."""
    # Similar pagination approach
    page_size = 1000
    offset = 0
    source_counts = defaultdict(int)
    source_names = {}
    
    print("Analyzing source event counts...", file=sys.stderr)
    
    count_result = client.table("events").select("id", count="exact").execute()
    total = count_result.count
    
    while True:
        result = client.table("events").select("source_id").range(offset, offset + page_size - 1).execute()
        
        if not result.data:
            break
        
        for event in result.data:
            source_id = event.get("source_id")
            if source_id:
                source_counts[source_id] += 1
        
        offset += page_size
        if offset >= total:
            break
    
    # Get source names for top sources
    top_source_ids = sorted(source_counts.keys(), key=lambda x: -source_counts[x])[:10]
    for source_id in top_source_ids:
        result = client.table("sources").select("name, slug").eq("id", source_id).execute()
        if result.data:
            source_names[source_id] = result.data[0]
    
    return [(source_id, source_counts[source_id], source_names.get(source_id, {})) 
            for source_id in top_source_ids]


def get_poorest_quality_sources(client):
    """Get top 10 sources with highest percentage of incomplete events."""
    page_size = 1000
    offset = 0
    source_stats = defaultdict(lambda: {"total": 0, "missing_desc": 0, "missing_image": 0})
    source_names = {}
    
    print("Analyzing source quality...", file=sys.stderr)
    
    count_result = client.table("events").select("id", count="exact").execute()
    total = count_result.count
    
    while True:
        result = client.table("events").select(
            "source_id, description, image_url"
        ).range(offset, offset + page_size - 1).execute()
        
        if not result.data:
            break
        
        for event in result.data:
            source_id = event.get("source_id")
            if not source_id:
                continue
            
            source_stats[source_id]["total"] += 1
            
            description = event.get("description") or ""
            if len(description) < 80:
                source_stats[source_id]["missing_desc"] += 1
            
            if not event.get("image_url"):
                source_stats[source_id]["missing_image"] += 1
        
        offset += page_size
        if offset >= total:
            break
    
    # Calculate quality score (average of missing desc % and missing image %)
    source_quality = []
    for source_id, stats in source_stats.items():
        if stats["total"] < 5:  # Skip sources with very few events
            continue
        
        missing_desc_pct = (stats["missing_desc"] / stats["total"]) * 100
        missing_image_pct = (stats["missing_image"] / stats["total"]) * 100
        quality_score = (missing_desc_pct + missing_image_pct) / 2
        
        source_quality.append((source_id, stats, quality_score))
    
    # Sort by worst quality (highest score)
    source_quality.sort(key=lambda x: -x[2])
    
    # Get names for top 10 worst
    for source_id, stats, score in source_quality[:10]:
        result = client.table("sources").select("name, slug").eq("id", source_id).execute()
        if result.data:
            source_names[source_id] = result.data[0]
    
    return [(source_id, stats, score, source_names.get(source_id, {})) 
            for source_id, stats, score in source_quality[:10]]


def get_venue_stats(client):
    """Get venue completeness statistics."""
    total_result = client.table("venues").select("id", count="exact").execute()
    total_venues = total_result.count
    
    # Count venues with coordinates
    coords_result = client.table("venues").select("id", count="exact").not_.is_("lat", "null").not_.is_("lng", "null").execute()
    with_coords = coords_result.count
    
    return {
        "total": total_venues,
        "with_coords": with_coords,
        "missing_coords": total_venues - with_coords
    }


def print_report(stats):
    """Print formatted report to stdout."""
    print("=" * 80)
    print("LOSTCITY DATA QUALITY HEALTH CHECK")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Overall Stats
    print("OVERALL STATISTICS")
    print("-" * 80)
    print(f"Total Events:        {stats['overall']['total_events']:,}")
    print(f"Total Venues:        {stats['overall']['total_venues']:,}")
    print(f"Active Sources:      {stats['overall']['active_sources']:,}")
    print()
    
    # Field Completeness
    print("FIELD COMPLETENESS RATES")
    print("-" * 80)
    total = stats['overall']['total_events']
    comp = stats['completeness']
    
    print(f"Category (not null):             {comp['has_category']:,} / {total:,}  ({format_percentage(comp['has_category'], total)})")
    print(f"Start Time (not null):           {comp['has_start_time']:,} / {total:,}  ({format_percentage(comp['has_start_time'], total)})")
    print(f"Description (>= 80 chars):       {comp['has_rich_description']:,} / {total:,}  ({format_percentage(comp['has_rich_description'], total)})")
    print(f"Image URL (not null):            {comp['has_image_url']:,} / {total:,}  ({format_percentage(comp['has_image_url'], total)})")
    print(f"Ticket URL (not null):           {comp['has_ticket_url']:,} / {total:,}  ({format_percentage(comp['has_ticket_url'], total)})")
    print()
    print(f"FULLY RICH (desc + img + tix):   {comp['fully_rich']:,} / {total:,}  ({format_percentage(comp['fully_rich'], total)})")
    print()
    
    # Events by Category
    print("EVENTS BY CATEGORY")
    print("-" * 80)
    for category, count in stats['categories'][:15]:  # Top 15
        print(f"{category:30s}  {count:,}")
    print()
    
    # Top Sources
    print("TOP 10 SOURCES BY EVENT COUNT")
    print("-" * 80)
    for source_id, count, info in stats['top_sources']:
        name = info.get('name', f'Source {source_id}')
        slug = info.get('slug', '')
        print(f"{name:45s}  {count:,}  [{slug}]")
    print()
    
    # Poorest Quality Sources
    print("SOURCES WITH POOREST DATA QUALITY (Top 10)")
    print("-" * 80)
    print(f"{'Source':40s}  {'Events':>8s}  {'Missing Desc':>13s}  {'Missing Img':>12s}  {'Quality Score':>13s}")
    print("-" * 80)
    for source_id, source_stats, quality_score, info in stats['poor_quality']:
        name = info.get('name', f'Source {source_id}')[:39]
        total = source_stats['total']
        missing_desc_pct = (source_stats['missing_desc'] / total) * 100
        missing_img_pct = (source_stats['missing_image'] / total) * 100
        print(f"{name:40s}  {total:8,}  {missing_desc_pct:12.1f}%  {missing_img_pct:11.1f}%  {quality_score:12.1f}%")
    print()
    
    # Venue Stats
    print("VENUE COMPLETENESS")
    print("-" * 80)
    venue_stats = stats['venues']
    print(f"Total Venues:                {venue_stats['total']:,}")
    print(f"With Coordinates (lat/lng):  {venue_stats['with_coords']:,}  ({format_percentage(venue_stats['with_coords'], venue_stats['total'])})")
    print(f"Missing Coordinates:         {venue_stats['missing_coords']:,}  ({format_percentage(venue_stats['missing_coords'], venue_stats['total'])})")
    print()
    print("=" * 80)


def main():
    client = get_client()
    
    print("Starting data quality health check...", file=sys.stderr)
    print(file=sys.stderr)
    
    # Gather all statistics
    stats = {}
    
    # Overall stats
    stats['overall'] = get_overall_stats(client)
    
    # Field completeness
    stats['completeness'] = get_field_completeness(client, stats['overall']['total_events'])
    
    # Categories
    stats['categories'] = get_events_by_category(client)
    
    # Top sources
    stats['top_sources'] = get_top_sources_by_count(client)
    
    # Poor quality sources
    stats['poor_quality'] = get_poorest_quality_sources(client)
    
    # Venue stats
    stats['venues'] = get_venue_stats(client)
    
    print(file=sys.stderr)
    print("Analysis complete. Generating report...", file=sys.stderr)
    print(file=sys.stderr)
    
    # Print report
    print_report(stats)


if __name__ == "__main__":
    main()
