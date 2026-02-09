"""
Crawler for Peoplestown Neighborhood (peoplestownatlanta.org).
Historic African-American neighborhood south of Grant Park.
Active revitalization efforts, community programming, and civic engagement.
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

BASE_URL = "https://peoplestownatlanta.org"

VENUE_DATA = {
    "name": "Peoplestown",
    "slug": "peoplestown",
    "address": "Pittsburgh Ave SW",
    "neighborhood": "Peoplestown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.7190,
    "lng": -84.3900,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
    "description": "Historic African-American neighborhood with active revitalization efforts and strong community programming.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_fourth_thursday(year: int, month: int) -> datetime:
    """Get the fourth Thursday of a given month (typical meeting day)."""
    first_day = datetime(year, month, 1)
    days_until_thursday = (3 - first_day.weekday()) % 7
    first_thursday = first_day + timedelta(days=days_until_thursday)
    fourth_thursday = first_thursday + timedelta(days=21)
    # Handle edge case where fourth Thursday falls in next month
    if fourth_thursday.month != month:
        fourth_thursday -= timedelta(days=7)
    return fourth_thursday


def create_monthly_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring monthly community meeting events."""
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

        meeting_date = get_fourth_thursday(year, month)

        # Skip if already passed
        if meeting_date.date() < now.date():
            continue

        title = "Peoplestown Community Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Peoplestown", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        description = (
            "Peoplestown neighborhood community meeting. "
            "Discuss neighborhood issues, development updates, safety concerns, "
            "and community initiatives. All residents welcome."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "18:30",
            "end_date": None,
            "end_time": "20:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["peoplestown", "civic", "neighborhood-meeting", "community", "southwest-atlanta"],
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
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=4TH",
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
    """Crawl Peoplestown Neighborhood events."""
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

    try:
        # Try to fetch events from website
        for path in ["/events", "/calendar", "/community", "/news", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for event elements
                event_elements = soup.select(".event, .calendar-event, article, [class*='event'], .post")

                for element in event_elements:
                    try:
                        title_elem = element.find(["h2", "h3", "h4", "a"])
                        if not title_elem:
                            continue
                        title = title_elem.get_text(strip=True)
                        if not title or len(title) < 3:
                            continue

                        # Skip meetings (already handled)
                        if "meeting" in title.lower():
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

                        content_hash = generate_content_hash(title, "Peoplestown", start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Determine category
                        title_lower = title.lower()
                        if any(w in title_lower for w in ["cleanup", "volunteer", "garden"]):
                            category = "community"
                            tags = ["peoplestown", "volunteer", "community"]
                        elif any(w in title_lower for w in ["block party", "festival", "celebration"]):
                            category = "community"
                            tags = ["peoplestown", "festival", "family-friendly"]
                        else:
                            category = "community"
                            tags = ["peoplestown", "community", "southwest-atlanta"]

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Community event in Peoplestown neighborhood",
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": True,
                            "category": category,
                            "subcategory": None,
                            "tags": tags,
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

        logger.info(f"Peoplestown crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Peoplestown: {e}")

    return events_found, events_new, events_updated
