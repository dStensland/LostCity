"""
Crawler for Organized Neighbors of Summerhill (onsummerhill.org).
Historic neighborhood undergoing dramatic renaissance, with Georgia Avenue as commercial heart.
Monthly community meetings and neighborhood events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.onsummerhill.org"
EVENTS_URL = f"{BASE_URL}/meetingsandevents"

VENUE_DATA = {
    "name": "Summerhill",
    "slug": "summerhill-neighborhood",
    "address": "Georgia Ave SE",
    "neighborhood": "Summerhill",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7350,
    "lng": -84.3810,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
    "description": "Historic neighborhood experiencing dramatic renaissance with Georgia Avenue as its commercial heart.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_second_monday(year: int, month: int) -> datetime:
    """Get the second Monday of a given month (ONS meeting day)."""
    first_day = datetime(year, month, 1)
    days_until_monday = (0 - first_day.weekday()) % 7
    first_monday = first_day + timedelta(days=days_until_monday)
    second_monday = first_monday + timedelta(days=7)
    return second_monday


def create_monthly_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create monthly ONS community meeting events (2nd Monday at 7pm)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Generate next 4 months of meetings
    for i in range(4):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        meeting_date = get_second_monday(year, month)

        # Skip if already passed
        if meeting_date.date() < now.date():
            continue

        title = "ONS Monthly Community Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Summerhill", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Monthly meeting of Organized Neighbors of Summerhill. "
                "Open to all Summerhill residents and stakeholders. "
                "Discuss neighborhood issues, development updates, and community initiatives."
            ),
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "20:30",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["summerhill", "meeting", "community", "neighborhood", "ons"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": EVENTS_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=2MO",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert meeting: {e}")

    return events_new, events_updated


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Partial match
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})",
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Summerhill neighborhood events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Always create monthly meetings
    meeting_new, meeting_updated = create_monthly_meetings(source_id, venue_id)
    events_found += 4
    events_new += meeting_new
    events_updated += meeting_updated

    try:
        # Try to fetch events page
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # Look for event elements
            event_elements = soup.select(".event, .calendar-event, article, [class*='event']")

            for element in event_elements:
                try:
                    title_elem = element.find(["h2", "h3", "h4", "a"])
                    if not title_elem:
                        continue
                    title = title_elem.get_text(strip=True)
                    if not title or "meeting" in title.lower():
                        continue  # Skip meetings (already handled)

                    # Look for date
                    text = element.get_text()
                    date_match = re.search(
                        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
                        text,
                        re.IGNORECASE
                    )
                    if not date_match:
                        continue

                    start_date = parse_date(date_match.group())
                    if not start_date:
                        continue

                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "Summerhill", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"Community event in Summerhill neighborhood",
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": True,
                        "category": "community",
                        "subcategory": None,
                        "tags": ["summerhill", "community", "neighborhood"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": EVENTS_URL,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": text[:500],
                        "extraction_confidence": 0.70,
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

                except Exception as e:
                    logger.debug(f"Error parsing event: {e}")
                    continue

        logger.info(f"Summerhill crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Summerhill: {e}")

    return events_found, events_new, events_updated
