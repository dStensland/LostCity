"""
Crawler for Atlanta Ballet Centre for Dance Education summer programs.

Official sources:
https://centre.atlantaballet.com/summer-programs/summer-dance-programs
https://centre.atlantaballet.com/summer-programs/summer-intensives

Pattern role:
Brand-owned summer-program hub with program headings, visible age bands,
location-specific session dates, and an official registration-request flow.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://centre.atlantaballet.com"
SUMMER_DANCE_URL = f"{BASE_URL}/summer-programs/summer-dance-programs"
SUMMER_INTENSIVES_URL = f"{BASE_URL}/summer-programs/summer-intensives"
REGISTER_URL = "https://my.atlantaballet.com/register25/26request"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

VENUE_LOOKUP = {
    "virginia-highland centre": {
        "name": "Atlanta Ballet Centre - Virginia-Highland",
        "slug": "atlanta-ballet-centre-virginia-highland",
        "address": "504 Amsterdam Ave NE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "neighborhood": "Virginia-Highland",
        "venue_type": "dance_studio",
        "spot_type": "dance_studio",
        "website": "https://centre.atlantaballet.com/locations/virginia-highland-centre",
        "vibes": ["artsy", "family-friendly", "all-ages"],
    },
    "buckhead centre": {
        "name": "Atlanta Ballet Centre - Buckhead",
        "slug": "atlanta-ballet-centre-buckhead",
        "address": "4279 Roswell Road, Suite 703",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30342",
        "neighborhood": "Buckhead",
        "venue_type": "dance_studio",
        "spot_type": "dance_studio",
        "website": "https://centre.atlantaballet.com/locations/buckhead-centre",
        "vibes": ["artsy", "family-friendly", "all-ages"],
    },
    "michael c. carlos dance centre": {
        "name": "Atlanta Ballet Centre - Michael C. Carlos Dance Centre",
        "slug": "atlanta-ballet-centre-michael-c-carlos",
        "address": "1695 Marietta Boulevard NW",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "neighborhood": "West Midtown",
        "venue_type": "dance_studio",
        "spot_type": "dance_studio",
        "website": "https://centre.atlantaballet.com/locations/michael-c-carlos-dance-centre",
        "vibes": ["artsy", "family-friendly", "all-ages"],
    },
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "dance",
    "ballet",
    "seasonal",
    "rsvp-required",
]

TIME_RANGE_RE = re.compile(
    r"(\d{1,2}:\d{2})\s*(am|pm)\s+to\s+(\d{1,2}:\d{2})\s*(am|pm)",
    re.IGNORECASE,
)
AGE_RANGE_RE = re.compile(
    r"ages?\s+(\d{1,2})(?:\s*-\s*(\d{1,2})|\s+and\s+up)?",
    re.IGNORECASE,
)
LOCATION_SEGMENT_RE = re.compile(
    r"(?P<label>(?:Virginia-Highland|Buckhead|Michael C\. Carlos Dance) Centre(?: at Amsterdam Walk)?(?: \([^)]+\))?)\s*:\s*"
    r"(?P<dates>.*?)(?=(?:Virginia-Highland|Buckhead|Michael C\. Carlos Dance) Centre(?: at Amsterdam Walk)?(?: \([^)]+\))?\s*:|$)",
    re.IGNORECASE,
)
EXPLICIT_RANGE_RE = re.compile(
    r"([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)?\s*(\d{1,2})(?:,\s*(\d{4}))?",
    re.IGNORECASE,
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []

    floor = age_min if age_min is not None else 0
    ceiling = age_max if age_max is not None else 18
    tags: list[str] = []
    if floor <= 3 and ceiling >= 1:
        tags.append("toddler")
    if floor <= 5 and ceiling >= 3:
        tags.append("preschool")
    if floor <= 12 and ceiling >= 5:
        tags.append("elementary")
    if floor <= 13 and ceiling >= 10:
        tags.append("tween")
    if 13 <= ceiling <= 18 or 13 <= floor < 18:
        tags.append("teen")
    return tags


def _parse_age_range(text: str) -> tuple[Optional[int], Optional[int]]:
    match = AGE_RANGE_RE.search(_clean_text(text))
    if not match:
        return None, None
    age_min = int(match.group(1))
    age_max = int(match.group(2)) if match.group(2) else None
    return age_min, age_max


def _parse_time_value(value: str, ampm: str) -> str:
    parsed = datetime.strptime(f"{value} {ampm.lower()}", "%I:%M %p")
    return parsed.strftime("%H:%M")


def _parse_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
    match = TIME_RANGE_RE.search(_clean_text(text))
    if not match:
        return None, None
    return _parse_time_value(match.group(1), match.group(2)), _parse_time_value(
        match.group(3), match.group(4)
    )


def _parse_year(text: str) -> int:
    match = re.search(r"\b(20\d{2})\b", text)
    return int(match.group(1)) if match else datetime.now().year


def _parse_date_spec(date_text: str, year: int) -> tuple[str, str]:
    cleaned = _clean_text(date_text)
    match = EXPLICIT_RANGE_RE.search(cleaned)
    if not match:
        raise ValueError(f"Unable to parse date range: {date_text}")

    start_month = match.group(1)
    start_day = int(match.group(2))
    end_month = match.group(3) or start_month
    end_day = int(match.group(4))
    explicit_year = int(match.group(5)) if match.group(5) else year

    start_dt = datetime.strptime(
        f"{start_month} {start_day} {explicit_year}", "%B %d %Y"
    )
    end_dt = datetime.strptime(f"{end_month} {end_day} {explicit_year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _normalize_location_label(label: str) -> str:
    cleaned = _clean_text(label).lower()
    cleaned = cleaned.replace("centre at amsterdam walk", "centre")
    cleaned = re.sub(r"\s*\([^)]+\)$", "", cleaned).strip()
    return cleaned


def _parse_location_sessions(session_text: str, year: int) -> list[dict]:
    working = _clean_text(session_text.split("Students must")[0])
    sessions: list[dict] = []

    for match in LOCATION_SEGMENT_RE.finditer(working):
        label = _clean_text(match.group("label"))
        dates_blob = _clean_text(match.group("dates"))
        is_weekly = "saturday" in label.lower()
        venue_key = _normalize_location_label(label)
        for raw_segment in [segment.strip() for segment in dates_blob.split("|") if segment.strip()]:
            start_date, end_date = _parse_date_spec(raw_segment, year)
            sessions.append(
                {
                    "venue_key": venue_key,
                    "start_date": start_date,
                    "end_date": end_date,
                    "is_weekly": is_weekly,
                }
            )

    return sessions


def _collect_following_paragraphs(heading: Tag) -> list[str]:
    paragraphs: list[str] = []
    sibling = heading.find_next_sibling()
    while sibling:
        if sibling.name in {"h1", "h2", "h3"}:
            break
        if sibling.name == "p":
            text = _clean_text(sibling.get_text(" ", strip=True))
            if text:
                paragraphs.append(text)
        sibling = sibling.find_next_sibling()
    return paragraphs


def _derive_tags(title: str, description: str, age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    tags = list(BASE_TAGS)
    lowered = f"{title} {description}".lower()
    if "creative" in lowered or "choreography" in lowered:
        tags.append("arts")
    if "intensive" in lowered:
        tags.append("intensive")
    if "tap" in lowered or "jazz" in lowered or "hip-hop" in lowered:
        tags.append("dance-class")
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _parse_dance_program_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    year = _parse_year(soup.get_text(" ", strip=True))
    rows: list[dict] = []

    for heading in soup.find_all("h2"):
        heading_text = _clean_text(heading.get_text(" ", strip=True))
        if "(ages" not in heading_text.lower():
            continue
        if heading_text.startswith("Summer Dance Programs -"):
            continue

        paragraphs = _collect_following_paragraphs(heading)
        if len(paragraphs) < 2:
            continue

        session_text = paragraphs[0]
        description = paragraphs[1]
        age_min, age_max = _parse_age_range(heading_text)
        start_time, end_time = _parse_time_range(description)
        sessions = _parse_location_sessions(session_text, year)

        for session in sessions:
            rows.append(
                {
                    "title": re.sub(r"\s*\(ages?.*?\)$", "", heading_text).strip(),
                    "description": description,
                    "source_url": SUMMER_DANCE_URL,
                    "ticket_url": REGISTER_URL,
                    "start_date": session["start_date"],
                    "end_date": session["end_date"],
                    "start_time": start_time,
                    "end_time": end_time,
                    "is_all_day": start_time is None,
                    "is_recurring": session["is_weekly"],
                    "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA" if session["is_weekly"] else None,
                    "age_min": age_min,
                    "age_max": age_max,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Registration opens January 2026.",
                    "tags": _derive_tags(heading_text, description, age_min, age_max),
                    "venue_data": VENUE_LOOKUP[session["venue_key"]],
                }
            )

    return rows


def _parse_intensive_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    full_text = soup.get_text(" ", strip=True)
    year = _parse_year(full_text)
    shared_age_min, shared_age_max = _parse_age_range(full_text)
    rows: list[dict] = []

    for heading in soup.find_all("h2"):
        heading_text = _clean_text(heading.get_text(" ", strip=True))
        if heading_text not in {"2026 Summer Intensives", "2026 Professional Intensive"}:
            continue

        paragraphs = _collect_following_paragraphs(heading)
        if not paragraphs:
            continue

        if heading_text == "2026 Summer Intensives":
            shared_description = " ".join(
                part for part in paragraphs if part.startswith("Dancers who attend")
            )
            for paragraph in paragraphs:
                title_match = re.match(
                    r"^(Summer Intensive [235]-Week Program)\s+([235]-Week Program:\s+.+)$",
                    paragraph,
                    re.IGNORECASE,
                )
                if not title_match:
                    continue
                start_date, end_date = _parse_date_spec(title_match.group(2), year)
                title = _clean_text(title_match.group(1))
                rows.append(
                    {
                        "title": title,
                        "description": shared_description
                        or "Audition-based Atlanta Ballet summer intensive program.",
                        "source_url": SUMMER_INTENSIVES_URL,
                        "ticket_url": REGISTER_URL,
                        "start_date": start_date,
                        "end_date": end_date,
                        "start_time": None,
                        "end_time": None,
                        "is_all_day": True,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "age_min": shared_age_min,
                        "age_max": shared_age_max,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Audition required. Housing and meal plans available for ages 13 to 20.",
                        "tags": _derive_tags(
                            title,
                            shared_description,
                            shared_age_min,
                            shared_age_max,
                        ),
                        "venue_data": VENUE_LOOKUP["michael c. carlos dance centre"],
                    }
                )
        else:
            title = paragraphs[0]
            if len(paragraphs) < 2:
                continue
            start_date, end_date = _parse_date_spec(paragraphs[1], year)
            description = " ".join(paragraphs[2:4]).strip()
            rows.append(
                {
                    "title": title,
                    "description": description
                    or "Invitation-only professional Atlanta Ballet summer intensive.",
                    "source_url": SUMMER_INTENSIVES_URL,
                    "ticket_url": REGISTER_URL,
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": None,
                    "end_time": None,
                    "is_all_day": True,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "age_min": shared_age_min,
                    "age_max": None,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Invitation only.",
                    "tags": _derive_tags(title, description, shared_age_min, None),
                    "venue_data": VENUE_LOOKUP["michael c. carlos dance centre"],
                }
            )

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at {row['venue_data']['name']}"
    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "end_date": row["end_date"],
        "end_time": row["end_time"],
        "is_all_day": row["is_all_day"],
        "category": "programs",
        "subcategory": "camp",
        "class_category": "arts",
        "tags": row["tags"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{title} | {row['description']}",
        "extraction_confidence": 0.88,
        "is_recurring": row["is_recurring"],
        "recurrence_rule": row["recurrence_rule"],
        "content_hash": generate_content_hash(title, row["venue_data"]["name"], row["start_date"]),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    try:
        dance_response = session.get(SUMMER_DANCE_URL, timeout=30)
        dance_response.raise_for_status()
        intensive_response = session.get(SUMMER_INTENSIVES_URL, timeout=30)
        intensive_response.raise_for_status()
    except Exception as exc:
        logger.error("Atlanta Ballet Centre Summer Programs: fetch failed: %s", exc)
        return 0, 0, 0

    rows = _parse_dance_program_rows(dance_response.text) + _parse_intensive_rows(
        intensive_response.text
    )
    today = date.today().strftime("%Y-%m-%d")

    for row in rows:
        if row["end_date"] < today:
            continue

        try:
            venue_id = get_or_create_venue(row["venue_data"])
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
                "Atlanta Ballet Centre Summer Programs: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
