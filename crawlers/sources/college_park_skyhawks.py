"""
Crawler for College Park Skyhawks home games.

The live G League schedule stack is not reliably reachable from this runtime, so
this source models the official published 2025-26 home schedule from the team's
schedule-release article and printable schedule asset.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://cpskyhawks.gleague.nba.com/news/college-park-skyhawks-announce-2025-26-season-schedule"
PRINTABLE_SCHEDULE_URL = "https://cdn-gleague.nba.com/sites/1612709929/2025/09/2526_CPS_Schedule_Calendar_v4.pdf"
TICKETS_URL = "https://www.ticketmaster.com/college-park-skyhawks-tickets/artist/2669508"

PLACE_DATA = {
    "name": "Gateway Center Arena",
    "slug": "gateway-center-arena",
    "address": "2330 Convention Center Concourse",
    "neighborhood": "Airport District",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "lat": 33.6624,
    "lng": -84.4440,
    "venue_type": "arena",
    "spot_type": "stadium",
    "website": "https://gatewaycenterarena.com",
    "description": "Home venue for the College Park Skyhawks in College Park.",
}

OPPONENT_NAME_BY_LABEL = {
    "AUS": "Austin Spurs",
    "BHM": "Birmingham Squadron",
    "CCG": "Capital City Go-Go",
    "CLC": "Cleveland Charge",
    "DEL": "Delaware Blue Coats",
    "GBO": "Greensboro Swarm",
    "LIN": "Long Island Nets",
    "MNE": "Maine Celtics",
    "OSC": "Osceola Magic",
    "RAP": "Raptors 905",
    "RCR": "Rip City Remix",
    "WES": "Westchester Knicks",
}

HOME_SCHEDULE = [
    {"date": "2025-11-14", "time": "19:00", "opponent_label": "CCG"},
    {"date": "2025-11-16", "time": "14:00", "opponent_label": "CCG"},
    {"date": "2025-11-20", "time": "19:00", "opponent_label": "WES"},
    {"date": "2025-11-26", "time": "19:00", "opponent_label": "LIN"},
    {"date": "2025-12-03", "time": "11:00", "opponent_label": "WES"},
    {"date": "2025-12-12", "time": "19:00", "opponent_label": "GBO"},
    {"date": "2025-12-14", "time": "14:00", "opponent_label": "GBO"},
    {"date": "2025-12-27", "time": "15:00", "opponent_label": "CCG"},
    {"date": "2025-12-28", "time": "15:00", "opponent_label": "LIN"},
    {"date": "2025-12-30", "time": "19:00", "opponent_label": "BHM"},
    {"date": "2026-01-01", "time": "19:00", "opponent_label": "BHM"},
    {"date": "2026-01-12", "time": "19:00", "opponent_label": "OSC"},
    {"date": "2026-01-14", "time": "19:00", "opponent_label": "DEL"},
    {"date": "2026-01-16", "time": "19:00", "opponent_label": "DEL"},
    {"date": "2026-01-18", "time": "14:00", "opponent_label": "MNE"},
    {"date": "2026-01-21", "time": "19:00", "opponent_label": "MNE"},
    {"date": "2026-02-02", "time": "19:00", "opponent_label": "CLC"},
    {"date": "2026-02-04", "time": "19:00", "opponent_label": "CLC"},
    {"date": "2026-02-07", "time": "15:00", "opponent_label": "RCR"},
    {"date": "2026-02-09", "time": "19:00", "opponent_label": "RCR"},
    {"date": "2026-02-24", "time": "19:00", "opponent_label": "RAP"},
    {"date": "2026-02-25", "time": "19:00", "opponent_label": "RAP"},
    {"date": "2026-03-17", "time": "19:00", "opponent_label": "AUS"},
    {"date": "2026-03-25", "time": "19:00", "opponent_label": "OSC"},
]


def build_event_title(opponent_label: str) -> str:
    return f"College Park Skyhawks vs. {OPPONENT_NAME_BY_LABEL[opponent_label]}"


def build_description(opponent_label: str, event_date: str, start_time: str) -> str:
    opponent_name = OPPONENT_NAME_BY_LABEL[opponent_label]
    pretty_time = datetime.strptime(start_time, "%H:%M").strftime("%-I:%M %p")
    return (
        f"Official College Park Skyhawks 2025-26 home game versus the {opponent_name} at Gateway Center Arena. "
        f"The team's official 2025-26 schedule release and printable schedule list this matchup on {event_date} "
        f"at {pretty_time} Eastern. Check the official Skyhawks tickets page for the latest on-sale details."
    )[:1400]


def upcoming_home_games(today: datetime | None = None) -> list[dict]:
    cutoff = (today or datetime.now()).date()
    return [
        game
        for game in HOME_SCHEDULE
        if datetime.strptime(game["date"], "%Y-%m-%d").date() >= cutoff
    ]


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_place(PLACE_DATA)

    for game in upcoming_home_games():
        opponent_label = game["opponent_label"]
        start_date = game["date"]
        start_time = game["time"]
        title = build_event_title(opponent_label)
        description = build_description(opponent_label, start_date, start_time)
        content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

        current_hashes.add(content_hash)
        events_found += 1

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
            "category": "sports",
            "subcategory": "basketball",
            "tags": [
                "basketball",
                "nba-g-league",
                "college-park-skyhawks",
                "home-game",
                "gateway-center-arena",
            ],
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "See the official College Park Skyhawks tickets page for current pricing.",
            "source_url": SOURCE_URL,
            "ticket_url": TICKETS_URL,
            "image_url": None,
            "raw_text": (
                f"{start_date} {start_time} | College Park Skyhawks home game | "
                f"{opponent_label} | official schedule release + printable schedule"
            ),
            "extraction_confidence": 0.84,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
        except Exception as exc:
            logger.error(
                "Failed to insert College Park Skyhawks home game %s on %s: %s",
                opponent_label,
                start_date,
                exc,
            )

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale College Park Skyhawks events after schedule refresh", stale_removed)

    logger.info(
        "College Park Skyhawks crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
