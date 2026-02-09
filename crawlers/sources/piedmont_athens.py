"""
Crawler for Piedmont Athens Regional Spiritual Care and Support Groups.
(piedmont.org/locations/piedmont-athens/piedmont-athens-chapel-and-healing-places)

Events include chapel services, support groups, and spiritual care programs.
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
ATHENS_CHAPEL_URL = f"{BASE_URL}/locations/piedmont-athens/piedmont-athens-chapel-and-healing-places"

VENUE_DATA = {
    "name": "Piedmont Athens Regional Medical Center",
    "slug": "piedmont-athens-regional",
    "address": "1199 Prince Avenue",
    "neighborhood": None,
    "city": "Athens",
    "state": "GA",
    "zip": "30606",
    "venue_type": "hospital",
    "website": f"{BASE_URL}/locations/piedmont-athens",
}

# Known recurring spiritual care events
RECURRING_EVENTS = [
    {
        "title": "Chapel Meditation Service",
        "description": "Weekly meditation and reflection service in the Piedmont Athens Regional chapel. Open to patients, families, and staff. Non-denominational.",
        "schedule": "weekly_wednesday",
        "time": "12:00",
        "duration_hours": 0.5,
        "is_virtual": False,
        "category": "community",
        "subcategory": "spiritual",
        "tags": ["piedmont", "spiritual", "chapel", "meditation", "athens", "healthcare"],
    },
    {
        "title": "Grief Support Group",
        "description": "Monthly grief support group facilitated by Piedmont Athens spiritual care team. Open to community members experiencing loss.",
        "schedule": "second_monday",
        "time": "18:00",
        "duration_hours": 1.5,
        "is_virtual": False,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "grief", "support-group", "spiritual", "athens", "healthcare"],
    },
    {
        "title": "Caregiver Support Circle",
        "description": "Monthly support group for family caregivers. Share experiences, learn coping strategies, and connect with others on similar journeys.",
        "schedule": "fourth_tuesday",
        "time": "14:00",
        "duration_hours": 1,
        "is_virtual": False,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "caregiver", "support-group", "athens", "healthcare"],
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

    # Handle weekly schedule
    if schedule.startswith("weekly_"):
        weekday_name = schedule.split("_")[1]
        weekday_map = {
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6
        }
        weekday = weekday_map.get(weekday_name)
        if weekday is None:
            return dates

        # Generate next 12 weeks
        from datetime import timedelta
        current = now
        days_until = (weekday - current.weekday()) % 7
        if days_until == 0 and current.hour >= 18:  # Past today's event
            days_until = 7
        next_occurrence = current + timedelta(days=days_until)

        for _ in range(12):
            dates.append(next_occurrence.strftime("%Y-%m-%d"))
            next_occurrence += timedelta(days=7)

        return dates

    # Parse monthly schedules like "second_monday"
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
    """Crawl Piedmont Athens spiritual care events."""
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

            logger.info(f"Fetching Piedmont Athens Chapel: {ATHENS_CHAPEL_URL}")
            try:
                page.goto(ATHENS_CHAPEL_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)

                # Extract images from page
                image_map = extract_images_from_page(page)
                body_text = page.inner_text("body")
                logger.info(f"Page loaded, content length: {len(body_text)}")

                # Try to extract any specific events mentioned
                lines = [line.strip() for line in body_text.split("\n") if line.strip()]

                skip_items = [
                    "home", "about", "contact", "menu", "locations", "piedmont",
                    "athens", "skip to", "services",
                ]

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
                                        start_date = dt.strftime("%Y-%m-%d")

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
                                                "category": "community",
                                                "subcategory": "spiritual",
                                                "tags": ["piedmont", "athens", "spiritual", "healthcare"],
                                                "price_min": None,
                                                "price_max": None,
                                                "price_note": "Free and open to all",
                                                "is_free": True,
                                                "source_url": ATHENS_CHAPEL_URL,
                                                "ticket_url": ATHENS_CHAPEL_URL,
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

                content_hash = generate_content_hash(
                    title, VENUE_DATA["name"], start_date
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                description = event_template["description"]
                image_url = image_map.get(title)

                # Build series_hint
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "weekly" if "weekly" in event_template["schedule"] else "monthly",
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
                    "start_time": event_template["time"],
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": event_template["category"],
                    "subcategory": event_template["subcategory"],
                    "tags": event_template["tags"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free and open to all",
                    "is_free": True,
                    "source_url": ATHENS_CHAPEL_URL,
                    "ticket_url": ATHENS_CHAPEL_URL,
                    "image_url": image_url,
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.9,
                    "is_recurring": True,
                    "recurrence_rule": f"{event_template['schedule'].upper()}",
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Piedmont Athens crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Athens: {e}")
        raise

    return events_found, events_new, events_updated
