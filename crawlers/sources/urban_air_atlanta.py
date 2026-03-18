"""
Crawler for Urban Air Adventure Parks - Atlanta area locations.

Urban Air has multiple Atlanta-area locations (Snellville, Buford, Kennesaw) offering
indoor adventure parks with weekly activities like Jumperoo, Teen Night, Sensory
Friendly Play, Parents Night Out, and Family Night.

Data source situation (verified 2026-03-17):
- Each location has a 'Weekly Activities' page at /weekly-activities/
- The 'This Week at Urban Air' section is powered by a per-location Google Calendar
- The calendar embed URL is in a <a class="calendar-cta"> button on the weekly-activities page
- The calendar iCal feed is fetchable at:
    https://calendar.google.com/calendar/ical/{CALENDAR_ID}/public/basic.ics

Current state per location:
- Buford: Google Calendar configured (ID: 4nja8gu3m5v3reiff2oli3k0t8@group.calendar.google.com),
  but calendar is currently empty — no events posted
- Snellville: No Google Calendar ID configured (empty calendar-cta href)
- Kennesaw: No Google Calendar ID configured (empty calendar-cta href)

Urban Air also has a custom WP REST endpoint (/wp-json/urban_air/get-location-data)
that appears to be used for other data but returns empty responses without a proper
location context payload (possibly requires session cookies or a specific nonce).

Until Urban Air locations actively post events to their Google Calendars, this crawler
will return 0 events — which is accurate. The venue records are still valuable as
destinations. We check weekly and will capture events as soon as they're posted.
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
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Urban Air Atlanta-area locations.
# google_calendar_id is extracted from the calendar-cta button href on the weekly-activities page.
# None means the location hasn't configured a public Google Calendar.
URBAN_AIR_LOCATIONS = [
    {
        "name": "Urban Air Buford",
        "slug": "urban-air-buford",
        "address": "3235 Woodward Crossing Blvd",
        "neighborhood": None,
        "city": "Buford",
        "state": "GA",
        "zip": "30519",
        "lat": 34.1090,
        "lng": -83.9977,
        "website": "https://www.urbanair.com/georgia-buford/",
        "weekly_activities_url": "https://www.urbanair.com/georgia-buford/weekly-activities/",
        # Verified 2026-03-17 — configured but calendar currently empty
        "google_calendar_id": "4nja8gu3m5v3reiff2oli3k0t8@group.calendar.google.com",
    },
    {
        "name": "Urban Air Kennesaw",
        "slug": "urban-air-kennesaw",
        "address": "400 Ernest W Barrett Pkwy NW",
        "neighborhood": None,
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 34.0234,
        "lng": -84.6130,
        "website": "https://www.urbanair.com/georgia-kennesaw/",
        "weekly_activities_url": "https://www.urbanair.com/georgia-kennesaw/weekly-activities/",
        # Verified 2026-03-17 — not configured
        "google_calendar_id": None,
    },
    {
        "name": "Urban Air Snellville",
        "slug": "urban-air-snellville",
        "address": "1905 Scenic Hwy N",
        "neighborhood": None,
        "city": "Snellville",
        "state": "GA",
        "zip": "30078",
        "lat": 33.8584,
        "lng": -84.0197,
        "website": "https://www.urbanair.com/georgia-snellville/",
        "weekly_activities_url": "https://www.urbanair.com/georgia-snellville/weekly-activities/",
        # Verified 2026-03-17 — not configured
        "google_calendar_id": None,
    },
]

VENUE_DATA_TEMPLATE = {
    "venue_type": "entertainment",
    "vibes": ["family-friendly", "kids", "active", "indoor"],
}

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

GCAL_ICAL_URL_TEMPLATE = (
    "https://calendar.google.com/calendar/ical/{cal_id}/public/basic.ics"
)


def determine_tags(title: str) -> list[str]:
    """Return relevant tags based on event title keywords."""
    title_lower = title.lower()
    tags = ["family-friendly", "kids", "indoor", "active"]

    if any(w in title_lower for w in ["teen", "teens only"]):
        tags.append("teens")
    if any(
        w in title_lower
        for w in [
            "toddler",
            "jumperoo",
            "little",
            "preschool",
            "5 & under",
            "5 and under",
        ]
    ):
        tags.append("toddlers")
    if any(w in title_lower for w in ["sensory", "autism", "special needs"]):
        tags.append("sensory-friendly")
    if any(w in title_lower for w in ["parent", "parents night", "date night"]):
        tags.append("parents-night-out")
    if any(w in title_lower for w in ["glow", "blacklight", "black light"]):
        tags.append("glow-night")
    if any(w in title_lower for w in ["fitness", "workout"]):
        tags.append("fitness")
    if any(w in title_lower for w in ["school day", "homeschool", "pe credit"]):
        tags.append("school-day")

    return list(set(tags))


def parse_ical_events(
    ical_text: str, location: dict, source_id: int, venue_id: int
) -> list[dict]:
    """
    Parse VEVENT entries from an iCal string.
    Returns a list of event record dicts ready for insert_event().
    """
    events = []

    # Split into VEVENT blocks
    vevent_blocks = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", ical_text, re.DOTALL)

    for block in vevent_blocks:
        props = {}
        # iCal properties may be folded across lines — unfold first
        unfolded = re.sub(r"\r?\n[ \t]", "", block)
        for line in unfolded.splitlines():
            if ":" in line:
                key, _, value = line.partition(":")
                # Strip property parameters (e.g. DTSTART;TZID=America/New_York)
                key = key.split(";")[0].strip()
                props[key] = value.strip()

        summary = props.get("SUMMARY", "").strip()
        dtstart = props.get("DTSTART", "").strip()
        dtend = props.get("DTEND", "").strip()
        description = props.get("DESCRIPTION", "").strip()
        url = props.get("URL", location["weekly_activities_url"]).strip()

        if not summary or not dtstart:
            continue

        # Parse date/datetime — handles YYYYMMDD and YYYYMMDDTHHmmss[Z]
        start_date, start_time = _parse_ical_dt(dtstart)
        end_date, end_time = _parse_ical_dt(dtend) if dtend else (start_date, None)

        if not start_date:
            continue

        events.append(
            {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": summary,
                "description": description or f"{summary} at {location['name']}.",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": start_time is None,
                "category": "family",
                "subcategory": "active",
                "tags": determine_tags(summary),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": location["weekly_activities_url"],
                "ticket_url": url,
                "image_url": None,
                "raw_text": f"{summary} | {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": None,
                "content_hash": generate_content_hash(
                    summary, location["name"], start_date
                ),
            }
        )

    return events


def _parse_ical_dt(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse iCal DTSTART/DTEND value.
    Returns (date_str 'YYYY-MM-DD', time_str 'HH:MM:SS') or (date_str, None).
    """
    dt_str = dt_str.strip().rstrip("Z")
    try:
        if "T" in dt_str:
            dt = datetime.strptime(dt_str[:15], "%Y%m%dT%H%M%S")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
        else:
            dt = datetime.strptime(dt_str[:8], "%Y%m%d")
            return dt.strftime("%Y-%m-%d"), None
    except ValueError:
        return None, None


