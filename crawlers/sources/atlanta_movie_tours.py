"""
Destination-first crawler for Atlanta Movie Tours.

Atlanta Movie Tours offers guided tours of Atlanta's most iconic film and
TV filming locations — including The Walking Dead, Marvel films, and more —
departing from 327 Nelson St SW, Downtown Atlanta. Tours run on a published
schedule but are not a crawlable event calendar; the venue record is the
deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place

logger = logging.getLogger(__name__)

HOMEPAGE = "https://atlantamovietours.com/"

PLACE_DATA = {
    "name": "Atlanta Movie Tours",
    "slug": "atlanta-movie-tours",
    "address": "327 Nelson St SW Suite C",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7480,
    "lng": -84.3980,
    "venue_type": "attraction",
    "spot_type": "attraction",
    "website": HOMEPAGE,
    # Tours run on a published schedule — check website for current times
    "hours": {
        "monday": "by-schedule",
        "tuesday": "by-schedule",
        "wednesday": "by-schedule",
        "thursday": "by-schedule",
        "friday": "by-schedule",
        "saturday": "by-schedule",
        "sunday": "by-schedule",
    },
    "vibes": [
        "tours",
        "film",
        "unique-experience",
        "groups",
        "walking-dead",
        "marvel",
    ],
}


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
    """Ensure Atlanta Movie Tours has a fully enriched venue record.

    No events are crawled — tour schedules change frequently and are best
    booked directly. The crawler upserts the venue and refreshes
    image/description from the live homepage on each run.
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
        logger.warning("Atlanta Movie Tours: og: enrichment failed: %s", exc)

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
            logger.warning("Atlanta Movie Tours: venue update failed: %s", exc)

    logger.info(
        "Atlanta Movie Tours: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
