"""
Destination-first crawler for Cascade Springs Nature Preserve.

135 acres of old-growth forest at 2852 Cascade Rd SW in Southwest Atlanta,
featuring a waterfall, Civil War trenches, and ruins of 19th-century mineral
spring bathhouses. No event calendar — the preserve is a free, always-open
public land. The crawler upserts the venue and refreshes og:image /
og:description from the Atlanta Trails guide page on every run.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue

logger = logging.getLogger(__name__)

HOMEPAGE = (
    "https://www.atlantatrails.com/hiking-trails/cascade-springs-nature-preserve/"
)

VENUE_DATA = {
    "name": "Cascade Springs Nature Preserve",
    "slug": "cascade-springs-preserve",
    "address": "2852 Cascade Rd SW",
    "neighborhood": "Southwest Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30311",
    "lat": 33.7190,
    "lng": -84.4520,
    "venue_type": "park",
    "spot_type": "trail",
    "website": HOMEPAGE,
    # Open daily from dawn to dusk
    "hours": {
        "monday": "06:00-20:00",
        "tuesday": "06:00-20:00",
        "wednesday": "06:00-20:00",
        "thursday": "06:00-20:00",
        "friday": "06:00-20:00",
        "saturday": "06:00-20:00",
        "sunday": "06:00-20:00",
    },
    "vibes": [
        "hiking",
        "waterfall",
        "nature",
        "free",
        "Civil-War-history",
        "hidden-gem",
        "outdoor",
    ],
    "is_free": True,
    "description": (
        "135 acres of old-growth forest with a waterfall, Civil War trenches, and "
        "ruins of 19th-century mineral spring bathhouses — all less than 10 miles "
        "from downtown Atlanta."
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
    """Ensure Cascade Springs Nature Preserve has a fully enriched venue record.

    No events are crawled — the preserve is a free, self-guided public land
    with no scheduled calendar. The crawler's sole job is to upsert the
    venue and refresh image/description from the Atlanta Trails guide page.
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
        logger.warning("Cascade Springs Nature Preserve: og: enrichment failed: %s", exc)

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
                "Cascade Springs Nature Preserve: venue update failed: %s", exc
            )

    logger.info(
        "Cascade Springs Nature Preserve: venue record enriched "
        "(destination-first, no events)"
    )
    return 0, 0, 0
