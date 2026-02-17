"""
Image Coverage Diagnostic
Analyzes events.image_url coverage by source and venue.
Identifies opportunities for image enrichment via crawlers or venue fallback.
"""

import logging
from datetime import datetime, date
from collections import defaultdict
from db import get_client

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def audit_source_coverage():
    """Query image coverage by source for upcoming events."""
    client = get_client()

    # Get all upcoming events with source info
    today = date.today().isoformat()
    result = client.table("events").select(
        "id, source_id, image_url, sources(id, name)"
    ).gte("start_date", today).execute()

    # Aggregate by source
    source_stats = defaultdict(lambda: {"total": 0, "with_image": 0, "name": ""})

    for event in result.data:
        source_id = event.get("source_id")
        if not source_id:
            continue

        source_name = event.get("sources", {}).get("name", "Unknown") if event.get("sources") else "Unknown"

        source_stats[source_id]["name"] = source_name
        source_stats[source_id]["total"] += 1
        if event.get("image_url"):
            source_stats[source_id]["with_image"] += 1

    # Convert to list format and filter by minimum volume
    sources = []
    for source_id, stats in source_stats.items():
        if stats["total"] >= 5:
            missing = stats["total"] - stats["with_image"]
            coverage = (stats["with_image"] / stats["total"] * 100) if stats["total"] > 0 else 0
            sources.append({
                "source_id": source_id,
                "source_name": stats["name"],
                "total_events": stats["total"],
                "with_image": stats["with_image"],
                "missing_image": missing,
                "coverage_pct": coverage
            })

    # Sort by missing count desc, then coverage asc
    sources.sort(key=lambda x: (-x["missing_image"], x["coverage_pct"]))
    return sources


def audit_venue_coverage():
    """Query venues with most imageless events and whether venue has image."""
    client = get_client()

    # Get all upcoming events without images, with venue info
    today = date.today().isoformat()
    result = client.table("events").select(
        "id, venue_id, venues(id, name, image_url)"
    ).gte("start_date", today).is_("image_url", "null").execute()

    # Aggregate by venue
    venue_stats = defaultdict(lambda: {"count": 0, "name": "", "has_image": False})

    for event in result.data:
        venue_id = event.get("venue_id")
        if not venue_id:
            continue

        venue_data = event.get("venues")
        if venue_data:
            venue_stats[venue_id]["name"] = venue_data.get("name", "Unknown")
            venue_stats[venue_id]["has_image"] = bool(venue_data.get("image_url"))

        venue_stats[venue_id]["count"] += 1

    # Convert to list format and filter by minimum volume
    venues = []
    for venue_id, stats in venue_stats.items():
        if stats["count"] >= 3:
            venues.append({
                "venue_id": venue_id,
                "venue_name": stats["name"],
                "venue_has_image": stats["has_image"],
                "imageless_event_count": stats["count"]
            })

    # Sort by count desc
    venues.sort(key=lambda x: -x["imageless_event_count"])
    return venues[:30]


def print_source_coverage(sources):
    """Print source coverage table."""
    print("\n" + "="*80)
    print("IMAGE COVERAGE BY SOURCE (Upcoming Events Only)")
    print("="*80)
    print(f"{'Source Name':<40} | {'Total':>6} | {'With':>6} | {'Miss':>6} | {'Cov%':>5}")
    print("-" * 80)
    
    for row in sources:
        name = row['source_name'][:39]
        total = row['total_events']
        with_img = row['with_image']
        missing = row['missing_image']
        coverage = row['coverage_pct']
        
        print(f"{name:<40} | {total:>6} | {with_img:>6} | {missing:>6} | {coverage:>5.1f}%")
    
    print("="*80)
    print(f"Total sources with 5+ upcoming events: {len(sources)}")


