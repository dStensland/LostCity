"""
Crawler for Creature Comforts Brewing — Atlanta Taproom (creaturecomfortsbeer.com).

Uses The Events Calendar REST API (`/wp-json/tribe/events/v1/events`).

The site hosts events for both their Athens taproom and their Atlanta
taproom at 1271 Center St NW (West Midtown). Athens events have a
`venue` list populated with `{"venue": "Athens Taproom", ...}`.
Atlanta taproom events have an empty `venue` list — this is the filter
used to identify Atlanta-only events.

Paginates through all pages at 50 events per page.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Optional

import requests

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://creaturecomfortsbeer.com"
EVENTS_API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"
PER_PAGE = 50

PLACE_DATA = {
    "name": "Creature Comforts Brewing — Atlanta",
    "slug": "creature-comforts-atl",
    "address": "1271 Center St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7940,
    "lng": -84.4199,
    "venue_type": "brewery",
    "spot_type": "brewery",
    "website": BASE_URL,
    "vibes": [
        "craft-beer",
        "brewery",
        "taproom",
        "live-music",
        "dog-friendly",
        "patio",
    ],
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _strip_html(html: str) -> str:
    """Remove HTML tags and decode basic entities."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&amp;", "&").replace("&nbsp;", " ").replace("&#8217;", "'")
    return re.sub(r"\s+", " ", text).strip()


def _parse_time(date_details: dict[str, Any]) -> Optional[str]:
    """
    Extract HH:MM start time from a tribe start_date_details dict.

    The dict looks like: {"year": "2026", "month": "03", "day": "14",
                          "hour": "15", "minutes": "00", "seconds": "00"}
    Returns None for midnight (00:00) since that usually means time unknown.
    """
    try:
        hour = int(date_details.get("hour", 0))
        minute = int(date_details.get("minutes", 0))
        if hour == 0 and minute == 0:
            return None
        return f"{hour:02d}:{minute:02d}"
    except (TypeError, ValueError):
        return None


def _is_atlanta_event(event: dict[str, Any]) -> bool:
    """
    Return True if this event belongs to the Atlanta taproom.

    Athens Taproom events have a populated `venue` list.
    Atlanta events have an empty `venue` list (their CMS doesn't assign
    a venue record for the Atlanta location).
    """
    venue_field = event.get("venue")
    # venue field is always a list in this API
    if isinstance(venue_field, list):
        return len(venue_field) == 0
    # Fallback: treat dict with empty/missing venue name as Atlanta
    if isinstance(venue_field, dict):
        return not venue_field.get("venue")
    return True


def _fetch_page(start_date: str, page: int) -> dict[str, Any]:
    """Fetch one page of events from the Tribe REST API."""
    params = {
        "start_date": start_date,
        "per_page": PER_PAGE,
        "page": page,
    }
    resp = requests.get(EVENTS_API_URL, params=params, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.json()


def _categorize(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """
    Infer category, subcategory, and tags from event title and description.
    """
    combined = (title + " " + description).lower()
    if any(
        w in combined
        for w in ["live music", "concert", "band", "musician", "dj", "singer"]
    ):
        return "music", "live_music", ["live-music", "brewery", "west-midtown"]
    if any(w in combined for w in ["trivia", "quiz"]):
        return "nightlife", "trivia", ["trivia", "brewery", "west-midtown"]
    if any(w in combined for w in ["yoga", "fitness", "run", "5k", "workout"]):
        return "fitness", None, ["fitness", "brewery", "west-midtown"]
    if any(
        w in combined for w in ["market", "vendor", "pop-up", "popup", "food truck"]
    ):
        return "food_drink", None, ["market", "brewery", "west-midtown"]
    if any(w in combined for w in ["release", "new beer", "tap takeover", "tapping"]):
        return "food_drink", None, ["beer-release", "brewery", "west-midtown"]
    return "food_drink", None, ["brewery", "craft-beer", "west-midtown"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Creature Comforts Atlanta taproom events via Tribe REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        today = datetime.now().strftime("%Y-%m-%d")

        page = 1
        while True:
            logger.info(
                f"Creature Comforts: fetching page {page} from {EVENTS_API_URL}"
            )
            try:
                data = _fetch_page(today, page)
            except requests.RequestException as e:
                logger.error(
                    f"Creature Comforts: API request failed on page {page}: {e}"
                )
                break

            all_events = data.get("events", [])
            total_pages = data.get("total_pages", 1) or 1

            # Filter to Atlanta taproom only
            atlanta_events = [e for e in all_events if _is_atlanta_event(e)]

            logger.info(
                f"Creature Comforts: page {page}/{total_pages} — "
                f"{len(all_events)} total, {len(atlanta_events)} Atlanta"
            )

            for event in atlanta_events:
                try:
                    title = _strip_html(event.get("title", "")).strip()
                    if not title:
                        continue

                    # Date and time
                    start_details = event.get("start_date_details") or {}
                    try:
                        start_date = datetime(
                            int(start_details.get("year", 0)),
                            int(start_details.get("month", 0)),
                            int(start_details.get("day", 0)),
                        ).strftime("%Y-%m-%d")
                    except (ValueError, TypeError):
                        # Fallback to string parse
                        raw_start = event.get("start_date", "")
                        if not raw_start:
                            logger.debug(
                                f"Creature Comforts: no date for '{title}', skipping"
                            )
                            continue
                        start_date = raw_start[:10]

                    start_time = _parse_time(start_details)

                    end_date_raw = event.get("end_date", "")
                    end_date = end_date_raw[:10] if end_date_raw else None
                    # Clear end_date if same as start_date (not meaningful)
                    if end_date == start_date:
                        end_date = None

                    # Description — strip HTML
                    description_html = event.get("description", "") or ""
                    description = _strip_html(description_html) or None

                    # Image
                    image_data = event.get("image") or {}
                    image_url: Optional[str] = None
                    if isinstance(image_data, dict):
                        image_url = image_data.get("url")

                    # Cost
                    cost_str = (event.get("cost") or "").strip()
                    price_min: Optional[float] = None
                    price_max: Optional[float] = None
                    price_note: Optional[str] = None
                    is_free = False

                    if cost_str:
                        cost_lower = cost_str.lower()
                        if "free" in cost_lower or cost_str == "0":
                            is_free = True
                        else:
                            numbers = re.findall(r"[\d.]+", cost_str)
                            if numbers:
                                vals = [float(n) for n in numbers]
                                price_min = min(vals)
                                price_max = max(vals)
                                price_note = cost_str
                    else:
                        # Most brewery taproom events are free
                        is_free = True

                    event_url = event.get("url") or f"{BASE_URL}/events/"
                    ticket_url = event.get("website") or None

                    category, subcategory, tags = _categorize(title, description or "")

                    events_found += 1
                    content_hash = generate_content_hash(
                        title, PLACE_DATA["name"], start_date
                    )

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": event.get("all_day", False),
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        logger.debug(f"Updated: {title} on {start_date}")
                    else:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")

                except Exception as e:
                    logger.error(
                        f"Creature Comforts: failed to process event "
                        f"'{event.get('title', '?')}': {e}"
                    )
                    continue

            if page >= total_pages:
                break
            page += 1

        logger.info(
            f"Creature Comforts Atlanta crawl complete: "
            f"{events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Creature Comforts: crawl failed: {e}")
        raise

    return events_found, events_new, events_updated
