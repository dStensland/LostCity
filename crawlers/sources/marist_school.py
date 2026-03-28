"""
Crawler for Marist School Summer Programs via MyRec.

Official registration catalog:
https://maristschoolga.myrec.com/info/activities/default.aspx?type=activities

This source is the first implementation of the reusable MyRec family-program
pattern. The listing page exposes category buckets and the detail pages expose a
stable session table with ages, grades, days, date/time, facility, and fees.
"""

from __future__ import annotations

from sources._myrec_base import crawl_myrec

BASE_URL = "https://maristschoolga.myrec.com"
ACTIVITIES_URL = f"{BASE_URL}/info/activities/default.aspx?type=activities"

PLACE_DATA = {
    "name": "Marist School",
    "slug": "marist-school",
    "address": "3790 Ashford Dunwoody Rd NE",
    "neighborhood": "Brookhaven",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30319",
    "lat": 33.8633,
    "lng": -84.3327,
    "venue_type": "institution",
    "spot_type": "education",
    "website": "https://www.marist.com/",
    "vibes": ["family-friendly", "educational"],
}

MYREC_CONFIG = {
    "base_url": BASE_URL,
    "activities_url": ACTIVITIES_URL,
    "venue": PLACE_DATA,
    "facility_overrides": {
        "marist school": PLACE_DATA,
    },
}


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_myrec(source, MYREC_CONFIG)
