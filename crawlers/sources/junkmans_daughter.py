"""
Destination-first crawler for Junkman's Daughter.

A 10,000 sq ft alternative department store at 464 Moreland Ave NE in Little
Five Points. No event calendar — the value is in the fully enriched venue
record. The crawler upserts the venue and refreshes og:image / og:description
from the live homepage on every run.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.junkmansdaughter.com/"

VENUE_DATA = {
    "name": "Junkman's Daughter",
    "slug": "junkmans-daughter",
    "address": "464 Moreland Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7644,
    "lng": -84.3490,
    "venue_type": "shop",
    "spot_type": "shop",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11
    "hours": {
        "monday": "11:00-19:00",
        "tuesday": "11:00-19:00",
        "wednesday": "11:00-19:00",
        "thursday": "11:00-19:00",
        "friday": "11:00-19:00",
        "saturday": "11:00-19:00",
        "sunday": "12:00-19:00",
    },
    "vibes": [
        "alternative",
        "eclectic",
        "costumes",
        "vintage",
        "Little-Five-Points",
        "landmark",
    ],
    "description": (
        "A 10,000 square foot 'alternative department store' in Little Five Points "
        "— bizarre fashion, eclectic decor, novelties, costumes, and pop culture "
        "oddities since 1982."
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
    """Ensure Junkman's Daughter has a fully enriched venue record.

    No events are crawled — the store has no public event calendar. The
    crawler's sole job is to upsert the venue and refresh image/description
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
        logger.warning("Junkman's Daughter: og: enrichment failed: %s", exc)

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
            logger.warning("Junkman's Daughter: venue update failed: %s", exc)

    logger.info(
        "Junkman's Daughter: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
