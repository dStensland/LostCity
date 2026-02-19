"""
Crawler for Hemophilia of Georgia (hog.org).

Hemophilia of Georgia provides comprehensive support for individuals and families
affected by bleeding disorders in Georgia:
- Educational programs and workshops
- Camp Wannaklot summer camp for kids with bleeding disorders
- Family education weekends
- Advocacy and community support events
- Emergency financial assistance
- Scholarship programs

Located in Sandy Springs, serving the Atlanta metro and broader Georgia community.

STRATEGY:
- Scrape events page for upcoming programs, camp dates, and community events
- Tag: hemophilia, blood-disorders, education, camp, support
- Most events are free or subsidized for families affected by bleeding disorders
- Category: "community" for family events, "learning" for workshops, "camp" for Camp Wannaklot
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

BASE_URL = "https://www.hog.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Hemophilia of Georgia",
    "slug": "hemophilia-of-georgia",
    "address": "8800 Roswell Rd, Suite 170",
    "neighborhood": "Sandy Springs",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30350",
    "lat": 33.9530,
    "lng": -84.3570,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["hemophilia", "blood-disorders", "support"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string to 24-hour format."""
    try:
        time_str = time_str.strip().upper()
        # Remove timezone indicators
        time_str = re.sub(r'\s+(ET|EST|EDT|CT|CST|CDT)$', '', time_str)

        # If it's a range, extract the first time
        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

        # Pattern: H:MM AM/PM or H AM/PM
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
    """Determine category, tags, and is_free flag."""
    text = f"{title} {description}".lower()
    tags = ["hemophilia", "blood-disorders"]

    # Camp events
    if any(word in text for word in ["camp", "camp wannaklot", "summer camp"]):
        category = "community"
        tags.extend(["camp", "kids", "family-friendly"])

    # Educational programs
    elif any(word in text for word in ["workshop", "education", "training", "class", "seminar", "learning"]):
        category = "learning"
        tags.extend(["education", "workshop"])

    # Advocacy events
    elif any(word in text for word in ["advocacy", "awareness", "capitol day", "legislative"]):
        category = "community"
        tags.extend(["advocacy", "awareness"])

    # Fundraising events
    elif any(word in text for word in ["fundraiser", "gala", "benefit", "golf", "tournament"]):
        category = "community"
        tags.append("fundraiser")

    # Family programs
    elif any(word in text for word in ["family", "parent", "caregiver"]):
        category = "community"
        tags.extend(["family-friendly", "support"])

    # Default
    else:
        category = "community"
        tags.append("support")

    # Only mark free when explicitly stated
    is_free = False
    if any(word in text for word in ["free", "no cost", "complimentary", "scholarship available"]):
        is_free = True
        tags.append("free")
    elif any(word in text for word in ["$", "ticket", "registration fee", "cost:", "donation"]):
        is_free = False

    return category, list(set(tags)), is_free


def try_simple_requests(url: str) -> Optional[BeautifulSoup]:
    """Try fetching with requests first."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Check for meaningful content
        if soup.find(string=re.compile(r'event|calendar|program', re.I)):
            return soup

        return None
    except Exception as e:
        logger.debug(f"Simple request failed: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Hemophilia of Georgia events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try simple requests first
        logger.info(f"Fetching Hemophilia of Georgia events: {EVENTS_URL}")
        soup = try_simple_requests(EVENTS_URL)

        # Fallback to Playwright if needed
        if not soup:
            logger.info("Using Playwright for JavaScript rendering")
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    viewport={"width": 1920, "height": 1080},
                )
                page = context.new_page()
                page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
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
            ".tribe-events-list-event",
        ]

        events = None
        for selector in event_selectors:
            events = soup.select(selector)
            if events and len(events) > 0:
                logger.info(f"Found {len(events)} events using selector: {selector}")
                break

        if not events or len(events) == 0:
            logger.info("No structured events found")
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

                # Extract date
                date_elem = event_elem.select_one(".date, .event-date, [class*='date'], time")
                date_str = None
                if date_elem:
                    date_str = date_elem.get_text(strip=True)
                    datetime_attr = date_elem.get("datetime") if hasattr(date_elem, 'get') else None
                    if datetime_attr:
                        date_str = datetime_attr

                # Search text for dates if not found
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

                start_time = parse_time_string(time_str) if time_str else None

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
                event_url = EVENTS_URL
                if link_elem:
                    href = link_elem.get("href")
                    if href:
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href

                # Determine category and tags
                category, tags, is_free = determine_category_and_tags(title, description or "")

                # Generate content hash
                content_hash = generate_content_hash(title, "Hemophilia of Georgia", start_date)

                # Check if exists

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
                    "price_note": "Many programs free or subsidized for affected families",
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
            f"Hemophilia of Georgia crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Hemophilia of Georgia: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Hemophilia of Georgia: {e}")
        raise

    return events_found, events_new, events_updated
