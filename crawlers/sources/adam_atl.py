"""
Crawler for African Diaspora Art Museum of Atlanta (ADAM ATL).
Museum in Westside showcasing African diaspora art with exhibitions,
artist salons, special events, and cultural programs.

Site: https://www.adamatl.org
Events page: https://www.adamatl.org/events (Squarespace events list)
Exhibits page: https://www.adamatl.org/exhibits (exhibitions with dates)
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

BASE_URL = "https://www.adamatl.org"
EVENTS_URL = f"{BASE_URL}/events"
EXHIBITS_URL = f"{BASE_URL}/exhibits"

VENUE_DATA = {
    "name": "African Diaspora Art Museum of Atlanta",
    "slug": "adama-atlanta",  # Matches database venue ID 2433
    "address": "535 Means St NW, Suite C",
    "neighborhood": "Westside",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7780,
    "lng": -84.4127,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def parse_event_date(date_str: str, time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Squarespace event date and time.
    Date format: "2026-03-08" (from datetime attribute)
    Time format: "2:00 PM3:00 PM" or "7:00 PM9:00 PM"
    Returns (date, start_time) as (YYYY-MM-DD, HH:MM).
    """
    try:
        # Date is already in YYYY-MM-DD format from datetime attribute
        date = date_str.strip()

        # Parse time - extract start time from format like "2:00 PM3:00 PM"
        if time_str:
            time_match = re.match(
                r'(\d{1,2}):(\d{2})\s*(AM|PM)',
                time_str.strip(),
                re.IGNORECASE
            )
            if time_match:
                hour, minute, period = time_match.groups()
                hour = int(hour)
                period = period.upper()

                # Convert to 24-hour format
                if period == "PM" and hour != 12:
                    hour += 12
                elif period == "AM" and hour == 12:
                    hour = 0

                start_time = f"{hour:02d}:{minute}"
                return date, start_time

        return date, None

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date/time '{date_str}' / '{time_str}': {e}")
        return None, None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    title_lower = title.lower()
    desc_lower = description.lower() if description else ""
    combined = f"{title_lower} {desc_lower}"

    base_tags = ["adam", "adam-atl", "museum", "african-diaspora", "african-american", "westside", "art"]

    # Artist salons / talks
    if "salon" in title_lower or "artist talk" in combined or "conversation" in combined:
        return "art", "talk", base_tags + ["talk", "salon", "artist-talk"]

    # Exhibitions / openings
    if "exhibition" in combined or "opening" in combined or "reception" in combined:
        return "art", "exhibition", base_tags + ["exhibition", "opening"]

    # Workshops / classes
    if "workshop" in combined or "class" in combined:
        return "art", "workshop", base_tags + ["workshop", "class"]

    # Film screenings
    if any(w in combined for w in ["film", "screening", "movie", "documentary"]):
        return "film", None, base_tags + ["film", "screening"]

    # Music / performance
    if any(w in combined for w in ["music", "performance", "concert", "live"]):
        return "music", "performance", base_tags + ["music", "performance"]

    # Default to art event
    return "art", None, base_tags


def _crawl_events(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Crawl events from /events page (Squarespace events list)."""
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })

        logger.info(f"Fetching ADAM ATL events: {EVENTS_URL}")
        response = session.get(EVENTS_URL, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Find all event articles (Squarespace standard structure)
        event_articles = soup.find_all("article", class_="eventlist-event")
        logger.info(f"Found {len(event_articles)} events")

        for article in event_articles:
            try:
                # Extract title
                title_elem = article.find("h1", class_="eventlist-title")
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Extract event URL
                event_url = EVENTS_URL
                link_elem = title_elem.find("a", href=True)
                if link_elem:
                    href = link_elem.get("href")
                    if href:
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href

                # Extract date from datetime attribute
                date_elem = article.find("time", class_="event-date")
                if not date_elem or not date_elem.get("datetime"):
                    logger.debug(f"No date found for: {title}")
                    continue

                date_str = date_elem.get("datetime")

                # Extract time from meta list
                time_str = None
                meta_list = article.find("ul", class_="eventlist-meta")
                if meta_list:
                    meta_items = meta_list.find_all("li", class_="eventlist-meta-item")
                    for item in meta_items:
                        text = item.get_text(strip=True)
                        # Look for time pattern like "2:00 PM3:00 PM"
                        if re.search(r'\d{1,2}:\d{2}\s*[AP]M', text, re.IGNORECASE):
                            time_str = text
                            break

                # Parse date and time
                start_date, start_time = parse_event_date(date_str, time_str or "")
                if not start_date:
                    logger.debug(f"Could not parse date for: {title}")
                    continue

                # Extract description
                description = None
                desc_elem = article.find("div", class_="eventlist-description")
                if desc_elem:
                    description = desc_elem.get_text(strip=True)

                # Extract image
                image_url = None
                img_elem = article.find("img", class_="eventlist-column-thumbnail-image")
                if img_elem:
                    src = img_elem.get("data-src") or img_elem.get("src")
                    if src:
                        if src.startswith("http"):
                            image_url = src
                        elif src.startswith("//"):
                            image_url = "https:" + src
                        elif src.startswith("/"):
                            image_url = BASE_URL + src

                events_found += 1

                # Determine category and tags
                category, subcategory, tags = determine_category(title, description or "")

                # Generate content hash
                content_hash = generate_content_hash(
                    title, "African Diaspora Art Museum of Atlanta", start_date
                )

                # Build event record
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
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Suggested donation: $10 adults, $5 students/seniors",
                    "is_free": False,  # Suggested donation
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": f"{title} - {description[:200] if description else ''}",
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Check for existing event
                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added event: {title} on {start_date} at {start_time or 'TBD'}")
                except Exception as e:
                    logger.error(f"Failed to insert event: {title}: {e}")

            except Exception as e:
                logger.warning(f"Error parsing event article: {e}")
                continue

        logger.info(
            f"ADAM ATL events: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl ADAM ATL events: {e}")
        # Non-fatal - continue with exhibitions crawl

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ADAM ATL events using requests + BeautifulSoup.

    Note: Exhibitions at /exhibits could be added but would require more complex
    parsing of the Squarespace page layout. For now, focusing on scheduled events
    from /events which have a clear structure.
    """
    source_id = source["id"]

    # Ensure venue exists
    venue_id = get_or_create_venue(VENUE_DATA)

    # Crawl events
    events_found, events_new, events_updated = _crawl_events(source_id, venue_id)

    logger.info(
        f"ADAM ATL crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
