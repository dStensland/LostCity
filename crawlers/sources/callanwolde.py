"""
Crawler for Callanwolde Fine Arts Center (callanwolde.org).

Callanwolde is a DeKalb County arts center housed in a 1920 Tudor Revival
mansion on Briarcliff Road. It runs a year-round calendar of:
  - Studio arts classes (pottery, drawing, jewelry, blacksmithing, textiles,
    photography, writing)
  - Dance programs (adult and children's — ballet, tap, salsa, jazz)
  - Gallery exhibitions and opening receptions
  - Outdoor concert series (Jazz on the Lawn, Spring Concert Series)
  - Special events

With ~1,300 future events this is a high-volume source for long-tail art and
learning content that covers Druid Hills / Virginia-Highland audiences.

Previously used a Playwright HTML scraper that missed ~95% of events. This
version uses the Tribe Events Calendar REST API — no browser needed.
"""

from __future__ import annotations

from sources._tribe_events_base import TribeConfig, crawl_tribe

_BASE_URL = "https://callanwolde.org"

_VENUE_DATA = {
    "name": "Callanwolde Fine Arts Center",
    "slug": "callanwolde-fine-arts-center",
    "address": "980 Briarcliff Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7872,
    "lng": -84.3407,
    "venue_type": "arts_center",
    "spot_type": "arts_center",
    "website": _BASE_URL,
    "vibes": ["artsy", "family-friendly", "historic", "all-ages"],
}

_CONFIG = TribeConfig(
    base_url=_BASE_URL,
    venue_data=_VENUE_DATA,
    default_category="art",
    default_tags=["arts-center"],
    future_only=True,
    # Internal / seasonal wrapper categories that aren't standalone events
    skip_category_slugs=["wh-events", "wh-santa", "winter-house"],
)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Callanwolde Fine Arts Center events via the Tribe Events Calendar API."""
    return crawl_tribe(source, _CONFIG)
