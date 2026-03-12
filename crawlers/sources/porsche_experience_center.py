"""
Destination-first crawler for Porsche Experience Center Atlanta.

The Porsche Experience Center is a permanent driving attraction at
1 Porsche Dr, Hapeville, adjacent to Atlanta Hartsfield-Jackson Airport.
It offers track experiences, autocross, and other driving programs by
reservation — no public event calendar.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.porschedriving.com/atlanta"

VENUE_DATA = {
    "name": "Porsche Experience Center Atlanta",
    "slug": "porsche-experience-center-atlanta",
    "address": "1 Porsche Dr",
    "neighborhood": "Hapeville",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6420,
    "lng": -84.4040,
    "venue_type": "attraction",
    "spot_type": "attraction",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 — closed Sun/Mon
    "hours": {
        "monday": "closed",
        "tuesday": "09:00-17:00",
        "wednesday": "09:00-17:00",
        "thursday": "09:00-17:00",
        "friday": "09:00-17:00",
        "saturday": "09:00-17:00",
        "sunday": "closed",
    },
    "vibes": [
        "luxury",
        "driving-experience",
        "unique-experience",
        "corporate",
        "date-night",
        "interactive",
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
    """Ensure Porsche Experience Center Atlanta has a fully enriched venue record.

    No events are crawled — experiences are by reservation with no public
    calendar. The crawler upserts the venue and refreshes image/description
    from the live homepage on each run.
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
        logger.warning(
            "Porsche Experience Center Atlanta: og: enrichment failed: %s", exc
        )

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
            logger.warning(
                "Porsche Experience Center Atlanta: venue update failed: %s", exc
            )

    logger.info(
        "Porsche Experience Center Atlanta: venue record enriched "
        "(destination-first, no events)"
    )
    return 0, 0, 0
