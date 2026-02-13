"""
Crawler for SNDBATH sound bath events.

SOURCE: sndbath.com (Squarespace)
PURPOSE: Sound bath meditation sessions at various Atlanta venues.

SNDBATH is a mobile sound healing practice hosting events at The Chapel on Sycamore
in Decatur, yoga studios, churches, and nature centers around Atlanta.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, parse_price

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sndbath.com"
EVENTS_URL = f"{BASE_URL}/events"

# Default venue for SNDBATH organization
# Note: Wellness/meditation/spiritual are expressed via event genres, not venue vibes
SNDBATH_VENUE = {
    "name": "SNDBATH",
    "slug": "sndbath",
    "address": "Multiple locations",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7866,
    "lng": -84.3834,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": [],  # Organization venue has no physical vibes
}

# Known venue mappings for common locations
KNOWN_VENUES = {
    "the chapel on sycamore": {
        "name": "The Chapel on Sycamore",
        "slug": "chapel-on-sycamore-decatur",
        "address": "318 Sycamore Street",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7746,
        "lng": -84.2963,
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://www.thechapelonsycamore.com",
        "vibes": ["historic", "intimate"],  # Only valid vibes from tags.VALID_VIBES
    },
}

# Cities to exclude (outside Atlanta metro area)
EXCLUDED_CITIES = ["gainesville"]


def parse_location(title: str, description: str) -> Optional[dict]:
    """
    Extract venue information from event title and description.

    Returns venue data dict or None if location should use default.
    """
    # Check title for known venues
    title_lower = title.lower()
    for venue_key, venue_data in KNOWN_VENUES.items():
        if venue_key in title_lower:
            return venue_data

    # Check description for location details
    desc_lower = description.lower()

    # Skip events outside metro Atlanta
    for excluded in EXCLUDED_CITIES:
        if excluded in desc_lower:
            logger.debug(f"Skipping event in excluded city: {excluded}")
            return None

    # Check description for known venues
    for venue_key, venue_data in KNOWN_VENUES.items():
        if venue_key in desc_lower:
            return venue_data

    # Default to SNDBATH organization venue
    return SNDBATH_VENUE


def parse_price_from_description(description: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Parse price information from event description.

    Returns: (price_min, price_max, price_note, is_free)
    """
    desc_lower = description.lower()

    # Check for free events
    if "free" in desc_lower or "donation" in desc_lower:
        return 0, 0, "Free", True

    # Look for price patterns
    # Pattern: $35, $35-$75, etc.
    price_pattern = r'\$(\d+)(?:\s*-\s*\$?(\d+))?'
    matches = re.findall(price_pattern, description)

    if matches:
        # Get the first match (primary price)
        first_match = matches[0]
        min_price = float(first_match[0])
        max_price = float(first_match[1]) if first_match[1] else min_price

        price_note = f"${int(min_price)}"
        if max_price > min_price:
            price_note = f"${int(min_price)}-${int(max_price)}"

        return min_price, max_price, price_note, False

    return None, None, None, False


def get_event_genres(title: str, description: str) -> list[str]:
    """
    Determine genres based on event title and description.

    Uses canonical genres from genre_normalize.py:
    - meditation (from COMMUNITY_GENRES): sound baths, meditation sessions
    - yoga (from FITNESS_GENRES): yoga classes
    """
    genres = ["meditation"]  # All sound bath events are meditation events

    title_lower = title.lower()
    desc_lower = description.lower()

    # Only add yoga if it's actually part of the activity (not just "yoga mat" in description)
    # Check title first (more reliable)
    if "yoga" in title_lower:
        genres.append("yoga")
    # Check for yoga-specific phrases in description (but not "yoga mat")
    elif any(phrase in desc_lower for phrase in [
        "kundalini yoga",
        "yoga &",
        "yoga and",
        "yoga +",
        "yoga session",
        "yoga class",
    ]):
        genres.append("yoga")

    return list(set(genres))


