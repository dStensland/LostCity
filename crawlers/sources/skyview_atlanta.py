"""
Destination-first crawler for SkyView Atlanta.

SkyView is a Ferris wheel attraction at 168 Luckie St NW, Downtown Atlanta.
It has no event calendar — the value is in the fully enriched venue record.

Returns (0, 0, 0) because there are no events to crawl. The venue
record — including og:image and og:description fetched fresh from the
homepage on every run — is the deliverable.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://skyviewatlanta.com/"

VENUE_DATA = {
    "name": "SkyView Atlanta",
    "slug": "skyview-atlanta",
    "address": "168 Luckie St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7601,
    "lng": -84.3926,
    "venue_type": "attraction",
    "spot_type": "attraction",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 against skyviewatlanta.com
    "hours": {
        "monday": "12:00-21:00",
        "tuesday": "12:00-21:00",
        "wednesday": "12:00-21:00",
        "thursday": "12:00-21:00",
        "friday": "12:00-22:00",
        "saturday": "10:00-22:00",
        "sunday": "10:00-21:00",
    },
    "vibes": [
        "tourist",
        "family-friendly",
        "downtown",
        "date-night",
        "views",
        "landmark",
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
    """Ensure SkyView Atlanta has a fully enriched venue record.

    No events are crawled — the attraction is open daily with no scheduled
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
        logger.warning("SkyView Atlanta: og: enrichment failed: %s", exc)

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
            logger.warning("SkyView Atlanta: venue update failed: %s", exc)

    logger.info(
        "SkyView Atlanta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
