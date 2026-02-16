"""
Crawler for Georgia Crisis & Access Line (GCAL) - mygcal.com.

GCAL is Georgia's 24/7 crisis intervention and behavioral health access line,
operated by the Georgia Department of Behavioral Health and Developmental
Disabilities (DBHDD). Services include:

- 24/7 crisis intervention hotline
- Mental health and substance use crisis support
- Peer support and counseling
- Referrals to local services and treatment providers
- Mobile crisis response coordination

This is primarily a crisis hotline service, NOT an event calendar. The crawler
creates and maintains the venue record so GCAL appears as a resource/destination
in the LostCity database, but does not expect to find scheduled events.

VENUE STRATEGY:
- Ensure venue exists as a community resource
- Tag: crisis-support, mental-health, behavioral-health, 24/7
- No events expected (returns 0, 0, 0)
- Serves all of Georgia including Atlanta metro
"""

from __future__ import annotations

import logging

from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mygcal.com"

VENUE_DATA = {
    "name": "Georgia Crisis & Access Line (GCAL)",
    "slug": "georgia-crisis-access-line",
    "address": "2 Peachtree St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7573,
    "lng": -84.3891,
    "venue_type": "organization",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["inclusive"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Ensure GCAL venue record exists in the database.

    This is a crisis hotline, not an event venue. No events are expected.
    The venue record makes GCAL discoverable as a mental health resource.
    """
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Georgia Crisis & Access Line venue record ensured (ID: {venue_id})")
        logger.info("GCAL is a crisis hotline service with no scheduled events")

    except Exception as e:
        logger.error(f"Failed to create GCAL venue record: {e}")
        raise

    # No events for this source
    return 0, 0, 0
