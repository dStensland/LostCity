"""
Crawler for Chastain Park Conservancy (chastainparkconservancy.org).

Chastain Park Conservancy is the nonprofit steward for Chastain Park, one of
Atlanta's most important in-city family park destinations. The official site
provides strong destination signal plus a small set of public park events:

  - park amenities and family-use features on the "About The Park" page
  - flagship conservancy events on the "Our Events" page
  - workshops and calendar entries on the public calendar page

This crawler treats Chastain as a destination-first Family park source while
capturing only the public, clearly attributable events from the conservancy's
own pages.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://chastainparkconservancy.org"
ABOUT_URL = f"{BASE_URL}/elementor-page-2363/"
CALENDAR_URL = f"{BASE_URL}/calendar/"
EVENTS_URL = f"{BASE_URL}/events-test/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

PLACE_DATA = {
    "name": "Chastain Park Conservancy",
    "slug": "chastain-park-conservancy",
    "address": "4001 Powers Ferry Rd NW",
    "neighborhood": "Chastain Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.8664598,
    "lng": -84.3894217,
    "place_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
    "description": (
        "Chastain Park Conservancy helps keep Chastain Park clean, safe, and green "
        "through park care, sustainability work, family-friendly public space, and "
        "community programming."
    ),
    "vibes": ["family-friendly", "outdoor", "parking", "dog-friendly"],
}

_OUR_EVENTS_PATTERNS = (
    (
        "Wine Chastain",
        r"Wine Chastain\s+([A-Za-z]+\s+\d{1,2})\s+(.*?)\s+Tickets Now Available",
        "fundraiser",
    ),
    (
        "Home & Garden Tour",
        r"Home & Garden Tour\s+([A-Za-z]+\s+\d{1,2})\s+(.*?)\s+Register",
        "tour",
    ),
)

_CALENDAR_EVENT_RE = re.compile(
    r"(CPC[A\- ]|CPCA\-)\s*([A-Za-z0-9'&().,\- ]+?)\s+"
    r"(?:CPC[A\- ]|CPCA\-)\s*[A-Za-z0-9'&().,\- ]+?\s+"
    r"([A-Za-z]+\s+\d{1,2},\s+\d{4})\s+"
    r"(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)\s+"
    r"(.+?)\s+See more details",
    re.IGNORECASE,
)


def _parse_time(value: str) -> Optional[str]:
    try:
        return datetime.strptime(value.strip().lower(), "%I:%M %p").strftime("%H:%M")
    except ValueError:
        return None


def _parse_month_day(value: str) -> Optional[str]:
    for fmt in ("%B %d, %Y", "%B %d"):
        try:
            parsed = datetime.strptime(value.strip(), fmt)
            if fmt == "%B %d":
                parsed = parsed.replace(year=datetime.now().year)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _normalize_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    return " ".join(soup.get_text(" ", strip=True).split())


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "park",
            "commitment_tier": "halfday",
            "primary_activity": "family park visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "parking_type": "free_lot",
            "practical_notes": (
                "The conservancy's park overview highlights playgrounds, walking trails, "
                "green space, pavilions, an outdoor classroom, and an on-site swimming pool. "
                "That mix makes Chastain work well for family meetups, stroller loops, and longer park sessions. "
                "It is strongest when used as a slower, spread-out park day rather than a single fixed attraction."
            ),
            "accessibility_notes": (
                "The newer playground and path network are the lowest-friction family entry points; "
                "recreation fields and larger park terrain vary by destination inside the park. The mix of lawns, pavilions, "
                "and paths makes it easier to adapt around energy, shade, and group size."
            ),
            "fee_note": "Open park access is free; some conservancy events, tours, and activity areas can carry separate costs.",
            "source_url": ABOUT_URL,
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
            "slug": "playground-and-open-green-space",
            "title": "Playground and open green space",
            "feature_type": "amenity",
            "description": "Chastain Park's official park overview explicitly calls out playgrounds and broad green space, making it a strong in-city free family park option.",
            "url": ABOUT_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "walking-trails-and-path-loops",
            "title": "Walking trails and path loops",
            "feature_type": "experience",
            "description": "Walking trails and path-style circulation make Chastain useful for stroller loops, easy movement, and low-friction outdoor family time.",
            "url": ABOUT_URL,
            "is_free": True,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "athletic-swimming-pool-and-summer-aquatics",
            "title": "Athletic swimming pool and summer aquatics",
            "feature_type": "amenity",
            "description": "The conservancy's official park overview explicitly lists an athletic swimming pool, giving families a seasonal water-play and swim option inside the broader park visit.",
            "url": ABOUT_URL,
            "price_note": "Pool access and seasonal aquatics details vary by operating schedule.",
            "is_free": False,
            "sort_order": 25,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "outdoor-classroom-and-park-programs",
            "title": "Outdoor classroom and park programs",
            "feature_type": "amenity",
            "description": "The conservancy's official park materials include an outdoor classroom and public community programming, which makes Chastain more than a passive green-space stop.",
            "url": CALENDAR_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "slow-pace-meetup-park-day",
            "title": "Slow-pace meetup park day",
            "feature_type": "amenity",
            "description": "Chastain is especially good for meetups and longer family park sessions where the day needs room for shade, sitting, and moving between multiple activity zones.",
            "url": ABOUT_URL,
            "is_free": True,
            "sort_order": 35,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "family-meetup-lawns-and-pavilion-space",
            "title": "Family meetup lawns and pavilion space",
            "feature_type": "amenity",
            "description": "The conservancy's park overview calls out green space and pavilion-style gathering areas, which makes Chastain one of the easier in-city parks for longer family meetups.",
            "url": ABOUT_URL,
            "is_free": True,
            "sort_order": 35,
        },
    )
    return envelope


def _extract_our_events(html: str) -> list[dict]:
    text = _normalize_text(html)
    results: list[dict] = []

    for title, pattern, subcategory in _OUR_EVENTS_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        date_text = match.group(1)
        description = match.group(2).strip()
        start_date = _parse_month_day(date_text)
        if not start_date:
            continue
        results.append(
            {
                "title": title,
                "start_date": start_date,
                "start_time": None,
                "end_time": None,
                "description": description[:700],
                "subcategory": subcategory,
                "source_url": EVENTS_URL,
                "ticket_url": EVENTS_URL,
                "is_free": False,
                "tags": ["chastain-park", "community", "park"],
            }
        )
    return results


def _extract_calendar_events(html: str) -> list[dict]:
    text = _normalize_text(html)
    results: list[dict] = []
    for match in _CALENDAR_EVENT_RE.finditer(text):
        title = re.sub(r"^\W+", "", match.group(2).strip())
        start_date = _parse_month_day(match.group(3))
        if not start_date:
            continue
        location = match.group(6).strip()
        description = location
        tags = ["chastain-park", "community", "park"]
        title_lower = title.lower()
        subcategory = "workshop"
        is_free = True
        if "workshop" in title_lower:
            tags.append("workshop")
        if "garden" in title_lower or "meadow" in title_lower:
            tags.append("gardening")
        if "egg hunt" in title_lower:
            tags.extend(["family-friendly", "holiday"])
            subcategory = "family"
        results.append(
            {
                "title": f"Chastain Park {title}",
                "start_date": start_date,
                "start_time": _parse_time(match.group(4)),
                "end_time": _parse_time(match.group(5)),
                "description": description[:700],
                "subcategory": subcategory,
                "source_url": CALENDAR_URL,
                "ticket_url": CALENDAR_URL,
                "is_free": is_free,
                "tags": tags,
            }
        )
    return results


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    try:
        events_html = requests.get(EVENTS_URL, timeout=30, headers=HEADERS)
        events_html.raise_for_status()
        calendar_html = requests.get(CALENDAR_URL, timeout=30, headers=HEADERS)
        calendar_html.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Chastain Park Conservancy: failed to fetch source pages: %s", exc)
        raise

    parsed_events: list[dict] = []
    parsed_events.extend(_extract_our_events(events_html.text))
    parsed_events.extend(_extract_calendar_events(calendar_html.text))

    seen_hashes: set[str] = set()
    for item in parsed_events:
        content_hash = generate_content_hash(item["title"], PLACE_DATA["name"], item["start_date"])
        if content_hash in seen_hashes:
            continue
        seen_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": item["title"],
            "description": item["description"],
            "start_date": item["start_date"],
            "start_time": item["start_time"],
            "end_date": None,
            "end_time": item["end_time"],
            "is_all_day": False,
            "category": "community",
            "subcategory": item["subcategory"],
            "tags": item["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": item["is_free"],
            "source_url": item["source_url"],
            "ticket_url": item["ticket_url"],
            "image_url": PLACE_DATA.get("image_url"),
            "raw_text": item["description"],
            "extraction_confidence": 0.75,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
        except Exception as exc:
            logger.error("Chastain Park Conservancy: failed to insert %s: %s", item["title"], exc)

    logger.info(
        "Chastain Park Conservancy crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
