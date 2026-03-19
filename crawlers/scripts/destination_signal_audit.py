#!/usr/bin/env python3
"""
Destination signal audit focused on product-critical venue quality.

This complements crawl reliability metrics with the signals that actually make
LostCity useful as a local discovery product: specials, exhibits, hours,
descriptions, images, and planning notes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date
from typing import Any, Callable

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client
from source_goals import resolve_source_data_goals

NIGHTLIFE_TYPES = {
    "bar",
    "brewery",
    "distillery",
    "food_hall",
    "restaurant",
    "rooftop",
    "sports_bar",
    "winery",
}

EXHIBIT_TYPES = {
    "arts_center",
    "botanical_garden",
    "gallery",
    "garden",
    "museum",
}

EVENT_LED_TYPES = {
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

FIXED_HOURS_TYPES = {
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

ACCOUNTABILITY_GOALS = ("specials", "exhibits", "venue_hours", "planning", "images")


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


def has_usable_hours(value: Any) -> bool:
    if not value:
        return False
    if isinstance(value, dict):
        for day in value.values():
            if isinstance(day, dict) and (day.get("open") or day.get("close")):
                return True
        return False
    return True


@dataclass
class OpportunityRow:
    venue: str
    venue_type: str
    city: str
    source: str
    future_events: int
    future_exhibits: int
    specials: int
    has_hours: bool
    has_description: bool
    has_image: bool
    has_planning: bool


@dataclass
class SourceGoalGapRow:
    source: str
    goal: str
    goal_mode: str
    venue: str
    venue_type: str
    city: str
    state: str
    future_events: int
    future_exhibits: int
    has_signal: bool
    has_hours: bool
    has_description: bool
    has_image: bool
    has_planning: bool
    specials: int


def build_source_primary_venue_map(
    future_events: list[dict],
    venue_by_id: dict[int, dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    counts: dict[int, Counter[int]] = defaultdict(Counter)
    for row in future_events:
        source_id = row.get("source_id")
        venue_id = row.get("venue_id")
        if source_id is None or venue_id is None:
            continue
        counts[int(source_id)][int(venue_id)] += 1

    primary: dict[int, dict[str, Any]] = {}
    for source_id, counter in counts.items():
        venue_id, event_count = counter.most_common(1)[0]
        venue = venue_by_id.get(venue_id)
        if venue:
            primary[source_id] = {
                "venue_id": venue_id,
                "event_count": event_count,
                "venue": venue,
            }
    return primary


def venue_matches_scope(venue: dict[str, Any], *, city: str | None, state: str | None) -> bool:
    venue_city = str(venue.get("city") or "").strip().lower()
    venue_state = str(venue.get("state") or "").strip().lower()
    if city and venue_city != city.strip().lower():
        return False
    if state and venue_state != state.strip().lower():
        return False
    return True


def compute_goal_signal(
    goal: str,
    venue: dict[str, Any],
    *,
    specials_by_venue: Counter[int],
    future_exhibits_by_venue: Counter[int],
) -> bool:
    venue_id = int(venue["id"])
    if goal == "specials":
        return specials_by_venue[venue_id] > 0
    if goal == "exhibits":
        return future_exhibits_by_venue[venue_id] > 0
    if goal == "venue_hours":
        return has_usable_hours(venue.get("hours"))
    if goal == "planning":
        return bool((venue.get("planning_notes") or "").strip())
    if goal == "images":
        return bool((venue.get("image_url") or "").strip())
    return False


def build_goal_accountability(
    *,
    primary_venues: dict[int, dict[str, Any]],
    source_by_id: dict[int, dict[str, Any]],
    specials_by_venue: Counter[int],
    future_events_by_venue: Counter[int],
    future_exhibits_by_venue: Counter[int],
) -> tuple[dict[str, dict[str, int]], list[SourceGoalGapRow]]:
    summary: dict[str, dict[str, int]] = {
        goal: {"expected_sources": 0, "fulfilled_sources": 0, "missing_sources": 0}
        for goal in ACCOUNTABILITY_GOALS
    }
    gaps: list[SourceGoalGapRow] = []

    for source_id, payload in primary_venues.items():
        source = source_by_id.get(source_id)
        venue = payload.get("venue") or {}
        if not source or not venue:
            continue
        goals, goal_mode = resolve_source_data_goals(
            str(source.get("slug") or ""),
            source_name=str(source.get("name") or ""),
            venue_type=str(venue.get("venue_type") or ""),
        )
        scoped_goals = [goal for goal in goals if goal in ACCOUNTABILITY_GOALS]
        if not scoped_goals:
            continue

        venue_id = int(venue["id"])
        future_events = int(future_events_by_venue[venue_id])
        future_exhibits = int(future_exhibits_by_venue[venue_id])
        specials = int(specials_by_venue[venue_id])
        has_hours = has_usable_hours(venue.get("hours"))
        has_description = bool((venue.get("description") or "").strip())
        has_image = bool((venue.get("image_url") or "").strip())
        has_planning = bool((venue.get("planning_notes") or "").strip())

        for goal in scoped_goals:
            summary[goal]["expected_sources"] += 1
            has_signal = compute_goal_signal(
                goal,
                venue,
                specials_by_venue=specials_by_venue,
                future_exhibits_by_venue=future_exhibits_by_venue,
            )
            if has_signal:
                summary[goal]["fulfilled_sources"] += 1
                continue

            summary[goal]["missing_sources"] += 1
            gaps.append(
                SourceGoalGapRow(
                    source=str(source.get("slug") or source.get("name") or ""),
                    goal=goal,
                    goal_mode=goal_mode,
                    venue=str(venue.get("name") or ""),
                    venue_type=str(venue.get("venue_type") or ""),
                    city=str(venue.get("city") or ""),
                    state=str(venue.get("state") or ""),
                    future_events=future_events,
                    future_exhibits=future_exhibits,
                    has_signal=has_signal,
                    has_hours=has_hours,
                    has_description=has_description,
                    has_image=has_image,
                    has_planning=has_planning,
                    specials=specials,
                )
            )

    gaps.sort(
        key=lambda row: (
            ACCOUNTABILITY_GOALS.index(row.goal),
            -row.future_events,
            -row.future_exhibits,
            row.city.lower(),
            row.source.lower(),
        )
    )
    return summary, gaps


def summarize_group(
    venues: list[dict[str, Any]],
    *,
    specials_by_venue: Counter[int],
    future_events_by_venue: Counter[int],
    future_exhibits_by_venue: Counter[int],
) -> dict[str, Any]:
    total = len(venues)
    return {
        "venues": total,
        "with_specials": sum(1 for venue in venues if specials_by_venue[int(venue["id"])] > 0),
        "with_future_events": sum(1 for venue in venues if future_events_by_venue[int(venue["id"])] > 0),
        "with_future_exhibits": sum(1 for venue in venues if future_exhibits_by_venue[int(venue["id"])] > 0),
        "with_hours": sum(1 for venue in venues if has_usable_hours(venue.get("hours"))),
        "with_description": sum(1 for venue in venues if (venue.get("description") or "").strip()),
        "with_image": sum(1 for venue in venues if (venue.get("image_url") or "").strip()),
        "with_planning": sum(1 for venue in venues if (venue.get("planning_notes") or "").strip()),
        "with_parking": sum(1 for venue in venues if (venue.get("parking_note") or "").strip()),
        "with_transit": sum(1 for venue in venues if (venue.get("transit_note") or "").strip()),
    }


def find_opportunities(
    venues: list[dict[str, Any]],
    *,
    future_events_by_venue: Counter[int],
    future_exhibits_by_venue: Counter[int],
    specials_by_venue: Counter[int],
    source_by_venue: dict[int, str],
    predicate: Callable[[dict[str, Any]], bool],
    limit: int,
) -> list[OpportunityRow]:
    rows: list[OpportunityRow] = []
    for venue in venues:
        venue_id = int(venue["id"])
        if not predicate(venue):
            continue
        rows.append(
            OpportunityRow(
                venue=str(venue.get("name") or ""),
                venue_type=str(venue.get("venue_type") or ""),
                city=str(venue.get("city") or ""),
                source=source_by_venue.get(venue_id, ""),
                future_events=int(future_events_by_venue[venue_id]),
                future_exhibits=int(future_exhibits_by_venue[venue_id]),
                specials=int(specials_by_venue[venue_id]),
                has_hours=has_usable_hours(venue.get("hours")),
                has_description=bool((venue.get("description") or "").strip()),
                has_image=bool((venue.get("image_url") or "").strip()),
                has_planning=bool((venue.get("planning_notes") or "").strip()),
            )
        )
    rows.sort(
        key=lambda row: (
            -row.future_events,
            -row.future_exhibits,
            row.city.lower(),
            row.venue.lower(),
        )
    )
    return rows[:limit]


def print_group(label: str, summary: dict[str, Any]) -> None:
    total = summary["venues"]
    print(f"\n{label}")
    print("-" * len(label))
    print(f"Venues: {total}")
    print(f"With specials: {summary['with_specials']} ({pct(summary['with_specials'], total)}%)")
    print(f"With future events: {summary['with_future_events']} ({pct(summary['with_future_events'], total)}%)")
    print(f"With future exhibits: {summary['with_future_exhibits']} ({pct(summary['with_future_exhibits'], total)}%)")
    print(f"With hours: {summary['with_hours']} ({pct(summary['with_hours'], total)}%)")
    print(f"With descriptions: {summary['with_description']} ({pct(summary['with_description'], total)}%)")
    print(f"With images: {summary['with_image']} ({pct(summary['with_image'], total)}%)")
    print(f"With planning notes: {summary['with_planning']} ({pct(summary['with_planning'], total)}%)")
    print(f"With parking notes: {summary['with_parking']} ({pct(summary['with_parking'], total)}%)")
    print(f"With transit notes: {summary['with_transit']} ({pct(summary['with_transit'], total)}%)")


def print_opportunities(label: str, rows: list[OpportunityRow]) -> None:
    print(f"\n{label}")
    print("-" * len(label))
    if not rows:
        print("None.")
        return
    for row in rows:
        print(
            f"- {row.venue} [{row.venue_type}] city={row.city} source={row.source or '-'} "
            f"future_events={row.future_events} future_exhibits={row.future_exhibits} specials={row.specials} "
            f"hours={'y' if row.has_hours else 'n'} desc={'y' if row.has_description else 'n'} "
            f"image={'y' if row.has_image else 'n'} planning={'y' if row.has_planning else 'n'}"
        )


def print_goal_accountability(summary: dict[str, dict[str, int]]) -> None:
    print("\nSource goal accountability")
    print("-------------------------")
    for goal in ACCOUNTABILITY_GOALS:
        counts = summary.get(goal) or {}
        expected = counts.get("expected_sources", 0)
        fulfilled = counts.get("fulfilled_sources", 0)
        missing = counts.get("missing_sources", 0)
        print(
            f"- {goal}: expected={expected} fulfilled={fulfilled} "
            f"({pct(fulfilled, expected)}%) missing={missing}"
        )


def print_source_goal_gaps(rows: list[SourceGoalGapRow], *, limit: int) -> None:
    print("\nTop source-goal gaps")
    print("--------------------")
    if not rows:
        print("None.")
        return
    for row in rows[:limit]:
        print(
            f"- {row.source} goal={row.goal} mode={row.goal_mode} venue={row.venue} "
            f"[{row.venue_type}] city={row.city},{row.state} future_events={row.future_events} "
            f"future_exhibits={row.future_exhibits} specials={row.specials} "
            f"hours={'y' if row.has_hours else 'n'} desc={'y' if row.has_description else 'n'} "
            f"image={'y' if row.has_image else 'n'} planning={'y' if row.has_planning else 'n'}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit product-critical destination signals.")
    parser.add_argument("--limit", type=int, default=15, help="Rows per opportunity section.")
    parser.add_argument("--city", help="Restrict the audit to a single city.")
    parser.add_argument("--state", help="Restrict the audit to a single state.")
    parser.add_argument("--json", action="store_true", help="Print JSON payload instead of plain text.")
    args = parser.parse_args()

    client = get_client()
    today = date.today().isoformat()

    venues = paged_select(
        client,
        "venues",
        "id,name,slug,city,state,venue_type,hours,description,image_url,planning_notes,parking_note,transit_note,active",
        query_builder=lambda q: q.eq("active", True),
    )
    sources = paged_select(
        client,
        "sources",
        "id,slug,name,is_active",
        query_builder=lambda q: q.eq("is_active", True),
    )
    future_events = paged_select(
        client,
        "events",
        "id,source_id,venue_id,content_kind,start_date",
        query_builder=lambda q: q.eq("is_active", True).gte("start_date", today),
        order_column="start_date",
    )
    specials = paged_select(
        client,
        "venue_specials",
        "id,venue_id,type",
        query_builder=lambda q: q.eq("is_active", True),
    )

    exhibitions: list[dict[str, Any]] = []
    try:
        exhibitions = paged_select(
            client,
            "exhibitions",
            "id,venue_id,is_active,closing_date",
            query_builder=lambda q: q.eq("is_active", True),
        )
    except Exception:
        exhibitions = []

    scoped_venues = [
        venue
        for venue in venues
        if venue.get("id") is not None
        and venue_matches_scope(venue, city=args.city, state=args.state)
    ]
    scoped_venue_ids = {int(row["id"]) for row in scoped_venues}
    venue_by_id = {int(row["id"]): row for row in scoped_venues}
    source_by_id = {int(row["id"]): row for row in sources if row.get("id") is not None}

    future_events_by_venue: Counter[int] = Counter()
    future_exhibits_by_venue: Counter[int] = Counter()

    for row in future_events:
        venue_id = row.get("venue_id")
        source_id = row.get("source_id")
        if venue_id is None or int(venue_id) not in scoped_venue_ids:
            continue
        venue_id_int = int(venue_id)
        future_events_by_venue[venue_id_int] += 1
        if str(row.get("content_kind") or "") == "exhibit":
            future_exhibits_by_venue[venue_id_int] += 1

    scoped_exhibitions: list[dict[str, Any]] = []
    for row in exhibitions:
        venue_id = row.get("venue_id")
        if venue_id is None or int(venue_id) not in scoped_venue_ids:
            continue
        future_exhibits_by_venue[int(venue_id)] += 1
        scoped_exhibitions.append(row)

    specials_by_venue: Counter[int] = Counter()
    specials_type_counts: Counter[str] = Counter()
    scoped_specials = 0
    for row in specials:
        venue_id = row.get("venue_id")
        if venue_id is None or int(venue_id) not in scoped_venue_ids:
            continue
        specials_by_venue[int(venue_id)] += 1
        specials_type_counts[str(row.get("type") or "unknown")] += 1
        scoped_specials += 1

    scoped_future_events = [
        row for row in future_events
        if row.get("venue_id") is not None and int(row["venue_id"]) in scoped_venue_ids
    ]
    primary_venues = build_source_primary_venue_map(scoped_future_events, venue_by_id)
    source_by_venue: dict[int, str] = {}
    source_goal_counts: Counter[str] = Counter()
    for source_id, payload in primary_venues.items():
        source = source_by_id.get(source_id)
        if not source:
            continue
        source_by_venue[payload["venue_id"]] = str(source.get("slug") or source.get("name") or "")
        goals, _goal_mode = resolve_source_data_goals(
            str(source.get("slug") or ""),
            source_name=str(source.get("name") or ""),
        )
        for goal in goals:
            source_goal_counts[goal] += 1

    goal_accountability, source_goal_gaps = build_goal_accountability(
        primary_venues=primary_venues,
        source_by_id=source_by_id,
        specials_by_venue=specials_by_venue,
        future_events_by_venue=future_events_by_venue,
        future_exhibits_by_venue=future_exhibits_by_venue,
    )

    nightlife_venues = [venue for venue in scoped_venues if str(venue.get("venue_type") or "") in NIGHTLIFE_TYPES]
    exhibit_venues = [venue for venue in scoped_venues if str(venue.get("venue_type") or "") in EXHIBIT_TYPES]
    event_led_venues = [venue for venue in scoped_venues if str(venue.get("venue_type") or "") in EVENT_LED_TYPES]
    fixed_hours_venues = [venue for venue in scoped_venues if str(venue.get("venue_type") or "") in FIXED_HOURS_TYPES]

    payload = {
        "generated_at": date.today().isoformat(),
        "scope": {
            "city": args.city,
            "state": args.state,
        },
        "totals": {
            "active_venues": len(scoped_venues),
            "future_events": len(scoped_future_events),
            "active_specials": scoped_specials,
            "active_exhibitions_rows": len(scoped_exhibitions),
            "special_types": dict(specials_type_counts),
            "source_goal_counts": dict(source_goal_counts),
            "sources_with_primary_venue_in_scope": len(primary_venues),
        },
        "groups": {
            "nightlife": summarize_group(
                nightlife_venues,
                specials_by_venue=specials_by_venue,
                future_events_by_venue=future_events_by_venue,
                future_exhibits_by_venue=future_exhibits_by_venue,
            ),
            "exhibit_destinations": summarize_group(
                exhibit_venues,
                specials_by_venue=specials_by_venue,
                future_events_by_venue=future_events_by_venue,
                future_exhibits_by_venue=future_exhibits_by_venue,
            ),
            "event_led_destinations": summarize_group(
                event_led_venues,
                specials_by_venue=specials_by_venue,
                future_events_by_venue=future_events_by_venue,
                future_exhibits_by_venue=future_exhibits_by_venue,
            ),
            "fixed_hours_destinations": summarize_group(
                fixed_hours_venues,
                specials_by_venue=specials_by_venue,
                future_events_by_venue=future_events_by_venue,
                future_exhibits_by_venue=future_exhibits_by_venue,
            ),
        },
        "goal_accountability": goal_accountability,
    }

    nightlife_missing_specials = find_opportunities(
        nightlife_venues,
        future_events_by_venue=future_events_by_venue,
        future_exhibits_by_venue=future_exhibits_by_venue,
        specials_by_venue=specials_by_venue,
        source_by_venue=source_by_venue,
        limit=args.limit,
        predicate=lambda venue: future_events_by_venue[int(venue["id"])] > 0 and specials_by_venue[int(venue["id"])] == 0,
    )
    exhibit_missing_exhibits = find_opportunities(
        exhibit_venues,
        future_events_by_venue=future_events_by_venue,
        future_exhibits_by_venue=future_exhibits_by_venue,
        specials_by_venue=specials_by_venue,
        source_by_venue=source_by_venue,
        limit=args.limit,
        predicate=lambda venue: future_exhibits_by_venue[int(venue["id"])] == 0,
    )
    event_led_missing_planning = find_opportunities(
        event_led_venues,
        future_events_by_venue=future_events_by_venue,
        future_exhibits_by_venue=future_exhibits_by_venue,
        specials_by_venue=specials_by_venue,
        source_by_venue=source_by_venue,
        limit=args.limit,
        predicate=lambda venue: future_events_by_venue[int(venue["id"])] > 0 and not (venue.get("planning_notes") or "").strip(),
    )
    fixed_hours_missing_hours = find_opportunities(
        fixed_hours_venues,
        future_events_by_venue=future_events_by_venue,
        future_exhibits_by_venue=future_exhibits_by_venue,
        specials_by_venue=specials_by_venue,
        source_by_venue=source_by_venue,
        limit=args.limit,
        predicate=lambda venue: future_events_by_venue[int(venue["id"])] > 0 and not has_usable_hours(venue.get("hours")),
    )

    payload["opportunities"] = {
        "nightlife_missing_specials": [asdict(row) for row in nightlife_missing_specials],
        "exhibit_destinations_missing_exhibits": [asdict(row) for row in exhibit_missing_exhibits],
        "event_led_missing_planning": [asdict(row) for row in event_led_missing_planning],
        "fixed_hours_missing_hours": [asdict(row) for row in fixed_hours_missing_hours],
    }
    payload["source_goal_gaps"] = [asdict(row) for row in source_goal_gaps[: args.limit * 2]]

    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
        return

    print("=" * 80)
    print("DESTINATION SIGNAL AUDIT")
    print("=" * 80)
    print(f"Scope: city={args.city or '*'} state={args.state or '*'}")
    print(f"Active venues: {payload['totals']['active_venues']}")
    print(f"Future events: {payload['totals']['future_events']}")
    print(f"Active specials: {payload['totals']['active_specials']}")
    print(f"Active exhibitions rows: {payload['totals']['active_exhibitions_rows']}")
    print(f"Special types: {payload['totals']['special_types']}")

    print_group("Nightlife destinations", payload["groups"]["nightlife"])
    print_group("Exhibit destinations", payload["groups"]["exhibit_destinations"])
    print_group("Event-led destinations", payload["groups"]["event_led_destinations"])
    print_group("Fixed-hours destinations", payload["groups"]["fixed_hours_destinations"])
    print_goal_accountability(payload["goal_accountability"])

    print_opportunities("Top nightlife venues missing specials", nightlife_missing_specials)
    print_opportunities("Top exhibit destinations missing exhibits", exhibit_missing_exhibits)
    print_opportunities("Top event-led destinations missing planning notes", event_led_missing_planning)
    print_opportunities("Top fixed-hours destinations missing hours", fixed_hours_missing_hours)
    print_source_goal_gaps(source_goal_gaps, limit=args.limit)


if __name__ == "__main__":
    main()
