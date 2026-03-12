"""
Destination-first crawler for Atlanta Alpaca Treehouse.

Atlanta Alpaca Treehouse is a unique farm attraction at 2660 Forrest Ave SE,
East Atlanta, offering alpaca farm tours by reservation. No public event
calendar — the fully enriched venue record is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.alpacatreehouse.com/"

VENUE_DATA = {
    "name": "Atlanta Alpaca Treehouse",
    "slug": "atlanta-alpaca-treehouse",
    "address": "2660 Forrest Ave SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.7150,
    "lng": -84.3460,
    "venue_type": "attraction",
    "spot_type": "attraction",
    "website": HOMEPAGE,
    # Tours by reservation only — no fixed daily hours
    "hours": {
        "monday": "by-reservation",
        "tuesday": "by-reservation",
        "wednesday": "by-reservation",
        "thursday": "by-reservation",
        "friday": "by-reservation",
        "saturday": "by-reservation",
        "sunday": "by-reservation",
    },
    "vibes": [
        "animals",
        "farm",
        "family-friendly",
        "unique-experience",
        "outdoor",
        "nature",
        "date-night",
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
    """Ensure Atlanta Alpaca Treehouse has a fully enriched venue record.

    No events are crawled — tours are by reservation with no public
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
        logger.warning("Atlanta Alpaca Treehouse: og: enrichment failed: %s", exc)

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
                "Atlanta Alpaca Treehouse: venue update failed: %s", exc
            )

    logger.info(
        "Atlanta Alpaca Treehouse: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
