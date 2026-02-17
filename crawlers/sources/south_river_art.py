"""
Crawler for South River Art Studios (southriverartstudios.com/events).
Artist studios in Atlanta with workshops and community events.
Uses Wix - requires JavaScript rendering.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.southriverartstudios.com"
EVENTS_URL = f"{BASE_URL}/events"

MAX_EVENTS = 50

SOUTH_RIVER_VENUE = {
    "name": "South River Art Studios",
    "slug": "south-river-art-studios",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "art_studio",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date string to 'YYYY-MM-DD'."""
    if not date_text:
        return None

    try:
        date_text = re.sub(r'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*', '', date_text, flags=re.IGNORECASE)

        for fmt in ['%B %d, %Y', '%b %d, %Y', '%m/%d/%Y', '%Y-%m-%d', '%B %d', '%m/%d']:
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
    """Crawl South River Art Studios events page."""
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

            logger.info(f"Fetching South River Art Studios events: {source_url}")
            page.goto(source_url, wait_until='networkidle', timeout=60000)
            page.wait_for_timeout(5000)  # Extra wait for Wix

            for _ in range(5):
                page.evaluate('window.scrollBy(0, 800)')
                page.wait_for_timeout(1500)

            venue_id = get_or_create_venue(SOUTH_RIVER_VENUE)

            # Wix events structure
            event_items = page.query_selector_all('[data-testid*="event"], [data-hook*="event"], .event-item, article')

            if not event_items:
                event_items = page.query_selector_all('[class*="repeater-item"], [data-testid*="item"], [class*="EventCard"]')

            logger.info(f"Found {len(event_items)} potential event items")

            for item in event_items[:MAX_EVENTS]:
                try:
                    title_el = item.query_selector('h1, h2, h3, h4, [data-hook*="title"], [class*="title"]')
                    title = title_el.inner_text().strip() if title_el else None
                    if not title or len(title) < 3:
                        continue

                    if any(skip in title.lower() for skip in ['contact', 'about', 'home', 'menu']):
                        continue

                    link = item.query_selector('a')
                    event_url = source_url
                    if link:
                        href = link.get_attribute('href')
                        if href and not href.startswith('#'):
                            event_url = href if href.startswith('http') else urljoin(BASE_URL, href)

                    full_text = item.inner_text()

                    date_match = re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+(?:,?\s*\d{4})?', full_text, re.IGNORECASE)
                    start_date = None
                    if date_match:
                        start_date = parse_date(date_match.group(0))

                    if not start_date:
                        date_match = re.search(r'(\d{1,2}/\d{1,2}(?:/\d{2,4})?)', full_text)
                        if date_match:
                            start_date = parse_date(date_match.group(1))

                    if not start_date:
                        continue

                    events_found += 1

                    start_time = None
                    end_time = None
                    times = re.findall(r'\d+:\d+\s*(?:AM|PM|am|pm)', full_text)
                    if times:
                        start_time = parse_time(times[0])
                        if len(times) > 1:
                            end_time = parse_time(times[1])

                    desc_el = item.query_selector('p, [class*="description"]')
                    description = desc_el.inner_text().strip()[:500] if desc_el else None

                    content_hash = generate_content_hash(title, SOUTH_RIVER_VENUE['name'], start_date)


                    img = item.query_selector('img')
                    image_url = None
                    if img:
                        image_url = img.get_attribute('src') or img.get_attribute('data-src')

                    tags = ['south-river', 'art-studio', 'art', 'workshop']

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
                        'category': 'art',
                        'subcategory': 'workshop',
                        'tags': tags,
                        'price_min': None,
                        'price_max': None,
                        'price_note': None,
                        'is_free': False,
                        'source_url': event_url,
                        'ticket_url': event_url,
                        'image_url': image_url,
                        'raw_text': None,
                        'extraction_confidence': 0.70,
                        'is_recurring': False,
                        'recurrence_rule': None,
                        'content_hash': content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

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

        logger.info(f"South River crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl South River Art Studios: {e}")
        raise

    return events_found, events_new, events_updated
