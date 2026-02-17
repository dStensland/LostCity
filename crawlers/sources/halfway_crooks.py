"""
Crawler for Halfway Crooks.
Craft brewery with taproom events and live music.

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.halfwaycrooks.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Halfway Crooks",
    "slug": "halfway-crooks",
    "address": "479 Flat Shoals Ave SE",
    "neighborhood": "Summerhill",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "brewery",
    "website": BASE_URL,
    "description": "Craft brewery in Summerhill with rooftop bar, Czech Beer Days festival, and regular events.",
}


def parse_time(time_text: str) -> Optional[str]:
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


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

            logger.info(f"Fetching Halfway Crooks: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract events from links - dates are in the URL like:
            # https://halfwaycrooks.beer/events/hc-trivia-night-2-2026-01-21/
            links = page.query_selector_all("a")
            seen_events = set()

            for link in links:
                href = link.get_attribute("href") or ""
                title = link.inner_text().strip()

                if not href or not title:
                    continue

                # Look for event links with dates in URL
                # Format: /events/event-name-YYYY-MM-DD/
                date_match = re.search(r"/events/[^/]+-(\d{4})-(\d{2})-(\d{2})/?", href)
                if not date_match:
                    continue

                year, month, day = date_match.groups()
                start_date = f"{year}-{month}-{day}"

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d")
                    if event_date.date() < datetime.now().date():
                        continue
                except ValueError:
                    continue

                # Skip duplicates (same title + date)
                event_key = (title, start_date)
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)

                # Skip navigation/footer links
                if len(title) < 3 or title.lower() in ["events", "view calendar", "private events"]:
                    continue

                events_found += 1
                content_hash = generate_content_hash(title, "Halfway Crooks", start_date)


                # Determine event type and time based on title
                start_time = "19:00"  # Default evening
                subcategory = None
                is_recurring = False

                if "trivia" in title.lower():
                    start_time = "19:00"
                    subcategory = "trivia"
                    is_recurring = True
                elif "run club" in title.lower():
                    start_time = "18:30"
                    subcategory = "fitness"
                elif "vinyl" in title.lower():
                    subcategory = "music"

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": "Event at Halfway Crooks",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "food_drink",
                    "subcategory": subcategory,
                    "tags": ["brewery", "craft-beer", "summerhill", "taproom"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": href if href.startswith("http") else f"https://halfwaycrooks.beer{href}",
                    "ticket_url": None,
                    "image_url": image_map.get(title),
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.85,
                    "is_recurring": is_recurring,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(f"Halfway Crooks crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Halfway Crooks: {e}")
        raise

    return events_found, events_new, events_updated
