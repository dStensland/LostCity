"""
Crawler for Callanwolde Creative Camps.

Official source:
https://callanwolde.org/classes/camps/

Pattern role:
Creative summer-camp landing page with weekly themes, dates, registration codes,
and one official registration destination.
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

SOURCE_URL = "https://callanwolde.org/classes/camps/"
REGISTER_URL = "https://campscui.active.com/orgs/CallanwoldeFineArtsCenter?orglink=camps-registration"

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
    "name": "Callanwolde Fine Arts Center",
    "slug": "callanwolde-fine-arts-center",
    "address": "980 Briarcliff Rd NE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7835,
    "lng": -84.3314,
    "neighborhood": "Druid Hills",
    "venue_type": "arts_center",
    "spot_type": "arts_center",
    "website": "https://callanwolde.org/",
    "vibes": ["family-friendly", "artsy", "educational"],
}

DATE_RE = re.compile(
    r"Dates:\s*"
    r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*[-–]\s*"
    r"(?P<end_month>[A-Za-z]+)?\s*(?P<end_day>\d{1,2})",
    re.IGNORECASE,
)
REG_CODE_RE = re.compile(r"Registration Code:\s*([A-Z]+\s*\d+)", re.IGNORECASE)

BASE_TAGS = [
    "camp",
    "family-friendly",
    "arts",
    "educational",
    "rsvp-required",
]


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _parse_dates(text: str, year: int = 2026) -> tuple[str, str]:
    match = DATE_RE.search(_clean_text(text))
    if not match:
        raise ValueError(f"Could not parse Callanwolde camp dates: {text}")
    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_dt = datetime.strptime(f"{start_month} {match.group('start_day')} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{end_month} {match.group('end_day')} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _display_week_label(start_date: str) -> str:
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    return start_dt.strftime("%B %-d")


def _derive_tags(text: str) -> list[str]:
    lowered = text.lower()
    tags = list(BASE_TAGS)
    if any(word in lowered for word in ["comic", "superhero", "myth", "legend"]):
        tags.append("storytelling")
    if any(word in lowered for word in ["animal", "sea", "aquatic"]):
        tags.append("animals")
    if any(word in lowered for word in ["artist", "art movements", "styles"]):
        tags.append("art-history")
    if any(word in lowered for word in ["mini", "miniature"]):
        tags.append("crafts")
    return list(dict.fromkeys(tags))


def _parse_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []

    for block in soup.select("div.fl-module-rich-text"):
        paragraphs = [_clean_text(p.get_text(" ", strip=True)) for p in block.find_all("p")]
        paragraphs = [text for text in paragraphs if text]
        if len(paragraphs) < 2:
            continue

        details_text = paragraphs[-1]
        if "Registration Code:" not in details_text or "Location:" not in details_text:
            continue

        description = " ".join(paragraphs[:-1])
        start_date, end_date = _parse_dates(details_text)
        reg_code_match = REG_CODE_RE.search(details_text)
        reg_code = reg_code_match.group(1).replace(" ", "") if reg_code_match else None

        title = f"Creative Camp Week of {_display_week_label(start_date)}"

        rows.append(
            {
                "title": f"Callanwolde Creative Camp: {title}",
                "description": description,
                "source_url": SOURCE_URL,
                "ticket_url": REGISTER_URL,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": None,
                "end_time": None,
                "is_all_day": True,
                "age_min": None,
                "age_max": None,
                "price_min": None,
                "price_max": None,
                "price_note": (
                    f"Official registration code {reg_code} on the Callanwolde camp page."
                    if reg_code
                    else "Official registration available on the Callanwolde camp page."
                ),
                "class_category": "arts",
                "tags": _derive_tags(description),
                "reg_code": reg_code,
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
        "extraction_confidence": 0.86,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(
            f"{row['title']} {row.get('reg_code') or ''}",
            PLACE_DATA["name"],
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
        logger.error("Callanwolde Creative Camps fetch failed: %s", exc)
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
                "Callanwolde Creative Camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
