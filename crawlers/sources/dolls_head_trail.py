"""
Destination-first crawler for Doll's Head Trail at Constitution Lakes Park.

An eerie folk art trail at 1305 S River Industrial Blvd SE in Southeast
Atlanta. No event calendar — the trail is a free, always-open destination.
The crawler upserts the venue and refreshes og:image / og:description from
the Atlanta Trails guide page on every run.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

# Atlanta Trails has the best og:image and description for this destination.
HOMEPAGE = (
    "https://www.atlantatrails.com/hiking-trails/dolls-head-trail-constitution-lakes/"
)

VENUE_DATA = {
    "name": "Doll's Head Trail",
    "slug": "dolls-head-trail",
    "address": "1305 S River Industrial Blvd SE",
    "neighborhood": "Southeast Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.6920,
    "lng": -84.3420,
    "venue_type": "park",
    "spot_type": "trail",
    "website": HOMEPAGE,
    # Open daily from dawn to dusk — no fixed closing time
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
        "quirky",
        "folk-art",
        "outdoor",
        "hiking",
        "weird-Atlanta",
        "free",
        "nature",
    ],
    "is_free": True,
    "description": (
        "An eerie folk art trail in Constitution Lakes Park where found objects "
        "— predominantly doll heads — have been fashioned into installations along "
        "a wetland trail. Visitors are encouraged to add their own creations."
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
    """Ensure Doll's Head Trail has a fully enriched venue record.

    No events are crawled — the trail is a free, self-guided destination
    with no scheduled calendar. The crawler's sole job is to upsert the
    venue and refresh image/description from the Atlanta Trails guide page.
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
        logger.warning("Doll's Head Trail: og: enrichment failed: %s", exc)

    venue_id = get_or_create_venue(venue_data)

    update: dict = {}
    if venue_data.get("image_url"):
        update["image_url"] = venue_data["image_url"]
    if venue_data.get("description"):
        update["description"] = venue_data["description"]
    if update:
        try:
            get_client().table("venues").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Doll's Head Trail: venue update failed: %s", exc)

    logger.info(
        "Doll's Head Trail: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
