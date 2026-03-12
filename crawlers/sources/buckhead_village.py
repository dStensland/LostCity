"""
Crawler for Buckhead Village District (buckheadvillagedistrict.com).
Upscale retail and dining district in Buckhead, managed by Jamestown.

Uses Squarespace eventlist pattern (same as Krog District).
Events scraped from /happenings page.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.buckheadvillagedistrict.com"
EVENTS_URL = f"{BASE_URL}/happenings"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

VENUE_DATA = {
    "name": "Buckhead Village District",
    "slug": "buckhead-village-district",
    "address": "3035 Peachtree Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8388,
    "lng": -84.3798,
    "venue_type": "venue",
    "spot_type": "venue",
    "website": BASE_URL,
    "vibes": ["buckhead", "upscale", "dining", "shopping", "nightlife"],
}


def _parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats to HH:MM."""
    if not time_str:
        return None
    m = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_str.strip(), re.IGNORECASE)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2)) if m.group(2) else 0
    period = m.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _classify_event(title: str) -> tuple[str, Optional[str], list[str]]:
    """Classify event by title keywords."""
    title_lower = title.lower()
    tags = ["buckhead-village", "buckhead"]

    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "nightlife", "nightlife.trivia", tags + ["trivia"]
    if any(w in title_lower for w in ["comedy", "comedian"]):
        return "comedy", "comedy.standup", tags + ["comedy"]
    if any(w in title_lower for w in ["rugby", "sport"]):
        return "nightlife", None, tags + ["sports"]
    if any(w in title_lower for w in ["music", "concert", "live", "dj", "band"]):
        return "music", "concert", tags + ["live-music"]
    if any(w in title_lower for w in ["tasting", "wine", "tuna", "dinner", "brunch"]):
        return "food_drink", None, tags + ["food"]
    if any(w in title_lower for w in ["market", "pop-up", "blooms", "festival"]):
        return "community", None, tags + ["market"]
    if any(w in title_lower for w in ["yoga", "fitness", "run"]):
        return "fitness", None, tags + ["fitness"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Buckhead Village District events from Squarespace eventlist."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    try:
        resp = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error(f"Failed to fetch Buckhead Village events: {exc}")
        return events_found, events_new, events_updated

    soup = BeautifulSoup(resp.text, "html.parser")

    # Squarespace eventlist pattern
    articles = soup.select("article.eventlist-event") or soup.select(".eventlist-event")

    if not articles:
        # Try alternative Squarespace selectors
        articles = soup.select("[data-type='events'] article") or soup.select(".eventlist-item")

    if not articles:
        logger.warning("Buckhead Village: no event articles found")
        return events_found, events_new, events_updated

    logger.info(f"Buckhead Village: found {len(articles)} event articles")
    today = datetime.now().date()

    for article in articles:
        try:
            # Title
            title_el = (
                article.select_one(".eventlist-title-link")
                or article.select_one(".eventlist-title a")
                or article.select_one("h1 a, h2 a, h3 a")
            )
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Event URL
            rel_url = title_el.get("href", "")
            event_url = (BASE_URL + rel_url) if rel_url.startswith("/") else rel_url
            if not event_url:
                event_url = EVENTS_URL

            # Date from time[datetime] attribute
            time_els = article.select("time[datetime]")
            if not time_els:
                continue
            start_date_str = time_els[0].get("datetime", "")
            if not start_date_str or len(start_date_str) < 10:
                continue
            start_date = start_date_str[:10]

            try:
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            if start_date_obj < today:
                continue

            events_found += 1

            # Start time
            start_time: Optional[str] = None
            time_meta = article.select_one(".eventlist-meta-time")
            if time_meta:
                time_raw = time_meta.get_text(strip=True)
                first_time = re.split(r"\s{2,}|\n", time_raw)[0].strip()
                start_time = _parse_time(first_time) or _parse_time(time_raw)

            # Description
            excerpt_el = article.select_one(".eventlist-excerpt")
            description = excerpt_el.get_text(separator=" ", strip=True) if excerpt_el else None

            # Image
            image_url: Optional[str] = None
            img_el = article.select_one("img")
            if img_el:
                raw_src = img_el.get("data-src") or img_el.get("src") or ""
                if raw_src.startswith("//"):
                    raw_src = "https:" + raw_src
                if raw_src.startswith("http"):
                    image_url = raw_src

            # Classify
            category, subcategory, tags = _classify_event(title)

            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description or f"Event at Buckhead Village District",
                "start_date": start_date,
                "start_time": start_time or "18:00",
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_url,
                "ticket_url": None,
                "image_url": image_url,
                "raw_text": title,
                "extraction_confidence": 0.80,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.debug(f"Buckhead Village: added '{title}' on {start_date}")
            except Exception as exc:
                logger.error(f"Buckhead Village: failed to insert '{title}': {exc}")

        except Exception as exc:
            logger.debug(f"Buckhead Village: error parsing article: {exc}")
            continue

    logger.info(
        f"Buckhead Village crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
