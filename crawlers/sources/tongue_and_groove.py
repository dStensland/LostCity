"""
Crawler for Tongue & Groove (tongueandgrooveatl.com).
Buckhead nightclub with recurring weekly nightlife programming.

The venue website lists static recurring nights by day of week (no live calendar).
Tickets link to their Eventbrite organizer page. The old URL (tandgonline.com/events)
now blocks all non-browser requests. This crawler scrapes the current weekly schedule
from the homepage #events section and generates upcoming instances.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_existing_event_for_insert, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://tongueandgrooveatl.com"
TICKET_URL = "https://www.eventbrite.com/o/tongue-amp-groove-4990866211"
IMG_BASE = "https://www.tandgonline.com/assets/images/"
WEEKS_AHEAD = 8

PLACE_DATA = {
    "name": "Tongue & Groove",
    "slug": "tongue-and-groove",
    "address": "565 Main St NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8381,
    "lng": -84.3648,
    "place_type": "nightclub",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["nightclub", "buckhead", "upscale", "latin", "dj", "bottle-service", "late-night"],
}

# Day-of-week name to Python weekday integer (Monday=0)
DAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

# Fallback schedule if the site is unreachable or parsing fails.
# Format: (title, weekday_int, start_time, subcategory, description, image_filename)
FALLBACK_SCHEDULE = [
    (
        "En Vivo Wednesdays",
        2,
        "22:00",
        "latin_night",
        (
            "Live Latin music every Wednesday at Tongue & Groove in Buckhead. "
            "En Vivo brings live performers, DJs, and a full dance floor to Atlanta's "
            "premier nightclub."
        ),
        "party-next-door.jpg",
    ),
    (
        "Latin Wednesdays",
        2,
        "22:00",
        "latin_night",
        (
            "Latin Wednesday night at Tongue & Groove. Reggaeton, salsa, and Latin pop "
            "with top DJs in the heart of Buckhead."
        ),
        "latin-flyer-two.jpg",
    ),
    (
        "Perreo Logia",
        3,
        "22:00",
        "latin_night",
        (
            "Thursday night reggaeton and Latin club night at Tongue & Groove Buckhead. "
            "One of Atlanta's highest-energy Latin dance nights."
        ),
        "latin-flyer-one.jpg",
    ),
    (
        "NDSTRY Thursdays",
        3,
        "22:00",
        "dj",
        (
            "Industry Thursday at Tongue & Groove — Atlanta's nightlife industry night "
            "every Thursday in Buckhead. DJ sets, bottle service, and a late-night crowd."
        ),
        "thursday-at-tng.jpg",
    ),
    (
        "Ladies' Night",
        4,
        "21:00",
        "party",
        (
            "Ladies' Night every Friday at Tongue & Groove Buckhead. DJs, dancing, "
            "and Buckhead nightlife at its finest."
        ),
        "friday-at-tng.jpg",
    ),
    (
        "T&G Saturdays",
        5,
        "22:00",
        "dj",
        (
            "Saturday night at Tongue & Groove — Buckhead's flagship nightclub experience. "
            "Top DJs, bottle service, and Atlanta's best Saturday night crowd."
        ),
        "saturday-at-tng.jpg",
    ),
]


def _parse_day_of_week(text: str) -> Optional[int]:
    """Extract weekday integer from text like 'Wednesday, March 4th'."""
    text_lower = text.lower()
    for day_name, day_int in DAY_MAP.items():
        if text_lower.startswith(day_name):
            return day_int
    return None


def _get_next_weekday(start: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start + timedelta(days=days_ahead)


def _fetch_schedule() -> list[tuple[str, int, str, str, str, str]]:
    """
    Scrape nightly events from the venue homepage #events section.
    Returns list of (title, weekday_int, start_time, subcategory, description, image_filename).
    Falls back to FALLBACK_SCHEDULE on any error or empty parse.
    """
    try:
        resp = requests.get(
            BASE_URL,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
            },
            timeout=15,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        events_section = soup.find(id="events")
        if not events_section:
            logger.warning("Tongue & Groove: events section not found on homepage, using fallback")
            return FALLBACK_SCHEDULE

        results: list[tuple[str, int, str, str, str, str]] = []
        seen_titles: set[str] = set()

        for item in events_section.find_all("div", class_="col-lg-4"):
            h4 = item.find("h4")
            p_date = item.find("p", class_="text-secondary")
            img_tag = item.find("img")

            if not h4 or not p_date:
                continue

            title = h4.get_text(strip=True)
            date_text = p_date.get_text(strip=True)

            if title in seen_titles:
                continue
            seen_titles.add(title)

            weekday = _parse_day_of_week(date_text)
            if weekday is None:
                logger.debug(f"Tongue & Groove: could not parse day from '{date_text}' for '{title}'")
                continue

            # Infer subcategory from title
            title_lower = title.lower()
            if any(kw in title_lower for kw in ["latin", "vivo", "perreo", "reggaeton"]):
                subcategory = "latin_night"
            elif any(kw in title_lower for kw in ["ladies", "ladie"]):
                subcategory = "party"
            else:
                subcategory = "dj"

            # Image filename from src attribute
            img_src = img_tag.get("src", "") if img_tag else ""
            img_filename = img_src.split("/")[-1] if img_src else ""

            # Later start on Fri/Sat
            start_time = "22:00" if weekday >= 4 else "21:00"

            description = (
                f"Weekly {title} night at Tongue & Groove, Buckhead's premier nightclub. "
                "DJs, dancing, bottle service, and Atlanta's best nightlife crowd."
            )

            results.append((title, weekday, start_time, subcategory, description, img_filename))

        if results:
            logger.info(f"Tongue & Groove: scraped {len(results)} recurring nights from live site")
            return results

        logger.warning("Tongue & Groove: no events parsed from live site, using fallback")
        return FALLBACK_SCHEDULE

    except Exception as exc:
        logger.warning(f"Tongue & Groove: failed to fetch schedule ({exc}), using fallback")
        return FALLBACK_SCHEDULE


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Tongue & Groove recurring weekly nightlife schedule."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    logger.info(f"Tongue & Groove venue record ensured (ID: {venue_id})")

    schedule = _fetch_schedule()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for title, weekday, start_time, subcategory, description, img_filename in schedule:
        first_date = _get_next_weekday(today, weekday)
        day_code = DAY_CODES[weekday]
        day_name = list(DAY_MAP.keys())[weekday]

        image_url = f"{IMG_BASE}{img_filename}" if img_filename else None

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": description,
        }

        for week in range(WEEKS_AHEAD):
            event_date = first_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "nightlife",
                "subcategory": subcategory,
                "tags": ["tongue-and-groove", "buckhead", "nightclub", "dj", "late-night"],
                "is_free": False,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "source_url": BASE_URL,
                "ticket_url": TICKET_URL,
                "image_url": image_url,
                "raw_text": f"{title} at Tongue & Groove - {start_date}",
                "extraction_confidence": 0.85,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as exc:
                logger.error(
                    f"Tongue & Groove: failed to insert '{title}' on {start_date}: {exc}"
                )

    logger.info(
        f"Tongue & Groove crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
