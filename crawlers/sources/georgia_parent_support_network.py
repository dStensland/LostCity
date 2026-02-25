"""
Crawler for Georgia Parent Support Network (gpsn.org).

Georgia Parent Support Network (GPSN) provides family support, education, and advocacy
for children and youth with mental health challenges, substance use disorders, and
co-occurring disabilities.

Key Programs:
- Monthly parent support groups (multiple locations across metro Atlanta)
- Advocacy classes and training
- Children's Mental Health Awareness Day events
- Family peer support services
- Educational workshops and webinars

Relevant for families navigating children's mental health systems and hospital care.

STRATEGY:
- Scrape the events/calendar page
- Extract support group meetings, advocacy classes, awareness events
- Tag with: childrens-mental-health, family-support, advocacy, peer-support
- All events are free
- Category: "support_group" for groups, "learning" for classes/workshops
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gpsn.org"
EVENTS_URL = f"{BASE_URL}/events"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Georgia Parent Support Network",
    "slug": "georgia-parent-support-network",
    "address": "1381 Metropolitan Pkwy SW",
    "neighborhood": "Capitol View",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7130,
    "lng": -84.4060,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["childrens-mental-health", "family-support", "advocacy", "peer-support"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string to 24-hour format."""
    try:
        time_str = time_str.strip().upper()

        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

        time_str = re.sub(r'\s+(ET|EST|EDT|CT|CST|CDT|PT|PST|PDT)$', '', time_str)

        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = ["childrens-mental-health", "family-support"]

    # Support groups
    if any(word in text for word in ["support group", "parent support", "peer support", "family support"]):
        category = "support_group"
        tags.extend(["peer-support", "community"])

    # Advocacy classes and training
    elif any(word in text for word in ["advocacy", "class", "training", "workshop", "seminar"]):
        category = "learning"
        tags.extend(["advocacy", "parent-education"])

    # Awareness events
    elif any(word in text for word in ["awareness day", "awareness event", "mental health awareness"]):
        category = "community"
        tags.extend(["awareness", "advocacy"])

    # Webinars and online events
    elif any(word in text for word in ["webinar", "virtual", "online"]):
        category = "learning"
        tags.extend(["virtual", "education"])

    # Default to support group
    else:
        category = "support_group"
        tags.append("community")

    # Only mark free when explicitly stated
    is_free = "free" in text or "no cost" in text or "no charge" in text
    if is_free:
        tags.append("free")

    return category, list(set(tags)), is_free


def try_simple_requests_first(url: str) -> Optional[BeautifulSoup]:
    """Try fetching with simple requests first."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        if soup.find(string=re.compile(r'event|calendar|support group', re.I)):
            return soup

        return None
    except Exception as e:
        logger.debug(f"Simple request failed, will use Playwright: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Georgia Parent Support Network events.

    First tries simple requests, falls back to Playwright if needed.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try events page first, then calendar page
        for url in [EVENTS_URL, CALENDAR_URL]:
            logger.info(f"Trying simple fetch: {url}")
            soup = try_simple_requests_first(url)

            # If simple request didn't work, use Playwright
            if not soup:
                logger.info(f"Fetching with Playwright: {url}")
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    context = browser.new_context(
                        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                        viewport={"width": 1920, "height": 1080},
                    )
                    page = context.new_page()

                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        page.wait_for_timeout(3000)

                        for _ in range(3):
                            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            page.wait_for_timeout(1000)

                        html_content = page.content()
                        soup = BeautifulSoup(html_content, "html.parser")
                    except Exception as e:
                        logger.warning(f"Failed to fetch {url}: {e}")
                        continue
                    finally:
                        browser.close()

            # Look for event containers
            event_selectors = [
                ".event-item",
                ".event-card",
                ".event",
                "[class*='event']",
                "article",
                ".tribe-events-list-event",
                ".calendar-event",
            ]

            events = None
            for selector in event_selectors:
                events = soup.select(selector)
                if events and len(events) > 0:
                    logger.info(f"Found {len(events)} events using selector: {selector}")
                    break

            if not events or len(events) == 0:
                logger.debug(f"No events found on {url}")
                continue

            # Parse each event
            for event_elem in events:
                try:
                    # Extract title
                    title_elem = event_elem.select_one("h1, h2, h3, h4, .title, .event-title, [class*='title']")
                    if title_elem:
                        title = title_elem.get_text(strip=True)
                    else:
                        event_text = event_elem.get_text(strip=True)
                        lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                        title = lines[0] if lines else None

                    if not title or len(title) < 3:
                        continue

                    # Extract date
                    date_elem = event_elem.select_one(".date, .event-date, [class*='date'], time")
                    date_str = None
                    if date_elem:
                        date_str = date_elem.get_text(strip=True)
                        if hasattr(date_elem, 'get'):
                            datetime_attr = date_elem.get("datetime")
                            if datetime_attr:
                                date_str = datetime_attr

                    if not date_str:
                        date_match = re.search(
                            r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?',
                            event_elem.get_text(),
                            re.IGNORECASE
                        )
                        if date_match:
                            date_str = date_match.group(0)

                    if not date_str:
                        logger.debug(f"No date found for: {title}")
                        continue

                    # Parse date
                    start_date = parse_human_date(date_str)
                    if not start_date:
                        logger.debug(f"Could not parse date '{date_str}' for: {title}")
                        continue

                    events_found += 1

                    # Extract time
                    time_elem = event_elem.select_one(".time, .event-time, [class*='time']")
                    time_str = None
                    if time_elem:
                        time_str = time_elem.get_text(strip=True)
                    else:
                        time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', event_elem.get_text())
                        if time_match:
                            time_str = time_match.group(0)

                    start_time = None
                    if time_str:
                        start_time = parse_time_string(time_str)

                    # Extract description
                    description = None
                    desc_elem = event_elem.select_one(".description, .event-description, .excerpt, .summary, p")
                    if desc_elem:
                        description = desc_elem.get_text(strip=True)
                        if len(description) > 500:
                            description = description[:497] + "..."

                    # Extract image
                    image_url = None
                    img_elem = event_elem.select_one("img")
                    if img_elem:
                        image_url = img_elem.get("src")
                        if image_url and not image_url.startswith("http"):
                            image_url = BASE_URL + image_url if image_url.startswith("/") else None

                    # Extract event URL
                    link_elem = event_elem.select_one("a[href]")
                    event_url = url
                    if link_elem:
                        href = link_elem.get("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    # Determine category and tags
                    category, tags, is_free = determine_category_and_tags(title, description or "")

                    # Generate content hash for deduplication
                    content_hash = generate_content_hash(
                        title, "Georgia Parent Support Network", start_date
                    )

                    # Create event record
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
                        "category": category,
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free",
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": image_url,
                        "raw_text": event_elem.get_text()[:500],
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        logger.debug(f"Event updated: {title}")
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.warning(f"Error parsing event element: {e}")
                    continue

        logger.info(
            f"Georgia Parent Support Network crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Parent Support Network: {e}")
        raise

    return events_found, events_new, events_updated
