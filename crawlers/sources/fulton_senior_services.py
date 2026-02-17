"""
Crawler for Fulton County Senior Services (fultoncountyga.gov/senior-services).

Fulton County Senior Services provides programs and services for older adults:
- Senior wellness programs
- Medicare assistance and benefits counseling
- Exercise and fitness classes
- Health screenings
- Social activities and clubs
- Educational workshops
- Nutrition programs

Located at multiple senior centers throughout Fulton County, headquartered in SW Atlanta.

STRATEGY:
- Scrape events/calendar pages for senior programs
- Extract wellness events, Medicare assistance days, fitness classes, social activities
- Tag appropriately: senior, medicare, wellness, free, aging
- Most events are free for seniors
- Category: "community" for social events, "fitness" for exercise, "learning" for workshops
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

BASE_URL = "https://www.fultoncountyga.gov"
SENIOR_SERVICES_URL = f"{BASE_URL}/inside-fulton-county/fulton-county-departments/senior-services"

VENUE_DATA = {
    "name": "Fulton County Senior Services",
    "slug": "fulton-county-senior-services",
    "address": "4001 Danforth Rd SW",
    "neighborhood": "Southwest Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30331",
    "lat": 33.6980,
    "lng": -84.5070,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": SENIOR_SERVICES_URL,
    "vibes": ["senior", "wellness", "community"],
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
    tags = ["senior"]

    # Fitness and exercise
    if any(word in text for word in ["exercise", "fitness", "yoga", "tai chi", "dance", "zumba", "aerobic", "strength"]):
        category = "fitness"
        tags.extend(["wellness", "exercise"])

    # Health screenings and Medicare
    elif any(word in text for word in ["medicare", "health screening", "wellness check", "blood pressure", "benefits counseling"]):
        category = "community"
        tags.extend(["medicare", "wellness", "health-screening"])

    # Educational workshops
    elif any(word in text for word in ["workshop", "class", "seminar", "training", "education", "computer", "technology"]):
        category = "learning"
        tags.extend(["workshop", "education"])

    # Social activities
    elif any(word in text for word in ["bingo", "cards", "social", "club", "game", "movie", "party", "lunch", "dinner"]):
        category = "community"
        tags.extend(["social"])

    # Arts and crafts
    elif any(word in text for word in ["art", "craft", "painting", "knitting", "sewing"]):
        category = "arts"
        tags.extend(["arts", "creative"])

    # Volunteer opportunities
    elif any(word in text for word in ["volunteer", "volunteering"]):
        category = "community"
        tags.extend(["volunteer"])

    # Default to community
    else:
        category = "community"

    # Most senior services events are free
    is_free = True
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary"]):
        is_free = True
        tags.append("free")
    elif any(word in text for word in ["$", "ticket", "registration fee", "cost:"]):
        if "free" in text or "no cost" in text:
            is_free = True
            tags.append("free")
        else:
            is_free = False

    # Add aging tag
    tags.append("aging")

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
        if soup.find(string=re.compile(r'event|calendar|date|program|senior', re.I)):
            return soup

        return None
    except Exception as e:
        logger.debug(f"Simple request failed, will use Playwright: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Fulton County Senior Services events.

    First tries simple requests, falls back to Playwright if needed.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try events/calendar subpage first
        events_pages = [
            f"{SENIOR_SERVICES_URL}/events",
            f"{SENIOR_SERVICES_URL}/calendar",
            SENIOR_SERVICES_URL,
        ]

        soup = None
        for page_url in events_pages:
            logger.info(f"Trying simple fetch: {page_url}")
            soup = try_simple_requests_first(page_url)
            if soup:
                break

        # If simple request didn't work, use Playwright
        if not soup:
            logger.info(f"Fetching with Playwright: {SENIOR_SERVICES_URL}")
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    viewport={"width": 1920, "height": 1080},
                )
                page = context.new_page()
                page.goto(SENIOR_SERVICES_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load lazy content
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                html_content = page.content()
                soup = BeautifulSoup(html_content, "html.parser")
                browser.close()

        # Look for event containers
        event_selectors = [
            ".event-item",
            ".event-card",
            ".event",
            "[class*='event']",
            ".calendar-event",
            "article",
            ".program",
            ".activity",
        ]

        events = None
        for selector in event_selectors:
            events = soup.select(selector)
            if events and len(events) > 0:
                logger.info(f"Found {len(events)} events using selector: {selector}")
                break

        # If no structured events found
        if not events or len(events) == 0:
            logger.info("No structured event elements found")
            logger.info(f"Fulton County Senior Services venue record ensured (ID: {venue_id})")
            return 0, 0, 0

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
                skip_patterns = ["hours", "contact", "about", "location", "staff"]
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
                    if not date_match:
                        date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', event_text)
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
                event_url = SENIOR_SERVICES_URL
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
                    title, "Fulton County Senior Services", start_date
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
                    "price_note": "Free for seniors",
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
            f"Fulton County Senior Services crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Fulton County Senior Services events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Fulton County Senior Services: {e}")
        raise

    return events_found, events_new, events_updated
