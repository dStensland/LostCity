"""
Crawler for The Beehive ATL craft classes (thebeehiveatl.com).

Uses Inffuse calendar API via Google Calendar integration.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional

import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://thebeehiveatl.com"
CALENDAR_PAGE = f"{BASE_URL}/pages/private-events-calendar"

# Inffuse calendar API endpoint
CALENDAR_API = "https://broker.eventscalendar.co/api/google/events"
CALENDAR_PARAMS = {
    "user": "7740b4a3-1eb5-44aa-8b64-4e79d34650f4",
    "project": "proj_aYRNFlCXxL3Ltantb6JVh",
    "calendar": "beecreativeclasses1@gmail.com",
}

VENUE_DATA = {
    "name": "The Beehive ATL",
    "slug": "beehive-atl",
    "address": "1250 Caroline Street, C120",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7577,
    "lng": -84.3542,
    "venue_type": "retail",
    "spot_type": "studio",
    "website": BASE_URL,
    "vibes": ["craft", "local", "handmade", "creative"],
}


def parse_datetime(timestamp_ms: int, timezone: str = "America/New_York") -> tuple[str, Optional[str]]:
    """Parse Unix timestamp (milliseconds) to date and time strings."""
    dt = datetime.fromtimestamp(timestamp_ms / 1000)
    return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")


def is_valid_class_event(title: str) -> bool:
    """
    Filter out administrative events that aren't actual classes.

    Returns True if the event is likely a real class, False for admin events.
    """
    title_lower = title.lower()

    # Skip administrative/operational events
    skip_keywords = [
        "no private events",
        "warehouse sale",
        "closed",
        "private event",
        "staff meeting",
        "inventory",
    ]

    if any(keyword in title_lower for keyword in skip_keywords):
        return False

    # Look for class indicators
    class_keywords = [
        "class",
        "workshop",
        "candle",
        "craft",
        "diy",
        "make",
        "create",
        "paint",
        "pottery",
        "jewelry",
    ]

    if any(keyword in title_lower for keyword in class_keywords):
        return True

    # If title is long enough and not obviously admin, consider it valid
    # (Some classes might just be descriptive without keywords)
    if len(title) > 10 and not title.isupper():
        return True

    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Beehive ATL events from Inffuse calendar API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Calculate date range: today to 120 days from now
        now = datetime.now()
        end_date = now + timedelta(days=120)

        # Convert to Unix timestamps in milliseconds
        from_ts = int(now.timestamp() * 1000)
        to_ts = int(end_date.timestamp() * 1000)

        params = {
            **CALENDAR_PARAMS,
            "from": from_ts,
            "to": to_ts,
            "options": "undefined",
        }

        logger.info(f"Fetching The Beehive ATL calendar: {CALENDAR_API}")
        response = requests.get(CALENDAR_API, params=params, timeout=30)
        response.raise_for_status()

        data = response.json()

        if not data.get("result"):
            logger.warning("Calendar API returned result: false")
            return 0, 0, 0

        events = data.get("events", [])
        logger.info(f"Found {len(events)} total events in calendar")

        for event in events:
            title = event.get("title", "").strip()

            if not title:
                continue

            # Filter out non-class events
            if not is_valid_class_event(title):
                logger.debug(f"Skipping administrative event: {title}")
                continue

            events_found += 1

            # Parse dates
            is_all_day = event.get("allday", False)
            start_timestamp = event.get("start")
            end_timestamp = event.get("end")

            if not start_timestamp:
                logger.warning(f"Event missing start time: {title}")
                continue

            start_date, start_time = parse_datetime(start_timestamp)
            end_date = None
            end_time = None

            if end_timestamp:
                end_date, end_time = parse_datetime(end_timestamp)

            # For all-day events, don't set times
            if is_all_day:
                start_time = None
                end_time = None

            # Extract description and location
            description = event.get("description", "").strip()
            location = event.get("location", "").strip()

            # Build full description
            full_description = f"Craft class at The Beehive ATL"
            if description:
                full_description = description
            if location and location.lower() not in ["", "the beehive atl"]:
                full_description += f"\n\nLocation: {location}"

            content_hash = generate_content_hash(title, "The Beehive ATL", start_date)


            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": full_description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": is_all_day,
                "category": "learning",
                "subcategory": "craft",
                "tags": ["craft", "diy", "workshop", "hands-on", "creative", "local"],
                "price_min": None,
                "price_max": None,
                "price_note": "Contact venue for pricing",
                "is_free": False,
                "source_url": CALENDAR_PAGE,
                "ticket_url": CALENDAR_PAGE,
                "image_url": None,
                "raw_text": f"{title} - {start_date}",
                "extraction_confidence": 0.85,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
                "is_class": True,
                "class_category": "craft",
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            # Build series hint for class enrichment
            series_hint = {
                "series_type": "class_series",
                "series_title": title,
            }
            if full_description:
                series_hint["description"] = full_description

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"The Beehive ATL crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch calendar data: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl The Beehive ATL: {e}")
        raise

    return events_found, events_new, events_updated
