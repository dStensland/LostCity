"""
Crawler for Windmill Arts Center (windmillarts.org).

Strategy: static HTTP only — no Playwright required. Squarespace renders
the event list server-side, so a plain GET on /events is sufficient.

Parse flow:
1. GET https://www.windmillarts.org/events
2. Find all .eventlist-event items
3. For each item:
   - Title from .eventlist-title a
   - Date from the first time[datetime] element (date-only, e.g. "2026-03-21")
   - Start/end times from the 2nd and 3rd time[datetime] elements (text "7:00 PM")
   - Description from .eventlist-description
   - Image from data-src/data-image on the thumbnail img
   - Event URL from .eventlist-title a[href]
4. Skip events that have already ended (eventlist-event--past class or start_date < today)
5. Group events with the same title into series via series_hint.
   FADlab Fest sub-events are grouped under a festival series.

All content from Windmill Arts is classified as events (workshops, performances,
festival sessions). The venue is a community arts center in East Point.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag

from db import get_or_create_place, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.windmillarts.org"
EVENTS_URL = f"{BASE_URL}/events"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

PLACE_DATA = {
    "name": "Windmill Arts",
    "slug": "windmill-arts",
    "address": "2840 East Point St",
    "neighborhood": "East Point",
    "city": "East Point",
    "state": "GA",
    "zip": "30344",
    "lat": 33.6795,
    "lng": -84.4393,
    "place_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["art", "community", "workshops", "east-point", "creative"],
}

BASE_TAGS = ["windmill-arts", "art", "community", "east-point", "workshops"]

# Category inference from title keywords
_WORKSHOP_KEYWORDS = ("workshop", "class", "intro to", "intermediate", "composition", "ensemble")
_PERFORMANCE_KEYWORDS = ("untamed", "show", "performance", "fest", "festival", "concert", "independent:")
_FESTIVAL_TITLES = ("fadlab fest",)


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("Windmill Arts: request failed for %s: %s", url, exc)
        return None


def _parse_time(time_text: str) -> Optional[str]:
    """
    Convert a Squarespace event list time string like "7:00 PM" or "7:00\u202fPM"
    to 24-hour HH:MM format.  Returns None if unparseable.
    """
    # Normalise narrow no-break space and regular space before AM/PM
    cleaned = time_text.replace("\u202f", " ").strip()
    for fmt in ("%I:%M %p", "%I:%M%p"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def _infer_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Map title keywords to (category, subcategory, extra_tags)."""
    lower = title.lower()

    if any(kw in lower for kw in _FESTIVAL_TITLES):
        return "arts", "performance", ["festival", "performing-arts"]

    if any(kw in lower for kw in _WORKSHOP_KEYWORDS):
        return "learning", "workshop", ["workshop", "performing-arts"]

    if any(kw in lower for kw in _PERFORMANCE_KEYWORDS):
        return "arts", "performance", ["performing-arts"]

    if "clown" in lower:
        return "learning", "workshop", ["workshop", "performing-arts", "clown"]

    if "film" in lower or "filmmaking" in lower or "cinema" in lower:
        return "arts", "film", ["film", "cinema"]

    return "arts", "performance", ["performing-arts"]


def _is_festival_title(title: str) -> bool:
    """True if this title belongs to a known festival umbrella."""
    return any(kw in title.lower() for kw in _FESTIVAL_TITLES)


