"""
Crawler for Ravine ATL (ravineatl.com).

Ravine is a rock-n-roll-inspired nightclub/event space at 35 Kimball Way SE,
Atlanta, GA (Underground Atlanta area). It hosts DJ shows and live electronic
music events, mostly promoted by third-party promoters (Collectiv Presents,
BewarePresents, etc.) rather than listed directly on its own website.

TECHNICAL STATUS (investigated 2026-04-09):
- Website uses WordPress with the "Simple Calendar" (google-calendar-events)
  plugin installed, but the plugin's AJAX request never fires on any page —
  the calendar shortcode is not placed in any active page content.
- The /events/ page is a portfolio grid with height:0 (empty).
- The RSS feed is empty (last item: September 2025).
- The sitemap has only one portfolio item (a "Venue" page from 2018).
- No presence on Eventbrite, Dice.fm, or Resident Advisor.
- Facebook page shows the venue hosted events in Oct/Nov 2025 via
  third-party promoters but those events are not listed on ravineatl.com.
- Collectiv Presents (collectivpresents.com) books shows in Atlanta but
  their current Atlanta shows are at District Atlanta, not Ravine.

STRATEGY: Register the place record so Ravine appears as a destination.
Return 0 events — the website provides no parseable event data.

TO UNBLOCK: If Ravine's website is ever updated with a working calendar,
re-examine the Simple Calendar plugin's AJAX setup. The nonce is at
simcal_default_calendar.nonce in the page JS, and the endpoint is
/wp-admin/admin-ajax.php with action=simcal_default_calendar_draw_grid.
The missing piece is the calendar post ID (data-post-id on the shortcode div).
"""

from __future__ import annotations

import logging

from db import get_or_create_place

logger = logging.getLogger(__name__)

BASE_URL = "https://ravineatl.com"
EVENTS_URL = f"{BASE_URL}/events/"

PLACE_DATA = {
    "name": "Ravine ATL",
    "slug": "ravine",
    "address": "35 Kimball Way SE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7487,
    "lng": -84.3897,
    "place_type": "nightclub",
    "spot_type": "nightclub",
    "website": BASE_URL,
    "description": (
        "Multi-sensory nightclub and event space in a rock n' roll-inspired "
        "recording studio setting. Hosts DJ shows, electronic music events, "
        "and live performances. Located in the Underground Atlanta area."
    ),
    "image_url": "https://ravineatl.com/wp-content/uploads/2018/08/Ravine.jpg",
    "vibes": ["late-night", "live-music", "craft-cocktails"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Register Ravine ATL as a place record.

    The venue's website calendar infrastructure is broken — no event data is
    parseable. Events are promoted by third parties (Collectiv Presents,
    BewarePresents) and do not appear on ravineatl.com in any structured form.

    Returns (0, 0, 0) — no events found or inserted.
    """
    venue_id = get_or_create_place(PLACE_DATA)
    logger.info(
        "Ravine ATL place record ensured (ID: %s). "
        "Website event calendar is non-functional — 0 events extracted.",
        venue_id,
    )
    return 0, 0, 0
