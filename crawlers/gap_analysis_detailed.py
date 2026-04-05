#!/usr/bin/env python3
"""
Detailed gap analysis aligned to the live crawler data model.

This script is intentionally future-facing: it uses active future items rather
than lifetime totals so we prioritize what improves the Atlanta portal now.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime
from typing import Any, Callable

from db import get_client
from source_goals import resolve_source_data_goals, source_is_destination_only

# Expected ITP neighborhoods from web/config/neighborhoods.ts
ITP_NEIGHBORHOODS = [
    "Downtown",
    "Midtown",
    "Buckhead",
    "Old Fourth Ward",
    "East Atlanta Village",
    "Little Five Points",
    "Decatur",
    "West Midtown",
    "Ponce City Market Area",
    "Krog Street",
    "Virginia-Highland",
    "Inman Park",
    "Grant Park",
    "Cabbagetown",
    "Reynoldstown",
    "Kirkwood",
    "Candler Park",
    "Edgewood",
    "West End",
    "Atlantic Station",
    "Ansley Park",
    "Morningside",
    "Druid Hills",
    "East Lake",
    "Summerhill",
    "Lake Claire",
    "Ormewood Park",
    "Poncey-Highland",
    "Castleberry Hill",
    "Sweet Auburn",
    "Pittsburgh",
    "Mechanicsville",
    "Vine City",
    "English Avenue",
    "Grove Park",
    "Collier Hills",
    "Brookwood Hills",
    "Adair Park",
    "Capitol View",
    "Peoplestown",
]

EXPECTED_MAJOR_VENUES = {
    "State Farm Arena": "state-farm-arena",
    "Mercedes-Benz Stadium": "mercedes-benz-stadium",
    "Truist Park": "truist-park",
    "Gateway Center Arena": "gateway-center-arena",
    "Fox Theatre": "fox-theatre",
    "Coca-Cola Roxy": "coca-cola-roxy",
    "Tabernacle": "tabernacle",
    "Variety Playhouse": "variety-playhouse",
    "Terminal West": "terminal-west",
    "The Masquerade": "the-masquerade",
    "The Earl": "the-earl",
    "Center Stage": "center-stage",
    "Alliance Theatre": "alliance-theatre",
    "Aurora Theatre": "aurora-theatre",
    "Dad's Garage": "dads-garage",
    "Horizon Theatre": "horizon-theatre",
    "Actor's Express": "actors-express",
    "7 Stages": "seven-stages",
    "Shakespeare Tavern": "shakespeare-tavern",
    "High Museum": "high-museum",
    "Atlanta Botanical Garden": "atlanta-botanical-garden",
    "Fernbank Museum": "fernbank",
    "Atlanta History Center": "atlanta-history-center",
    "Children's Museum of Atlanta": "childrens-museum",
    "Center for Civil and Human Rights": "civil-rights-center",
    "World of Coca-Cola": "world-of-coca-cola",
    "Punchline Comedy Club": "punchline",
    "Laughing Skull Lounge": "laughing-skull",
    "Uptown Comedy Corner": "uptown-comedy",
    "Ameris Bank Amphitheatre": "ameris-bank-amphitheatre",
    "Cobb Energy Performing Arts Centre": "cobb-energy",
    "Gas South Arena": "gas-south",
    "City Springs Theatre": "city-springs",
    "Sandy Springs Performing Arts Center": "sandy-springs-pac",
}

OTP_CITIES = [
    {"name": "Alpharetta", "tier": "high", "notes": "Major dining/shopping destination"},
    {"name": "Roswell", "tier": "high", "notes": "Historic district, arts scene"},
    {"name": "Johns Creek", "tier": "medium", "notes": "Family-oriented, parks"},
    {"name": "Milton", "tier": "low", "notes": "Equestrian events, parks"},
    {"name": "Marietta", "tier": "high", "notes": "Historic square, theaters, museums"},
    {"name": "Smyrna", "tier": "medium", "notes": "Market Village, Battery Atlanta"},
    {"name": "Kennesaw", "tier": "medium", "notes": "KSU, Civil War history"},
    {"name": "Acworth", "tier": "low", "notes": "Historic downtown"},
    {"name": "Duluth", "tier": "high", "notes": "Downtown, Gas South Arena"},
    {"name": "Lawrenceville", "tier": "medium", "notes": "Historic square"},
    {"name": "Snellville", "tier": "low", "notes": "Community events"},
    {"name": "Suwanee", "tier": "medium", "notes": "Town Center, arts"},
    {"name": "Decatur", "tier": "high", "notes": "Major events hub, festivals"},
    {"name": "Tucker", "tier": "low", "notes": "Community events"},
    {"name": "Stone Mountain", "tier": "medium", "notes": "Park attractions"},
    {"name": "College Park", "tier": "medium", "notes": "Airport district, Gateway Center"},
    {"name": "East Point", "tier": "medium", "notes": "Arts district"},
    {"name": "Union City", "tier": "low", "notes": "Community events"},
    {"name": "Fairburn", "tier": "low", "notes": "Historic downtown"},
]

DISTRICT_HUB_SOURCES = {
    "The Works ATL": "the-works-atl",
    "The Interlock": "the-interlock",
    "Colony Square": "colony-square",
    "Chattahoochee Food Works": "chattahoochee-food-works",
    "Westside Motor Lounge": "westside-motor-lounge",
    "Underground Atlanta": "underground-atlanta",
    "Atlantic Station": "atlantic-station",
    "Pullman Yards": "pullman-yards",
}


def paged_select(
    client,
    table: str,
    fields: str,
    *,
    query_builder: Callable[[Any], Any] | None = None,
    page_size: int = 1000,
    order_column: str | None = "id",
) -> list[dict]:
    rows: list[dict] = []
    offset = 0

    while True:
        query = client.table(table).select(fields).range(offset, offset + page_size - 1)
        if query_builder:
            query = query_builder(query)
        if order_column:
            query = query.order(order_column)
        result = query.execute()
        batch = result.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    return rows


def pct(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def analyze_gaps() -> None:
    """Perform detailed gap analysis."""
    client = get_client()
    today = date.today().isoformat()

    print("=" * 80)
    print("LOSTCITY DETAILED GAP ANALYSIS")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Future coverage window starts: {today}")
    print("=" * 80)
    print()

    future_events = paged_select(
        client,
        "events",
        "id,source_id,venue_id,category_id,content_kind,start_date,"
        "venues(city,neighborhood,active)",
        query_builder=lambda q: q.eq("is_active", True).gte("start_date", today),
        order_column="start_date",
    )
    sources = paged_select(
        client,
        "sources",
        "id,slug,name,is_active,owner_portal_id,last_crawled_at",
    )
    source_by_slug = {source["slug"]: source for source in sources if source.get("slug")}
    source_goal_summary = {}
    for source in sources:
        goals, goal_mode = resolve_source_data_goals(
            source.get("slug") or "",
            source_name=source.get("name") or "",
        )
        source_goal_summary[source.get("slug")] = {
            "goals": goals,
            "goal_mode": goal_mode,
            "destination_only": source_is_destination_only(goals),
        }
    future_items_by_source = defaultdict(int)
    neighborhood_counts = defaultdict(int)
    city_counts = defaultdict(int)

    for event in future_events:
        if event.get("source_id"):
            future_items_by_source[event["source_id"]] += 1
        venue = event.get("venues") or {}
        if venue.get("is_active") is False:
            continue
        city = venue.get("city")
        if city:
            city_counts[city] += 1
        if city == "Atlanta" and venue.get("neighborhood"):
            neighborhood_counts[venue["neighborhood"]] += 1

    print("GAP ANALYSIS: ITP NEIGHBORHOODS")
    print("=" * 80)
    print()

    missing_tier1 = []
    missing_tier2 = []
    missing_tier3 = []
    low_tier1 = []
    low_tier2 = []

    for hood in ITP_NEIGHBORHOODS[:10]:
        count = neighborhood_counts.get(hood, 0)
        if count == 0:
            missing_tier1.append(hood)
        elif count < 10:
            low_tier1.append((hood, count))

    for hood in ITP_NEIGHBORHOODS[10:25]:
        count = neighborhood_counts.get(hood, 0)
        if count == 0:
            missing_tier2.append(hood)
        elif count < 5:
            low_tier2.append((hood, count))

    for hood in ITP_NEIGHBORHOODS[25:]:
        if neighborhood_counts.get(hood, 0) == 0:
            missing_tier3.append(hood)

    print("CRITICAL - Tier 1 (High Activity) Neighborhoods")
    print("-" * 80)
    if missing_tier1:
        print(f"MISSING ({len(missing_tier1)}):")
        for hood in missing_tier1:
            print(f"  - {hood}")
    if low_tier1:
        print("\nLOW COVERAGE (<10 future items):")
        for hood, count in low_tier1:
            print(f"  - {hood}: {count}")
    if not missing_tier1 and not low_tier1:
        print("  All Tier 1 neighborhoods have healthy future coverage.")
    print()

    print("HIGH - Tier 2 (Active) Neighborhoods")
    print("-" * 80)
    if missing_tier2:
        print(f"MISSING ({len(missing_tier2)}):")
        for hood in missing_tier2:
            print(f"  - {hood}")
    if low_tier2:
        print("\nLOW COVERAGE (<5 future items):")
        for hood, count in low_tier2:
            print(f"  - {hood}: {count}")
    print()

    print("MEDIUM - Tier 3 (Residential) Neighborhoods")
    print("-" * 80)
    if missing_tier3:
        print(f"MISSING ({len(missing_tier3)}):")
        for hood in missing_tier3:
            print(f"  - {hood}")
    else:
        print("  All Tier 3 neighborhoods have some future coverage.")
    print()

    print("GAP ANALYSIS: OTP CITIES")
    print("=" * 80)
    print()
    high_missing = []
    low_city_coverage = []
    for city_info in OTP_CITIES:
        city = city_info["name"]
        count = city_counts.get(city, 0)
        if city_info["tier"] == "high" and count < 10:
            if count == 0:
                high_missing.append((city, city_info["notes"]))
            else:
                low_city_coverage.append((city, count, city_info["notes"]))
        elif city_info["tier"] == "medium" and count < 5:
            low_city_coverage.append((city, count, city_info["notes"]))

    print("CRITICAL - High-tier cities with low future coverage")
    print("-" * 80)
    if high_missing:
        print("MISSING:")
        for city, notes in high_missing:
            print(f"  - {city}: {notes}")
    if low_city_coverage:
        print("\nLOW COVERAGE:")
        for city, count, notes in low_city_coverage:
            print(f"  - {city}: {count} future items - {notes}")
    print()

    print("GAP ANALYSIS: MAJOR VENUE SOURCES")
    print("=" * 80)
    print()
    missing_sources = []
    inactive_sources = []
    low_yield_sources = []
    destination_first_major_sources = []

    {source["id"]: source for source in sources if source.get("id") is not None}
    for venue_name, expected_slug in EXPECTED_MAJOR_VENUES.items():
        source = source_by_slug.get(expected_slug)
        if not source:
            missing_sources.append((venue_name, expected_slug))
            continue
        goal_summary = source_goal_summary.get(expected_slug) or {}
        future_items = future_items_by_source.get(source["id"], 0)
        if goal_summary.get("destination_only"):
            destination_first_major_sources.append(
                (venue_name, expected_slug, source.get("is_active"), future_items, goal_summary.get("goals") or [])
            )
            continue
        if not source.get("is_active"):
            inactive_sources.append((venue_name, expected_slug))
            continue
        if future_items < 3:
            low_yield_sources.append((venue_name, expected_slug, future_items))

    if missing_sources:
        print("MISSING SOURCE RECORDS OR CRAWLERS:")
        print("-" * 80)
        for venue_name, slug in missing_sources:
            print(f"  - {venue_name} ({slug})")
        print()

    if inactive_sources:
        print("INACTIVE MAJOR VENUE SOURCES:")
        print("-" * 80)
        for venue_name, slug in inactive_sources:
            print(f"  - {venue_name} ({slug})")
        print()

    if low_yield_sources:
        print("LOW-YIELD ACTIVE MAJOR VENUE SOURCES (<3 FUTURE ITEMS):")
        print("-" * 80)
        for venue_name, slug, future_items in sorted(low_yield_sources, key=lambda item: item[2]):
            print(f"  - {venue_name} ({slug}): {future_items}")
        print()

    if destination_first_major_sources:
        print("DESTINATION-FIRST MAJOR VENUES (NOT JUDGED ON FUTURE ITEMS):")
        print("-" * 80)
        for venue_name, slug, is_active, future_items, goals in sorted(
            destination_first_major_sources,
            key=lambda item: item[0],
        ):
            status = "active" if is_active else "inactive"
            print(
                f"  - {venue_name} ({slug}): {status}, future_items={future_items}, "
                f"goals={','.join(goals) or '-'}"
            )
        print()

    print("GAP ANALYSIS: DISTRICT HUB SOURCES")
    print("=" * 80)
    print()
    for label, slug in DISTRICT_HUB_SOURCES.items():
        source = source_by_slug.get(slug)
        if not source:
            print(f"  - {label}: missing source ({slug})")
            continue
        future_items = future_items_by_source.get(source["id"], 0)
        status = "active" if source.get("is_active") else "inactive"
        print(f"  - {label}: {status}, future_items={future_items}")
    print()

    print("GAP ANALYSIS: FUTURE CATEGORY MIX")
    print("=" * 80)
    print()
    category_counts = Counter(
        event.get("category_id") or "uncategorized" for event in future_events
    )
    total_future = len(future_events)
    print("Category Distribution:")
    print("-" * 80)
    for category, count in category_counts.most_common():
        status = "LOW" if pct(count, total_future) < 5 else "OK"
        print(f"  {category:<16} {count:>5} items ({pct(count, total_future):>5.1f}%) [{status}]")
    print()

    print("UNDERREPRESENTED CATEGORIES (<5% OF FUTURE ITEMS):")
    for category, count in sorted(category_counts.items(), key=lambda item: item[1]):
        if category == "uncategorized":
            continue
        if pct(count, total_future) < 5:
            print(f"  - {category}: {count}")
    print()

    print("PRIORITIZED GAPS TO FILL")
    print("=" * 80)
    print()
    print("CRITICAL PRIORITY:")
    print("-" * 80)
    if inactive_sources:
        print(f"1. Reactivate or replace {len(inactive_sources)} inactive major venue sources")
    if missing_tier1:
        print(f"2. Fix future coverage for {len(missing_tier1)} Tier 1 Atlanta neighborhoods")
    if high_missing:
        print(f"3. Add or improve high-tier OTP coverage in {len(high_missing)} cities")
    print()

    print("HIGH PRIORITY:")
    print("-" * 80)
    if low_yield_sources:
        print(f"1. Repair {len(low_yield_sources)} low-yield active major venue sources")
    district_inactive = [
        slug
        for slug in DISTRICT_HUB_SOURCES.values()
        if (source_by_slug.get(slug) or {}).get("is_active") is False
    ]
    if district_inactive:
        print(f"2. Activate district hub sources for {len(district_inactive)} neighborhood anchors")
    if missing_tier2:
        print(f"3. Add coverage for {len(missing_tier2)} Tier 2 neighborhoods")
    print()

    print("MEDIUM PRIORITY:")
    print("-" * 80)
    print("1. Normalize neighborhood attribution for zero-item districts before adding more crawlers")
    if destination_first_major_sources:
        print(
            f"2. Refresh destination intelligence for {len(destination_first_major_sources)} "
            "destination-first major venues"
        )
        print("3. Rebalance underrepresented future categories with direct-source crawlers")
    else:
        print("2. Rebalance underrepresented future categories with direct-source crawlers")
    print()


if __name__ == "__main__":
    analyze_gaps()
