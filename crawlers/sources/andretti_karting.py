"""
Destination-first crawler for Andretti Indoor Karting & Games Atlanta.

Andretti is a large-format entertainment complex at 1255 Roswell Rd,
Marietta, GA. It features indoor karting, arcade games, bowling, laser
tag, and a full-service restaurant. No discrete event calendar — the
enriched venue record is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.andrettikarting.com/atlanta/"

VENUE_DATA = {
    "name": "Andretti Indoor Karting & Games",
    "slug": "andretti-indoor-karting-atlanta",
    "address": "1255 Roswell Rd",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30062",
    "lat": 33.9530,
    "lng": -84.5200,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 against andrettikarting.com/atlanta/
    "hours": {
        "monday": "12:00-22:00",
        "tuesday": "12:00-22:00",
        "wednesday": "12:00-22:00",
        "thursday": "12:00-22:00",
        "friday": "12:00-00:00",
        "saturday": "10:00-00:00",
        "sunday": "10:00-22:00",
    },
    "vibes": [
        "groups",
        "corporate",
        "family-friendly",
        "interactive",
        "date-night",
        "karting",
        "arcade",
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
    """Ensure Andretti Indoor Karting Atlanta has a fully enriched venue record.

    No events are crawled — the venue is open daily for walk-in play with
    no discrete programmed calendar. The crawler's sole job is to upsert
    the venue and refresh image/description from the live homepage on
    each run.
    """
    venue_data = dict(VENUE_DATA)

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
            venue_data["image_url"] = og_image
        if og_desc:
            venue_data["description"] = og_desc
    except Exception as exc:
        logger.warning(
            "Andretti Indoor Karting Atlanta: og: enrichment failed: %s", exc
        )

    venue_id = get_or_create_venue(venue_data)

    # Push the freshest image/description back onto the existing venue row.
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
                "Andretti Indoor Karting Atlanta: venue update failed: %s", exc
            )

    logger.info(
        "Andretti Indoor Karting Atlanta: venue record enriched"
        " (destination-first, no events)"
    )
    return 0, 0, 0
