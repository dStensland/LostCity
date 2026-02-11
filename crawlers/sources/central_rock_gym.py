"""
Crawler for Central Rock Gym Atlanta (formerly Stone Summit Climbing).

SOURCE: centralrockgym.com/atlanta/climbing_type/events/
PURPOSE: Climbing gym with special events (BIPOC/LGBTQ+ meetups, adaptive climbing,
         competitions, community events).

Separate from regular gym hours — only crawls scheduled special events.
WordPress site (Genesis theme) with event post archive.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://centralrockgym.com"
EVENTS_URL = f"{BASE_URL}/atlanta/climbing_type/events/"

VENUE_DATA = {
    "name": "Central Rock Gym Atlanta",
    "slug": "central-rock-gym-atlanta",
    "address": "3701 Presidential Parkway",
    "neighborhood": "Chamblee",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8875,
    "lng": -84.2780,
    "venue_type": "fitness_center",
    "spot_type": "fitness_center",
    "website": "https://centralrockgym.com/atlanta/",
    "vibes": ["climbing", "fitness", "community", "inclusive"],
}

# Keywords to detect event types
CLIMBING_KEYWORDS = ["climb", "boulder", "rope", "belay", "route", "wall"]
YOGA_KEYWORDS = ["yoga", "stretch", "mindfulness", "meditation"]
BIPOC_KEYWORDS = ["bipoc", "color", "black", "brown", "diversity", "inclusion"]
LGBTQ_KEYWORDS = ["pride", "lgbtq", "queer", "rainbow", "unharnessed"]
ADAPTIVE_KEYWORDS = ["adaptive", "accessible", "disability", "wheelchair", "special needs"]
COMPETITION_KEYWORDS = ["competition", "comp", "contest", "tournament", "championship"]

# Words that indicate non-events (operations, not special programs)
SKIP_KEYWORDS = [
    "now hiring",
    "job",
    "employment",
    "open gym",
    "day pass",
    "membership",
    "hours",
    "birthday party",
]


def categorize_event(title: str, description: str = "") -> dict:
    """
    Determine category, subcategory, and tags based on event content.

    Returns:
        Dict with 'category', 'subcategory', and 'tags'
    """
    text = f"{title} {description}".lower()

    # Default to fitness/climbing
    category = "fitness"
    subcategory = "climbing"
    tags = ["climbing", "fitness", "indoor"]

    # Detect yoga
    if any(kw in text for kw in YOGA_KEYWORDS):
        subcategory = "yoga"
        tags = ["yoga", "stretching", "mindfulness"]
    # Detect competition
    elif any(kw in text for kw in COMPETITION_KEYWORDS):
        tags.append("competition")
    # Detect bouldering specifically
    elif "boulder" in text:
        tags.append("bouldering")

    # Add inclusive tags
    if any(kw in text for kw in BIPOC_KEYWORDS):
        tags.extend(["bipoc", "inclusive", "community"])
    if any(kw in text for kw in LGBTQ_KEYWORDS):
        tags.extend(["lgbtq", "inclusive", "pride"])
    if any(kw in text for kw in ADAPTIVE_KEYWORDS):
        tags.extend(["adaptive", "inclusive", "accessibility"])

    # Dedupe tags
    tags = list(set(tags))

    return {
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
    }


def should_skip_event(title: str, description: str = "") -> bool:
    """Check if this is a non-event (operations, not a special program)."""
    text = f"{title} {description}".lower()
    return any(kw in text for kw in SKIP_KEYWORDS)


def parse_wordpress_date(date_str: str) -> Optional[str]:
    """
    Parse WordPress post date formats to YYYY-MM-DD.

    Handles:
    - "February 15, 2026"
    - "Feb 15, 2026"
    - "2026-02-15"
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    # Already in ISO format
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date_str

    # Try various common formats
    formats = [
        "%B %d, %Y",  # February 15, 2026
        "%b %d, %Y",  # Feb 15, 2026
        "%m/%d/%Y",   # 02/15/2026
        "%d %B %Y",   # 15 February 2026
        "%d %b %Y",   # 15 Feb 2026
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    logger.warning(f"Could not parse date: {date_str}")
    return None


def extract_time_from_text(text: str) -> Optional[str]:
    """
    Extract time from text content.

    Looks for patterns like:
    - "7:00 PM - 9:00 PM"
    - "6:30pm to 8:30pm"
    - "at 5:00 PM"
    """
    if not text:
        return None

    # Look for time patterns
    time_patterns = [
        r"(\d{1,2}:\d{2}\s*[AP]M)",
        r"(\d{1,2}\s*[AP]M)",
    ]

    for pattern in time_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            time_str = match.group(1)
            return normalize_time_format(time_str)

    return None


def parse_event_cards_from_html(html_text: str, venue_id: int, source_id: int, image_map: dict, event_links: dict) -> list[dict]:
    """
    Parse WordPress event post cards from HTML text.

    WordPress Genesis theme typically structures events as:
    - Post title (event name)
    - Post date (publication date, may not be event date)
    - Post excerpt/content (description with event details)

    We need to extract event dates from the content since post date != event date.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html_text, "lxml")
    events = []

    # Find all post entries (Genesis theme structure)
    articles = soup.find_all("article", class_=re.compile(r"post|entry"))

    if not articles:
        # Fallback: look for any article tags
        articles = soup.find_all("article")

    logger.info(f"Found {len(articles)} article/post entries on page")

    for article in articles:
        try:
            # Extract title
            title_elem = article.find(["h1", "h2", "h3"], class_=re.compile(r"entry-title|post-title"))
            if not title_elem:
                title_elem = article.find(["h1", "h2", "h3"])

            if not title_elem:
                continue

            title = title_elem.get_text(strip=True)

            # Skip non-events
            if not title or len(title) < 5:
                continue

            # Extract content/excerpt
            content_elem = article.find(["div", "p"], class_=re.compile(r"entry-content|entry-summary|excerpt"))
            if not content_elem:
                content_elem = article.find("div", class_="entry")
            if not content_elem:
                # Try to get all text from article
                content_elem = article

            description = content_elem.get_text(separator=" ", strip=True) if content_elem else ""

            # Skip operational posts
            if should_skip_event(title, description):
                logger.debug(f"Skipping non-event: {title}")
                continue

            # Extract event date from content
            # Look for date patterns in the description
            date_patterns = [
                r"(?:on|date:)\s*([A-Za-z]+ \d{1,2},? \d{4})",
                r"(\d{1,2}/\d{1,2}/\d{4})",
                r"([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,? \d{4})",
            ]

            start_date = None
            for pattern in date_patterns:
                match = re.search(pattern, description, re.IGNORECASE)
                if match:
                    date_str = match.group(1)
                    start_date = parse_wordpress_date(date_str)
                    if start_date:
                        break

            # If no date found, try to extract from post date metadata
            if not start_date:
                time_elem = article.find("time")
                if time_elem:
                    datetime_attr = time_elem.get("datetime")
                    if datetime_attr:
                        start_date = parse_wordpress_date(datetime_attr.split("T")[0])

            # If still no date, skip this event
            if not start_date:
                logger.warning(f"No date found for event: {title}")
                continue

            # Skip past events (more than 7 days ago)
            try:
                event_dt = datetime.strptime(start_date, "%Y-%m-%d")
                if event_dt < datetime.now() - timedelta(days=7):
                    logger.debug(f"Skipping past event: {title} ({start_date})")
                    continue
            except ValueError:
                pass

            # Extract time from description
            start_time = extract_time_from_text(description)

            # Categorize event
            cat_info = categorize_event(title, description)

            # Get image
            image_url = image_map.get(title)
            if not image_url:
                # Try to find image in article
                img = article.find("img")
                if img:
                    image_url = img.get("src") or img.get("data-src")

            # Get event URL
            link_elem = article.find("a", href=True)
            event_url = find_event_url(title, event_links, EVENTS_URL) if event_links else EVENTS_URL
            if link_elem and not event_url.startswith(BASE_URL):
                href = link_elem.get("href")
                if href and href.startswith("http"):
                    event_url = href
                elif href and href.startswith("/"):
                    event_url = BASE_URL + href

            # Build description
            if not description or len(description) < 20:
                description = f"Special event at Central Rock Gym Atlanta. {title}"

            # Truncate overly long descriptions
            if len(description) > 500:
                description = description[:497] + "..."

            # Check for recurring patterns
            is_recurring = False
            recurrence_rule = None
            if "weekly" in description.lower() or "every week" in description.lower():
                is_recurring = True
                # Try to detect day of week
                day_match = re.search(r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)", description, re.IGNORECASE)
                if day_match:
                    day_name = day_match.group(1)
                    day_abbr = day_name[:2].upper()
                    recurrence_rule = f"FREQ=WEEKLY;BYDAY={day_abbr}"

            # Build event record
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
                "category": cat_info["category"],
                "subcategory": cat_info["subcategory"],
                "tags": cat_info["tags"],
                "price_min": None,
                "price_max": None,
                "price_note": "Check website for pricing",
                "is_free": False,
                "source_url": event_url,
                "ticket_url": None,
                "image_url": image_url,
                "raw_text": f"{title} - {description[:200]}",
                "extraction_confidence": 0.80,
                "is_recurring": is_recurring,
                "recurrence_rule": recurrence_rule,
                "content_hash": generate_content_hash(title, VENUE_DATA["name"], start_date),
            }

            events.append(event_record)

        except Exception as e:
            logger.warning(f"Error parsing event card: {e}")
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Central Rock Gym Atlanta events.
    """
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

            logger.info(f"Fetching Central Rock Gym events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load lazy images
            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images and links
            image_map = extract_images_from_page(page)
            event_links = extract_event_links(page, BASE_URL)

            # Get venue ID
            venue_id = get_or_create_venue(VENUE_DATA)

            # Get page HTML
            html_content = page.content()

            # Parse events
            event_records = parse_event_cards_from_html(
                html_content, venue_id, source_id, image_map, event_links
            )

            logger.info(f"Found {len(event_records)} events")

            for event_record in event_records:
                events_found += 1

                # Check for existing
                existing = find_event_by_hash(event_record["content_hash"])
                if existing:
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        f"Added: {event_record['title']} on {event_record['start_date']}"
                    )
                except Exception as e:
                    logger.error(f"Failed to insert: {event_record['title']}: {e}")

            browser.close()

        logger.info(
            f"Central Rock Gym crawl complete: {events_found} found, {events_new} new"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Central Rock Gym: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Central Rock Gym: {e}")
        raise

    return events_found, events_new, events_updated
