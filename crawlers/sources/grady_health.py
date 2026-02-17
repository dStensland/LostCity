"""
Crawler for Grady Health Foundation events (gradyhealthfoundation.org).

Grady is Atlanta's safety-net hospital and its foundation hosts major community
fundraising events and health equity programs. This crawler captures public events
like Move For Grady (fitness fundraiser) and CrossTies Gala (young professionals).

KNOWN EVENTS:
- Move For Grady: Annual fitness fundraiser (April) - runs, walks, cycling
  - Separate domain: moveforgrady.com
  - Category: fitness
  - Venue: Varies (Piedmont Park, BeltLine, etc.)

- CrossTies Gala: Young professionals fundraiser (February)
  - URL: gradyhealthfoundation.org/crossties
  - Category: community
  - Venue: Georgia Aquarium (Oceans Ballroom)

STRATEGY:
- Scrape main event landing pages (Squarespace sites)
- Extract dates from page content using regex patterns
- Auto-detect venue from page content or use defaults
- Tag appropriately: fundraiser, community, health, young-professionals, etc.

Category: "fitness" for athletic fundraisers, "community" for galas/health fairs.
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gradyhealthfoundation.org"
GRADY_HOSPITAL_URL = "https://www.gradyhealth.org"

# Main venues
GRADY_HOSPITAL = {
    "name": "Grady Memorial Hospital",
    "slug": "grady-memorial-hospital",
    "address": "80 Jesse Hill Jr Dr SE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7534,
    "lng": -84.3832,
    "venue_type": "hospital",
    "website": GRADY_HOSPITAL_URL,
}

GEORGIA_AQUARIUM = {
    "name": "Georgia Aquarium",
    "slug": "georgia-aquarium",
    "address": "225 Baker St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7634,
    "lng": -84.3951,
    "venue_type": "attraction",
    "website": "https://www.georgiaaquarium.org",
}


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '6pm', '12:30pm'
    """
    try:
        time_str = time_str.strip().upper()

        # Pattern: H:MM AM/PM or H AM/PM or HAM/PM
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = ["community", "health", "fundraiser"]

    # Fitness events (Move For Grady, runs, walks, cycling)
    if any(word in text for word in ["move for grady", "run", "walk", "cycling", "5k", "10k", "marathon", "fitness"]):
        category = "fitness"
        tags.extend(["outdoor", "fundraiser", "active"])

    # Galas and social fundraisers
    elif any(word in text for word in ["gala", "crossties", "cocktail", "reception", "benefit"]):
        category = "community"
        tags.extend(["gala", "young-professionals", "fundraiser"])

    # Health fairs and community health events
    elif any(word in text for word in ["health fair", "screening", "wellness", "health equity"]):
        category = "community"
        tags.extend(["health", "wellness", "free", "health-equity"])

    # Education/lectures
    elif any(word in text for word in ["lecture", "speaker", "presentation", "workshop", "class"]):
        category = "education"
        tags.extend(["lecture", "healthcare"])

    # Default to community
    else:
        category = "community"

    # Check if free
    is_free = any(word in text for word in ["free", "no cost", "no charge", "complimentary"])
    if is_free:
        tags.append("free")

    return category, list(set(tags)), is_free


