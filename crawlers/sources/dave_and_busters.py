"""
Destination-first crawler for Dave & Buster's Marietta.

Dave & Buster's is a permanent entertainment venue (arcade, sports bar,
restaurant) at 2215 D&B Dr, Marietta. It has no event calendar — the
fully enriched venue record itself is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.daveandbusters.com/us/en/about/locations/marietta"

VENUE_DATA = {
    "name": "Dave & Buster's Marietta",
    "slug": "dave-and-busters-marietta",
    "address": "2215 D&B Dr",
    "neighborhood": "Marietta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30067",
    "lat": 33.9370,
    "lng": -84.5190,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11
    "hours": {
        "monday": "11:00-23:00",
        "tuesday": "11:00-23:00",
        "wednesday": "11:00-23:00",
        "thursday": "11:00-23:00",
        "friday": "11:00-01:00",
        "saturday": "11:00-01:00",
        "sunday": "11:00-23:00",
    },
    "vibes": [
        "family-friendly",
        "groups",
        "arcade",
        "sports-bar",
        "corporate",
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
    """Ensure Dave & Buster's Marietta has a fully enriched venue record.

    No events are crawled — the venue is open daily with no event calendar.
    The crawler upserts the venue and refreshes image/description from the
    live homepage on each run.
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
        logger.warning("Dave & Buster's Marietta: og: enrichment failed: %s", exc)

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
                "Dave & Buster's Marietta: venue update failed: %s", exc
            )

    logger.info(
        "Dave & Buster's Marietta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
