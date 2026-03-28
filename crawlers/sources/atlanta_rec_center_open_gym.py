"""
Crawler for City of Atlanta recreation center open gym sessions.

Uses the Atlanta DPR ACTIVENet catalog as the official source of truth, but
only surfaces public open-gym programs that read as lightweight rec-center
play, not leagues or structured classes.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
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
WEEKS_AHEAD = 6
ITEMS_PER_PAGE = 20
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

OPEN_GYM_VENUE_OVERRIDES = {
    "coan park": {
        "name": "Coan Park Recreation Center",
        "slug": "coan-park-recreation-center",
        "address": "1530 Woodbine Ave SE",
        "neighborhood": "Edgewood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "lat": 33.7491,
        "lng": -84.3412,
        "place_type": "community_center",
        "spot_type": "community_center",
        "website": "https://apm.activecommunities.com/atlantadprca/Home",
        "description": "City of Atlanta recreation center with published open gym programming.",
    },
    "dunbar": {
        "name": "Dunbar Recreation Center",
        "slug": "dunbar-park-recreation-center",
        "address": "477 Windsor St SW",
        "neighborhood": "Mechanicsville",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7402,
        "lng": -84.3922,
        "place_type": "community_center",
        "spot_type": "community_center",
        "website": "https://apm.activecommunities.com/atlantadprca/Home",
        "description": "City of Atlanta recreation center with published open gym programming.",
    },
    "grove park": {
        "name": "Grove Park Recreation Center",
        "slug": "grove-park-recreation-center",
        "address": "750 Frances Pl NW",
        "neighborhood": "Grove Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7748,
        "lng": -84.4362,
        "place_type": "community_center",
        "spot_type": "community_center",
        "website": "https://apm.activecommunities.com/atlantadprca/Home",
        "description": "City of Atlanta recreation center with published open gym programming.",
    },
}

TIME_RANGE_RE = re.compile(
    r"(?P<start>\d{1,2}:\d{2}\s*[ap]\.?m\.?)\s*-\s*(?P<end>\d{1,2}:\d{2}\s*[ap]\.?m\.?)",
    re.IGNORECASE,
)
DAY_TOKEN_RE = re.compile(
    r"\b(mon(?:days?|day)?|tue(?:sdays?|sday|s)?|wed(?:nesdays?|nesday)?|thu(?:rsdays?|rsday|r|rs)?|fri(?:days?|day)?|sat(?:urdays?|urday)?|sun(?:days?|day)?)\b",
    re.IGNORECASE,
)

DAY_INDEX = {
    "mon": 0,
    "monday": 0,
    "tue": 1,
    "tues": 1,
    "tuesday": 1,
    "wed": 2,
    "wednesday": 2,
    "thu": 3,
    "thur": 3,
    "thurs": 3,
    "thursday": 3,
    "fri": 4,
    "friday": 4,
    "sat": 5,
    "saturday": 5,
    "sun": 6,
    "sunday": 6,
}


def _to_24_hour(raw_value: str) -> str:
    normalized = raw_value.lower().replace(".", "").replace(" ", "")
    parsed = datetime.strptime(normalized, "%I:%M%p")
    return parsed.strftime("%H:%M")


def _normalize_day_token(raw_value: str) -> str:
    token = raw_value.lower()
    if token.endswith("days"):
        return token[:-1]
    return token


def _expand_day_range(start_day: int, end_day: int) -> list[int]:
    if start_day <= end_day:
        return list(range(start_day, end_day + 1))
    return list(range(start_day, 7)) + list(range(0, end_day + 1))


def parse_schedule_line(line: str) -> Optional[tuple[list[int], str, str]]:
    """Parse a description line into weekdays + start/end times."""
    match = TIME_RANGE_RE.search(line)
    if not match:
        return None

    start_time = _to_24_hour(match.group("start"))
    end_time = _to_24_hour(match.group("end"))
    day_segment = line[: match.start()].strip(" -\u2013\u2014")
    day_matches = list(DAY_TOKEN_RE.finditer(day_segment))
    if not day_matches:
        return None

    weekdays: list[int] = []
    index = 0
    while index < len(day_matches):
        current = day_matches[index]
        token = _normalize_day_token(current.group(1))
        start_day = DAY_INDEX[token]

        if index + 1 < len(day_matches):
            separator = day_segment[current.end() : day_matches[index + 1].start()]
            if "-" in separator or "\u2013" in separator or "\u2014" in separator or "to" in separator.lower():
                end_day = DAY_INDEX[_normalize_day_token(day_matches[index + 1].group(1))]
                weekdays.extend(_expand_day_range(start_day, end_day))
                index += 2
                continue

        weekdays.append(start_day)
        index += 1

    ordered_unique = list(dict.fromkeys(weekdays))
    return ordered_unique, start_time, end_time


def extract_schedule_from_description(description_html: str) -> Optional[tuple[list[int], str, str]]:
    text = BeautifulSoup(description_html or "", "html.parser").get_text("\n")
    for raw_line in text.splitlines():
        line = " ".join(raw_line.split())
        if not line:
            continue
        parsed = parse_schedule_line(line)
        if parsed:
            return parsed
    return None


def get_next_weekday(start_date: date, weekday: int) -> date:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def build_series_title(title: str, weekday: int) -> str:
    return f"{title} ({DAY_NAMES[weekday]})"


def iter_occurrence_dates(
    start_date: date,
    end_date: date,
    weekdays: list[int],
    today: date,
) -> list[tuple[date, int]]:
    horizon_end = min(end_date, today + timedelta(weeks=WEEKS_AHEAD))
    first_possible = max(start_date, today)
    occurrences: list[tuple[date, int]] = []

    for weekday in weekdays:
        current = get_next_weekday(first_possible, weekday)
        while current <= horizon_end:
            occurrences.append((current, weekday))
            current += timedelta(days=7)

    occurrences.sort(key=lambda item: (item[0], item[1]))
    return occurrences


def _build_price_note(price_min: Optional[float], price_max: Optional[float], is_free: bool) -> str:
    if is_free:
        return "Atlanta DPR currently lists this open gym session as free."
    if price_min is not None and price_max is not None:
        if price_min == price_max:
            if float(price_min).is_integer():
                return f"Atlanta DPR currently lists this open gym session at ${int(price_min)}."
            return f"Atlanta DPR currently lists this open gym session at ${price_min:.2f}."
        return f"Atlanta DPR currently lists this open gym session from ${price_min:.2f} to ${price_max:.2f}."
    return "Check Atlanta DPR for current open gym access details."


def parse_open_gym_item(item: dict, today: date) -> Optional[dict]:
    title = (item.get("name") or "").strip()
    if "open gym" not in title.lower():
        return None

    start_date_raw = _parse_date(item.get("date_range_start"))
    end_date_raw = _parse_date(item.get("date_range_end"))
    if not start_date_raw or not end_date_raw:
        return None

    start_date = datetime.strptime(start_date_raw, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_date_raw, "%Y-%m-%d").date()
    if end_date < today:
        return None

    description_html = item.get("desc") or ""
    schedule = extract_schedule_from_description(description_html)
    if not schedule:
        return None

    weekdays, start_time, end_time = schedule
    location_label = ((item.get("location") or {}).get("label") or "").strip()
    location_lower = location_label.lower()
    place_data = next(
        (venue for key, venue in OPEN_GYM_VENUE_OVERRIDES.items() if key in location_lower),
        _resolve_venue_data(location_label),
    )
    description_text = " ".join(BeautifulSoup(description_html, "html.parser").get_text(" ").split())
    price_min, price_max, is_free = _extract_prices(description_html)

    tags = ["open-gym", "public-play", "recreation-center", "weekly", "atlanta-dpr"]
    desc_lower = description_text.lower()
    title_lower = title.lower()
    if "basketball" in desc_lower or "basketball" in title_lower:
        tags.extend(["basketball", "pickup"])
        subcategory = "basketball"
    else:
        tags.append("pickup")
        subcategory = "open_gym"

    age_min = item.get("age_min_year")
    if isinstance(age_min, int):
        if age_min >= 18:
            tags.append("adults")
        elif age_min >= 13:
            tags.extend(["teens", "adults"])

    if is_free:
        tags.append("free")

    return {
        "title": title,
        "description": description_text,
        "start_date": start_date,
        "end_date": end_date,
        "weekdays": weekdays,
        "start_time": start_time,
        "end_time": end_time,
        "venue_data": place_data,
        "source_url": item.get("detail_url") or SOURCE_URL,
        "ticket_url": (
            (item.get("enroll_now") or {}).get("href")
            or (item.get("action_link") or {}).get("href")
            or item.get("detail_url")
        ),
        "price_min": price_min,
        "price_max": price_max,
        "price_note": _build_price_note(price_min, price_max, is_free),
        "is_free": is_free,
        "raw_text": description_text,
        "tags": list(dict.fromkeys(tags)),
        "subcategory": subcategory,
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
        logger.error("Atlanta rec center open gym crawl aborted: DPR session init failed")
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
            template = parse_open_gym_item(item, today)
            if not template:
                continue

            venue_id = get_or_create_place(template["venue_data"])
            series_description = template["description"]

            for event_date, weekday in iter_occurrence_dates(
                template["start_date"],
                template["end_date"],
                template["weekdays"],
                today,
            ):
                start_date_value = event_date.strftime("%Y-%m-%d")
                content_hash = generate_content_hash(
                    template["title"],
                    template["venue_data"]["name"],
                    start_date_value,
                )
                current_hashes.add(content_hash)
                events_found += 1

                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": build_series_title(template["title"], weekday),
                    "frequency": "weekly",
                    "day_of_week": DAY_NAMES[weekday].lower(),
                    "description": series_description,
                }

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": template["title"],
                    "description": series_description,
                    "start_date": start_date_value,
                    "start_time": template["start_time"],
                    "end_date": None,
                    "end_time": template["end_time"],
                    "is_all_day": False,
                    "category": "sports",
                    "subcategory": template["subcategory"],
                    "tags": template["tags"],
                    "is_free": template["is_free"],
                    "price_min": template["price_min"],
                    "price_max": template["price_max"],
                    "price_note": template["price_note"],
                    "source_url": template["source_url"],
                    "ticket_url": template["ticket_url"],
                    "image_url": None,
                    "raw_text": f"{template['raw_text']} | {DAY_NAMES[weekday]} | {start_date_value}",
                    "extraction_confidence": 0.9,
                    "is_recurring": True,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={DAY_CODES[weekday]}",
                    "content_hash": content_hash,
                }

                existing = find_existing_event_for_insert(event_record)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record, series_hint=series_hint)
                events_new += 1

        page_number += 1

    if fetched_any_page:
        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info("Removed %s stale Atlanta rec center open gym rows", stale_removed)

    logger.info(
        "Atlanta rec center open gym crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
