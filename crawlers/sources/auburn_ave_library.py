"""
Crawler for Auburn Avenue Research Library on African American Culture and History.
Part of the Fulton County Library System.
Uses BiblioCommons platform RSS feed for events.

Location: 101 Auburn Ave NE, Atlanta, GA (Sweet Auburn neighborhood)

Events include:
- Community talks and lectures
- Literary discussions and author events
- Educational programs and workshops
- Black history and cultural programming
"""

import logging
import xml.etree.ElementTree as ET
from datetime import datetime
from html import unescape
import re
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://fulcolibrary.bibliocommons.com"
# RSS Feed for Auburn Avenue Research Library events
# types=5faac707c118654500b6f842 filters for events
RSS_FEED_URL = "https://gateway.bibliocommons.com/v2/libraries/fulcolibrary/rss/events?types=5faac707c118654500b6f842"
EVENTS_PAGE_URL = f"{BASE_URL}/v2/events?types=5faac707c118654500b6f842"

VENUE_DATA = {
    "name": "Auburn Avenue Research Library",
    "slug": "auburn-ave-library",
    "address": "101 Auburn Ave NE",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "library",
    "spot_type": "library",
    "website": "https://www.afpls.org/auburn-avenue-research-library",
}


def parse_rss_date(date_str: str) -> tuple[str, str]:
    """
    Parse RSS date format to (date, time) tuple.
    Example formats:
    - "Mon, 27 Jan 2026 18:00:00 -0500"
    - "Wed, 05 Feb 2026 14:00:00 EST"
    Returns (YYYY-MM-DD, HH:MM)
    """
    if not date_str:
        return None, None

    try:
        # Remove timezone names/codes at the end
        date_str = re.sub(r'\s+[A-Z]{2,4}$', '', date_str.strip())

        # Try standard RSS format: "Mon, 27 Jan 2026 18:00:00 -0500"
        try:
            dt = datetime.strptime(date_str.rsplit(' ', 1)[0], "%a, %d %b %Y %H:%M:%S")
        except ValueError:
            # Try without day of week
            dt = datetime.strptime(date_str, "%d %b %Y %H:%M:%S")

        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")

    except Exception as e:
        logger.warning(f"Failed to parse date '{date_str}': {e}")
        return None, None


def extract_location_from_description(description: str) -> str:
    """
    Extract location/branch name from event description.
    We only want Auburn Avenue Research Library events.
    Returns location name if found, None otherwise.
    """
    if not description:
        return None

    # Look for location mentions in description
    text = re.sub(r'<[^>]+>', ' ', description)
    text = unescape(text).strip()

    # Check if Auburn Avenue is mentioned
    if "auburn avenue" in text.lower() or "auburn ave" in text.lower():
        return "Auburn Avenue Research Library"

    # Look for "Location: [name]" pattern
    location_match = re.search(r'Location:\s*([^\n<]+)', text, re.IGNORECASE)
    if location_match:
        location = location_match.group(1).strip()
        if "auburn" in location.lower():
            return "Auburn Avenue Research Library"
        return location

    return None


def is_auburn_avenue_event(title: str, description: str, link: str) -> bool:
    """
    Determine if event is specifically for Auburn Avenue Research Library.
    Fulton County Library System has multiple branches, we only want Auburn Avenue events.
    """
    combined_text = f"{title} {description} {link}".lower()

    # Positive indicators
    if "auburn avenue" in combined_text or "auburn ave" in combined_text:
        return True

    # Check for Auburn-specific topics
    auburn_keywords = [
        "african american",
        "black history",
        "civil rights",
        "sweet auburn",
    ]

    if any(keyword in combined_text for keyword in auburn_keywords):
        # If it mentions African American topics, it's likely Auburn Avenue
        return True

    return False


