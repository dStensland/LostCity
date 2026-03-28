"""
Crawler for The Walker School summer programs.

Official source:
https://www.thewalkerschool.org/walker-summer-camp

Pattern role:
School summer-hub implementation using server-rendered tables. Walker publishes
summer camps as alternating table header/detail rows, with a mix of single-camp
entries and a few multi-week day-camp blocks.
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
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://www.thewalkerschool.org/walker-summer-camp"
REGISTRATION_URL = "https://walkersummerprograms.campbrainregistration.com"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

PLACE_DATA = {
    "name": "The Walker School",
    "slug": "the-walker-school",
    "address": "700 Cobb Pkwy N",
    "city": "Marietta",
    "state": "GA",
    "zip": "30062",
    "lat": 33.9678,
    "lng": -84.5207,
    "neighborhood": "Marietta",
    "venue_type": "institution",
    "spot_type": "education",
    "website": "https://www.thewalkerschool.org/",
    "vibes": ["family-friendly", "educational"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "educational",
    "seasonal",
    "rsvp-required",
]

HEADER_RE = re.compile(
    r"^(?P<date>(?:May|June|July|Aug\.|AUG\.)\s+\d{1,2}(?:-\d{1,2})?)\s*[-,]\s*"
    r"(?P<title>.+?)"
    r"(?:,\s*(?P<time>[^()]+?))?"
    r"\s*\((?P<grades>[^)]+)\)\s*$",
    re.IGNORECASE,
)
WEEK_LINE_RE = re.compile(
    r"Week\s*(?P<week>\d+)\s*:?\s*(?P<date>(?:June|July|Aug\.|AUG\.)\s+\d{1,2}-\d{1,2})"
    r"(?:\s*-\s*(?P<theme>.+))?$",
    re.IGNORECASE,
)
BONUS_WEEK_RE = re.compile(
    r"Week\s*(?P<week>\d+)\s*:?\s*(?P<theme>.+)$",
    re.IGNORECASE,
)
TIME_RANGE_RE = re.compile(
    r"(?P<start>(?:\d{1,2}(?::\d{2})?)\s*(?:[ap]\.?\s*m\.?)?|All Day|FULL DAY)\s*(?:to|-)\s*"
    r"(?P<end>(?:\d{1,2}(?::\d{2})?)\s*[ap]\.?\s*m\.?)?$",
    re.IGNORECASE,
)
GRADE_RANGE_RE = re.compile(
    r"Grades?\s+(?P<first>K|\d+)(?:st|nd|rd|th)?\s*-\s*(?P<second>K|\d+)(?:st|nd|rd|th)?",
    re.IGNORECASE,
)
EARLY_K_RE = re.compile(r"3\s*yr\.\s*olds?-kindergarten", re.IGNORECASE)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", value).strip()


def _smart_title(value: str) -> str:
    words = _clean_text(value).split()
    normalized = []
    for word in words:
        if word.isupper() and len(word) > 1:
            normalized.append(word.title())
        else:
            normalized.append(word)
    return " ".join(normalized)


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


def _parse_year(soup: BeautifulSoup) -> int:
    text = soup.get_text(" ", strip=True)
    match = re.search(r"Summer 20(\d{2})", text, re.IGNORECASE)
    if match:
        return int(f"20{match.group(1)}")
    return datetime.now().year


def _month_token_to_month(token: str) -> str:
    token = token.lower().replace(".", "")
    mapping = {"may": "May", "june": "June", "july": "July", "aug": "August"}
    return mapping.get(token, token.title())


def _parse_date_range(text: str, year: int) -> tuple[Optional[str], Optional[str]]:
    cleaned = _clean_text(text)
    match = re.match(
        r"(?P<month>May|June|July|Aug\.|AUG\.)\s+(?P<start>\d{1,2})-(?P<end>\d{1,2})",
        cleaned,
        re.IGNORECASE,
    )
    if not match:
        return None, None
    month = _month_token_to_month(match.group("month"))
    start_day = int(match.group("start"))
    end_day = int(match.group("end"))
    start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _parse_time_value(value: str) -> Optional[str]:
    cleaned = _clean_text(value).lower().replace(".", "")
    if not cleaned:
        return None
    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*([ap]m)?", cleaned)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or "00")
    ampm = match.group(3)
    if not ampm:
        return None
    if ampm == "pm" and hour != 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _infer_time_from_end(start_value: str, end_value: str) -> Optional[str]:
    start_cleaned = _clean_text(start_value).lower().replace(".", "")
    start_match = re.match(r"(\d{1,2})(?::(\d{2}))?$", start_cleaned)
    if not start_match:
        return None

    end_time = _parse_time_value(end_value)
    if not end_time:
        return None
    end_hour, end_minute = map(int, end_time.split(":"))
    end_total = end_hour * 60 + end_minute

    start_hour = int(start_match.group(1))
    start_minute = int(start_match.group(2) or "00")

    candidates: list[tuple[int, str]] = []
    for meridiem in ("am", "pm"):
        hour = start_hour
        if meridiem == "pm" and hour != 12:
            hour += 12
        if meridiem == "am" and hour == 12:
            hour = 0
        total = hour * 60 + start_minute
        duration = end_total - total
        if 0 < duration <= 8 * 60:
            candidates.append((duration, f"{hour:02d}:{start_minute:02d}"))

    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def _parse_time_range(text: str) -> tuple[Optional[str], Optional[str], bool]:
    cleaned = _clean_text(text)
    if not cleaned:
        return None, None, True
    if "full day" in cleaned.lower() or "all day" in cleaned.lower():
        return None, None, True
    match = TIME_RANGE_RE.search(cleaned)
    if not match:
        return None, None, False
    start_value = match.group("start")
    end_value = match.group("end") or ""
    start_time = _parse_time_value(start_value)
    end_time = _parse_time_value(end_value)
    if start_time is None and end_value:
        start_time = _infer_time_from_end(start_value, end_value)
    return (
        start_time,
        end_time,
        False,
    )


def _grade_token_to_age(token: str) -> Optional[int]:
    cleaned = _clean_text(token).lower()
    if cleaned == "k":
        return 5
    if cleaned.isdigit():
        return int(cleaned) + 5
    return None


def _parse_grade_range(text: str) -> tuple[Optional[int], Optional[int], list[str]]:
    cleaned = _clean_text(text)
    if EARLY_K_RE.search(cleaned):
        return 3, 5, _age_band_tags(3, 5)

    match = GRADE_RANGE_RE.search(cleaned)
    if not match:
        return None, None, []
    first = _grade_token_to_age(match.group("first"))
    second = _grade_token_to_age(match.group("second"))
    if first is None or second is None:
        return None, None, []
    return first, second, _age_band_tags(first, second)


def _derive_tags(title: str, age_tags: list[str], section: str) -> list[str]:
    lowered = title.lower()
    tags = BASE_TAGS + age_tags
    if any(
        term in lowered
        for term in [
            "basketball",
            "soccer",
            "softball",
            "baseball",
            "football",
            "volleyball",
            "lacrosse",
            "golf",
            "karate",
            "futsal",
            "speed and agility",
            "cheer",
            "cross country",
        ]
    ):
        tags.extend(["sports", "fitness"])
    if any(
        term in lowered
        for term in [
            "art",
            "clay",
            "broadway",
            "vocal",
            "drumming",
            "movie",
            "book",
            "origami",
        ]
    ):
        tags.append("arts")
    if any(
        term in lowered
        for term in [
            "robotics",
            "3d printing",
            "tech",
            "stem",
            "science",
            "engineering",
        ]
    ):
        tags.append("stem")
    if "upper school" in section.lower():
        tags.append("teen")
    return list(dict.fromkeys(tags))


def _derive_class_category(title: str) -> str:
    lowered = title.lower()
    if any(
        term in lowered
        for term in [
            "basketball",
            "soccer",
            "softball",
            "baseball",
            "football",
            "volleyball",
            "lacrosse",
            "golf",
            "karate",
            "futsal",
            "speed and agility",
            "cross country",
            "cheer",
        ]
    ):
        return "fitness"
    if any(
        term in lowered for term in ["art", "clay", "broadway", "vocal", "drumming"]
    ):
        return "mixed"
    return "education"


def _extract_detail_text(td: Tag) -> str:
    return _clean_text(td.get_text(" ", strip=True))


def _extract_metadata(td: Tag) -> dict[str, str]:
    text = _extract_detail_text(td)
    fields = {}
    for key in [
        "Camp Leader",
        "Camp leader",
        "Drop-off/Pick-up",
        "Drop off/Pick up",
        "Drop off/Pick-up",
        "Pick-up & Drop off",
        "Camp hours",
        "Camp fee",
        "Camp Drop Off/Pick Up Location",
        "Early Drop Off/After Care Pick Up Location",
    ]:
        pattern = re.compile(rf"{re.escape(key)}\s*:?\s*([^|]+)", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            fields[key.lower()] = _clean_text(match.group(1))
    return fields


def _extract_block_lines(td: Tag) -> list[str]:
    raw_lines = [
        _clean_text(line)
        for line in td.get_text("\n", strip=True).splitlines()
        if _clean_text(line)
    ]
    normalized: list[str] = []
    for line in raw_lines:
        if line.startswith(":") and normalized:
            normalized[-1] = _clean_text(f"{normalized[-1]} {line}")
            continue
        normalized.append(line)
    return normalized


def _build_description(title: str, detail_text: str, metadata: dict[str, str]) -> str:
    leader = metadata.get("camp leader")
    parts = [title, detail_text]
    if leader:
        parts.append(f"Camp leader: {leader}.")
    fee = metadata.get("camp fee")
    if fee:
        parts.append(f"Camp fee: {fee}.")
    return _clean_text(" ".join(parts))[:1000]


def _parse_generic_header(
    header: str, section: str, detail_td: Tag, year: int
) -> Optional[dict]:
    match = HEADER_RE.match(_clean_text(header))
    if not match:
        return None

    start_date, end_date = _parse_date_range(match.group("date"), year)
    if not start_date:
        return None

    title = _smart_title(match.group("title"))
    time_text = _clean_text(match.group("time") or "")
    detail_text = _extract_detail_text(detail_td)
    metadata = _extract_metadata(detail_td)
    if not time_text:
        time_text = metadata.get("camp hours", "")
    start_time, end_time, is_all_day = _parse_time_range(time_text)
    age_min, age_max, age_tags = _parse_grade_range(match.group("grades"))

    return {
        "header_key": _clean_text(header).lower(),
        "title": title,
        "section": section,
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": end_time,
        "is_all_day": is_all_day,
        "age_min": age_min,
        "age_max": age_max,
        "tags": _derive_tags(title, age_tags, section),
        "class_category": _derive_class_category(title),
        "description": _build_description(title, detail_text, metadata),
        "price_min": None,
        "price_max": None,
        "price_note": metadata.get("camp fee"),
    }


def _parse_primary_full_day(detail_td: Tag, year: int) -> list[dict]:
    text_lines = _extract_block_lines(detail_td)
    base_desc = _clean_text(" ".join(text_lines[:3]))
    rows: list[dict] = []
    for line in text_lines:
        match = WEEK_LINE_RE.match(line)
        if not match:
            continue
        start_date, end_date = _parse_date_range(match.group("date"), year)
        if not start_date:
            continue
        theme = _smart_title(match.group("theme") or f"Week {match.group('week')}")
        title = f"Primary School Full Day Camp: {theme}"
        rows.append(
            {
                "header_key": f"primary-school-{match.group('week')}",
                "title": title,
                "section": "Primary School Summer Camps",
                "start_date": start_date,
                "end_date": end_date,
                "start_time": "09:00",
                "end_time": "16:00",
                "is_all_day": False,
                "age_min": 3,
                "age_max": 5,
                "tags": list(dict.fromkeys(BASE_TAGS + _age_band_tags(3, 5))),
                "class_category": "education",
                "description": _build_description(
                    title,
                    base_desc,
                    {"camp fee": "Does not include early drop off or aftercare."},
                ),
                "price_min": None,
                "price_max": None,
                "price_note": "Does not include early drop off or aftercare.",
            }
        )
    return rows


def _parse_primary_bonus(detail_td: Tag, year: int) -> list[dict]:
    text_lines = _extract_block_lines(detail_td)
    text = _clean_text(" ".join(text_lines))
    match = None
    for line in text_lines:
        match = BONUS_WEEK_RE.match(line)
        if match:
            break
    if not match:
        return []
    title = f"Primary School Full Day Camp: {_smart_title(match.group('theme'))}"
    return [
        {
            "header_key": "primary-school-8",
            "title": title,
            "section": "Primary School Summer Camps",
            "start_date": f"{year}-07-27",
            "end_date": f"{year}-07-31",
            "start_time": "09:00",
            "end_time": "16:00",
            "is_all_day": False,
            "age_min": 3,
            "age_max": 5,
            "tags": list(dict.fromkeys(BASE_TAGS + _age_band_tags(3, 5))),
            "class_category": "education",
            "description": _build_description(
                title,
                text,
                {"camp fee": "Does not include early drop off or aftercare."},
            ),
            "price_min": None,
            "price_max": None,
            "price_note": "Does not include early drop off or aftercare.",
        }
    ]


def _parse_summer_explorers(
    detail_td: Tag, year: int, bonus: bool = False
) -> list[dict]:
    text_lines = _extract_block_lines(detail_td)
    rows: list[dict] = []
    date_lines = []
    for line in text_lines:
        if re.match(r"^(June|July)\s+\d{1,2}-\d{1,2}$", line, re.IGNORECASE):
            date_lines.append(line)
    if bonus:
        date_lines = ["July 27-31"]

    desc = _clean_text(" ".join(text_lines))
    for date_line in date_lines:
        start_date, end_date = _parse_date_range(date_line, year)
        if not start_date:
            continue
        rows.append(
            {
                "header_key": f"summer-explorers-{start_date}",
                "title": "Summer Explorers",
                "section": "Lower School Summer Camps",
                "start_date": start_date,
                "end_date": end_date,
                "start_time": "09:00",
                "end_time": "16:00",
                "is_all_day": False,
                "age_min": 6,
                "age_max": 10,
                "tags": list(dict.fromkeys(BASE_TAGS + _age_band_tags(6, 10))),
                "class_category": "education",
                "description": desc[:1000],
                "price_min": None,
                "price_max": None,
                "price_note": "Includes field trip entrance fees, transportation, and camp T-shirt.",
            }
        )
    return rows


def _parse_tables(soup: BeautifulSoup) -> list[dict]:
    year = _parse_year(soup)
    rows: list[dict] = []
    seen_keys: set[str] = set()

    current_section = ""
    for element in soup.find_all(["h5", "table"]):
        if element.name == "h5":
            current_section = _clean_text(element.get_text(" ", strip=True))
            continue

        if element.name != "table":
            continue

        tr_list = element.find_all("tr")
        i = 0
        while i < len(tr_list) - 1:
            header_text = _clean_text(tr_list[i].get_text(" ", strip=True))
            detail_td = tr_list[i + 1].find("td")
            i += 2
            if not header_text or detail_td is None:
                continue
            if header_text == "New Avenues Summer Academic Voyages":
                continue

            parsed_rows: list[dict] = []
            if header_text == "Primary school bonus 8th week":
                parsed_rows = _parse_primary_bonus(detail_td, year)
            elif header_text == "Summer Explorers":
                parsed_rows = _parse_summer_explorers(detail_td, year, bonus=False)
            elif header_text == "Summer Explorers bonus 8th week":
                parsed_rows = _parse_summer_explorers(detail_td, year, bonus=True)
            elif header_text == "Full Day Camps":
                parsed_rows = _parse_primary_full_day(detail_td, year)
            else:
                parsed = _parse_generic_header(
                    header_text, current_section, detail_td, year
                )
                if parsed:
                    parsed_rows = [parsed]

            for row in parsed_rows:
                if row["header_key"] in seen_keys:
                    continue
                seen_keys.add(row["header_key"])
                rows.append(row)

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    content_hash = generate_content_hash(
        row["title"], PLACE_DATA["name"], row["start_date"]
    )
    record = {
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
        "source_url": SOURCE_URL,
        "ticket_url": REGISTRATION_URL,
        "image_url": None,
        "raw_text": f"{row['section']} | {row['title']} | {row['description']}",
        "extraction_confidence": 0.88,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }
    if row.get("age_min") is not None:
        record["age_min"] = row["age_min"]
    if row.get("age_max") is not None:
        record["age_max"] = row["age_max"]
    return record


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        response = requests.get(SOURCE_URL, timeout=30, headers=REQUEST_HEADERS)
        response.raise_for_status()
    except Exception as exc:
        logger.error("Walker Summer Programs: failed to fetch page: %s", exc)
        return 0, 0, 0

    venue_id = get_or_create_place(PLACE_DATA)
    today = date.today().strftime("%Y-%m-%d")

    for row in _parse_tables(BeautifulSoup(response.text, "html.parser")):
        try:
            if row["end_date"] < today:
                continue
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
                "Walker Summer Programs: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    logger.info(
        "Walker Summer Programs crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
