"""
Crawler for PushPush Arts (pushpusharts.com/calendar).

Site uses Squarespace - needs Playwright for JS rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.pushpusharts.com"
EVENTS_URL = "https://www.pushpusharts.com/calendar"

VENUE_DATA = {
    "name": "PushPush Arts",
    "slug": "pushpush-theater",  # Keep existing slug for continuity
    "address": "1805 Harvard Ave",
    "neighborhood": "College Park",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> list[tuple[str, str]]:
    """
    Parse date ranges like 'Jan. 23 - Feb. 7' into individual show dates.
    Returns list of (date, day_of_week) tuples for Fridays and Saturdays.
    """
    dates = []

    # Match patterns like "Jan. 23 - Feb. 7" or "Jan 23 - Feb 7"
    match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})\s*-\s*"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})",
        date_text,
        re.IGNORECASE
    )

    if match:
        start_month, start_day, end_month, end_day = match.groups()
        year = 2026  # Current year

        try:
            start_date = datetime.strptime(f"{start_month} {start_day} {year}", "%b %d %Y")
            end_date = datetime.strptime(f"{end_month} {end_day} {year}", "%b %d %Y")

            # If end date is before start date, it spans into next year
            if end_date < start_date:
                end_date = datetime.strptime(f"{end_month} {end_day} {year + 1}", "%b %d %Y")

            # Generate all Fridays and Saturdays in the range
            current = start_date
            while current <= end_date:
                if current.weekday() in [4, 5]:  # Friday = 4, Saturday = 5
                    day_name = "Friday" if current.weekday() == 4 else "Saturday"
                    dates.append((current.strftime("%Y-%m-%d"), day_name))
                current += timedelta(days=1)

        except ValueError as e:
            logger.warning(f"Could not parse date range: {date_text} - {e}")

    return dates


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:30 PM' format to 24-hour."""
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
    """Crawl PushPush Arts events."""
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

            logger.info(f"Fetching PushPush Arts: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for event titles and date patterns
            i = 0
            while i < len(lines):
                line = lines[i]

                # Look for date range patterns like "Jan. 23 - Feb. 7"
                if re.search(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*\d{1,2}\s*-", line, re.IGNORECASE):
                    date_line = line

                    # Look backwards for the title (usually 1-3 lines before)
                    title = None
                    for j in range(i - 1, max(i - 5, -1), -1):
                        candidate = lines[j]
                        # Skip navigation, short lines, URLs
                        if len(candidate) < 5:
                            continue
                        if candidate.lower() in ["events", "calendar", "upcoming events", "home", "about"]:
                            continue
                        if candidate.startswith("http"):
                            continue
                        # Found a potential title
                        title = candidate
                        break

                    if not title:
                        i += 1
                        continue

                    # Look for time info
                    time_text = None
                    for j in range(i, min(i + 5, len(lines))):
                        if "PM" in lines[j].upper() or "AM" in lines[j].upper():
                            time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM))", lines[j], re.IGNORECASE)
                            if time_match:
                                time_text = time_match.group(1)
                                break

                    start_time = parse_time(time_text) if time_text else None

                    # Look for description
                    description = None
                    for j in range(i + 1, min(i + 10, len(lines))):
                        candidate = lines[j]
                        if len(candidate) > 50 and not candidate.startswith("http"):
                            description = candidate
                            break

                    # Parse date range to get individual show dates
                    show_dates = parse_date_range(date_line)

                    for start_date, day_name in show_dates:
                        # Skip past dates
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue

                        events_found += 1
                        event_title = f"{title} ({day_name})"

                        content_hash = generate_content_hash(title, "PushPush Arts", start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": start_time is None,
                            "category": "theater",
                            "subcategory": "experimental",
                            "tags": ["theater", "experimental", "short-plays"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Donation-based",
                            "is_free": False,
                            "source_url": EVENTS_URL,
                            "ticket_url": EVENTS_URL,
                            "image_url": None,
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.85,
                            "is_recurring": True,
                            "recurrence_rule": "Weekly on Fri, Sat",
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"PushPush Arts crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl PushPush Arts: {e}")
        raise

    return events_found, events_new, events_updated
