"""
Crawler for Sky Zone Trampoline Parks - Atlanta area locations.

Sky Zone has multiple Atlanta-area locations (Roswell, Alpharetta, etc.) offering
trampoline parks with special events like GLOW nights, Toddler Time, Fitness classes,
and Sensory-Friendly sessions.

Data source: Sky Zone's custom WordPress REST API at
  POST /wp-json/skyzone/v1/park/events
  params: park_id (numeric, found via data-park_id on events-calendar page), timezone

The API returns the current week only (no pagination to future weeks). Each location
page must be fetched individually to get its park_id. The API nonce is publicly
accessible from the page JS (skyzoneVars.restnonce) but the endpoint also accepts
requests without a valid nonce in practice.

Note: Atlanta location is currently former Defy Atlanta (acquired by Sky Zone).
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime
from typing import Optional

import aiohttp
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Sky Zone Atlanta-area locations with their numeric park_ids.
# The park_id is found via: soup.find(class_="events-calendar-data")["data-park_id"]
# on the /events-calendar/ page. These IDs are stable WP post IDs.
SKY_ZONE_LOCATIONS = [
    {
        "name": "Sky Zone Atlanta",
        "slug": "sky-zone-atlanta",
        "address": "3200 Northlake Pkwy NE",
        "neighborhood": "Northlake",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30345",
        "lat": 33.8617,
        "lng": -84.2848,
        "website": "https://www.skyzone.com/atlanta/",
        "events_calendar_url": "https://www.skyzone.com/atlanta/events-calendar/",
        "park_id": "101305",
    },
    {
        "name": "Sky Zone Roswell",
        "slug": "sky-zone-roswell",
        "address": "10800 Alpharetta Hwy",
        "neighborhood": None,
        "city": "Roswell",
        "state": "GA",
        "zip": "30076",
        "lat": 34.0291,
        "lng": -84.3584,
        "website": "https://www.skyzone.com/roswell/",
        "events_calendar_url": "https://www.skyzone.com/roswell/events-calendar/",
        "park_id": "34956",
    },
]

EVENTS_API_URL = "https://www.skyzone.com/wp-json/skyzone/v1/park/events"

VENUE_DATA_TEMPLATE = {
    "place_type": "entertainment",
    "vibes": ["family-friendly", "kids", "active", "indoor", "trampoline"],
}

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://www.skyzone.com",
}


def parse_month_day_to_date(date_str: str, year: int) -> Optional[str]:
    """
    Parse 'M/DD' format (e.g. '3/21') into a YYYY-MM-DD string.
    Uses the given year. Returns None on failure.
    """
    try:
        m, d = date_str.strip().split("/")
        return datetime(year, int(m), int(d)).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def parse_time_range(time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse '8:00pm - 10:00pm' into ('20:00', '22:00').
    Returns (start_time, end_time). Either may be None on failure.
    """
    if not time_str:
        return None, None

    # Normalize to lowercase
    time_str = time_str.strip().lower()

    # Pattern: HH:MM[am|pm] - HH:MM[am|pm]
    match = re.match(
        r"(\d{1,2}:\d{2}(?:am|pm)?)\s*[-–]\s*(\d{1,2}:\d{2}(?:am|pm)?)",
        time_str,
        re.IGNORECASE,
    )
    if not match:
        # Try single time
        single = re.match(r"(\d{1,2}:\d{2}(?:am|pm)?)", time_str, re.IGNORECASE)
        if single:
            return _parse_time(single.group(1)), None
        return None, None

    return _parse_time(match.group(1)), _parse_time(match.group(2))


def _parse_time(t: str) -> Optional[str]:
    """Convert '8:00pm' or '20:00' to 'HH:MM:SS' string."""
    if not t:
        return None
    t = t.strip().lower()
    try:
        if "am" in t or "pm" in t:
            fmt = "%I:%M%p" if ":" in t else "%I%p"
            dt = datetime.strptime(t, fmt)
        else:
            dt = datetime.strptime(t, "%H:%M")
        return dt.strftime("%H:%M:%S")
    except ValueError:
        return None


def determine_tags(event_name: str) -> list[str]:
    """Return relevant tags based on event name keywords."""
    name_lower = event_name.lower()
    tags = ["family-friendly", "kids", "indoor", "active"]

    if any(w in name_lower for w in ["glow", "cosmic", "blacklight", "black light"]):
        tags.append("glow-night")
    if any(w in name_lower for w in ["toddler", "little", "preschool"]):
        tags.append("toddlers")
    if any(w in name_lower for w in ["teen", "teens only"]):
        tags.append("teens")
    if any(w in name_lower for w in ["fitness", "skyfit", "workout"]):
        tags.append("fitness")
    if any(w in name_lower for w in ["sensory", "all abilities", "autism"]):
        tags.append("sensory-friendly")
    if any(w in name_lower for w in ["parent", "parents night"]):
        tags.append("parents-night-out")

    return list(set(tags))


async def fetch_week_calendar(
    session: aiohttp.ClientSession, location: dict
) -> BeautifulSoup:
    """
    Call the Sky Zone events API for this location's current week.
    Returns a BeautifulSoup of the returned HTML fragment.
    """
    data = {
        "park_id": location["park_id"],
        "timezone": "America/New_York",
    }
    headers = {
        **REQUEST_HEADERS,
        "Referer": location["events_calendar_url"],
    }

    async with session.post(EVENTS_API_URL, data=data, headers=headers) as resp:
        resp.raise_for_status()
        body = await resp.json(content_type=None)
        return BeautifulSoup(body.get("html", ""), "html.parser")


