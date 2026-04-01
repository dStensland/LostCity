"""
Crawler for Atlanta Clay Works pottery classes.

The classes page is Wix, but the useful schedule text is present in server HTML.
We parse the page text directly instead of relying on brittle DOM card selectors.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from db.programs import infer_season, insert_program
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

WEBSITE_URL = "https://www.atlclayworks.org/"
CLASSES_URL = "https://www.atlclayworks.org/classes"
VENUE_NAME = "Atlanta Clay Works"
VENUE_ADDRESS = "1401 Southland Cir NW"
VENUE_CITY = "Atlanta"
VENUE_STATE = "GA"
HEADERS = {"User-Agent": "Mozilla/5.0"}

SECTION_HEADER = "CLASSES, WORKSHOPS AND PARTIES"
STOP_MARKERS = {
    "HOME",
    "BOOK ONLINE",
    "EVENTS",
    "ABOUT",
    "ARTISTS",
    "CONTACT",
    "PRIVATE CLAY PARTIES",
    "MORE",
}
BLOCK_TITLE_RE = re.compile(r"^[A-Z0-9&'()/ -]{6,}$")
DATE_PATTERNS = (
    re.compile(r"Starts in ([A-Za-z]+)\s+(\d{1,2}),\s*(20\d{2})", re.IGNORECASE),
    re.compile(r"([A-Za-z]+)\s+(\d{1,2}),\s*(20\d{2})\s+Start date", re.IGNORECASE),
    re.compile(r"([A-Za-z]+)\s+(\d{1,2}),\s*(20\d{2})", re.IGNORECASE),
)
TIME_RE = re.compile(
    r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(am|pm)",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"\$(\d+(?:\.\d{2})?)")
SESSION_COUNT_RE = re.compile(r"(\d+)\s+(?:classes|sessions)", re.IGNORECASE)
AGE_RE = re.compile(r"(\d+)\s+years?\s+or\s+older", re.IGNORECASE)
WEEKDAY_RE = re.compile(
    r"\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b",
    re.IGNORECASE,
)
WEEKDAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _clean_line(value: str) -> str:
    value = value.replace("\xa0", " ")
    value = value.replace("\u200b", "")
    value = value.replace("\u2009", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _extract_lines(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)
    lines = [_clean_line(line) for line in text.split("\n")]
    return [line for line in lines if line]


def _is_block_title(line: str) -> bool:
    upper = line.upper()
    if upper in STOP_MARKERS or upper == SECTION_HEADER:
        return False
    if upper in {"REGISTER", "FULL", "TBD"}:
        return False
    if upper.startswith("-"):
        return False
    if upper.startswith("INSTRUCTORS"):
        return False
    if len(line) > 80:
        return False
    if line != upper:
        return False
    if not BLOCK_TITLE_RE.match(upper):
        return False
    return any(ch.isalpha() for ch in upper)


def _extract_blocks(lines: list[str]) -> list[dict]:
    try:
        start_idx = lines.index(SECTION_HEADER) + 1
    except ValueError:
        start_idx = 0

    blocks: list[dict] = []
    current_title: Optional[str] = None
    current_lines: list[str] = []

    for line in lines[start_idx:]:
        if _is_block_title(line):
            if current_title and current_lines:
                blocks.append({"title": current_title, "lines": current_lines[:]})
            current_title = line
            current_lines = []
            continue
        if current_title:
            current_lines.append(line)

    if current_title and current_lines:
        blocks.append({"title": current_title, "lines": current_lines[:]})

    return blocks


def _parse_start_date(text: str) -> Optional[str]:
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None


def _to_24h(time_str: str, meridiem: str) -> str:
    hour, minute = time_str.split(":")
    hour_int = int(hour)
    if meridiem.lower() == "pm" and hour_int != 12:
        hour_int += 12
    elif meridiem.lower() == "am" and hour_int == 12:
        hour_int = 0
    return f"{hour_int:02d}:{minute}"


def _parse_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
    match = TIME_RE.search(text)
    if not match:
        return None, None
    start_raw, end_raw, meridiem = match.groups()
    return _to_24h(start_raw, meridiem), _to_24h(end_raw, meridiem)


def _parse_price(text: str) -> Optional[float]:
    match = PRICE_RE.search(text)
    return float(match.group(1)) if match else None


def _parse_weekday(text: str) -> Optional[int]:
    match = WEEKDAY_RE.search(text)
    if not match:
        return None
    return WEEKDAY_INDEX[match.group(1).lower()]


def _infer_end_date(start_date: str, lines: list[str]) -> Optional[str]:
    match = SESSION_COUNT_RE.search(" ".join(lines))
    if not match:
        return None
    weekday = _parse_weekday(" ".join(lines))
    if weekday is None:
        return None
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    except ValueError:
        return None
    weeks = max(int(match.group(1)) - 1, 0)
    end_dt = start_dt
    if weeks:
        end_dt = start_dt + timedelta(weeks=weeks)
    return end_dt.strftime("%Y-%m-%d")


def _build_description(title: str, lines: list[str]) -> str:
    ignore = {"REGISTER", "SIGN ME UP!", "FULL", "TBD"}
    parts = [line for line in lines if line.upper() not in ignore]
    desc = " ".join(parts[:8]).strip()
    if not desc:
        desc = f"{title} at {VENUE_NAME}"
    return desc[:1000]


def _parse_classes(lines: list[str]) -> list[dict]:
    blocks = _extract_blocks(lines)
    rows: list[dict] = []

    for block in blocks:
        title = block["title"]
        body_lines = block["lines"]
        joined = " ".join(body_lines)
        start_date = _parse_start_date(joined)
        if not start_date:
            continue
        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
            continue

        start_time, end_time = _parse_time_range(joined)
        price = _parse_price(joined)
        age_min = None
        age_match = AGE_RE.search(joined)
        if age_match:
            age_min = int(age_match.group(1))

        rows.append(
            {
                "title": title.title(),
                "start_date": start_date,
                "end_date": _infer_end_date(start_date, body_lines),
                "start_time": start_time,
                "end_time": end_time,
                "price_min": price,
                "price_max": price,
                "description": _build_description(title.title(), body_lines),
                "ticket_url": CLASSES_URL,
                "source_url": CLASSES_URL,
                "age_min": age_min,
                "age_max": None,
                "tags": ["pottery", "ceramics", "art-class", "hands-on"],
            }
        )

    return rows


def _build_program_record(source_id: int, venue_id: int, row: dict) -> dict:
    return {
        "source_id": source_id,
        "place_id": venue_id,
        "name": row["title"],
        "description": row["description"],
        "program_type": "class",
        "provider_name": VENUE_NAME,
        "age_min": row.get("age_min"),
        "age_max": row.get("age_max"),
        "season": infer_season(
            row["title"], datetime.strptime(row["start_date"], "%Y-%m-%d").date()
        ),
        "session_start": row["start_date"],
        "session_end": row.get("end_date") or row["start_date"],
        "schedule_start_time": row.get("start_time"),
        "schedule_end_time": row.get("end_time"),
        "cost_amount": row.get("price_min"),
        "cost_period": "per_session" if row.get("price_min") is not None else None,
        "registration_status": "open",
        "registration_url": row["ticket_url"],
        "tags": row["tags"],
        "metadata": {"source_url": row["source_url"]},
    }


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": row["title"],
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": row.get("start_time"),
        "end_date": row.get("end_date"),
        "end_time": row.get("end_time"),
        "is_all_day": False,
        "category": "art",
        "subcategory": "art.class",
        "tags": row["tags"],
        "price_min": row.get("price_min"),
        "price_max": row.get("price_max"),
        "price_note": (
            f"${row['price_min']:.2f} class price" if row.get("price_min") is not None else None
        ),
        "is_free": row.get("price_min") == 0,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": row["description"],
        "extraction_confidence": 0.85,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(row["title"], VENUE_NAME, row["start_date"]),
        "is_class": True,
        "class_category": "pottery",
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    place_data = {
        "name": VENUE_NAME,
        "slug": "atlanta-clay-works",
        "address": VENUE_ADDRESS,
        "city": VENUE_CITY,
        "state": VENUE_STATE,
        "spot_type": "gallery",
        "vibes": ["artsy", "chill"],
        "website": WEBSITE_URL,
    }

    venue_id = get_or_create_place(place_data)

    logger.info(f"Fetching Atlanta Clay Works classes: {CLASSES_URL}")
    response = requests.get(CLASSES_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    lines = _extract_lines(response.text)
    rows = _parse_classes(lines)
    logger.info("Atlanta Clay Works parsed %d class rows", len(rows))

    for row in rows:
        events_found += 1

        try:
            insert_program(_build_program_record(source_id, venue_id, row))
        except Exception as exc:
            logger.error("Failed to upsert program %s: %s", row["title"], exc)

        event_record = _build_event_record(source_id, venue_id, row)
        existing = find_event_by_hash(event_record["content_hash"])
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info("Added: %s on %s", row["title"], row["start_date"])
        except Exception as exc:
            logger.error("Failed to insert event %s: %s", row["title"], exc)

    logger.info(
        "Atlanta Clay Works crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
