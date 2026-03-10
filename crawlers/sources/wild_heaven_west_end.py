"""
Crawler for Wild Heaven Beer West End (wildheavenbeer.com/west-end).
Beltline-adjacent brewery in the West End neighborhood.

Scrapes the live events calendar at /west-end/events for music, markets,
trivia, classes, and special events. Weekly drink specials (Half-off Pitchers,
Thirsty Thursday, Happiest Hour, Monday Funday) are filtered out — those are
venue metadata, not programmed events.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://wildheavenbeer.com"
EVENTS_URL = f"{BASE_URL}/west-end/events"

REQUEST_TIMEOUT = 30
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

VENUE_DATA = {
    "name": "Wild Heaven West End",
    "slug": "wild-heaven-west-end",
    "address": "1010 White St SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7396,
    "lng": -84.4125,
    "venue_type": "brewery",
    "spot_type": "brewery",
    "website": BASE_URL,
    "vibes": ["craft-beer", "brewery", "beltline", "west-end", "patio", "dog-friendly"],
}

# Drink specials that are venue metadata, not programmed events.
# Matched case-insensitively against the event title.
SPECIALS_SUBSTRINGS = [
    "half-off pitchers",
    "thirsty thursday",
    "happiest hour",
    "monday funday",
    "half-priced cocktails",
    "margarita monday",
]


def _is_special(title: str) -> bool:
    """Return True if this is a drink special that should be filtered out."""
    lower = title.lower()
    return any(kw in lower for kw in SPECIALS_SUBSTRINGS)


def _infer_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """
    Return (category, subcategory, tags) inferred from the event title.
    """
    lower = title.lower()

    # Trivia
    if "trivia" in lower:
        return (
            "nightlife",
            "nightlife.trivia",
            ["trivia", "nightlife", "brewery", "west-end", "beltline"],
        )

    # Market / farmers market
    if "market" in lower or "mushroom" in lower:
        return (
            "food_drink",
            None,
            ["market", "farmers-market", "food", "brewery", "west-end", "beltline", "dog-friendly"],
        )

    # Beer school / educational talks
    if "beer school" in lower or "school" in lower or "math of sports" in lower or "psychology" in lower:
        return (
            "arts_culture",
            None,
            ["class", "education", "talk", "brewery", "west-end"],
        )

    # Live music (default for concerts/shows)
    return (
        "music",
        "live_music",
        ["live-music", "music", "brewery", "west-end", "beltline", "garden-club"],
    )


def _is_recurring(title: str) -> bool:
    """Return True for events that repeat on a schedule."""
    lower = title.lower()
    return "trivia" in lower or "beer school" in lower or "mushroom market" in lower


def _series_hint_for(title: str) -> Optional[dict]:
    """Return a series_hint dict for recurring events, or None for one-offs."""
    lower = title.lower()
    if "trivia" in lower:
        return {
            "series_type": "recurring_show",
            "series_title": "Trivia at Wild Heaven West End",
            "frequency": "weekly",
            "day_of_week": "tuesday",
        }
    if "mushroom market" in lower or ("market" in lower and "mushroom" in lower):
        return {
            "series_type": "recurring_show",
            "series_title": "Atlanta Mushroom Market at Wild Heaven West End",
            "frequency": "monthly",
        }
    if "beer school" in lower:
        return {
            "series_type": "class_series",
            "series_title": "Last Sunday Beer School at Wild Heaven West End",
            "frequency": "monthly",
            "day_of_week": "sunday",
        }
    return None


def _resolve_image(src: str) -> Optional[str]:
    """Convert relative image paths to absolute URLs."""
    if not src:
        return None
    if src.startswith("http"):
        return src
    return urljoin(BASE_URL + "/", src)


def _parse_date(date_text: str) -> Optional[str]:
    """
    Parse the date heading text like 'Wed, Mar 11, 2026 (West End)'
    into a YYYY-MM-DD string.
    """
    # Strip location suffix like ' (West End)'
    clean = re.sub(r"\s*\([^)]*\)", "", date_text).strip()
    # Try 'Wed, Mar 11, 2026'
    for fmt in ("%a, %b %d, %Y", "%a, %B %d, %Y"):
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    logger.warning("Wild Heaven West End: could not parse date from '%s'", date_text)
    return None


def _fetch_events_page() -> list[dict]:
    """
    Fetch the events calendar and return a list of raw event dicts.
    Each dict has: title, start_date, description, image_url, source_url.
    Drink specials are already filtered out.
    """
    resp = requests.get(
        EVENTS_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    holders = soup.find_all("div", class_="eventHolder")

    if not holders:
        logger.warning("Wild Heaven West End: no eventHolder divs found — page structure may have changed")

    events: list[dict] = []
    for holder in holders:
        title_el = holder.find("h2", class_="card-title")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)

        if not title or _is_special(title):
            continue

        # Parse date from the 'Wed, Mar 11, 2026 (West End)' heading
        date_el = holder.find("h4", class_="mt-3")
        if not date_el:
            continue
        start_date = _parse_date(date_el.get_text(strip=True))
        if not start_date:
            continue

        # Description: text node immediately after the date heading
        description = ""
        sib = date_el.next_sibling
        while sib is not None:
            candidate = str(sib).strip()
            # Skip whitespace-only and HTML tags that have no real text
            if candidate and not candidate.startswith("<"):
                description = candidate
                break
            if hasattr(sib, "get_text"):
                text = sib.get_text(strip=True)
                if text:
                    description = text
                    break
            sib = sib.next_sibling

        # Image
        img_el = holder.find("img", class_="img-fluid")
        image_url = _resolve_image(img_el.get("src", "")) if img_el else None

        # Event detail URL (slug-based, relative to base)
        link_el = holder.find("a", class_="bottomLink")
        href = link_el.get("href", "") if link_el else ""
        # href is like 'event/marc-ribot-2026-03-20' (relative, no leading slash)
        source_url = urljoin(BASE_URL + "/west-end/", href) if href else EVENTS_URL

        events.append(
            {
                "title": title,
                "start_date": start_date,
                "description": description,
                "image_url": image_url,
                "source_url": source_url,
            }
        )

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Scrape Wild Heaven West End events calendar and upsert programmed events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    logger.info("Wild Heaven West End venue record ensured (ID: %s)", venue_id)

    try:
        raw_events = _fetch_events_page()
    except Exception as exc:
        logger.error("Wild Heaven West End: failed to fetch events page: %s", exc)
        raise

    logger.info("Wild Heaven West End: scraped %d events (specials already filtered)", len(raw_events))

    for raw in raw_events:
        title = raw["title"]
        start_date = raw["start_date"]
        description = raw.get("description") or ""
        image_url = raw.get("image_url")
        source_url = raw["source_url"]

        category, subcategory, tags = _infer_category(title)
        recurring = _is_recurring(title)
        series_hint = _series_hint_for(title)

        # Build a richer description if the scraped one is too thin
        if not description or description.lower() == title.lower():
            if category == "music":
                description = (
                    "Live music at Wild Heaven West End in the Garden Club. "
                    "Beltline-adjacent brewery on the Lee+White development."
                )
            elif subcategory == "nightlife.trivia":
                description = (
                    "Tuesday trivia night at Wild Heaven West End near the Beltline. "
                    "Dirty South Trivia with craft beer and tacos — $5 Dealer's Choice beers, "
                    "3 tacos and a beer for $15."
                )

        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": None,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "is_free": None,  # pricing info not consistently available on listing page
            "price_min": None,
            "price_max": None,
            "source_url": source_url,
            "ticket_url": None,
            "image_url": image_url,
            "raw_text": f"{title} - {start_date}",
            "extraction_confidence": 0.88,
            "is_recurring": recurring,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        events_found += 1

        # Dedup: recurring events use find_existing_event_for_insert (title+venue+date),
        # one-off events check by content hash.
        existing = find_existing_event_for_insert(event_record) if recurring else find_event_by_hash(content_hash)

        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info("Added: %s on %s", title, start_date)
        except Exception as exc:
            logger.error("Wild Heaven West End: failed to insert '%s' on %s: %s", title, start_date, exc)

    logger.info(
        "Wild Heaven West End crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
