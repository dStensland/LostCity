"""
Destination-first crawler for iFly Indoor Skydiving Atlanta.

iFly is an indoor skydiving experience at 2778 Cobb Pkwy SE, Smyrna, GA.
Guests book individual flight sessions in a vertical wind tunnel. Sessions
are scheduled on-demand via the iFly booking system — there is no public
event calendar. Pricing is ~$60–80 per session.

Returns (0, 0, 0) because there are no events to crawl. The enriched
venue record is the deliverable.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.iflyworld.com/atlanta/"

PLACE_DATA = {
    "name": "iFly Indoor Skydiving Atlanta",
    "slug": "ifly-indoor-skydiving-atlanta",
    "address": "2778 Cobb Pkwy SE",
    "neighborhood": "Smyrna",
    "city": "Smyrna",
    "state": "GA",
    "zip": "30080",
    "lat": 33.8870,
    "lng": -84.4700,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 against iflyworld.com/atlanta/
    "hours": {
        "monday": "10:00-20:00",
        "tuesday": "10:00-20:00",
        "wednesday": "10:00-20:00",
        "thursday": "10:00-20:00",
        "friday": "10:00-22:00",
        "saturday": "09:00-22:00",
        "sunday": "10:00-19:00",
    },
    "vibes": [
        "family-friendly",
        "date-night",
        "groups",
        "unique-experience",
        "adrenaline",
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
    """Ensure iFly Indoor Skydiving Atlanta has a fully enriched venue record.

    No events are crawled — sessions are booked ad hoc with no public
    event calendar. The crawler's sole job is to upsert the venue and
    refresh image/description from the live homepage on each run.
    """
    place_data = dict(PLACE_DATA)

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
            place_data["image_url"] = og_image
        if og_desc:
            place_data["description"] = og_desc
    except Exception as exc:
        logger.warning("iFly Indoor Skydiving Atlanta: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)

    # Push the freshest image/description back onto the existing venue row.
    update: dict = {}
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    if update:
        try:
            get_client().table("venues").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning(
                "iFly Indoor Skydiving Atlanta: venue update failed: %s", exc
            )

    logger.info(
        "iFly Indoor Skydiving Atlanta: venue record enriched"
        " (destination-first, no events)"
    )
    return 0, 0, 0
