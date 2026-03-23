"""
Destination-first crawler for Round 1 Arcade Alpharetta.

Round 1 is a Japanese entertainment chain (arcade, bowling, karaoke,
billiards) at 1000 North Point Cir, Alpharetta. It has no event calendar
— the fully enriched venue record itself is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.round1usa.com/"

VENUE_DATA = {
    "name": "Round 1 Arcade Alpharetta",
    "slug": "round-1-arcade-alpharetta",
    "address": "1000 North Point Cir",
    "neighborhood": "Alpharetta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30022",
    "lat": 34.0675,
    "lng": -84.2755,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11
    "hours": {
        "monday": "10:00-00:00",
        "tuesday": "10:00-00:00",
        "wednesday": "10:00-00:00",
        "thursday": "10:00-00:00",
        "friday": "10:00-02:00",
        "saturday": "10:00-02:00",
        "sunday": "10:00-00:00",
    },
    "vibes": [
        "arcade",
        "bowling",
        "karaoke",
        "family-friendly",
        "groups",
        "japanese",
    ],
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "venue_id": venue_id,
        "destination_type": "entertainment",
        "commitment_tier": "halfday",
        "primary_activity": "Japanese arcade imports, bowling, karaoke, and billiards",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day", "climate-controlled"],
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "practical_notes": "Free mall parking at North Point Mall. All activities are indoors. Late-night hours on weekends (until 2 AM). Great selection of Japanese arcade imports not found elsewhere in Atlanta.",
        "accessibility_notes": "ADA accessible via mall entrance.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Pay-per-play arcade. Bowling, karaoke, and billiards charged per game/hour.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "venue_type": "entertainment", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "japanese-arcade-imports",
        "title": "Japanese arcade imports",
        "feature_type": "experience",
        "description": "Extensive collection of rhythm games, crane machines, and Japanese arcade exclusives not available at other Atlanta entertainment venues.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "bowling-lanes",
        "title": "Bowling lanes",
        "feature_type": "experience",
        "description": "Full-size bowling lanes with scoring systems and lane-side refreshments.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "private-karaoke-rooms",
        "title": "Private karaoke rooms",
        "feature_type": "experience",
        "description": "Private karaoke rooms with extensive song libraries in English, Japanese, Korean, and more.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "food-and-drink-bar",
        "title": "Food and drink bar",
        "feature_type": "amenity",
        "description": "On-site food counter and bar serving snacks, drinks, and Japanese-inspired menu items.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "weekday-early-play-discount",
        "title": "Weekday early-play discount",
        "description": "Discounted rates for bowling and select activities during early weekday hours.",
        "price_note": "Discounted weekday rates before evening.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "recurring_deal",
    })
    return envelope


def _extract_og_meta(html: str) -> tuple[Optional[str], Optional[str]]:
    """Return (og:image, og:description) from page HTML.

    Uses attrs= dict to avoid BeautifulSoup's name-parameter collision
    with the built-in ``name`` attribute lookup.
    """
    soup = BeautifulSoup(html, "lxml")

    og_image: Optional[str] = None
    tag = soup.find("meta", attrs={"property": "og:image"})
    if tag and tag.get("content"):  # type: ignore[union-attr]
        og_image = str(tag["content"])  # type: ignore[index]

    og_desc: Optional[str] = None
    for attr_dict in ({"property": "og:description"}, {"name": "description"}):
        tag = soup.find("meta", attrs=attr_dict)
        if tag and tag.get("content"):  # type: ignore[union-attr]
            og_desc = str(tag["content"])[:500]  # type: ignore[index]
            break

    return og_image, og_desc


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Round 1 Arcade Alpharetta has a fully enriched venue record.

    No events are crawled — the venue is open daily with no scheduled
    event calendar. The crawler upserts the venue and refreshes
    image/description from the live homepage on each run.
    """
    venue_data = dict(VENUE_DATA)

    try:
        resp = requests.get(
            HOMEPAGE,
            timeout=20,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        og_image, og_desc = _extract_og_meta(resp.text)
        if og_image:
            venue_data["image_url"] = og_image
        if og_desc:
            venue_data["description"] = og_desc
    except Exception as exc:
        logger.warning("Round 1 Arcade Alpharetta: og: enrichment failed: %s", exc)

    venue_id = get_or_create_venue(venue_data)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    update: dict = {}
    if venue_data.get("image_url"):
        update["image_url"] = venue_data["image_url"]
    if venue_data.get("description"):
        update["description"] = venue_data["description"]
    if update:
        try:
            get_client().table("venues").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning(
                "Round 1 Arcade Alpharetta: venue update failed: %s", exc
            )

    logger.info(
        "Round 1 Arcade Alpharetta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