def scrape_event_page(url: str, venue_hint: Optional[dict] = None) -> Optional[dict]:
    """
    Scrape a Grady Health Foundation event page for details.
    Returns dict with event data or None if unavailable.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract title from page
        # First try to get from page title meta tag
        title = None
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)
            # Clean up title from Squarespace format (e.g., "CrossTies — Grady Health Foundation")
            if " — " in title:
                title = title.split(" — ")[0].strip()
            # Also handle "| Foundation" format
            if " | " in title:
                title = title.split(" | ")[0].strip()

        # If title is generic or empty, try h1/h2
        if not title or len(title) < 3 or title.lower() in ["grady health foundation", "home"]:
            title_elem = soup.find("h1") or soup.find("h2")
            if title_elem:
                title = title_elem.get_text(strip=True)

        if not title or len(title) < 3:
            return None

        # Extract description from main content
        description = ""
        content_areas = soup.find_all(["div", "section"], class_=re.compile(r"content|description|text|body", re.I))
        for area in content_areas:
            text = area.get_text(" ", strip=True)
            if len(text) > len(description):
                description = text

        if len(description) > 500:
            description = description[:497] + "..."

        # Look for date information in various formats
        date_str = None
        time_str = None

        # Check for structured date elements
        time_elem = soup.find("time")
        if time_elem:
            date_str = time_elem.get("datetime") or time_elem.get_text(strip=True)

        # Search text for date patterns
        if not date_str:
            # Look for common date patterns in text
            date_patterns = [
                r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}',
                r'\d{1,2}/\d{1,2}/\d{4}',
                r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}',
                r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}',
            ]

            full_text = soup.get_text(" ", strip=True)
            for pattern in date_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    date_str = match.group(0)
                    # Extract year if present to help with date parsing
                    year_match = re.search(r'\b(20\d{2})\b', date_str)
                    if year_match:
                        break

        # Look for time patterns
        time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', soup.get_text(" ", strip=True))
        if time_match:
            time_str = time_match.group(0)

        # Extract image
        image_url = None
        og_image = soup.find("meta", property="og:image")
        if og_image:
            image_url = og_image.get("content")

        # If no OG image, look for hero images
        if not image_url:
            img_elem = soup.find("img", class_=re.compile(r"hero|banner|featured", re.I))
            if img_elem:
                image_url = img_elem.get("src")

        return {
            "title": title,
            "description": description if description else None,
            "date_str": date_str,
            "time_str": time_str,
            "image_url": image_url,
            "source_url": url,
            "venue_hint": venue_hint,
        }

    except Exception as e:
        logger.warning(f"Failed to scrape {url}: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Grady Health Foundation events.

    Checks main event pages for Move For Grady, CrossTies Gala, and other
    community health events.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Known event pages to check
    event_pages = [
        {
            "url": "https://www.moveforgrady.com",
            "default_title": "Move For Grady",
            "default_category": "fitness",
            "venue_hint": None,  # Varies by year - could be Piedmont Park, BeltLine, etc.
        },
        {
            "url": f"{BASE_URL}/crossties",
            "default_title": "CrossTies Gala",
            "default_category": "community",
            "venue_hint": GEORGIA_AQUARIUM,  # Typically at Georgia Aquarium
        },
    ]

    for page_config in event_pages:
        try:
            event_data = scrape_event_page(
                page_config["url"],
                venue_hint=page_config.get("venue_hint")
            )

            if not event_data:
                logger.debug(f"No event data found at {page_config['url']}")
                continue

            title = event_data["title"] or page_config.get("default_title")
            if not title:
                continue

            # Skip if this is clearly a generic page, not an event
            if title.lower() in ["events", "grady health foundation", "home", "about"]:
                continue

            description = event_data.get("description")

            # Parse date
            date_str = event_data.get("date_str")
            start_date = None
            if date_str:
                start_date = parse_human_date(date_str, context_text=description)

            # If no date found, skip this event
            if not start_date:
                logger.debug(f"No valid date found for: {title}")
                continue

            events_found += 1

            # Parse time
            start_time = None
            time_str = event_data.get("time_str")
            if time_str:
                start_time = parse_time_string(time_str)

            # Determine venue
            venue_hint = event_data.get("venue_hint")
            if venue_hint:
                venue_id = get_or_create_venue(venue_hint)
                venue_name = venue_hint["name"]
            else:
                # Default to Grady Hospital for health equity events
                venue_id = get_or_create_venue(GRADY_HOSPITAL)
                venue_name = GRADY_HOSPITAL["name"]

            # Determine category and tags
            category, tags, is_free = determine_category_and_tags(title, description or "")

            # Use page default category if more specific
            if page_config.get("default_category"):
                category = page_config["default_category"]

            # Generate content hash for deduplication
            content_hash = generate_content_hash(title, venue_name, start_date)

            # Check if already exists
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                logger.debug(f"Event already exists: {title}")
                continue

            # Create event record
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": is_free,
                "source_url": event_data.get("source_url"),
                "ticket_url": event_data.get("source_url"),
                "image_url": event_data.get("image_url"),
                "raw_text": f"{title}\n{description[:200] if description else ''}",
                "extraction_confidence": 0.75,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        except Exception as e:
            logger.warning(f"Error processing {page_config['url']}: {e}")
            continue

    logger.info(
        f"Grady Health Foundation crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
