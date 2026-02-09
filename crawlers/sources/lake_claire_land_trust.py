"""
Crawler for Lake Claire Community Land Trust (lcclt.org).
1.7-acre community green space with gardens, amphitheater, and monthly drum circles since 1991.
Environmentally-conscious neighborhood with strong community programming.
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

BASE_URL = "https://www.lcclt.org"
EVENTS_URL = f"{BASE_URL}/new-events"

VENUE_DATA = {
    "name": "Lake Claire Community Land Trust",
    "slug": "lake-claire-land-trust",
    "address": "270 Arizona Ave NE",
    "neighborhood": "Lake Claire",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7670,
    "lng": -84.3220,
    "venue_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
    "description": "1.7-acre community green space with 50+ garden beds, amphitheater, and monthly drum circles since 1991.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_first_saturday(year: int, month: int) -> datetime:
    """Get the first Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    return first_day + timedelta(days=days_until_saturday)


def create_drum_circle_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create monthly drum circle events (1st Saturday of each month)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Generate next 6 months of drum circles
    for i in range(6):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        event_date = get_first_saturday(year, month)

        # Skip if already passed
        if event_date.date() < now.date():
            continue

        title = "Lake Claire Monthly Drum Circle"
        start_date = event_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Lake Claire Land Trust", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        description = (
            "Monthly community drum circle at Lake Claire Land Trust, a tradition since 1991. "
            "Bring your own drum or percussion instrument and join the circle. "
            "All skill levels welcome. Free and open to the public."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "music",
            "subcategory": None,
            "tags": ["lake-claire", "drum-circle", "community", "free", "outdoor", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": EVENTS_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1SA",
            "content_hash": content_hash,
        }

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Saturday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert drum circle: {e}")

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

    # Try partial match
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
    """Crawl Lake Claire Land Trust events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Always create drum circle events
    drum_new, drum_updated = create_drum_circle_events(source_id, venue_id)
    events_found += 6  # We generate 6 months
    events_new += drum_new
    events_updated += drum_updated

    try:
        # Fetch events page for additional events
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Look for event elements
        event_selectors = [
            ".eventlist-event", ".event-item", "[class*='event']",
            ".summary-item", "article"
        ]

        for selector in event_selectors:
            elements = soup.select(selector)
            if not elements:
                continue

            for element in elements:
                try:
                    # Extract title
                    title_elem = element.find(["h1", "h2", "h3", "a"])
                    if not title_elem:
                        continue
                    title = title_elem.get_text(strip=True)
                    if not title or len(title) < 3:
                        continue

                    # Skip drum circles (we already handle those)
                    if "drum" in title.lower():
                        continue

                    # Extract date
                    date_elem = element.find(class_=re.compile(r"date|time", re.I))
                    if date_elem:
                        date_str = date_elem.get_text(strip=True)
                    else:
                        # Look for date in text
                        text = element.get_text()
                        date_match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
                            text,
                            re.IGNORECASE
                        )
                        if date_match:
                            date_str = date_match.group()
                        else:
                            continue

                    start_date = parse_date(date_str)
                    if not start_date:
                        continue

                    # Skip past events
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(
                        title, "Lake Claire Land Trust", start_date
                    )

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Determine category
                    title_lower = title.lower()
                    if "garden" in title_lower or "plant" in title_lower:
                        category, subcategory = "community", None
                        tags = ["lake-claire", "garden", "volunteer"]
                    elif "tour" in title_lower:
                        category, subcategory = "community", None
                        tags = ["lake-claire", "tour", "neighborhood"]
                    elif "craft" in title_lower or "fair" in title_lower:
                        category, subcategory = "community", "market"
                        tags = ["lake-claire", "crafts", "market"]
                    else:
                        category, subcategory = "community", None
                        tags = ["lake-claire", "community"]

                    # Extract link
                    link = element.find("a", href=True)
                    event_url = link["href"] if link else EVENTS_URL
                    if event_url.startswith("/"):
                        event_url = BASE_URL + event_url

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"Community event at Lake Claire Land Trust",
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": True,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": element.get_text()[:500],
                        "extraction_confidence": 0.75,
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

            break  # Found events with this selector

        logger.info(
            f"Lake Claire Land Trust crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Lake Claire events page: {e}")

    return events_found, events_new, events_updated
