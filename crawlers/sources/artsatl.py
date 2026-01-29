"""
Crawler for ArtsATL Calendar (artsatl.org/calendar).
Atlanta's leading arts journalism site with a comprehensive community calendar.
Uses The Events Calendar (Tribe) WordPress plugin with JSON-LD structured data.
"""

from __future__ import annotations

import html
import json
import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.artsatl.org"
CALENDAR_URL = f"{BASE_URL}/calendar/"

# Maximum pages to crawl to avoid timeouts
MAX_PAGES = 5
MAX_EVENTS_PER_PAGE = 50


def parse_datetime(iso_string: str) -> tuple[Optional[str], Optional[str]]:
    """Parse ISO datetime string to date and time components."""
    if not iso_string:
        return None, None

    try:
        # Parse ISO format with timezone
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
        date_str = dt.strftime('%Y-%m-%d')
        time_str = dt.strftime('%H:%M:%S')
        return date_str, time_str
    except (ValueError, AttributeError):
        return None, None


def clean_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    if not text:
        return ""
    # Decode HTML entities
    text = html.unescape(text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_json_ld_events(page) -> list[dict]:
    """Extract all Event JSON-LD objects from the page."""
    events = []
    scripts = page.query_selector_all('script[type="application/ld+json"]')

    for script in scripts:
        try:
            content = script.inner_text()
            data = json.loads(content)

            # Handle array format (ArtsATL returns array of events)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get('@type') == 'Event':
                        events.append(item)
            elif isinstance(data, dict) and data.get('@type') == 'Event':
                events.append(data)
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"Failed to parse JSON-LD: {e}")
            continue

    return events


def get_venue_from_json_ld(location_data: dict) -> Optional[dict]:
    """Convert JSON-LD location to venue data."""
    if not location_data or location_data.get('@type') != 'Place':
        return None

    address = location_data.get('address', {})
    if isinstance(address, str):
        # Sometimes address is just a string
        address = {'streetAddress': address}

    venue_name = location_data.get('name', 'TBD')
    # Clean HTML entities from venue name
    venue_name = html.unescape(venue_name)

    venue_data = {
        'name': venue_name,
        'address': address.get('streetAddress'),
        'city': address.get('addressLocality', 'Atlanta'),
        'state': address.get('addressRegion', 'GA'),
        'zip': address.get('postalCode'),
        'website': location_data.get('sameAs') or location_data.get('url'),
        'venue_type': 'event_space',
    }

    # Generate slug from name
    slug = re.sub(r'[^a-z0-9]+', '-', venue_name.lower()).strip('-')
    venue_data['slug'] = slug[:100]  # Limit slug length

    return venue_data