def parse_event(article, source_id: int, image_map: dict) -> Optional[dict]:
    """
    Parse a single Squarespace event article element.

    Returns event dict or None if event should be skipped.
    """
    try:
        # Extract title
        title_elem = article.find("h1", class_="eventlist-title")
        if not title_elem:
            return None
        title = title_elem.get_text(strip=True)

        # Extract date
        date_elem = article.find("time", class_="event-date")
        if not date_elem:
            return None
        date_str = date_elem.get("datetime")
        if not date_str:
            return None

        # Parse date (format: 2026-02-15)
        try:
            event_date = datetime.strptime(date_str, "%Y-%m-%d")
            start_date = event_date.strftime("%Y-%m-%d")
        except ValueError:
            logger.warning(f"Could not parse date: {date_str}")
            return None

        # Extract time
        start_time = None
        time_start_elem = article.find("time", class_="event-time-12hr-start")
        if time_start_elem:
            time_text = time_start_elem.get_text(strip=True)
            # Parse time (format: "6:00 PM")
            match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
            if match:
                hour, minute, period = match.groups()
                hour = int(hour)
                if period.upper() == "PM" and hour != 12:
                    hour += 12
                elif period.upper() == "AM" and hour == 12:
                    hour = 0
                start_time = f"{hour:02d}:{minute}"

        # Extract description
        description = ""
        desc_elem = article.find("div", class_="eventlist-description")
        if desc_elem:
            # Get all text, clean up whitespace
            description = " ".join(desc_elem.get_text(separator=" ", strip=True).split())

        # Extract source URL
        link_elem = article.find("a", class_="eventlist-title-link")
        source_url = EVENTS_URL
        if link_elem and link_elem.get("href"):
            href = link_elem["href"]
            if href.startswith("/"):
                source_url = f"{BASE_URL}{href}"
            else:
                source_url = href

        # Determine venue
        venue_data = parse_location(title, description)
        if venue_data is None:
            # Event is outside metro Atlanta
            return None

        venue_id = get_or_create_venue(venue_data)

        # Parse price
        price_min, price_max, price_note, is_free = parse_price_from_description(description)

        # Get genres (meditation, yoga)
        genres = get_event_genres(title, description)

        # Try to find image
        image_url = None
        # Check image map first (from alt text matching)
        if title in image_map:
            image_url = image_map[title]
        # Try to find thumbnail in article
        if not image_url:
            thumb_elem = article.find("a", class_="eventlist-column-thumbnail")
            if thumb_elem:
                style = thumb_elem.get("style", "")
                # Extract background-image URL
                match = re.search(r'url\(["\']?([^"\']+)["\']?\)', style)
                if match:
                    image_url = match.group(1)

        # Build event record
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description[:2000] if description else None,  # Limit length
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "wellness",
            # genres passed separately to insert_event()
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "is_free": is_free,
            "source_url": source_url,
            "ticket_url": source_url,
            "image_url": image_url,
            "raw_text": f"{title} - {description[:500]}" if description else title,
            "extraction_confidence": 0.95,
            "content_hash": generate_content_hash(title, venue_data["name"], start_date),
            "_genres": genres,  # Store genres to pass to insert_event
        }

        return event_record

    except Exception as e:
        logger.error(f"Error parsing event: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl SNDBATH sound bath events.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching SNDBATH events page: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Get HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event articles
            event_articles = soup.find_all("article", class_=lambda x: x and "eventlist-event" in x)
            logger.info(f"Found {len(event_articles)} event articles on page")

            for article in event_articles:
                event_record = parse_event(article, source_id, image_map)

                if not event_record:
                    continue

                events_found += 1

                # Check for existing event
                existing = find_event_by_hash(event_record["content_hash"])
                if existing:
                    events_updated += 1
                    continue

                try:
                    # Extract genres to pass separately
                    genres = event_record.pop("_genres", None)
                    insert_event(event_record, genres=genres)
                    events_new += 1
                    logger.info(
                        f"Added: {event_record['title']} on {event_record['start_date']} "
                        f"at {event_record.get('start_time', 'TBD')}"
                    )
                except Exception as e:
                    logger.error(f"Failed to insert event '{event_record['title']}': {e}")

            browser.close()

        logger.info(
            f"SNDBATH crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching SNDBATH events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl SNDBATH: {e}")
        raise

    return events_found, events_new, events_updated
