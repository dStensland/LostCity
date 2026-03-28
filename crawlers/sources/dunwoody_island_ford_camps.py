"""
Crawler for Dunwoody Nature Center's Island Ford summer camps.

Official sources:
https://dunwoodynature.org/education/island-ford-2026/
https://dunwoodynature.org/wp-content/uploads/Island-Ford-2026-1.pdf.pdf

Pattern role:
Dedicated older-kid camp page plus public PDF with dated weekly themes.
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
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from sources._dunwoody_camp_pdf import extract_title_date_pairs_from_pdf

logger = logging.getLogger(__name__)

SOURCE_URL = "https://dunwoodynature.org/education/island-ford-2026/"
PDF_URL = "https://dunwoodynature.org/wp-content/uploads/Island-Ford-2026-1.pdf.pdf"
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
    "name": "Island Ford - Chattahoochee River National Recreation Area",
    "slug": "island-ford-chattahoochee-river-national-recreation-area",
    "address": "8800 Roberts Dr",
    "city": "Sandy Springs",
    "state": "GA",
    "zip": "30350",
    "lat": 34.0056,
    "lng": -84.3672,
    "neighborhood": "Sandy Springs",
    "venue_type": "park",
    "spot_type": "park",
    "website": "https://dunwoodynature.org/education/island-ford-2026/",
    "vibes": ["family-friendly", "outdoor", "educational"],
}

DATE_RE = re.compile(
    r"^(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*"
    r"(?:(?P<end_month>[A-Za-z]+)\s+)?(?P<end_day>\d{1,2})$"
)

BASE_TAGS = [
    "camp",
    "family-friendly",
    "nature",
    "outdoor",
    "educational",
    "rsvp-required",
    "tween",
]

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "park",
            "commitment_tier": "halfday",
            "primary_activity": "family river park visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "practical_notes": (
                "Island Ford works best as a shorter half-day river-and-trails outing where families can choose a manageable loop and layer in pond or river exploration without committing to a full destination day."
            ),
            "accessibility_notes": (
                "Island Ford is strongest for families comfortable with natural surfaces and trail-based movement, not for families expecting fully paved circulation or compact indoor backup spaces."
            ),
            "fee_note": "Open park access and special camp programming can have different pricing or registration requirements.",
            "source_url": SOURCE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": PLACE_DATA.get("venue_type"),
                "city": "sandy springs",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "river-and-pond-exploration",
            "title": "River and pond exploration",
            "feature_type": "experience",
            "description": "Island Ford's official camp materials emphasize river exploration, pond canoeing, and hands-on outdoor activities for older kids and families.",
            "url": SOURCE_URL,
            "price_note": "Some guided experiences and camp sessions require separate registration.",
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "forest-trails-and-outdoor-adventure",
            "title": "Forest trails and outdoor adventure",
            "feature_type": "amenity",
            "description": "Hiking trails and adventure-oriented outdoor programming make Island Ford a strong Family micro-adventure destination in close metro.",
            "url": SOURCE_URL,
            "price_note": "Trail access and organized programming vary by site rules and schedule.",
            "is_free": True,
            "sort_order": 20,
        },
    )
    return envelope


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-").replace("’", "'")
    return re.sub(r"\s+", " ", value).strip()


def _parse_date_line(value: str, year: int = 2026) -> tuple[str, str]:
    match = DATE_RE.match(_clean_text(value))
    if not match:
        raise ValueError(f"Could not parse Island Ford camp date line: {value}")
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


def _derive_tags(title: str) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if any(word in lowered for word in ["ranger", "trail", "trekker"]):
        tags.append("hiking")
    if any(word in lowered for word in ["water", "river", "canoe"]):
        tags.extend(["water-play", "river"])
    if any(word in lowered for word in ["animal", "bird", "scales", "slime"]):
        tags.append("animals")
    if any(word in lowered for word in ["legend", "myth"]):
        tags.append("storytelling")
    return list(dict.fromkeys(tags))


def _description_for_title(title: str) -> str:
    return (
        f"{title} is part of Dunwoody Nature Center's Island Ford summer-camp lineup "
        "at the Chattahoochee River National Recreation Area, with hiking, river and "
        "pond exploration, and older-kid outdoor adventure."
    )


def _rows_from_pairs(pairs: list[tuple[str, str]]) -> list[dict]:
    rows: list[dict] = []
    for title, date_line in pairs:
        start_date, end_date = _parse_date_line(date_line)
        rows.append(
            {
                "title": f"Island Ford Summer Camp: {title}",
                "description": _description_for_title(title),
                "source_url": SOURCE_URL,
                "ticket_url": REGISTER_URL,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": "09:00",
                "end_time": "16:00",
                "is_all_day": False,
                "age_min": 9,
                "age_max": 13,
                "price_min": 422.0,
                "price_max": 422.0,
                "price_note": (
                    "Official Island Ford camp page lists $422/week for ages 9-13, "
                    "with a 10% member discount."
                ),
                "class_category": "outdoors",
                "tags": _derive_tags(title),
            }
        )

    rows.sort(key=lambda row: (row["start_date"], row["title"]))
    return rows


def _parse_rows_from_pdf() -> list[dict]:
    pairs = extract_title_date_pairs_from_pdf(PDF_URL, ignored_titles={"Island Ford Campus"})
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
        "extraction_confidence": 0.88,
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
        logger.error("Island Ford Summer Camps fetch failed: %s", exc)
        return 0, 0, 0

    venue_id = get_or_create_place(PLACE_DATA)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))
    today = date.today().strftime("%Y-%m-%d")

    for row in rows:
        if row["end_date"] < today:
            continue
        try:
            record = _build_event_record(source_id, venue_id, row)
            events_found += 1
            existing = find_event_by_hash(record["content_hash"])
            if existing:
                if smart_update_existing_event(existing, record):
                    events_updated += 1
            else:
                if insert_event(record):
                    events_new += 1
        except Exception as exc:
            logger.warning("Failed to persist Island Ford row %s: %s", row["title"], exc)

    logger.info(
        "Island Ford Summer Camps: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
