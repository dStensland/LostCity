"""
Venue Triage Script
Identifies and categorizes incomplete venues for cleanup.
"""

import re
import json
from dataclasses import dataclass
from typing import Optional
from db import get_client


@dataclass
class VenueTriage:
    id: int
    name: str
    slug: str
    neighborhood: Optional[str]
    spot_type: Optional[str]
    category: str  # 'real_venue', 'address_only', 'duplicate', 'needs_review'
    issue: str
    suggested_action: str
    event_count: int = 0


def is_address_like(name: str) -> bool:
    """Check if venue name looks like a street address."""
    patterns = [
        r'^\d+\s+[\w\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pkwy|Circle|Court|Ct|Place|Pl|Terrace|Ter)\b',
        r'^\d+\s+[NSEW]\.?\s+',  # 123 N. Main
        r'^\d{3,5}\s+\w+',  # Just starts with numbers
    ]
    for pattern in patterns:
        if re.search(pattern, name, re.IGNORECASE):
            return True
    return False


def is_generic_name(name: str) -> bool:
    """Check if venue name is too generic."""
    generic = [
        'private residence', 'private home', 'private event', 'private location',
        'tbd', 'tba', 'to be announced', 'location tbd',
        'online', 'virtual', 'zoom', 'webinar',
        'atlanta', 'georgia', 'atl',
    ]
    name_lower = name.lower().strip()
    return name_lower in generic or len(name_lower) < 3


def get_venue_event_count(client, venue_id: int) -> int:
    """Count upcoming events for a venue."""
    from datetime import date
    today = date.today().isoformat()
    result = client.table("events").select("id", count="exact").eq("venue_id", venue_id).gte("start_date", today).execute()
    return result.count or 0


def triage_venues(limit: int = None, include_all: bool = False) -> list[VenueTriage]:
    """
    Analyze venues and categorize them for cleanup.

    Args:
        limit: Max venues to analyze (None for all)
        include_all: If True, include venues that are already complete
    """
    client = get_client()

    # Query venues
    query = client.table("venues").select("*").eq("active", True).order("name")

    if not include_all:
        # Focus on incomplete venues
        query = query.or_("neighborhood.is.null,spot_type.is.null,spot_types.is.null")

    if limit:
        query = query.limit(limit)

    result = query.execute()
    venues = result.data or []

    triaged: list[VenueTriage] = []

    for venue in venues:
        triage = analyze_venue(client, venue)
        if triage:
            triaged.append(triage)

    # Sort by priority: address_only first (likely fixable), then needs_review
    priority = {'address_only': 0, 'real_venue': 1, 'needs_review': 2, 'duplicate': 3}
    triaged.sort(key=lambda x: (priority.get(x.category, 99), -x.event_count))

    return triaged


def analyze_venue(client, venue: dict) -> Optional[VenueTriage]:
    """Analyze a single venue and determine its category."""
    name = venue.get("name", "")
    slug = venue.get("slug", "")
    neighborhood = venue.get("neighborhood")
    spot_type = venue.get("spot_type")
    spot_types = venue.get("spot_types") or []
    vibes = venue.get("vibes") or []
    lat = venue.get("lat")
    lng = venue.get("lng")

    issues = []

    # Check for address-like names
    if is_address_like(name):
        event_count = get_venue_event_count(client, venue["id"])
        return VenueTriage(
            id=venue["id"],
            name=name,
            slug=slug,
            neighborhood=neighborhood,
            spot_type=spot_type,
            category="address_only",
            issue="Name looks like street address",
            suggested_action="Search Google Places to find actual venue name, or flag as address-only location",
            event_count=event_count
        )

    # Check for generic names
    if is_generic_name(name):
        return VenueTriage(
            id=venue["id"],
            name=name,
            slug=slug,
            neighborhood=neighborhood,
            spot_type=spot_type,
            category="needs_review",
            issue="Name is too generic or indicates virtual/TBD",
            suggested_action="Review events at this venue to determine if real or should be deleted",
            event_count=get_venue_event_count(client, venue["id"])
        )

    # Check for missing critical data
    if not neighborhood:
        issues.append("missing neighborhood")
    if not spot_type and not spot_types:
        issues.append("missing type")
    if not lat or not lng:
        issues.append("missing coordinates")

    if issues:
        return VenueTriage(
            id=venue["id"],
            name=name,
            slug=slug,
            neighborhood=neighborhood,
            spot_type=spot_type,
            category="real_venue",
            issue=", ".join(issues),
            suggested_action="Enrich via Google Places API",
            event_count=get_venue_event_count(client, venue["id"])
        )

    return None  # Venue is complete


def print_triage_report(triaged: list[VenueTriage]) -> None:
    """Print a formatted triage report."""
    print("\n" + "=" * 80)
    print("VENUE TRIAGE REPORT")
    print("=" * 80)

    # Summary by category
    categories = {}
    for t in triaged:
        categories[t.category] = categories.get(t.category, 0) + 1

    print(f"\nTotal venues needing attention: {len(triaged)}")
    for cat, count in sorted(categories.items()):
        print(f"  - {cat}: {count}")

    # Group by category
    for category in ['address_only', 'real_venue', 'needs_review', 'duplicate']:
        items = [t for t in triaged if t.category == category]
        if not items:
            continue

        print(f"\n\n{'─' * 80}")
        print(f"Category: {category.upper()} ({len(items)} venues)")
        print("─" * 80)

        for t in items[:20]:  # Show first 20
            print(f"\n  [{t.id}] {t.name}")
            print(f"      Neighborhood: {t.neighborhood or 'None'}")
            print(f"      Type: {t.spot_type or 'None'}")
            print(f"      Issue: {t.issue}")
            print(f"      Events: {t.event_count}")
            print(f"      Action: {t.suggested_action}")

        if len(items) > 20:
            print(f"\n  ... and {len(items) - 20} more")


def export_triage_json(triaged: list[VenueTriage], filename: str = "venue_triage.json") -> None:
    """Export triage results to JSON for further processing."""
    data = [
        {
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "neighborhood": t.neighborhood,
            "spot_type": t.spot_type,
            "category": t.category,
            "issue": t.issue,
            "suggested_action": t.suggested_action,
            "event_count": t.event_count
        }
        for t in triaged
    ]

    with open(filename, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\nExported triage results to {filename}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Triage venues for cleanup")
    parser.add_argument("--limit", type=int, help="Max venues to analyze")
    parser.add_argument("--all", action="store_true", help="Include all venues, not just incomplete")
    parser.add_argument("--export", action="store_true", help="Export results to JSON")
    parser.add_argument("--json-file", default="venue_triage.json", help="JSON output filename")

    args = parser.parse_args()

    print("Analyzing venues...")
    triaged = triage_venues(limit=args.limit, include_all=args.all)

    print_triage_report(triaged)

    if args.export:
        export_triage_json(triaged, args.json_file)
