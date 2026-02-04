"""
Crawler for Georgia Tech Campus Events (calendar.gatech.edu).
Lectures, arts, campus activities, and public events.
Georgia Tech uses a Drupal-based calendar system with RSS feeds.
"""

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from html import unescape
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://calendar.gatech.edu"
RSS_FEED_URL = "https://calendar.gatech.edu/event-calendar-day.xml"

VENUE_DATA = {
    "name": "Georgia Tech",
    "slug": "georgia-tech",
    "address": "North Avenue NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30332",
    "venue_type": "university",
    "website": "https://gatech.edu",
}


def parse_time_element(description: str) -> tuple[str, str, str, str]:
    """
    Extract start and end datetime information from RSS description.
    Returns (start_date, start_time, end_date, end_time)
    """
    # Look for Event time block with datetime attributes
    # Pattern: <time datetime="2026-01-22T21:00:00Z">Thu, 01/22/2026 - 16:00</time>
    time_pattern = r'Event time.*?<time datetime="([^"]+)">([^<]+)</time>\s*-\s*<time datetime="([^"]+)">([^<]+)</time>'
    match = re.search(time_pattern, description, re.DOTALL)

    if not match:
        return None, None, None, None

    start_iso = match.group(1)  # e.g., "2026-01-22T21:00:00Z"
    end_iso = match.group(3)

    # Parse ISO format datetime
    try:
        start_dt = datetime.fromisoformat(start_iso.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_iso.replace('Z', '+00:00'))

        # Convert to local time (EST/EDT)
        # The times in the feed are UTC, but the displayed times are EST
        # From the example: datetime="2026-01-22T21:00:00Z" shows as "16:00" (5 hours behind)

        start_date = start_dt.strftime("%Y-%m-%d")
        start_time = start_dt.strftime("%H:%M:%S")
        end_date = end_dt.strftime("%Y-%m-%d")
        end_time = end_dt.strftime("%H:%M:%S")

        # Check if it's an all-day event (starts at 00:00 and ends at 23:59 or similar)
        if (start_dt.hour == 5 and start_dt.minute == 0 and
            end_dt.hour == 4 and end_dt.minute == 59):
            # This is an all-day event (midnight to 11:59pm in EST)
            return start_date, None, end_date, None

        return start_date, start_time, end_date, end_time

    except Exception as e:
        logger.warning(f"Failed to parse datetime: {e}")
        return None, None, None, None


def extract_location_from_description(description: str) -> str:
    """Try to extract location from description HTML."""
    # Some events have location in the title or description
    # Clean HTML tags and look for common location patterns
    text = re.sub(r'<[^>]+>', ' ', description)
    text = unescape(text)

    # Look for common location patterns
    # E.g., "at Klaus Atrium", "- Room 123", etc.
    location_match = re.search(r'\bat\s+([A-Z][^\.,;]+(?:Atrium|Hall|Building|Room|Center|Lab|Theatre|Theater))', text, re.IGNORECASE)
    if location_match:
        return location_match.group(1).strip()

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Tech campus events calendar via RSS feed."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        # Fetch RSS feed
        response = requests.get(RSS_FEED_URL, headers=headers, timeout=30)
        response.raise_for_status()

        # Parse XML
        root = ET.fromstring(response.content)
        venue_id = get_or_create_venue(VENUE_DATA)

        # Get all items (events) from the feed
        items = root.findall('.//item')
        logger.info(f"Found {len(items)} events in RSS feed")

        for item in items:
            try:
                # Extract basic info
                title_elem = item.find('title')
                link_elem = item.find('link')
                description_elem = item.find('description')

                if title_elem is None or title_elem.text is None:
                    continue

                title = title_elem.text.strip()
                link = link_elem.text if link_elem is not None else BASE_URL
                description = description_elem.text if description_elem is not None else ""

                # Parse datetime info
                start_date, start_time, end_date, end_time = parse_time_element(description)

                if not start_date:
                    logger.debug(f"Skipping event without valid date: {title}")
                    continue

                # Filter out past events - but keep multi-day events if they haven't ended yet
                try:
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d") if end_date else start_dt
                    today = datetime.now().date()

                    # Skip if event ended before today
                    if end_dt.date() < today:
                        logger.debug(f"Skipping past event: {title} (ended {end_date})")
                        continue
                except Exception as e:
                    logger.warning(f"Date parsing error for {title}: {e}")
                    pass

                events_found += 1

                # Check if event already exists
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Extract location if available
                location_text = extract_location_from_description(description)

                # Determine if it's all-day
                is_all_day = False

                # Determine category based on title
                title_lower = title.lower()
                if any(w in title_lower for w in ["lecture", "seminar", "talk", "speaker", "colloquium"]):
                    category, subcategory = "community", "lecture"
                elif any(w in title_lower for w in ["concert", "music", "performance", "recital"]):
                    category, subcategory = "music", "concert"
                elif any(w in title_lower for w in ["workshop", "class", "training", "bootcamp"]):
                    category, subcategory = "community", "workshop"
                elif any(w in title_lower for w in ["exhibit", "exhibition", "museum", "gallery"]):
                    category, subcategory = "arts", "visual-art"
                elif any(w in title_lower for w in ["hackathon", "competition"]):
                    category, subcategory = "community", "meetup"
                elif any(w in title_lower for w in ["conference", "symposium", "meeting"]):
                    category, subcategory = "community", "conference"
                elif any(w in title_lower for w in ["career", "job", "professional"]):
                    category, subcategory = "community", "networking"
                else:
                    category, subcategory = "community", "campus"

                # Build tags
                tags = ["college", "georgia-tech", "midtown"]
                if "hackathon" in title_lower:
                    tags.append("tech")
                if "career" in title_lower or "job" in title_lower:
                    tags.append("professional-development")

                # Clean description text
                desc_text = re.sub(r'<[^>]+>', ' ', description)
                desc_text = unescape(desc_text).strip()
                desc_text = re.sub(r'\s+', ' ', desc_text)

                # Use first 500 chars of description
                if desc_text and len(desc_text) > 50:
                    event_description = desc_text[:500]
                else:
                    event_description = f"{title} at Georgia Tech"
                    if location_text:
                        event_description += f" - {location_text}"

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": event_description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": is_all_day,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": link,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": description[:1000] if description else None,
                    "extraction_confidence": 0.85,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.debug(f"Inserted: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

            except Exception as e:
                logger.error(f"Failed to process event item: {e}", exc_info=True)
                continue

        logger.info(f"Georgia Tech Events: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Tech Events: {e}", exc_info=True)
        raise

    return events_found, events_new, events_updated
