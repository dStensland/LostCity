"""
Destination-first crawler for Medieval Times Atlanta (Lawrenceville).

Dinner theater with live jousting tournaments. No event calendar needed —
shows run on a fixed schedule. The enriched venue record is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.medievaltimes.com/plan-your-trip/atlanta-ga"

PLACE_DATA = {
    "name": "Medieval Times Atlanta",
    "slug": "medieval-times-atlanta",
    "address": "5900 Sugarloaf Pkwy",
    "neighborhood": "Lawrenceville",
    "city": "Lawrenceville",
    "state": "GA",
    "zip": "30043",
    "lat": 33.9595,
    "lng": -84.0722,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    "vibes": ["family-friendly", "dinner-theater", "unique-experience", "interactive", "groups"],
    "description": (
        "Medieval Times is an interactive dinner theater where guests feast on a four-course meal "
        "while watching a live jousting tournament with six competing knights. Located in Lawrenceville, "
        "the castle also features a Hall of Arms exhibit and falcon demonstrations before the show."
    ),
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
        "destination_type": "dinner_theater",
        "commitment_tier": "halfday",
        "primary_activity": "Live jousting tournament dinner show",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day", "climate-controlled"],
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "practical_notes": (
            "Free parking at Sugarloaf Mills. Arrive 75 minutes early for the Hall of Arms "
            "pre-show experience and bar access. You eat with your hands — no utensils! "
            "Shows run on a fixed schedule, typically evenings and weekend matinees. "
            "Book online for best pricing."
        ),
        "accessibility_notes": "ADA accessible seating available. Contact venue in advance for specific accommodations.",
        "family_suitability": "yes",
        "reservation_required": True,
        "permit_required": False,
        "fee_note": "All-inclusive ticket covers show and four-course dinner. Upgrades available.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "venue_type": "entertainment", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "live-jousting-tournament",
        "title": "Live jousting tournament with 6 knights",
        "feature_type": "experience",
        "description": (
            "A 2-hour live show featuring six knights on horseback competing in jousting, "
            "sword fights, and horsemanship — performed in an 11th-century-style arena."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "four-course-dinner",
        "title": "Four-course dinner — eat with your hands",
        "feature_type": "amenity",
        "description": (
            "A four-course feast of garlic bread, tomato bisque, roasted chicken, corn, and pastry "
            "— all eaten medieval-style without utensils."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "hall-of-arms-falcons",
        "title": "Pre-show Hall of Arms and falcon demonstrations",
        "feature_type": "experience",
        "description": (
            "Arrive early to explore the Hall of Arms museum exhibit and watch live falcon "
            "demonstrations before the tournament begins."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "birthday-celebration-packages",
        "title": "Birthday celebration packages",
        "description": "Special birthday packages with recognition during the show and commemorative items.",
        "price_note": "Birthday packages available as add-on to standard tickets.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "recurring_deal",
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "royalty-upgrade",
        "title": "Royalty upgrade — premium seating",
        "description": "Upgrade to front-row seating with a commemorative crown, program, and champagne toast.",
        "price_note": "Premium upgrade pricing on top of standard ticket.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "admission",
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
    """Ensure Medieval Times Atlanta has a fully enriched venue record.

    No events are crawled — shows run on a fixed schedule with no separate
    event calendar to parse. The crawler's sole job is to upsert the venue
    and refresh image/description from the live homepage on each run.
    """
    place_data = dict(PLACE_DATA)

    # Fetch og: metadata from the live homepage to keep the record fresh.
    try:
        resp = requests.get(
            HOMEPAGE,
            timeout=20,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        og_image, og_desc = _extract_og_meta(resp.text)
        if og_image:
            place_data["image_url"] = og_image
        if og_desc:
            place_data["description"] = og_desc
    except Exception as exc:
        logger.warning("Medieval Times Atlanta: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    # Push the freshest image/description back onto the existing venue row.
    update: dict = {}
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    if update:
        try:
            get_client().table("venues").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Medieval Times Atlanta: venue update failed: %s", exc)

    logger.info(
        "Medieval Times Atlanta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
