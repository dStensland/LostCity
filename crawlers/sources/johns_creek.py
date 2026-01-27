"""
Crawler for City of Johns Creek (johnscreekga.gov/events/).

Suburban Atlanta city government events - community programs, cultural events, and festivals.
Uses Playwright for JavaScript rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://johnscreekga.gov"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Johns Creek City Hall",
    "slug": "johns-creek-city-hall",
    "address": "11360 Lakefield Dr",
    "neighborhood": "Johns Creek",
    "city": "Johns Creek",
    "state": "GA",
    "zip": "30097",
    "lat": 34.0289,
    "lng": -84.1986,
    "venue_type": "government",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date or date range from text.

    Examples:
    - "February 21, 2026"
    - "Monday, February 21, 2026"
    - "Feb 21 - Feb 23, 2026"
    - "January 15-17, 2026"
    """
    # Single date with optional day of week: "Monday, February 21, 2026"
    match = re.match(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,\s]*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            month_name = match.group(1)
            if len(month_name) > 3:
                dt = datetime.strptime(f"{month_name} {match.group(2)} {match.group(3)}", "%B %d %Y")
            else:
                dt = datetime.strptime(f"{month_name} {match.group(2)} {match.group(3)}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    # Date range: "Feb 21 - Feb 23, 2026"
    match = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*-\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            start_month = match.group(1)
            start_day = match.group(2)
            end_month = match.group(3) if match.group(3) else start_month
            end_day = match.group(4)
            year = match.group(5)

            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%b %d %Y")

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Date range without end month: "January 15-17, 2026"
    match = re.match(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})-(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            month = match.group(1)
            start_day = match.group(2)
            end_day = match.group(3)
            year = match.group(4)

            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '10:00 AM' or similar format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    return None


def categorize_event(title: str, description: str) -> tuple[str, list[str]]:
    """Determine category and tags based on title and description."""
    text = (title + " " + description).lower()
    tags = ["johns-creek", "community"]

    # Check for Lunar New Year specifically (mentioned in requirements)
    if "lunar new year" in text or "chinese new year" in text:
        tags.extend(["lunar-new-year", "cultural", "family-friendly"])
        return "community", tags

    # Other categorization
    if any(w in text for w in ["concert", "music", "band", "orchestra"]):
        tags.append("music")
        return "music", tags

    if any(w in text for w in ["festival", "celebration"]):
        tags.append("festival")
        return "community", tags

    if any(w in text for w in ["art", "gallery", "craft"]):
        tags.append("arts")
        return "arts", tags

    if any(w in text for w in ["kids", "children", "family", "youth"]):
        tags.append("family-friendly")
        return "family", tags

    if any(w in text for w in ["cultural", "heritage", "tradition"]):
        tags.append("cultural")
        return "community", tags

    return "community", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Johns Creek events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Johns Creek events: {EVENTS_URL}")

            # Navigate to events page
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)

            # Wait for events to load
            try:
                page.wait_for_selector(".event, .event-item, [class*='event']", timeout=10000)
            except Exception:
                logger.warning("Could not find event selectors, continuing anyway")

            # Extract images
            image_map = extract_images_from_page(page)

            # Scroll to load all events (handle pagination/lazy loading)
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

                # Try to click "Load More" or "Next" button if present
                try:
                    load_more = page.query_selector("button:has-text('Load More'), button:has-text('Show More'), a:has-text('Next')")
                    if load_more and load_more.is_visible():
                        load_more.click()
                        page.wait_for_timeout(2000)
                except Exception:
                    pass

            # Find event links - Johns Creek uses a[href^="/events/"] pattern
            event_links = page.query_selector_all('a[href*="/events/"]')

            # Filter to actual event pages (not the main /events/ page)
            unique_events = {}
            for link in event_links:
                href = link.get_attribute('href') or ''
                text = link.inner_text().strip()

                # Skip navigation links and empty text
                if not text or len(text) < 3:
                    continue
                if href == '/events/' or href == 'https://johnscreekga.gov/events/':
                    continue
                if 'municipal-court' in href.lower():
                    continue  # Skip court dates

                # Normalize URL
                if href.startswith('/'):
                    href = BASE_URL + href

                # Dedupe by URL
                if href not in unique_events:
                    unique_events[href] = text

            logger.info(f"Found {len(unique_events)} unique event links")

            for event_url, title in unique_events.items():
                try:
                    # Visit individual event page to get details
                    page.goto(event_url, wait_until='domcontentloaded', timeout=30000)
                    page.wait_for_timeout(1000)

                    # Get event details from the page
                    # Find date
                    date_elem = page.query_selector(
                        ".event-date, .date, [class*='date'], time, .event-meta"
                    )

                    date_text = ""
                    if date_elem:
                        date_text = date_elem.inner_text().strip()
                        # Also check for datetime attribute
                        datetime_attr = date_elem.get_attribute("datetime")
                        if datetime_attr:
                            date_text = datetime_attr

                    start_date, end_date = parse_date_range(date_text)

                    if not start_date:
                        # Try to find date in page text
                        page_text = page.inner_text('body')
                        for line in page_text.split("\n"):
                            start_date, end_date = parse_date_range(line.strip())
                            if start_date:
                                break

                    if not start_date:
                        logger.debug(f"No date found for: {title}")
                        continue

                    events_found += 1

                    # Find time
                    time_elem = page.query_selector(
                        ".time, .event-time, [class*='time']"
                    )
                    time_text = time_elem.inner_text().strip() if time_elem else ""
                    start_time = parse_time(time_text) if time_text else None

                    # Find description
                    desc_elem = page.query_selector(
                        ".event-description, .description, .content p, article p"
                    )
                    description = desc_elem.inner_text().strip() if desc_elem else ""
                    if len(description) > 500:
                        description = description[:497] + "..."

                    if not description:
                        description = f"{title} - City of Johns Creek community event"

                    # Categorize
                    category, tags = categorize_event(title, description)

                    # Generate content hash
                    content_hash = generate_content_hash(title, "Johns Creek", start_date)

                    # Check if exists
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else "Event in Johns Creek",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,  # Most city events are free
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
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
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.error(f"Error parsing event element: {e}")
                    continue

            browser.close()

        logger.info(
            f"Johns Creek crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Johns Creek: {e}")
        raise

    return events_found, events_new, events_updated
