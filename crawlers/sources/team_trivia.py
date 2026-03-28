"""
Crawler for OutSpoken Entertainment trivia nights (outspokenentertainment.com).

OutSpoken Entertainment runs "Team Trivia" branded pub quiz nights at bars and
restaurants across the Atlanta metro area. They also run music bingo, bar bingo,
and karaoke at various venues.

This crawler focuses on ITP (Inside the Perimeter) trivia venues.
Schedule sourced from outspokenentertainment.com/wheretoplay, Feb 2026.
WEEKS_AHEAD = 6
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import (
    get_or_create_place,
    insert_event,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

WEEKS_AHEAD = 6
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# ============================================================================
# ITP VENUES from OutSpoken Entertainment schedule
# ============================================================================

VENUES = {
    "hf-burger-pcm": {
        "name": "H&F Burger",
        "slug": "hf-burger-ponce-city-market",
        "address": "675 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "restaurant",
    },
    "kpot-howell-mill": {
        "name": "KPOT Korean BBQ & Hot Pot",
        "slug": "kpot-howell-mill",
        "address": "1801 Howell Mill Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "restaurant",
    },
    "politan-row-colony-sq": {
        "name": "Politan Row at Colony Square",
        "slug": "politan-row-colony-square",
        "address": "1197 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30361",
        "venue_type": "food_hall",
    },
    "whelan-west-midtown": {
        "name": "Whelan",
        "slug": "whelan-west-midtown",
        "address": "1170 Howell Mill Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "bar",
    },
    "emmy-squared-glenwood": {
        "name": "Emmy Squared Pizza",
        "slug": "emmy-squared-glenwood-park",
        "address": "913 Bernina Ave NE",
        "neighborhood": "Glenwood Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "restaurant",
    },
    "hobnob-atlantic-station": {
        "name": "HobNob Neighborhood Tavern",
        "slug": "hobnob-atlantic-station",
        "address": "1551 Piedmont Ave NE",
        "neighborhood": "Atlantic Station",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "venue_type": "restaurant",
    },
    "milltown-arms": {
        "name": "Milltown Arms Tavern",
        "slug": "milltown-arms-tavern",
        "address": "180 Carroll St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "bar",
    },
    "ponko-midtown": {
        "name": "Ponko Chicken",
        "slug": "ponko-chicken-midtown",
        "address": "923 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "restaurant",
    },
    "pour-taproom-midtown": {
        "name": "Pour Taproom",
        "slug": "pour-taproom-midtown",
        "address": "931 Monroe Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "bar",
    },
    "side-saddle-grant-park": {
        "name": "Side Saddle Wine Saloon & Bar",
        "slug": "side-saddle-grant-park",
        "address": "429 Cherokee Ave SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "bar",
    },
    "westside-pizzeria": {
        "name": "Westside Pizzeria & Bar",
        "slug": "westside-pizzeria-bar",
        "address": "1039 Howell Mill Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "restaurant",
    },
    "the-albert-inman-park": {
        "name": "The Albert",
        "slug": "the-albert-inman-park",
        "address": "818 N Highland Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
    },
    "nook-piedmont-park": {
        "name": "The Nook on Piedmont Park",
        "slug": "the-nook-piedmont-park",
        "address": "1144 Piedmont Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "bar",
    },
    "fire-maker-brewing": {
        "name": "Fire Maker Brewing",
        "slug": "fire-maker-brewing",
        "address": "1218 Huff Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "brewery",
    },
    "mellow-mushroom-grant-park": {
        "name": "Mellow Mushroom Grant Park",
        "slug": "mellow-mushroom-grant-park",
        "address": "420 Semmes St SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "restaurant",
    },
    "peacherie-midtown": {
        "name": "Peacherie Atlanta",
        "slug": "peacherie-atlanta-midtown",
        "address": "900 Monroe Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "restaurant",
    },
    "rocky-mountain-pizza-midtown": {
        "name": "Rocky Mountain Pizza Company",
        "slug": "rocky-mountain-pizza-midtown",
        "address": "1005 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "restaurant",
    },
    "johnnys-pizza-midtown": {
        "name": "Johnny's NY Style Pizza",
        "slug": "johnnys-pizza-midtown",
        "address": "931 Monroe Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "restaurant",
    },
}

# ============================================================================
# WEEKLY SCHEDULE
# ============================================================================

WEEKLY_SCHEDULE = [
    # Monday
    {"venue_key": "hf-burger-pcm", "day": 0, "start_time": "19:30", "event_type": "trivia"},
    {"venue_key": "kpot-howell-mill", "day": 0, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "politan-row-colony-sq", "day": 0, "start_time": "19:00", "event_type": "music_bingo"},
    {"venue_key": "whelan-west-midtown", "day": 0, "start_time": "20:00", "event_type": "trivia"},
    # Tuesday
    {"venue_key": "emmy-squared-glenwood", "day": 1, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "hobnob-atlantic-station", "day": 1, "start_time": "19:30", "event_type": "trivia"},
    {"venue_key": "milltown-arms", "day": 1, "start_time": "19:30", "event_type": "trivia"},
    {"venue_key": "ponko-midtown", "day": 1, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "pour-taproom-midtown", "day": 1, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "side-saddle-grant-park", "day": 1, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "westside-pizzeria", "day": 1, "start_time": "20:00", "event_type": "trivia"},
    {"venue_key": "rocky-mountain-pizza-midtown", "day": 1, "start_time": "20:30", "event_type": "trivia"},
    # Wednesday
    {"venue_key": "nook-piedmont-park", "day": 2, "start_time": "20:00", "event_type": "trivia"},
    {"venue_key": "the-albert-inman-park", "day": 2, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "johnnys-pizza-midtown", "day": 2, "start_time": "19:00", "event_type": "trivia"},
    # Thursday
    {"venue_key": "fire-maker-brewing", "day": 3, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "mellow-mushroom-grant-park", "day": 3, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "peacherie-midtown", "day": 3, "start_time": "19:00", "event_type": "trivia"},
    {"venue_key": "rocky-mountain-pizza-midtown", "day": 3, "start_time": "20:30", "event_type": "trivia"},
    {"venue_key": "westside-pizzeria", "day": 3, "start_time": "20:00", "event_type": "trivia"},
]

EVENT_TYPE_CONFIG = {
    "trivia": {
        "title": "OutSpoken Team Trivia",
        "description_tpl": "Weekly OutSpoken Team Trivia at {venue}. Free to play — bring a team and compete for prizes.",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "outspoken"],
        "genres": ["trivia"],
    },
    "music_bingo": {
        "title": "Music Bingo",
        "description_tpl": "Weekly Music Bingo at {venue} by OutSpoken Entertainment. Listen for the songs, mark your card, win prizes.",
        "category": "nightlife",
        "subcategory": "nightlife.bingo",
        "tags": ["music-bingo", "bingo", "nightlife", "weekly", "outspoken"],
        "genres": ["bingo"],
    },
}


def _format_time_label(time_24: str) -> str:
    try:
        return datetime.strptime(time_24, "%H:%M").strftime("%-I:%M %p")
    except Exception:
        return time_24


def _build_description(
    base_template: str,
    *,
    venue_name: str,
    place_data: dict,
    day_name: str,
    start_time: str,
    source_url: str,
) -> str:
    base = base_template.format(venue=venue_name).strip()
    neighborhood = str(place_data.get("neighborhood") or "").strip()
    city = str(place_data.get("city") or "Atlanta").strip()
    state = str(place_data.get("state") or "GA").strip()
    start_label = _format_time_label(start_time)

    where = venue_name
    if neighborhood:
        where = f"{where} in {neighborhood}"
    where = f"{where}, {city}, {state}"

    parts = [
        base,
        f"Recurring weekly every {day_name} at {start_label}.",
        f"Location: {where}.",
        "Hosted by OutSpoken Entertainment. Free to play with team-based scoring and venue prizes.",
        f"Confirm weekly details and specials on the venue listing or {source_url}.",
    ]
    return " ".join(parts)[:1200]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate OutSpoken Entertainment trivia/bingo events for ITP Atlanta venues."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    venue_ids = {}

    logger.info(f"Generating OutSpoken trivia events for {len(WEEKLY_SCHEDULE)} venue slots")

    for slot in WEEKLY_SCHEDULE:
        venue_key = slot["venue_key"]
        place_data = VENUES.get(venue_key)
        if not place_data:
            logger.warning(f"Unknown venue key: {venue_key}")
            continue

        if venue_key not in venue_ids:
            venue_ids[venue_key] = get_or_create_place(place_data)

        venue_id = venue_ids[venue_key]
        venue_name = place_data["name"]
        day_int = slot["day"]
        start_time = slot["start_time"]
        day_code = DAY_CODES[day_int]
        day_name = DAY_NAMES[day_int]
        event_type = slot.get("event_type", "trivia")

        config = EVENT_TYPE_CONFIG.get(event_type, EVENT_TYPE_CONFIG["trivia"])
        title = config["title"]
        source_url = place_data.get("website", "https://outspokenentertainment.com")
        description = _build_description(
            config["description_tpl"],
            venue_name=venue_name,
            place_data=place_data,
            day_name=day_name,
            start_time=start_time,
            source_url=source_url,
        )

        next_date = get_next_weekday(today, day_int)

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": description,
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(title, venue_name, start_date)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": config["category"],
                "subcategory": config["subcategory"],
                "tags": config["tags"],
                "is_free": True,
                "price_min": None,
                "price_max": None,
                "price_note": "Free to play",
                "source_url": source_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{title} at {venue_name} - {start_date}",
                "extraction_confidence": 0.88,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint, genres=config.get("genres"))
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {title} at {venue_name} on {start_date}: {exc}")

    logger.info(
        f"OutSpoken trivia crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
