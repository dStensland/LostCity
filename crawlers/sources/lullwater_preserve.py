"""
Destination-first crawler for Lullwater Preserve.

A 154-acre nature preserve hidden within Emory University's campus at
1463 Clifton Rd NE in Druid Hills. Features a suspension bridge over a
waterfall, ruins of an old powerhouse, and the 1926 Candler Lake. No event
calendar — the preserve is a free, always-open public land. The crawler
upserts the venue and refreshes og:image / og:description from the Atlanta
Trails guide page on every run.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.atlantatrails.com/hiking-trails/lullwater-preserve/"

PLACE_DATA = {
    "name": "Lullwater Preserve",
    "slug": "lullwater-preserve",
    "address": "1463 Clifton Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "lat": 33.7920,
    "lng": -84.3210,
    "venue_type": "park",
    "spot_type": "trail",
    "website": HOMEPAGE,
    # Open daily from dawn to dusk
    "hours": {
        "monday": "06:00-20:00",
        "tuesday": "06:00-20:00",
        "wednesday": "06:00-20:00",
        "thursday": "06:00-20:00",
        "friday": "06:00-20:00",
        "saturday": "06:00-20:00",
        "sunday": "06:00-20:00",
    },
    "vibes": [
        "nature",
        "hidden-gem",
        "free",
        "hiking",
        "suspension-bridge",
        "waterfall",
        "peaceful",
    ],
    "is_free": True,
    "description": (
        "A 154-acre nature preserve hidden within Emory University's campus "
        "featuring a suspension bridge over a waterfall, ruins of an old powerhouse, "
        "old-growth forest, and the 1926 Candler Lake."
    ),
}


def _extract_og_meta(html: str) -> tuple[Optional[str], Optional[str]]:
    """Return (og:image, og:description) from page HTML."""
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
    """Ensure Lullwater Preserve has a fully enriched venue record.

    No events are crawled — the preserve is a free, self-guided public land
    with no scheduled calendar. The crawler's sole job is to upsert the
    venue and refresh image/description from the Atlanta Trails guide page.
    """
    place_data = dict(PLACE_DATA)

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
        logger.warning("Lullwater Preserve: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)

    update: dict = {}
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    if update:
        try:
            get_client().table("venues").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Lullwater Preserve: venue update failed: %s", exc)

    logger.info(
        "Lullwater Preserve: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
