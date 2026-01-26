"""
Crawler for Freeside Atlanta events from their Meetup group.
https://www.meetup.com/freeside-atlanta/
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

MEETUP_GROUP_URL = "https://www.meetup.com/freeside-atlanta/events/"
VENUE_NAME = "Freeside Atlanta"
VENUE_ADDRESS = "675 Metropolitan Pkwy SW"
VENUE_CITY = "Atlanta"
VENUE_STATE = "GA"


def parse_meetup_datetime(datetime_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse Meetup datetime format. Returns (date, time) tuple."""
    try:
        if "T" in datetime_str:
            dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
        return None, None
    except Exception as e:
        logger.debug(f"Failed to parse datetime {datetime_str}: {e}")
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Freeside Atlanta Meetup group for events."""
    if not source.get("is_active"):
        logger.info("Freeside Atlanta source is not active, skipping")
        return 0, 0, 0

    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Get or create the Freeside venue
    venue_data = {
        "name": VENUE_NAME,
        "slug": "freeside-atlanta",
        "address": VENUE_ADDRESS,
        "city": VENUE_CITY,
        "state": VENUE_STATE,
        "spot_type": "community_center",
        "vibes": ["artsy", "chill"],
    }

    try:
        venue_id = get_or_create_venue(venue_data)
    except Exception as e:
        logger.error(f"Failed to create venue: {e}")
        venue_id = None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Freeside Atlanta events: {MEETUP_GROUP_URL}")
            page.goto(MEETUP_GROUP_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)

            # Scroll to load more events
            for i in range(3):
                page.keyboard.press("End")
                page.wait_for_timeout(1500)

            # Find event links on the group page
            event_links = page.query_selector_all('a[href*="/events/"]')

            seen_urls = set()
            event_urls = []

            for link in event_links:
                try:
                    href = link.get_attribute("href")
                    if not href or "/events/" not in href:
                        continue

                    # Build full URL
                    if href.startswith("/"):
                        href = f"https://www.meetup.com{href}"

                    # Skip if already seen or not a specific event
                    if href in seen_urls or href.endswith("/events/"):
                        continue

                    # Must be a Freeside event
                    if "freeside-atlanta" not in href.lower():
                        continue

                    seen_urls.add(href)
                    event_urls.append(href)
                except Exception:
                    continue

            logger.info(f"Found {len(event_urls)} Freeside events to process")

            # Visit each event page for details
            for event_url in event_urls[:20]:  # Limit per run
                try:
                    page.goto(event_url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(1000)

                    # Get title
                    title_el = page.query_selector("h1")
                    if not title_el:
                        continue
                    title = title_el.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Get datetime
                    time_el = page.query_selector("time[datetime]")
                    start_date = None
                    start_time = None

                    if time_el:
                        datetime_attr = time_el.get_attribute("datetime")
                        if datetime_attr:
                            start_date, start_time = parse_meetup_datetime(datetime_attr)

                    if not start_date:
                        logger.debug(f"Skipping event without date: {title}")
                        continue

                    events_found += 1

                    # Get description
                    description = None
                    desc_el = page.query_selector('[data-testid="event-description"], .event-description, .break-words')
                    if desc_el:
                        description = desc_el.inner_text().strip()[:2000]

                    # Get image
                    image_url = None
                    img_el = page.query_selector('img[src*="meetupstatic"], img[src*="secure.meetup"]')
                    if img_el:
                        image_url = img_el.get_attribute("src")

                    # Generate content hash
                    content_hash = generate_content_hash(title, VENUE_NAME, start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": "meetup.tech",
                        "tags": ["hackerspace", "makerspace", "tech", "diy"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See Meetup for details",
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.9,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing event {event_url}: {e}")
                    continue

            browser.close()

        logger.info(f"Freeside Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Freeside Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
