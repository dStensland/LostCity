"""
Destination-first crawler for Trader Vic's Atlanta.

Trader Vic's is one of the last original Trader Vic's tiki bars in America,
hidden in the basement of the Hilton Atlanta since 1976. It has no public
event calendar — the fully enriched venue record itself is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://tradervicsatl.com/"

VENUE_DATA = {
    "name": "Trader Vic's Atlanta",
    "slug": "trader-vics-atlanta",
    "address": "255 Courtland St NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7626,
    "lng": -84.3833,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 — closed Sun/Mon
    "hours": {
        "monday": "closed",
        "tuesday": "17:00-22:00",
        "wednesday": "17:00-22:00",
        "thursday": "17:00-22:00",
        "friday": "17:00-23:00",
        "saturday": "17:00-23:00",
        "sunday": "closed",
    },
    "description": (
        "One of the last original Trader Vic's tiki bars in America, hidden "
        "in the basement of the Hilton Atlanta since 1976. Classic tiki "
        "cocktails including the original Mai Tai."
    ),
    "vibes": [
        "tiki",
        "classic",
        "speakeasy",
        "date-night",
        "historic",
        "cocktails",
        "hotel-bar",
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
    """Ensure Trader Vic's Atlanta has a fully enriched venue record.

    No events are crawled — the bar has no public event calendar.
    The description is pre-seeded from editorial knowledge; the crawler
    also attempts to freshen the image from the live homepage on each run.
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
        # Preserve the richer editorial description unless og:description is
        # substantially longer (homepage copy often beats og: meta quality).
        if og_desc and len(og_desc) > len(venue_data.get("description", "")):
            venue_data["description"] = og_desc
    except Exception as exc:
        logger.warning("Trader Vic's Atlanta: og: enrichment failed: %s", exc)

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
            logger.warning("Trader Vic's Atlanta: venue update failed: %s", exc)

    logger.info(
        "Trader Vic's Atlanta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