def _parse_event_item(item: Tag) -> Optional[dict]:
    """
    Parse a single .eventlist-event <article> into a raw event dict.

    Returns None if required fields (title, date) are missing.
    """
    # Title and event URL
    title_el = item.select_one(".eventlist-title a")
    if not title_el:
        return None
    title = title_el.get_text(strip=True)
    if not title:
        return None

    event_path = title_el.get("href", "")
    source_url = (BASE_URL + event_path) if event_path.startswith("/") else event_path or EVENTS_URL

    # Time elements: [0] = date (date-only datetime attr), [1] = start time text, [2] = end time text
    time_els = item.select("time[datetime]")
    if not time_els:
        return None

    start_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    # First time element carries the date
    date_attr = time_els[0].get("datetime", "").strip()
    # Squarespace uses YYYY-MM-DD in the datetime attribute here
    if re.match(r"\d{4}-\d{2}-\d{2}$", date_attr):
        start_date = date_attr
    else:
        # Try to parse full ISO datetime
        try:
            start_date = datetime.fromisoformat(date_attr).strftime("%Y-%m-%d")
        except ValueError:
            return None

    if not start_date:
        return None

    # Second element = start time text, third = end time text
    if len(time_els) >= 2:
        start_time = _parse_time(time_els[1].get_text(strip=True))
    if len(time_els) >= 3:
        end_time = _parse_time(time_els[2].get_text(strip=True))

    # Description — only present on some items
    desc_el = item.select_one(".eventlist-description")
    description: Optional[str] = None
    if desc_el:
        desc_text = desc_el.get_text(" ", strip=True)
        if desc_text:
            description = desc_text[:1000]

    # Image — prefer data-src, fall back to src on the thumbnail img
    image_url: Optional[str] = None
    img_el = item.select_one("img[data-src], img[data-image], img[src]")
    if img_el:
        for attr in ("data-src", "data-image", "src"):
            val = img_el.get(attr, "").strip()
            if val and val.startswith("http"):
                image_url = val
                break

    return {
        "title": title,
        "start_date": start_date,
        "start_time": start_time,
        "end_time": end_time,
        "description": description,
        "image_url": image_url,
        "source_url": source_url,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Windmill Arts events via static HTTP (no Playwright)."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0

    today_str = datetime.now().strftime("%Y-%m-%d")

    session = requests.Session()
    venue_id = get_or_create_place(PLACE_DATA)

    logger.info("Windmill Arts: fetching events page %s", EVENTS_URL)
    html = _fetch(EVENTS_URL, session)
    if not html:
        logger.error("Windmill Arts: failed to fetch events page")
        return 0, 0, 0

    soup = BeautifulSoup(html, "html.parser")
    items = soup.select(".eventlist-event")
    logger.info("Windmill Arts: found %d .eventlist-event items", len(items))

    # Collect unique titles to determine series candidates
    title_counts: dict[str, int] = {}
    for item in items:
        title_el = item.select_one(".eventlist-title a")
        if title_el:
            t = title_el.get_text(strip=True)
            if t:
                title_counts[t] = title_counts.get(t, 0) + 1

    for item in items:
        # Skip past events — Squarespace marks them with this class
        item_classes = item.get("class") or []
        if "eventlist-event--past" in item_classes:
            continue

        parsed = _parse_event_item(item)
        if not parsed:
            continue

        title = parsed["title"]
        start_date = parsed["start_date"]

        # Secondary date guard: skip anything before today
        if start_date < today_str:
            continue

        events_found += 1

        category, subcategory, extra_tags = _infer_category(title)
        tags = BASE_TAGS + extra_tags

        # Build series_hint for recurring events (same title appears more than once)
        # and for festival sub-events
        series_hint: Optional[dict] = None
        if _is_festival_title(title):
            series_hint = {
                "series_type": "festival_program",
                "series_title": title,
            }
        elif title_counts.get(title, 1) > 1:
            series_hint = {
                "series_type": "recurring_show",
                "series_title": title,
            }

        content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

        event_record: dict = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": parsed["description"],
            "start_date": start_date,
            "start_time": parsed["start_time"],
            "end_date": start_date,
            "end_time": parsed["end_time"],
            "is_all_day": False,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": None,
            "source_url": parsed["source_url"],
            "ticket_url": parsed["source_url"],
            "image_url": parsed["image_url"],
            "raw_text": f"{title} - {start_date}",
            "extraction_confidence": 0.9,
            "is_recurring": series_hint is not None,
            "content_hash": content_hash,
        }

        if portal_id:
            event_record["portal_id"] = portal_id

        existing = find_event_by_hash(content_hash)
        if existing:
            events_updated += 1
            logger.debug("Windmill Arts: event already exists: %r on %s", title, start_date)
        else:
            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info("Windmill Arts: added event %r on %s", title, start_date)
            except Exception as exc:
                logger.error(
                    "Windmill Arts: failed to insert event %r on %s: %s",
                    title,
                    start_date,
                    exc,
                )

    logger.info(
        "Windmill Arts crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
