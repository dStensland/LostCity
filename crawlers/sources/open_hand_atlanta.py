"""
Crawler for Open Hand Atlanta volunteer shifts.

Open Hand's public marketing pages are not the real volunteer inventory. The
actual shift schedule lives in their Giveffect volunteer calendar, which renders
the current month as visible text in the browser. We parse that schedule into
dated volunteer events for HelpATL.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.openhandatlanta.org"
VOLUNTEER_CALENDAR_URL = "https://donate.openhandatlanta.org/volunteer_calendar"

OPEN_HAND_HQ = {
    "name": "Open Hand Atlanta",
    "slug": "open-hand-atlanta",
    "address": "1380 West Marietta St NW",
    "neighborhood": "Underwood Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.8077,
    "lng": -84.4272,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "food"],
}

_TIME_RANGE_RE = re.compile(
    r"^(\d{1,2}):(\d{2})(am|pm)\s*-\s*(\d{1,2}):(\d{2})(am|pm)$",
    re.IGNORECASE,
)
_MONTH_YEAR_RE = re.compile(
    r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$"
)
_STOP_MARKERS = {
    "Next month",
    "Create an Account",
    "Login",
    "Sign up",
    "Back",
    "Cancel",
}

_ROLE_DESCRIPTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\bmeal packing\b", re.IGNORECASE),
        "Pack medically tailored meals that Open Hand delivers to Atlanta neighbors in need.",
    ),
    (
        re.compile(r"\bdelivery driver\b", re.IGNORECASE),
        "Help deliver Open Hand meals directly to clients across metro Atlanta.",
    ),
    (
        re.compile(r"\bback-?\s*up delivery driver\b", re.IGNORECASE),
        "Serve as a backup meal delivery driver for Open Hand clients across metro Atlanta.",
    ),
    (
        re.compile(r"\bloading assistance\b", re.IGNORECASE),
        "Help load prepared meals and delivery materials for Open Hand's daily routes.",
    ),
    (
        re.compile(r"\bmarket basket packing\b", re.IGNORECASE),
        "Pack grocery-style market baskets that support Open Hand clients and households.",
    ),
    (
        re.compile(r"\bculinary\b", re.IGNORECASE),
        "Support Open Hand's kitchen team with volunteer culinary prep and food-service tasks.",
    ),
    (
        re.compile(r"\bfront desk greeter\b", re.IGNORECASE),
        "Welcome volunteers and visitors and support check-in at Open Hand's headquarters.",
    ),
    (
        re.compile(r"\bpicking cooler box labeler\b", re.IGNORECASE),
        "Label cooler boxes and organize meal orders so Open Hand deliveries leave accurately.",
    ),
    (
        re.compile(r"\bsupplement bagging\b", re.IGNORECASE),
        "Bag supplements and assemble support boxes for Open Hand meal distribution.",
    ),
    (
        re.compile(r"\bbuilding tours?\b", re.IGNORECASE),
        "Join an Open Hand tour to learn how its food-as-medicine operation serves Atlanta clients.",
    ),
]


def determine_category(title: str, description: str = "") -> str:
    """Open Hand calendar rows are volunteer shifts, not marketing events."""
    text = f"{title} {description}".lower()
    if any(word in text for word in ["training", "tour", "orientation"]):
        return "learning"
    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from Open Hand shift titles."""
    text = f"{title} {description}".lower()
    tags = {"volunteer", "volunteer-opportunity", "food", "charity", "open-hand-atlanta"}

    if any(word in text for word in ["meal", "packing", "kitchen", "culinary", "bagging"]):
        tags.add("food")
    if any(word in text for word in ["delivery", "driver"]):
        tags.add("delivery")
    if any(word in text for word in ["front desk", "greeter"]):
        tags.add("community")
    if any(word in text for word in ["tour", "orientation", "training"]):
        tags.add("education")

    return sorted(tags)


def build_description(title: str) -> str:
    """Return a truthful role description for Open Hand calendar rows."""
    clean_title = re.sub(r"\s+", " ", title).strip()
    for pattern, description in _ROLE_DESCRIPTION_PATTERNS:
        if pattern.search(clean_title):
            return description
    return (
        f"Volunteer with Open Hand Atlanta as a {clean_title.lower()} shift supporting meal "
        "packing, delivery, or client service operations."
    )


