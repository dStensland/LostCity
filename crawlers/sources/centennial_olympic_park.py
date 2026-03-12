"""
Destination-first crawler for Centennial Olympic Park.

Centennial Olympic Park is a 21-acre public park at 265 Park Ave W NW,
Downtown Atlanta, managed by the Georgia World Congress Center Authority.
It hosts occasional large events (concerts, festivals, NYE) but has no
persistent programmed calendar worth crawling at this time.

Returns (0, 0, 0) for events. The fully enriched venue record is the
deliverable, refreshed from the live homepage on every run.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.gwcca.org/centennial-olympic-park"

VENUE_DATA = {
    "name": "Centennial Olympic Park",
    "slug": "centennial-olympic-park",
    "address": "265 Park Ave W NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7606,
    "lng": -84.3930,
    "venue_type": "park",
    "spot_type": "park",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 — park open daily 07:00-23:00
    "hours": {
        "monday": "07:00-23:00",
        "tuesday": "07:00-23:00",
        "wednesday": "07:00-23:00",
        "thursday": "07:00-23:00",
        "friday": "07:00-23:00",
        "saturday": "07:00-23:00",
        "sunday": "07:00-23:00",
    },
    "is_free": True,
    "vibes": [
        "tourist",
        "family-friendly",
        "downtown",
        "free",
        "landmark",
        "outdoor",
        "fountain",
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
    """Ensure Centennial Olympic Park has a fully enriched venue record.

    No events are crawled at this time. The crawler's job is to upsert
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
        logger.warning("Centennial Olympic Park: og: enrichment failed: %s", exc)

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
                "Centennial Olympic Park: venue update failed: %s", exc
            )

    logger.info(
        "Centennial Olympic Park: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
