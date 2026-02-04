"""
Crawler for Chattahoochee Nature Center (chattnaturecenter.org).

Site uses JavaScript rendering - must use Playwright.
Events are displayed with Modern Events Calendar plugin.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.chattnaturecenter.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Chattahoochee Nature Center",
    "slug": "chattahoochee-nature-center",
    "address": "9135 Willeo Rd",
    "neighborhood": "Roswell",
    "city": "Roswell",
    "state": "GA",
    "zip": "30075",
    "lat": 34.0013,
    "lng": -84.3891,
    "venue_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
}


def parse_date_from_occurrence(url: str) -> Optional[str]:
    """Extract date from occurrence URL parameter."""
    try:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        occurrence = query_params.get('occurrence', [None])[0]
        if occurrence:
            # Format: 2026-01-25
            return occurrence
    except Exception:
        pass
    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7:00 pm' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Chattahoochee Nature Center events using Playwright."""
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

            logger.info(f"Fetching Chattahoochee Nature Center: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Track seen event IDs to avoid duplicates (events repeat for each occurrence)
            seen_event_ids = set()

            # Find all event articles
            event_articles = page.query_selector_all("article.mec-event-article")
            logger.info(f"Found {len(event_articles)} event article elements")

            for article in event_articles:
                try:
                    # Get event title and link
                    title_link = article.query_selector("h3.mec-event-title a")
                    if not title_link:
                        logger.debug("No title link found, skipping")
                        continue

                    title = title_link.inner_text().strip()
                    event_url = title_link.get_attribute("href")
                    event_id_attr = title_link.get_attribute("data-event-id")

                    if not title or not event_url:
                        logger.debug("Missing title or URL, skipping")
                        continue

                    # Skip duplicate events (same event on different days)
                    if event_id_attr in seen_event_ids:
                        continue
                    seen_event_ids.add(event_id_attr)

                    # Get description
                    description_elem = article.query_selector(".mec-event-description")
                    description = description_elem.inner_text().strip() if description_elem else ""

                    # Extract start date from occurrence parameter in URL
                    start_date = parse_date_from_occurrence(event_url)
                    if not start_date:
                        logger.debug(f"Could not extract date from URL: {event_url}")
                        continue

                    # Parse the date to ensure it's valid
                    try:
                        dt = datetime.strptime(start_date, "%Y-%m-%d")
                        # Skip past events
                        if dt.date() < datetime.now().date():
                            continue
                    except ValueError:
                        logger.debug(f"Invalid date format: {start_date}")
                        continue

                    # Get time from meta section
                    start_time = None
                    time_elem = article.query_selector(".mec-start-time")
                    if time_elem:
                        time_text = time_elem.inner_text().strip()
                        if time_text.lower() != "all day":
                            start_time = parse_time(time_text)

                    # Get image
                    image_url = None
                    img_elem = article.query_selector("img.mec-event-image")
                    if img_elem:
                        image_url = img_elem.get_attribute("src") or img_elem.get_attribute("data-src")

                    # Get price/registration info
                    price_note = None
                    is_free = False
                    cost_elem = article.query_selector(".mec-event-cost, .mec-booking-button")
                    if cost_elem:
                        cost_text = cost_elem.inner_text().strip().lower()
                        if "free" in cost_text:
                            is_free = True
                        elif cost_text:
                            price_note = cost_text

                    events_found += 1

                    content_hash = generate_content_hash(title, "Chattahoochee Nature Center", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Determine category from title/description
                    category = "community"
                    tags = ["chattahoochee", "nature", "roswell", "outdoor", "education"]

                    title_lower = title.lower()
                    desc_lower = description.lower()

                    if any(word in title_lower or word in desc_lower for word in ["hike", "trail", "walk"]):
                        tags.append("hiking")
                    if any(word in title_lower or word in desc_lower for word in ["bird", "wildlife", "animal"]):
                        tags.append("wildlife")
                    if any(word in title_lower or word in desc_lower for word in ["kid", "child", "family"]):
                        tags.append("family-friendly")
                    if any(word in title_lower or word in desc_lower for word in ["kayak", "canoe", "paddle"]):
                        tags.append("kayaking")
                    if any(word in title_lower or word in desc_lower for word in ["art", "gallery", "exhibit"]):
                        category = "art"
                        tags.append("gallery")

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else "Event at Chattahoochee Nature Center",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {description[:200] if description else ''}",
                        "extraction_confidence": 0.85,
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
                    logger.error(f"Error processing event article: {e}")
                    continue

            browser.close()

        logger.info(
            f"Chattahoochee Nature Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Chattahoochee Nature Center: {e}")
        raise

    return events_found, events_new, events_updated
