"""
Crawler for Northside Hospital Community Health Fairs (northside.com).

Free community health screenings and health fairs hosted by Northside Hospital.
Events include blood pressure checks, glucose screening, BMI checks, and health education.

Site requires Playwright for JavaScript rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.northside.com"
EVENTS_URL = f"{BASE_URL}/community-wellness/in-the-community/health-fairs"

VENUE_DATA = {
    "name": "Northside Hospital",
    "slug": "northside-hospital",
    "address": "1000 Johnson Ferry Rd NE",
    "neighborhood": "Sandy Springs",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.9423,
    "lng": -84.3567,
    "venue_type": "hospital",
    "spot_type": "hospital",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '9:00 AM' or '9:00 a.m.' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        period_lower = period.lower().replace(".", "")
        if period_lower == "pm" and hour != 12:
            hour += 12
        elif period_lower == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    # Try "Month DD, YYYY" format
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_text,
        re.IGNORECASE
    )
    if match:
        month = match.group(1)
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(datetime.now().year)

        try:
            month_str = month[:3] if len(month) > 3 else month
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try MM/DD/YYYY format
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Northside Hospital health fairs using Playwright."""
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

            logger.info(f"Fetching Northside Hospital health fairs: {EVENTS_URL}")

            try:
                page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
            except Exception as e:
                logger.error(f"Failed to load page: {e}")
                browser.close()
                return 0, 0, 0

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            logger.info(f"Extracted {len(lines)} lines from page")

            # Parse events - look for date patterns and health fair indicators
            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip very short lines
                if len(line) < 5:
                    i += 1
                    continue

                # Look for date patterns
                date_str = parse_date(line)

                if date_str:
                    # Found a date - look for title and time in surrounding lines
                    title = None
                    start_time = None
                    location = None

                    # Look forward and backward for context
                    for offset in [-2, -1, 1, 2, 3, 4, 5]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]

                            # Try to extract time
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue

                            # Try to extract title (should mention health/fair/screening)
                            if not title and len(check_line) > 10:
                                if any(keyword in check_line.lower() for keyword in [
                                    "health fair", "health screening", "community health",
                                    "wellness", "screening", "health event"
                                ]):
                                    title = check_line
                                    continue

                            # Try to extract location
                            if not location and any(keyword in check_line.lower() for keyword in [
                                "location:", "at ", "hospital", "center", "building"
                            ]):
                                if len(check_line) < 100:
                                    location = check_line.replace("Location:", "").strip()

                    # If no specific title found, create generic one
                    if not title:
                        title = "Community Health Fair"

                    # Dedupe by title and date
                    event_key = f"{title}|{date_str}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    content_hash = generate_content_hash(title, "Northside Hospital", date_str)


                    # Build description
                    description = "Free community health screening hosted by Northside Hospital."
                    if location:
                        description += f" Location: {location}"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": description[:500],
                        "start_date": date_str,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "wellness",
                        "subcategory": None,
                        "tags": ["health-screening", "free", "community", "public-health"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": EVENTS_URL,
                        "ticket_url": EVENTS_URL,
                        "image_url": None,
                        "raw_text": f"{title} - {date_str} - {location if location else 'Northside Hospital'}",
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title[:50]}... on {date_str}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Northside Hospital health fairs crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Northside Hospital health fairs: {e}")
        raise

    return events_found, events_new, events_updated
