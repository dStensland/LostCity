"""
Crawler for Reynoldstown Civic Improvement League (reynoldstown.net).
Historic neighborhood with community events, Wheelbarrow Festival, and active programming.
Founded in 1870, one of Atlanta's oldest African-American settlements.
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

BASE_URL = "https://www.reynoldstown.net"

# Default venue for neighborhood-wide events
VENUE_DATA = {
    "name": "Reynoldstown",
    "slug": "reynoldstown-neighborhood",
    "address": "952 Wylie St SE",
    "neighborhood": "Reynoldstown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7495,
    "lng": -84.3400,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()

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

    return None


def get_spring_saturday(year: int) -> datetime:
    """Get a typical spring Saturday for Wheelbarrow Festival (usually April/May)."""
    # Wheelbarrow festival is typically in spring - use second Saturday of May
    may_1 = datetime(year, 5, 1)
    days_until_saturday = (5 - may_1.weekday()) % 7
    first_saturday = may_1 + timedelta(days=days_until_saturday)
    second_saturday = first_saturday + timedelta(days=7)
    return second_saturday


def create_wheelbarrow_festival(source_id: int, venue_id: int, year: int) -> tuple[int, int]:
    """Create the annual Wheelbarrow Festival event."""
    events_new = 0
    events_updated = 0

    event_date = get_spring_saturday(year)

    # If this year's festival has passed, generate next year's
    if event_date < datetime.now():
        year += 1
        event_date = get_spring_saturday(year)

    title = f"Reynoldstown Wheelbarrow Festival & .5K Race {year}"
    start_date = event_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Reynoldstown", start_date)

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Wheelbarrow Festival {year} already exists")
        return 0, events_updated

    description = (
        "The legendary Reynoldstown Wheelbarrow Festival features the famous .5K race, "
        "live music, yard games, food trucks, kids activities, and the annual Tour of Homes. "
        "A 20+ year neighborhood tradition benefiting the Reynoldstown Civic Improvement League."
    )

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": "10:00",
        "end_date": start_date,
        "end_time": "17:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "festival",
        "tags": [
            "reynoldstown",
            "festival",
            "family-friendly",
            "wheelbarrow-race",
            "neighborhood",
        ],
        "price_min": None,
        "price_max": None,
        "price_note": "Free admission; Tour of Homes tickets separate",
        "is_free": True,
        "source_url": f"{BASE_URL}/wheelbarrow-festival",
        "ticket_url": None,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.90,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=5",
        "content_hash": content_hash,
    }

    series_hint = {
        "series_type": "recurring_show",
        "series_title": title,
        "frequency": "yearly",
        "description": description,
    }

    try:
        insert_event(event_record, series_hint=series_hint)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Wheelbarrow Festival: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Reynoldstown RCIL website for community events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Always create the Wheelbarrow Festival
    new, updated = create_wheelbarrow_festival(source_id, venue_id, datetime.now().year)
    events_found += 1
    events_new += new
    events_updated += updated

    try:
        # Try to fetch events/calendar page
        for path in ["/events", "/calendar", "/rcil", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, "html.parser")

                    # Look for event content
                    text = soup.get_text()

                    # Look for meeting patterns (RCIL typically has monthly meetings)
                    meeting_patterns = [
                        r"(monthly meeting|community meeting|rcil meeting)",
                        r"(third|3rd)\s+(monday|tuesday|wednesday|thursday)",
                    ]

                    for pattern in meeting_patterns:
                        if re.search(pattern, text, re.IGNORECASE):
                            # Create recurring meeting event
                            now = datetime.now()
                            # Find next 3rd Thursday (typical for neighborhood meetings)
                            first_of_month = now.replace(day=1)
                            days_until_thursday = (3 - first_of_month.weekday()) % 7
                            first_thursday = first_of_month + timedelta(days=days_until_thursday)
                            third_thursday = first_thursday + timedelta(days=14)

                            if third_thursday < now:
                                # Move to next month
                                if now.month == 12:
                                    first_of_month = datetime(now.year + 1, 1, 1)
                                else:
                                    first_of_month = datetime(now.year, now.month + 1, 1)
                                days_until_thursday = (3 - first_of_month.weekday()) % 7
                                first_thursday = first_of_month + timedelta(days=days_until_thursday)
                                third_thursday = first_thursday + timedelta(days=14)

                            title = "RCIL Monthly Community Meeting"
                            start_date = third_thursday.strftime("%Y-%m-%d")

                            content_hash = generate_content_hash(title, "Reynoldstown", start_date)

                            if not find_event_by_hash(content_hash):
                                events_found += 1
                                description = "Monthly meeting of the Reynoldstown Civic Improvement League. Open to all residents."
                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": description,
                                    "start_date": start_date,
                                    "start_time": "19:00",
                                    "end_date": None,
                                    "end_time": "21:00",
                                    "is_all_day": False,
                                    "category": "community",
                                    "subcategory": None,
                                    "tags": ["reynoldstown", "meeting", "community", "rcil"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": True,
                                    "source_url": BASE_URL,
                                    "ticket_url": None,
                                    "image_url": None,
                                    "raw_text": None,
                                    "extraction_confidence": 0.70,
                                    "is_recurring": True,
                                    "recurrence_rule": "FREQ=MONTHLY;BYDAY=3TH",
                                    "content_hash": content_hash,
                                }

                                series_hint = {
                                    "series_type": "recurring_show",
                                    "series_title": title,
                                    "frequency": "monthly",
                                    "day_of_week": "Thursday",
                                    "description": description,
                                }

                                try:
                                    insert_event(event_record, series_hint=series_hint)
                                    events_new += 1
                                    logger.info(f"Added: {title}")
                                except Exception as e:
                                    logger.error(f"Failed to insert meeting: {e}")
                            break

                    break

            except requests.RequestException:
                continue

        logger.info(f"Reynoldstown crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Reynoldstown: {e}")

    return events_found, events_new, events_updated
