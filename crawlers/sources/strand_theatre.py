"""
Crawler for Earl and Rachel Smith Strand Theatre (earlsmithstrand.org).

Historic theater in Marietta Square presenting concerts, comedy, film, and live performances.
Uses known-shows fallback since the site is heavily JavaScript-rendered.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://earlsmithstrand.org"

VENUE_DATA = {
    "name": "Earl Smith Strand Theatre",
    "slug": "strand-theatre-marietta",
    "address": "117 N Park Square NE",
    "neighborhood": "Marietta Square",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9526,
    "lng": -84.5499,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "description": "Historic 1935 art deco theater in Marietta Square presenting concerts, comedy, films, and live performances.",
}

# Known 2026 events (from VividSeats and official sources)
# Updated periodically as new shows are announced
KNOWN_EVENTS_2026 = [
    # February
    {
        "title": "To Kill A Mockingbird (Film)",
        "start_date": "2026-02-08",
        "start_time": "15:00",
        "category": "film",
        "subcategory": "classic",
        "description": "Classic film screening of the beloved Harper Lee adaptation at the historic Strand Theatre.",
    },
    {
        "title": "Jazz Talk with Trey Wright",
        "start_date": "2026-02-12",
        "start_time": "19:30",
        "category": "music",
        "subcategory": "jazz",
        "description": "Interactive jazz performance and discussion with acclaimed guitarist Trey Wright.",
    },
    {
        "title": "Swift Nation - Tribute to Taylor Swift",
        "start_date": "2026-02-13",
        "start_time": "19:30",
        "category": "music",
        "subcategory": "tribute",
        "description": "The ultimate Taylor Swift tribute experience featuring all the hits.",
    },
    {
        "title": "Casablanca (Film)",
        "start_date": "2026-02-14",
        "start_time": "20:00",
        "category": "film",
        "subcategory": "classic",
        "description": "Valentine's Day screening of the timeless romantic classic.",
    },
    {
        "title": "The Rocky Horror Picture Show",
        "start_date": "2026-02-14",
        "start_time": "23:00",
        "category": "film",
        "subcategory": "cult",
        "description": "Late-night Valentine's screening of the cult classic. Audience participation encouraged!",
    },
    {
        "title": "Wycliffe Gordon",
        "start_date": "2026-02-15",
        "start_time": "16:00",
        "category": "music",
        "subcategory": "jazz",
        "description": "Grammy-nominated trombonist and jazz legend Wycliffe Gordon performs live.",
    },
    {
        "title": "GSO Jazz - Mas Que Nada",
        "start_date": "2026-02-28",
        "start_time": "19:30",
        "category": "music",
        "subcategory": "jazz",
        "description": "Georgia Symphony Orchestra Jazz ensemble performs Brazilian jazz classics.",
    },
    # March
    {
        "title": "Jazz Talk with Trey Wright",
        "start_date": "2026-03-12",
        "start_time": "19:30",
        "category": "music",
        "subcategory": "jazz",
        "description": "Interactive jazz performance and discussion with acclaimed guitarist Trey Wright.",
    },
    {
        "title": "Let It Be Jude - Beatles Tribute",
        "start_date": "2026-03-21",
        "start_time": "20:00",
        "category": "music",
        "subcategory": "tribute",
        "description": "Premier Beatles tribute band performs the Fab Four's greatest hits.",
    },
    # Menopause the Musical 2 - multi-day run
    {
        "title": "Menopause the Musical 2",
        "start_date": "2026-03-24",
        "start_time": "19:30",
        "category": "theater",
        "subcategory": "musical",
        "description": "The hilarious sequel celebrating women and 'The Change'. Four women meet and find sisterhood through song.",
    },
    {
        "title": "Menopause the Musical 2",
        "start_date": "2026-03-25",
        "start_time": "19:30",
        "category": "theater",
        "subcategory": "musical",
        "description": "The hilarious sequel celebrating women and 'The Change'. Four women meet and find sisterhood through song.",
    },
    {
        "title": "Menopause the Musical 2",
        "start_date": "2026-03-26",
        "start_time": "19:30",
        "category": "theater",
        "subcategory": "musical",
        "description": "The hilarious sequel celebrating women and 'The Change'. Four women meet and find sisterhood through song.",
    },
    {
        "title": "Menopause the Musical 2",
        "start_date": "2026-03-27",
        "start_time": "19:30",
        "category": "theater",
        "subcategory": "musical",
        "description": "The hilarious sequel celebrating women and 'The Change'. Four women meet and find sisterhood through song.",
    },
    {
        "title": "Menopause the Musical 2",
        "start_date": "2026-03-28",
        "start_time": "14:00",
        "category": "theater",
        "subcategory": "musical",
        "description": "The hilarious sequel celebrating women and 'The Change'. Four women meet and find sisterhood through song.",
    },
    {
        "title": "Menopause the Musical 2",
        "start_date": "2026-03-28",
        "start_time": "19:30",
        "category": "theater",
        "subcategory": "musical",
        "description": "The hilarious sequel celebrating women and 'The Change'. Four women meet and find sisterhood through song.",
    },
    {
        "title": "Menopause the Musical 2",
        "start_date": "2026-03-29",
        "start_time": "14:00",
        "category": "theater",
        "subcategory": "musical",
        "description": "The hilarious sequel celebrating women and 'The Change'. Four women meet and find sisterhood through song.",
    },
    # April
    {
        "title": "The SpongeBob Musical - Youth Edition",
        "start_date": "2026-04-22",
        "start_time": "18:00",
        "category": "theater",
        "subcategory": "musical",
        "description": "Georgia Players Guild youth production of the beloved Broadway musical based on SpongeBob SquarePants.",
    },
    {
        "title": "The SpongeBob Musical - Youth Edition",
        "start_date": "2026-04-23",
        "start_time": "18:00",
        "category": "theater",
        "subcategory": "musical",
        "description": "Georgia Players Guild youth production of the beloved Broadway musical based on SpongeBob SquarePants.",
    },
    # May
    {
        "title": "Jazz Talk with Trey Wright",
        "start_date": "2026-05-14",
        "start_time": "19:30",
        "category": "music",
        "subcategory": "jazz",
        "description": "Interactive jazz performance and discussion with acclaimed guitarist Trey Wright.",
    },
    # August - Cobb International Film Festival
    {
        "title": "Cobb International Film Festival",
        "start_date": "2026-08-06",
        "start_time": "18:00",
        "category": "film",
        "subcategory": "festival",
        "description": "Opening night of the Cobb International Film Festival showcasing independent films from around the world.",
    },
    {
        "title": "Cobb International Film Festival",
        "start_date": "2026-08-07",
        "start_time": "12:00",
        "category": "film",
        "subcategory": "festival",
        "description": "Day 2 of the Cobb International Film Festival with screenings throughout the day.",
    },
    {
        "title": "Cobb International Film Festival",
        "start_date": "2026-08-08",
        "start_time": "12:00",
        "category": "film",
        "subcategory": "festival",
        "description": "Day 3 of the Cobb International Film Festival with screenings throughout the day.",
    },
    {
        "title": "Cobb International Film Festival",
        "start_date": "2026-08-09",
        "start_time": "12:00",
        "category": "film",
        "subcategory": "festival",
        "description": "Final day and awards ceremony of the Cobb International Film Festival.",
    },
]


def get_tags_for_event(event: dict) -> list[str]:
    """Generate tags based on event category and content."""
    tags = ["marietta", "marietta-square", "strand-theatre"]

    category = event.get("category", "")
    subcategory = event.get("subcategory", "")
    title = event.get("title", "").lower()

    if category == "music":
        tags.append("music")
        tags.append("concert")
        if subcategory == "jazz":
            tags.append("jazz")
        elif subcategory == "tribute":
            tags.append("tribute")
    elif category == "film":
        tags.append("film")
        tags.append("cinema")
        if subcategory == "classic":
            tags.append("classic-film")
        elif subcategory == "cult":
            tags.append("cult-film")
        elif subcategory == "festival":
            tags.append("film-festival")
    elif category == "theater":
        tags.append("theater")
        tags.append("performing-arts")
        if subcategory == "musical":
            tags.append("musical")

    if "youth" in title or "kids" in title:
        tags.append("family")

    return tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Earl Smith Strand Theatre events using known shows data."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    venue_id = get_or_create_venue(VENUE_DATA)

    for event in KNOWN_EVENTS_2026:
        start_date = event["start_date"]

        # Skip past events
        try:
            event_date = datetime.strptime(start_date, "%Y-%m-%d")
            if event_date.date() < now.date():
                continue
        except ValueError:
            continue

        events_found += 1

        title = event["title"]
        start_time = event.get("start_time")

        # Generate unique hash including time for same-day events
        hash_key = f"{title}|{start_date}|{start_time}" if start_time else f"{title}|{start_date}"
        content_hash = generate_content_hash(title, "Earl Smith Strand Theatre", hash_key)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        tags = get_tags_for_event(event)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": event.get("description", f"{title} at the historic Strand Theatre in Marietta Square"),
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": start_time is None,
            "category": event.get("category", "performing-arts"),
            "subcategory": event.get("subcategory"),
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Tickets at earlsmithstrand.org",
            "is_free": False,
            "source_url": f"{BASE_URL}/events/",
            "ticket_url": "https://thestrand.my.salesforce-sites.com/ticket/",
            "image_url": None,
            "raw_text": f"{title} at Earl Smith Strand Theatre on {start_date}",
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date} at {start_time or 'TBD'}")
        except Exception as e:
            logger.error(f"Failed to insert: {title}: {e}")

    logger.info(
        f"Strand Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
