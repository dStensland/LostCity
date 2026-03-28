"""
Crawler for Atlanta Dream home games.

The official WNBA schedule API used by dream.wnba.com is not reliably reachable
from this runtime, so this source models the published 2026 home schedule from
the team's official schedule-release asset. Dates and opponents are first-party;
tipoff times remain unknown in the accessible source material and are omitted.
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

SOURCE_URL = "https://dream.wnba.com/2026-schedule-release"
TICKETS_URL = "https://dream.wnba.com/single-game-tickets"
IMAGE_URL = (
    "https://cdn.wnba.com/sites/1611661330/2026/01/"
    "Home-Schedule-Graphic_1920x1080-1.jpg"
)

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
    "place_type": "arena",
    "spot_type": "stadium",
    "website": "https://gatewaycenterarena.com",
    "description": "Home venue for the Atlanta Dream in College Park.",
}

OPPONENT_NAME_BY_LABEL = {
    "Las Vegas": "Las Vegas Aces",
    "Dallas": "Dallas Wings",
    "Phoenix": "Phoenix Mercury",
    "Connecticut": "Connecticut Sun",
    "Washington": "Washington Mystics",
    "New York": "New York Liberty",
    "Indiana": "Indiana Fever",
    "Toronto": "Toronto Tempo",
    "Golden State": "Golden State Valkyries",
    "Seattle": "Seattle Storm",
    "Portland": "Portland Fire",
    "Los Angeles": "Los Angeles Sparks",
    "Chicago": "Chicago Sky",
    "Minnesota": "Minnesota Lynx",
}

HOME_SCHEDULE = [
    {"date": "2026-05-17", "opponent_label": "Las Vegas"},
    {"date": "2026-05-22", "opponent_label": "Dallas"},
    {"date": "2026-05-24", "opponent_label": "Phoenix"},
    {"date": "2026-06-02", "opponent_label": "Connecticut"},
    {"date": "2026-06-06", "opponent_label": "Washington"},
    {"date": "2026-06-11", "opponent_label": "New York"},
    {"date": "2026-06-20", "opponent_label": "Indiana"},
    {"date": "2026-06-22", "opponent_label": "Toronto"},
    {"date": "2026-07-04", "opponent_label": "Golden State"},
    {"date": "2026-07-09", "opponent_label": "Seattle"},
    {"date": "2026-07-11", "opponent_label": "Portland"},
    {"date": "2026-07-13", "opponent_label": "Los Angeles"},
    {"date": "2026-07-19", "opponent_label": "Chicago"},
    {"date": "2026-07-31", "opponent_label": "Seattle"},
    {"date": "2026-08-03", "opponent_label": "Las Vegas"},
    {"date": "2026-08-05", "opponent_label": "Phoenix"},
    {"date": "2026-08-10", "opponent_label": "Toronto"},
    {"date": "2026-08-16", "opponent_label": "Indiana"},
    {"date": "2026-08-28", "opponent_label": "Portland"},
    {"date": "2026-08-30", "opponent_label": "Minnesota"},
    {"date": "2026-09-17", "opponent_label": "Connecticut"},
    {"date": "2026-09-19", "opponent_label": "Chicago"},
]


def build_event_title(opponent_label: str) -> str:
    opponent_name = OPPONENT_NAME_BY_LABEL[opponent_label]
    return f"Atlanta Dream vs {opponent_name}"


def build_matchup_participants(opponent_label: str) -> list[dict]:
    return [
        {"name": "Atlanta Dream", "role": "team", "billing_order": 1},
        {
            "name": OPPONENT_NAME_BY_LABEL[opponent_label],
            "role": "team",
            "billing_order": 2,
        },
    ]


def build_description(opponent_label: str, event_date: str) -> str:
    opponent_name = OPPONENT_NAME_BY_LABEL[opponent_label]
    return (
        f"Official Atlanta Dream 2026 home game versus the {opponent_name} at Gateway Center Arena. "
        f"The team's published 2026 home schedule asset lists this matchup on {event_date}. "
        f"Tipoff time was not exposed in the accessible official schedule materials from this crawler "
        f"runtime, so check the official Dream schedule and single-game tickets pages for the latest "
        f"time and on-sale details."
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
        title = build_event_title(opponent_label)
        start_date = game["date"]
        description = build_description(opponent_label, start_date)
        content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": None,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "basketball",
            "tags": [
                "basketball",
                "wnba",
                "atlanta-dream",
                "home-game",
                "gateway-center-arena",
            ],
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "See the official Atlanta Dream single-game tickets page for current pricing.",
            "source_url": SOURCE_URL,
            "ticket_url": TICKETS_URL,
            "image_url": IMAGE_URL,
            "raw_text": f"{start_date} | Atlanta Dream home game | {opponent_label}",
            "extraction_confidence": 0.78,
            "content_hash": content_hash,
            "_parsed_artists": build_matchup_participants(opponent_label),
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
            logger.error("Failed to insert Atlanta Dream home game %s on %s: %s", opponent_label, start_date, exc)

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale Atlanta Dream events after schedule refresh", stale_removed)

    logger.info(
        "Atlanta Dream crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
