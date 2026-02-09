"""
Crawler for Piedmont Transplant Institute Support Groups.
(piedmont.org/transplant/services-treatments/support-group)

Recurring support groups for transplant patients and caregivers.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from calendar import monthrange
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page

PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.piedmont.org"
SUPPORT_GROUP_URL = f"{BASE_URL}/transplant/services-treatments/support-group"

VENUE_DATA = {
    "name": "Piedmont Transplant Institute",
    "slug": "piedmont-transplant-institute",
    "address": "1968 Peachtree Road NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "hospital",
    "website": f"{BASE_URL}/transplant",
}

# Known recurring support groups
SUPPORT_GROUPS = [
    {
        "title": "Kidney Transplant Support Group",
        "description": "Monthly support group for kidney transplant recipients and their caregivers. Facilitated by Piedmont Transplant Institute social workers.",
        "schedule": "first_wednesday",
        "time": "18:00",
        "is_virtual": True,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "transplant", "kidney", "support-group", "healthcare", "virtual"],
    },
    {
        "title": "Liver Transplant Support Group",
        "description": "Monthly support group for liver transplant recipients and their caregivers. Connect with others who understand your journey.",
        "schedule": "second_wednesday",
        "time": "18:00",
        "is_virtual": True,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "transplant", "liver", "support-group", "healthcare", "virtual"],
    },
    {
        "title": "Pre-Transplant Education Class",
        "description": "Educational session for patients and families considering or waiting for transplant. Learn about the process, expectations, and resources.",
        "schedule": "third_thursday",
        "time": "14:00",
        "is_virtual": False,
        "category": "learning",
        "subcategory": "health-education",
        "tags": ["piedmont", "transplant", "education", "healthcare", "class"],
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


def parse_schedule(schedule: str, year: int, month: int) -> Optional[datetime]:
    """Parse schedule string like 'first_wednesday' to a date."""
    parts = schedule.split("_")
    if len(parts) != 2:
        return None

    ordinal_map = {"first": 1, "second": 2, "third": 3, "fourth": 4}
    weekday_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }

    ordinal = ordinal_map.get(parts[0])
    weekday = weekday_map.get(parts[1])

    if ordinal is None or weekday is None:
        return None

    return get_nth_weekday(year, month, weekday, ordinal)


def generate_upcoming_dates(schedule: str, months_ahead: int = 3) -> list[str]:
    """Generate dates for the next N months based on schedule."""
    dates = []
    now = datetime.now()

    for month_offset in range(months_ahead + 1):
        year = now.year
        month = now.month + month_offset
        while month > 12:
            month -= 12
            year += 1

        dt = parse_schedule(schedule, year, month)
        if dt and dt >= now:
            dates.append(dt.strftime("%Y-%m-%d"))

    return dates


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont Transplant Institute support groups."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        # First, verify the page and scrape any additional events
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            )
            page = context.new_page()

            logger.info(f"Fetching Piedmont Transplant Support: {SUPPORT_GROUP_URL}")
            try:
                page.goto(SUPPORT_GROUP_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)

                # Extract images from page
                image_map = extract_images_from_page(page)
                body_text = page.inner_text("body")
                logger.info(f"Page loaded, content length: {len(body_text)}")

                # Try to extract any specific dates mentioned
                lines = [line.strip() for line in body_text.split("\n") if line.strip()]

                for i, line in enumerate(lines):
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
                                if dt.date() >= datetime.now().date():
                                    # Found a specific event date - add it
                                    events_found += 1
                                    # (We'll rely on the recurring events below)
                            except ValueError:
                                pass

            except Exception as e:
                logger.warning(f"Could not fetch page, using known schedule: {e}")

            browser.close()

        # Generate events from known recurring schedules
        venue_id = get_or_create_venue(VENUE_DATA)

        for group in SUPPORT_GROUPS:
            dates = generate_upcoming_dates(group["schedule"], months_ahead=3)

            for start_date in dates:
                events_found += 1

                title = group["title"]
                venue_name = "Virtual (Zoom)" if group["is_virtual"] else VENUE_DATA["name"]

                content_hash = generate_content_hash(
                    title, venue_name, start_date
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                description = group["description"]
                if group["is_virtual"]:
                    description += " This group meets virtually via Zoom."

                image_url = image_map.get(title)

                # Build series_hint
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "monthly",
                    "description": description,
                }
                if image_url:
                    series_hint["image_url"] = image_url

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "portal_id": portal_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": group["time"],
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": group["category"],
                    "subcategory": group["subcategory"],
                    "tags": group["tags"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free for transplant patients and caregivers",
                    "is_free": True,
                    "source_url": SUPPORT_GROUP_URL,
                    "ticket_url": SUPPORT_GROUP_URL,
                    "image_url": image_url,
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.9,
                    "is_recurring": True,
                    "recurrence_rule": f"MONTHLY;{group['schedule'].upper()}",
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Piedmont Transplant crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Transplant: {e}")
        raise

    return events_found, events_new, events_updated
