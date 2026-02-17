"""
Crawler for David J. Sencer CDC Museum (cdc.gov/museum).
Free public museum featuring public health exhibitions and CDC history.

Note: The museum has permanent and temporary exhibitions but no programmatic events
calendar. Exhibitions are long-running (months/years) and don't change frequently.
This crawler ensures the venue exists in our database as a destination.
"""

import logging
import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cdc.gov/museum"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions_changing.htm"

VENUE_DATA = {
    "name": "David J. Sencer CDC Museum",
    "slug": "cdc-museum",
    "address": "1600 Clifton Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.7986,
    "lng": -84.3251,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": "https://www.cdc.gov/museum",
    "vibes": ["science", "health", "education", "free"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl CDC Museum.

    The museum has permanent exhibitions and occasional temporary exhibitions,
    but no programmatic events or calendar. Exhibitions run for months/years
    and are better represented as venue attributes than events.

    This crawler ensures the venue exists in our database as a free public
    museum destination.

    Returns:
        tuple: (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Ensure venue exists in database
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"CDC Museum venue created/verified (ID: {venue_id})")

        # Check if museum is open and has exhibitions
        # We don't create events because exhibitions are permanent/long-running
        # and better represented as venue attributes
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        try:
            response = requests.get(EXHIBITIONS_URL, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Check for temporary closure alert
            alert = soup.find('div', class_='alert-urgent')
            if alert and 'temporarily closed' in alert.get_text().lower():
                logger.info("CDC Museum is currently temporarily closed")
            else:
                logger.info("CDC Museum appears to be open - check website for current exhibitions")

        except Exception as e:
            logger.warning(f"Could not fetch exhibition status: {e}")

        logger.info(
            "CDC Museum: Venue exists as free public health museum. "
            "No programmatic events to crawl (exhibitions are permanent/long-running)."
        )

    except Exception as e:
        logger.error(f"Failed to process CDC Museum: {e}", exc_info=True)
        raise

    return events_found, events_new, events_updated
