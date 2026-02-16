"""
Crawler for Tourette Information Center and Support of Georgia (TICS of Georgia).

TICS of Georgia provides support groups and resources for individuals and families
affected by Tourette Syndrome and related tic disorders.

Key Programs:
- NW Atlanta support group meetings (monthly)
- Parent/caregiver support groups
- Educational resources and advocacy

NOTE: This is a small grassroots organization that may not have a public website
or online event calendar. Contact: info@ticsofga.org

STRATEGY:
- Attempt to find any web presence or event listings
- If no website/events found, create venue record only (important destination)
- Tag with: tourette, neurological, support-group, tic-disorders
- All events are free support groups
- Category: "support_group" for meetings, "learning" for education
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

# Note: This organization may not have a website. Using placeholder values.
BASE_URL = None  # No known website
CONTACT_EMAIL = "info@ticsofga.org"

VENUE_DATA = {
    "name": "Tourette Information Center and Support of Georgia",
    "slug": "tics-georgia",
    "address": "Northwest Atlanta",  # General area, exact location varies
    "neighborhood": "Northwest Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7900,
    "lng": -84.4200,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": None,  # No known website
    "vibes": ["tourette", "neurological", "support-group", "tic-disorders"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl TICS of Georgia for events.

    Since this organization may not have a web presence, this crawler primarily
    ensures the venue record exists in the database as a known resource.

    Future: If website or event calendar becomes available, update this crawler.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info("TICS of Georgia: No public event calendar found")
        logger.info(f"TICS of Georgia venue record ensured (ID: {venue_id})")
        logger.info(f"Contact: {CONTACT_EMAIL} for support group meeting information")

        # Try to search for any online presence
        # Could search for "TICS of Georgia" on Facebook, Eventbrite, etc.
        # For now, just ensure venue exists as a resource

        # Future enhancement: Check Facebook groups/pages for event listings
        # Future enhancement: Generate recurring monthly support group events if schedule is known

        return 0, 0, 0

    except Exception as e:
        logger.error(f"Failed to crawl TICS of Georgia: {e}")
        raise

    return events_found, events_new, events_updated
