"""
Crawler for Avalon in Alpharetta (experienceavalon.com).
Mixed-use development with events, concerts, seasonal activities.
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

BASE_URL = "https://experienceavalon.com"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Avalon",
    "slug": "avalon-alpharetta",
    "address": "2200 Avalon Blvd",
    "neighborhood": "Alpharetta",
    "city": "Alpharetta",
    "state": "GA",
    "zip": "30009",
    "lat": 34.0708,
    "lng": -84.2752,
    "venue_type": "shopping",
    "spot_type": "mixed_use",
    "website": BASE_URL,
}


def parse_date_range(date_div) -> tuple[Optional[str], Optional[str]]:
    """Parse start and end dates from the event-date div."""
    # Check for day-wrapper (multi-day events)
    day_wrapper = date_div.find('div', class_='day-wrapper')

    if day_wrapper:
        start_div = day_wrapper.find('div', class_='start')
        end_div = day_wrapper.find('div', class_='end')
    else:
        # Single-day events have start div directly under date div
        start_div = date_div.find('div', class_='start')
        end_div = None

    start_date = None
    end_date = None
    current_year = datetime.now().year

    # Parse start date
    if start_div:
        month_span = start_div.find('span', class_='month')
        day_span = start_div.find('span', class_='day')
        if month_span and day_span:
            try:
                month_text = month_span.get_text(strip=True)
                day_text = day_span.get_text(strip=True)
                dt = datetime.strptime(f"{month_text} {day_text} {current_year}", "%b %d %Y")

                # If date is in the past, assume next year
                if dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{month_text} {day_text} {current_year + 1}", "%b %d %Y")

                start_date = dt.strftime("%Y-%m-%d")
            except ValueError as e:
                logger.warning(f"Failed to parse start date: {month_text} {day_text}: {e}")

    # Parse end date if exists
    if end_div:
        month_span = end_div.find('span', class_='month')
        day_span = end_div.find('span', class_='day')
        if month_span and day_span:
            try:
                month_text = month_span.get_text(strip=True)
                day_text = day_span.get_text(strip=True)

                # Use the year from start_date to handle year transitions
                year = current_year
                if start_date:
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                    year = start_dt.year

                    # If end month is earlier than start month, assume next year
                    month_num = datetime.strptime(month_text, "%b").month
                    if month_num < start_dt.month:
                        year += 1

                dt = datetime.strptime(f"{month_text} {day_text} {year}", "%b %d %Y")
                end_date = dt.strftime("%Y-%m-%d")
            except ValueError as e:
                logger.warning(f"Failed to parse end date: {month_text} {day_text}: {e}")

    return start_date, end_date


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    combined = f"{title} {description}".lower()
    tags = ["avalon", "alpharetta", "shopping", "mixed-use"]

    if any(w in combined for w in ["concert", "music", "live", "band", "performance"]):
        return "music", "live", tags + ["live-music"]
    if any(w in combined for w in ["market", "makers", "pop-up", "vendor"]):
        return "community", "market", tags + ["market"]
    if any(w in combined for w in ["festival", "holiday", "seasonal", "lights", "ice skating"]):
        return "community", "festival", tags + ["festival"]
    if any(w in combined for w in ["family", "kids", "children"]):
        return "family", None, tags + ["family"]
    if any(w in combined for w in ["food", "dining", "tasting", "wine"]):
        return "food_drink", "tasting", tags + ["food"]
    if any(w in combined for w in ["fashion", "style", "shopping"]):
        return "community", "shopping", tags + ["fashion"]
    if any(w in combined for w in ["yoga", "fitness", "wellness"]):
        return "fitness", None, tags + ["fitness"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Avalon events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Avalon events from {EVENTS_URL}")

        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        events_list = soup.find('div', id='events-list')

        if not events_list:
            logger.warning("No events-list div found")
            return 0, 0, 0

        event_items = events_list.find_all('div', class_='event-item')
        logger.info(f"Found {len(event_items)} events on page")

        for event_item in event_items:
            try:
                # Extract basic info
                title_tag = event_item.find('h3')
                if not title_tag:
                    continue

                title = title_tag.get_text(strip=True)

                # Skip non-event items (like store hours)
                if any(skip in title.lower() for skip in ["store hours", "hours:"]):
                    continue

                link_tag = event_item.find('a')
                source_url = link_tag.get('href') if link_tag else EVENTS_URL

                # Get description
                desc_tag = event_item.find('div', class_='event-description')
                description = desc_tag.get_text(strip=True) if desc_tag else ""

                # Get image
                img_tag = event_item.find('img')
                image_url = None
                if img_tag:
                    image_url = img_tag.get('data-src') or img_tag.get('src')

                # Parse dates
                date_div = event_item.find('div', class_='event-date')
                if not date_div:
                    logger.warning(f"No date found for event: {title}")
                    continue

                start_date, end_date = parse_date_range(date_div)

                if not start_date:
                    logger.warning(f"Could not parse date for event: {title}")
                    continue

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(title, "Avalon", start_date)

                # Check for existing event

                # Determine category
                category, subcategory, tags = determine_category(title, description)

                # Check for free events
                is_free = any(word in f"{title} {description}".lower() for word in ["free", "complimentary"])

                # Check for pricing
                price_match = re.search(r'\$(\d+(?:\.\d{2})?)', f"{title} {description}")
                price_min = None
                price_max = None
                if price_match:
                    price_min = float(price_match.group(1))
                    price_max = price_min

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description if description else "Event at Avalon in Alpharetta",
                    "start_date": start_date,
                    "start_time": None,  # Time not available on listing page
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": True,  # Default to all-day since no time info
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "image_url": image_url,
                    "raw_text": f"{title} - {description}",
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
                logger.error(f"Error processing event: {e}")
                continue

        logger.info(
            f"Avalon crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Avalon: {e}")
        raise

    return events_found, events_new, events_updated
