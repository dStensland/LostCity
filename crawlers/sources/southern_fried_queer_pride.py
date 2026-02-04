"""
Crawler for Southern Fried Queer Pride (southernfriedqueerpride.com/all-events).
Atlanta's premiere grassroots LGBTQ+ event producer - drag, music, community events.
Site uses Squarespace with JavaScript rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, get_or_create_virtual_venue
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.southernfriedqueerpride.com"
EVENTS_URL = f"{BASE_URL}/all-events"

# SFQP produces events at various venues, so we use a virtual/org venue
SFQP_VENUE = {
    "name": "Southern Fried Queer Pride",
    "slug": "southern-fried-queer-pride",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "event_producer",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date string to 'YYYY-MM-DD'."""
    if not date_text:
        return None

    try:
        # Remove day of week
        date_text = re.sub(r'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*', '', date_text, flags=re.IGNORECASE)

        for fmt in ['%B %d, %Y', '%b %d, %Y', '%B %d', '%b %d', '%m/%d/%Y']:
            try:
                dt = datetime.strptime(date_text.strip(), fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=datetime.now().year)
                    # If date is in the past, assume next year
                    if dt.date() < datetime.now().date():
                        dt = dt.replace(year=datetime.now().year + 1)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        return None
    except Exception:
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_text:
        return None

    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}:00"
    return None


def categorize_event(title: str, description: str = '') -> tuple[str, str]:
    """Determine category and subcategory."""
    combined = f"{title} {description}".lower()

    if any(w in combined for w in ['drag', 'brunch', 'pageant']):
        return 'nightlife', 'drag'
    if any(w in combined for w in ['pride', 'festival', 'parade']):
        return 'community', 'pride'
    if any(w in combined for w in ['concert', 'music', 'dj', 'dance party']):
        return 'music', 'concert'
    if any(w in combined for w in ['comedy', 'stand-up', 'standup']):
        return 'theater', 'comedy'
    if any(w in combined for w in ['film', 'movie', 'screening']):
        return 'film', 'screening'
    if any(w in combined for w in ['market', 'vendor']):
        return 'markets', 'artisan'

    return 'community', 'lgbtq'


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Southern Fried Queer Pride events."""
    source_id = source["id"]
    producer_id = source.get("producer_id")
    source_url = source.get("url", EVENTS_URL)

    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get or create the SFQP venue
            venue_id = get_or_create_venue(SFQP_VENUE)

            logger.info(f"Fetching Southern Fried Queer Pride: {source_url}")
            page.goto(source_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Try Squarespace event selectors
            event_items = page.query_selector_all('article, .eventlist-event, [data-item-id]')

            if not event_items:
                # Try alternative selectors
                event_items = page.query_selector_all('.summary-item, .list-item, [class*="event"]')

            logger.info(f"Found {len(event_items)} event items")

            for item in event_items[:50]:
                try:
                    # Get event link
                    link = item.query_selector('a[href*="/all-events/"], a[href*="/event/"], a')
                    event_url = source_url
                    if link:
                        href = link.get_attribute('href')
                        if href and not href.startswith('#'):
                            event_url = href if href.startswith('http') else urljoin(BASE_URL, href)

                    # Get title
                    title_el = item.query_selector('h1, h2, h3, .eventlist-title, .summary-title')
                    title = title_el.inner_text().strip() if title_el else None

                    if not title or len(title) < 3:
                        continue

                    # Skip navigation items
                    if title.lower() in ['home', 'about', 'events', 'contact', 'shop', 'donate']:
                        continue

                    # Get date
                    date_el = item.query_selector('.eventlist-meta-date, time, [datetime]')
                    date_text = None
                    if date_el:
                        date_text = date_el.get_attribute('datetime') or date_el.inner_text()

                    start_date = parse_date(date_text)

                    if not start_date:
                        # Try to find date in item text
                        full_text = item.inner_text()
                        date_match = re.search(
                            r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+(?:,?\s*\d{4})?',
                            full_text, re.IGNORECASE
                        )
                        if date_match:
                            start_date = parse_date(date_match.group(0))

                    if not start_date:
                        continue

                    events_found += 1

                    # Get time
                    start_time = None
                    end_time = None
                    time_el = item.query_selector('.eventlist-meta-time')
                    if time_el:
                        time_text = time_el.inner_text()
                        times = re.findall(r'\d{1,2}:?\d*\s*(?:am|pm)', time_text, re.IGNORECASE)
                        if times:
                            start_time = parse_time(times[0])
                            if len(times) > 1:
                                end_time = parse_time(times[1])

                    # Get description
                    desc_el = item.query_selector('.eventlist-description, .summary-excerpt, p')
                    description = desc_el.inner_text().strip()[:500] if desc_el else None

                    # Categorize
                    category, subcategory = categorize_event(title, description or '')

                    # Content hash
                    content_hash = generate_content_hash(title, SFQP_VENUE['name'], start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Get image
                    img = item.query_selector('img')
                    image_url = None
                    if img:
                        image_url = img.get_attribute('src') or img.get_attribute('data-src')
                        if image_url and not image_url.startswith('http'):
                            image_url = urljoin(BASE_URL, image_url)

                    # Tags
                    tags = ['sfqp', 'lgbtq', 'queer', 'pride', 'atlanta', category]

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "producer_id": producer_id,
                        "title": title[:500],
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": start_date,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title[:50]}... on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title[:50]}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            browser.close()

        logger.info(
            f"SFQP crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Southern Fried Queer Pride: {e}")
        raise

    return events_found, events_new, events_updated
