"""
Crawler for ACLU Georgia (acluga.org/events/).
Civil liberties advocacy organization - public meetings, training, and activism events.
Uses standard WordPress HTML structure with pagination.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.acluga.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "ACLU Georgia",
    "slug": "aclu-georgia",
    "address": "PO Box 77208",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30357",
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
}


def parse_datetime(date_str: str, time_str: str = None) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from ACLU Georgia event format.

    Examples:
    - "Feb 03, 2026 | 6:00 PM"
    - "January 28 @ 6:00 pm"
    - "February 15, 2026"
    """
    current_year = datetime.now().year
    start_date = None
    start_time = None

    # Try various date formats
    date_str = date_str.strip()

    # Check if date includes time with pipe separator (e.g., "Feb 03, 2026 | 6:00 PM")
    pipe_match = re.search(r'(.+?)\s*\|\s*(\d{1,2}):(\d{2})\s*(am|pm)', date_str, re.IGNORECASE)
    if pipe_match:
        date_part = pipe_match.group(1).strip()
        hour = int(pipe_match.group(2))
        minute = pipe_match.group(3)
        period = pipe_match.group(4).lower()

        # Convert to 24-hour format
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        start_time = f"{hour:02d}:{minute}"
        date_str = date_part

    # Check if date includes time with @ separator (e.g., "January 28 @ 6:00 pm")
    at_match = re.search(r'(.+?)\s*@\s*(\d{1,2}):(\d{2})\s*(am|pm)', date_str, re.IGNORECASE)
    if at_match and not start_time:
        date_part = at_match.group(1).strip()
        hour = int(at_match.group(2))
        minute = at_match.group(3)
        period = at_match.group(4).lower()

        # Convert to 24-hour format
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        start_time = f"{hour:02d}:{minute}"
        date_str = date_part

    # Parse date
    for fmt in ["%B %d, %Y", "%B %d", "%b %d, %Y", "%b %d", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            # If no year provided, use current or next year
            if fmt in ["%B %d", "%b %d"]:
                dt = dt.replace(year=current_year)
                if dt.date() < datetime.now().date():
                    dt = dt.replace(year=current_year + 1)
            start_date = dt.strftime("%Y-%m-%d")
            break
        except ValueError:
            continue

    # Parse separate time string if provided
    if time_str and not start_time:
        time_match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)', time_str, re.IGNORECASE)
        if time_match:
            hour = int(time_match.group(1))
            minute = time_match.group(2)
            period = time_match.group(3).lower()

            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

            start_time = f"{hour:02d}:{minute}"

    return start_date, start_time


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl ACLU Georgia events using BeautifulSoup."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch multiple pages
        page_num = 1
        max_pages = 5

        while page_num <= max_pages:
            if page_num == 1:
                url = EVENTS_URL
            else:
                url = f"{EVENTS_URL}page/{page_num}/"

            logger.info(f"Fetching ACLU Georgia events page {page_num}: {url}")

            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                logger.warning(f"Failed to fetch page {page_num}: {e}")
                break

            soup = BeautifulSoup(response.text, 'html.parser')

            # Find event items - ACLU uses .card--common divs
            event_items = soup.select('.card--common')

            if not event_items:
                logger.debug(f"No events found on page {page_num}")
                break

            logger.info(f"Found {len(event_items)} potential events on page {page_num}")

            page_has_events = False

            for item in event_items:
                try:
                    # Extract title from h3
                    title_elem = item.find('h3')
                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)

                    # Get event URL from card-overlay-link
                    link = item.find('a', class_='card-overlay-link')
                    source_url = link.get('href', EVENTS_URL) if link else EVENTS_URL
                    if source_url.startswith('/'):
                        source_url = BASE_URL + source_url

                    # Extract date/time from <span class="font-bold">
                    # Format: "Feb 03, 2026 | 6:00 PM"
                    date_elem = item.find('span', class_='font-bold')
                    if not date_elem:
                        logger.debug(f"No date found for: {title}")
                        continue

                    date_text = date_elem.get_text(strip=True)

                    start_date, start_time = parse_datetime(date_text)

                    if not start_date:
                        logger.debug(f"Could not parse date for: {title}")
                        continue

                    page_has_events = True
                    events_found += 1

                    # Extract description from .line-clamp-3 div (contains description text)
                    desc_elem = item.find('div', class_=re.compile(r'line-clamp'))
                    if not desc_elem:
                        desc_elem = item.find('div', class_=re.compile(r'color-secondary'))

                    description = desc_elem.get_text(strip=True) if desc_elem else ""
                    if len(description) > 500:
                        description = description[:497] + "..."

                    if not description:
                        description = f"{title} - ACLU Georgia advocacy event"

                    # Extract image
                    img_elem = item.find('img')
                    if img_elem:
                        image_url = img_elem.get('src')
                        # Convert relative URLs
                        if image_url and image_url.startswith('/'):
                            image_url = BASE_URL + image_url
                    else:
                        image_url = None

                    # Generate content hash
                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                    # Check for existing event
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Check for free/pricing info
                    text_content = f"{title} {description}".lower()
                    is_free = any(word in text_content for word in ["free", "no charge", "no cost"])

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
                        "category": "activism",
                        "subcategory": None,
                        "tags": ["activism", "civil-liberties", "advocacy", "aclu"],
                        "price_min": None,
                        "price_max": None,
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

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.debug(f"Error processing event item: {e}")
                    continue

            # Check if there are more pages
            if not page_has_events:
                break

            # Look for pagination links
            next_link = soup.find('a', class_=re.compile(r'next|pagination-next'))
            if not next_link:
                next_link = soup.find('a', string=re.compile(r'Next|›|»', re.IGNORECASE))

            if not next_link:
                break

            page_num += 1

        logger.info(
            f"ACLU Georgia crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl ACLU Georgia: {e}")
        raise

    return events_found, events_new, events_updated
