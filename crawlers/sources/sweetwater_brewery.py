"""
Crawler for SweetWater Brewing Company (sweetwaterbrew.com).
West Midtown brewery with taproom, tours, and events.

Generates recurring Wednesday trivia events.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import (
    get_or_create_place,
    insert_event,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import TypedEntityEnvelope, SourceEntityCapabilities
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sweetwaterbrew.com"
WEEKS_AHEAD = 6

PLACE_DATA = {
    "name": "SweetWater Brewing Company",
    "slug": "sweetwater-brewing",
    "address": "195 Ottley Dr NE",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.7856,
    "lng": -84.3964,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["brewery", "taproom", "outdoor-seating", "tours", "live-music"],
}

WEEKLY_SCHEDULE = [
    {
        "day": 2,  # Wednesday
        "title": "Trivia at SweetWater Brewing",
        "description": (
            "Wednesday trivia night at SweetWater Brewing Company in West Midtown. "
            "Test your knowledge in the taproom of one of Atlanta's most popular breweries."
        ),
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "nightlife", "weekly", "brewery", "craft-beer"],
    },
]

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "venue_id": venue_id,
        "destination_type": "brewery",
        "commitment_tier": "hour",
        "primary_activity": "Atlanta's flagship brewery with taproom, tours, and outdoor space",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "outdoor-patio"],
        "parking_type": "free_lot",
        "best_time_of_day": "afternoon",
        "practical_notes": "Free parking. The taproom has 20+ beers on tap including seasonal and limited releases. Brewery tours available on select days. Large outdoor space with food trucks on weekends.",
        "accessibility_notes": "ADA accessible taproom. Tour route has stairs.",
        "family_suitability": "caution",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Free to visit taproom. Beer and food priced individually. Tour tickets sold separately.",
        "source_url": "https://sweetwaterbrew.com",
        "metadata": {"source_type": "venue_enrichment", "venue_type": "brewery", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "taproom-20-plus-beers",
        "title": "Taproom with 20+ beers on tap",
        "feature_type": "experience",
        "description": "SweetWater's flagship taproom with their full lineup plus seasonal and experimental brews available nowhere else.",
        "url": "https://sweetwaterbrew.com",
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "outdoor-space-food-trucks",
        "title": "Outdoor space and food trucks",
        "feature_type": "amenity",
        "description": "Large outdoor patio and green space with rotating food trucks, especially active on weekends.",
        "url": "https://sweetwaterbrew.com",
        "is_free": True,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "brewery-tours",
        "title": "Brewery tours",
        "feature_type": "experience",
        "description": "Guided tours of the brewing facility with tastings included.",
        "url": "https://sweetwaterbrew.com",
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "live-music-events",
        "title": "Live music and events",
        "feature_type": "experience",
        "description": "Regular live music in the taproom and outdoor space, plus the annual 420 Fest — SweetWater's flagship music festival.",
        "url": "https://sweetwaterbrew.com",
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "dog-friendly-patio",
        "title": "Dog-friendly patio",
        "feature_type": "amenity",
        "description": "Dogs welcome in the outdoor space — a staple of Atlanta brewery culture.",
        "url": "https://sweetwaterbrew.com",
        "is_free": True,
        "sort_order": 50,
    })
    return envelope


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure SweetWater Brewing venue and generate recurring trivia events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))
    logger.info(f"SweetWater Brewing venue record ensured (ID: {venue_id})")

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in WEEKLY_SCHEDULE:
        next_date = get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name.lower(),
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], PLACE_DATA["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template.get("subcategory"),
                "tags": template["tags"],
                "is_free": True,
                "price_min": None,
                "price_max": None,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} at SweetWater Brewing - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {template['title']} on {start_date}: {exc}")

    logger.info(
        f"SweetWater Brewing crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
