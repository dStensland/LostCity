"""
Crawler for Steady Hand Beer Co.
Craft brewery with taproom events.

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, date, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.steadyhandbeer.com"
EVENTS_URL = f"{BASE_URL}/events"
STALE_EVENT_GRACE_DAYS = 3

VENUE_DATA = {
    "name": "Steady Hand Beer Co",
    "slug": "steady-hand-beer",
    "address": "1611 Ellsworth Industrial Blvd NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "venue_type": "brewery",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def _extract_year_from_title(title: str) -> Optional[int]:
    match = re.search(r"\b(20\d{2})\b", title or "")
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _resolve_event_date(month: str, day: str, year_token: Optional[str], title: str) -> Optional[str]:
    """Resolve event date while rejecting stale archive rows."""
    today = date.today()
    month_str = month[:3] if len(month) > 3 else month

    parsed: Optional[datetime] = None

    if year_token:
        try:
            parsed = datetime.strptime(f"{month_str} {day} {int(year_token)}", "%b %d %Y")
        except ValueError:
            return None
    else:
        for candidate_year in (today.year, today.year + 1):
            try:
                candidate = datetime.strptime(f"{month_str} {day} {candidate_year}", "%b %d %Y")
            except ValueError:
                continue
            if candidate.date() >= today - timedelta(days=STALE_EVENT_GRACE_DAYS):
                parsed = candidate
                break

    if not parsed:
        return None

    title_year = _extract_year_from_title(title)
    if (
        title_year
        and title_year == parsed.year + 1
        and parsed.date() < today - timedelta(days=STALE_EVENT_GRACE_DAYS)
    ):
        shifted = parsed.replace(year=title_year)
        if shifted.date() >= today - timedelta(days=STALE_EVENT_GRACE_DAYS):
            parsed = shifted

    if parsed.date() < today - timedelta(days=STALE_EVENT_GRACE_DAYS):
        return None
    if parsed.year > today.year + 2:
        return None

    return parsed.strftime("%Y-%m-%d")


def _looks_like_event_title(text: str) -> bool:
    value = " ".join((text or "").split()).strip()
    if len(value) < 4 or len(value) > 120:
        return False
    if len(value.split()) > 16:
        return False
    lowered = value.lower()
    if lowered.startswith(("join us", "photo:", "event starts", "whether you're", "if john")):
        return False
    if "http://" in lowered or "https://" in lowered:
        return False
    if value.count(",") >= 6:
        return False
    # Avoid sentence-like blurbs being mistaken for titles.
    if len(value) > 80 and re.search(r"[.!?]", value):
        return False
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Steady Hand Beer Co: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            i = 0
            while i < len(lines):
                line = lines[i]

                if len(line) < 3:
                    i += 1
                    continue

                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    title = None
                    start_time = None

                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            if re.match(r"(January|February|March)", check_line, re.IGNORECASE):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|\$|more info)", check_line.lower()):
                                        if _looks_like_event_title(check_line):
                                            title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    start_date = _resolve_event_date(month, day, year, title)
                    if not start_date:
                        i += 1
                        continue

                    content_hash = generate_content_hash(title, "Steady Hand Beer Co", start_date)
                    event_url = find_event_url(title, event_links, EVENTS_URL) or EVENTS_URL

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Event at Steady Hand Beer Co",
                        "start_date": start_date,
                        "start_time": start_time or "17:00",
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "food_drink",
                        "subcategory": "brewery",
                        "tags": ["brewery", "craft-beer", "west-midtown", "taproom"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url if event_url != EVENTS_URL else None,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    events_found += 1

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(f"Steady Hand Beer Co crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Steady Hand Beer Co: {e}")
        raise

    return events_found, events_new, events_updated