def determine_category(title: str, description: str) -> tuple[str, str, list[str]]:
    """
    Determine event category, subcategory, and tags based on title and description.
    """
    combined = f"{title} {description}".lower()

    tags = ["library", "educational", "free"]

    # Black History Month events (February)
    if "black history" in combined or "african american history" in combined:
        tags.append("black-history-month")

    # Literary events
    if any(w in combined for w in ["book", "author", "literary", "reading", "poetry", "writer"]):
        tags.append("literary")
        return "words", "reading", tags

    # Educational/lecture events
    if any(w in combined for w in ["lecture", "talk", "speaker", "discussion", "panel"]):
        tags.append("community")
        return "learning", "lecture", tags

    # Film/documentary screenings
    if any(w in combined for w in ["film", "documentary", "screening", "movie"]):
        tags.append("educational")
        return "film", "screening", tags

    # Workshops/classes
    if any(w in combined for w in ["workshop", "class", "training", "tutorial"]):
        return "learning", "workshop", tags

    # Community events
    if any(w in combined for w in ["community", "celebration", "gathering"]):
        tags.append("community")
        return "community", "gathering", tags

    # Default to community/educational
    return "community", "educational", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Auburn Avenue Research Library events from RSS feed."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    # BiblioCommons RSS namespaces
    namespaces = {
        'bc': 'http://bibliocommons.com/rss/1.0/modules/event/'
    }

    try:
        # Fetch RSS feed
        logger.info(f"Fetching Auburn Avenue Research Library RSS feed: {RSS_FEED_URL}")
        response = requests.get(RSS_FEED_URL, headers=headers, timeout=30)
        response.raise_for_status()

        # Parse XML
        root = ET.fromstring(response.content)
        venue_id = get_or_create_venue(VENUE_DATA)

        # BiblioCommons RSS uses standard RSS 2.0 format with bc: namespace
        items = root.findall('.//item')
        logger.info(f"Found {len(items)} total events in Fulton County Library RSS feed")

        for item in items:
            try:
                # Extract basic info
                title_elem = item.find('title')
                link_elem = item.find('link')
                description_elem = item.find('description')

                if title_elem is None or title_elem.text is None:
                    continue

                title = title_elem.text.strip()
                link = link_elem.text if link_elem is not None else EVENTS_PAGE_URL
                description = description_elem.text if description_elem is not None else ""

                # Check location using BiblioCommons namespace
                # <bc:location><bc:id>AUBURN</bc:id><bc:name>Auburn Avenue Research Library</bc:name>
                location_elem = item.find('bc:location', namespaces)
                if location_elem is not None:
                    location_id = location_elem.find('bc:id', namespaces)
                    location_name = location_elem.find('bc:name', namespaces)

                    # Filter for AUBURN location only
                    if location_id is not None and location_id.text != 'AUBURN':
                        logger.debug(f"Skipping non-Auburn event: {title} (location: {location_id.text})")
                        continue
                else:
                    # Fallback to text-based detection
                    if not is_auburn_avenue_event(title, description, link):
                        logger.debug(f"Skipping non-Auburn Avenue event: {title}")
                        continue

                # Parse date from BiblioCommons namespace elements
                # <bc:start_date_local>2026-01-29T18:30</bc:start_date_local>
                start_date = None
                start_time = None
                end_date = None
                end_time = None

                start_local = item.find('bc:start_date_local', namespaces)
                if start_local is not None and start_local.text:
                    # Format: 2026-01-29T18:30
                    try:
                        dt = datetime.strptime(start_local.text, "%Y-%m-%dT%H:%M")
                        start_date = dt.strftime("%Y-%m-%d")
                        start_time = dt.strftime("%H:%M")
                    except ValueError:
                        pass

                end_local = item.find('bc:end_date_local', namespaces)
                if end_local is not None and end_local.text:
                    try:
                        dt = datetime.strptime(end_local.text, "%Y-%m-%dT%H:%M")
                        end_date = dt.strftime("%Y-%m-%d")
                        end_time = dt.strftime("%H:%M")
                    except ValueError:
                        pass

                if not start_date:
                    logger.debug(f"Skipping event without valid date: {title}")
                    continue

                # Filter out past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d")
                    if event_date.date() < datetime.now().date():
                        logger.debug(f"Skipping past event: {title} ({start_date})")
                        continue
                except Exception:
                    pass

                events_found += 1

                # Check for duplicates
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Determine category
                category, subcategory, tags = determine_category(title, description)

                # Clean description text
                desc_text = re.sub(r'<[^>]+>', ' ', description)
                desc_text = unescape(desc_text).strip()
                desc_text = re.sub(r'\s+', ' ', desc_text)

                # Use description or generate one
                if desc_text and len(desc_text) > 50:
                    event_description = desc_text[:500]
                else:
                    event_description = f"{title} at Auburn Avenue Research Library, Atlanta's premier research library dedicated to African American culture and history."

                # All library events are free
                is_free = True

                # Get image from enclosure if available
                image_url = None
                enclosure = item.find('enclosure')
                if enclosure is not None:
                    image_url = enclosure.get('url')
                    # Convert http to https
                    if image_url and image_url.startswith('http://'):
                        image_url = 'https://' + image_url[7:]

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": event_description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": start_time is None,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": link,
                    "ticket_url": None,
                    "image_url": image_url,
                    "raw_text": description[:1000] if description else None,
                    "extraction_confidence": 0.85,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Inserted: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

            except Exception as e:
                logger.error(f"Failed to process event item: {e}", exc_info=True)
                continue

        logger.info(
            f"Auburn Avenue Research Library: Found {events_found} events, "
            f"{events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Auburn Avenue Research Library: {e}", exc_info=True)
        raise

    return events_found, events_new, events_updated
