"""
Crawler for Halfway Crooks Beer (halfwaycrooks.beer).
Craft brewery in Summerhill with taproom events.

Site uses JavaScript rendering - must use Playwright.
Also generates recurring Wednesday trivia (Geeks Who Drink) and Sunday run club.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://halfwaycrooks.beer"
EVENTS_URL = f"{BASE_URL}/events"

WEEKS_AHEAD = 6

VENUE_DATA = {
    "name": "Halfway Crooks Beer",
    "slug": "halfway-crooks",
    "address": "60 Georgia Ave SE",
    "neighborhood": "Summerhill",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7402,
    "lng": -84.3850,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["brewery", "craft-beer", "european-style", "rooftop", "summerhill"],
}

WEEKLY_SCHEDULE = [
    {
        "day": 2,  # Wednesday
        "title": "Geeks Who Drink Trivia at Halfway Crooks",
        "description": (
            "Wednesday trivia night at Halfway Crooks Beer in Summerhill. "
            "Geeks Who Drink pub quiz on the rooftop with craft lagers and ales."
        ),
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "nightlife", "weekly", "brewery", "geeks-who-drink"],
    },
    {
        "day": 6,  # Sunday
        "title": "Run Club at Halfway Crooks",
        "description": (
            "Sunday run club at Halfway Crooks Beer in Summerhill. "
            "Community run starting at 6:45pm, followed by post-run beers on the rooftop."
        ),
        "start_time": "18:45",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["run-club", "running", "fitness", "weekly", "brewery", "summerhill"],
    },
]

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _generate_recurring_events(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Generate recurring trivia events for Halfway Crooks."""
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in WEEKLY_SCHEDULE:
        next_date = get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name.lower(),
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], VENUE_DATA["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template.get("subcategory"),
                "tags": template["tags"],
                "is_free": True,
                "price_min": None,
                "price_max": None,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} at Halfway Crooks Beer - {start_date}",
                "extraction_confidence": 0.90,
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
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {template['title']} on {start_date}: {exc}")

    return events_found, events_new, events_updated


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
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)


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

        logger.info(f"Halfway Crooks scrape complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Halfway Crooks: {e}")
        raise

    # Generate recurring trivia events
    venue_id = get_or_create_venue(VENUE_DATA)
    r_found, r_new, r_updated = _generate_recurring_events(source_id, venue_id)
    events_found += r_found
    events_new += r_new
    events_updated += r_updated

    logger.info(
        f"Halfway Crooks crawl complete (incl. recurring): {events_found} found, {events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
