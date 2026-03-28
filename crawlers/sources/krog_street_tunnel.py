"""
Destination-first crawler for Krog Street Tunnel.

Atlanta's most famous legal graffiti wall — a railroad underpass at Krog St NE
connecting Inman Park and Cabbagetown. No event calendar; always open and
always free. The crawler upserts the venue record and keeps it fresh. Because
the tunnel itself has no website, we seed a curated description and rely on
whatever og:image a community resource provides.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place

logger = logging.getLogger(__name__)

# Atlanta Trails guide is a stable community resource with good og:image.
HOMEPAGE = "https://www.atlantatrails.com/atlanta-attractions/krog-street-tunnel/"

PLACE_DATA = {
    "name": "Krog Street Tunnel",
    "slug": "krog-street-tunnel",
    "address": "Krog St NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7530,
    "lng": -84.3630,
    "place_type": "landmark",
    "spot_type": "landmark",
    "website": HOMEPAGE,
    # Always open — 24/7
    "hours": {
        "monday": "00:00-23:59",
        "tuesday": "00:00-23:59",
        "wednesday": "00:00-23:59",
        "thursday": "00:00-23:59",
        "friday": "00:00-23:59",
        "saturday": "00:00-23:59",
        "sunday": "00:00-23:59",
    },
    "vibes": [
        "street-art",
        "graffiti",
        "photography",
        "free",
        "walkable",
        "BeltLine-adjacent",
        "iconic",
    ],
    "is_free": True,
    "description": (
        "Atlanta's most famous legal graffiti wall — a railroad underpass completely "
        "covered in constantly rotating street art connecting Inman Park and "
        "Cabbagetown."
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
    """Ensure Krog Street Tunnel has a fully enriched venue record.

    No events are crawled — the tunnel is an always-open public landmark
    with no scheduled calendar. The crawler's sole job is to upsert the
    venue and refresh the image from the Atlanta Trails guide page.
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
        # Keep the curated description — community guide descriptions are often
        # more accurate than scraped og:description for landmarks.
    except Exception as exc:
        logger.warning("Krog Street Tunnel: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)

    update: dict = {}
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    if update:
        try:
            get_client().table("places").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Krog Street Tunnel: venue update failed: %s", exc)

    logger.info(
        "Krog Street Tunnel: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
