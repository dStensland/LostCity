"""
Crawler for City of Atlanta adult swim lessons.

Uses the official Atlanta DPR ACTIVENet catalog but only surfaces adult swim
lesson programs with explicit public session schedules at city natatoriums.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from sources.atlanta_dpr import (
    _extract_prices,
    _fetch_page,
    _init_session,
    _parse_date,
    _resolve_venue_data,
)

logger = logging.getLogger(__name__)

SOURCE_URL = "https://anc.apm.activecommunities.com/atlantadprca/Activity_Search"
WEEKS_AHEAD = 12
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

TARGET_VENUE_KEYS = {
    "ct martin": "CT Martin Recreation & Aquatic Center",
    "m.l. king": "MLK Jr. Recreation & Aquatic Center",
    "washington park": "Washington Park Aquatic Center",
}

DAY_INDEX = {
    "mon": 0,
    "monday": 0,
    "wed": 2,
    "wednesday": 2,
    "sat": 5,
    "saturday": 5,
}

DAY_TOKEN_RE = re.compile(r"\b(mon|monday|wed|wednesday|sat|saturday)\b", re.IGNORECASE)
TIME_SEGMENT_RE = re.compile(
    r"Activity\s+Times:\s*(?P<days>.+?)\s*(?:from\s*)?"
    r"(?P<start>\d{1,2}\s*:\s*\d{2}\s*(?:a\.?m\.?|p\.?m\.?))\s*(?:to|-)\s*"
    r"(?P<end>\d{1,2}\s*:\s*\d{2}\s*(?:a\.?m\.?|p\.?m\.?))",
    re.IGNORECASE,
)


def _clean_time_token(raw_value: str) -> str:
    normalized = raw_value.lower().replace(" ", "").replace(".", "")
    parsed = datetime.strptime(normalized, "%I:%M%p")
    return parsed.strftime("%H:%M")


def _parse_day_tokens(raw_value: str) -> list[int]:
    weekdays: list[int] = []
    for match in DAY_TOKEN_RE.finditer(raw_value or ""):
        weekday = DAY_INDEX[match.group(1).lower()]
        if weekday not in weekdays:
            weekdays.append(weekday)
    return weekdays


def _get_next_weekday(start_date: date, weekday: int) -> date:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _iter_occurrence_dates(
    start_date: date,
    end_date: date,
    weekdays: list[int],
    today: date,
) -> list[tuple[date, int]]:
    horizon_end = min(end_date, today + timedelta(weeks=WEEKS_AHEAD))
    first_possible = max(start_date, today)
    occurrences: list[tuple[date, int]] = []

    for weekday in weekdays:
        current = _get_next_weekday(first_possible, weekday)
        while current <= horizon_end:
            occurrences.append((current, weekday))
            current += timedelta(days=7)

    occurrences.sort(key=lambda item: (item[0], item[1]))
    return occurrences


def _build_series_title(title: str, weekday: int) -> str:
    return f"{title} ({DAY_NAMES[weekday]})"


def _format_time_label(start_time: str) -> str:
    parsed = datetime.strptime(start_time, "%H:%M")
    return parsed.strftime("%-I:%M %p")


def _parse_schedule(description_html: str) -> Optional[tuple[list[int], str, str]]:
    text = " ".join(BeautifulSoup(description_html or "", "html.parser").get_text(" ").split())
    match = TIME_SEGMENT_RE.search(text)
    if not match:
        return None

    weekdays = _parse_day_tokens(match.group("days"))
    if not weekdays:
        return None

    return (
        weekdays,
        _clean_time_token(match.group("start")),
        _clean_time_token(match.group("end")),
    )


def parse_item(item: dict, today: date) -> Optional[dict]:
    title = (item.get("name") or "").strip()
    if "adult swim lessons" not in title.lower():
        return None

    description_html = item.get("desc") or ""
    schedule = _parse_schedule(description_html)
    if not schedule:
        return None

    start_date_raw = _parse_date(item.get("date_range_start"))
    end_date_raw = _parse_date(item.get("date_range_end"))
    if not start_date_raw or not end_date_raw:
        return None

    start_date = datetime.strptime(start_date_raw, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_date_raw, "%Y-%m-%d").date()
    if end_date < today:
        return None

    age_min = item.get("age_min_year")
    if isinstance(age_min, int) and age_min < 13:
        return None

    location_label = ((item.get("location") or {}).get("label") or "").strip()
    location_lower = location_label.lower()
    if not any(key in location_lower for key in TARGET_VENUE_KEYS):
        return None

    venue_data = _resolve_venue_data(location_label)
    weekdays, start_time, end_time = schedule
    occurrences = _iter_occurrence_dates(start_date, end_date, weekdays, today)
    if not occurrences:
        return None

    price_min, price_max, is_free = _extract_prices(description_html)
    time_label = _format_time_label(start_time)
    normalized_title = f"Adult Swim Lessons ({time_label}) at {venue_data['name']}"
    description = (
        f"Public adult swim lessons at {venue_data['name']} through Atlanta DPR. "
        "Reserve through the official city registration catalog for current availability."
    )

    return {
        "title": normalized_title,
        "description": description,
        "venue_data": venue_data,
        "start_date": start_date,
        "end_date": end_date,
        "weekdays": weekdays,
        "start_time": start_time,
        "end_time": end_time,
        "source_url": item.get("detail_url") or SOURCE_URL,
        "ticket_url": (
            (item.get("enroll_now") or {}).get("href")
            or (item.get("action_link") or {}).get("href")
            or item.get("detail_url")
            or SOURCE_URL
        ),
        "price_min": price_min,
        "price_max": price_max,
        "is_free": is_free,
        "price_note": (
            f"Atlanta DPR currently lists this class from ${price_min:.2f} to ${price_max:.2f}."
            if price_min is not None and price_max is not None and price_min != price_max
            else f"Atlanta DPR currently lists this class at ${price_min:.2f}."
            if price_min is not None
            else "Check Atlanta DPR for current class pricing."
        ),
        "raw_text": " ".join(BeautifulSoup(description_html, "html.parser").get_text(" ").split()),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    today = datetime.now().date()

    session, csrf = _init_session()
    if not session or not csrf:
        logger.error("Atlanta adult swim lessons crawl aborted: DPR session init failed")
        return 0, 0, 0

    page_number = 1
    total_pages = 1
    fetched_any_page = False

    while page_number <= total_pages:
        result = _fetch_page(session, csrf, page_number)
        if not result:
            break

        fetched_any_page = True
        items, _total_records, total_pages = result
        for item in items:
            parsed = parse_item(item, today)
            if not parsed:
                continue

            venue_id = get_or_create_venue(parsed["venue_data"])

            for event_date, weekday in _iter_occurrence_dates(
                parsed["start_date"],
                parsed["end_date"],
                parsed["weekdays"],
                today,
            ):
                start_date_value = event_date.strftime("%Y-%m-%d")
                content_hash = generate_content_hash(
                    parsed["title"],
                    parsed["venue_data"]["name"],
                    start_date_value,
                )
                current_hashes.add(content_hash)
                events_found += 1

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": parsed["title"],
                    "description": parsed["description"],
                    "start_date": start_date_value,
                    "start_time": parsed["start_time"],
                    "end_date": None,
                    "end_time": parsed["end_time"],
                    "is_all_day": False,
                    "category": "fitness",
                    "subcategory": "fitness.aquatics",
                    "tags": [
                        "swim",
                        "adult-swim",
                        "aquatics",
                        "fitness-class",
                        "public-fitness",
                        "atlanta-dpr",
                    ],
                    "price_min": parsed["price_min"],
                    "price_max": parsed["price_max"],
                    "price_note": parsed["price_note"],
                    "is_free": parsed["is_free"],
                    "source_url": parsed["source_url"],
                    "ticket_url": parsed["ticket_url"],
                    "image_url": None,
                    "raw_text": f"{parsed['raw_text']} | {DAY_NAMES[weekday]} | {start_date_value}",
                    "extraction_confidence": 0.94,
                    "is_recurring": True,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={DAY_CODES[weekday]}",
                    "content_hash": content_hash,
                    "is_class": True,
                    "class_category": "fitness",
                }

                existing = find_existing_event_for_insert(event_record)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                series_hint = {
                    "series_type": "class_series",
                    "series_title": _build_series_title(parsed["title"], weekday),
                    "frequency": "weekly",
                    "day_of_week": DAY_NAMES[weekday].lower(),
                    "description": parsed["description"],
                }

                insert_event(event_record, series_hint=series_hint)
                events_new += 1

        page_number += 1

    if fetched_any_page:
        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info("Removed %s stale Atlanta adult swim lesson rows", stale_removed)

    logger.info(
        "Atlanta adult swim lessons crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
