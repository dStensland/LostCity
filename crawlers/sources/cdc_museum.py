"""
Crawler for David J. Sencer CDC Museum (cdc.gov/museum).
Free public museum featuring public health exhibitions and CDC history.

Note: The museum has permanent and temporary exhibitions but no programmatic events
calendar. Exhibitions are long-running (months/years) and don't change frequently.
This crawler ensures the venue exists in our database as a destination.
"""

import logging
import requests
from bs4 import BeautifulSoup

from db import get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cdc.gov/museum"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions_changing.htm"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)

PLACE_DATA = {
    "name": "David J. Sencer CDC Museum",
    "slug": "cdc-museum",
    "address": "1600 Clifton Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.7986,
    "lng": -84.3251,
    "place_type": "museum",
    "spot_type": "museum",
    "website": "https://www.cdc.gov/museum",
    "vibes": ["science", "health", "education", "free"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "science_museum",
            "commitment_tier": "hour",
            "primary_activity": "family public-health museum visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip", "free-option"],
            "best_time_of_day": "morning",
            "practical_notes": (
                "CDC Museum works best as a shorter free educational stop rather than a long family outing, especially for older kids with interest in science, health, or history."
            ),
            "accessibility_notes": (
                "Its indoor museum layout makes it a low-friction visit physically, but the subject matter is better for curious school-age kids than for very young children."
            ),
            "family_suitability": "caution",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Admission is free; temporary exhibitions and security/entry procedures can affect visit planning.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "free-public-health-exhibitions",
            "title": "Free public health exhibitions",
            "feature_type": "amenity",
            "description": "The CDC Museum offers free exhibitions that can work well for curious older kids and school-age family learning outings.",
            "url": EXHIBITIONS_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "place_id": venue_id,
            "slug": "always-free-museum-admission",
            "title": "Always-free museum admission",
            "description": "Museum admission is free, which makes the CDC Museum a reliable no-ticket educational stop for older kids and school-age family outings.",
            "price_note": "Museum admission is free.",
            "is_free": True,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    return envelope


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl CDC Museum.

    The museum has permanent exhibitions and occasional temporary exhibitions,
    but no programmatic events or calendar. Exhibitions run for months/years
    and are better represented as venue attributes than events.

    This crawler ensures the venue exists in our database as a free public
    museum destination.

    Returns:
        tuple: (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Ensure venue exists in database
        venue_id = get_or_create_place(PLACE_DATA)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))
        logger.info(f"CDC Museum venue created/verified (ID: {venue_id})")

        # Check if museum is open and has exhibitions
        # We don't create events because exhibitions are permanent/long-running
        # and better represented as venue attributes
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        try:
            response = requests.get(EXHIBITIONS_URL, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Check for temporary closure alert
            alert = soup.find('div', class_='alert-urgent')
            if alert and 'temporarily closed' in alert.get_text().lower():
                logger.info("CDC Museum is currently temporarily closed")
            else:
                logger.info("CDC Museum appears to be open - check website for current exhibitions")

        except Exception as e:
            logger.warning(f"Could not fetch exhibition status: {e}")

        logger.info(
            "CDC Museum: Venue exists as free public health museum. "
            "No programmatic events to crawl (exhibitions are permanent/long-running)."
        )

    except Exception as e:
        logger.error(f"Failed to process CDC Museum: {e}", exc_info=True)
        raise

    return events_found, events_new, events_updated
