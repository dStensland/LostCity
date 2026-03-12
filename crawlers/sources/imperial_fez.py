"""
Destination-first crawler for Imperial Fez restaurant.

Moroccan dinner theater at 2285 Peachtree Rd NE in Buckhead. No event
calendar — the value is in the fully enriched venue record. The crawler
upserts the venue and refreshes og:image / og:description from the live
homepage on every run.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://imperialfez.com/"

VENUE_DATA = {
    "name": "Imperial Fez",
    "slug": "imperial-fez",
    "address": "2285 Peachtree Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.8490,
    "lng": -84.3690,
    "venue_type": "restaurant",
    "spot_type": "restaurant",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11
    "hours": {
        "tuesday": "18:00-22:00",
        "wednesday": "18:00-22:00",
        "thursday": "18:00-22:00",
        "friday": "18:00-22:00",
        "saturday": "18:00-22:00",
        "sunday": "18:00-22:00",
    },
    "vibes": [
        "date-night",
        "special-occasion",
        "unique-dining",
        "entertainment",
        "Moroccan",
        "belly-dancing",
    ],
    "description": (
        "Moroccan dinner theater with a multi-course feast eaten traditionally "
        "without utensils, accompanied by live belly dancer performances."
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
    """Ensure Imperial Fez has a fully enriched venue record.

    No events are crawled — dinner service is the attraction, with no
    separate event calendar. The crawler's sole job is to upsert the venue
    and refresh image/description from the live homepage on each run.
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
        logger.warning("Imperial Fez: og: enrichment failed: %s", exc)

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
            logger.warning("Imperial Fez: venue update failed: %s", exc)

    logger.info("Imperial Fez: venue record enriched (destination-first, no events)")
    return 0, 0, 0
