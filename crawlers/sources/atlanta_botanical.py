"""
Crawler for Atlanta Botanical Garden (atlantabg.org/events).
"""

import re
import logging
from datetime import datetime
from bs4 import BeautifulSoup
from typing import Optional

from utils import fetch_page, slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantabg.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Atlanta Botanical Garden",
    "slug": "atlanta-botanical-garden",
    "address": "1345 Piedmont Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "garden",
    "website": BASE_URL
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date like 'January 13 - February 10' or 'January 17'.
    Returns (start_date, end_date).
    """
    try:
        date_text = date_text.strip()
        now = datetime.now()
        year = now.year

        # Check for date range
        if " - " in date_text:
            parts = date_text.split(" - ")
            start_str = parts[0].strip()
            end_str = parts[1].strip()

            # Parse start
            try:
                start_dt = datetime.strptime(start_str, "%B %d")
                start_dt = start_dt.replace(year=year)
            except ValueError:
                return None, None

            # Parse end - might just have day number
            if end_str.isdigit():
                end_dt = start_dt.replace(day=int(end_str))
            else:
                try:
                    end_dt = datetime.strptime(end_str, "%B %d")
                    end_dt = end_dt.replace(year=year)
                except ValueError:
                    end_dt = start_dt

            # Adjust year if dates are in the past
            if start_dt < now:
                start_dt = start_dt.replace(year=year + 1)
                end_dt = end_dt.replace(year=year + 1)

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

        else:
            # Single date
            try:
                dt = datetime.strptime(date_text, "%B %d")
                dt = dt.replace(year=year)
                if dt < now:
                    dt = dt.replace(year=year + 1)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                return None, None

    except Exception as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")
        return None, None


def extract_events(html: str) -> list[dict]:
    """Extract events from Atlanta Botanical Garden page."""
    soup = BeautifulSoup(html, 'lxml')
    events = []

    # Find event cards
    event_cards = soup.select('.eventCard, [class*="eventCard"]')

    for card in event_cards:
        try:
            # Title - try multiple selectors
            title_el = card.select_one('h3, h4, .eventCard-title, [class*="title"]')
            title = title_el.get_text(strip=True) if title_el else None

            # If no title, try getting from link
            if not title:
                link = card.select_one('a')
                if link:
                    title = link.get('title') or link.get_text(strip=True)

            if not title:
                continue

            # Date
            date_el = card.select_one('.eventCard-date, [class*="date"]')
            start_date = None
            end_date = None
            if date_el:
                date_text = date_el.get_text(strip=True)
                start_date, end_date = parse_date_range(date_text)

            if not start_date:
                continue

            # URL
            link = card.select_one('a')
            source_url = BASE_URL + link.get('href') if link and link.get('href', '').startswith('/') else EVENTS_URL
            if link and link.get('href', '').startswith('http'):
                source_url = link.get('href')

            # Image
            img = card.select_one('img')
            image_url = img.get('src') or img.get('data-src') if img else None

            # Location within garden
            location_el = card.select_one('.eventCard-content-location, [class*="location"]')
            location_note = location_el.get_text(strip=True) if location_el else None

            events.append({
                "title": title,
                "description": location_note,
                "start_date": start_date,
                "end_date": end_date,
                "source_url": source_url,
                "image_url": image_url,
                "is_recurring": end_date is not None,
            })

        except Exception as e:
            logger.warning(f"Failed to parse event card: {e}")
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Botanical Garden events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching Atlanta Botanical Garden: {EVENTS_URL}")
        html = fetch_page(EVENTS_URL)
        all_events = extract_events(html)

        logger.info(f"Found {len(all_events)} events at Atlanta Botanical Garden")

        venue_id = get_or_create_venue(VENUE_DATA)

        for event_data in all_events:
            events_found += 1

            content_hash = generate_content_hash(
                event_data["title"],
                "Atlanta Botanical Garden",
                event_data["start_date"]
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_data["title"],
                "description": event_data.get("description"),
                "start_date": event_data["start_date"],
                "start_time": None,
                "end_date": event_data.get("end_date"),
                "end_time": None,
                "is_all_day": True,
                "category": "community",
                "subcategory": "garden",
                "tags": ["garden", "nature", "outdoor"],
                "price_min": None,
                "price_max": None,
                "price_note": "Garden admission required",
                "is_free": False,
                "source_url": event_data["source_url"],
                "ticket_url": event_data["source_url"],
                "image_url": event_data.get("image_url"),
                "raw_text": None,
                "extraction_confidence": 0.85,
                "is_recurring": event_data.get("is_recurring", False),
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.debug(f"Added: {event_data['title']}")
            except Exception as e:
                logger.error(f"Failed to insert: {event_data['title']}: {e}")

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Botanical Garden: {e}")
        raise

    return events_found, events_new, events_updated
