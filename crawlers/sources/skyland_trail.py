"""
Crawler for Skyland Trail (skylandtrail.org).

Premier Atlanta mental health nonprofit offering residential treatment, day programs,
and community education. Events include Dorothy C. Fuqua Lecture series, Arts in the Garden,
professional education workshops, and fundraisers.

Uses Playwright to scrape JavaScript-rendered events page.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.skylandtrail.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Skyland Trail",
    "slug": "skyland-trail",
    "address": "1961 N Druid Hills Rd NE",
    "neighborhood": "Briarcliff",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.8134,
    "lng": -84.3282,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["inclusive", "educational"],
}

# Skip internal/private events
SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
    "executive",
    "alumni",  # Usually restricted
]

# Lecture/education indicators
LECTURE_KEYWORDS = [
    "lecture",
    "fuqua",
    "speaker",
    "presentation",
    "talk",
]

# Arts event indicators
ARTS_KEYWORDS = [
    "arts in the garden",
    "art",
    "garden",
    "creative",
    "exhibition",
]

# Fundraiser indicators
FUNDRAISER_KEYWORDS = [
    "fundraiser",
    "gala",
    "benefit",
    "luncheon",
    "laughter",
    "trailblazers",
    "associates",
]

# Professional education indicators
PROFESSIONAL_KEYWORDS = [
    "professional",
    "workshop",
    "training",
    "ceu",
    "continuing education",
    "certification",
]


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse various datetime formats to date and time.
    Returns (YYYY-MM-DD, HH:MM) tuple.
    """
    if not dt_str:
        return None, None

    try:
        # Try ISO format first
        dt = datetime.fromisoformat(dt_str.replace("T", " ").split("+")[0].split("Z")[0].strip())
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        pass

    # Try common formats
    formats = [
        "%B %d, %Y %I:%M %p",
        "%B %d, %Y",
        "%Y-%m-%d %H:%M:%S",
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(dt_str.strip(), fmt)
            if "%I" in fmt or "%H" in fmt:
                return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
            else:
                return dt.strftime("%Y-%m-%d"), None
        except (ValueError, AttributeError):
            continue

    logger.debug(f"Could not parse datetime '{dt_str}'")
    return None, None


def strip_html(html: str) -> str:
    """Strip HTML tags and clean up text."""
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    # Clean up multiple spaces
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["mental-health", "nonprofit"]

    # Lectures
    if any(kw in text for kw in LECTURE_KEYWORDS):
        tags.extend(["lecture", "education"])
        return "learning", None, tags

    # Arts events
    if any(kw in text for kw in ARTS_KEYWORDS):
        tags.extend(["art", "community"])
        return "art", None, tags

    # Fundraisers
    if any(kw in text for kw in FUNDRAISER_KEYWORDS):
        tags.append("charity")
        return "community", "fundraiser", tags

    # Professional education
    if any(kw in text for kw in PROFESSIONAL_KEYWORDS):
        tags.extend(["professional", "continuing-education"])
        return "learning", None, tags

    # Default to community
    tags.append("wellness")
    return "community", None, tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public vs. internal."""
    text = f"{title} {description}".lower()

    # Skip internal events
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Skyland Trail events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching Skyland Trail events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)  # Wait for JS to render

            # Get page HTML
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Look for event containers (common WordPress patterns)
            event_containers = []

            # Try various selectors
            for selector in [
                ".tribe-events-list-event-row",
                ".event",
                ".event-item",
                "article.post",
                ".entry",
                "[class*='event']",
            ]:
                found = soup.select(selector)
                if found and len(found) > 0:
                    event_containers = found
                    logger.info(f"Found {len(event_containers)} events with selector '{selector}'")
                    break

            if not event_containers:
                logger.warning("No event containers found on page")
                browser.close()
                return 0, 0, 0

            seen_events = set()

            for container in event_containers:
                try:
                    # Extract title
                    title_elem = container.find(["h2", "h3", "h4", ".event-title", ".entry-title"])
                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)
                    if not title or len(title) < 5:
                        continue

                    # Extract date/time
                    date_elem = container.find([".event-date", ".tribe-event-date-start", "time", ".date"])
                    if not date_elem:
                        # Try to find date in text
                        text = container.get_text()
                        date_match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}",
                            text,
                            re.I,
                        )
                        if date_match:
                            date_str = date_match.group(0)
                        else:
                            continue
                    else:
                        date_str = date_elem.get("datetime") or date_elem.get_text(strip=True)

                    start_date, start_time = parse_datetime(date_str)
                    if not start_date:
                        logger.debug(f"Could not parse date for: {title}")
                        continue

                    # Extract description
                    desc_elem = container.find([".description", ".event-description", ".entry-summary", "p"])
                    description = strip_html(str(desc_elem))[:500] if desc_elem else ""

                    # Extract URL
                    link_elem = container.find("a", href=True)
                    event_url = link_elem["href"] if link_elem else EVENTS_URL
                    if event_url.startswith("/"):
                        event_url = f"{BASE_URL}{event_url}"

                    # Extract image
                    img_elem = container.find("img", src=True)
                    image_url = img_elem["src"] if img_elem else None
                    if image_url and image_url.startswith("/"):
                        image_url = f"{BASE_URL}{image_url}"

                    # Check if public
                    if not is_public_event(title, description):
                        logger.debug(f"Skipping internal event: {title}")
                        continue

                    # Dedupe
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, VENUE_DATA["name"], start_date
                    )

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Determine category and tags
                    category, subcategory, tags = determine_category_and_tags(title, description)

                    # Check if free
                    cost_text = f"{title} {description}".lower()
                    is_free = "free" in cost_text or "no cost" in cost_text or "complimentary" in cost_text

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": description if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} {description}"[:500],
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title[:50]}... on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Skyland Trail crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Skyland Trail: {e}")
        raise

    return events_found, events_new, events_updated
