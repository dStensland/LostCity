"""
Crawler for Atlanta Botanical Garden Camps.

Official source:
https://atlantabg.org/classes-education/garden-camps/

Pattern role:
Dedicated garden-camp page with named camp concepts, age-banded weekly sessions,
and explicit time and fee blocks.
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

SOURCE_URL = "https://atlantabg.org/classes-education/garden-camps/"

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
    "name": "Atlanta Botanical Garden",
    "slug": "atlanta-botanical-garden",
    "address": "1345 Piedmont Ave NE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "neighborhood": "Midtown",
    "lat": 33.7901,
    "lng": -84.3728,
    "venue_type": "garden",
    "spot_type": "garden",
    "website": "https://atlantabg.org/",
    "vibes": ["family-friendly", "outdoor", "educational"],
}

AGE_DATE_RE = re.compile(
    r"Ages?\s+(?P<age_min>\d+)\s*[-–]\s*(?P<age_max>\d+):\s*"
    r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*[-–]\s*(?P<end_day>\d{1,2})"
)
FEE_RE = re.compile(r"\$([0-9]+)/child\s*\(Members\s*\$([0-9]+)/child\)", re.IGNORECASE)

BASE_TAGS = [
    "camp",
    "family-friendly",
    "garden",
    "outdoor",
    "educational",
    "rsvp-required",
]


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _parse_dates(month: str, start_day: str, end_day: str, year: int = 2026) -> tuple[str, str]:
    start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 5:
        tags.append("preschool")
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 13 and age_max >= 10:
        tags.append("tween")
    return tags


def _derive_tags(title: str, age_min: int, age_max: int) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if "creative" in lowered or "garten" in lowered:
        tags.append("arts")
    if "snacks" in lowered:
        tags.extend(["food", "cooking"])
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _parse_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for heading in soup.find_all("h3"):
        title = _clean_text(heading.get_text(" ", strip=True))
        if title in {"Summer Camps", "Spring Break Camp"}:
            continue
        if title == "Garden Break Camp FAQs":
            break

        texts: list[str] = []
        sibling = heading.find_next_sibling()
        while sibling and sibling.name != "h3":
            if sibling.name == "div":
                for paragraph in sibling.find_all("p"):
                    text = _clean_text(paragraph.get_text(" ", strip=True))
                    if text:
                        texts.append(text)
            else:
                text = _clean_text(sibling.get_text(" ", strip=True))
                if text:
                    texts.append(text)
            sibling = sibling.find_next_sibling()

        description = next(
            (
                text
                for text in texts
                if not AGE_DATE_RE.search(text)
                and not text.startswith("Time")
                and not FEE_RE.search(text)
                and not text.startswith("MEMBER REGISTRATION")
                and not text.startswith("NON-MEMBER REGISTRATION")
                and "waitlist" not in text.lower()
            ),
            "",
        )

        fee_text = next((text for text in texts if FEE_RE.search(text)), "")
        fee_match = FEE_RE.search(fee_text)
        price_max = float(fee_match.group(1)) if fee_match else None
        price_min = float(fee_match.group(2)) if fee_match else None
        price_note = fee_text or "Official fee shown on the Atlanta Botanical Garden camp page."

        for text in texts:
            age_match = AGE_DATE_RE.search(text)
            if not age_match:
                continue
            age_min = int(age_match.group("age_min"))
            age_max = int(age_match.group("age_max"))
            start_date, end_date = _parse_dates(
                age_match.group("start_month"),
                age_match.group("start_day"),
                age_match.group("end_day"),
            )
            rows.append(
                {
                    "title": f"Atlanta Botanical Garden Camp: {title}",
                    "description": description,
                    "source_url": SOURCE_URL,
                    "ticket_url": SOURCE_URL,
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": "09:00",
                    "end_time": "16:00",
                    "is_all_day": False,
                    "age_min": age_min,
                    "age_max": age_max,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": price_note,
                    "class_category": "education",
                    "tags": _derive_tags(title, age_min, age_max),
                }
            )

    rows.sort(key=lambda row: (row["start_date"], row["title"], row["age_min"]))
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
        "content_hash": generate_content_hash(
            f"{row['title']} ages {row['age_min']}-{row['age_max']}",
            VENUE_DATA["name"],
            row["start_date"],
        ),
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
        logger.error("Atlanta Botanical Garden camps fetch failed: %s", exc)
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
                "Atlanta Botanical Garden camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
