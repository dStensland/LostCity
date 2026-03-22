"""
Crawler for Emory University Schwartz Center for Performing Arts (schwartz.emory.edu).
Classical music, theater, dance, and performing arts events at Emory.
Fetches tickets.arts.emory.edu with a static HTTP request — the link structure
we rely on is present in the server-rendered HTML.
"""

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from source_destination_sync import ensure_venue_destination_fields
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://schwartz.emory.edu"
TICKETS_URL = "https://tickets.arts.emory.edu/events"
EVENTS_URL = TICKETS_URL  # Use ticket system for event listings
PLANNING_NOTE = (
    "Use the official Emory Arts ticketing page for seating, parking, and campus-arrival details "
    "before heading to the Schwartz Center. Many programs run on Emory's campus schedule rather "
    "than standard standalone-theater assumptions."
)

VENUE_DATA = {
    "name": "Schwartz Center for Performing Arts",
    "slug": "schwartz-center",
    "address": "1700 North Decatur Road NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse various date formats to YYYY-MM-DD."""
    if not date_str:
        return None

    date_str = date_str.strip()

    # Remove day of week if present
    date_str = re.sub(r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*", "", date_str, flags=re.I)

    # Try common formats
    for fmt in [
        "%B %d, %Y",
        "%b %d, %Y",
        "%Y-%m-%d",
        "%m/%d/%Y",
    ]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_str:
        return None

    # Try to match time patterns
    match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)', time_str)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try just hour
    match = re.search(r'(\d{1,2})\s*(AM|PM|am|pm)', time_str)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"

    return None


def categorize_event(title: str, description: str) -> tuple[str, str]:
    """Determine category and subcategory."""
    title_lower = title.lower()
    desc_lower = description.lower()

    # Music events
    if any(word in title_lower for word in [
        "concert", "symphony", "orchestra", "recital", "jazz", "choir",
        "piano", "violin", "chamber", "opera", "musical"
    ]):
        return "music", "concert"

    # Theater
    if any(word in title_lower for word in ["theater", "theatre", "play", "drama"]):
        return "theater", "performance"

    # Dance
    if any(word in title_lower for word in ["dance", "ballet", "contemporary"]):
        return "theater", "dance"

    # Film
    if any(word in title_lower for word in ["film", "screening", "movie"]):
        return "film", "screening"

    # Lectures
    if any(word in title_lower for word in ["lecture", "talk", "discussion"]):
        return "community", "lecture"

    # Default to performing arts
    return "arts", "performance"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Schwartz Center events from tickets.arts.emory.edu."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }
        logger.info(f"Fetching Schwartz Center: {TICKETS_URL}")
        resp = requests.get(TICKETS_URL, headers=headers, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        venue_id = get_or_create_venue(VENUE_DATA)
        ensure_venue_destination_fields(venue_id, planning_notes=PLANNING_NOTE)

        # Sequential parsing - track current event as we find links
        all_links = soup.find_all("a", href=True)
        events_by_title: dict = {}
        current_event: Optional[str] = None
        current_event_url: Optional[str] = None

        for link in all_links:
            href = link.get("href", "")
            text = link.get_text(strip=True)

            if not text or len(text) < 3:
                continue

            # Skip nav links
            if any(
                skip in text.lower()
                for skip in [
                    "skip",
                    "login",
                    "cart",
                    "package",
                    "available now",
                    "view or print",
                    "calendar",
                    "box office",
                    "explore",
                    "education",
                    "support",
                    "schwartz center",
                    "candler concert",
                ]
            ):
                continue

            # Check if this is a date link (contains day of week and time)
            date_match = re.search(
                r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*"
                r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4}),\s*"
                r"(\d{1,2}):(\d{2})(AM|PM)",
                text,
                re.I,
            )

            if date_match:
                # This is a performance date - add to current event
                if current_event:
                    dow, month, day, year, hour, minute, period = date_match.groups()
                    month_map = {
                        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
                    }
                    month_num = month_map.get(month.lower(), 1)
                    start_date = f"{year}-{month_num:02d}-{int(day):02d}"

                    hour_int = int(hour)
                    if period.upper() == "PM" and hour_int != 12:
                        hour_int += 12
                    elif period.upper() == "AM" and hour_int == 12:
                        hour_int = 0
                    start_time = f"{hour_int:02d}:{minute}"

                    is_sold_out = "sold out" in text.lower()

                    if current_event not in events_by_title:
                        events_by_title[current_event] = {
                            "event_url": current_event_url,
                            "performances": [],
                        }
                    events_by_title[current_event]["performances"].append(
                        {
                            "start_date": start_date,
                            "start_time": start_time,
                            "is_sold_out": is_sold_out,
                            "ticket_url": href,
                        }
                    )

            # Check if this is an event title (link to event page, not a date)
            elif "tickets.arts.emory.edu" in href and "/events" not in href:
                # Skip if looks like a date
                if re.search(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)", text):
                    continue
                # This is an event title
                current_event = text
                current_event_url = href

        logger.info(f"Found {len(events_by_title)} unique events with dates")

        # Process each event
        for title, event_data in events_by_title.items():
            try:
                if not event_data["performances"]:
                    continue

                # Use the first performance date
                perf = event_data["performances"][0]
                start_date = perf["start_date"]
                start_time = perf["start_time"]

                events_found += 1

                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                category, subcategory = categorize_event(title, "")

                tags = ["emory", "performing-arts", "druid-hills"]
                if perf["is_sold_out"]:
                    tags.append("sold-out")
                if len(event_data["performances"]) > 1:
                    tags.append("multiple-shows")

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": None,
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
                    "price_note": "Check website for pricing",
                    "is_free": False,
                    "source_url": event_data["event_url"] or TICKETS_URL,
                    "ticket_url": perf.get("ticket_url"),
                    "image_url": None,
                    "raw_text": None,
                    "extraction_confidence": 0.8,
                    "is_recurring": len(event_data["performances"]) > 1,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    # tickets.arts.emory.edu WAF blocks bots — skip enrichment for that domain
                    source_url = event_record.get("source_url", "")
                    if source_url and "tickets.arts.emory.edu" not in source_url:
                        enrich_event_record(event_record, "Schwartz Center")
                    insert_event(event_record)
                    events_new += 1
                    logger.debug(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

            except Exception as e:
                logger.debug(f"Error processing event {title}: {e}")
                continue

        logger.info(
            f"Schwartz Center: Found {events_found} events, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Schwartz Center: {e}")
        raise

    return events_found, events_new, events_updated
