"""
Crawler for Frazer Center Nature Camp.

Official source:
https://www.frazercenter.org/child-development-program/summer-camps/

Pattern role:
Single-program camp page with age band, explicit session list, published hours,
and official registration form for inclusion-focused nature camp.
"""

from __future__ import annotations

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

SOURCE_URL = "https://www.frazercenter.org/child-development-program/summer-camps/"
REGISTER_URL = "https://thefrazercenter.formstack.com/forms/summer_camp_application_2026"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

VENUE_DATA = {
    "name": "Frazer Center",
    "slug": "frazer-center",
    "address": "1815 S Ponce De Leon Ave NE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "neighborhood": "Druid Hills",
    "venue_type": "campus",
    "spot_type": "campus",
    "website": "https://www.frazercenter.org/",
    "vibes": ["family-friendly", "outdoor", "educational"],
}

SESSION_RE = re.compile(
    r"Session\s+(?P<number>\d+):\s*"
    r"(?P<start_month>[A-Za-z]+)\s*(?P<start_day>\d{1,2})\s*[-–]\s*"
    r"(?P<end_month>[A-Za-z]+)?\s*(?P<end_day>\d{1,2}),\s*(?P<year>20\d{2})"
    r"(?P<holiday>\*)?\s*•\s*(?P<start_time>[0-9:apm]+)\s*[-–]\s*(?P<end_time>[0-9:apm]+)",
    re.IGNORECASE,
)
AGE_RE = re.compile(r"ages?\s*(\d+)\s*[-–]\s*(\d+)", re.IGNORECASE)

BASE_TAGS = [
    "camp",
    "family-friendly",
    "nature",
    "outdoor",
    "educational",
    "rsvp-required",
]


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _normalize_time(value: str) -> str:
    normalized = value.upper()
    if ":" not in normalized:
        normalized = normalized.replace("AM", ":00AM").replace("PM", ":00PM")
    parsed = datetime.strptime(normalized, "%I:%M%p")
    return parsed.strftime("%H:%M")


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 5:
        tags.append("preschool")
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    return tags


def _derive_tags(age_min: int, age_max: int) -> list[str]:
    tags = list(BASE_TAGS)
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _parse_session_dates(match: re.Match[str]) -> tuple[str, str]:
    today = date.today()
    year = today.year
    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_dt = datetime.strptime(
        f"{start_month} {match.group('start_day')} {year}",
        "%B %d %Y",
    )
    # If the parsed session is entirely in the past, roll forward one year
    # (handles end-of-year page scrapes where next summer's dates appear)
    if start_dt.date() < today:
        year += 1
        start_dt = datetime.strptime(
            f"{start_month} {match.group('start_day')} {year}",
            "%B %d %Y",
        )
    end_dt = datetime.strptime(
        f"{end_month} {match.group('end_day')} {year}",
        "%B %d %Y",
    )
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _parse_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")

    heading = soup.find("h3", string=lambda text: text and "ages" in text.lower())
    heading_text = _clean_text(heading.get_text(" ", strip=True) if heading else "")
    age_match = AGE_RE.search(heading_text)
    age_min = int(age_match.group(1)) if age_match else 4
    age_max = int(age_match.group(2)) if age_match else 6

    description_parts: list[str] = []
    for paragraph in soup.find_all("p"):
        text = _clean_text(paragraph.get_text(" ", strip=True))
        if not text or text.startswith("Session 1:"):
            continue
        if text.startswith("Session"):
            continue
        if "Nature Campers" in text or "guest educators" in text or "Frazer Forest" in text:
            description_parts.append(text)
    description = " ".join(description_parts[:3])

    session_line = ""
    for paragraph in soup.find_all("p"):
        text = _clean_text(paragraph.get_text(" ", strip=True))
        if text.startswith("Session 1:"):
            session_line = text
            break

    rows: list[dict] = []
    for match in SESSION_RE.finditer(session_line):
        start_date, end_date = _parse_session_dates(match)
        is_holiday_week = bool(match.group("holiday"))
        price_min = None if is_holiday_week else 420.0
        price_max = None if is_holiday_week else 420.0
        price_note = (
            "Sessions are $420/week on the official Frazer Nature Camp page."
            if not is_holiday_week
            else "Holiday-shortened sessions are priced separately on the official Frazer Nature Camp page."
        )
        rows.append(
            {
                "title": f"Frazer Nature Camp Session {match.group('number')}",
                "description": description,
                "source_url": SOURCE_URL,
                "ticket_url": REGISTER_URL,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": _normalize_time(match.group("start_time")),
                "end_time": _normalize_time(match.group("end_time")),
                "is_all_day": False,
                "age_min": age_min,
                "age_max": age_max,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "class_category": "outdoors",
                "tags": _derive_tags(age_min, age_max),
            }
        )

    rows.sort(key=lambda row: (row["start_date"], row["title"]))
    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": row["title"],
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "end_date": row["end_date"],
        "end_time": row["end_time"],
        "is_all_day": row["is_all_day"],
        "category": "programs",
        "subcategory": "camp",
        "class_category": row["class_category"],
        "tags": row["tags"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{row['title']} | {row['description']}",
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(row["title"], VENUE_DATA["name"], row["start_date"]),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        response = requests.get(SOURCE_URL, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
        rows = _parse_rows(response.text)
    except Exception as exc:
        logger.error("Frazer Nature Camp fetch failed: %s", exc)
        return 0, 0, 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = date.today().strftime("%Y-%m-%d")

    for row in rows:
        if row["end_date"] < today:
            continue
        try:
            record = _build_event_record(source_id, venue_id, row)
            events_found += 1
            existing = find_event_by_hash(record["content_hash"])
            if existing:
                smart_update_existing_event(existing, record)
                events_updated += 1
            else:
                insert_event(record)
                events_new += 1
        except Exception as exc:
            logger.error(
                "Frazer Nature Camp: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
