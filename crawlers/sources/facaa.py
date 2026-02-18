"""
Crawler for Fulton Atlanta Community Action Authority (facaa.org).

FACAA provides financial assistance programs including LIHEAP (energy assistance),
rent assistance, and community support services. They host enrollment periods,
financial literacy workshops, and community assistance events.

Located in Forest Park, FACAA is a critical resource for low-income families
in the Atlanta metro area.

STRATEGY:
- Scrape the events/programs page
- Extract LIHEAP enrollment periods, financial literacy workshops, community events
- Tag appropriately: financial-assistance, liheap, utilities, rent-assistance, free
- All events and services are free for eligible participants
- Category: "community" for enrollment events, "learning" for workshops

Relevant for social services and financial assistance programs.
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from datetime import datetime, date

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.facaa.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Fulton Atlanta Community Action Authority",
    "slug": "facaa",
    "address": "159 Forest Parkway",
    "neighborhood": "Forest Park",
    "city": "Forest Park",
    "state": "GA",
    "zip": "30297",
    "lat": 33.6221,
    "lng": -84.3691,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["financial-assistance", "community-action", "social-services"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '6pm', '12:30pm', '9:00 AM - 1:00 PM'
    """
    try:
        time_str = time_str.strip().upper()

        # If it's a range, extract the first time
        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

        # Pattern: H:MM AM/PM or H AM/PM or HAM/PM
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
    tags = ["financial-assistance", "social-services"]

    # LIHEAP and utility assistance
    if any(word in text for word in ["liheap", "energy assistance", "utility", "heating", "cooling", "electric", "gas bill"]):
        category = "community"
        tags.extend(["liheap", "utilities", "energy-assistance"])

    # Rent and housing assistance
    elif any(word in text for word in ["rent", "rental assistance", "eviction", "housing"]):
        category = "community"
        tags.extend(["rent-assistance", "housing"])

    # Financial literacy workshops
    elif any(word in text for word in ["financial literacy", "budgeting", "money management", "credit", "savings"]):
        category = "learning"
        tags.extend(["financial-literacy", "workshop"])

    # Enrollment periods and application events
    elif any(word in text for word in ["enrollment", "application", "apply", "sign up", "registration"]):
        category = "community"
        tags.extend(["enrollment", "assistance"])

    # Community events
    elif any(word in text for word in ["community event", "town hall", "meeting", "orientation"]):
        category = "community"
        tags.append("community")

    # Default to community
    else:
        category = "community"

    # All FACAA services are free for eligible participants
    is_free = True
    tags.append("free")

    return category, list(set(tags)), is_free


def try_simple_requests_first(url: str) -> Optional[BeautifulSoup]:
    """
    Try fetching with simple requests first (faster than Playwright).
    Returns BeautifulSoup object if successful, None if needs Playwright.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Check if we got meaningful content
        if soup.find(string=re.compile(r'event|calendar|program|liheap|assistance', re.I)):
            return soup

        return None
    except Exception as e:
        logger.debug(f"Simple request failed, will use Playwright: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Fulton Atlanta Community Action Authority events.

    First tries simple requests, falls back to Playwright if the page
    requires JavaScript rendering.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try multiple URL patterns
        urls_to_try = [
            f"{BASE_URL}/events",
            f"{BASE_URL}/calendar",
            f"{BASE_URL}/programs",
            f"{BASE_URL}/services",
            BASE_URL,
        ]

        soup = None
        successful_url = None

        for url in urls_to_try:
            logger.info(f"Trying URL: {url}")
            soup = try_simple_requests_first(url)
            if soup:
                successful_url = url
                break

        # If simple request didn't work, use Playwright
        if not soup:
            logger.info(f"Fetching with Playwright: {EVENTS_URL}")
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    viewport={"width": 1920, "height": 1080},
                )
                page = context.new_page()
                page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load any lazy-loaded content
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                html_content = page.content()
                soup = BeautifulSoup(html_content, "html.parser")
                successful_url = EVENTS_URL
                browser.close()

        if not soup:
            logger.warning("Could not fetch page content")
            return 0, 0, 0

        # Look for event containers
        event_selectors = [
            ".event-item",
            ".event-card",
            ".event",
            "[class*='event']",
            ".calendar-event",
            "article",
            ".program",
            ".service",
        ]

        events = None
        for selector in event_selectors:
            events = soup.select(selector)
            if events and len(events) > 0:
                logger.info(f"Found {len(events)} events using selector: {selector}")
                break

        if not events or len(events) == 0:
            logger.info("No structured event elements found")
            logger.info(f"FACAA venue record ensured (ID: {venue_id})")
            return 0, 0, 0

        today = date.today()

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

                # Skip non-event items
                skip_patterns = ["hours", "schedule", "contact us", "about", "our services", "staff"]
                if any(pattern in title.lower() for pattern in skip_patterns):
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

                # If no date element, search text for date patterns
                if not date_str:
                    event_text = event_elem.get_text()
                    date_match = re.search(
                        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?',
                        event_text,
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

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < today:
                        logger.debug(f"Skipping past event: {title} on {start_date}")
                        continue
                except ValueError:
                    pass

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
                event_url = successful_url or BASE_URL
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
                    title, "Fulton Atlanta Community Action Authority", start_date
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
                    "price_note": "Free for eligible participants",
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
            f"FACAA crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching FACAA events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl FACAA: {e}")
        raise

    return events_found, events_new, events_updated
