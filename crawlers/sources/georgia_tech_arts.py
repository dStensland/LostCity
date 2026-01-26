"""
Crawler for Georgia Tech Arts Events (arts.gatech.edu).
Performing arts, concerts, theater, exhibitions at Georgia Tech including Ferst Center.
Uses Playwright to handle JavaScript-rendered content.
"""

import json
import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://arts.gatech.edu"
EVENTS_URL = f"{BASE_URL}/events"

VENUES = {
    "ferst": {
        "name": "Ferst Center for the Arts",
        "slug": "ferst-center",
        "address": "349 Ferst Drive NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "venue_type": "theater",
        "website": "https://ferstcenter.gatech.edu",
    },
    "default": {
        "name": "Georgia Tech Arts",
        "slug": "georgia-tech-arts",
        "address": "823 Marietta Street NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "university",
        "website": BASE_URL,
    },
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse various date formats to YYYY-MM-DD."""
    if not date_str:
        return None

    date_str = date_str.strip()

    # Try common formats
    for fmt in [
        "%A, %B %d, %Y",
        "%B %d, %Y",
        "%Y-%m-%d",
        "%m/%d/%Y",
    ]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_str:
        return None

    # Try to match time patterns
    match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)', time_str)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    return None


def categorize_event(title: str, description: str) -> tuple[str, str]:
    """Determine category and subcategory."""
    title_lower = title.lower()
    desc_lower = description.lower()

    # Music
    if any(word in title_lower for word in ["concert", "symphony", "jazz", "choir", "orchestra", "recital"]):
        return "music", "concert"

    # Theater
    if any(word in title_lower for word in ["theater", "theatre", "play", "dance", "ballet"]):
        return "theater", "performance"

    # Art
    if any(word in title_lower for word in ["exhibition", "gallery", "art show", "opening"]):
        return "art", "exhibition"

    # Film
    if any(word in title_lower for word in ["film", "screening", "movie"]):
        return "film", "screening"

    # Lectures
    if any(word in title_lower for word in ["lecture", "talk", "discussion", "symposium"]):
        return "community", "lecture"

    # Default to arts/performance
    return "arts", "performance"


def parse_date_from_text(text: str) -> Optional[str]:
    """Extract date from text like 'Feb 27, 2026' or 'February 27, 2026'."""
    if not text:
        return None

    # Match patterns like "Feb 27, 2026" or "February 27, 2026"
    month_pattern = r'(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})'
    match = re.search(month_pattern, text, re.IGNORECASE)
    if match:
        month_str, day, year = match.groups()
        # Map month abbreviation to number
        month_map = {
            'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
            'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
            'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
            'nov': 11, 'november': 11, 'dec': 12, 'december': 12
        }
        month = month_map.get(month_str.lower())
        if month:
            return f"{year}-{month:02d}-{int(day):02d}"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Tech Arts events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching Georgia Tech Arts: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)  # Wait for JS to render

            # Get page HTML
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Get venue IDs
            ferst_venue_id = get_or_create_venue(VENUES["ferst"])
            default_venue_id = get_or_create_venue(VENUES["default"])

            # Student-only event keywords to filter out
            STUDENT_KEYWORDS = [
                'hackathon', 'town hall', 'org fair', 'student org', 'spring break',
                'grad student', 'social mixer', 'alternative break', 'wreckcon',
                'create-your-own', 'media arts day', 'community salon', 'ceismc',
                'end-of-year', 'open call'
            ]

            # Find all unique event links
            event_links = soup.find_all('a', href=lambda x: x and '/event/' in str(x))
            unique_events = {}
            for link in event_links:
                href = link.get('href')
                text = link.get_text(strip=True)
                # Skip "LEARN MORE" links, "Image" links, and empty text
                if href and text and text not in ['LEARN MORE →', 'Image', ''] and len(text) > 3:
                    # Skip student-focused events
                    if any(kw in text.lower() for kw in STUDENT_KEYWORDS):
                        continue
                    if href not in unique_events:
                        unique_events[href] = text

            logger.info(f"Found {len(unique_events)} unique event links")

            for href, title in unique_events.items():
                try:
                    # Build full URL
                    if href.startswith('http'):
                        event_url = href
                    else:
                        event_url = f"{BASE_URL}{href}" if href.startswith('/') else f"{BASE_URL}/{href}"

                    # Visit event detail page to get date info
                    page.goto(event_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(1000)

                    event_html = page.content()
                    event_soup = BeautifulSoup(event_html, "html.parser")

                    # Extract date from the event page text
                    page_text = event_soup.get_text()
                    start_date = parse_date_from_text(page_text)

                    if not start_date:
                        logger.debug(f"No date found for {title}")
                        continue

                    # Extract time
                    start_time = parse_time(page_text)

                    events_found += 1

                    # Extract description from meta or page content
                    description = ""
                    meta_desc = event_soup.find('meta', attrs={'name': 'description'})
                    if meta_desc and meta_desc.get('content'):
                        description = meta_desc.get('content')[:500]
                    else:
                        # Try to find description in page
                        desc_elem = event_soup.find(class_=re.compile(r'(body|description|content)'))
                        if desc_elem:
                            description = desc_elem.get_text(strip=True)[:500]

                    # Extract image
                    image_url = None
                    og_image = event_soup.find('meta', property='og:image')
                    if og_image and og_image.get('content'):
                        image_url = og_image.get('content')
                    else:
                        img_elem = event_soup.find('img', src=re.compile(r'/sites/default/files/'))
                        if img_elem:
                            src = img_elem.get('src')
                            if src:
                                if src.startswith('http'):
                                    image_url = src
                                elif src.startswith("/"):
                                    image_url = f"{BASE_URL}{src}"

                    # Determine venue
                    venue_id = ferst_venue_id if "ferst" in title.lower() else default_venue_id
                    venue_name = VENUES["ferst"]["name"] if venue_id == ferst_venue_id else VENUES["default"]["name"]

                    # Check for duplicates
                    content_hash = generate_content_hash(title, venue_name, start_date)
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Categorize
                    category, subcategory = categorize_event(title, description)

                    # Build tags
                    tags = ["college", "georgia-tech", "midtown", "arts"]

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"Event at {venue_name}",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": None,
                        "source_url": event_url or EVENTS_URL,
                        "ticket_url": None,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.75,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.debug(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing event block: {e}")
                    continue

            browser.close()

        logger.info(
            f"Georgia Tech Arts: Found {events_found} events, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Tech Arts: {e}")
        raise

    return events_found, events_new, events_updated
