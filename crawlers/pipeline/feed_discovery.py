"""
Discovery-phase extraction from structured feeds (RSS/Atom/ICS).
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any, Optional
from urllib.parse import urljoin

from dateutil import parser as dateparser

from date_utils import normalize_event_date
from pipeline.models import DiscoveryConfig

logger = logging.getLogger(__name__)

try:
    import feedparser  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    feedparser = None

try:
    from icalendar import Calendar  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    Calendar = None

_DATE_KEYS = (
    "eventstart",
    "event_start",
    "startdate",
    "start_date",
    "start",
    "dtstart",
    "date",
    "when",
    "published",
    "updated",
)


def _parse_datetime(value: Any) -> tuple[Optional[str], Optional[str]]:
    if value is None:
        return None, None

    if isinstance(value, datetime):
        normalized_date = normalize_event_date(value.date(), assume_explicit_year=True)
        if not normalized_date:
            return None, None
        return normalized_date.isoformat(), value.strftime("%H:%M")
    if isinstance(value, date):
        normalized_date = normalize_event_date(value, assume_explicit_year=True)
        if not normalized_date:
            return None, None
        return normalized_date.isoformat(), None

    if isinstance(value, str):
        try:
            dt = dateparser.parse(value, fuzzy=True)
        except Exception:
            return None, None
        if not dt:
            return None, None
        import re

        normalized_date = normalize_event_date(dt.date(), raw_text=value)
        if not normalized_date:
            return None, None
        has_time = bool(re.search(r"(\d{1,2}):(\d{2})|(\d{1,2})\s*(AM|PM)", value, re.IGNORECASE))
        time_str = dt.strftime("%H:%M") if has_time else None
        return normalized_date.isoformat(), time_str

    return None, None


def _coerce_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _extract_entry_description(entry: dict) -> Optional[str]:
    for key in ("summary", "description"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    content = entry.get("content")
    if isinstance(content, list) and content:
        value = content[0].get("value") if isinstance(content[0], dict) else None
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_entry_image(entry: dict) -> Optional[str]:
    for key in ("media_content", "media_thumbnail"):
        media = entry.get(key)
        if isinstance(media, list) and media:
            url = media[0].get("url")
            if isinstance(url, str) and url.strip():
                return url.strip()
    image = entry.get("image")
    if isinstance(image, dict):
        url = image.get("href") or image.get("url")
        if isinstance(url, str) and url.strip():
            return url.strip()
    return None


def _pick_entry_date(entry: dict) -> Any:
    for key in _DATE_KEYS:
        if key in entry:
            return entry.get(key)
    for key in ("published_parsed", "updated_parsed"):
        parsed = entry.get(key)
        if parsed:
            try:
                return datetime(*parsed[:6])
            except Exception:
                continue
    return None


def _unique_events(events: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    unique: list[dict] = []
    for event in events:
        key = (
            event.get("title"),
            event.get("start_date"),
            event.get("detail_url"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(event)
    return unique


def _discover_from_rss(content: str, base_url: str) -> list[dict]:
    if not feedparser:
        logger.error("feedparser is not installed; cannot parse RSS/Atom feed")
        return []

    feed = feedparser.parse(content)
    entries = feed.entries or []
    seeds: list[dict] = []

    for entry in entries:
        title = _coerce_str(entry.get("title"))
        if not title:
            continue

        link = _coerce_str(entry.get("link") or entry.get("id"))
        if link and not link.startswith("http"):
            link = urljoin(base_url, link)

        date_value = _pick_entry_date(entry)
        start_date, start_time = _parse_datetime(date_value)

        seed = {
            "title": title,
            "start_date": start_date,
            "start_time": start_time,
            "detail_url": link,
            "description": _extract_entry_description(entry),
            "image_url": _extract_entry_image(entry),
        }

        if seed.get("start_date"):
            seeds.append(seed)

    return _unique_events(seeds)


def _discover_from_ics(content: str, base_url: str) -> list[dict]:
    if not Calendar:
        logger.error("icalendar is not installed; cannot parse ICS feed")
        return []

    try:
        calendar = Calendar.from_ical(content)
    except Exception as e:
        logger.warning("ICS parse failed: %s", e)
        return []

    seeds: list[dict] = []
    for component in calendar.walk():
        if component.name != "VEVENT":
            continue

        title = _coerce_str(component.get("SUMMARY"))
        if not title:
            continue

        dtstart = component.get("DTSTART")
        dtend = component.get("DTEND")
        start_date, start_time = _parse_datetime(getattr(dtstart, "dt", dtstart))
        end_date, end_time = _parse_datetime(getattr(dtend, "dt", dtend))

        url = _coerce_str(component.get("URL"))
        if url and not url.startswith("http"):
            url = urljoin(base_url, url)

        seed = {
            "title": title,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "detail_url": url,
            "description": _coerce_str(component.get("DESCRIPTION")),
        }

        if seed.get("start_date"):
            seeds.append(seed)

    return _unique_events(seeds)


def discover_from_feed(content: str, base_url: str, config: DiscoveryConfig) -> list[dict]:
    if not content:
        return []

    fmt = config.feed.format if config.feed else "auto"
    if fmt == "auto":
        stripped = content.lstrip()
        if stripped.startswith("BEGIN:VCALENDAR") or base_url.lower().endswith(".ics"):
            fmt = "ics"
        else:
            fmt = "rss"

    if fmt == "ics":
        return _discover_from_ics(content, base_url)

    return _discover_from_rss(content, base_url)
