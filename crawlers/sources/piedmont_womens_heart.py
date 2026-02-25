"""
Crawler for Piedmont Women's Heart Support Network.
(piedmont.org/heart/services-and-programs/womens-heart/dottie-fuqua-womens-heart-support-network)

Events include support group meetings, classes, and wellness events for women with heart conditions.
Often uses Calendly for scheduling.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from calendar import monthrange
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page

PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.piedmont.org"
WOMENS_HEART_URL = f"{BASE_URL}/heart/services-and-programs/womens-heart/dottie-fuqua-womens-heart-support-network"

VENUE_DATA = {
    "name": "Piedmont Women's Heart Center",
    "slug": "piedmont-womens-heart-center",
    "address": "1968 Peachtree Road NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "hospital",
    "website": WOMENS_HEART_URL,
}

# Known recurring events from the Dottie Fuqua Women's Heart Support Network
RECURRING_EVENTS = [
    {
        "title": "Women's Heart Support Network Meeting",
        "description": "Monthly support group for women with heart conditions. Part of the Dottie Fuqua Women's Heart Support Network at Piedmont Heart Institute.",
        "schedule": "second_thursday",
        "time": "12:00",
        "is_virtual": True,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "womens-health", "heart", "support-group", "cardiology", "virtual"],
    },
    {
        "title": "Go Red for Women Wellness Event",
        "description": "Annual wellness event supporting women's heart health awareness. Part of the American Heart Association's Go Red for Women campaign.",
        "schedule": "february_first_friday",
        "time": "10:00",
        "is_virtual": False,
        "category": "wellness",
        "subcategory": "health-screening",
        "tags": ["piedmont", "womens-health", "heart", "go-red", "wellness", "screening"],
    },
]


def get_nth_weekday(year: int, month: int, weekday: int, n: int) -> Optional[datetime]:
    """Get the nth occurrence of a weekday in a month."""
    first_day = datetime(year, month, 1)
    first_weekday = first_day.weekday()
    days_until = (weekday - first_weekday) % 7
    first_occurrence = 1 + days_until
    target_day = first_occurrence + (n - 1) * 7

    _, last_day = monthrange(year, month)
    if target_day > last_day:
        return None

    return datetime(year, month, target_day)


def generate_upcoming_dates(schedule: str, months_ahead: int = 3) -> list[str]:
    """Generate dates for the next N months based on schedule."""
    dates = []
    now = datetime.now()

    # Handle special February event
    if schedule == "february_first_friday":
        year = now.year
        if now.month > 2:
            year += 1
        dt = get_nth_weekday(year, 2, 4, 1)  # First Friday of February
        if dt:
            dates.append(dt.strftime("%Y-%m-%d"))
        return dates

    # Parse regular schedules like "second_thursday"
    parts = schedule.split("_")
    if len(parts) != 2:
        return dates

    ordinal_map = {"first": 1, "second": 2, "third": 3, "fourth": 4}
    weekday_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }

    ordinal = ordinal_map.get(parts[0])
    weekday = weekday_map.get(parts[1])

    if ordinal is None or weekday is None:
        return dates

    for month_offset in range(months_ahead + 1):
        year = now.year
        month = now.month + month_offset
        while month > 12:
            month -= 12
            year += 1

        dt = get_nth_weekday(year, month, weekday, ordinal)
        if dt and dt >= now:
            dates.append(dt.strftime("%Y-%m-%d"))

    return dates


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont Women's Heart Support Network events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        # First, verify the page is accessible
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            )
            page = context.new_page()

            logger.info(f"Fetching Piedmont Women's Heart: {WOMENS_HEART_URL}")
            try:
                page.goto(WOMENS_HEART_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)

                # Extract images from page
                image_map = extract_images_from_page(page)

                # Scroll to load content
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                body_text = page.inner_text("body")

                # Look for Calendly links or other scheduling info
                calendly_links = page.locator("a[href*='calendly']").all()
                if calendly_links:
                    logger.info(f"Found {len(calendly_links)} Calendly links")

                # Also try to extract any event dates from page content
                lines = [line.strip() for line in body_text.split("\n") if line.strip()]

                skip_items = [
                    "home", "about", "contact", "menu", "search", "piedmont",
                    "heart", "skip to", "services", "programs",
                ]

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Look for date patterns
                    date_match = re.search(
                        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:-\d{1,2})?,?\s+\d{4}",
                        line,
                        re.IGNORECASE
                    )

                    if date_match:
                        date_text = date_match.group(0)
                        date_text = re.sub(r"-\d{1,2}", "", date_text)

                        match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
                            date_text,
                            re.IGNORECASE
                        )

                        if match:
                            month, day, year = match.groups()
                            try:
                                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                                start_date = dt.strftime("%Y-%m-%d")

                                if dt.date() >= datetime.now().date():
                                    # Look for title
                                    title = None
                                    for offset in range(-3, 0):
                                        idx = i + offset
                                        if 0 <= idx < len(lines):
                                            check_line = lines[idx].strip()
                                            if check_line.lower() not in skip_items and 10 < len(check_line) < 100:
                                                title = check_line
                                                break

                                    if title:
                                        events_found += 1
                                        venue_id = get_or_create_venue(VENUE_DATA)

                                        content_hash = generate_content_hash(
                                            title, VENUE_DATA["name"], start_date
                                        )

                                        existing = find_event_by_hash(content_hash)
                                        if not existing:
                                            event_record = {
                                                "source_id": source_id,
                                                "venue_id": venue_id,
                                                "portal_id": portal_id,
                                                "title": title,
                                                "description": None,
                                                "start_date": start_date,
                                                "start_time": None,
                                                "end_date": None,
                                                "end_time": None,
                                                "is_all_day": True,
                                                "category": "wellness",
                                                "subcategory": "womens-health",
                                                "tags": ["piedmont", "womens-health", "heart", "cardiology"],
                                                "price_min": None,
                                                "price_max": None,
                                                "price_note": "Registration required",
                                                "is_free": True,
                                                "source_url": WOMENS_HEART_URL,
                                                "ticket_url": WOMENS_HEART_URL,
                                                "image_url": image_map.get(title),
                                                "raw_text": f"{title} - {start_date}",
                                                "extraction_confidence": 0.8,
                                                "is_recurring": False,
                                                "recurrence_rule": None,
                                                "content_hash": content_hash,
                                            }

                                            try:
                                                insert_event(event_record)
                                                events_new += 1
                                                logger.info(f"Added: {title} on {start_date}")
                                            except Exception as e:
                                                logger.error(f"Failed to insert: {title}: {e}")
                                        else:
                                            events_updated += 1

                            except ValueError:
                                pass

                    i += 1

            except Exception as e:
                logger.warning(f"Could not fetch page: {e}")

            browser.close()

        # Generate events from known recurring schedules
        venue_id = get_or_create_venue(VENUE_DATA)

        for event_template in RECURRING_EVENTS:
            dates = generate_upcoming_dates(event_template["schedule"], months_ahead=3)

            for start_date in dates:
                events_found += 1

                title = event_template["title"]
                venue_name = "Virtual (Zoom)" if event_template["is_virtual"] else VENUE_DATA["name"]

                content_hash = generate_content_hash(
                    title, venue_name, start_date
                )

                description = event_template["description"]
                if event_template["is_virtual"]:
                    description += " This event meets virtually via Zoom."

                image_url = image_map.get(title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "portal_id": portal_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": event_template["time"],
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": event_template["category"],
                    "subcategory": event_template["subcategory"],
                    "tags": event_template["tags"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free for participants",
                    "is_free": True,
                    "source_url": WOMENS_HEART_URL,
                    "ticket_url": WOMENS_HEART_URL,
                    "image_url": image_url,
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.9,
                    "is_recurring": True,
                    "recurrence_rule": f"MONTHLY;{event_template['schedule'].upper()}",
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                # Build series_hint
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "monthly" if "monthly" in event_template["schedule"].lower() else "annual",
                    "description": description,
                }
                if image_url:
                    series_hint["image_url"] = image_url

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Piedmont Women's Heart crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Women's Heart: {e}")
        raise

    return events_found, events_new, events_updated
