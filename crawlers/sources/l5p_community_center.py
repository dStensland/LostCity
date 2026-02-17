"""
Crawler for Little Five Points Community Center (l5pcc.org).

Site uses WordPress with Elementor page builder - must use Playwright.
Events are structured as article elements with proper heading and footer metadata.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.l5pcc.org"
EVENTS_URL = f"{BASE_URL}"

VENUE_DATA = {
    "name": "Little Five Points Community Center",
    "slug": "l5p-community-center",
    "address": "1083 Austin Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7636,
    "lng": -84.3497,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def parse_date_from_text(text: str) -> Optional[tuple[str, str]]:
    """
    Parse date and time from event text.
    Returns (date_string, time_string) or None.
    """
    # Look for full date: "Thursday, October 23, 2025"
    date_match = re.search(
        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+(\d{4})",
        text,
        re.IGNORECASE
    )

    if not date_match:
        # Try without day of week: "October 23, 2025"
        date_match = re.search(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
            r"(\d{1,2}),?\s+(\d{4})",
            text,
            re.IGNORECASE
        )
        if date_match:
            month = date_match.group(1)
            day = date_match.group(2)
            year = date_match.group(3)
        else:
            return None
    else:
        month = date_match.group(2)
        day = date_match.group(3)
        year = date_match.group(4)

    # Parse date
    try:
        dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
        date_str = dt.strftime("%Y-%m-%d")
    except ValueError:
        return None

    # Look for time: "3pm", "10:00am", "5:30 PM"
    time_match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", text, re.IGNORECASE)
    time_str = None

    if time_match:
        hour = int(time_match.group(1))
        minute = time_match.group(2) if time_match.group(2) else "00"
        period = time_match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        time_str = f"{hour:02d}:{minute}"

    return (date_str, time_str)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Little Five Points Community Center events using Playwright."""
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

            logger.info(f"Fetching Little Five Points Community Center: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Query all article elements (WordPress post structure)
            articles = page.query_selector_all("article")
            logger.info(f"Found {len(articles)} article elements")

            for article in articles:
                try:
                    # Extract title from h2 or h3 link
                    title_elem = article.query_selector("h3 a, h2 a, .entry-title a")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    event_url = title_elem.get_attribute("href") or EVENTS_URL

                    if not title or len(title) < 3:
                        continue

                    # Extract description from entry content
                    desc_elem = article.query_selector(".entry-content p, .entry-summary p")
                    description = desc_elem.inner_text().strip() if desc_elem else f"Event at Little Five Points Community Center"

                    # Limit description length
                    if len(description) > 500:
                        description = description[:497] + "..."

                    # Get full article text for date/time parsing
                    article_text = article.inner_text()

                    # Parse date and time
                    parsed = parse_date_from_text(article_text)
                    if not parsed:
                        logger.warning(f"Could not parse date for: {title}")
                        continue

                    start_date, start_time = parsed

                    # Skip past events
                    event_date = datetime.strptime(start_date, "%Y-%m-%d")
                    if event_date.date() < datetime.now().date():
                        continue

                    events_found += 1

                    # Generate content hash for deduplication
                    content_hash = generate_content_hash(title, "Little Five Points Community Center", start_date)


                    # Try to find matching image
                    image_url = None
                    for key in image_map:
                        if title.lower() in key.lower() or key.lower() in title.lower():
                            image_url = image_map[key]
                            break

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
                        "subcategory": None,
                        "tags": [
                            "l5p",
                            "community-center",
                            "little-five-points",
                        ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": article_text[:1000],
                        "extraction_confidence": 0.85,
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
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing article: {e}")
                    continue

            browser.close()

        logger.info(
            f"Little Five Points Community Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Little Five Points Community Center: {e}")
        raise

    return events_found, events_new, events_updated
