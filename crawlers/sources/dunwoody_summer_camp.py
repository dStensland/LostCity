"""
Crawler for Dunwoody Nature Center summer camps at Dunwoody Park.

Official sources:
https://dunwoodynature.org/education/summer-camp/
https://dunwoodynature.org/wp-content/uploads/Summer-Camp-2026-Descriptions.pdf.pdf

Pattern role:
Official camp landing page plus public camp-themes PDF. The page provides the
registration destination, pricing bands, age/time constraints, and FAQ rules;
the PDF provides the dated weekly camp themes.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from sources._dunwoody_camp_pdf import extract_title_date_pairs_from_pdf

logger = logging.getLogger(__name__)

SOURCE_URL = "https://dunwoodynature.org/education/summer-camp/"
PDF_URL = "https://dunwoodynature.org/wp-content/uploads/Summer-Camp-2026-Descriptions.pdf.pdf"
REGISTER_URL = "https://www.hisawyer.com/dunwoody-nature-center/schedules?schedule_id=camps&page=1"

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
    "name": "Dunwoody Nature Center",
    "slug": "dunwoody-nature-center",
    "address": "5343 Roberts Dr",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30338",
    "lat": 33.9428,
    "lng": -84.3227,
    "neighborhood": "Dunwoody",
    "venue_type": "nature_center",
    "spot_type": "park",
    "website": "https://dunwoodynature.org/",
    "vibes": ["family-friendly", "outdoor", "educational"],
}

DATE_RE = re.compile(
    r"^(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*"
    r"(?:(?P<end_month>[A-Za-z]+)\s+)?(?P<end_day>\d{1,2})$"
)

HALF_DAY_ONLY_TITLES = {"Habitat Hunt", "Buzz and Flutter"}
FOUR_DAY_WEEKS = {"2026-05-26", "2026-06-29"}

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
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-").replace("’", "'")
    return re.sub(r"\s+", " ", value).strip()


def _parse_date_line(value: str, year: int = 2026) -> tuple[str, str]:
    match = DATE_RE.match(_clean_text(value))
    if not match:
        raise ValueError(f"Could not parse Dunwoody summer-camp date line: {value}")
    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_dt = datetime.strptime(
        f"{start_month} {match.group('start_day')} {year}",
        "%B %d %Y",
    )
    end_dt = datetime.strptime(
        f"{end_month} {match.group('end_day')} {year}",
        "%B %d %Y",
    )
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 5:
        tags.append("preschool")
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    return tags


def _derive_tags(title: str, age_min: int, age_max: int) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if "creek" in lowered or "water" in lowered:
        tags.extend(["water-play", "creek"])
    if any(word in lowered for word in ["bug", "insect", "buzz", "flutter"]):
        tags.append("animals")
    if any(word in lowered for word in ["reptile", "swamp", "animal"]):
        tags.append("animals")
    if any(word in lowered for word in ["scientist", "habitat"]):
        tags.append("stem")
    if any(word in lowered for word in ["wing", "bird"]):
        tags.append("birds")
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _description_for_title(title: str) -> str:
    if "Creek Week" in title:
        return (
            f"{title} is part of Dunwoody Nature Center's Dunwoody Park summer-camp lineup, "
            "with creek exploration, outdoor discovery, and water play."
        )
    return (
        f"{title} is part of Dunwoody Nature Center's themed summer-camp lineup at "
        "Dunwoody Park, built around outdoor adventures, nature exploration, and crafts."
    )


def _rows_from_pairs(pairs: list[tuple[str, str]]) -> list[dict]:
    rows: list[dict] = []
    for title, date_line in pairs:
        start_date, end_date = _parse_date_line(date_line)
        is_half_day_only = title in HALF_DAY_ONLY_TITLES
        is_four_day_week = start_date in FOUR_DAY_WEEKS

        if is_half_day_only:
            age_min = 4
            age_max = 4
            start_time = "09:30"
            end_time = "13:00"
            price_min = 270.0
            price_max = 270.0
            price_note = (
                "Official Dunwoody Nature Center summer-camp page lists half-day camp for "
                "4-year-olds at $270/week, with a 10% member discount."
            )
        else:
            age_min = 4
            age_max = 11
            start_time = "09:30"
            end_time = None
            if is_four_day_week:
                price_min = 208.0
                price_max = 300.0
                price_note = (
                    "Official Dunwoody Nature Center summer-camp page lists 4-day-week pricing "
                    "at $208 for half-day age-4 camp and $300 for full-day rising K-5 camp, "
                    "with a 10% member discount."
                )
            else:
                price_min = 270.0
                price_max = 385.0
                price_note = (
                    "Official Dunwoody Nature Center summer-camp page lists half-day age-4 camp "
                    "at $270/week and full-day rising K-5 camp at $385/week, with a 10% member "
                    "discount."
                )

        rows.append(
            {
                "title": f"Dunwoody Nature Summer Camp: {title}",
                "description": _description_for_title(title),
                "source_url": SOURCE_URL,
                "ticket_url": REGISTER_URL,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": start_time,
                "end_time": end_time,
                "is_all_day": False,
                "age_min": age_min,
                "age_max": age_max,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "class_category": "outdoors",
                "tags": _derive_tags(title, age_min, age_max),
            }
        )

    rows.sort(key=lambda row: (row["start_date"], row["title"]))
    return rows


def _parse_rows_from_pdf() -> list[dict]:
    ignored_titles = {"Island Ford Campus"}
    pairs = extract_title_date_pairs_from_pdf(PDF_URL, ignored_titles=ignored_titles)
    return _rows_from_pairs(pairs)


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
        "extraction_confidence": 0.82,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(row["title"], PLACE_DATA["name"], row["start_date"]),
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
        rows = _parse_rows_from_pdf()
    except Exception as exc:
        logger.error("Dunwoody Summer Camp fetch failed: %s", exc)
        return 0, 0, 0

    venue_id = get_or_create_place(PLACE_DATA)
    today = date.today().strftime("%Y-%m-%d")

    for row in rows:
        if row["end_date"] < today:
            continue
        try:
            record = _build_event_record(source_id, venue_id, row)
            events_found += 1
            existing = find_event_by_hash(record["content_hash"])
            if existing:
                if smart_update_existing_event(existing["id"], record):
                    events_updated += 1
            else:
                if insert_event(record):
                    events_new += 1
        except Exception as exc:
            logger.warning("Failed to persist Dunwoody Summer Camp row %s: %s", row["title"], exc)

    logger.info(
        "Dunwoody Summer Camp: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