def is_public_event(title: str, description: str = "") -> bool:
    """Filter out non-shift calendar chrome."""
    text = f"{title} {description}".lower()
    if any(
        phrase in text
        for phrase in ["create an account", "forgotten password", "keywords", "session time"]
    ):
        return False
    return True


def _to_24_hour(hour_text: str, minute_text: str, period: str) -> str:
    hour = int(hour_text)
    minute = int(minute_text)
    period = period.lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _parse_time_range_line(line: str) -> tuple[Optional[str], Optional[str]]:
    match = _TIME_RANGE_RE.match(line.strip())
    if not match:
        return None, None

    return (
        _to_24_hour(match.group(1), match.group(2), match.group(3)),
        _to_24_hour(match.group(4), match.group(5), match.group(6)),
    )


def _parse_volunteer_calendar_text(
    body_text: str, reference_dt: Optional[datetime] = None
) -> list[dict]:
    """Parse Giveffect volunteer calendar text into dated shift rows."""
    reference_dt = reference_dt or datetime.now()
    lines = [line.strip() for line in body_text.split("\n") if line.strip()]

    month_index = None
    month_name = None
    year = None
    for idx, line in enumerate(lines):
        match = _MONTH_YEAR_RE.match(line)
        if match:
            month_index = idx
            month_name = match.group(1)
            year = int(match.group(2))
            break

    if month_index is None or month_name is None or year is None:
        return []

    month_number = datetime.strptime(month_name, "%B").month
    current_day: Optional[int] = None
    parsed_shifts: list[dict] = []
    idx = month_index + 1

    while idx < len(lines):
        line = lines[idx]
        if line in _STOP_MARKERS:
            break
        if _MONTH_YEAR_RE.match(line):
            break
        if line.isdigit():
            current_day = int(line)
            idx += 1
            continue

        start_time, end_time = _parse_time_range_line(line)
        if start_time and end_time and current_day is not None and idx + 1 < len(lines):
            title = lines[idx + 1].strip()
            if title and not title.isdigit():
                try:
                    start_dt = datetime(year, month_number, current_day)
                except ValueError:
                    idx += 2
                    continue
                if start_dt.date() >= reference_dt.date():
                    parsed_shifts.append(
                        {
                            "title": title,
                            "start_date": start_dt.strftime("%Y-%m-%d"),
                            "start_time": start_time,
                            "end_time": end_time,
                        }
                    )
                idx += 2
                continue
        idx += 1

    return parsed_shifts


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Open Hand volunteer shifts from the public Giveffect calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1440, "height": 2200},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(OPEN_HAND_HQ)

            logger.info("Fetching Open Hand Atlanta volunteer calendar: %s", VOLUNTEER_CALENDAR_URL)
            page.goto(VOLUNTEER_CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            body_text = page.inner_text("body")
            shifts = _parse_volunteer_calendar_text(body_text)

            for shift in shifts:
                title = shift["title"]
                if not is_public_event(title):
                    continue

                events_found += 1
                content_hash = generate_content_hash(
                    f"{title} {shift['start_time']}",
                    "Open Hand Atlanta",
                    shift["start_date"],
                )
                current_hashes.add(content_hash)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:200],
                    "description": build_description(title),
                    "start_date": shift["start_date"],
                    "start_time": shift["start_time"],
                    "end_date": None,
                    "end_time": shift["end_time"],
                    "is_all_day": False,
                    "category": determine_category(title),
                    "subcategory": None,
                    "tags": extract_tags(title),
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": VOLUNTEER_CALENDAR_URL,
                    "ticket_url": VOLUNTEER_CALENDAR_URL,
                    "image_url": None,
                    "raw_text": f"{title} | {shift['start_date']} | {shift['start_time']}-{shift['end_time']}",
                    "extraction_confidence": 0.9,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_existing_event_for_insert(event_record)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.info("Added: %s on %s", title[:50], shift["start_date"])

            browser.close()

        stale_deleted = remove_stale_source_events(source_id, current_hashes)
        if stale_deleted:
            logger.info(
                "Removed %s stale Open Hand Atlanta events after calendar refresh",
                stale_deleted,
            )

        logger.info(
            "Open Hand Atlanta crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )

    except PlaywrightTimeout as e:
        logger.error("Timeout fetching Open Hand Atlanta: %s", e)
        raise
    except Exception as e:
        logger.error("Failed to crawl Open Hand Atlanta: %s", e)
        raise

    return events_found, events_new, events_updated
