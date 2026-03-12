"""
Destination-first crawler for The Escape Game Atlanta.

The Escape Game is a premium escape room venue at 725 Battery Ave SE,
Suite 2340, The Battery Atlanta. It offers multiple themed rooms for
groups of 2–8. Pricing is per-person (~$40–45); reservations required.
No separate event calendar — the enriched venue record is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://theescapegame.com/atlanta/"

VENUE_DATA = {
    "name": "The Escape Game Atlanta",
    "slug": "escape-game-atlanta",
    "address": "725 Battery Ave SE Suite 2340",
    "neighborhood": "The Battery",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8907,
    "lng": -84.4676,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 against theescapegame.com/atlanta/
    "hours": {
        "monday": "09:00-23:30",
        "tuesday": "09:00-23:30",
        "wednesday": "09:00-23:30",
        "thursday": "09:00-23:30",
        "friday": "09:00-23:30",
        "saturday": "09:00-23:30",
        "sunday": "09:00-23:30",
    },
    "vibes": [
        "groups",
        "date-night",
        "corporate",
        "interactive",
        "teambuilding",
        "immersive",
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
    """Ensure The Escape Game Atlanta has a fully enriched venue record.

    No events are crawled — sessions are booked ad hoc with no public
    calendar. The crawler's sole job is to upsert the venue and refresh
    image/description from the live homepage on each run.
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
        logger.warning("The Escape Game Atlanta: og: enrichment failed: %s", exc)

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
                "The Escape Game Atlanta: venue update failed: %s", exc
            )

    logger.info(
        "The Escape Game Atlanta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
