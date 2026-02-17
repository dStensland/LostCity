"""
Crawler for Le Colonial Atlanta (lecolonial.com/atlanta/happenings).
Upscale French-Vietnamese restaurant in Buckhead featuring special events,
holiday celebrations, and seasonal dining experiences.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.lecolonial.com"
EVENTS_URL = f"{BASE_URL}/atlanta/happenings"

VENUE_DATA = {
    "name": "Le Colonial Atlanta",
    "slug": "le-colonial-atlanta",
    "address": "3060 Peachtree Rd NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "venue_type": "restaurant",
    "website": f"{BASE_URL}/atlanta",
}


def parse_date_from_text(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from event description text.
    Examples:
    - "Ring in the Year of the Horse on February 17th"
    - "Dragon Dance Sunday, February 22nd, 5:00 PM"
    - "Celebrate Valentine's Day" (infer from title/context)
    """
    try:
        current_year = datetime.now().year

        # Look for date patterns like "February 17th", "February 22nd, 5:00 PM"
        # Pattern: Month Day(st/nd/rd/th) [, Year] [time]
        date_pattern = r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?'
        date_match = re.search(date_pattern, text, re.IGNORECASE)

        if date_match:
            month = date_match.group(1)
            day = date_match.group(2)
            year = date_match.group(3) if date_match.group(3) else str(current_year)

            # Parse the date
            date_str = f"{month} {day}, {year}"
            try:
                dt = datetime.strptime(date_str, "%B %d, %Y")
                date_result = dt.strftime("%Y-%m-%d")
            except ValueError:
                return None, None

            # Look for time in the text
            time_pattern = r'(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?'
            time_match = re.search(time_pattern, text)

            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2))
                period = time_match.group(3)

                if period:
                    period = period.upper()
                    if period == 'PM' and hour != 12:
                        hour += 12
                    elif period == 'AM' and hour == 12:
                        hour = 0

                time_result = f"{hour:02d}:{minute:02d}"
                return date_result, time_result

            return date_result, None

        # Check for holiday-specific dates
        if "valentine" in text.lower():
            # Valentine's Day is February 14
            year = current_year
            valentine_dt = datetime(year, 2, 14)
            if valentine_dt < datetime.now():
                year += 1
                valentine_dt = datetime(year, 2, 14)
            return valentine_dt.strftime("%Y-%m-%d"), None

        return None, None

    except Exception as e:
        logger.debug(f"Failed to parse date from text '{text}': {e}")
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Le Colonial Atlanta events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        logger.info(f"Fetching Le Colonial Atlanta: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Le Colonial uses <section class="text-block"> for each event
        event_sections = soup.find_all("section", class_="text-block")

        if not event_sections:
            logger.info("No event sections found on Le Colonial happenings page")
            return events_found, events_new, events_updated

        logger.info(f"Found {len(event_sections)} event sections")

        for section in event_sections:
            try:
                # Extract title from h2 within title-container
                title_elem = section.find("div", class_="title-container")
                if title_elem:
                    h2 = title_elem.find("h2")
                    title = h2.get_text(strip=True) if h2 else None
                else:
                    title = None

                if not title:
                    continue

                # Extract description from copy-container
                description = None
                copy_elem = section.find("div", class_="copy-container")
                if copy_elem:
                    # Get all text, clean up
                    description = copy_elem.get_text(separator=" ", strip=True)
                    # Remove excessive whitespace
                    description = re.sub(r'\s+', ' ', description)
                    # Truncate if too long
                    if len(description) > 500:
                        description = description[:497] + "..."

                # Extract reservation/ticket URL from button-container
                ticket_url = None
                button_elem = section.find("div", class_="button-container")
                if button_elem:
                    link = button_elem.find("a")
                    if link and link.get("href"):
                        ticket_url = link.get("href")

                # Parse date from description
                full_text = f"{title} {description or ''}"
                start_date, start_time = parse_date_from_text(full_text)

                if not start_date:
                    logger.debug(f"Could not parse date for event: {title}")
                    continue

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                # Check if event exists

                # Determine category from title and description
                title_lower = (title + " " + (description or "")).lower()

                if any(w in title_lower for w in ["valentine", "lunar new year", "holiday", "celebration"]):
                    category, subcategory = "food", "special_dining"
                    tags = ["food", "dining", "restaurant", "buckhead", "special-event"]
                elif any(w in title_lower for w in ["brunch", "dinner", "prix fixe", "menu"]):
                    category, subcategory = "food", "dining"
                    tags = ["food", "dining", "restaurant", "buckhead"]
                elif any(w in title_lower for w in ["music", "live", "performance", "dance"]):
                    category, subcategory = "music", "live"
                    tags = ["music", "restaurant", "buckhead"]
                else:
                    category, subcategory = "food", "special_dining"
                    tags = ["food", "dining", "restaurant", "buckhead", "special-event"]

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description or f"Special event at Le Colonial Atlanta",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": EVENTS_URL,
                    "ticket_url": ticket_url,
                    "image_url": None,  # Images are in hero sections, harder to match
                    "raw_text": full_text[:1000],
                    "extraction_confidence": 0.85,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{title}': {e}")

            except Exception as e:
                logger.debug(f"Failed to parse event section: {e}")
                continue

        logger.info(
            f"Le Colonial crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Le Colonial Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
