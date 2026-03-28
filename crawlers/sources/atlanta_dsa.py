"""
Crawler for Atlanta Democratic Socialists of America public events.

Source: https://atldsa.org/events/
Platform: WordPress page embedding multiple public Google Calendars.

ATL DSA runs chapter-wide and branch-level civic action events such as:
- organizing meetings
- canvasses and outreach
- trainings and political education
- issue campaign actions

This is a good HelpATL fit for the issue-based civic participation layer.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import parse_qs, quote, urlparse

import requests
from bs4 import BeautifulSoup
from icalendar import Calendar

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atldsa.org"
EVENTS_URL = f"{BASE_URL}/events/"
JOIN_URL = f"{BASE_URL}/join"

PLACE_DATA = {
    "name": "Atlanta Democratic Socialists of America",
    "slug": "atlanta-dsa",
    "address": "Atlanta, GA",
    "neighborhood": "Citywide",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "description": "Atlanta chapter of Democratic Socialists of America organizing issue campaigns, chapter meetings, and civic action across metro Atlanta.",
}

BASE_TAGS = ["civic", "advocacy", "community-organizing", "attend"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}

TAG_RULES: list[tuple[str, list[str]]] = [
    (r"canvass|door knock|phonebank|textbank", ["outreach", "volunteer"]),
    (r"chapter meeting|branch meeting|general meeting", ["public-meeting", "chapter-meeting"]),
    (r"training|orientation|political education|reading group", ["training", "education"]),
    (r"mutual aid|solidarity", ["mutual-aid"]),
    (r"labor|union|worker", ["labor"]),
    (r"housing|tenant", ["housing"]),
    (r"transit|marta", ["transit"]),
]


def _fetch(url: str) -> Optional[str]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.RequestException as exc:
        logger.error("Atlanta DSA: failed to fetch %s: %s", url, exc)
        return None


def _extract_calendar_ids(html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    ids: list[str] = []

    for frame in soup.find_all(["iframe", "a"], href=True):
        href = frame.get("href")
        if not href or "calendar.google.com/calendar/" not in href:
            continue
        parsed = urlparse(href)
        ids.extend(parse_qs(parsed.query).get("src", []))

    for frame in soup.find_all("iframe", src=True):
        src = frame.get("src")
        if not src or "calendar.google.com/calendar/" not in src:
            continue
        parsed = urlparse(src)
        ids.extend(parse_qs(parsed.query).get("src", []))

    unique: list[str] = []
    for calendar_id in ids:
        normalized = calendar_id.strip()
        if normalized and normalized not in unique:
            unique.append(normalized)
    return unique


def _ical_url_for_calendar_id(calendar_id: str) -> str:
    encoded = quote(calendar_id, safe="")
    return f"https://calendar.google.com/calendar/ical/{encoded}/public/basic.ics"


def _parse_ical_datetime(dt) -> tuple[Optional[str], Optional[str], bool]:
    if dt is None:
        return None, None, False
    if hasattr(dt, "hour"):
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M"), False
    return dt.strftime("%Y-%m-%d"), None, True


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _clean_title(value: str | None) -> str:
    cleaned = _clean_text(value)
    cleaned = re.sub(r"^[^A-Za-z0-9(]+", "", cleaned)
    cleaned = re.sub(r"[^A-Za-z0-9)!?]+$", "", cleaned)
    return _clean_text(cleaned)


def _enrich_tags(text: str) -> list[str]:
    lowered = text.lower()
    tags: list[str] = []
    for pattern, extra in TAG_RULES:
        if re.search(pattern, lowered):
            tags.extend(extra)
    return list(dict.fromkeys(tags))


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    page_html = _fetch(EVENTS_URL)
    if not page_html:
        return 0, 0, 0

    calendar_ids = _extract_calendar_ids(page_html)
    if not calendar_ids:
        logger.warning("Atlanta DSA: no public calendar IDs found on %s", EVENTS_URL)
        return 0, 0, 0

    today = datetime.now().date()
    seen_uids: set[str] = set()
    seen_keys: set[str] = set()
    current_hashes: set[str] = set()

    for calendar_id in calendar_ids:
        ical_url = _ical_url_for_calendar_id(calendar_id)
        feed_text = _fetch(ical_url)
        if not feed_text:
            continue

        try:
            calendar = Calendar.from_ical(feed_text)
        except Exception as exc:
            logger.error("Atlanta DSA: failed to parse iCal feed %s: %s", ical_url, exc)
            continue

        for component in calendar.walk():
            if component.name != "VEVENT":
                continue

            try:
                summary = _clean_title(str(component.get("summary", "")))
                if len(summary) < 3:
                    continue

                uid = _clean_text(str(component.get("uid", "")))
                if uid and uid in seen_uids:
                    continue

                dtstart = component.get("dtstart").dt if component.get("dtstart") else None
                dtend = component.get("dtend").dt if component.get("dtend") else None
                start_date, start_time, is_all_day = _parse_ical_datetime(dtstart)
                if not start_date:
                    continue

                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                except ValueError:
                    continue

                if event_date < today:
                    continue

                dedupe_key = f"{summary}|{start_date}|{start_time or ''}"
                if dedupe_key in seen_keys:
                    continue
                seen_keys.add(dedupe_key)
                if uid:
                    seen_uids.add(uid)

                end_date = None
                end_time = None
                if dtend:
                    end_date, end_time, _ = _parse_ical_datetime(dtend)

                description = _clean_text(str(component.get("description", "")))
                location = _clean_text(str(component.get("location", "")))
                event_url = _clean_text(str(component.get("url", ""))) or EVENTS_URL

                if description:
                    description = re.sub(r"https?://\S+", "", description)
                    description = _clean_text(description)
                if not description:
                    description = f"{summary} — Atlanta DSA civic action event."
                if location:
                    description = f"{description} Location: {location}".strip()

                tags = list(
                    dict.fromkeys(
                        BASE_TAGS + _enrich_tags(f"{summary} {description} {location}")
                    )
                )

                content_hash = generate_content_hash(summary, PLACE_DATA["name"], start_date)
                current_hashes.add(content_hash)
                events_found += 1

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": summary[:200],
                    "description": description[:1200],
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": is_all_day,
                    "category": "community",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": None,
                    "raw_text": f"{summary} {description} {location}"[:500],
                    "extraction_confidence": 0.92,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
            except Exception as exc:
                logger.debug("Atlanta DSA: failed to parse calendar event: %s", exc)
                continue

    if current_hashes:
        try:
            removed = remove_stale_source_events(source_id, current_hashes)
            if removed:
                logger.info("Atlanta DSA: removed %s stale future events", removed)
        except Exception as exc:
            logger.warning("Atlanta DSA: stale cleanup failed: %s", exc)

    logger.info(
        "Atlanta DSA crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
