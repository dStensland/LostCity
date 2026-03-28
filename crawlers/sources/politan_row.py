"""
Destination-first crawler for Politan Row at Colony Square.
Upscale food hall in Midtown with 10+ chef-driven concepts.
"""

from __future__ import annotations
import logging

from db import get_or_create_place

logger = logging.getLogger(__name__)

PLACE_DATA = {
    "name": "Politan Row at Colony Square",
    "slug": "politan-row-at-colony-square",
    "address": "1197 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30361",
    "lat": 33.7886,
    "lng": -84.3834,
    "venue_type": "food_hall",
    "spot_type": "food_hall",
    "website": "https://www.politanrow.com",
    "description": "Upscale food hall at Colony Square featuring 10+ chef-driven dining concepts, craft cocktails, and communal seating in Midtown Atlanta.",
    "_destination_details": {
        "commitment_tier": "hour",
        "parking_type": "garage",
        "best_time_of_day": "any",
        "family_suitability": "yes",
        "practical_notes": "Colony Square garage parking available. Multiple dining concepts under one roof — easy for groups with different tastes. Walkable from MARTA Arts Center station.",
    },
    "_venue_features": [
        {
            "slug": "chef-driven-concepts",
            "title": "10+ Chef-Driven Dining Concepts",
            "feature_type": "amenity",
            "description": "Curated collection of chef-driven restaurants and bars spanning global cuisines, from sushi to Southern comfort food.",
            "is_free": True,
            "sort_order": 1,
        },
        {
            "slug": "craft-bar",
            "title": "Craft Cocktail Bars",
            "feature_type": "amenity",
            "description": "Full bar programs with craft cocktails, wine, and local beer alongside dining.",
            "is_free": True,
            "sort_order": 2,
        },
        {
            "slug": "communal-seating",
            "title": "Communal Dining & Event Space",
            "feature_type": "amenity",
            "description": "Open communal seating areas and private event space for groups in the heart of Colony Square.",
            "is_free": True,
            "sort_order": 3,
        },
    ],
    "_venue_specials": [
        {
            "title": "Happy Hour Specials",
            "type": "happy_hour",
            "description": "Select vendors offer happy hour pricing on drinks and small plates during weekday afternoons.",
            "days_of_week": [1, 2, 3, 4, 5],
            "time_start": "15:00",
            "time_end": "18:00",
        },
    ],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Destination-first — register venue with enrichment, no events to crawl."""
    get_or_create_place(PLACE_DATA)
    return (0, 0, 0)
