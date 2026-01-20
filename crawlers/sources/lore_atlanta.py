"""
Crawler for Lore Atlanta.
New LGBTQ+ club with dancing, drag shows, karaoke, and crafting nights.

Recurring weekly events:
- Tuesday: Karaoke @ 8pm
- Wednesday: Trivia @ 8pm
- Thursday: Drag Bingo @ 8pm
- Friday: The Other Show @ 9pm
- Sunday: Tossed Salad @ 9pm
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://loreatl.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Lore Atlanta",
    "slug": "lore-atlanta",
    "address": "466 Edgewood Ave SE",
    "neighborhood": "Edgewood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "bar",
    "website": BASE_URL,
}

# Weekly recurring events
WEEKLY_EVENTS = [
    {"weekday": 1, "title": "Karaoke Night", "time": "20:00", "description": "Weekly karaoke night at Lore Atlanta. Sing your heart out!"},
    {"weekday": 2, "title": "Trivia Night", "time": "20:00", "description": "Weekly trivia night at Lore Atlanta. Test your knowledge!"},
    {"weekday": 3, "title": "Drag Bingo", "time": "20:00", "description": "Weekly drag bingo at Lore Atlanta. Fun, prizes, and fabulous hosts!"},
    {"weekday": 4, "title": "The Other Show", "time": "21:00", "description": "Weekly drag and variety show at Lore Atlanta."},
    {"weekday": 6, "title": "Tossed Salad", "time": "21:00", "description": "Weekly Sunday night show at Lore Atlanta."},
]


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Lore Atlanta: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Generate next 3 months of recurring events
            current_date = datetime.now()
            end_date = current_date + timedelta(days=90)

            for event_info in WEEKLY_EVENTS:
                weekday = event_info["weekday"]
                title = event_info["title"]
                time = event_info["time"]
                description = event_info["description"]

                # Find the next occurrence of this weekday
                current = current_date
                while current.weekday() != weekday:
                    current += timedelta(days=1)

                # Generate all occurrences
                while current <= end_date:
                    events_found += 1
                    start_date_str = current.strftime("%Y-%m-%d")

                    content_hash = generate_content_hash(title, "Lore Atlanta", start_date_str)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        current += timedelta(days=7)
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date_str,
                        "start_time": time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "nightlife",
                        "subcategory": "lgbtq",
                        "tags": ["lgbtq", "queer", "drag", "edgewood", "nightlife"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": EVENTS_URL,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": f"{title} at Lore Atlanta - {start_date_str}",
                        "extraction_confidence": 0.90,
                        "is_recurring": True,
                        "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][weekday]}",
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date_str}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                    current += timedelta(days=7)

            browser.close()

        logger.info(f"Lore Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Lore Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
