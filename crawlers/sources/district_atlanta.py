"""
Crawler for District Atlanta (districtatlanta.com).

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.districtatlanta.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "District Atlanta",
    "slug": "district-atlanta",
    "address": "269 Armour Dr NE",
    "neighborhood": "Armour Yards",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8107,
    "lng": -84.3667,
    "venue_type": "nightclub",
    "spot_type": "nightclub",
    "website": BASE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl District Atlanta events using Playwright."""
    source_id = source["id"]
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching District Atlanta: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract events using DOM parsing
            raw_events = page.evaluate("""
                () => {
                    const cards = document.querySelectorAll('.de-event-item');
                    const events = [];

                    cards.forEach(card => {
                        // Extract date
                        const monthEl = card.querySelector('.d-mm');
                        const dayEl = card.querySelector('.d-dd');

                        // Extract title and description
                        const titleEl = card.querySelector('.d-text h3');
                        const descEl = card.querySelector('.d-text p');

                        // Extract links
                        const detailLink = card.querySelector('.d-text a[href*="districtatlanta.com/events"]');
                        const ticketLink = card.querySelector('a[href*="eventbrite"]');

                        // Extract image
                        const imageEl = card.querySelector('img[alt]');

                        if (monthEl && dayEl && titleEl) {
                            events.push({
                                month: monthEl.textContent.trim(),
                                day: dayEl.textContent.trim(),
                                title: titleEl.textContent.trim(),
                                description: descEl ? descEl.textContent.trim() : null,
                                detailUrl: detailLink ? detailLink.getAttribute('href') : null,
                                ticketUrl: ticketLink ? ticketLink.getAttribute('href') : null,
                                imageUrl: imageEl ? (imageEl.getAttribute('src') || imageEl.getAttribute('data-src')) : null,
                                imageAlt: imageEl ? imageEl.getAttribute('alt') : null
                            });
                        }
                    });

                    return events;
                }
            """)

            current_year = datetime.now().year

            for event in raw_events:
                # Validate title (skip if it's a date or too short)
                title = event["title"]
                if not title or len(title) < 3:
                    continue

                # Skip if title looks like a date
                if re.match(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$", title, re.IGNORECASE):
                    logger.warning(f"Skipping date-like title: {title}")
                    continue

                # Parse date
                try:
                    month = event["month"]
                    day = event["day"]
                    dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

                    # If date is in the past, assume next year
                    if dt.date() < datetime.now().date():
                        dt = datetime.strptime(f"{month} {day} {current_year + 1}", "%b %d %Y")

                    start_date = dt.strftime("%Y-%m-%d")
                except ValueError as e:
                    logger.warning(f"Failed to parse date {event['month']} {event['day']}: {e}")
                    continue

                # District is a nightclub - default to 10 PM if no time specified
                start_time = "22:00"

                events_found += 1

                content_hash = generate_content_hash(title, "District Atlanta", start_date)


                # Build description - check if it's substantial
                description = event.get("description")
                if description and len(description) < 50:
                    description = None

                # Use detail URL if available, otherwise events page
                source_url = event.get("detailUrl") or EVENTS_URL
                if source_url and not source_url.startswith("http"):
                    source_url = f"{BASE_URL}/{source_url.lstrip('/')}"

                # Use Eventbrite ticket URL if available
                ticket_url = event.get("ticketUrl") or source_url

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
                    "category": "nightlife",
                    "subcategory": "club",
                    "tags": ["district", "nightclub", "edm", "electronic", "warehouse"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": source_url,
                    "ticket_url": ticket_url,
                    "image_url": event.get("imageUrl"),
                    "raw_text": f"{title} - {description}",
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    enrich_event_record(event_record, "District Atlanta")
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(
            f"District Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl District Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
