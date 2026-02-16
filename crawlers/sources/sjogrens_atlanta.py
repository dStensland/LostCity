"""
Crawler for Sjögren's Foundation Atlanta Support Group (sjogrens.org).

The Sjögren's Foundation Atlanta group provides support for people with Sjögren's syndrome:
- Monthly virtual support groups (3rd Saturday 12:30-2:30pm ET)
- Educational resources
- Community support
- Awareness events

Virtual meetings accessible to all Atlanta-area residents.

STRATEGY:
- Scrape support groups page or Atlanta chapter page
- Extract monthly virtual meetings and events
- Tag: sjogrens, autoimmune, support-group, free
- Category: "support_group"
- All meetings are free
"""

from __future__ import annotations

import re
import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://sjogrens.org"
GROUPS_URL = f"{BASE_URL}/support-groups"

VENUE_DATA = {
    "name": "Sjögren's Foundation Atlanta Support Group",
    "slug": "sjogrens-atlanta",
    "address": "Atlanta, GA",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7834,
    "lng": -84.3831,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["sjogrens", "autoimmune", "support"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string to 24-hour format."""
    try:
        time_str = time_str.strip().upper()
        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

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
    tags = ["sjogrens", "autoimmune", "support-group"]

    # Support groups
    if any(word in text for word in ["support", "group", "meeting"]):
        category = "support_group"
    # Educational
    elif any(word in text for word in ["workshop", "webinar", "education"]):
        category = "learning"
        tags.append("education")
    else:
        category = "community"

    # Virtual
    if any(word in text for word in ["virtual", "zoom", "online"]):
        tags.append("virtual")

    # Free
    tags.append("free")
    is_free = True

    return category, list(set(tags)), is_free


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Sjögren's Foundation Atlanta support groups."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching with Playwright: {GROUPS_URL}")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()
            page.goto(GROUPS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            html_content = page.content()
            soup = BeautifulSoup(html_content, "html.parser")
            browser.close()

        event_selectors = [
            ".group",
            ".event",
            "[class*='group']",
            "[class*='event']",
            "article",
        ]

        events = None
        for selector in event_selectors:
            events = soup.select(selector)
            if events and len(events) > 0:
                logger.info(f"Found {len(events)} items using selector: {selector}")
                break

        if not events or len(events) == 0:
            logger.info("No structured event elements found")
            logger.info(f"Sjögren's Atlanta venue record ensured (ID: {venue_id})")
            return 0, 0, 0

        for event_elem in events:
            try:
                title_elem = event_elem.select_one("h1, h2, h3, h4, .title, [class*='title']")
                if title_elem:
                    title = title_elem.get_text(strip=True)
                else:
                    event_text = event_elem.get_text(strip=True)
                    lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                    title = lines[0] if lines else None

                if not title or len(title) < 3:
                    continue

                # Skip non-Atlanta groups
                if "atlanta" not in event_elem.get_text().lower():
                    continue

                date_elem = event_elem.select_one(".date, [class*='date'], time")
                date_str = None
                if date_elem:
                    date_str = date_elem.get_text(strip=True)

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

                start_date = parse_human_date(date_str)
                if not start_date:
                    logger.debug(f"Could not parse date '{date_str}' for: {title}")
                    continue

                events_found += 1

                time_str = None
                time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', event_elem.get_text())
                if time_match:
                    time_str = time_match.group(0)

                start_time = None
                if time_str:
                    start_time = parse_time_string(time_str)

                description = None
                desc_elem = event_elem.select_one(".description, .excerpt, p")
                if desc_elem:
                    description = desc_elem.get_text(strip=True)
                    if len(description) > 500:
                        description = description[:497] + "..."

                link_elem = event_elem.select_one("a[href]")
                event_url = GROUPS_URL
                if link_elem:
                    href = link_elem.get("href")
                    if href:
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href

                category, tags, is_free = determine_category_and_tags(title, description or "")

                content_hash = generate_content_hash(
                    title, "Sjögren's Foundation Atlanta Support Group", start_date
                )

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

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
                    "price_note": "Free virtual support group",
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": None,
                    "image_url": None,
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
            f"Sjögren's Atlanta crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Sjögren's Atlanta events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Sjögren's Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