def parse_events_from_calendar_html(
    soup: BeautifulSoup, location: dict, source_id: int, venue_id: int
) -> list[dict]:
    """
    Parse calendar-date divs from Sky Zone API response HTML.
    Only extracts days with a calendar-event child (special events).
    Normal open-jump days have an empty calendar-content div — those are not events.
    """
    events = []
    current_year = datetime.now().year

    for date_div in soup.find_all(class_="calendar-date"):
        # Get the date label ('3/21')
        date_label_el = date_div.find(class_="calendar-head__date")
        if not date_label_el:
            continue
        date_label = date_label_el.get_text(strip=True)
        start_date = parse_month_day_to_date(date_label, current_year)
        if not start_date:
            continue

        # Get park hours (useful for context but not used as start_time)
        hours_el = date_div.find(class_="calendar-head__hours")
        park_hours = hours_el.get_text(strip=True) if hours_el else None

        # Extract special events from calendar-event divs
        for event_div in date_div.find_all(class_="calendar-event"):
            name_el = event_div.find(class_="calendar-event__name")
            time_el = event_div.find(class_="calendar-event__hours")
            link_el = event_div.find("a", href=True)

            if not name_el:
                continue

            event_name = name_el.get_text(strip=True)
            if not event_name:
                continue

            time_text = time_el.get_text(strip=True) if time_el else None
            start_time, end_time = (
                parse_time_range(time_text) if time_text else (None, None)
            )

            learn_more_url = (
                link_el["href"] if link_el else location["events_calendar_url"]
            )

            description = f"{event_name} at {location['name']}." + (
                f" Park hours: {park_hours}." if park_hours else ""
            )

            events.append(
                {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": event_name,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": start_date,
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": "family",
                    "subcategory": "active",
                    "tags": determine_tags(event_name),
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": location["events_calendar_url"],
                    "ticket_url": learn_more_url,
                    "image_url": None,
                    "raw_text": f"{event_name} | {start_date} | {time_text or ''}",
                    "extraction_confidence": 0.90,
                    "is_recurring": True,
                    "recurrence_rule": None,
                    "content_hash": generate_content_hash(
                        event_name, location["name"], start_date
                    ),
                }
            )

    return events


async def crawl_location(
    session: aiohttp.ClientSession, location: dict, source_id: int
) -> tuple[int, int, int]:
    """Crawl special events for a single Sky Zone location."""
    events_found = 0
    events_new = 0
    events_updated = 0

    place_data = {
        **VENUE_DATA_TEMPLATE,
        "name": location["name"],
        "slug": location["slug"],
        "address": location["address"],
        "neighborhood": location.get("neighborhood"),
        "city": location["city"],
        "state": location["state"],
        "zip": location["zip"],
        "lat": location.get("lat"),
        "lng": location.get("lng"),
        "website": location["website"],
    }

    venue_id = get_or_create_place(place_data)
    logger.info(
        "Crawling Sky Zone events: %s (park_id=%s)",
        location["name"],
        location["park_id"],
    )

    try:
        soup = await fetch_week_calendar(session, location)
    except Exception as e:
        logger.error("Failed to fetch calendar for %s: %s", location["name"], e)
        return 0, 0, 0

    event_records = parse_events_from_calendar_html(soup, location, source_id, venue_id)
    events_found = len(event_records)

    for record in event_records:
        existing = find_event_by_hash(record["content_hash"])
        if existing:
            smart_update_existing_event(existing, record)
            events_updated += 1
        else:
            try:
                insert_event(record)
                events_new += 1
                logger.info(
                    "Added: %s on %s at %s",
                    record["title"],
                    record["start_date"],
                    location["name"],
                )
            except Exception as e:
                logger.error("Failed to insert %s: %s", record["title"], e)

    return events_found, events_new, events_updated


async def _run_all(source_id: int) -> tuple[int, int, int]:
    """Run all Sky Zone location crawls within a shared aiohttp session."""
    total_found = 0
    total_new = 0
    total_updated = 0

    connector = aiohttp.TCPConnector(limit=2)
    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        for location in SKY_ZONE_LOCATIONS:
            try:
                found, new, updated = await crawl_location(session, location, source_id)
                total_found += found
                total_new += new
                total_updated += updated
            except Exception as e:
                logger.error("Failed to crawl %s: %s", location["name"], e)
                continue

    return total_found, total_new, total_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl all Sky Zone Atlanta-area locations.

    Uses the Sky Zone WP REST API (/wp-json/skyzone/v1/park/events) which returns
    the current week's calendar as HTML. Only days with special events (GLOW nights,
    Toddler Time, Fitness classes, Sensory sessions) have populated calendar-content
    divs — normal open-jump days are empty and are not created as events.

    The API has no pagination. It always returns the current 7-day window. This means
    we only ever have this week's special events, which is accurate: Sky Zone doesn't
    post future weeks in advance on the calendar.
    """
    source_id = source["id"]

    total_found, total_new, total_updated = asyncio.run(_run_all(source_id))

    logger.info(
        "Sky Zone Atlanta crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )

    return total_found, total_new, total_updated