async def discover_calendar_id(
    session: aiohttp.ClientSession, location: dict
) -> Optional[str]:
    """
    Fetch the weekly-activities page and extract the Google Calendar ID
    from the calendar-cta button, in case we need to re-discover it.
    Returns the calendar ID string or None.
    """
    try:
        async with session.get(
            location["weekly_activities_url"], headers=REQUEST_HEADERS
        ) as resp:
            html = await resp.text()
        soup = BeautifulSoup(html, "html.parser")
        cal_link = soup.find("a", class_="calendar-cta")
        if not cal_link:
            return None
        href = cal_link.get("href", "")
        match = re.search(r"src=([^&\"'\s]+@group\.calendar\.google\.com)", href)
        return match.group(1) if match else None
    except Exception as e:
        logger.warning("Could not discover calendar ID for %s: %s", location["name"], e)
        return None


async def crawl_location(
    session: aiohttp.ClientSession, location: dict, source_id: int
) -> tuple[int, int, int]:
    """
    Crawl a single Urban Air location.
    Creates the venue record, then fetches events from its Google Calendar iCal feed.
    Locations without a configured Google Calendar produce 0 events (accurate).
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {
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

    venue_id = get_or_create_venue(venue_data)

    cal_id = location.get("google_calendar_id")

    # If no calendar ID hardcoded, try to discover it from the page
    if not cal_id:
        cal_id = await discover_calendar_id(session, location)
        if cal_id:
            logger.info(
                "Discovered new Google Calendar ID for %s: %s", location["name"], cal_id
            )
        else:
            logger.info(
                "%s: no Google Calendar configured — venue record created, 0 events",
                location["name"],
            )
            return 0, 0, 0

    # Fetch the iCal feed
    ical_url = GCAL_ICAL_URL_TEMPLATE.format(cal_id=cal_id.replace("@", "%40"))
    try:
        async with session.get(ical_url, headers=REQUEST_HEADERS) as resp:
            resp.raise_for_status()
            ical_text = await resp.text()
    except Exception as e:
        logger.error("Failed to fetch iCal for %s: %s", location["name"], e)
        return 0, 0, 0

    event_records = parse_ical_events(ical_text, location, source_id, venue_id)
    events_found = len(event_records)

    if events_found == 0:
        logger.info(
            "%s: Google Calendar iCal is empty — venue record maintained, 0 events",
            location["name"],
        )

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
    """Run all Urban Air location crawls within a shared aiohttp session."""
    total_found = 0
    total_new = 0
    total_updated = 0

    connector = aiohttp.TCPConnector(limit=2)
    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        for location in URBAN_AIR_LOCATIONS:
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
    Crawl all Urban Air Atlanta-area locations.

    Each location's events come from a per-location Google Calendar iCal feed.
    The calendar ID is hardcoded per location (stable once configured by the park
    manager) with a fallback to discover it from the weekly-activities page.

    As of 2026-03-17:
    - Buford has a calendar configured but it's empty
    - Kennesaw and Snellville have no calendar configured
    Returns 0 events per location until Urban Air park managers post events.
    """
    source_id = source["id"]

    total_found, total_new, total_updated = asyncio.run(_run_all(source_id))

    logger.info(
        "Urban Air Atlanta crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )

    return total_found, total_new, total_updated
