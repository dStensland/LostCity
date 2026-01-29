"""
Crawler for The Oddities Museum (theodditiesmuseum.org/calendar-of-events).
Nonprofit museum in Chamblee with oddities, curiosities, and unique events.
Uses Squarespace - extracts events from calendar listing page.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://theodditiesmuseum.org"
EVENTS_URL = f"{BASE_URL}/calendar-of-events"

# Maximum events to crawl per run
MAX_EVENTS = 50

# Venue data for The Oddities Museum
ODDITIES_MUSEUM_VENUE = {
    "name": "The Oddities Museum",
    "slug": "oddities-museum",
    "address": "3870 North Peachtree Rd",
    "city": "Chamblee",
    "state": "GA",
    "zip": "30341",
    "venue_type": "museum",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date string like 'Saturday, February 7, 2026' to 'YYYY-MM-DD'."""
    if not date_text:
        return None

    try:
        # Remove day of week if present
        date_text = re.sub(r'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*', '', date_text, flags=re.IGNORECASE)

        # Try common formats
        for fmt in ['%B %d, %Y', '%b %d, %Y', '%m/%d/%Y', '%Y-%m-%d']:
            try:
                dt = datetime.strptime(date_text.strip(), fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue

        return None
    except Exception:
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time string like '12:00 PM' to 'HH:MM:SS' format."""
    if not time_text:
        return None

    try:
        time_text = time_text.strip().upper()

        for fmt in ['%I:%M %p', '%I:%M%p', '%I %p', '%I%p']:
            try:
                dt = datetime.strptime(time_text, fmt)
                return dt.strftime('%H:%M:%S')
            except ValueError:
                continue

        return None
    except Exception:
        return None


def categorize_event(title: str, description: str = '') -> tuple[str, str]:
    """Determine category and subcategory from title and description."""
    combined = f"{title} {description}".lower()

    if any(w in combined for w in ['workshop', 'class', 'preservation', 'craft']):
        return 'art', 'workshop'

    if any(w in combined for w in ['market', 'sale', 'vendor']):
        return 'markets', 'artisan'

    if any(w in combined for w in ['exhibit', 'gallery', 'show', 'opening reception']):
        return 'art', 'exhibition'

    if any(w in combined for w in ['meet', 'greet', 'party', 'social']):
        return 'community', 'social'

    if any(w in combined for w in ['halloween', 'spooky', 'haunted']):
        return 'community', 'seasonal'

    if any(w in combined for w in ['podcast', 'talk', 'lecture']):
        return 'community', 'talk'

    if 'night at the museum' in combined:
        return 'community', 'social'

    # Default for this museum
    return 'art', 'other'


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Oddities Museum calendar page.

    Args:
        source: Source dict with 'id', 'url', 'slug', and optionally 'producer_id'

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source['id']
    source_url = source.get('url', EVENTS_URL)
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

            logger.info(f"Fetching The Oddities Museum events: {source_url}")
            page.goto(source_url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load more events
            for _ in range(5):
                page.evaluate('window.scrollBy(0, 1500)')
                page.wait_for_timeout(1000)

            # Get or create venue
            venue_id = get_or_create_venue(ODDITIES_MUSEUM_VENUE)

            # Find event articles - Squarespace uses article elements for events
            event_articles = page.query_selector_all('article:has(a[href*="/calendar-of-events/"])')
            logger.info(f"Found {len(event_articles)} event articles")

            for article in event_articles[:MAX_EVENTS]:
                try:
                    # Get event link
                    link = article.query_selector('a[href*="/calendar-of-events/"]')
                    if not link:
                        continue

                    event_url = link.get_attribute('href')
                    if event_url and not event_url.startswith('http'):
                        event_url = urljoin(BASE_URL, event_url)

                    # Extract title from heading
                    title_el = article.query_selector('h1, h2, h3, h4')
                    title = title_el.inner_text().strip() if title_el else None

                    if not title:
                        # Try getting from link text or image alt
                        img = article.query_selector('img')
                        if img:
                            title = img.get_attribute('alt')

                    if not title:
                        continue

                    # Extract date and time from list items
                    list_items = article.query_selector_all('li')

                    date_text = None
                    start_time_text = None
                    end_time_text = None
                    location_text = None

                    for li in list_items:
                        text = li.inner_text().strip()

                        # Check for date (contains month name and year)
                        if re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+', text, re.IGNORECASE):
                            date_text = text
                        # Check for time (contains AM/PM)
                        elif re.search(r'\d+:\d+\s*(AM|PM)', text, re.IGNORECASE):
                            # Split by newline or dash to get start/end times
                            times = re.findall(r'\d+:\d+\s*(?:AM|PM)', text, re.IGNORECASE)
                            if len(times) >= 1:
                                start_time_text = times[0]
                            if len(times) >= 2:
                                end_time_text = times[1]
                        # Check for location
                        elif 'museum' in text.lower() or 'map' in text.lower():
                            location_text = text

                    start_date = parse_date(date_text)
                    if not start_date:
                        logger.debug(f"Could not parse date for: {title}")
                        continue

                    events_found += 1

                    start_time = parse_time(start_time_text)
                    end_time = parse_time(end_time_text)

                    # Get description from any remaining text
                    desc_el = article.query_selector('p, .sqs-block-content')
                    description = desc_el.inner_text().strip()[:500] if desc_el else None

                    # Determine category
                    category, subcategory = categorize_event(title, description or '')

                    # Check for free event
                    is_free = 'free' in title.lower() or (description and 'free' in description.lower())

                    # Generate content hash
                    content_hash = generate_content_hash(title, ODDITIES_MUSEUM_VENUE['name'], start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Get image URL
                    img = article.query_selector('img')
                    image_url = None
                    if img:
                        image_url = img.get_attribute('src') or img.get_attribute('data-src')
                        if image_url and not image_url.startswith('http'):
                            image_url = urljoin(BASE_URL, image_url)

                    # Build tags
                    tags = ['chamblee', 'oddities-museum', 'museum', category]
                    if 'oddities' in title.lower() or 'curiosities' in title.lower():
                        tags.append('oddities')
                    if 'market' in title.lower():
                        tags.append('market')

                    # Prepare event record
                    event_record = {
                        'source_id': source_id,
                        'venue_id': venue_id,
                        'producer_id': producer_id,
                        'title': title[:500],
                        'description': description,
                        'start_date': start_date,
                        'start_time': start_time,
                        'end_date': start_date,
                        'end_time': end_time,
                        'is_all_day': start_time is None,
                        'category': category,
                        'subcategory': subcategory,
                        'tags': tags,
                        'price_min': 0 if is_free else None,
                        'price_max': 0 if is_free else None,
                        'price_note': 'Free' if is_free else None,
                        'is_free': is_free,
                        'source_url': event_url,
                        'ticket_url': event_url,
                        'image_url': image_url,
                        'raw_text': None,
                        'extraction_confidence': 0.90,
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
                    logger.error(f"Error processing event article: {e}")
                    continue

            browser.close()

        logger.info(f"Oddities Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl The Oddities Museum: {e}")
        raise

    return events_found, events_new, events_updated
