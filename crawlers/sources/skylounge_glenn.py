"""
Crawler for Skylounge at Glenn Hotel (glennhotel.com/skylounge).
Rooftop bar and lounge with views of downtown Atlanta.
While they don't have a public events calendar, we monitor for special events.
"""

from __future__ import annotations

import logging
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://glennhotel.com"
SKYLOUNGE_URL = f"{BASE_URL}/skylounge"

VENUE_DATA = {
    "name": "Skylounge at Glenn Hotel",
    "slug": "skylounge-glenn-hotel",
    "address": "110 Marietta St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "bar",
    "website": SKYLOUNGE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Skylounge at Glenn Hotel.

    Note: Glenn Hotel/Skylounge doesn't typically maintain a public events calendar.
    This crawler checks for any announced special events but will usually return 0 events.
    Consider this a monitoring crawler for when they do post events.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(SKYLOUNGE_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Look for any event announcements in the page content
        # This is speculative - they may not have regular events posted
        event_sections = soup.find_all(["article", "div"], class_=lambda x: x and "event" in x.lower())

        if not event_sections:
            logger.info("No events calendar found on Skylounge page")
            return events_found, events_new, events_updated

        # If events are found, parse them
        for section in event_sections:
            try:
                title_elem = section.find(["h1", "h2", "h3", "h4"])
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)

                # Try to find date info
                # This is speculative as we don't know their exact format
                date_elem = section.find(["time", "span"], class_=lambda x: x and "date" in x.lower())
                if not date_elem:
                    continue

                # For now, we'll log and skip since we don't have actual event structure
                logger.info(f"Found potential event: {title}")

            except Exception as e:
                logger.debug(f"Failed to parse potential event: {e}")
                continue

        logger.info(
            f"Skylounge crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Skylounge: {e}")
        raise

    return events_found, events_new, events_updated
