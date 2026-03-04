"""
Crawler for Atlanta Pride (atlantapride.org).

This crawler tracks the annual festival container event with a reliable
multi-day window and hydrates festival metadata from the official site.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_client,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantapride.org"
FESTIVAL_URL = f"{BASE_URL}/festival"

PIEDMONT_PARK = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "park",
    "website": "https://piedmontpark.org",
}

KNOWN_DATES = {
    2026: ("2026-10-10", "2026-10-11"),
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


def _safe_date(year: int, month: int, day: int) -> Optional[date]:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _parse_year(value: Optional[str], *, fallback: int) -> int:
    if value:
        parsed = int(value)
        if parsed < 100:
            return 2000 + parsed
        return parsed
    return fallback


def _extract_windows(text: str, *, fallback_year: int) -> list[tuple[date, date]]:
    normalized = re.sub(r"\s+", " ", text.replace("–", "-")).strip()
    candidates: list[tuple[date, date]] = []

    month_tokens = "|".join(sorted(_MONTHS.keys(), key=len, reverse=True))

    # October 10-11, 2026 / October 10 & 11, 2026
    same_month_pattern = re.compile(
        rf"\b({month_tokens})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*"
        rf"(?:-|to|through|and|&)\s*(\d{{1,2}})(?:st|nd|rd|th)?(?:,\s*(\d{{4}}))?",
        re.IGNORECASE,
    )
    for match in same_month_pattern.finditer(normalized):
        month_token, day1, day2, year = match.groups()
        year_num = _parse_year(year, fallback=fallback_year)
        month_num = _MONTHS[month_token.lower().rstrip(".")]
        start = _safe_date(year_num, month_num, int(day1))
        end = _safe_date(year_num, month_num, int(day2))
        if start and end:
            if end < start:
                end = start
            candidates.append((start, end))

    # Oct 31-Nov 1, 2026
    multi_month_pattern = re.compile(
        rf"\b({month_tokens})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*[-]\s*"
        rf"({month_tokens})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,\s*(\d{{4}}))?",
        re.IGNORECASE,
    )
    for match in multi_month_pattern.finditer(normalized):
        m1, d1, m2, d2, year = match.groups()
        year_num = _parse_year(year, fallback=fallback_year)
        start = _safe_date(year_num, _MONTHS[m1.lower().rstrip(".")], int(d1))
        end = _safe_date(year_num, _MONTHS[m2.lower().rstrip(".")], int(d2))
        if start and end:
            if end < start:
                next_year_end = _safe_date(year_num + 1, end.month, end.day)
                end = next_year_end or start
            candidates.append((start, end))

    # 10/10/2026 - 10/11/2026
    numeric_pattern = re.compile(
        r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\s*[-]\s*(\d{1,2})/(\d{1,2})/(\d{2,4})\b"
    )
    for match in numeric_pattern.finditer(normalized):
        m1, d1, y1, m2, d2, y2 = match.groups()
        y1n = _parse_year(y1, fallback=fallback_year)
        y2n = _parse_year(y2, fallback=fallback_year)
        start = _safe_date(y1n, int(m1), int(d1))
        end = _safe_date(y2n, int(m2), int(d2))
        if start and end:
            if end < start:
                end = start
            candidates.append((start, end))

    # De-duplicate.
    deduped: dict[tuple[date, date], tuple[date, date]] = {}
    for start, end in candidates:
        deduped[(start, end)] = (start, end)
    return list(deduped.values())


def _estimate_october_window(year: int) -> tuple[date, date]:
    oct_1 = date(year, 10, 1)
    days_until_saturday = (5 - oct_1.weekday()) % 7
    first_saturday = oct_1 + timedelta(days=days_until_saturday)
    second_saturday = first_saturday + timedelta(days=7)
    return second_saturday, second_saturday + timedelta(days=1)


def _resolve_window(body_text: str, *, today: date) -> tuple[date, date]:
    candidates = _extract_windows(body_text, fallback_year=today.year)
    if candidates:
        upcoming = sorted(
            [window for window in candidates if window[1] >= today],
            key=lambda window: (window[0], window[1]),
        )
        if upcoming:
            return upcoming[0]
        return sorted(candidates, key=lambda window: (window[0], window[1]), reverse=True)[0]

    for offset in (0, 1):
        year = today.year + offset
        if year in KNOWN_DATES:
            start, end = KNOWN_DATES[year]
            return date.fromisoformat(start), date.fromisoformat(end)

    return _estimate_october_window(today.year if today.month <= 10 else today.year + 1)


def _hydrate_festival(source_slug: str, description: str, start_date: date, end_date: date, website: str) -> None:
    client = get_client()
    rows = (
        client.table("festivals")
        .select("id")
        .eq("slug", source_slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return

    festival_id = rows[0]["id"]
    update_payload = {
        "website": website,
        "announced_start": start_date.isoformat(),
        "announced_end": end_date.isoformat(),
        "description": description,
        "date_source": "official_site",
        "date_confidence": 95,
    }
    client.table("festivals").update(update_payload).eq("id", festival_id).execute()
    client.table("series").update({"description": description}).eq("festival_id", festival_id).execute()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Pride annual festival container event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().date()
    venue_id = get_or_create_venue(PIEDMONT_PARK)

    page_text = ""
    selected_url = FESTIVAL_URL
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

        for candidate in (FESTIVAL_URL, BASE_URL):
            try:
                page.goto(candidate, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(2000)
                text = page.inner_text("body").strip()
                if len(text) < 20:
                    continue
                page_text = text
                selected_url = page.url or candidate
                break
            except Exception as exc:
                logger.warning("Atlanta Pride candidate failed (%s): %s", candidate, exc)

        browser.close()

    if not page_text:
        logger.warning("Atlanta Pride page text unavailable")
        return 0, 0, 0

    start_date, end_date = _resolve_window(page_text, today=today)
    event_year = start_date.year
    title = f"Atlanta Pride Festival {event_year}"
    description = (
        "Atlanta Pride Festival is a multi-day LGBTQ+ celebration in Piedmont Park "
        "with stages, cultural programming, vendors, community activations, and "
        "citywide Pride events."
    )

    content_hash = generate_content_hash(title, PIEDMONT_PARK["name"], start_date.isoformat())
    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date.isoformat(),
        "start_time": None,
        "end_date": end_date.isoformat() if end_date > start_date else None,
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "festival",
        "tags": ["atlanta-pride", "pride", "lgbtq", "festival", "piedmont-park"],
        "price_min": None,
        "price_max": None,
        "price_note": "Free admission to most festival grounds programming",
        "is_free": True,
        "is_tentpole": True,
        "source_url": selected_url,
        "ticket_url": selected_url,
        "image_url": None,
        "raw_text": f"Atlanta Pride festival window {start_date.isoformat()} to {end_date.isoformat()}",
        "extraction_confidence": 0.92,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=10",
        "content_hash": content_hash,
    }

    events_found = 1
    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        events_updated = 1
        logger.info("Updated: %s", title)
    else:
        insert_event(event_record)
        events_new = 1
        logger.info("Added: %s", title)

    _hydrate_festival(
        source_slug=source.get("slug") or "atlanta-pride",
        description=description,
        start_date=start_date,
        end_date=end_date,
        website=selected_url,
    )

    logger.info(
        "Atlanta Pride crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
