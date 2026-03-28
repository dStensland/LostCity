"""
Crawler for the Georgia Government Transparency & Campaign Finance Commission.

Official sources:
- https://ethics.ga.gov/feed/
- https://ethics.ga.gov/

This source provides statewide process visibility for HelpATL through:
- official commission meetings
- official campaign finance / ethics training events
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from html import unescape
from typing import Optional
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://ethics.ga.gov"
FEED_URL = f"{BASE_URL}/feed/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}

PLACE_DATA = {
    "name": "Georgia Ethics Commission",
    "slug": "georgia-ethics-commission",
    "address": "200 Piedmont Ave SE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30334",
    "lat": 33.7487,
    "lng": -84.3826,
    "place_type": "government",
    "spot_type": "government",
    "website": BASE_URL,
}

_TRAINING_BLOCK_RE = re.compile(r"2026 Trainings:(.+?)(?:CONNECT WITH US|CONTACT US)", re.I | re.S)
_TRAINING_ENTRY_RE = re.compile(
    r"([A-Za-z .'-]+),\s+([A-Za-z]+\s+\d{1,2}(?:-\d{1,2})?)\s+\|\s+(.+?)(?=(?:[A-Z][a-z .'-]+,\s+[A-Za-z]+\s+\d{1,2}(?:-\d{1,2})?\s+\|)|$)",
    re.S,
)
_MEETING_TITLE_RE = re.compile(r"COMMISSION MEETING:\s*(.+)$", re.I)
_START_TIME_RE = re.compile(r"start at\s+(\d{1,2}:\d{2}\s*[ap]\.?m\.?)", re.I)


def _fetch(url: str) -> Optional[str]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.RequestException as exc:
        logger.error("Georgia Ethics Commission: failed to fetch %s: %s", url, exc)
        return None


def _clean_text(value: str) -> str:
    text = unescape(value or "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_month_day(date_text: str) -> Optional[datetime.date]:
    raw = _clean_text(date_text)
    if not raw:
        return None

    if "-" in raw:
        raw = raw.split("-", 1)[0].strip()

    try:
        return datetime.strptime(raw.replace(",", ""), "%B %d %Y").date()
    except ValueError:
        try:
            return datetime.strptime(raw.replace(",", ""), "%b %d %Y").date()
        except ValueError:
            pass

    try:
        dt = datetime.strptime(f"{raw} {datetime.now().year}", "%B %d %Y")
    except ValueError:
        try:
            dt = datetime.strptime(f"{raw} {datetime.now().year}", "%b %d %Y")
        except ValueError:
            return None
    return dt.date()


def _parse_time(value: str) -> Optional[str]:
    raw = _clean_text(value).lower().replace(".", "")
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%I:%M %p").strftime("%H:%M")
    except ValueError:
        return None


def _extract_meeting_events(feed_xml: str) -> list[dict]:
    events: list[dict] = []
    try:
        root = ET.fromstring(feed_xml)
    except ET.ParseError as exc:
        logger.error("Georgia Ethics Commission: failed to parse feed XML: %s", exc)
        return events

    today = datetime.now().date()
    for item in root.findall("./channel/item"):
        title = _clean_text(item.findtext("title", ""))
        if not _MEETING_TITLE_RE.search(title):
            continue

        link = _clean_text(item.findtext("link", ""))
        description_html = item.findtext("description", "") or ""
        description = _clean_text(BeautifulSoup(description_html, "lxml").get_text(" ", strip=True))

        pub_date_raw = item.findtext("pubDate", "")
        event_date = None
        if pub_date_raw:
            try:
                # Prefer explicit title date over publish date.
                pub_dt = parsedate_to_datetime(pub_date_raw)
                if pub_dt:
                    event_date = pub_dt.date()
            except (TypeError, ValueError, IndexError):
                event_date = None

        title_match = _MEETING_TITLE_RE.search(title)
        if title_match:
            parsed_title_date = _parse_month_day(title_match.group(1).replace(",", ""))
            if parsed_title_date:
                event_date = parsed_title_date

        if not event_date or event_date < today:
            continue

        start_time = None
        start_match = _START_TIME_RE.search(description)
        if start_match:
            start_time = _parse_time(start_match.group(1))

        events.append(
            {
                "title": title,
                "start_date": event_date.strftime("%Y-%m-%d"),
                "start_time": start_time,
                "end_time": None,
                "description": description,
                "source_url": link or FEED_URL,
                "ticket_url": link or FEED_URL,
                "image_url": None,
                "category": "community",
                "subcategory": "government",
                "tags": [
                    "government",
                    "election",
                    "ethics",
                    "campaign-finance",
                    "public-meeting",
                    "statewide",
                ],
                "is_free": True,
                "is_all_day": start_time is None,
            }
        )

    return events


def _extract_training_events(home_html: str) -> list[dict]:
    soup = BeautifulSoup(home_html, "lxml")
    text = " ".join(soup.stripped_strings)
    text = _clean_text(text)

    match = _TRAINING_BLOCK_RE.search(text)
    if not match:
        logger.warning("Georgia Ethics Commission: 2026 training block not found")
        return []

    block = match.group(1)
    events: list[dict] = []
    today = datetime.now().date()

    for entry in _TRAINING_ENTRY_RE.finditer(block):
        city = _clean_text(entry.group(1))
        date_text = _clean_text(entry.group(2))
        title = _clean_text(entry.group(3)).rstrip(" -")
        event_date = _parse_month_day(date_text)
        if not city or not title or not event_date or event_date < today:
            continue

        events.append(
            {
                "title": f"{title} ({city})",
                "start_date": event_date.strftime("%Y-%m-%d"),
                "start_time": None,
                "end_time": None,
                "description": (
                    f"Official Georgia Ethics Commission training listing for {title} in {city}, Georgia."
                ),
                "source_url": BASE_URL,
                "ticket_url": BASE_URL,
                "image_url": None,
                "category": "learning",
                "subcategory": "government",
                "tags": [
                    "government",
                    "ethics",
                    "campaign-finance",
                    "training",
                    "statewide",
                ],
                "is_free": True,
                "is_all_day": True,
            }
        )

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    venue_id = get_or_create_place(PLACE_DATA)
    events_found = 0
    events_new = 0
    events_updated = 0

    feed_xml = _fetch(FEED_URL)
    home_html = _fetch(BASE_URL)
    if not feed_xml and not home_html:
        return 0, 0, 0

    parsed_events: list[dict] = []
    if feed_xml:
        parsed_events.extend(_extract_meeting_events(feed_xml))
    if home_html:
        parsed_events.extend(_extract_training_events(home_html))

    seen_hashes: set[str] = set()
    seen_keys: set[tuple[str, str]] = set()

    for parsed in sorted(parsed_events, key=lambda item: (item["start_date"], item["title"])):
        dedupe_key = (parsed["title"].lower(), parsed["start_date"])
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        content_hash = generate_content_hash(
            parsed["title"],
            PLACE_DATA["name"],
            parsed["start_date"],
        )
        seen_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": parsed["title"],
            "description": parsed["description"],
            "start_date": parsed["start_date"],
            "start_time": parsed["start_time"],
            "end_date": parsed["start_date"],
            "end_time": parsed["end_time"],
            "is_all_day": parsed["is_all_day"],
            "category": parsed["category"],
            "subcategory": parsed["subcategory"],
            "tags": parsed["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": parsed["is_free"],
            "source_url": parsed["source_url"],
            "ticket_url": parsed["ticket_url"],
            "image_url": parsed["image_url"],
            "raw_text": parsed["description"][:5000],
            "extraction_confidence": 0.88,
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
        except Exception as exc:
            logger.error(
                "Georgia Ethics Commission: failed to insert %r on %s: %s",
                parsed["title"],
                parsed["start_date"],
                exc,
            )

    stale_removed = remove_stale_source_events(source_id, seen_hashes)
    if stale_removed:
        logger.info("Georgia Ethics Commission: removed %d stale future events", stale_removed)

    logger.info(
        "Georgia Ethics Commission: crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
