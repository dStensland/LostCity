"""
Crawler for Morningside Lenox Park Association (mlpa.org).
Family-friendly neighborhood with nature preserve, organic farmers market, and active civic life.
Hosts Morningside Mile race, Concerts in the Park, and monthly meetings.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mlpa.org"

VENUE_DATA = {
    "name": "Morningside",
    "slug": "morningside",
    "address": "1053 E Rock Springs Rd NE",
    "neighborhood": "Morningside",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7920,
    "lng": -84.3560,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
    "description": "Family-friendly neighborhood with 33-acre nature preserve, organic farmers market, and strong civic association.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_first_tuesday(year: int, month: int) -> datetime:
    """Get the first Tuesday of a given month (typical MLPA board meeting)."""
    first_day = datetime(year, month, 1)
    days_until_tuesday = (1 - first_day.weekday()) % 7
    first_tuesday = first_day + timedelta(days=days_until_tuesday)
    return first_tuesday


def create_monthly_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring monthly board meeting events."""
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

        meeting_date = get_first_tuesday(year, month)

        # Skip if already passed
        if meeting_date.date() < now.date():
            continue

        title = "MLPA Board Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Morningside", start_date)


        description = (
            "Morningside Lenox Park Association monthly board meeting. "
            "Discuss neighborhood issues, zoning updates, community events, "
            "and park improvements. All Morningside residents welcome."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "19:30",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["morningside", "mlpa", "civic", "neighborhood-meeting"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1TU",
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Tuesday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert meeting: {e}")

    return events_new, events_updated


def create_morningside_mile(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Morningside Mile race event (typically September)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Morningside Mile is typically in September
    year = now.year
    if now.month > 9:
        year += 1

    # Typically third Saturday of September
    first_day = datetime(year, 9, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    race_date = first_saturday + timedelta(days=14)

    title = "Morningside Mile"
    start_date = race_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Morningside", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Annual Morningside Mile neighborhood running event. "
            "Fun run through the beautiful streets of Morningside. "
            "Family-friendly with kids races and post-race celebration."
        ),
        "start_date": start_date,
        "start_time": "08:00",
        "end_date": None,
        "end_time": "11:00",
        "is_all_day": False,
        "category": "fitness",
        "subcategory": "running",
        "tags": ["morningside", "running", "5k", "family-friendly", "outdoor"],
        "price_min": None,
        "price_max": None,
        "price_note": "Registration required",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.80,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new += 1
        logger.info(f"Added: {title} on {start_date}")
    except Exception as e:
        logger.error(f"Failed to insert race: {e}")

    return events_new, events_updated


def create_concerts_in_park(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Concerts in the Park events (summer series)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Concerts typically May-August, usually monthly
    year = now.year
    concert_months = [5, 6, 7, 8]  # May through August

    for month in concert_months:
        if month < now.month and year == now.year:
            continue

        # Typically second Friday of each month
        first_day = datetime(year, month, 1)
        days_until_friday = (4 - first_day.weekday()) % 7
        first_friday = first_day + timedelta(days=days_until_friday)
        concert_date = first_friday + timedelta(days=7)

        if concert_date.date() < now.date():
            continue

        title = "Concerts in the Park"
        start_date = concert_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Morningside", start_date)

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        description = (
            "Free outdoor concert series at Sidney Marcus Park. "
            "Bring blankets and picnics, enjoy live music with neighbors. "
            "Family-friendly community gathering."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "18:00",
            "end_date": None,
            "end_time": "20:00",
            "is_all_day": False,
            "category": "music",
            "subcategory": "live",
            "tags": ["morningside", "live-music", "outdoor", "family-friendly", "free"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.75,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=2FR",
            "content_hash": content_hash,
        }

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Friday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert concert: {e}")

    return events_new, events_updated


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    formats = ["%B %d, %Y", "%b %d, %Y", "%m/%d/%Y"]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

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
    """Crawl Morningside Lenox Park Association events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create recurring monthly meetings
    meeting_new, meeting_updated = create_monthly_meetings(source_id, venue_id)
    events_found += 4
    events_new += meeting_new
    events_updated += meeting_updated

    # Create Morningside Mile
    mile_new, mile_updated = create_morningside_mile(source_id, venue_id)
    events_found += 1
    events_new += mile_new
    events_updated += mile_updated

    # Create Concerts in the Park
    concert_new, concert_updated = create_concerts_in_park(source_id, venue_id)
    events_found += 4
    events_new += concert_new
    events_updated += concert_updated

    try:
        # Try to fetch additional events from website
        for path in ["/events", "/calendar", "/community", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")
                event_elements = soup.select(".event, .calendar-event, article, [class*='event']")

                for element in event_elements:
                    try:
                        title_elem = element.find(["h2", "h3", "h4", "a"])
                        if not title_elem:
                            continue
                        title = title_elem.get_text(strip=True)
                        if not title or len(title) < 3:
                            continue

                        # Skip already handled events
                        title_lower = title.lower()
                        if any(w in title_lower for w in ["board meeting", "morningside mile", "concerts in the park"]):
                            continue

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

                        content_hash = generate_content_hash(title, "Morningside", start_date)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Community event in Morningside neighborhood",
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": True,
                            "category": "community",
                            "subcategory": None,
                            "tags": ["morningside", "mlpa", "community"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,
                            "source_url": url,
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

                break

            except requests.RequestException:
                continue

        logger.info(f"Morningside crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Morningside: {e}")

    return events_found, events_new, events_updated
