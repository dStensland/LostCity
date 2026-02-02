"""
Crawler for Virginia-Highland Civic Association (vahi.org).
Historic walkable urban village with strong business district.
Hosts Summerfest, Winterfest, Tour of Homes, and monthly civic meetings.
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

BASE_URL = "https://vahi.org"

VENUE_DATA = {
    "name": "Virginia-Highland",
    "slug": "virginia-highland",
    "address": "Virginia Ave NE & N Highland Ave NE",
    "neighborhood": "Virginia-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7830,
    "lng": -84.3530,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
    "description": "Historic walkable urban village with vibrant business district, legacy bars, and annual festivals.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_second_tuesday(year: int, month: int) -> datetime:
    """Get the second Tuesday of a given month (typical VHCA board meeting)."""
    first_day = datetime(year, month, 1)
    days_until_tuesday = (1 - first_day.weekday()) % 7
    first_tuesday = first_day + timedelta(days=days_until_tuesday)
    second_tuesday = first_tuesday + timedelta(days=7)
    return second_tuesday


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

        meeting_date = get_second_tuesday(year, month)

        # Skip if already passed
        if meeting_date.date() < now.date():
            continue

        title = "VHCA Board Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Virginia-Highland", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Virginia-Highland Civic Association monthly board meeting. "
                "Discuss neighborhood issues, development updates, zoning matters, "
                "and upcoming community events. All VaHi residents welcome."
            ),
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["virginia-highland", "vahi", "civic", "neighborhood-meeting"],
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
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=2TU",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert meeting: {e}")

    return events_new, events_updated


def create_summerfest(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Summerfest event (typically June)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Summerfest is typically second Saturday of June
    year = now.year
    if now.month > 6:
        year += 1

    first_day = datetime(year, 6, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    festival_date = first_saturday + timedelta(days=7)

    title = "Virginia-Highland Summerfest"
    start_date = festival_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Virginia-Highland", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Annual Virginia-Highland Summerfest celebrating the neighborhood's vibrant culture. "
            "Features live music, local artists, food vendors, kids activities, and community spirit. "
            "One of Atlanta's most popular neighborhood festivals."
        ),
        "start_date": start_date,
        "start_time": "10:00",
        "end_date": None,
        "end_time": "22:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "festival",
        "tags": ["virginia-highland", "vahi", "summerfest", "festival", "live-music", "family-friendly", "outdoor"],
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": True,
        "source_url": f"{BASE_URL}/summerfest/",
        "ticket_url": None,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.85,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new += 1
        logger.info(f"Added: {title} on {start_date}")
    except Exception as e:
        logger.error(f"Failed to insert festival: {e}")

    return events_new, events_updated


def create_winterfest(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Winterfest/Tour of Homes event (typically December)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Winterfest is typically first weekend of December
    year = now.year
    if now.month == 12 and now.day > 15:
        year += 1

    first_day = datetime(year, 12, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    festival_date = first_day + timedelta(days=days_until_saturday)

    title = "Virginia-Highland Winterfest & Tour of Homes"
    start_date = festival_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Virginia-Highland", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Annual Virginia-Highland Winterfest featuring the neighborhood Tour of Homes. "
            "Explore beautifully decorated historic homes, enjoy holiday festivities, "
            "live entertainment, and seasonal shopping in the village."
        ),
        "start_date": start_date,
        "start_time": "11:00",
        "end_date": None,
        "end_time": "17:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "festival",
        "tags": ["virginia-highland", "vahi", "winterfest", "tour-of-homes", "holiday", "family-friendly"],
        "price_min": None,
        "price_max": None,
        "price_note": "Tour of Homes tickets required",
        "is_free": False,
        "source_url": "https://vahitourofhomes.org",
        "ticket_url": "https://vahitourofhomes.org",
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.85,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new += 1
        logger.info(f"Added: {title} on {start_date}")
    except Exception as e:
        logger.error(f"Failed to insert festival: {e}")

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
    """Crawl Virginia-Highland Civic Association events."""
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

    # Create Summerfest
    summer_new, summer_updated = create_summerfest(source_id, venue_id)
    events_found += 1
    events_new += summer_new
    events_updated += summer_updated

    # Create Winterfest/Tour of Homes
    winter_new, winter_updated = create_winterfest(source_id, venue_id)
    events_found += 1
    events_new += winter_new
    events_updated += winter_updated

    try:
        # Try to fetch additional events from website calendar
        for path in ["/calendar", "/events", ""]:
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
                        if any(w in title_lower for w in ["summerfest", "winterfest", "tour of homes", "board meeting"]):
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

                        content_hash = generate_content_hash(title, "Virginia-Highland", start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Community event in Virginia-Highland neighborhood",
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": True,
                            "category": "community",
                            "subcategory": None,
                            "tags": ["virginia-highland", "vahi", "community"],
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

        logger.info(f"Virginia-Highland crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Virginia-Highland: {e}")

    return events_found, events_new, events_updated
