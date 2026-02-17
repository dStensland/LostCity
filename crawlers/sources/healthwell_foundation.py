"""
Crawler for HealthWell Foundation (healthwellfoundation.org).

HealthWell Foundation is a national nonprofit providing financial assistance to
underinsured Americans with chronic and life-altering diseases. They help with
copays, premiums, insurance deductibles, and out-of-pocket healthcare costs.

Key Programs:
- Virtual educational sessions and webinars (with partners like ACS, Triage Cancer)
- Copay assistance programs (90+ disease funds)
- Premium assistance programs
- Patient education resources

Serves Atlanta patients through national programs and virtual events.

STRATEGY:
- Scrape the events/webinars page for virtual educational events
- Extract patient education sessions, financial navigation webinars
- Tag with: financial-assistance, copay-relief, prescription-help, virtual
- All educational events are free
- Category: "learning" for educational events
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

BASE_URL = "https://www.healthwellfoundation.org"
EVENTS_URL = f"{BASE_URL}/events"
NEWS_URL = f"{BASE_URL}/news-and-stories"

VENUE_DATA = {
    "name": "HealthWell Foundation",
    "slug": "healthwell-foundation",
    "address": "1080 Peachtree St NE",  # Using Atlanta location (national org)
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7834,
    "lng": -84.3831,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["financial-assistance", "copay-relief", "prescription-help", "patient-support"],
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
    tags = ["financial-assistance"]

    # Webinars and educational sessions
    if any(word in text for word in ["webinar", "virtual session", "workshop", "seminar", "education"]):
        category = "learning"
        tags.extend(["patient-education", "virtual"])

    # Copay/financial navigation events
    elif any(word in text for word in ["copay", "financial", "assistance", "navigation", "insurance"]):
        category = "learning"
        tags.extend(["copay-relief", "healthcare-navigation"])

    # Partnership events (with ACS, Triage Cancer, etc.)
    elif any(word in text for word in ["partnership", "collaboration", "with american cancer society", "triage cancer"]):
        category = "learning"
        tags.extend(["patient-education", "virtual"])

    # Default to learning
    else:
        category = "learning"

    # Most HealthWell events are virtual
    if any(word in text for word in ["virtual", "online", "webinar", "zoom"]):
        tags.append("virtual")

    # Check for prescription help mentions
    if any(word in text for word in ["prescription", "medication", "pharmacy"]):
        tags.append("prescription-help")

    # All HealthWell educational events are free
    is_free = True
    tags.append("free")

    # Add copay relief tag
    tags.append("copay-relief")

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

        if soup.find(string=re.compile(r'event|webinar|news', re.I)):
            return soup

        return None
    except Exception as e:
        logger.debug(f"Simple request failed, will use Playwright: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl HealthWell Foundation events.

    First tries simple requests, falls back to Playwright if needed.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try events page and news page
        for url in [EVENTS_URL, NEWS_URL]:
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
                ".webinar",
                ".news-item",
                "article",
            ]

            events = None
            for selector in event_selectors:
                events = soup.select(selector)
                if events and len(events) > 0:
                    logger.info(f"Found {len(events)} potential items using selector: {selector}")
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

                    # Skip non-event news items
                    event_text_lower = event_elem.get_text().lower()
                    if not any(word in event_text_lower for word in ["webinar", "event", "session", "virtual", "register"]):
                        logger.debug(f"Skipping non-event item: {title}")
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
                        title, "HealthWell Foundation", start_date
                    )

                    # Check if already exists
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        logger.debug(f"Event already exists: {title}")
                        continue

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
            f"HealthWell Foundation crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl HealthWell Foundation: {e}")
        raise

    return events_found, events_new, events_updated
