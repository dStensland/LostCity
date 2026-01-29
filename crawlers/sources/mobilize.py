"""
Crawler for Mobilize.us organization pages.
Supports multiple organizations using Mobilize for event management.
Extracts structured JSON-LD data from individual event pages.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, get_or_create_virtual_venue
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Maximum events to crawl per source to avoid timeouts
MAX_EVENTS_PER_SOURCE = 50


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


def extract_event_links(page) -> list[str]:
    """Extract event URLs from a Mobilize organization page."""
    links = page.query_selector_all('a[href*="/event/"]')
    urls = set()

    for link in links:
        href = link.get_attribute('href')
        if href and '/event/' in href:
            # Convert relative URLs to absolute
            if href.startswith('/'):
                href = f"https://www.mobilize.us{href}"
            urls.add(href)

    return list(urls)


def extract_json_ld(page) -> Optional[dict]:
    """Extract JSON-LD Event data from page."""
    scripts = page.query_selector_all('script[type="application/ld+json"]')

    for script in scripts:
        try:
            content = script.inner_text()
            data = json.loads(content)

            # Handle array format (Mobilize wraps in array)
            if isinstance(data, list) and len(data) > 0:
                data = data[0]

            # Check if it's an Event type
            if isinstance(data, dict) and data.get('@type') == 'Event':
                return data
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"Failed to parse JSON-LD: {e}")
            continue

    return None


def get_venue_from_json_ld(location_data: dict) -> dict:
    """Convert JSON-LD location to venue data."""
    if not location_data:
        return None

    address = location_data.get('address', {})

    venue_data = {
        'name': location_data.get('name', 'TBD'),
        'address': address.get('streetAddress'),
        'city': address.get('addressLocality', 'Atlanta'),
        'state': address.get('addressRegion', 'GA'),
        'zip': address.get('postalCode'),
        'venue_type': 'event_space',
    }

    # Generate slug from name
    name = venue_data['name']
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    venue_data['slug'] = slug

    return venue_data


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl a Mobilize.us organization page for events.

    Args:
        source: Source dict with 'id', 'url', 'slug', and optionally 'producer_id'

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source['id']
    source_url = source['url']
    source_slug = source.get('slug', 'mobilize')
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

            logger.info(f"Fetching Mobilize org page: {source_url}")
            page.goto(source_url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)  # Wait for dynamic content

            # Scroll to load more events
            for _ in range(3):
                page.evaluate('window.scrollBy(0, 1000)')
                page.wait_for_timeout(1000)

            # Extract event links
            event_urls = extract_event_links(page)
            logger.info(f"Found {len(event_urls)} event links on {source_slug}")

            # Limit events to prevent timeout
            event_urls = event_urls[:MAX_EVENTS_PER_SOURCE]

            for event_url in event_urls:
                try:
                    logger.debug(f"Fetching event: {event_url}")
                    page.goto(event_url, wait_until='domcontentloaded', timeout=30000)
                    page.wait_for_timeout(2000)

                    # Extract JSON-LD
                    event_data = extract_json_ld(page)
                    if not event_data:
                        logger.warning(f"No JSON-LD found for {event_url}")
                        continue

                    events_found += 1

                    # Parse event data
                    title = event_data.get('name', '').strip()
                    description = event_data.get('description', '').strip()

                    start_date, start_time = parse_datetime(event_data.get('startDate'))
                    end_date, end_time = parse_datetime(event_data.get('endDate'))

                    if not title or not start_date:
                        logger.warning(f"Missing title or date for {event_url}")
                        continue

                    # Get venue
                    location_data = event_data.get('location')
                    is_virtual = event_data.get('eventAttendanceMode') == 'https://schema.org/OnlineEventAttendanceMode'

                    if is_virtual:
                        venue_id = get_or_create_virtual_venue()
                    elif location_data:
                        venue_data = get_venue_from_json_ld(location_data)
                        if venue_data:
                            venue_id = get_or_create_venue(venue_data)
                        else:
                            venue_id = None
                    else:
                        venue_id = None

                    # Get image
                    images = event_data.get('image', [])
                    image_url = images[0] if images else None

                    # Generate content hash for deduplication
                    venue_name = location_data.get('name', 'Mobilize') if location_data else 'Mobilize'
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
                        'title': title,
                        'description': description[:2000] if description else None,
                        'start_date': start_date,
                        'start_time': start_time,
                        'end_date': end_date,
                        'end_time': end_time,
                        'is_all_day': False,
                        'category': 'community',
                        'subcategory': 'activism',
                        'tags': ['activism', 'volunteer', 'civic-engagement', 'mobilize'],
                        'price_min': None,
                        'price_max': None,
                        'price_note': None,
                        'is_free': True,  # Most Mobilize events are free
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
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event {event_url}: {e}")
                    continue

            browser.close()

        logger.info(f"Mobilize crawl complete for {source_slug}: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Mobilize source {source_slug}: {e}")
        raise

    return events_found, events_new, events_updated
