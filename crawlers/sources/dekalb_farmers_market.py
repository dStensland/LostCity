"""
Destination-first crawler for Your DeKalb Farmers Market.

A 140,000 sq ft indoor international market at 3000 E Ponce de Leon Ave in
Decatur. No event calendar — the value is in the fully enriched venue record.
The crawler upserts the venue and refreshes og:image / og:description from
the live homepage on every run.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place

logger = logging.getLogger(__name__)

HOMEPAGE = "https://www.dekalbfarmersmarket.com/"

PLACE_DATA = {
    "name": "Your DeKalb Farmers Market",
    "slug": "dekalb-farmers-market",
    "address": "3000 E Ponce de Leon Ave",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7740,
    "lng": -84.2890,
    "place_type": "food_hall",
    "spot_type": "food_hall",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11
    "hours": {
        "monday": "09:00-21:00",
        "tuesday": "09:00-21:00",
        "wednesday": "09:00-21:00",
        "thursday": "09:00-21:00",
        "friday": "09:00-21:00",
        "saturday": "09:00-21:00",
        "sunday": "09:00-21:00",
    },
    "vibes": [
        "international",
        "food-destination",
        "family-friendly",
        "cultural",
        "affordable",
    ],
    "description": (
        "A 140,000 square foot indoor international market with products from over "
        "180 countries. Staff from dozens of nationalities. Called 'the real United "
        "Nations' — a culinary pilgrimage since 1977."
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
    """Ensure Your DeKalb Farmers Market has a fully enriched venue record.

    No events are crawled — daily market operations are the attraction. The
    crawler's sole job is to upsert the venue and refresh image/description
    from the live homepage on each run.
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
        if og_desc:
            place_data["description"] = og_desc
    except Exception as exc:
        logger.warning("DeKalb Farmers Market: og: enrichment failed: %s", exc)

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
            logger.warning("DeKalb Farmers Market: venue update failed: %s", exc)

    logger.info(
        "DeKalb Farmers Market: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
