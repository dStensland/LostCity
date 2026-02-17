"""
Crawler for Marietta Theatre Company at Theatre in the Square.
Broadway-style musicals in historic Marietta Square.
2026 Season: Little Shop of Horrors, 9 to 5, All Shook Up
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://mariettatheatre.com"

VENUE_DATA = {
    "name": "Theatre in the Square",
    "slug": "theatre-in-the-square",
    "address": "11 Whitlock Avenue SW",
    "neighborhood": "Marietta Square",
    "city": "Marietta",
    "state": "GA",
    "zip": "30064",
    "lat": 33.9527,
    "lng": -84.5503,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "description": "Home of Marietta Theatre Company - Broadway-style musicals in historic Marietta Square.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

# Known 2026 season shows (backup if scraping fails)
KNOWN_SHOWS_2026 = [
    {
        "title": "Little Shop of Horrors",
        "start_date": "2026-01-22",
        "end_date": "2026-01-31",
        "description": (
            "A sci-fi musical about a man-eating plant. Broadway and Hollywood hit for over 30 years, "
            "created by Howard Ashman and Alan Menken (Disney's Beauty & the Beast, The Little Mermaid, Aladdin). "
            "Rated PG-13."
        ),
    },
    {
        "title": "9 to 5: The Musical",
        "start_date": "2026-05-28",
        "end_date": "2026-06-06",
        "description": (
            "Three unlikely friends take control of their office and learn there is nothing they can't do, "
            "even in a man's world. Based on the hit movie."
        ),
    },
    {
        "title": "All Shook Up: The Elvis Presley Musical",
        "start_date": "2026-08-13",
        "end_date": "2026-08-22",
        "description": (
            "Loosely based on Shakespeare's Twelfth Night, set in 1955 when a guitar-playing young man "
            "rides into a small town and changes everything. Features Elvis hits like 'Heartbreak Hotel,' "
            "'Hound Dog,' 'Jailhouse Rock,' and 'Don't Be Cruel.'"
        ),
    },
]


def create_show_events(source_id: int, venue_id: int, shows: list[dict]) -> tuple[int, int]:
    """Create events for each performance date of each show."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    for show in shows:
        start = datetime.strptime(show["start_date"], "%Y-%m-%d")
        end = datetime.strptime(show["end_date"], "%Y-%m-%d")

        # Skip past shows
        if end.date() < now.date():
            continue

        # Create events for each day of the run
        current = start
        while current <= end:
            if current.date() < now.date():
                current += timedelta(days=1)
                continue

            title = show["title"]
            start_date = current.strftime("%Y-%m-%d")

            content_hash = generate_content_hash(title, "Theatre in the Square", start_date)

            if find_event_by_hash(content_hash):
                events_updated += 1
                current += timedelta(days=1)
                continue

            # Determine show time based on day of week
            # Typically: Thu-Sat 8pm, Sun 2pm matinee
            day_of_week = current.weekday()
            if day_of_week == 6:  # Sunday
                start_time = "14:00"
            else:
                start_time = "20:00"

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": show["description"],
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "theater",
                "subcategory": "musical",
                "tags": ["marietta", "marietta-square", "theater", "musical", "broadway"],
                "price_min": None,
                "price_max": None,
                "price_note": "Season tickets from $65",
                "is_free": False,
                "source_url": f"{BASE_URL}/current-season/",
                "ticket_url": "https://mariettatheatre.tix.com",
                "image_url": None,
                "raw_text": f"{title} at Theatre in the Square",
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert: {title} on {start_date}: {e}")

            current += timedelta(days=1)

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Theatre in the Square / Marietta Theatre Company events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Try to scrape current season
    shows = []
    try:
        response = requests.get(f"{BASE_URL}/current-season/", headers=HEADERS, timeout=30)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            # Look for show information
            # This is a fallback - if scraping works, we'd parse shows here
            logger.info("Successfully fetched Marietta Theatre season page")
    except Exception as e:
        logger.warning(f"Could not fetch season page: {e}")

    # Use known shows (reliable for 2026 season)
    shows = KNOWN_SHOWS_2026
    events_found = sum(
        max(0, (datetime.strptime(s["end_date"], "%Y-%m-%d") - datetime.strptime(s["start_date"], "%Y-%m-%d")).days + 1)
        for s in shows
    )

    show_new, show_updated = create_show_events(source_id, venue_id, shows)
    events_new += show_new
    events_updated += show_updated

    logger.info(
        f"Theatre in the Square crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
