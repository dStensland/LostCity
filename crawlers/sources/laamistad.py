"""
Crawler for LaAmistad (laamistadinc.org/events/).

LaAmistad is a Sandy Springs nonprofit serving immigrant and refugee
communities in metro Atlanta through education, workforce development,
and family support programs.

Events include:
- Fiesta LaAmistad (annual fundraising gala)
- Volunteer training sessions
- ESL program registration windows
- Community fairs and family events
- Volunteer appreciation events

Site uses WordPress + Elementor with the EAEL Event Calendar widget.
Events are embedded as a JSON blob in the `data-events` attribute of a
`div.eael-event-calendar-cls` element — no JS rendering required.

The event data format (each item):
  {
    "id": int,
    "title": str,
    "description": str (may contain HTML),
    "start": "YYYY-MM-DD HH:MM" or "YYYY-MM-DD",
    "end":   "YYYY-MM-DD HH:MM" or "YYYY-MM-DD",
    "url":   str (registration or anchor link),
    "allDay": "yes" | "",
    "color":  str (CSS hex),
    ...
  }
"""

from __future__ import annotations

import html
import json
import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://laamistadinc.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "LaAmistad",
    "slug": "laamistad",
    "address": "120 Northwood Dr Suite 140",
    "neighborhood": "Sandy Springs",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.9212,
    "lng": -84.3638,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*",
}

# Internal/operational events that are not public-facing discovery items
_SKIP_TITLE_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bspring break\b", re.IGNORECASE),
    re.compile(r"\b(no afterschool|no after.?school)\b", re.IGNORECASE),
    re.compile(r"\bdeadline\b", re.IGNORECASE),
    re.compile(r"\bresumes?\b", re.IGNORECASE),
    re.compile(r"\bregistration\b", re.IGNORECASE),
    re.compile(r"\borientation\b", re.IGNORECASE),
    re.compile(r"\b(esl|english) (begins|session|class)\b", re.IGNORECASE),
]

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(raw: str, max_len: int = 600) -> str:
    """Strip HTML tags and decode entities."""
    if not raw:
        return ""
    text = html.unescape(raw)
    text = _HTML_TAG_RE.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 3].rstrip() + "..."
    return text


def _parse_event_datetime(
    raw: str,
) -> tuple[Optional[str], Optional[str], bool]:
    """
    Parse a Elementor calendar date string into (date_str, time_str, is_all_day).

    Formats seen:
      "2026-09-26 18:00"   → ("2026-09-26", "18:00", False)
      "2026-09-26"         → ("2026-09-26", None, True)  (date-only = all-day)
    """
    if not raw:
        return None, None, False

    raw = raw.strip()

    # Datetime with time
    m = re.match(r"^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::\d{2})?$", raw)
    if m:
        return m.group(1), m.group(2), False

    # Date only
    m = re.match(r"^(\d{4}-\d{2}-\d{2})$", raw)
    if m:
        return m.group(1), None, True

    return None, None, False


def _infer_category(title: str, description: str) -> tuple[str, list[str]]:
    """Return (category, tags) for a LaAmistad event."""
    text = f"{title} {description}".lower()
    tags: list[str] = ["nonprofit", "immigrant-community", "latin"]

    if re.search(r"\b(gala|fiesta|fundrais|ball|celebration)\b", text):
        tags.extend(["fundraiser", "gala", "community"])
        return "community", tags

    if re.search(r"\b(fair|fest|festival)\b", text):
        tags.extend(["community", "family-friendly"])
        return "community", tags

    if re.search(r"\b(volunteer|training|workshop)\b", text):
        tags.extend(["volunteer"])
        return "community", tags

    tags.append("community")
    return "community", tags


def _should_skip(title: str) -> bool:
    """Return True for operational/internal events not suitable for discovery."""
    for pattern in _SKIP_TITLE_PATTERNS:
        if pattern.search(title):
            return True
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl LaAmistad events from their Elementor calendar widget.

    The widget embeds all events as a JSON blob in the `data-events`
    attribute of `.eael-event-calendar-cls` — accessible without JS rendering.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)
    except Exception as exc:
        logger.error("[laamistad] Failed to create/find venue: %s", exc)
        return 0, 0, 0

    try:
        resp = requests.get(EVENTS_URL, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("[laamistad] Failed to fetch events page: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    calendar_div = soup.find("div", class_="eael-event-calendar-cls")
    if not calendar_div:
        logger.warning("[laamistad] No eael-event-calendar-cls found on page")
        return 0, 0, 0

    raw_events_json = calendar_div.get("data-events", "")
    if not raw_events_json:
        logger.warning("[laamistad] Empty data-events attribute")
        return 0, 0, 0

    try:
        raw_events: list[dict] = json.loads(raw_events_json)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("[laamistad] Failed to parse data-events JSON: %s", exc)
        return 0, 0, 0

    logger.info("[laamistad] Found %d raw events in calendar", len(raw_events))

    today = date.today()

    for raw in raw_events:
        title_raw = (raw.get("title") or "").strip()
        if not title_raw:
            continue

        title = html.unescape(title_raw).strip()
        if not title:
            continue

        if _should_skip(title):
            logger.debug("[laamistad] Skipping internal event: %s", title)
            continue

        start_raw = raw.get("start", "") or ""
        start_date_str, start_time_str, is_all_day = _parse_event_datetime(start_raw)

        if not start_date_str:
            logger.debug("[laamistad] No valid start date for: %s", title)
            continue

        # Skip past events
        try:
            event_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            if event_date < today:
                continue
        except ValueError:
            continue

        # End date/time
        end_raw = raw.get("end", "") or ""
        end_date_str, end_time_str, _ = _parse_event_datetime(end_raw)
        # Elementor often sets end to "HH:MM:01" as a 1-second sentinel — strip
        # those so we don't display misleading end times
        if end_time_str and end_time_str.endswith(":01"):
            end_time_str = None

        # all_day override from widget attribute
        if raw.get("allDay") == "yes":
            is_all_day = True
            start_time_str = None
            end_time_str = None

        # Description
        desc_raw = raw.get("description", "") or ""
        description = _strip_html(desc_raw) or None

        # URL
        event_url = (raw.get("url") or "").strip()
        # Internal anchor links — resolve to absolute URL
        if event_url and event_url.startswith("/"):
            event_url = f"{BASE_URL}{event_url}"
        elif event_url and not event_url.startswith("http"):
            event_url = EVENTS_URL
        if not event_url:
            event_url = EVENTS_URL

        # Category / tags
        category, tags = _infer_category(title, description or "")

        # Content hash
        hash_key = f"{start_date_str}|{start_time_str}" if start_time_str else start_date_str
        content_hash = generate_content_hash(title, VENUE_DATA["name"], hash_key)

        events_found += 1

        record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title[:200],
            "description": description,
            "start_date": start_date_str,
            "start_time": start_time_str,
            "end_date": end_date_str,
            "end_time": end_time_str,
            "is_all_day": is_all_day,
            "category": category,
            "tags": tags,
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": None,
            "raw_text": f"{title} | laamistad",
            "extraction_confidence": 0.85,
            "is_recurring": False,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, record)
            events_updated += 1
        else:
            try:
                insert_event(record)
                events_new += 1
                logger.info(
                    "[laamistad] Added: %s on %s", title, start_date_str
                )
            except Exception as exc:
                logger.error(
                    "[laamistad] Failed to insert %r: %s", title, exc
                )

    logger.info(
        "[laamistad] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
