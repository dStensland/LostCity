"""
Crawler for MASS Collective (masscollective.org/classes).
Atlanta-based artist collective offering printmaking workshops and community art events.
Uses Squarespace with Eventbrite integration.
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

BASE_URL = "https://www.masscollective.org"
EVENTS_URL = f"{BASE_URL}/classes"

MAX_EVENTS = 50

MASS_VENUE = {
    "name": "MASS Collective",
    "slug": "mass-collective",
    "address": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "arts_center",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date string to 'YYYY-MM-DD'."""
    if not date_text:
        return None

    try:
        date_text = re.sub(r'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*', '', date_text, flags=re.IGNORECASE)

        for fmt in ['%B %d, %Y', '%b %d, %Y', '%m/%d/%Y', '%Y-%m-%d', '%B %d']:
            try:
                dt = datetime.strptime(date_text.strip(), fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=datetime.now().year)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        return None
    except Exception:
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time string to 'HH:MM:SS' format."""
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MASS Collective classes/events page."""
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

            logger.info(f"Fetching MASS Collective events: {source_url}")
            page.goto(source_url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)

            for _ in range(3):
                page.evaluate('window.scrollBy(0, 1000)')
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(MASS_VENUE)

            # Squarespace events/classes structure
            event_items = page.query_selector_all('article, .eventlist-event, [data-item-id], .summary-item')
            logger.info(f"Found {len(event_items)} event items")

            for item in event_items[:MAX_EVENTS]:
                try:
                    link = item.query_selector('a[href*="/classes/"], a[href*="eventbrite"], a')
                    if not link:
                        continue

                    event_url = link.get_attribute('href')
                    if not event_url:
                        continue
                    if not event_url.startswith('http'):
                        event_url = urljoin(BASE_URL, event_url)

                    # Skip non-event links
                    if any(skip in event_url for skip in ['instagram', 'facebook', 'twitter', '#']):
                        continue

                    # Extract title
                    title_el = item.query_selector('h1, h2, h3, .summary-title, .eventlist-title')
                    title = title_el.inner_text().strip() if title_el else None
                    if not title:
                        continue

                    # Extract date
                    date_el = item.query_selector('.eventlist-meta-date, time, [datetime], .summary-metadata-item')
                    date_text = None
                    if date_el:
                        date_text = date_el.get_attribute('datetime') or date_el.inner_text()

                    start_date = parse_date(date_text)
                    if not start_date:
                        # Look for date in text content
                        full_text = item.inner_text()
                        date_match = re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+(?:,?\s*\d{4})?', full_text, re.IGNORECASE)
                        if date_match:
                            start_date = parse_date(date_match.group(0))

                    if not start_date:
                        logger.debug(f"No date found for: {title}")
                        continue

                    events_found += 1

                    # Extract time
                    start_time = None
                    end_time = None
                    full_text = item.inner_text()
                    times = re.findall(r'\d+:\d+\s*(?:AM|PM|am|pm)', full_text)
                    if times:
                        start_time = parse_time(times[0])
                        if len(times) > 1:
                            end_time = parse_time(times[1])

                    # Extract description
                    desc_el = item.query_selector('.summary-excerpt, .eventlist-description, p')
                    description = desc_el.inner_text().strip()[:500] if desc_el else None

                    # Printmaking workshops are the main offering
                    category = 'art'
                    subcategory = 'workshop'
                    if 'print' in title.lower():
                        subcategory = 'printmaking'

                    content_hash = generate_content_hash(title, MASS_VENUE['name'], start_date)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    img = item.query_selector('img')
                    image_url = None
                    if img:
                        image_url = img.get_attribute('src') or img.get_attribute('data-src')
                        if image_url and not image_url.startswith('http'):
                            image_url = urljoin(BASE_URL, image_url)

                    tags = ['mass-collective', 'printmaking', 'workshop', 'art']

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
                        'is_all_day': False,
                        'category': category,
                        'subcategory': subcategory,
                        'tags': tags,
                        'price_min': None,
                        'price_max': None,
                        'price_note': None,
                        'is_free': False,
                        'source_url': event_url,
                        'ticket_url': event_url,
                        'image_url': image_url,
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
                    logger.error(f"Error processing event: {e}")
                    continue

            browser.close()

        logger.info(f"MASS Collective crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl MASS Collective: {e}")
        raise

    return events_found, events_new, events_updated
