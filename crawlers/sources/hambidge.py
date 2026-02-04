"""
Crawler for The Hambidge Center (hambidge.org/events).
Artist residency and creative retreat in Rabun Gap, North Georgia.
Also has Atlanta Hive location. Uses Squarespace.
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

BASE_URL = "https://www.hambidge.org"
EVENTS_URL = f"{BASE_URL}/events"

MAX_EVENTS = 50

HAMBIDGE_VENUE = {
    "name": "The Hambidge Center",
    "slug": "hambidge-center",
    "address": "105 Hambidge Court",
    "city": "Rabun Gap",
    "state": "GA",
    "zip": "30568",
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


def categorize_event(title: str, description: str = '') -> tuple[str, str]:
    """Determine category and subcategory."""
    combined = f"{title} {description}".lower()

    if any(w in combined for w in ['workshop', 'class', 'lesson', 'kiln', 'firing']):
        return 'art', 'workshop'
    if any(w in combined for w in ['talk', 'lecture', 'presentation', 'artist talk']):
        return 'community', 'talk'
    if any(w in combined for w in ['hike', 'walk', 'nature', 'trail']):
        return 'fitness', 'outdoor'
    if any(w in combined for w in ['exhibition', 'exhibit', 'gallery', 'opening']):
        return 'art', 'exhibition'
    if any(w in combined for w in ['concert', 'music', 'performance']):
        return 'music', 'concert'
    if any(w in combined for w in ['residency', 'retreat']):
        return 'art', 'residency'

    return 'art', 'other'


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Hambidge Center events page."""
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

            logger.info(f"Fetching Hambidge Center events: {source_url}")
            page.goto(source_url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)

            for _ in range(3):
                page.evaluate('window.scrollBy(0, 1000)')
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(HAMBIDGE_VENUE)

            # Squarespace events structure
            event_items = page.query_selector_all('article, .eventlist-event, [data-item-id]')
            logger.info(f"Found {len(event_items)} event items")

            for item in event_items[:MAX_EVENTS]:
                try:
                    link = item.query_selector('a[href*="/events/"], a[href*="event"]')
                    if not link:
                        link = item.query_selector('a')
                    if not link:
                        continue

                    event_url = link.get_attribute('href')
                    if not event_url:
                        continue
                    if not event_url.startswith('http'):
                        event_url = urljoin(BASE_URL, event_url)

                    # Extract title
                    title_el = item.query_selector('h1, h2, h3, .eventlist-title')
                    title = title_el.inner_text().strip() if title_el else None
                    if not title:
                        continue

                    # Extract date
                    date_el = item.query_selector('.eventlist-meta-date, time, [datetime]')
                    date_text = None
                    if date_el:
                        date_text = date_el.get_attribute('datetime') or date_el.inner_text()

                    start_date = parse_date(date_text)
                    if not start_date:
                        li_items = item.query_selector_all('li')
                        for li in li_items:
                            text = li.inner_text()
                            if re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)', text, re.IGNORECASE):
                                start_date = parse_date(text)
                                break

                    if not start_date:
                        continue

                    events_found += 1

                    # Extract time
                    start_time = None
                    end_time = None
                    li_items = item.query_selector_all('li')
                    for li in li_items:
                        text = li.inner_text()
                        times = re.findall(r'\d+:\d+\s*(?:AM|PM|am|pm)', text)
                        if times:
                            start_time = parse_time(times[0])
                            if len(times) > 1:
                                end_time = parse_time(times[1])
                            break

                    # Extract description
                    desc_el = item.query_selector('.eventlist-description, p')
                    description = desc_el.inner_text().strip()[:500] if desc_el else None

                    category, subcategory = categorize_event(title, description or '')

                    content_hash = generate_content_hash(title, HAMBIDGE_VENUE['name'], start_date)

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

                    tags = ['hambidge', 'rabun-gap', 'north-georgia', 'artist-residency', category]

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

        logger.info(f"Hambidge crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Hambidge Center: {e}")
        raise

    return events_found, events_new, events_updated
