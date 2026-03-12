"""
Destination-first crawler for Round 1 Arcade Alpharetta.

Round 1 is a Japanese entertainment chain (arcade, bowling, karaoke,
billiards) at 1000 North Point Cir, Alpharetta. It has no event calendar
— the fully enriched venue record itself is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.round1usa.com/"

VENUE_DATA = {
    "name": "Round 1 Arcade Alpharetta",
    "slug": "round-1-arcade-alpharetta",
    "address": "1000 North Point Cir",
    "neighborhood": "Alpharetta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30022",
    "lat": 34.0675,
    "lng": -84.2755,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11
    "hours": {
        "monday": "10:00-00:00",
        "tuesday": "10:00-00:00",
        "wednesday": "10:00-00:00",
        "thursday": "10:00-00:00",
        "friday": "10:00-02:00",
        "saturday": "10:00-02:00",
        "sunday": "10:00-00:00",
    },
    "vibes": [
        "arcade",
        "bowling",
        "karaoke",
        "family-friendly",
        "groups",
        "japanese",
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
    """Ensure Round 1 Arcade Alpharetta has a fully enriched venue record.

    No events are crawled — the venue is open daily with no scheduled
    event calendar. The crawler upserts the venue and refreshes
    image/description from the live homepage on each run.
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
        logger.warning("Round 1 Arcade Alpharetta: og: enrichment failed: %s", exc)

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
                "Round 1 Arcade Alpharetta: venue update failed: %s", exc
            )

    logger.info(
        "Round 1 Arcade Alpharetta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
