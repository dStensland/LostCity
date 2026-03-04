"""
Crawler for Atlanta Streets Alive (atlantastreetsalive.org).

This source models Streets Alive as a tentpole event series (not a festival
container) with one event row per official route date.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime

from playwright.sync_api import sync_playwright

from db import find_event_by_hash, get_or_create_venue, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantastreetsalive.org"

VENUE_DATA = {
    "name": "Atlanta Streets Alive Route",
    "slug": "atlanta-streets-alive-route",
    "address": "Atlanta Open Streets Corridors",
    "neighborhood": "Citywide",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
}

KNOWN_DATES = {
    2026: (
        "2026-03-22",
        "2026-04-19",
        "2026-05-17",
        "2026-09-13",
    ),
}

_MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _extract_dates_from_text(text: str, today: date) -> list[date]:
    normalized = re.sub(r"\s+", " ", text.replace("–", "-")).strip()
    month_tokens = "|".join(sorted(_MONTHS.keys(), key=len, reverse=True))

    candidates: set[date] = set()

    # March 22, 2026
    full_pattern = re.compile(
        rf"\b({month_tokens})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,\s*(\d{{4}}))\b",
        re.IGNORECASE,
    )
    for match in full_pattern.finditer(normalized):
        month_token, day_text, year_text = match.groups()
        month = _MONTHS[month_token.lower().rstrip(".")]
        day = int(day_text)
        year = int(year_text)
        try:
            candidates.add(date(year, month, day))
        except ValueError:
            continue

    # 3/22/2026
    numeric_pattern = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")
    for match in numeric_pattern.finditer(normalized):
        month, day, year = (int(part) for part in match.groups())
        try:
            candidates.add(date(year, month, day))
        except ValueError:
            continue

    # Keep current-cycle dates to avoid historical archive noise.
    lower = today.replace(month=1, day=1)
    upper = date(today.year + 1, 12, 31)
    filtered = sorted([candidate for candidate in candidates if lower <= candidate <= upper])
    return filtered


def _resolve_dates(page_text: str, today: date) -> list[date]:
    # Prefer explicit known dates for the current cycle when we have them.
    for year in (today.year, today.year + 1):
        if year in KNOWN_DATES:
            return [date.fromisoformat(value) for value in KNOWN_DATES[year]]

    extracted = _extract_dates_from_text(page_text, today)
    if extracted:
        return extracted

    return []


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Streets Alive official schedule."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().date()
    venue_id = get_or_create_venue(VENUE_DATA)

    page_text = ""
    selected_url = BASE_URL
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        try:
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)
            page_text = page.inner_text("body").strip()
            selected_url = page.url or BASE_URL
        except Exception as exc:
            logger.warning("Atlanta Streets Alive fetch failed: %s", exc)
        finally:
            browser.close()

    if len(page_text) < 20:
        logger.warning("Atlanta Streets Alive page text unavailable")
        return 0, 0, 0

    schedule_dates = _resolve_dates(page_text, today)
    if not schedule_dates:
        logger.warning("No Atlanta Streets Alive dates parsed")
        return 0, 0, 0

    description = (
        "Atlanta Streets Alive is a citywide open-streets program that closes major "
        "corridors to cars for biking, walking, skating, and community programming."
    )

    for event_date in schedule_dates:
        title = "Atlanta Streets Alive"
        content_hash = generate_content_hash(title, VENUE_DATA["name"], event_date.isoformat())

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": event_date.isoformat(),
            "start_time": "14:00",
            "end_date": event_date.isoformat(),
            "end_time": "18:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "open_streets",
            "tags": ["atlanta-streets-alive", "open-streets", "community", "citywide"],
            "price_min": None,
            "price_max": None,
            "price_note": "Free to attend",
            "is_free": True,
            "is_tentpole": True,
            "source_url": selected_url,
            "ticket_url": None,
            "image_url": None,
            "raw_text": f"Atlanta Streets Alive date {event_date.isoformat()}",
            "extraction_confidence": 0.9,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        events_found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
        except Exception as exc:
            logger.error("Failed to insert Atlanta Streets Alive date %s: %s", event_date.isoformat(), exc)

    logger.info(
        "Atlanta Streets Alive crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
