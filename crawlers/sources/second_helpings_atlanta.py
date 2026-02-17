"""
Crawler for Second Helpings Atlanta (secondhelpingsatlanta.org).
Food rescue nonprofit. Volunteers pick up surplus food from restaurants/caterers
and deliver to shelters and feeding programs.

The site uses custom WordPress blocks. We scrape the volunteer page for
shift information and create recurring volunteer opportunities.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://secondhelpingsatlanta.org"
VOLUNTEER_URL = f"{BASE_URL}/volunteer/"

VENUE_DATA = {
    "name": "Second Helpings Atlanta",
    "slug": "second-helpings-atlanta",
    "address": "665 Amsterdam Ave NE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7681,
    "lng": -84.3651,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "description": "Food rescue nonprofit fighting hunger and food waste by rescuing surplus food and delivering it to partner agencies.",
}


def create_recurring_volunteer_shifts(source_id: int, venue_id: int) -> tuple[int, int]:
    """
    Create recurring volunteer shift opportunities.
    Second Helpings typically has:
    - Morning food rescue shifts (weekdays)
    - Distribution shifts
    - Volunteer orientation sessions (monthly)
    """
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Orientation sessions - first Tuesday of each month
    for months_ahead in range(3):
        # Calculate first Tuesday of the month
        target_month = (now.month + months_ahead - 1) % 12 + 1
        target_year = now.year + (now.month + months_ahead - 1) // 12

        first_day = datetime(target_year, target_month, 1)
        days_until_tuesday = (1 - first_day.weekday()) % 7
        first_tuesday = first_day + timedelta(days=days_until_tuesday)

        if first_tuesday.date() < now.date():
            continue

        title = "Volunteer Orientation"
        start_date = first_tuesday.strftime("%Y-%m-%d")

        description = (
            "Join Second Helpings Atlanta for a volunteer orientation session. "
            "Learn about our food rescue mission and how you can help fight hunger "
            "and food waste in Atlanta. Orientations are required before volunteering."
        )

        content_hash = generate_content_hash(title, "Second Helpings Atlanta", start_date)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "18:00",
            "end_date": None,
            "end_time": "19:00",
            "is_all_day": False,
            "category": "community",
            "tags": ["volunteer", "food-rescue", "orientation", "community"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": VOLUNTEER_URL,
            "ticket_url": VOLUNTEER_URL,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1TU",
            "content_hash": content_hash,
        }

        series_hint = {
            "series_type": "recurring_show",
            "series_title": "Volunteer Orientation",
            "frequency": "monthly",
            "day_of_week": "Tuesday",
            "description": description,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert orientation: {e}")

    return events_new, events_updated


def parse_date_string(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    if not date_str:
        return None

    date_str = date_str.strip()
    now = datetime.now()

    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try partial date
    match = re.search(
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})',
        date_str,
        re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        try:
            dt = datetime.strptime(f"{month_str} {day} {now.year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string into HH:MM format."""
    if not time_str:
        return None

    time_str = time_str.strip()

    match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)', time_str, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        minute = minute or "00"

        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Second Helpings Atlanta volunteer opportunities."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Create recurring orientation sessions
        orientation_new, orientation_updated = create_recurring_volunteer_shifts(source_id, venue_id)
        events_found += 3
        events_new += orientation_new
        events_updated += orientation_updated

        # Scrape for any special events or announcements
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching volunteer page: {VOLUNTEER_URL}")

            try:
                page.goto(VOLUNTEER_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load content
                for _ in range(2):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                # Look for special events
                event_selectors = [".event", "article", ".wp-block-group", "[class*='event']"]

                for selector in event_selectors:
                    elements = page.query_selector_all(selector)
                    if not elements:
                        continue

                    for elem in elements:
                        try:
                            elem_text = elem.inner_text()

                            # Look for dates in text
                            date_match = re.search(
                                r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s+\d{4})?',
                                elem_text,
                                re.IGNORECASE
                            )
                            if not date_match:
                                continue

                            start_date = parse_date_string(date_match.group())
                            if not start_date:
                                continue

                            # Skip past events
                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue

                            # Look for title
                            title_elem = elem.query_selector("h1, h2, h3, h4, strong")
                            if not title_elem:
                                continue

                            title = title_elem.inner_text().strip()
                            if len(title) < 5 or "orientation" in title.lower():
                                continue

                            events_found += 1

                            # Look for time
                            time_match = re.search(r'\d{1,2}:?\d{0,2}\s*(?:am|pm)', elem_text, re.IGNORECASE)
                            start_time = parse_time_string(time_match.group()) if time_match else None

                            description = f"Special event at Second Helpings Atlanta. {elem_text[:200]}"

                            content_hash = generate_content_hash(title, "Second Helpings Atlanta", start_date)

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description[:2000],
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,  # Set explicitly, not inferred from missing time
                                "category": "community",
                                "tags": ["volunteer", "food-rescue", "community"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": True,
                                "source_url": VOLUNTEER_URL,
                                "ticket_url": None,
                                "image_url": None,
                                "raw_text": elem_text[:500],
                                "extraction_confidence": 0.75,
                                "is_recurring": False,
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
                                logger.error(f"Failed to insert event: {e}")

                        except Exception as e:
                            logger.debug(f"Error processing element: {e}")
                            continue

            except Exception as e:
                logger.warning(f"Error loading volunteer page: {e}")

            browser.close()

        logger.info(
            f"Second Helpings Atlanta crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Second Helpings Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
