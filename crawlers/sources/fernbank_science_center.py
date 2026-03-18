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
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "http://www.fernbank.edu"
EVENTS_URL = f"{BASE_URL}/fsc.html"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)

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
    "description": (
        "Fernbank Science Center is a free public science facility operated by DeKalb County Schools, "
        "featuring a planetarium, observatory, exhibit hall, and outdoor nature trail. All programming "
        "is free and open to the community."
    ),
    # Hero image from fernbank.edu — verified 2026-03-11
    "image_url": "http://www.fernbank.edu/assets/images/Fernbank-Science-Center.jpg",
    # Hours verified 2026-03-11: Mon-Fri 2-5pm (school year), Sat 10am-5pm; Sun varies
    "hours": {
        "monday": "14:00-17:00",
        "tuesday": "14:00-17:00",
        "wednesday": "14:00-17:00",
        "thursday": "14:00-17:00",
        "friday": "14:00-17:00",
        "saturday": "10:00-17:00",
    },
    "vibes": ["free", "educational", "family-friendly", "science", "planetarium"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "science_center",
            "commitment_tier": "halfday",
            "primary_activity": "family science center visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "outdoor-indoor-mix", "rainy-day", "family-daytrip", "free-option"],
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "Fernbank Science Center is one of the city's strongest free family education stops, and works well as a lower-cost museum-style outing with planetarium and observatory add-ons. "
                "It is especially strong when a family wants real STEM value without committing to a full-price or all-day attraction."
            ),
            "accessibility_notes": (
                "Its indoor exhibit and planetarium core make it a lower-friction family visit than larger outdoor science or nature destinations, with optional trail time if energy allows. "
                "That makes it easier for shorter visits, school-age kids, and weather-flex family plans."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "General admission is free; some planetarium programs or special events can have schedule-specific access rules.",
            "source_url": EVENTS_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-planetarium-and-science-hall",
            "title": "Free planetarium and science hall",
            "feature_type": "amenity",
            "description": "Fernbank Science Center combines science exhibits and planetarium programming in one free family education stop.",
            "url": EVENTS_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "observatory-and-free-learning-anchor",
            "title": "Observatory and free learning anchor",
            "feature_type": "amenity",
            "description": "Its observatory and public-learning focus make Fernbank Science Center one of the stronger low-cost STEM anchors in the metro.",
            "url": EVENTS_URL,
            "is_free": True,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-stem-stop-with-real-depth",
            "title": "Free STEM stop with real depth",
            "feature_type": "amenity",
            "description": "Fernbank Science Center is one of the best low-cost family options when the goal is real learning value, not just a quick novelty stop.",
            "url": EVENTS_URL,
            "is_free": True,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "venue_id": venue_id,
            "slug": "always-free-general-admission",
            "title": "Always-free general admission",
            "description": "General admission is free, making Fernbank Science Center one of the strongest recurring no-ticket STEM outings for families in the city.",
            "price_note": "General admission is free.",
            "is_free": True,
            "source_url": EVENTS_URL,
            "category": "admission",
        },
    )
    return envelope


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like:
    - "Feb 26th, April 30th" (multiple dates)
    - "Friday, February 27, 7:00 PM"
    - "Saturday, March 7th, 10:30 AM - 2:30 PM"
    - "Thursday, March 19th, 6:00 PM - 7:00 PM"

    Returns first date found in YYYY-MM-DD format.
    """
    # Collect every month/day mention and choose the next non-past occurrence.
    matches = re.findall(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?",
        date_text,
        re.IGNORECASE
    )

    if matches:
        current_year = datetime.now().year
        today = datetime.now().date()
        candidates = []

        for month, day in matches:
            parsed = None
            for fmt in ("%B %d %Y", "%b %d %Y"):
                try:
                    parsed = datetime.strptime(f"{month} {day} {current_year}", fmt).date()
                    break
                except ValueError:
                    continue
            if parsed:
                candidates.append(parsed)

        if not candidates:
            return None

        upcoming = [candidate for candidate in candidates if candidate >= today]
        if upcoming:
            return min(upcoming).strftime("%Y-%m-%d")

        return None

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
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))

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
