"""
Crawler for Blue Heron Nature Preserve Summer Camps.

Official source:
https://bhnp.org/summer-camps/

Pattern role:
Nature-preserve camp page with explicit week themes, age-track pricing, and
summer-camp descriptions for little-kid and older-kid tracks.
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
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

SOURCE_URL = "https://bhnp.org/summer-camps/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

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
    "name": "Blue Heron Nature Preserve",
    "slug": "blue-heron-nature-preserve",
    "address": "4055 Roswell Rd NE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.8756,
    "lng": -84.3784,
    "neighborhood": "Buckhead",
    "place_type": "park",
    "spot_type": "park",
    "website": "https://bhnp.org/",
    "vibes": ["family-friendly", "outdoor", "educational"],
}

BASE_TAGS = [
    "camp",
    "family-friendly",
    "nature",
    "outdoor",
    "educational",
    "rsvp-required",
]

THEME_LINE_RE = re.compile(
    r"^WEEK\s+\d+:\s*(?P<title>.+?)(?:,\s+|\s+)"
    r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})(?:st|nd|rd|th)?\s*-\s*"
    r"(?P<end_month>[A-Za-z]+)?\s*(?P<end_day>\d{1,2})(?:st|nd|rd|th)?$",
    re.IGNORECASE,
)
HALF_FULL_PRICE_RE = re.compile(
    r"Half Day.*?\$([0-9]+).*?Full Day.*?\$([0-9]+)",
    re.IGNORECASE,
)
FULL_DAY_PRICE_RE = re.compile(r"Full Day.*?\$([0-9]+)", re.IGNORECASE)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _parse_theme_line(value: str, year: int = 2026) -> tuple[str, str, str]:
    match = THEME_LINE_RE.match(_clean_text(value))
    if not match:
        raise ValueError(f"Could not parse Blue Heron theme line: {value}")
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
    return (
        _clean_text(match.group("title")),
        start_dt.strftime("%Y-%m-%d"),
        end_dt.strftime("%Y-%m-%d"),
    )


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 5:
        tags.append("preschool")
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 13 and age_max >= 10:
        tags.append("tween")
    return tags


def _derive_tags(track_label: str, title: str, age_min: int, age_max: int) -> list[str]:
    lowered = f"{track_label} {title}".lower()
    tags = list(BASE_TAGS)
    if "creek" in lowered:
        tags.extend(["water-play", "creek"])
    if "art" in lowered:
        tags.append("arts")
    if "wildlife" in lowered:
        tags.append("animals")
    if "wilderness" in lowered or "survivor" in lowered or "outdoor skills" in lowered:
        tags.extend(["adventure", "skills"])
    if "rocks" in lowered or "dirt" in lowered:
        tags.append("science")
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _extract_prices(soup: BeautifulSoup) -> dict[str, dict[str, Optional[float]]]:
    prices = {
        "little": {"price_min": 295.0, "price_max": 425.0},
        "great": {"price_min": 425.0, "price_max": 425.0},
    }
    little_heading = soup.find("h4", string=lambda text: text and "Little Blue Herons" in text)
    if little_heading:
        paragraph = little_heading.find_next("p")
        price_text = _clean_text(paragraph.get_text(" ", strip=True) if paragraph else "")
        match = HALF_FULL_PRICE_RE.search(price_text)
        if match:
            prices["little"] = {
                "price_min": float(match.group(1)),
                "price_max": float(match.group(2)),
            }

    great_heading = soup.find("h4", string=lambda text: text and "Great Blue Herons" in text)
    if great_heading:
        paragraph = great_heading.find_next("p")
        price_text = _clean_text(paragraph.get_text(" ", strip=True) if paragraph else "")
        match = FULL_DAY_PRICE_RE.search(price_text)
        if match:
            prices["great"] = {
                "price_min": float(match.group(1)),
                "price_max": float(match.group(1)),
            }
    return prices


def _build_row(
    *,
    track_label: str,
    age_min: int,
    age_max: int,
    title: str,
    description: str,
    start_date: str,
    end_date: str,
    price_min: Optional[float],
    price_max: Optional[float],
    price_note: str,
) -> dict:
    full_title = f"Blue Heron Summer Camp - {track_label}: {title}"
    return {
        "title": full_title,
        "description": _clean_text(description),
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
        "class_category": "outdoors",
        "tags": _derive_tags(track_label, title, age_min, age_max),
    }


def _parse_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    prices = _extract_prices(soup)
    rows: list[dict] = []
    mode: Optional[str] = None
    current_theme: Optional[dict] = None

    for element in soup.select("h2,h3,p"):
        text = _clean_text(element.get_text(" ", strip=True))
        if not text:
            continue

        if text == "Bringing Back the Favorites During June!":
            mode = "june"
            continue
        if text == "New and Exciting Themes in July!":
            mode = "july_little"
            continue
        if text == "New Opportunities at Great Blue Heron Outdoor Skills Camp!":
            mode = "july_great"
            continue

        if text.startswith("WEEK "):
            title, start_date, end_date = _parse_theme_line(text)
            current_theme = {
                "mode": mode,
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
            }
            continue

        if not current_theme:
            continue

        if element.name == "h3":
            continue

        description = text
        theme_title = current_theme["title"]
        if current_theme["mode"] == "june":
            rows.append(
                _build_row(
                    track_label="Little Blue Herons",
                    age_min=4,
                    age_max=6,
                    title=theme_title,
                    description=f"{description} Ages 4-6 at Blue Heron Nature Preserve.",
                    start_date=current_theme["start_date"],
                    end_date=current_theme["end_date"],
                    price_min=prices["little"]["price_min"],
                    price_max=prices["little"]["price_max"],
                    price_note=(
                        "Half day 9am-1pm $295/week; full day 9am-4pm $425/week "
                        "on the official Blue Heron Nature Preserve camp page."
                    ),
                )
            )
            rows.append(
                _build_row(
                    track_label="Great Blue Herons",
                    age_min=7,
                    age_max=12,
                    title=theme_title,
                    description=f"{description} Ages 7-12 at Blue Heron Nature Preserve.",
                    start_date=current_theme["start_date"],
                    end_date=current_theme["end_date"],
                    price_min=prices["great"]["price_min"],
                    price_max=prices["great"]["price_max"],
                    price_note="Full day 9am-4pm $425/week on the official Blue Heron Nature Preserve camp page.",
                )
            )
        elif current_theme["mode"] == "july_little":
            rows.append(
                _build_row(
                    track_label="Little Blue Herons",
                    age_min=4,
                    age_max=6,
                    title=theme_title,
                    description=f"{description} Ages 4-6 at Blue Heron Nature Preserve.",
                    start_date=current_theme["start_date"],
                    end_date=current_theme["end_date"],
                    price_min=prices["little"]["price_min"],
                    price_max=prices["little"]["price_max"],
                    price_note=(
                        "Half day 9am-1pm $295/week; full day 9am-4pm $425/week "
                        "on the official Blue Heron Nature Preserve camp page."
                    ),
                )
            )
        elif current_theme["mode"] == "july_great":
            rows.append(
                _build_row(
                    track_label="Great Blue Heron Outdoor Skills",
                    age_min=7,
                    age_max=12,
                    title=theme_title,
                    description=f"{description} Outdoor Skills Camp for ages 7-12 at Blue Heron Nature Preserve.",
                    start_date=current_theme["start_date"],
                    end_date=current_theme["end_date"],
                    price_min=prices["great"]["price_min"],
                    price_max=prices["great"]["price_max"],
                    price_note="Full day 9am-4pm $425/week on the official Blue Heron Nature Preserve camp page.",
                )
            )
        current_theme = None

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


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "nature_preserve",
            "commitment_tier": "halfday",
            "primary_activity": "family nature preserve visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["outdoor", "nature-play", "family-daytrip", "heat-day"],
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Blue Heron works best as a slower Buckhead outdoor stop for families who want trails, creek-side nature play, and camp-day familiarity rather than a highly programmed attraction."
            ),
            "accessibility_notes": (
                "The preserve is easiest for families comfortable with uneven natural surfaces and shorter trail segments, not for families expecting fully paved park-style circulation."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Preserve access is destination-first outdoor space; camps and scheduled programs are priced separately.",
            "source_url": "https://bhnp.org/",
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "park",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "wetlands-trails-and-creekside-nature-play",
            "title": "Wetlands trails and creekside nature play",
            "feature_type": "amenity",
            "description": "Blue Heron combines preserve trails, water-adjacent exploration, and a more nature-first feel than a standard neighborhood park stop.",
            "url": "https://bhnp.org/",
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "nature-camps-and-kid-discovery-programming",
            "title": "Nature camps and kid discovery programming",
            "feature_type": "amenity",
            "description": "Its camp and kids-programming pattern makes Blue Heron stronger as a repeat family nature destination than a passive preserve-only stop.",
            "url": SOURCE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "buckhead-outdoor-reset-with-real-nature-feel",
            "title": "Buckhead outdoor reset with real nature feel",
            "feature_type": "amenity",
            "description": "Blue Heron is strongest as a lower-intensity outdoor reset when families want actual nature texture without leaving the city core.",
            "url": "https://bhnp.org/",
            "is_free": False,
            "sort_order": 30,
        },
    )
    return envelope


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
        logger.error("Blue Heron summer camps fetch failed: %s", exc)
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
                smart_update_existing_event(existing, record)
                events_updated += 1
            else:
                insert_event(record)
                events_new += 1
        except Exception as exc:
            logger.error(
                "Blue Heron summer camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
