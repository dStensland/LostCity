"""
Crawler for Piedmont Park Conservancy EnviroVentures Camp.

Official source:
https://piedmontpark.org/camp/

Pattern role:
Public park summer camp page with weekly themes, published pricing, and a
separate park-leadership teen training program.
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
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://piedmontpark.org/camp/"

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
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7875,
    "lng": -84.3733,
    "place_type": "park",
    "spot_type": "outdoor",
    "website": "https://www.piedmontpark.org",
}

BASE_TAGS = [
    "camp",
    "family-friendly",
    "outdoor",
    "nature",
    "park",
    "rsvp-required",
]

THEME_HEADING_RE = re.compile(
    r"^(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*"
    r"(?P<end_month>[A-Za-z]+)?\s*(?P<end_day>\d{1,2}):\s*(?P<title>.+)$"
)
PRICE_RE = re.compile(r"Regular Rates:\s*\$([0-9]+)/week.*?\$([0-9]+)\s+per camper", re.I)
TRAINING_RE = re.compile(
    r"Monday,\s*(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})(?:st|nd|rd|th)?\s*[–-]\s*"
    r"Friday,\s*(?P<end_month>[A-Za-z]+)\s+(?P<end_day>\d{1,2})(?:st|nd|rd|th)?\s*from\s*"
    r"(?P<start_time>[0-9:APMapm ]+)\s*to\s*(?P<end_time>[0-9:APMapm ]+)",
    re.IGNORECASE,
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _parse_date_range(month_a: str, day_a: str, month_b: Optional[str], day_b: str, year: int = 2026) -> tuple[str, str]:
    end_month = month_b or month_a
    start_dt = datetime.strptime(f"{month_a} {day_a} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{end_month} {day_b} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 13 and age_max >= 10:
        tags.append("tween")
    if age_max >= 14:
        tags.append("teen")
    return tags


def _derive_tags(title: str, age_min: int, age_max: int) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if "wild" in lowered or "mammal" in lowered or "birds" in lowered or "bugs" in lowered:
        tags.append("animals")
    if "scientist" in lowered or "food" in lowered:
        tags.append("science")
    if "leadership" in lowered:
        tags.extend(["leadership", "service"])
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _extract_member_application_url(soup: BeautifulSoup) -> str:
    for anchor in soup.find_all("a", href=True):
        text = _clean_text(anchor.get_text(" ", strip=True)).lower()
        if "application" in text and "forms.office.com" in anchor["href"]:
            return anchor["href"]
    return SOURCE_URL


def _extract_base_price_note(text: str) -> tuple[float, float, str]:
    match = PRICE_RE.search(_clean_text(text))
    if match:
        regular_price = float(match.group(1))
        prorated_price = float(match.group(2))
    else:
        regular_price = 350.0
        prorated_price = 280.0
    return (
        regular_price,
        prorated_price,
        (
            "Regular rate is $350/week per camper; June 15-18 is prorated to $280. "
            "Piedmont Park Conservancy members at qualifying levels receive member pricing."
        ),
    )


def _parse_week_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    regular_price, prorated_price, price_note = _extract_base_price_note(soup.get_text(" ", strip=True))
    paragraphs = [p for p in soup.find_all("p")]
    rows: list[dict] = []
    i = 0
    while i < len(paragraphs):
        paragraph = paragraphs[i]
        heading = _clean_text(paragraph.find("strong").get_text(" ", strip=True)) if paragraph.find("strong") else ""
        if not heading:
            text = _clean_text(paragraph.get_text(" ", strip=True))
            heading = text if THEME_HEADING_RE.match(text) else ""
        match = THEME_HEADING_RE.match(heading)
        if not match:
            i += 1
            continue

        start_date, end_date = _parse_date_range(
            match.group("start_month"),
            match.group("start_day"),
            match.group("end_month"),
            match.group("end_day"),
        )
        title = _clean_text(match.group("title"))
        text = _clean_text(paragraph.get_text(" ", strip=True))
        description = _clean_text(text.replace(heading, "", 1))

        j = i + 1
        note_parts: list[str] = []
        while j < len(paragraphs):
            next_text = _clean_text(paragraphs[j].get_text(" ", strip=True))
            if not next_text:
                j += 1
                continue
            if THEME_HEADING_RE.match(next_text) or next_text.startswith("Camp Location:"):
                break
            if next_text.startswith("*4 DAY CAMP WEEK"):
                note_parts.append(next_text)
            elif not description:
                description = next_text
            else:
                break
            j += 1

        row_price = prorated_price if end_date == "2026-06-18" else regular_price
        full_note = price_note
        if note_parts:
            full_note = _clean_text(f"{price_note} {' '.join(note_parts)}")

        rows.append(
            {
                "title": f"EnviroVentures Summer Camp: {title}",
                "description": description,
                "source_url": SOURCE_URL,
                "ticket_url": SOURCE_URL,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": "09:00",
                "end_time": "16:00",
                "is_all_day": False,
                "age_min": 5,
                "age_max": 10,
                "price_min": row_price,
                "price_max": row_price,
                "price_note": full_note,
                "class_category": "outdoors",
                "tags": _derive_tags(title, 5, 10),
            }
        )
        i = j

    application_url = _extract_member_application_url(soup)
    full_text = _clean_text(soup.get_text(" ", strip=True))
    training_match = TRAINING_RE.search(full_text)
    if training_match:
        start_date, end_date = _parse_date_range(
            training_match.group("start_month"),
            training_match.group("start_day"),
            training_match.group("end_month"),
            training_match.group("end_day"),
        )
        rows.append(
            {
                "title": "Piedmont Park Leadership Team Training Week",
                "description": (
                    "Application-based park leadership training week for ages 14-17 "
                    "focused on service projects and year-round park ambassador work."
                ),
                "source_url": SOURCE_URL,
                "ticket_url": application_url,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": "13:00",
                "end_time": "17:00",
                "is_all_day": False,
                "age_min": 14,
                "age_max": 17,
                "price_min": 260.0,
                "price_max": 260.0,
                "price_note": "Official Piedmont Park Leadership Team fee is $260 for the training week.",
                "class_category": "leadership",
                "tags": _derive_tags("leadership", 14, 17),
            }
        )

    rows.sort(key=lambda row: (row["start_date"], row["title"]))
    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    return {
        "source_id": source_id,
        "place_id": venue_id,
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
        rows = _parse_week_rows(response.text)
    except Exception as exc:
        logger.error("Piedmont Park EnviroVentures fetch failed: %s", exc)
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
                smart_update_existing_event(existing, record)
                events_updated += 1
            else:
                insert_event(record)
                events_new += 1
        except Exception as exc:
            logger.error(
                "Piedmont Park EnviroVentures: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
