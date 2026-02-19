"""
Crawler for Fernbank Science Center (fernbank.edu).

NOTE: This is Fernbank SCIENCE CENTER (operated by DeKalb County Schools),
NOT Fernbank Museum of Natural History (which is separate and has its own crawler).

The Science Center has a planetarium, observatory, and exhibit hall.
All admission is FREE (funded by DeKalb County).

Site is static HTML (Mobirise) - uses requests + BeautifulSoup.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "http://www.fernbank.edu"
EVENTS_URL = f"{BASE_URL}/fsc.html"

VENUE_DATA = {
    "name": "Fernbank Science Center",
    "slug": "fernbank-science-center",
    "address": "156 Heaton Park Dr NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7735,
    "lng": -84.3237,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like:
    - "Feb 26th, April 30th" (multiple dates)
    - "Friday, February 27, 7:00 PM"
    - "Saturday, March 7th, 10:30 AM - 2:30 PM"
    - "Thursday, March 19th, 6:00 PM - 7:00 PM"

    Returns first date found in YYYY-MM-DD format.
    """
    # Try "Month Day(th/st/nd/rd)" format first
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?",
        date_text,
        re.IGNORECASE
    )

    if match:
        month, day = match.groups()
        current_year = datetime.now().year

        # Try full month name
        try:
            dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
        except ValueError:
            # Try abbreviated month name
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")
            except ValueError:
                return None

        # If date is in the past, assume next year
        if dt.date() < datetime.now().date():
            dt = dt.replace(year=current_year + 1)

        return dt.strftime("%Y-%m-%d")

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format to HH:MM."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    title_lower = title.lower()
    desc_lower = description.lower() if description else ""
    combined = f"{title_lower} {desc_lower}"

    tags = ["fernbank-science-center", "science", "planetarium", "druid-hills", "free"]

    # Cosmic Conversations - astronomy talks
    if "cosmic conversation" in title_lower:
        return "learning", "astronomy", tags + ["astronomy", "planetarium", "talk", "educational"]

    # Music events
    if "music" in title_lower or "concert" in title_lower:
        return "music", "concert", tags + ["concert", "planetarium"]

    # Sound Bath - wellness
    if "sound bath" in title_lower:
        return "wellness", "meditation", tags + ["sound-bath", "meditation", "planetarium"]

    # Science Night - adults only
    if "science night" in title_lower and "adults only" in desc_lower:
        return "community", "adults", tags + ["adults-only", "21+", "science-night", "adults"]

    # Goes Wild - family nature event
    if "goes wild" in title_lower or ("wild" in title_lower and "festival" in desc_lower):
        return "family", "nature", tags + ["family-friendly", "nature", "animals", "science-festival"]

    # General planetarium shows
    if "planetarium" in combined:
        return "learning", "planetarium", tags + ["planetarium-show", "educational"]

    # Default to learning category (for science events)
    return "learning", None, tags + ["educational"]


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Fernbank Science Center special events.

    Note: We only crawl time-based special events, not:
    - Regular planetarium shows (recurring)
    - Permanent exhibits (no dates)
    - Daily operations
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })

        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Fernbank Science Center: {EVENTS_URL}")
        response = session.get(EVENTS_URL, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Find the "Upcoming Events" section
        events_section = soup.find("section", id="gallery3-rn")
        if not events_section:
            logger.warning("Could not find Upcoming Events section")
            return 0, 0, 0

        # Find all event items in the gallery
        event_items = events_section.find_all("div", class_="item")
        logger.info(f"Found {len(event_items)} event items")

        for item in event_items:
            try:
                # Extract title
                title_elem = item.find("h5", class_="item-title")
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Extract description
                description = ""
                desc_elem = item.find("p", class_="mbr-text")
                if desc_elem:
                    description = desc_elem.get_text(strip=True)

                # Parse date from description
                # Date is usually in italics at the start of description
                # Format 1: "Feb 26th, April 30th" (multiple dates - take first)
                # Format 2: "Friday, February 27, 7:00 PM"
                # Format 3: "Saturday, March 7th, 10:30 AM - 2:30 PM"

                start_date = parse_date(description)

                if not start_date:
                    logger.debug(f"Could not parse date from description for: {title}")
                    continue

                # Parse time from description
                start_time = parse_time(description)

                # Extract image URL
                image_url = None
                img_elem = item.find("img")
                if img_elem and img_elem.get("src"):
                    src = img_elem.get("src")
                    # Make absolute URL
                    if src.startswith("http"):
                        image_url = src
                    elif src.startswith("//"):
                        image_url = "https:" + src
                    elif src.startswith("/"):
                        image_url = BASE_URL + src
                    else:
                        # Relative path like "assets/images/..."
                        image_url = f"{BASE_URL}/{src}"

                # Extract event URL from button or link
                event_url = EVENTS_URL
                link_elem = item.find("a", class_="btn")
                if not link_elem:
                    link_elem = item.find("a", href=True)

                if link_elem:
                    href = link_elem.get("href")
                    if href and href not in ["#", ""]:
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href
                        else:
                            event_url = f"{BASE_URL}/{href}"

                # Default to not-free; only set True when source text says "free"
                is_free = False
                button_elem = item.find("a", class_="btn")
                if button_elem:
                    button_text = button_elem.get_text(strip=True).lower()
                    if "free" in button_text:
                        is_free = True
                # Also check description text for free keywords
                if not is_free and description:
                    desc_lower = description.lower()
                    if any(kw in desc_lower for kw in ["free", "no cost", "no charge", "complimentary"]):
                        is_free = True

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(
                    title, "Fernbank Science Center", start_date
                )

                # Check for existing event
                if find_event_by_hash(content_hash):
                    events_updated += 1
                    logger.debug(f"Event already exists: {title}")
                    continue

                # Determine category and tags
                category, subcategory, tags = determine_category(title, description)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description[:1000] if description else None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free admission - funded by DeKalb County Schools",
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": f"{title} - {description[:200] if description else ''}",
                    "extraction_confidence": 0.88,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time or 'TBD'}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            except Exception as e:
                logger.warning(f"Error parsing event item: {e}")
                continue

        logger.info(
            f"Fernbank Science Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Request failed for Fernbank Science Center: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Fernbank Science Center: {e}")
        raise

    return events_found, events_new, events_updated
