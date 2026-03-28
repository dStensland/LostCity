"""
Crawler for Callanwolde Fine Arts Center (callanwolde.org).

Callanwolde is a DeKalb County arts center housed in a 1920 Tudor Revival
mansion on Briarcliff Road. It runs a year-round calendar of:
  - Studio arts classes (pottery, drawing, jewelry, blacksmithing, textiles,
    photography, writing)
  - Dance programs (adult and children's — ballet, tap, salsa, jazz)
  - Gallery exhibitions and opening receptions
  - Outdoor concert series (Jazz on the Lawn, Spring Concert Series)
  - Special events

With ~1,300 future events this is a high-volume source for long-tail art and
learning content that covers Druid Hills / Virginia-Highland audiences.

Previously used a Playwright HTML scraper that missed ~95% of events. This
version uses the Tribe Events Calendar REST API — no browser needed.
"""

from __future__ import annotations

from db import get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from sources._tribe_events_base import TribeConfig, crawl_tribe

_BASE_URL = "https://callanwolde.org"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

_VENUE_DATA = {
    "name": "Callanwolde Fine Arts Center",
    "slug": "callanwolde-fine-arts-center",
    "address": "980 Briarcliff Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7872,
    "lng": -84.3407,
    "venue_type": "arts_center",
    "spot_type": "arts_center",
    "website": _BASE_URL,
    "vibes": ["artsy", "family-friendly", "historic", "all-ages"],
}

_CONFIG = TribeConfig(
    base_url=_BASE_URL,
    place_data=_VENUE_DATA,
    default_category="art",
    default_tags=["arts-center"],
    future_only=True,
    # "winter-house" is the container category — skip it to avoid creating
    # a no-date wrapper event.  Keep wh-events and wh-santa so the real
    # Winter House programming (workshops, Santa photos, performances) flows in.
    skip_category_slugs=["winter-house"],
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "arts_center",
            "commitment_tier": "halfday",
            "primary_activity": "family arts center visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["outdoor-indoor-mix", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "Callanwolde works best as a slower-paced arts campus stop, especially when families want a class, exhibition, or lawn event rather than a single short museum visit."
            ),
            "accessibility_notes": (
                "Its historic-campus format means more walking than a compact indoor arts stop, but the grounds-and-building mix makes it easier to break the visit into smaller pieces."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Many classes, camps, and performances are ticketed; some grounds-based events and community programming vary by season.",
            "source_url": _BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "arts_center",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "historic-arts-campus-and-grounds",
            "title": "Historic arts campus and grounds",
            "feature_type": "amenity",
            "description": "Callanwolde combines a historic mansion campus with creative programming, which makes it feel more like a family arts outing than a single-room class venue.",
            "url": _BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "family-classes-camps-and-arts-events",
            "title": "Family classes, camps, and arts events",
            "feature_type": "amenity",
            "description": "The center's mix of camps, classes, exhibitions, and family-friendly outdoor concerts gives it stronger repeat family value than a one-format arts venue.",
            "url": _BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "slower-pace-creative-campus-stop",
            "title": "Slower-pace creative campus stop",
            "feature_type": "amenity",
            "description": "Callanwolde is strongest as a slower creative stop where families can combine an activity, some walking, and outdoor breathing room without rushing.",
            "url": _BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    return envelope


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Callanwolde Fine Arts Center events via the Tribe Events Calendar API."""
    venue_id = get_or_create_place(_VENUE_DATA)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))
    return crawl_tribe(source, _CONFIG)
