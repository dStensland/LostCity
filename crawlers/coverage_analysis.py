#!/usr/bin/env python3
"""
Coverage analysis aligned to the live crawler data model.

Focuses on future active coverage, source yield, and destination hydration rather
than lifetime row counts. This keeps Atlanta quality work pointed at what users
can actually see now.
"""

from __future__ import annotations

import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Callable

from db import get_client
from source_goals import resolve_source_data_goals, source_has_event_feed_goal, source_is_destination_only

FIXED_HOURS_VENUE_TYPES = {
    "aquarium",
    "bar",
    "botanical_garden",
    "brewery",
    "cafe",
    "cinema",
    "food_hall",
    "gallery",
    "garden",
    "market",
    "museum",
    "restaurant",
    "zoo",
}

EVENT_LED_DESTINATION_TYPES = {
    "amphitheater",
    "amphitheatre",
    "arts_center",
    "comedy_club",
    "event_space",
    "music_venue",
    "performing_arts",
    "theater",
    "theatre",
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


def normalized_venue_type(venue: dict[str, Any]) -> str:
    return str(venue.get("place_type") or "").strip().lower()


def has_usable_hours(value: Any) -> bool:
    if not value:
        return False
    if isinstance(value, dict):
        for day in value.values():
            if not isinstance(day, dict):
                continue
            if day.get("open") or day.get("close"):
                return True
        return False
    return True


def analyze_coverage() -> None:
    """Generate coverage and hydration analysis."""
    client = get_client()
    today = date.today().isoformat()
    now = datetime.utcnow()
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    seven_days_ago = (now - timedelta(days=7)).isoformat()

    print("=" * 80)
    print("LOSTCITY COVERAGE GAP ANALYSIS")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Future coverage window starts: {today}")
    print("=" * 80)
    print()

    future_events = paged_select(
        client,
        "events",
        "id,source_id,place_id,category_id,content_kind,start_date,"
        "places(city,neighborhood,is_active)",
        query_builder=lambda q: q.eq("is_active", True).gte("start_date", today),
        order_column="start_date",
    )
    recent_events = paged_select(
        client,
        "events",
        "source_id,created_at",
        query_builder=lambda q: q.gte("created_at", thirty_days_ago),
        order_column="created_at",
    )
    active_sources = paged_select(
        client,
        "sources",
        "id,slug,name,owner_portal_id,last_crawled_at,expected_event_count,health_tags",
        query_builder=lambda q: q.eq("is_active", True),
    )
    active_venues = paged_select(
        client,
        "venues",
        "id,name,slug,city,neighborhood,venue_type,active,website,image_url,hours,lat,lng,"
        "location_designator,planning_notes,short_description,parking_note,transit_note",
        query_builder=lambda q: q.eq("is_active", True),
    )
    active_specials = paged_select(
        client,
        "place_specials",
        "id,place_id,places(city,is_active)",
        query_builder=lambda q: q.eq("is_active", True),
    )

    city_item_counts = defaultdict(int)
    city_event_counts = defaultdict(int)
    city_exhibit_counts = defaultdict(int)
    city_venue_counts = defaultdict(set)
    atlanta_neighborhood_counts = defaultdict(int)
    future_source_counts = defaultdict(int)
    future_active_venue_ids = set()

    for event in future_events:
        venue = event.get("venues") or {}
        city = venue.get("city")
        if city:
            city_item_counts[city] += 1
            if event.get("content_kind") == "exhibit":
                city_exhibit_counts[city] += 1
            else:
                city_event_counts[city] += 1
            if event.get("place_id"):
                city_venue_counts[city].add(event["place_id"])
        if city == "Atlanta" and venue.get("neighborhood"):
            atlanta_neighborhood_counts[venue["neighborhood"]] += 1
        if event.get("source_id"):
            future_source_counts[event["source_id"]] += 1
        if event.get("place_id"):
            future_active_venue_ids.add(event["place_id"])

    recent_source_counts = defaultdict(int)
    for event in recent_events:
        if event.get("source_id"):
            recent_source_counts[event["source_id"]] += 1

    venue_by_slug = {venue["slug"]: venue for venue in active_venues if venue.get("slug")}
    source_goal_summary = {}
    for source in active_sources:
        goals, goal_mode = resolve_source_data_goals(
            source.get("slug") or "",
            source_name=source.get("name") or "",
        )
        source_goal_summary[source["id"]] = {
            "goals": goals,
            "goal_mode": goal_mode,
            "event_feed": source_has_event_feed_goal(goals),
            "destination_only": source_is_destination_only(goals),
        }

    total_future_items = len(future_events)
    sorted_cities = sorted(city_item_counts.items(), key=lambda item: item[1], reverse=True)

    print("1. FUTURE ACTIVE ITEM DISTRIBUTION BY CITY")
    print("-" * 80)
    print(f"{'City':<24} {'Items':>7} {'Events':>8} {'Exhibits':>10} {'Venues':>8} {'% of Total':>11}")
    print("-" * 80)
    for city, count in sorted_cities[:20]:
        print(
            f"{city:<24} {count:>7} {city_event_counts[city]:>8} "
            f"{city_exhibit_counts[city]:>10} {len(city_venue_counts[city]):>8} "
            f"{pct(count, total_future_items):>10.1f}%"
        )
    print(f"\nTotal future active items: {total_future_items}")
    print()

    print("2. ATLANTA FUTURE COVERAGE BY NEIGHBORHOOD")
    print("-" * 80)
    print(f"{'Neighborhood':<30} {'Items':>8}")
    print("-" * 80)
    for hood, count in sorted(
        atlanta_neighborhood_counts.items(), key=lambda item: item[1], reverse=True
    )[:30]:
        print(f"{hood:<30} {count:>8}")
    print(f"\nAtlanta neighborhoods with future items: {len(atlanta_neighborhood_counts)}")
    print()

    print("3. ACTIVE SOURCE YIELD")
    print("-" * 80)
    zero_future_event_sources = []
    low_future_event_sources = []
    zero_future_destination_sources = []
    atlanta_owned_zero_event = 0

    for source in active_sources:
        future_count = future_source_counts.get(source["id"], 0)
        recent_count = recent_source_counts.get(source["id"], 0)
        goal_summary = source_goal_summary.get(source["id"], {})
        if goal_summary.get("destination_only"):
            if future_count == 0:
                zero_future_destination_sources.append((source, recent_count))
            continue
        if future_count == 0:
            zero_future_event_sources.append((source, recent_count))
            if source.get("owner_portal_id"):
                atlanta_owned_zero_event += 1
        elif future_count < 5:
            low_future_event_sources.append((source, future_count, recent_count))

    print(f"Active sources: {len(active_sources)}")
    print(
        f"Event-bearing active sources: "
        f"{sum(1 for summary in source_goal_summary.values() if summary.get('event_feed'))}"
    )
    print(
        f"Destination-first active sources: "
        f"{sum(1 for summary in source_goal_summary.values() if summary.get('destination_only'))}"
    )
    print(f"Event-bearing active sources with zero future items: {len(zero_future_event_sources)}")
    print(f"Event-bearing active sources with 1-4 future items: {len(low_future_event_sources)}")
    print(f"Destination-first active sources with zero future items: {len(zero_future_destination_sources)}")
    print(f"Portal-owned event-bearing active sources with zero future items: {atlanta_owned_zero_event}")
    print("\nTop zero-future event-bearing sources:")
    for source, recent_count in sorted(
        zero_future_event_sources,
        key=lambda item: (
            -(item[0].get("expected_event_count") or 0),
            item[0]["slug"],
        ),
    )[:20]:
        tags = ",".join(source.get("health_tags") or [])
        goal_summary = source_goal_summary.get(source["id"], {})
        print(
            f"  - {source['slug']}: {source['name']} "
            f"(recent_inserts_30d={recent_count}, expected={source.get('expected_event_count')}, "
            f"goals={','.join(goal_summary.get('goals') or []) or '-'}, tags={tags or '-'})"
        )
    print("\nTop low-yield event-bearing sources:")
    for source, future_count, recent_count in sorted(
        low_future_event_sources,
        key=lambda item: (item[1], item[0]["slug"]),
    )[:20]:
        goal_summary = source_goal_summary.get(source["id"], {})
        print(
            f"  - {source['slug']}: {source['name']} "
            f"(future_items={future_count}, recent_inserts_30d={recent_count}, "
            f"goals={','.join(goal_summary.get('goals') or []) or '-'})"
        )
    print("\nDestination-first sources to audit for metadata freshness:")
    for source, recent_count in sorted(
        zero_future_destination_sources,
        key=lambda item: item[0]["slug"],
    )[:20]:
        venue = venue_by_slug.get(source["slug"]) or {}
        metadata_bits = [
            f"hours={'y' if venue.get('hours') else 'n'}",
            f"image={'y' if venue.get('image_url') else 'n'}",
            f"website={'y' if venue.get('website') else 'n'}",
            f"planning={'y' if (venue.get('planning_notes') or '').strip() else 'n'}",
            f"parking={'y' if (venue.get('parking_note') or '').strip() else 'n'}",
            f"transit={'y' if (venue.get('transit_note') or '').strip() else 'n'}",
            f"blurb={'y' if (venue.get('short_description') or '').strip() else 'n'}",
        ]
        print(
            f"  - {source['slug']}: {source['name']} "
            f"(recent_inserts_30d={recent_count}, metadata={', '.join(metadata_bits)})"
        )
    print()

    print("4. FUTURE EVENT CATEGORY DISTRIBUTION")
    print("-" * 80)
    category_counts = Counter(
        event.get("category_id") or "uncategorized" for event in future_events
    )
    print(f"{'Category':<20} {'Items':>8} {'% of Total':>11}")
    print("-" * 80)
    for category, count in category_counts.most_common():
        print(f"{category:<20} {count:>8} {pct(count, total_future_items):>10.1f}%")
    print()

    print("5. ACTIVE ATLANTA DESTINATION HYDRATION")
    print("-" * 80)
    atlanta_venues = [venue for venue in active_venues if venue.get("city") == "Atlanta"]
    atlanta_active_venue_ids = {venue["id"] for venue in atlanta_venues}
    atlanta_special_venue_ids = {
        special["place_id"]
        for special in active_specials
        if (special.get("places") or {}).get("city") == "Atlanta"
        and (special.get("places") or {}).get("is_active") is not False
        and special.get("place_id") is not None
    }

    def _filled(field: str) -> int:
        if field == "hours":
            return sum(1 for venue in atlanta_venues if has_usable_hours(venue.get("hours")))
        return sum(1 for venue in atlanta_venues if venue.get(field))

    geo_filled = sum(
        1 for venue in atlanta_venues if venue.get("lat") is not None and venue.get("lng") is not None
    )
    planning_filled = sum(
        1 for venue in atlanta_venues if (venue.get("planning_notes") or "").strip()
    )
    fixed_hours_venues = [
        venue for venue in atlanta_venues if normalized_venue_type(venue) in FIXED_HOURS_VENUE_TYPES
    ]
    fixed_hours_filled = sum(1 for venue in fixed_hours_venues if has_usable_hours(venue.get("hours")))
    event_led_destinations = [
        venue
        for venue in atlanta_venues
        if normalized_venue_type(venue) in EVENT_LED_DESTINATION_TYPES
    ]
    event_led_planning_filled = sum(
        1 for venue in event_led_destinations if (venue.get("planning_notes") or "").strip()
    )

    print(f"Active Atlanta venues: {len(atlanta_venues)}")
    print(f"Atlanta venues with future items: {len(future_active_venue_ids & atlanta_active_venue_ids)}")
    print(f"Atlanta venues with zero future items: {len(atlanta_active_venue_ids - future_active_venue_ids)}")
    print(f"Website fill: {pct(_filled('website'), len(atlanta_venues))}%")
    print(f"Image fill: {pct(_filled('image_url'), len(atlanta_venues))}%")
    print(f"Hours fill: {pct(_filled('hours'), len(atlanta_venues))}%")
    print(
        f"Fixed-hours venue fill: {pct(fixed_hours_filled, len(fixed_hours_venues))}% "
        f"({fixed_hours_filled}/{len(fixed_hours_venues)})"
    )
    print(f"Neighborhood fill: {pct(_filled('neighborhood'), len(atlanta_venues))}%")
    print(f"Lat/Lng fill: {pct(geo_filled, len(atlanta_venues))}%")
    print(f"Planning notes fill: {pct(planning_filled, len(atlanta_venues))}%")
    print(
        f"Event-led destination planning fill: "
        f"{pct(event_led_planning_filled, len(event_led_destinations))}% "
        f"({event_led_planning_filled}/{len(event_led_destinations)})"
    )
    print(f"Venue specials coverage: {pct(len(atlanta_special_venue_ids), len(atlanta_venues))}% of active Atlanta venues")
    print()

    print("6. RECENT CRAWL ERRORS (LAST 7 DAYS)")
    print("-" * 80)
    errors = paged_select(
        client,
        "crawl_logs",
        "source_id,error_message,status,sources(slug,name),started_at",
        query_builder=lambda q: q.eq("status", "error").gte("started_at", seven_days_ago),
        order_column="started_at",
    )
    error_summary = defaultdict(list)
    for log in errors:
        source = log.get("sources") or {}
        slug = source.get("slug")
        if slug:
            error_summary[slug].append(log.get("error_message") or "")

    print(f"Sources with errors: {len(error_summary)}")
    for slug, messages in sorted(
        error_summary.items(), key=lambda item: len(item[1]), reverse=True
    )[:15]:
        print(f"\n  {slug}: {len(messages)} errors")
        for message in sorted(set(messages))[:3]:
            snippet = message[:100] + "..." if len(message) > 100 else message
            print(f"    - {snippet}")
    print()

    print("7. OVERALL STATISTICS")
    print("-" * 80)
    print(f"Future active items: {total_future_items}")
    print(f"Future active events: {sum(1 for event in future_events if event.get('content_kind') != 'exhibit')}")
    print(f"Future active exhibits: {sum(1 for event in future_events if event.get('content_kind') == 'exhibit')}")
    print(f"Active sources: {len(active_sources)}")
    print(f"Cities with future coverage: {len(sorted_cities)}")
    print(f"Active venues: {len(active_venues)}")
    print(f"Active venue_specials: {len(active_specials)}")
    print()


if __name__ == "__main__":
    try:
        analyze_coverage()
    except Exception as exc:
        print(f"Error during analysis: {exc}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)