def print_venue_coverage(venues):
    """Print venue coverage split by whether venue has image."""
    with_venue_img = [v for v in venues if v['venue_has_image']]
    no_venue_img = [v for v in venues if not v['venue_has_image']]
    
    print("\n" + "="*80)
    print("TOP IMAGELESS VENUES (venue has image — events can use venue.image_url)")
    print("="*80)
    print(f"{'Venue Name':<50} | {'Events':>7}")
    print("-" * 80)
    
    for row in with_venue_img:
        name = row['venue_name'][:49]
        count = row['imageless_event_count']
        print(f"{name:<50} | {count:>7}")
    
    print("="*80)
    print(f"Total venues with image (can use as fallback): {len(with_venue_img)}")
    
    print("\n" + "="*80)
    print("TOP IMAGELESS VENUES (no venue image — need crawler or upload)")
    print("="*80)
    print(f"{'Venue Name':<50} | {'Events':>7}")
    print("-" * 80)
    
    for row in no_venue_img:
        name = row['venue_name'][:49]
        count = row['imageless_event_count']
        print(f"{name:<50} | {count:>7}")
    
    print("="*80)
    print(f"Total venues without image (need enrichment): {len(no_venue_img)}")


def print_summary_stats(sources, venues):
    """Print overall summary statistics."""
    total_events = sum(s["total_events"] for s in sources)
    total_with_image = sum(s["with_image"] for s in sources)
    total_missing = sum(s["missing_image"] for s in sources)
    overall_coverage = (total_with_image / total_events * 100) if total_events > 0 else 0

    sources_below_50 = [s for s in sources if s["coverage_pct"] < 50]
    sources_0_pct = [s for s in sources if s["coverage_pct"] == 0]

    with_venue_img = [v for v in venues if v['venue_has_image']]
    no_venue_img = [v for v in venues if not v['venue_has_image']]

    print("\n" + "="*80)
    print("SUMMARY STATISTICS")
    print("="*80)
    print(f"Total upcoming events analyzed: {total_events:,}")
    print(f"Events with images: {total_with_image:,} ({overall_coverage:.1f}%)")
    print(f"Events missing images: {total_missing:,} ({100 - overall_coverage:.1f}%)")
    print()
    print(f"Sources with <50% coverage: {len(sources_below_50)} of {len(sources)}")
    print(f"Sources with 0% coverage: {len(sources_0_pct)} of {len(sources)}")
    print()
    print(f"Venues with image available for fallback: {len(with_venue_img)}")
    print(f"Venues needing image enrichment: {len(no_venue_img)}")
    print("="*80)


def main():
    """Run image coverage audit."""
    logger.info("Starting image coverage audit...")
    logger.info(f"Run date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Source coverage
    sources = audit_source_coverage()
    print_source_coverage(sources)

    # Venue coverage
    venues = audit_venue_coverage()
    print_venue_coverage(venues)

    # Summary statistics
    print_summary_stats(sources, venues)

    print("\n" + "="*80)
    print("RECOMMENDATIONS")
    print("="*80)
    print("1. Sources with <50% coverage: Add image extraction to crawler")
    print("2. Venues with image + many imageless events: Update event insert to use venue fallback")
    print("3. Venues without image: Run scrape_venue_images.py or fetch_venue_photos_google.py")
    print("4. High-volume sources missing images: Prioritize OMDB/Spotify/API integrations")
    print()
    print("PRIORITY FIXES:")

    # Top 5 sources by missing count
    top_missing = sorted(sources, key=lambda x: -x["missing_image"])[:5]
    print("\nTop 5 sources by missing image count:")
    for s in top_missing:
        print(f"  - {s['source_name']}: {s['missing_image']} events ({s['coverage_pct']:.1f}% coverage)")

    print("="*80)


if __name__ == "__main__":
    main()


# USAGE:
# Run audit and view in terminal:
#   python3 crawlers/image_coverage_audit.py
#
# Save to file:
#   python3 crawlers/image_coverage_audit.py > IMAGE_COVERAGE_REPORT.txt 2>&1
#
# Quick stats only (suppress HTTP logs):
#   python3 crawlers/image_coverage_audit.py 2>/dev/null | tail -40
