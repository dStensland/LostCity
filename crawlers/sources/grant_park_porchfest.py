"""
Crawler for Grant Park Porchfest (grantparkporchfest.com).
Annual neighborhood music festival featuring 30+ live performances on porches
throughout the Grant Park neighborhood. Runs 12PM–6PM on a Saturday in April.

The site publishes a band schedule at /schedule once the lineup is confirmed.
We parse that page to detect whether a date is stated; if not, we fall back to
the historically consistent first-Saturday-of-April pattern.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.grantparkporchfest.com"
SCHEDULE_URL = f"{BASE_URL}/schedule"

PLACE_DATA = {
    "name": "Grant Park Neighborhood",
    "slug": "grant-park-neighborhood",
    "address": "Grant St & Cherokee Pl SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.7340,
    "lng": -84.3720,
    "place_type": "neighborhood",
    "website": BASE_URL,
    "vibes": ["neighborhood", "local-music", "outdoor", "community", "family-friendly"],
}

# Known confirmed dates — update each year once the date is announced.
# 2022–2023: 4th Saturday of April. 2024–2025: 1st Saturday of April.
# The most recent two years establish the 1st-Saturday pattern.
KNOWN_DATES: dict[int, str] = {
    2022: "2022-04-23",
    2023: "2023-04-22",
    2024: "2024-04-06",
    2025: "2025-04-05",
    2026: "2026-04-04",  # First Saturday of April 2026; matches published lineup
}

IMAGE_URL = (
    "http://static1.squarespace.com/static/65a18ed02c907d4eb499d7ae"
    "/t/65b08fabfa031c29135b16e1/1706069931447/GRANT_PARK_PORCHFEST_WIDE_LOGO.png"
    "?format=1500w"
)

DESCRIPTION = (
    "Grant Park Porchfest is a free annual neighborhood music festival featuring "
    "30+ live performances on porches, driveways, and front yards throughout the "
    "Grant Park neighborhood. Local bands play sets from 12PM to 6PM as neighbors "
    "open their properties to the community. Attendees stroll from porch to porch "
    "discovering new artists. The event is free, family-friendly, and deeply rooted "
    "in the neighborhood."
)


def _first_saturday_of_april(year: int) -> date:
    """Return the first Saturday of April for the given year."""
    april_1 = date(year, 4, 1)
    # date.weekday(): Monday=0 … Saturday=5 … Sunday=6
    days_to_saturday = (5 - april_1.weekday()) % 7
    return april_1.replace(day=1 + days_to_saturday)


def _resolve_event_date(year: int) -> date:
    """Return the event date for a given year, using known dates first."""
    if year in KNOWN_DATES:
        return datetime.strptime(KNOWN_DATES[year], "%Y-%m-%d").date()
    return _first_saturday_of_april(year)


def _detect_year_from_schedule(html: str) -> int | None:
    """
    Try to extract the festival year from the schedule page heading
    ('2026 Band Schedule', '2025 Band Schedule', etc.).
    Returns None if no year is found.
    """
    match = re.search(
        r"\b(20\d{2})\b[^<]*(?:Band\s+Schedule|Festival)", html, re.IGNORECASE
    )
    if match:
        return int(match.group(1))
    return None


def _fetch_schedule_html() -> str | None:
    """Fetch the schedule page. Returns HTML string or None on failure."""
    import urllib.request
    import ssl

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        req = urllib.request.Request(
            SCHEDULE_URL,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                )
            },
        )
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        logger.warning("grant-park-porchfest: failed to fetch schedule page: %s", exc)
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Grant Park Porchfest — generates the annual festival event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = date.today()
    current_year = today.year

    # Try to detect the active festival year from the live schedule page.
    # This catches the case where the site has already rolled over to next year.
    html = _fetch_schedule_html()
    detected_year = _detect_year_from_schedule(html) if html else None

    if detected_year and detected_year >= current_year:
        year = detected_year
    else:
        year = current_year

    event_date = _resolve_event_date(year)

    # If the resolved date is in the past, look ahead to next year.
    if event_date < today:
        next_year = year + 1
        next_date = _resolve_event_date(next_year)
        # Only advance if we have a reason to believe next year's event exists
        # (i.e., we're within 12 months of it).
        if (next_date - today).days <= 365:
            year = next_year
            event_date = next_date

    venue_id = get_or_create_place(PLACE_DATA)
    events_found = 1

    title = f"Grant Park Porchfest {year}"
    content_hash = generate_content_hash(
        title, "Grant Park Neighborhood", event_date.strftime("%Y-%m-%d")
    )

    existing = find_event_by_hash(content_hash)
    if existing:
        # Attempt a smart update in case details have changed (date confirmation, image, etc.)
        update_data = {
            "title": title,
            "description": DESCRIPTION,
            "start_date": event_date.strftime("%Y-%m-%d"),
            "start_time": "12:00",
            "end_time": "18:00",
            "is_all_day": False,
            "is_free": True,
            "price_note": "Free admission",
            "source_url": BASE_URL,
            "image_url": IMAGE_URL,
        }
        try:
            smart_update_existing_event(existing["id"], update_data)
        except Exception as exc:
            logger.debug("grant-park-porchfest: smart update skipped: %s", exc)
        events_updated = 1
        logger.info(
            "grant-park-porchfest: %s already exists (id=%s)", title, existing["id"]
        )
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": DESCRIPTION,
        "start_date": event_date.strftime("%Y-%m-%d"),
        "start_time": "12:00",
        "end_date": None,
        "end_time": "18:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": [
            "porchfest",
            "music-festival",
            "grant-park",
            "local-music",
            "neighborhood",
            "outdoor",
            "family-friendly",
            "free",
        ],
        "price_min": None,
        "price_max": None,
        "price_note": "Free admission",
        "is_free": True,
        "source_url": BASE_URL,
        "ticket_url": SCHEDULE_URL,
        "image_url": IMAGE_URL,
        "raw_text": None,
        "extraction_confidence": 0.90,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=4",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info("grant-park-porchfest: added %s on %s", title, event_date)
    except Exception as exc:
        logger.error("grant-park-porchfest: failed to insert event: %s", exc)

    return events_found, events_new, events_updated
