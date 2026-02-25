"""
Crawler for Theatrical Outfit (theatricaloutfit.org).

Reads live performances from the events calendar (FullCalendar UI).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.theatricaloutfit.org"
CALENDAR_URL = f"{BASE_URL}/events-calendar/"
MONTHS_AHEAD = 4

VENUE_DATA = {
    "name": "Theatrical Outfit",
    "slug": "theatrical-outfit",
    "address": "84 Luckie St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7580,
    "lng": -84.3918,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}


def _normalize_title(value: str) -> str:
    text = " ".join((value or "").split()).strip()
    if not text:
        return ""
    if text.isupper():
        return text.title()
    return text


def _parse_calendar_time(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    text = " ".join(value.replace(".", ":").split()).upper()
    if text == "ALL DAY":
        return None

    for fmt in ("%I:%M %p", "%I %p"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def _to_absolute_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if value.startswith("http"):
        return value
    return f"{BASE_URL}/{value.lstrip('/')}"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Theatrical Outfit calendar performances."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)
            today = datetime.now().date()
            max_date = today + timedelta(days=180)

            logger.info("Fetching Theatrical Outfit calendar: %s", CALENDAR_URL)
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(6000)

            for month_idx in range(MONTHS_AHEAD):
                perf_nodes = page.query_selector_all(".fc-daygrid-day .c-cal-perf")
                logger.info("Calendar month %s: %s performances in view", month_idx + 1, len(perf_nodes))

                for perf in perf_nodes:
                    try:
                        date_text = perf.evaluate(
                            "el => el.closest('.fc-daygrid-day')?.getAttribute('data-date')"
                        )
                        if not date_text:
                            continue

                        try:
                            start_day = datetime.strptime(date_text, "%Y-%m-%d").date()
                        except ValueError:
                            continue

                        if start_day < today or start_day > max_date:
                            continue

                        title_el = perf.query_selector(".c-cal-perf__title")
                        time_el = perf.query_selector(".c-cal-perf__time")

                        title = _normalize_title(title_el.inner_text() if title_el else "")
                        if not title:
                            continue

                        start_time = _parse_calendar_time(time_el.inner_text() if time_el else None)

                        view_url = None
                        ticket_url = None
                        for anchor in perf.query_selector_all("a"):
                            label = (anchor.inner_text() or "").strip().lower()
                            href = _to_absolute_url(anchor.get_attribute("href"))
                            if not href:
                                continue
                            if label == "view":
                                view_url = href
                            elif "ticket" in label:
                                ticket_url = href

                        source_url = view_url or CALENDAR_URL
                        if not ticket_url:
                            ticket_url = view_url

                        content_hash = generate_content_hash(
                            title,
                            VENUE_DATA["name"],
                            f"{date_text}|{start_time or ''}|{source_url}",
                        )

                        if content_hash in seen_hashes:
                            continue
                        seen_hashes.add(content_hash)

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"{title} at Theatrical Outfit",
                            "start_date": date_text,
                            "start_time": start_time or "19:30",
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "theater",
                            "subcategory": "play",
                            "tags": [
                                "theatrical-outfit",
                                "theater",
                                "downtown",
                                "balzer-theater",
                                "performance",
                            ],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": source_url,
                            "ticket_url": ticket_url,
                            "image_url": None,
                            "raw_text": f"{title} {date_text} {start_time or ''}".strip(),
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
                            logger.info("Added: %s on %s", title, date_text)
                        except Exception as e:
                            logger.error("Failed to insert %s: %s", title, e)

                    except Exception as e:
                        logger.debug("Failed to parse performance node: %s", e)
                        continue

                # Advance the calendar one month forward.
                if month_idx < MONTHS_AHEAD - 1:
                    next_btn = page.query_selector(".fc-next-button")
                    if not next_btn:
                        break
                    try:
                        next_btn.click()
                        page.wait_for_timeout(1500)
                    except Exception:
                        break

            browser.close()

        logger.info(
            "Theatrical Outfit crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as e:
        logger.error("Failed to crawl Theatrical Outfit: %s", e)
        raise

    return events_found, events_new, events_updated
