"""
Destination-first crawler for Gunshow restaurant.

Chef Kevin Gillespie's acclaimed restaurant at 924 Garrett St SE in Glenwood
Park. No event calendar — the value is in a fully enriched venue record.
The crawler upserts the venue and refreshes og:image / og:description from
the live homepage on every run.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place

logger = logging.getLogger(__name__)

HOMEPAGE = "https://gunshowatl.com/"

PLACE_DATA = {
    "name": "Gunshow",
    "slug": "gunshow-restaurant",
    "address": "924 Garrett St SE",
    "neighborhood": "Glenwood Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7350,
    "lng": -84.3560,
    "place_type": "restaurant",
    "spot_type": "restaurant",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11
    "hours": {
        "tuesday": "17:30-21:30",
        "wednesday": "17:30-21:30",
        "thursday": "17:30-21:30",
        "friday": "17:30-21:30",
        "saturday": "17:30-21:30",
    },
    "vibes": [
        "chef-driven",
        "date-night",
        "special-occasion",
        "unique-dining",
        "groups",
    ],
    "description": (
        "Chef Kevin Gillespie's acclaimed restaurant where multiple chefs prepare "
        "dishes and personally present them tableside — a mashup of dim sum and "
        "dinner theater."
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
    """Ensure Gunshow has a fully enriched venue record.

    No events are crawled — the restaurant has no public event calendar.
    The crawler's sole job is to upsert the venue and refresh image/description
    from the live homepage on each run.
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
        logger.warning("Gunshow: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)

    update: dict = {}
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    if update:
        try:
            get_client().table("places").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Gunshow: venue update failed: %s", exc)

    logger.info("Gunshow: venue record enriched (destination-first, no events)")
    return 0, 0, 0
