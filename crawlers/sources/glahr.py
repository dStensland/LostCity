"""
Crawler for Georgia Latino Alliance for Human Rights (glahr.org/events/).
Immigration rights and Latinx community organizing events.
Uses The Events Calendar WordPress plugin.
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

BASE_URL = "https://glahr.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "GLAHR - Georgia Latino Alliance for Human Rights",
    "slug": "glahr",
    "address": "2330 Cheshire Bridge Rd NE",
    "neighborhood": "Cheshire Bridge",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
}


def parse_datetime(datetime_text: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Parse datetime from The Events Calendar format.

    Examples:
    - "January 28 @ 6:00 pm - 8:00 pm"
    - "February 15, 2026"
    """
    current_year = datetime.now().year

    # Remove extra whitespace
    text = datetime_text.strip()

    # Match patterns like "January 28 @ 6:00 pm - 8:00 pm"
    match = re.match(
        r'(\w+)\s+(\d+)(?:,\s*(\d{4}))?\s+@\s+(\d+):(\d+)\s+(am|pm)(?:\s*-\s*(\d+):(\d+)\s+(am|pm))?',
        text,
        re.IGNORECASE
    )

    if match:
        month_name = match.group(1)
        day = match.group(2)
        year = match.group(3) if match.group(3) else current_year
        start_hour = int(match.group(4))
        start_min = match.group(5)
        start_period = match.group(6).lower()

        # Parse start date and time
        try:
            dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_name} {day} {int(year) + 1}", "%B %d %Y")

            start_date = dt.strftime("%Y-%m-%d")

            # Convert 12-hour to 24-hour
            if start_period == "pm" and start_hour != 12:
                start_hour += 12
            elif start_period == "am" and start_hour == 12:
                start_hour = 0

            start_time = f"{start_hour:02d}:{start_min}"

            # Parse end time if exists
            end_date = None
            end_time = None

            if match.group(7):  # End time exists
                end_hour = int(match.group(7))
                end_min = match.group(8)
                end_period = match.group(9).lower()

                if end_period == "pm" and end_hour != 12:
                    end_hour += 12
                elif end_period == "am" and end_hour == 12:
                    end_hour = 0

                end_time = f"{end_hour:02d}:{end_min}"

                # If end time is earlier than start time, assume next day
                if end_time < start_time:
                    end_dt = dt.replace(day=dt.day + 1)
                    end_date = end_dt.strftime("%Y-%m-%d")
                else:
                    end_date = start_date

            return start_date, start_time, end_date, end_time

        except ValueError as e:
            logger.warning(f"Failed to parse datetime '{text}': {e}")
            return None, None, None, None

    # Try simpler date-only format
    for fmt in ["%B %d, %Y", "%B %d", "%b %d, %Y", "%b %d"]:
        try:
            dt = datetime.strptime(text, fmt)
            if fmt in ["%B %d", "%b %d"]:
                dt = dt.replace(year=current_year)
                if dt.date() < datetime.now().date():
                    dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d"), None, None, None
        except ValueError:
            continue

    return None, None, None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl GLAHR events using BeautifulSoup."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching GLAHR events: {EVENTS_URL}")

        try:
            response = requests.get(EVENTS_URL, timeout=30)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch GLAHR events: {e}")
            raise

        soup = BeautifulSoup(response.text, 'html.parser')

        # The Events Calendar plugin uses specific classes
        event_articles = soup.select('article.tribe-events-calendar-list__event')

        # Fallback selectors if using different theme
        if not event_articles:
            event_articles = soup.select('.tribe-event, article.event, .event-item')

        logger.info(f"Found {len(event_articles)} events")

        for article in event_articles:
            try:
                # Extract title and URL
                title_elem = article.find(class_=re.compile(r'event.*title|tribe.*title'))
                if not title_elem:
                    title_elem = article.find(['h2', 'h3', 'h4'])

                if not title_elem:
                    continue

                link = title_elem.find('a')
                if link:
                    title = link.get_text(strip=True)
                    source_url = link.get('href', EVENTS_URL)
                else:
                    title = title_elem.get_text(strip=True)
                    source_url = EVENTS_URL

                if source_url.startswith('/'):
                    source_url = BASE_URL + source_url

                # Extract datetime
                datetime_elem = article.find(class_=re.compile(r'date.*time|event.*date|tribe.*date'))
                if not datetime_elem:
                    datetime_elem = article.find('time')

                if not datetime_elem:
                    logger.debug(f"No datetime found for: {title}")
                    continue

                datetime_text = datetime_elem.get_text(strip=True)

                # Check for datetime attribute
                datetime_attr = datetime_elem.get('datetime')
                if datetime_attr:
                    datetime_text = datetime_attr

                start_date, start_time, end_date, end_time = parse_datetime(datetime_text)

                if not start_date:
                    logger.debug(f"Could not parse datetime for: {title}")
                    continue

                events_found += 1

                # Extract description
                desc_elem = article.find(class_=re.compile(r'description|excerpt|summary'))
                if not desc_elem:
                    desc_elem = article.find('p')

                description = desc_elem.get_text(strip=True) if desc_elem else ""
                if len(description) > 500:
                    description = description[:497] + "..."

                if not description:
                    description = f"{title} - GLAHR community event"

                # Extract image
                img_elem = article.find('img')
                image_url = img_elem.get('src') if img_elem else None

                # Generate content hash
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                # Check for existing event
                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

                # Check if free
                text_content = f"{title} {description}".lower()
                is_free = any(word in text_content for word in ["free", "gratis", "no cost"])

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": start_time is None,
                    "category": "activism",
                    "subcategory": None,
                    "tags": ["activism", "immigration-rights", "latinx", "community-organizing"],
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
                logger.debug(f"Error processing event: {e}")
                continue

        logger.info(
            f"GLAHR crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl GLAHR: {e}")
        raise

    return events_found, events_new, events_updated
