"""
Crawler for Diventures Alpharetta swim lessons.

Official source:
https://www.diventures.com/locations/atlanta/swim/

Pattern role:
Recurring swim/location implementation using a public location page with
lesson-family cards, public pricing, age guidance, and location-specific class
discovery flows.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta
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

SOURCE_URL = "https://www.diventures.com/locations/atlanta/swim/"
CLASS_FINDER_URL = "https://www.diventures.com/swim/find-a-class/?loc=Alpharetta"
WEEKS_AHEAD = 6

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

BASE_TAGS = [
    "family-friendly",
    "swimming",
    "class",
    "rsvp-required",
    "weekly",
]

LESSON_CARD_TITLES = {
    "Baby & toddler swim lessons",
    "Child swim lessons",
    "Adult swim lessons",
    "Private swim lessons",
}

PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def _extract_venue_data(soup: BeautifulSoup) -> dict:
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            payload = json.loads(script.string or "")
        except Exception:
            continue
        if payload.get("@type") != "LocalBusiness":
            continue
        address = payload.get("address") or {}
        geo = payload.get("geo") or {}
        return {
            "name": "Diventures - Alpharetta",
            "slug": "diventures-alpharetta",
            "address": address.get("streetAddress"),
            "city": address.get("addressLocality"),
            "state": address.get("addressRegion"),
            "zip": address.get("postalCode"),
            "lat": geo.get("latitude"),
            "lng": geo.get("longitude"),
            "neighborhood": "Alpharetta",
            "place_type": "fitness_center",
            "spot_type": "fitness",
            "website": SOURCE_URL,
            "phone": payload.get("telephone"),
        }
    raise ValueError("Diventures LocalBusiness schema not found")


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []

    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    tags: list[str] = []
    if lo <= 1:
        tags.append("infant")
    if lo <= 2 and hi >= 1:
        tags.append("toddler")
    if lo <= 5 and hi >= 3:
        tags.append("preschool")
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 13 and hi >= 10:
        tags.append("tween")
    if hi >= 16 or lo >= 16:
        tags.append("adult")
    return tags


def _parse_price_fields(
    text: str, title: str
) -> tuple[Optional[float], Optional[float], Optional[str]]:
    cleaned = _clean_text(text)
    matches = [float(item) for item in PRICE_RE.findall(cleaned)]
    if not matches:
        return None, None, cleaned or None
    lowered = cleaned.lower()
    if "registration fee" in lowered and "private" not in title.lower():
        return matches[0], matches[0], cleaned
    if "semiprivate" in lowered:
        return min(matches), max(matches), cleaned
    if len(matches) == 1:
        return matches[0], matches[0], None
    return min(matches), max(matches), cleaned


def _derive_age_range(
    title: str, description: str
) -> tuple[Optional[int], Optional[int], list[str], Optional[str]]:
    combined = f"{title} {description}".lower()

    if "adult swim lessons" in title.lower():
        return 16, None, _age_band_tags(16, 18), "16+ years"
    if "two months to 35 months" in combined:
        return 0, 2, _age_band_tags(0, 2), "2-35 months"
    if "3-year-old" in combined and "15-year-old" in combined:
        return 3, 15, _age_band_tags(3, 15), "3-15 years"
    if "16 years and older" in combined:
        return 16, None, _age_band_tags(16, 18), "16+ years"
    if "no age cap" in combined:
        return 3, None, _age_band_tags(3, 18), "All ages"

    return None, None, [], None


def _derive_tags(title: str, age_tags: list[str]) -> list[str]:
    tags = BASE_TAGS + age_tags + ["fitness"]
    lowered = title.lower()
    if "private" in lowered:
        tags.append("private-lessons")
    if "adult" in lowered:
        tags.append("adult")
    if "child" in lowered or "baby" in lowered:
        tags.append("kids")
    return list(dict.fromkeys(tags))


def _extract_lesson_rows(soup: BeautifulSoup) -> list[dict]:
    rows: list[dict] = []

    for container in soup.select(".et_pb_blurb_container"):
        title_node = container.find("h3")
        description_wrap = container.find(
            "div", class_=re.compile(r"et_pb_blurb_description")
        )
        if not title_node or not description_wrap:
            continue

        title = _clean_text(title_node.get_text(" ", strip=True))
        if title not in LESSON_CARD_TITLES:
            continue

        detail_button = None
        wrapper = container.find_parent(class_=re.compile(r"et_pb_column"))
        if wrapper:
            next_button = wrapper.find_next("a", class_=re.compile(r"et_pb_button"))
            if next_button and next_button.get("href"):
                detail_button = next_button["href"]

        strong_text = _clean_text(
            " ".join(
                node.get_text(" ", strip=True)
                for node in description_wrap.find_all("strong")
            )
        )
        description_paragraphs = [
            _clean_text(p.get_text(" ", strip=True))
            for p in description_wrap.find_all("p")
            if _clean_text(p.get_text(" ", strip=True))
        ]
        description = description_paragraphs[-1] if description_paragraphs else ""
        price_text = _clean_text(
            " ".join(part for part in [strong_text, description] if part)
        )
        price_min, price_max, price_note = _parse_price_fields(price_text, title)
        age_min, age_max, age_tags, age_label = _derive_age_range(title, description)

        rows.append(
            {
                "title": title,
                "detail_url": (
                    requests.compat.urljoin(SOURCE_URL, detail_button)
                    if detail_button
                    else SOURCE_URL
                ),
                "ticket_url": CLASS_FINDER_URL,
                "description": description,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note or strong_text or None,
                "age_min": age_min,
                "age_max": age_max,
                "age_label": age_label,
                "tags": _derive_tags(title, age_tags),
            }
        )

    return rows


def _build_description(row: dict, venue: dict) -> str:
    parts = [
        f"{row['title']} at Diventures {venue['neighborhood']}.",
        row["description"],
    ]
    if row.get("age_label"):
        parts.append(f"Age fit: {row['age_label']}.")
    if row.get("price_note"):
        parts.append(f"Pricing: {row['price_note']}.")
    if venue.get("phone"):
        parts.append(f"Call {venue['phone']} for questions.")
    return _clean_text(" ".join(parts))[:1000]


def _build_event_record(
    source_id: int, venue_id: int, venue: dict, row: dict, start_date: str
) -> dict:
    title = f"{row['title']} at Diventures ({venue['neighborhood']})"
    description = _build_description(row, venue)
    record = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": None,
        "end_date": None,
        "end_time": None,
        "is_all_day": False,
        "category": "fitness",
        "subcategory": "fitness.swim",
        "tags": row["tags"],
        "is_free": False,
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "source_url": row["detail_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{title} | {row['description']}",
        "extraction_confidence": 0.89,
        "is_recurring": True,
        "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
        "content_hash": generate_content_hash(title, venue["name"], start_date),
        "is_class": True,
        "class_category": "fitness",
    }
    if row.get("age_min") is not None:
        record["age_min"] = row["age_min"]
    if row.get("age_max") is not None:
        record["age_max"] = row["age_max"]
    return record


def _next_start_dates() -> list[str]:
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until_sat = (5 - today.weekday()) % 7
    if days_until_sat == 0:
        days_until_sat = 7
    first_saturday = today + timedelta(days=days_until_sat)
    return [
        (first_saturday + timedelta(weeks=offset)).strftime("%Y-%m-%d")
        for offset in range(WEEKS_AHEAD)
    ]


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    try:
        response = session.get(SOURCE_URL, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.error(
            "Diventures Alpharetta Swim: failed to fetch location page: %s", exc
        )
        return 0, 0, 0

    soup = BeautifulSoup(response.text, "html.parser")
    venue = _extract_venue_data(soup)
    venue_id = get_or_create_place(venue)
    rows = _extract_lesson_rows(soup)

    logger.info(
        "Diventures Alpharetta Swim: parsed %s recurring lesson rows", len(rows)
    )

    for row in rows:
        for start_date in _next_start_dates():
            try:
                record = _build_event_record(
                    source_id, venue_id, venue, row, start_date
                )
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
                    "Diventures Alpharetta Swim: failed to process %s (%s): %s",
                    row.get("title"),
                    start_date,
                    exc,
                )

    return events_found, events_new, events_updated
