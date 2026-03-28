"""
Crawler for City of Atlanta aquatic fitness classes.

Targets public water aerobics and senior water-fitness sessions in the
official Atlanta DPR ACTIVENet catalog and expands them into dated class rows.
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
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
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

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

VENUE_OVERRIDES = {
    "ct martin recreation & aquatic center": "CT Martin Recreation & Aquatic Center",
    "c.t. martin recreation & aquatic center": "CT Martin Recreation & Aquatic Center",
    "rosel fann recreation center": "Rosel Fann Recreation & Aquatic Center",
    "rosel fann natatorium": "Rosel Fann Recreation & Aquatic Center",
}

DAY_INDEX = {
    "mon": 0,
    "monday": 0,
    "tue": 1,
    "tuesday": 1,
    "thu": 3,
    "thursday": 3,
    "wed": 2,
    "wednesday": 2,
    "fri": 4,
    "friday": 4,
}

DAY_TOKEN_RE = re.compile(
    r"\b(mon|monday|tue|tuesday|thu|thursday|wed|wednesday|fri|friday)\b",
    re.IGNORECASE,
)
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
    tokens = [match.group(1).lower() for match in DAY_TOKEN_RE.finditer(raw_value or "")]
    for index, token in enumerate(tokens):
        weekday = DAY_INDEX[token]
        if index + 1 < len(tokens):
            current_pos = raw_value.lower().find(token, 0 if index == 0 else raw_value.lower().find(tokens[index - 1]) + 1)
            next_pos = raw_value.lower().find(tokens[index + 1], current_pos + 1)
            separator = raw_value[current_pos + len(token) : next_pos]
            if "-" in separator:
                next_day = DAY_INDEX[tokens[index + 1]]
                for day in range(weekday, next_day + 1):
                    if day not in weekdays:
                        weekdays.append(day)
                continue
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


def _normalize_title(raw_title: str, venue_name: str) -> str:
    title = " ".join(raw_title.split()).replace(" @ ", " at ")
    lower = title.lower()

    if "water aerobics" in lower and "with ms. hayes" in lower:
        return f"Water Aerobics with Ms. Hayes at {venue_name}"

    if "water aerobics" in lower and "rosel fann" in lower and "with ms. hayes" not in lower:
        return f"Water Aerobics at {venue_name}"

    if "water awareness" in lower:
        return f"Senior Water Awareness at {venue_name}"

    if "water aerobics" in lower and "prime" in lower:
        return f"PrimeTime Seniors Water Aerobics at {venue_name}"

    if venue_name.lower() in lower:
        return title

    return f"{title} at {venue_name}"


def _build_destination_envelope(place_data: dict, venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "aquatic_center",
            "commitment_tier": "halfday",
            "primary_activity": "family aquatic center visit",
            "best_seasons": ["spring", "summer"],
            "weather_fit_tags": ["indoor-option", "heat-day", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Public swim access and classes vary by site; confirm current pool hours and registration windows through Atlanta DPR.",
            "source_url": SOURCE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": place_data.get("place_type") or place_data.get("place_type"),
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "public-pool-and-aquatics-programs",
            "title": "Public pool and aquatics programs",
            "feature_type": "amenity",
            "description": f"{place_data['name']} is one of Atlanta DPR's aquatic facilities with public swim and family aquatics programming.",
            "url": SOURCE_URL,
            "price_note": "Public access and registration vary by program and season.",
            "is_free": False,
            "sort_order": 10,
        },
    )
    return envelope


def parse_item(item: dict, today: date) -> Optional[dict]:
    raw_title = (item.get("name") or "").strip()
    title_lower = raw_title.lower()
    if "water aerobics" not in title_lower and "water awareness" not in title_lower:
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

    location_label = ((item.get("location") or {}).get("label") or "").strip()
    override_label = VENUE_OVERRIDES.get(location_label.lower(), location_label)
    place_data = _resolve_venue_data(override_label)
    if place_data.get("city") != "Atlanta":
        return None

    weekdays, start_time, end_time = schedule
    occurrences = _iter_occurrence_dates(start_date, end_date, weekdays, today)
    if not occurrences:
        return None

    price_min, price_max, is_free = _extract_prices(description_html)
    normalized_title = _normalize_title(raw_title, place_data["name"])
    description = (
        f"Public aquatic fitness class at {place_data['name']} through Atlanta DPR. "
        "Reserve through the official city registration catalog for current availability."
    )

    age_min = item.get("age_min_year")
    tags = ["aquatics", "water-fitness", "fitness-class", "public-fitness", "atlanta-dpr"]
    if isinstance(age_min, int) and age_min >= 55:
        tags.append("seniors")
    if is_free:
        tags.append("free")

    return {
        "title": normalized_title,
        "description": description,
        "venue_data": place_data,
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
            "Atlanta DPR currently lists this class as free."
            if is_free
            else f"Atlanta DPR currently lists this class from ${price_min:.2f} to ${price_max:.2f}."
            if price_min is not None and price_max is not None and price_min != price_max
            else f"Atlanta DPR currently lists this class at ${price_min:.2f}."
            if price_min is not None
            else "Check Atlanta DPR for current class pricing."
        ),
        "raw_text": " ".join(BeautifulSoup(description_html, "html.parser").get_text(" ").split()),
        "tags": tags,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    enriched_venue_ids: set[int] = set()
    today = datetime.now().date()

    session, csrf = _init_session()
    if not session or not csrf:
        logger.error("Atlanta aquatic fitness crawl aborted: DPR session init failed")
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

            venue_id = get_or_create_place(parsed["venue_data"])
            if venue_id not in enriched_venue_ids:
                persist_typed_entity_envelope(
                    _build_destination_envelope(parsed["venue_data"], venue_id)
                )
                enriched_venue_ids.add(venue_id)

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
                    "place_id": venue_id,
                    "title": parsed["title"],
                    "description": parsed["description"],
                    "start_date": start_date_value,
                    "start_time": parsed["start_time"],
                    "end_date": None,
                    "end_time": parsed["end_time"],
                    "is_all_day": False,
                    "category": "fitness",
                    "subcategory": "fitness.aquatics",
                    "tags": parsed["tags"],
                    "price_min": parsed["price_min"],
                    "price_max": parsed["price_max"],
                    "price_note": parsed["price_note"],
                    "is_free": parsed["is_free"],
                    "source_url": parsed["source_url"],
                    "ticket_url": parsed["ticket_url"],
                    "image_url": None,
                    "raw_text": f"{parsed['raw_text']} | {DAY_NAMES[weekday]} | {start_date_value}",
                    "extraction_confidence": 0.93,
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
            logger.info("Removed %s stale Atlanta aquatic fitness rows", stale_removed)

    logger.info(
        "Atlanta aquatic fitness crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
