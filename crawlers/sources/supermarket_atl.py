"""
Crawler for The Supermarket ATL (thesupermarketatl.com/events).
Multi-use arts venue in East Point with comedy, music, markets, and community events.
Uses Webflow - extracts data from structured DOM elements.
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

BASE_URL = "https://www.thesupermarketatl.com"
EVENTS_URL = f"{BASE_URL}/events"

# Maximum events to crawl per run
MAX_EVENTS = 50

# Venue data for The Supermarket
SUPERMARKET_VENUE = {
    "name": "The Supermarket",
    "slug": "the-supermarket-atl",
    "address": "3428 Main St",
    "city": "East Point",
    "state": "GA",
    "zip": "30344",
    "venue_type": "event_space",
    "website": BASE_URL,
}


def parse_date_from_widget(month_text: str, day_text: str, year: int = None) -> Optional[str]:
    """Parse date from month abbreviation and day number."""
    if not month_text or not day_text:
        return None

    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
        'may': 5, 'jun': 6, 'jul': 7, 'aug': 8,
        'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }

    try:
        month = month_map.get(month_text.lower().strip()[:3])
        day = int(day_text.strip())
        if not month:
            return None

        # Default to current year, but handle year rollover
        if year is None:
            year = datetime.now().year
            # If the month is in the past, assume next year
            current_month = datetime.now().month
            if month < current_month:
                year += 1

        return f"{year:04d}-{month:02d}-{day:02d}"
    except (ValueError, AttributeError):
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time string like '7:00 PM' to 'HH:MM:SS' format."""
    if not time_text:
        return None

    try:
        # Clean up the text
        time_text = time_text.strip().upper()

        # Try common formats
        for fmt in ['%I:%M %p', '%I:%M%p', '%I %p', '%I%p']:
            try:
                dt = datetime.strptime(time_text, fmt)
                return dt.strftime('%H:%M:%S')
            except ValueError:
                continue

        return None
    except Exception:
        return None


def extract_price(price_text: str) -> tuple[Optional[float], Optional[float], bool]:
    """Extract price info from text like 'Prices start from: $15'."""
    if not price_text:
        return None, None, False

    price_text = price_text.lower()

    # Check for free
    if 'free' in price_text:
        return 0, 0, True

    # Extract dollar amounts
    prices = re.findall(r'\$(\d+(?:\.\d{2})?)', price_text)
    if prices:
        price_vals = [float(p) for p in prices]
        min_price = min(price_vals)
        max_price = max(price_vals)
        return min_price, max_price, min_price == 0

    return None, None, False


def categorize_event(title: str, categories: list[str]) -> tuple[str, str]:
    """Determine category and subcategory from title and category tags."""
    title_lower = title.lower()
    cats_lower = [c.lower() for c in categories]

    # Check categories first
    if 'comedy' in cats_lower or 'comedy' in title_lower:
        return 'theater', 'comedy'

    if 'music' in cats_lower or 'live music' in cats_lower:
        return 'music', 'concert'

    if 'market' in cats_lower or 'vendor' in cats_lower or 'market' in title_lower:
        return 'markets', 'artisan'

    if 'art' in cats_lower or 'gallery' in cats_lower or 'exhibition' in title_lower:
        return 'art', 'exhibition'

    if 'workshop' in cats_lower or 'class' in cats_lower:
        return 'art', 'workshop'

    if 'open mic' in title_lower:
        return 'music', 'open_mic'

    if 'trivia' in title_lower:
        return 'nightlife', 'trivia'

    if 'drag' in title_lower:
        return 'nightlife', 'drag'

    if 'film' in cats_lower or 'movie' in cats_lower or 'screening' in title_lower:
        return 'film', 'screening'

    # Default for this venue
    return 'community', 'social'


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Supermarket ATL events page.

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

            logger.info(f"Fetching The Supermarket ATL events: {source_url}")
            page.goto(source_url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load more events
            for _ in range(3):
                page.evaluate('window.scrollBy(0, 1000)')
                page.wait_for_timeout(1000)

            # Get or create venue
            venue_id = get_or_create_venue(SUPERMARKET_VENUE)

            # Find event list items - look for listitems that contain event links
            # The main event list is inside [role="list"] and has items with event-thumb-wrapper
            event_items = page.query_selector_all('[role="listitem"]:has(.event-thumb-wrapper)')
            logger.info(f"Found {len(event_items)} event items")

            for item in event_items[:MAX_EVENTS]:
                try:
                    # Get event link
                    link = item.query_selector('a[href*="/event/"]')
                    if not link:
                        continue

                    event_url = link.get_attribute('href')
                    if event_url and not event_url.startswith('http'):
                        event_url = urljoin(BASE_URL, event_url)

                    # Extract title from h2.details-link-title
                    title_el = item.query_selector('h2.details-link-title, .details-link-title')
                    title = title_el.inner_text().strip() if title_el else None

                    if not title:
                        continue

                    # Extract date from widget - using text-block-8 (month) and text-block-9 (day)
                    month_el = item.query_selector('.text-block-8')
                    day_el = item.query_selector('.text-block-9')

                    month_text = month_el.inner_text() if month_el else None
                    day_text = day_el.inner_text() if day_el else None

                    start_date = parse_date_from_widget(month_text, day_text)
                    if not start_date:
                        logger.debug(f"Could not parse date for: {title}")
                        continue

                    events_found += 1

                    # Extract times from .event-details-info elements inside .w-layout-hflex
                    time_container = item.query_selector('.w-layout-hflex')
                    start_time = None
                    end_time = None
                    if time_container:
                        time_els = time_container.query_selector_all('.event-details-info')
                        if len(time_els) >= 1:
                            start_time = parse_time(time_els[0].inner_text())
                        if len(time_els) >= 2:
                            end_time = parse_time(time_els[1].inner_text())

                    # Extract price from h3.details-link-price
                    price_el = item.query_selector('h3.details-link-price')
                    price_text = price_el.inner_text() if price_el else ''
                    price_min, price_max, is_free = extract_price(price_text)

                    # Extract categories from .collection-item-2 elements
                    categories = []
                    cat_els = item.query_selector_all('.collection-item-2 > div:first-child')
                    for cat_el in cat_els:
                        cat_text = cat_el.inner_text().strip()
                        if cat_text and cat_text not in [',', '']:
                            categories.append(cat_text)

                    # Determine category
                    category, subcategory = categorize_event(title, categories)

                    # Generate content hash
                    content_hash = generate_content_hash(title, SUPERMARKET_VENUE['name'], start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Build tags
                    tags = ['east-point', 'supermarket-atl', category]
                    tags.extend([c.lower().replace(' ', '-') for c in categories[:3]])

                    # Prepare event record
                    event_record = {
                        'source_id': source_id,
                        'venue_id': venue_id,
                        'producer_id': producer_id,
                        'title': title[:500],
                        'description': None,  # Would need to visit detail page
                        'start_date': start_date,
                        'start_time': start_time,
                        'end_date': start_date,
                        'end_time': end_time,
                        'is_all_day': start_time is None,
                        'category': category,
                        'subcategory': subcategory,
                        'tags': tags,
                        'price_min': price_min,
                        'price_max': price_max,
                        'price_note': None,
                        'is_free': is_free,
                        'source_url': event_url,
                        'ticket_url': event_url,
                        'image_url': None,  # Would need to extract from listing
                        'raw_text': None,
                        'extraction_confidence': 0.85,
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
                    logger.error(f"Error processing event item: {e}")
                    continue

            browser.close()

        logger.info(f"Supermarket ATL crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl The Supermarket ATL: {e}")
        raise

    return events_found, events_new, events_updated
