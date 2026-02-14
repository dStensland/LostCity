"""
Crawler for Fulton County Board of Health community events.

The primary site is currently bot-protected for many direct requests.
This crawler uses r.jina.ai snapshots of public pages to capture event links
and event detail metadata (date/time/title/location) from event pages.
"""

from __future__ import annotations

import html
import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse

import requests

from db import find_event_by_hash, get_or_create_venue, insert_event
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://fultoncountyboh.com"
SNAPSHOT_PREFIX = "https://r.jina.ai/http://"

HOME_URL = f"{BASE_URL}/"
MONTH_URL = f"{BASE_URL}/fcbohevents/month/"

DEFAULT_VENUE = {
    "name": "Fulton County Board of Health",
    "slug": "fulton-county-board-of-health",
    "address": "10 Park Place South SE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7514,
    "lng": -84.3866,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["all-ages", "family-friendly"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0; +https://lostcity.example)"
}

EVENT_LINK_PATTERN = re.compile(
    r"https://fultoncountyboh\.com/fcbohevent/[a-z0-9-]+/?",
    re.IGNORECASE,
)

DATE_TIME_PATTERN = re.compile(
    r"([A-Z][a-z]+ \d{1,2}, \d{4})\s+(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)",
    re.IGNORECASE,
)

GOOGLE_CAL_PATTERN = re.compile(
    r"\[Google Calendar\]\((https://www\.google\.com/calendar/event\?[^)]+)\)",
    re.IGNORECASE,
)


def _snapshot(url: str) -> Optional[str]:
    target = f"{SNAPSHOT_PREFIX}{url.replace('https://', '').replace('http://', '')}"
    try:
        response = requests.get(target, headers=HEADERS, timeout=35)
        response.raise_for_status()
        return response.text
    except Exception as exc:
        logger.error(f"Failed fetching Fulton snapshot for {url}: {exc}")
        return None


def _parse_ampm(value: str) -> Optional[str]:
    text = re.sub(r"\s+", " ", (value or "").strip().lower())
    if not text:
        return None
    for fmt in ("%I:%M %p", "%I %p"):
        try:
            return datetime.strptime(text.upper(), fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def _category_and_tags(title: str, description: str) -> tuple[str, list[str]]:
    text = f"{title} {description}".lower()
    tags = ["public-health", "fulton-county", "government", "community"]

    if any(keyword in text for keyword in ("workshop", "class", "training", "office hours")):
        tags.append("class")
        return "learning", tags
    if any(keyword in text for keyword in ("career fair", "job fair", "volunteer")):
        tags.append("career")
        return "community", tags
    if any(keyword in text for keyword in ("screening", "vaccine", "immunization", "wellness")):
        tags.append("wellness")
        return "wellness", tags

    return "community", tags


def _extract_event_links(markdown_text: str) -> list[str]:
    links = EVENT_LINK_PATTERN.findall(markdown_text or "")
    normalized: list[str] = []
    seen: set[str] = set()

    for link in links:
        cleaned = link.rstrip(").,")
        if cleaned in seen:
            continue
        seen.add(cleaned)
        normalized.append(cleaned)
    return normalized


def _extract_google_calendar_fields(detail_text: str) -> dict[str, Optional[str]]:
    match = GOOGLE_CAL_PATTERN.search(detail_text or "")
    if not match:
        return {
            "start_date": None,
            "start_time": None,
            "end_date": None,
            "end_time": None,
            "title": None,
            "description": None,
            "location": None,
        }

    url = match.group(1)
    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    start_date = None
    start_time = None
    end_date = None
    end_time = None

    dates = query.get("dates", [""])[0]
    if "/" in dates:
        start_raw, end_raw = dates.split("/", 1)
        try:
            start_dt = datetime.strptime(start_raw, "%Y%m%dT%H%M%S")
            end_dt = datetime.strptime(end_raw, "%Y%m%dT%H%M%S")
            start_date = start_dt.strftime("%Y-%m-%d")
            start_time = start_dt.strftime("%H:%M")
            end_date = end_dt.strftime("%Y-%m-%d")
            end_time = end_dt.strftime("%H:%M")
        except ValueError:
            pass

    title = _clean_text(unquote(query.get("text", [""])[0])) or None
    description = _clean_text(unquote(query.get("details", [""])[0])) or None
    location = _clean_text(unquote(query.get("location", [""])[0])) or None

    return {
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "title": title,
        "description": description,
        "location": location,
    }


def _extract_title(detail_text: str) -> Optional[str]:
    title_match = re.search(r"^Title:\s*(.+?)\s*-\s*Fulton County Board of Health", detail_text, re.MULTILINE)
    if title_match:
        return _clean_text(title_match.group(1))

    h4_match = re.search(r"#### \[(.+?)\]\(", detail_text)
    if h4_match:
        return _clean_text(h4_match.group(1))

    return None


def _extract_fallback_schedule(detail_text: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    match = DATE_TIME_PATTERN.search(detail_text or "")
    if not match:
        return None, None, None, None

    date_text, start_raw, end_raw = match.groups()
    try:
        parsed_date = datetime.strptime(date_text, "%B %d, %Y").strftime("%Y-%m-%d")
    except ValueError:
        return None, None, None, None

    return parsed_date, _parse_ampm(start_raw), parsed_date, _parse_ampm(end_raw)


def _extract_description(detail_text: str) -> str:
    for pattern in (r"WHO:(.+)", r"WHAT:(.+)", r"Join us(.+)"):
        match = re.search(pattern, detail_text, re.IGNORECASE)
        if not match:
            continue
        cleaned = _clean_text(match.group(0))
        if cleaned:
            return cleaned[:500]

    return "Community event from Fulton County Board of Health."


def _build_venue(location: Optional[str]) -> dict:
    if not location:
        return DEFAULT_VENUE

    name = location.split(",")[0].strip() or DEFAULT_VENUE["name"]
    return {
        "name": name,
        "slug": f"fulton-boh-{slugify(name)}"[:120],
        "address": location,
        "city": "Atlanta",
        "state": "GA",
        "venue_type": "organization",
        "spot_type": "organization",
        "website": BASE_URL,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fulton County Board of Health event pages via markdown snapshots."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    home_md = _snapshot(HOME_URL) or ""
    month_md = _snapshot(MONTH_URL) or ""
    link_pool = _extract_event_links("\n".join([home_md, month_md]))
    if not link_pool:
        logger.info("No Fulton BOH event links discovered from snapshots.")
        return events_found, events_new, events_updated

    seen_hashes: set[str] = set()
    today = datetime.now().date()

    for event_url in link_pool:
        detail_md = _snapshot(event_url)
        if not detail_md:
            continue

        cal = _extract_google_calendar_fields(detail_md)
        title = cal["title"] or _extract_title(detail_md) or "Fulton County Board of Health Event"
        start_date = cal["start_date"]
        start_time = cal["start_time"]
        end_date = cal["end_date"] or start_date
        end_time = cal["end_time"]

        if not start_date:
            start_date, start_time, end_date, end_time = _extract_fallback_schedule(detail_md)

        if not start_date:
            logger.debug(f"Skipping Fulton event without parseable date: {event_url}")
            continue

        try:
            if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
                continue
        except ValueError:
            continue

        venue_payload = _build_venue(cal["location"])
        venue_id = get_or_create_venue(venue_payload)

        content_hash = generate_content_hash(title, venue_payload["name"], start_date)
        if content_hash in seen_hashes:
            continue
        seen_hashes.add(content_hash)

        events_found += 1
        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        description = cal["description"] or _extract_description(detail_md)
        category, tags = _category_and_tags(title, description)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description[:500],
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "is_all_day": False,
            "category": category,
            "tags": tags,
            "price_min": 0,
            "price_max": 0,
            "price_note": "Free",
            "is_free": True,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": None,
            "raw_text": detail_md[:1800],
            "extraction_confidence": 0.86,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        insert_event(event_record)
        events_new += 1

    logger.info(
        "Fulton BOH crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
