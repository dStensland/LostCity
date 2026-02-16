"""
Crawler for Susan G Komen Greater Atlanta (komenatlanta.org).

Susan G Komen provides breast cancer education, screening programs,
and support services for patients and survivors.

Events include:
- Race for the Cure / More Than Pink Walk (major annual fundraiser)
- Breast cancer screening programs
- Support group meetings
- Educational workshops
- Survivor events and celebrations

Located in Buckhead, serving the Greater Atlanta area.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.komenatlanta.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Susan G Komen Greater Atlanta",
    "slug": "komen-atlanta",
    "address": "3495 Piedmont Rd NE, Bldg 11, Suite 416",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8550,
    "lng": -84.3660,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["breast-cancer", "screening", "support", "survivors"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string to 24-hour format."""
    try:
        time_str = time_str.strip().upper()
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


def categorize_event(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = ["breast-cancer"]

    # Race for the Cure / More Than Pink Walk
    if any(word in text for word in ["race for the cure", "more than pink", "walk", "5k", "run", "fundraiser"]):
        category = "community"
        tags.extend(["fundraiser", "walk", "awareness", "outdoor"])
        is_free = "free registration" in text

    # Screening programs
    elif any(word in text for word in ["screening", "mammogram", "health fair", "breast health"]):
        category = "wellness"
        tags.extend(["screening", "preventive-care", "health", "free"])
        is_free = True

    # Support groups
    elif any(word in text for word in ["support group", "survivor", "patient support", "peer support"]):
        category = "wellness"
        tags.extend(["support-group", "patient-support", "survivors", "mental-health"])
        is_free = True

    # Educational workshops
    elif any(word in text for word in ["workshop", "education", "seminar", "webinar", "class", "training"]):
        category = "learning"
        tags.extend(["education", "health-education", "awareness"])
        is_free = True

    # Awareness events
    elif any(word in text for word in ["awareness", "pink", "campaign", "advocacy"]):
        category = "community"
        tags.extend(["awareness", "advocacy", "pink"])
        is_free = True

    # Default
    else:
        category = "community"
        tags.append("community-health")
        is_free = True

    # Check for explicit free/paid markers
    if "free" in text or "no cost" in text:
        is_free = True
        tags.append("free")
    elif "$" in text or "ticket" in text or "registration fee" in text:
        if "free" not in text:
            is_free = False

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

        if soup.find(string=re.compile(r'event|calendar|race|walk', re.I)):
            return soup

        return None
    except Exception as e:
        logger.debug(f"Simple request failed, will use Playwright: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Susan G Komen Greater Atlanta events.

    First tries simple requests, falls back to Playwright if needed.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try simple requests first
        logger.info(f"Trying simple fetch: {EVENTS_URL}")
        soup = try_simple_requests_first(EVENTS_URL)

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
            "article",
            ".card",
            ".tribe-events-list-event",
        ]

        events = None
        for selector in event_selectors:
            events = soup.select(selector)
            if events and len(events) > 0:
                logger.info(f"Found {len(events)} events using selector: {selector}")
                break

        if not events or len(events) == 0:
            logger.info("No structured event elements found")
            logger.info(f"Komen Atlanta venue record ensured (ID: {venue_id})")
            return 0, 0, 0

        today = datetime.now().date()

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

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < today:
                        logger.debug(f"Skipping past event: {title}")
                        continue
                except ValueError:
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
                event_url = EVENTS_URL
                if link_elem:
                    href = link_elem.get("href")
                    if href:
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href

                # Determine category and tags
                category, tags, is_free = categorize_event(title, description or "")

                # Generate content hash for deduplication
                content_hash = generate_content_hash(
                    title, "Susan G Komen Greater Atlanta", start_date
                )

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    logger.debug(f"Event already exists: {title}")
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
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
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
            f"Komen Atlanta crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Komen Atlanta events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Komen Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