def categorize_event(event_data: dict) -> tuple[str, str]:
    """Determine category and subcategory from event data."""
    name = (event_data.get('name') or '').lower()
    description = (event_data.get('description') or '').lower()
    organizer_name = ''
    if event_data.get('organizer'):
        organizer_name = (event_data['organizer'].get('name') or '').lower()

    combined = f"{name} {description} {organizer_name}"

    # Theater/Performance
    if any(w in combined for w in ['theatre', 'theater', 'play', 'musical', 'stage', 'drama', 'comedy show', 'improv']):
        return 'theater', 'play'

    # Dance
    if any(w in combined for w in ['dance', 'ballet', 'choreograph']):
        return 'theater', 'dance'

    # Music
    if any(w in combined for w in ['concert', 'symphony', 'orchestra', 'jazz', 'live music', 'band', 'singer']):
        return 'music', 'concert'

    # Film
    if any(w in combined for w in ['film', 'movie', 'screening', 'cinema']):
        return 'film', 'screening'

    # Visual Art
    if any(w in combined for w in ['exhibition', 'exhibit', 'gallery', 'art show', 'opening reception', 'artist talk']):
        return 'art', 'exhibition'

    # Books/Literary
    if any(w in combined for w in ['book', 'author', 'reading', 'poetry', 'literary', 'bookshop', 'bookstore']):
        return 'art', 'literary'

    # Default to art category for ArtsATL
    return 'art', 'other'


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ArtsATL calendar for events.

    Args:
        source: Source dict with 'id', 'url', 'slug', and optionally 'producer_id'

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source['id']
    source_url = source.get('url', CALENDAR_URL)
    producer_id = source.get('producer_id')

    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                viewport={'width': 1920, 'height': 1080},
            )
            page = context.new_page()

            current_url = source_url
            pages_crawled = 0

            while current_url and pages_crawled < MAX_PAGES:
                logger.info(f"Fetching ArtsATL calendar page {pages_crawled + 1}: {current_url}")
                page.goto(current_url, wait_until='domcontentloaded', timeout=30000)
                page.wait_for_timeout(3000)

                # Extract JSON-LD events from this page
                page_events = extract_json_ld_events(page)
                logger.info(f"Found {len(page_events)} events on page {pages_crawled + 1}")

                for event_data in page_events[:MAX_EVENTS_PER_PAGE]:
                    try:
                        # Parse event data
                        title = clean_html(event_data.get('name', ''))
                        description = clean_html(event_data.get('description', ''))

                        start_date, start_time = parse_datetime(event_data.get('startDate'))
                        end_date, end_time = parse_datetime(event_data.get('endDate'))

                        if not title or not start_date:
                            continue

                        events_found += 1

                        # Get venue
                        location_data = event_data.get('location')
                        venue_id = None
                        venue_name = 'ArtsATL'

                        if location_data:
                            venue_data = get_venue_from_json_ld(location_data)
                            if venue_data:
                                venue_name = venue_data['name']
                                venue_id = get_or_create_venue(venue_data)

                        # Get image
                        image_url = event_data.get('image')

                        # Get event URL
                        event_url = event_data.get('url', source_url)

                        # Get price info
                        price_min = None
                        price_max = None
                        is_free = False
                        offers = event_data.get('offers')
                        if offers:
                            if isinstance(offers, dict):
                                price = offers.get('price')
                                if price is not None:
                                    try:
                                        price_val = float(price)
                                        price_min = price_val
                                        price_max = price_val
                                        is_free = price_val == 0
                                    except (ValueError, TypeError):
                                        pass

                        # Determine category
                        category, subcategory = categorize_event(event_data)

                        # Generate content hash for deduplication
                        content_hash = generate_content_hash(title, venue_name, start_date)

                        # Check for existing event
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            continue

                        # Prepare event record
                        event_record = {
                            'source_id': source_id,
                            'venue_id': venue_id,
                            'producer_id': producer_id,
                            'title': title[:500],
                            'description': description[:2000] if description else None,
                            'start_date': start_date,
                            'start_time': start_time,
                            'end_date': end_date,
                            'end_time': end_time,
                            'is_all_day': start_time is None or start_time == '00:00:00',
                            'category': category,
                            'subcategory': subcategory,
                            'tags': ['arts', 'artsatl', category],
                            'price_min': price_min,
                            'price_max': price_max,
                            'price_note': None,
                            'is_free': is_free,
                            'source_url': event_url,
                            'ticket_url': event_url,
                            'image_url': image_url,
                            'raw_text': None,
                            'extraction_confidence': 0.95,
                            'is_recurring': False,
                            'recurrence_rule': None,
                            'content_hash': content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title[:50]}... on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert event: {title[:50]}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event: {e}")
                        continue

                # Look for "next page" link
                pages_crawled += 1
                next_link = page.query_selector('a.tribe-events-c-nav__next')
                if next_link:
                    next_href = next_link.get_attribute('href')
                    if next_href and next_href != current_url:
                        current_url = next_href
                    else:
                        current_url = None
                else:
                    current_url = None

            browser.close()

        logger.info(f"ArtsATL crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl ArtsATL: {e}")
        raise

    return events_found, events_new, events_updated
