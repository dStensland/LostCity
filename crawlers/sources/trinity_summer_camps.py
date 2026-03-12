"""
Crawler for Trinity School summer camps.

Official sources:
https://www.trinityatl.org/campus-life/summer-camp
https://docs.google.com/document/d/1k4-SFIGEAtSEaeC-Zw_swrpZCfbO4UFMsiUinPmt9T4/edit
https://docs.google.com/spreadsheets/d/1jf9BzcOxVtCiQ-wTRpXkPuWN2l34QU5zJLtxjnp3bns/edit

Pattern role:
School summer-hub implementation backed by public Google Docs/Sheets exports.
The landing page provides the canonical hub and registration destination, while
the spreadsheet and document hold structured session, pricing, grade, and
description data.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime
from typing import Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

LANDING_PAGE_URL = "https://www.trinityatl.org/campus-life/summer-camp"
REGISTRATION_URL = "https://trinityatl.campbrainregistration.com/"
DESCRIPTIONS_EXPORT_URL = (
    "https://docs.google.com/document/d/"
    "1k4-SFIGEAtSEaeC-Zw_swrpZCfbO4UFMsiUinPmt9T4/export?format=txt"
)
PRICING_EXPORT_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1jf9BzcOxVtCiQ-wTRpXkPuWN2l34QU5zJLtxjnp3bns/export?format=csv"
)

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,text/plain,text/csv",
    "Accept-Language": "en-US,en;q=0.9",
}

VENUE_DATA = {
    "name": "Trinity School",
    "slug": "trinity-school-atlanta",
    "address": "4301 Northside Pkwy NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30327",
    "neighborhood": "Buckhead",
    "venue_type": "institution",
    "spot_type": "education",
    "website": "https://www.trinityatl.org/",
    "vibes": ["family-friendly", "educational"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "educational",
    "seasonal",
    "rsvp-required",
]

SESSION_HEADER_RE = re.compile(
    r"^Session\s+(?P<number>\d+)\s*[:|]\s*(?P<date_label>.+)$", re.IGNORECASE
)
PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")
TIME_RANGE_RE = re.compile(
    r"(?P<start>\d{1,2}(?::\d{2})?\s*[AP]M)\s*[–-]\s*"
    r"(?P<end>\d{1,2}(?::\d{2})?\s*[AP]M)",
    re.IGNORECASE,
)
GRADE_SINGLE_RE = re.compile(
    r"\b(early learners|pre-k|kindergarten|first|second|third|fourth|fifth|"
    r"sixth|seventh)\b",
    re.IGNORECASE,
)
GRADE_RANGE_RE = re.compile(
    r"Rising\s+"
    r"(?P<first>Early Learners|Pre-K|Kindergarten|First|Second|Third|Fourth|"
    r"Fifth|Sixth|Seventh)"
    r"\s*[–-]\s*"
    r"(?P<second>Pre-K|Kindergarten|First|Second|Third|Fourth|Fifth|Sixth|Seventh)",
    re.IGNORECASE,
)

GRADE_TO_AGE = {
    "early learners": 3,
    "pre-k": 4,
    "kindergarten": 5,
    "first": 6,
    "second": 7,
    "third": 8,
    "fourth": 9,
    "fifth": 10,
    "sixth": 11,
    "seventh": 12,
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\ufeff", "").replace("\xa0", " ")
    value = (
        value.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2026", "...")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    return re.sub(r"\s+", " ", value).strip()


def _title_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _clean_text(value).lower()).strip()


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []

    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    tags: list[str] = []
    if lo <= 5 and hi >= 3:
        tags.append("preschool")
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 13 and hi >= 10:
        tags.append("tween")
    if 13 <= hi <= 18 or 13 <= lo < 18:
        tags.append("teen")
    return tags


def _parse_time_value(value: str) -> Optional[str]:
    cleaned = _clean_text(value).lower()
    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", cleaned)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or "00")
    meridiem = match.group(3)
    if meridiem == "pm" and hour != 12:
        hour += 12
    if meridiem == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _parse_time_range(value: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    cleaned = _clean_text(value)
    match = TIME_RANGE_RE.search(cleaned)
    if not match:
        return None, None, cleaned or None

    start_time = _parse_time_value(match.group("start"))
    end_time = _parse_time_value(match.group("end"))
    note = cleaned.replace(match.group(0), "").strip(" ,;")
    return start_time, end_time, note or None


def _parse_price(value: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    cleaned = _clean_text(value)
    matches = [float(item) for item in PRICE_RE.findall(cleaned)]
    if not matches:
        return None, None, cleaned or None
    return min(matches), max(matches), cleaned if len(matches) > 1 else None


def _grade_token_to_age(token: str) -> Optional[int]:
    return GRADE_TO_AGE.get(_clean_text(token).lower())


def _parse_grade_range(label: str) -> tuple[Optional[int], Optional[int], list[str]]:
    cleaned = _clean_text(label).replace("*", "")
    if cleaned.lower() == "all grades":
        return 3, 12, _age_band_tags(3, 12)

    match = GRADE_RANGE_RE.search(cleaned)
    if match:
        first = _grade_token_to_age(match.group("first"))
        second = _grade_token_to_age(match.group("second"))
        if first is not None and second is not None:
            return first, second, _age_band_tags(first, second)

    if " and " in cleaned.lower():
        normalized = re.sub(r"^Rising\s+", "", cleaned, flags=re.IGNORECASE)
        tokens = [
            _grade_token_to_age(token)
            for token in re.split(r"\band\b", normalized, flags=re.IGNORECASE)
        ]
        tokens = [token for token in tokens if token is not None]
        if tokens:
            return min(tokens), max(tokens), _age_band_tags(min(tokens), max(tokens))

    tokens = [
        _grade_token_to_age(match.group(1))
        for match in GRADE_SINGLE_RE.finditer(cleaned)
        if _grade_token_to_age(match.group(1)) is not None
    ]
    if tokens:
        return min(tokens), max(tokens), _age_band_tags(min(tokens), max(tokens))

    return None, None, []


def _parse_date_range(
    date_label: str, default_year: int
) -> tuple[Optional[str], Optional[str]]:
    cleaned = _clean_text(date_label).split("|", 1)[0].replace("*", "").strip()
    match = re.match(
        r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*"
        r"(?:(?P<end_month>[A-Za-z]+)\s+)?(?P<end_day>\d{1,2})$",
        cleaned,
    )
    if not match:
        return None, None

    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))

    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            start_dt = datetime.strptime(
                f"{start_month} {start_day} {default_year}", fmt
            )
            end_dt = datetime.strptime(f"{end_month} {end_day} {default_year}", fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None, None


def _derive_class_category(title: str) -> str:
    lowered = title.lower()
    if any(
        term in lowered
        for term in [
            "basketball",
            "football",
            "sports",
            "tennis",
            "yoga",
            "lacrosse",
            "dance",
        ]
    ):
        return "fitness"
    if any(
        term in lowered
        for term in [
            "art",
            "pottery",
            "jewelry",
            "popstar",
            "princess",
            "music",
            "baking",
            "cooking",
            "craft",
        ]
    ):
        return "mixed"
    return "education"


def _derive_tags(title: str, age_tags: list[str]) -> list[str]:
    tags = BASE_TAGS + age_tags
    lowered = title.lower()
    if any(
        term in lowered
        for term in ["basketball", "football", "sports", "tennis", "yoga"]
    ):
        tags.extend(["sports", "fitness"])
    if any(
        term in lowered
        for term in [
            "art",
            "pottery",
            "jewelry",
            "popstar",
            "princess",
            "music",
            "craft",
        ]
    ):
        tags.append("arts")
    if any(
        term in lowered
        for term in ["science", "invent", "stem", "lego", "math", "engineering"]
    ):
        tags.append("stem")
    return list(dict.fromkeys(tags))


def _fetch_text(url: str) -> str:
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
    response.raise_for_status()
    return response.content.decode("utf-8-sig", errors="replace")


def _parse_description_doc(text: str) -> dict[tuple[int, str], str]:
    descriptions: dict[tuple[int, str], str] = {}
    session_number: Optional[int] = None
    lines = [line.strip() for line in text.splitlines()]
    i = 0

    while i < len(lines):
        line = _clean_text(lines[i])
        i += 1
        if not line:
            continue

        session_match = SESSION_HEADER_RE.match(line)
        if session_match:
            session_number = int(session_match.group("number"))
            continue

        if session_number is None:
            continue

        if line.startswith("*") or line == "________________":
            continue

        if i + 1 >= len(lines):
            continue

        grade_line = _clean_text(lines[i])
        time_price_line = _clean_text(lines[i + 1])
        if not grade_line.lower().startswith(("rising ", "all grades")):
            continue
        if "|" not in time_price_line:
            continue

        i += 2
        description_lines: list[str] = []
        while i < len(lines):
            candidate = _clean_text(lines[i])
            if not candidate:
                i += 1
                if description_lines:
                    break
                continue
            if SESSION_HEADER_RE.match(candidate):
                break
            if candidate == "________________":
                i += 1
                break
            description_lines.append(candidate)
            i += 1

        description = _clean_text(" ".join(description_lines))
        if description:
            descriptions[(session_number, _title_key(line))] = description[:1000]

    return descriptions


def _parse_pricing_sheet(csv_text: str) -> list[dict]:
    rows = list(csv.reader(io.StringIO(csv_text)))
    parsed_rows: list[dict] = []
    session_number: Optional[int] = None
    session_label = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    year = datetime.now().year

    for row in rows:
        cells = [_clean_text(cell) for cell in row]
        if not any(cells):
            continue

        first = cells[0]
        session_match = SESSION_HEADER_RE.match(first)
        if session_match:
            session_number = int(session_match.group("number"))
            session_label = first
            parsed_start, parsed_end = _parse_date_range(
                session_match.group("date_label"), year
            )
            start_date = parsed_start
            end_date = parsed_end
            continue

        if first in {"Trinity Summer Camps 2026", "Sessions"} or session_number is None:
            continue

        title = first
        grade_label = cells[1] if len(cells) > 1 else ""
        cost_label = cells[2] if len(cells) > 2 else ""
        timeframe = cells[3] if len(cells) > 3 else ""
        if not title or not start_date or not end_date:
            continue

        age_min, age_max, age_tags = _parse_grade_range(grade_label)
        price_min, price_max, price_note = _parse_price(cost_label)
        start_time, end_time, timeframe_note = _parse_time_range(timeframe)
        notes = [note for note in [timeframe_note, price_note] if note]

        parsed_rows.append(
            {
                "session_number": session_number,
                "session_label": session_label,
                "title": title,
                "grade_label": grade_label,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": start_time,
                "end_time": end_time,
                "is_all_day": False,
                "age_min": age_min,
                "age_max": age_max,
                "tags": _derive_tags(title, age_tags),
                "class_category": _derive_class_category(title),
                "price_min": price_min,
                "price_max": price_max,
                "price_note": "; ".join(notes) if notes else None,
            }
        )

    return parsed_rows


def _build_description(row: dict, descriptions: dict[tuple[int, str], str]) -> str:
    description = descriptions.get((row["session_number"], _title_key(row["title"])))
    parts = [row["title"], row["grade_label"], row["session_label"]]
    if description:
        parts.append(description)
    if row.get("price_note"):
        parts.append(f"Notes: {row['price_note']}.")
    return _clean_text(" ".join(parts))[:1000]


def _build_event_record(
    source_id: int, venue_id: int, row: dict, description: str
) -> dict:
    content_hash = generate_content_hash(
        row["title"], VENUE_DATA["name"], row["start_date"]
    )
    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": row["title"],
        "description": description,
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
        "source_url": LANDING_PAGE_URL,
        "ticket_url": REGISTRATION_URL,
        "image_url": None,
        "raw_text": (
            f"{row['session_label']} | {row['title']} | {row['grade_label']} | {description}"
        ),
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }
    if row.get("age_min") is not None:
        record["age_min"] = row["age_min"]
    if row.get("age_max") is not None:
        record["age_max"] = row["age_max"]
    return record


def crawl(source_id: int, dry_run: bool = False) -> list[dict]:
    logger.info("Crawling Trinity summer camps")

    venue_id = get_or_create_venue(VENUE_DATA)
    pricing_csv = _fetch_text(PRICING_EXPORT_URL)
    description_text = _fetch_text(DESCRIPTIONS_EXPORT_URL)

    rows = _parse_pricing_sheet(pricing_csv)
    descriptions = _parse_description_doc(description_text)

    logger.info("Parsed %s Trinity summer camp rows", len(rows))

    events: list[dict] = []
    for row in rows:
        description = _build_description(row, descriptions)
        event_record = _build_event_record(source_id, venue_id, row, description)
        events.append(event_record)

        if dry_run:
            continue

        existing_event = find_event_by_hash(event_record["content_hash"])
        if existing_event:
            smart_update_existing_event(existing_event["id"], event_record)
        else:
            insert_event(event_record)

    logger.info("Finished Trinity crawl with %s events", len(events))
    return events


if __name__ == "__main__":
    crawl(source_id=0, dry_run=True)
