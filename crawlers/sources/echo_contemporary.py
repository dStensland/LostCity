"""
Crawler for Echo Contemporary (echocontemporary.com).

Strategy: static HTTP only — no Playwright required.  Squarespace renders
event content server-side, so a plain GET is sufficient.

Parse flow:
1. GET https://www.echocontemporary.com/events
2. Find all .eventlist-event items
3. For each item:
   - Extract title from .eventlist-title a
   - Extract start/end dates from time[datetime] elements
   - Extract description from .eventlist-description
   - Extract event URL from .eventlist-title a[href]
   - Fetch detail page for a better image when available
4. Classify: date span > 3 days OR exhibition-keyword titles → exhibition lane
   Everything else (openings, parties, artist talks) → event lane
5. Skip items whose end date (or start date) is already in the past

Gallery location confirmed March 2026: 785 Echo St NW, West Midtown, Atlanta GA 30318.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

from db import get_or_create_place, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.echocontemporary.com"
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
    "name": "Echo Contemporary",
    "slug": "echo-contemporary",
    "address": "785 Echo St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7703,
    "lng": -84.4145,
    "venue_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
    "vibes": ["contemporary", "gallery", "west-midtown", "art"],
}

EXHIBITION_TAGS = [
    "echo-contemporary",
    "gallery",
    "contemporary",
    "west-midtown",
    "art",
    "exhibition",
]

EVENT_TAGS = [
    "echo-contemporary",
    "gallery",
    "contemporary",
    "west-midtown",
    "art",
]

# Title keywords that classify an item as an exhibition even if its date span
# is short (e.g. opening receptions announced under the exhibition name).
_EXHIBITION_KEYWORDS = re.compile(
    r"\b(exhibition|solo show|group show|on view|solo exhibition|group exhibition)\b",
    re.IGNORECASE,
)

# Minimum day span to auto-classify as exhibition (opening-night receptions are 1 day)
_EXHIBITION_MIN_DAYS = 3


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("Echo Contemporary: request failed for %s: %s", url, exc)
        return None


def _parse_datetime_attr(val: str) -> Optional[date]:
    """Parse a datetime attribute value to a date object.

    Squarespace uses ISO 8601 datetime strings like "2026-02-28T10:00:00-0500"
    or bare date strings like "2026-03-28".
    """
    if not val:
        return None
    # Try full ISO datetime first, then bare date
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(val[:19], fmt.replace("%z", "")).date()
        except ValueError:
            continue
    # Fallback: strip timezone suffix and try again
    clean = re.sub(r"[+-]\d{4}$", "", val).split("T")[0]
    try:
        return datetime.strptime(clean, "%Y-%m-%d").date()
    except ValueError:
        return None


def _extract_image_from_detail(url: str, session: requests.Session) -> Optional[str]:
    """
    Fetch an event detail page and return the best image URL found.

    Squarespace detail pages typically have an og:image meta tag or a
    .eventitem-image img with a data-image or src attribute.
    """
    html = _fetch(url, session)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")

    # Prefer og:image — highest quality and most reliable
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]

    # Fallback: first squarespace image in the event body
    for img in soup.select(".eventitem-column-content img, .sqs-image-shape img"):
        src = img.get("data-src") or img.get("data-image") or img.get("src")
        if src:
            if src.startswith("//"):
                src = "https:" + src
            return src

    return None


def _is_exhibition(title: str, start: Optional[date], end: Optional[date]) -> bool:
    """Return True if this item should be routed as an exhibition."""
    if _EXHIBITION_KEYWORDS.search(title):
        return True
    if start and end:
        return (end - start).days >= _EXHIBITION_MIN_DAYS
    return False


def _parse_events_page(html: str) -> list[dict]:
    """
    Parse the /events listing page and return a list of raw item dicts.

    Each dict has:
        title, event_url, start_date (date | None), end_date (date | None),
        description (str | None), image_url (str | None)
    """
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []

    for item in soup.select(".eventlist-event"):
        # ----- Title + URL -----
        title_el = item.select_one(".eventlist-title a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        if not title:
            continue

        href = title_el.get("href", "")
        event_url = urljoin(BASE_URL, href) if href else EVENTS_URL

        # ----- Dates -----
        # Squarespace eventlist items have one or two <time datetime="..."> elements.
        # The first is the start; the second (when present) is the end.
        time_els = item.select("time[datetime]")
        start_date: Optional[date] = None
        end_date: Optional[date] = None
        if time_els:
            start_date = _parse_datetime_attr(time_els[0].get("datetime", ""))
        if len(time_els) >= 2:
            end_date = _parse_datetime_attr(time_els[-1].get("datetime", ""))

        # ----- Description -----
        desc_el = item.select_one(".eventlist-description")
        description: Optional[str] = None
        if desc_el:
            raw = desc_el.get_text(" ", strip=True)
            if raw:
                description = raw[:800] if len(raw) > 800 else raw

        # ----- Image (list page) -----
        image_url: Optional[str] = None
        img_el = item.select_one("img[data-src], img[data-image], img[src]")
        if img_el:
            src = (
                img_el.get("data-src")
                or img_el.get("data-image")
                or img_el.get("src")
            )
            if src:
                if src.startswith("//"):
                    src = "https:" + src
                image_url = src

        items.append(
            {
                "title": title,
                "event_url": event_url,
                "start_date": start_date,
                "end_date": end_date,
                "description": description,
                "image_url": image_url,
            }
        )

    return items


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Echo Contemporary — exhibitions and events via static HTTP."""
    source_id = source["id"]
    portal_id = source.get("portal_id")

    events_found = 0
    events_new = 0
    events_updated = 0

    today = date.today()
    session = requests.Session()

    venue_id = get_or_create_place(PLACE_DATA)

    # ------------------------------------------------------------------ #
    # Fetch and parse the /events listing page                             #
    # ------------------------------------------------------------------ #
    logger.info("Echo Contemporary: fetching %s", EVENTS_URL)
    html = _fetch(EVENTS_URL, session)
    if not html:
        logger.error("Echo Contemporary: failed to fetch events page")
        return 0, 0, 0

    raw_items = _parse_events_page(html)
    logger.info("Echo Contemporary: found %d items on events page", len(raw_items))

    exhibition_envelope = TypedEntityEnvelope()

    for item in raw_items:
        title = item["title"]
        start_date: Optional[date] = item["start_date"]
        end_date: Optional[date] = item["end_date"]
        description = item["description"]
        event_url = item["event_url"]
        image_url = item["image_url"]

        # Skip items that have fully passed
        cutoff = end_date if end_date else start_date
        if cutoff and cutoff < today:
            logger.debug(
                "Echo Contemporary: skipping past item %r (ended %s)", title, cutoff
            )
            continue

        events_found += 1

        # Attempt to enrich image from detail page when the list page has none
        if not image_url and event_url != EVENTS_URL:
            image_url = _extract_image_from_detail(event_url, session)

        start_date_str = start_date.strftime("%Y-%m-%d") if start_date else None
        end_date_str = end_date.strftime("%Y-%m-%d") if end_date else None

        # ---------------------------------------------------------------- #
        # Route: exhibition vs. event                                       #
        # ---------------------------------------------------------------- #
        if _is_exhibition(title, start_date, end_date):
            ex_record, ex_artists = build_exhibition_record(
                title=title,
                venue_id=venue_id,
                source_id=source_id,
                opening_date=start_date_str,
                closing_date=end_date_str,
                venue_name=PLACE_DATA["name"],
                description=description,
                image_url=image_url,
                source_url=event_url,
                portal_id=portal_id,
                admission_type="free",
                tags=EXHIBITION_TAGS,
            )
            exhibition_envelope.add("exhibitions", ex_record)
            logger.info(
                "Echo Contemporary: queued exhibition %r (%s – %s)",
                title,
                start_date_str or "?",
                end_date_str or "ongoing",
            )
        else:
            # Single-night or short event (opening reception, artist talk, party)
            if not start_date_str:
                logger.warning(
                    "Echo Contemporary: skipping event %r — no start date", title
                )
                continue

            content_hash = generate_content_hash(
                title, PLACE_DATA["name"], start_date_str
            )
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date_str,
                "start_time": None,
                "end_date": end_date_str,
                "end_time": None,
                "is_all_day": False,
                "category": "arts",
                "subcategory": "gallery",
                "tags": EVENT_TAGS,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": image_url,
                "raw_text": f"{title} - {start_date_str}",
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "content_hash": content_hash,
                "portal_id": portal_id,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                logger.debug(
                    "Echo Contemporary: event %r already exists (hash match)", title
                )
            else:
                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        "Echo Contemporary: added event %r on %s", title, start_date_str
                    )
                except Exception as exc:
                    logger.error(
                        "Echo Contemporary: failed to insert event %r: %s", title, exc
                    )

    # ------------------------------------------------------------------ #
    # Persist exhibitions                                                  #
    # ------------------------------------------------------------------ #
    if exhibition_envelope.exhibitions:
        persist_result = persist_typed_entity_envelope(exhibition_envelope)
        ex_persisted = persist_result.persisted.get("exhibitions", 0)
        ex_skipped = persist_result.skipped.get("exhibitions", 0)
        logger.info(
            "Echo Contemporary: persisted %d exhibition(s), %d skipped/updated",
            ex_persisted,
            ex_skipped,
        )

    logger.info(
        "Echo Contemporary crawl complete: %d found, %d new events, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
