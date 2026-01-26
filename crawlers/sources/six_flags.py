"""
Crawler for Six Flags Over Georgia (sixflags.com/overgeorgia).

Major theme park featuring seasonal festivals (Fright Fest, Holiday in the Park),
concerts, special events, and group events. Uses Playwright to render dynamic content.

Venues:
- Six Flags Over Georgia (theme park)
- White Water (water park, seasonally connected)
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sixflags.com/overgeorgia"
EVENTS_URL = f"{BASE_URL}/events"

# Six Flags Over Georgia venue
VENUE_DATA_SIXFLAGS = {
    "name": "Six Flags Over Georgia",
    "slug": "six-flags-over-georgia",
    "address": "275 Riverside Pkwy SW",
    "neighborhood": None,
    "city": "Austell",
    "state": "GA",
    "zip": "30168",
    "lat": 33.7677,
    "lng": -84.5514,
    "venue_type": "theme_park",
    "spot_type": "theme_park",
    "website": BASE_URL,
}

# White Water venue (Six Flags water park)
VENUE_DATA_WHITEWATER = {
    "name": "White Water",
    "slug": "white-water-atlanta",
    "address": "250 Cobb Pkwy N",
    "neighborhood": None,
    "city": "Marietta",
    "state": "GA",
    "zip": "30062",
    "lat": 33.9562,
    "lng": -84.5192,
    "venue_type": "water_park",
    "spot_type": "water_park",
    "website": "https://www.sixflags.com/whitewater",
}

# Event categorization keywords
EVENT_KEYWORDS = {
    "fright fest": {
        "category": "family",
        "subcategory": "festival",
        "tags": ["fright-fest", "halloween", "haunted", "seasonal", "fall"],
    },
    "holiday in the park": {
        "category": "family",
        "subcategory": "festival",
        "tags": ["holiday-in-the-park", "christmas", "lights", "seasonal", "winter"],
    },
    "music in the parks": {
        "category": "music",
        "subcategory": "concert",
        "tags": ["music-in-the-parks", "school-groups", "band", "orchestra", "choir"],
    },
    "education days": {
        "category": "family",
        "subcategory": "educational",
        "tags": ["education-days", "school-groups", "educational", "students"],
    },
    "grad nite": {
        "category": "family",
        "subcategory": "graduation",
        "tags": ["grad-nite", "graduation", "high-school", "students"],
    },
    "memorial day": {
        "category": "family",
        "subcategory": "holiday",
        "tags": ["memorial-day", "holiday", "summer", "seasonal"],
    },
    "fourth of july": {
        "category": "family",
        "subcategory": "holiday",
        "tags": ["fourth-of-july", "fireworks", "holiday", "summer"],
    },
    "labor day": {
        "category": "family",
        "subcategory": "holiday",
        "tags": ["labor-day", "holiday", "summer", "seasonal"],
    },
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    text = f"{title} {description}".lower()

    # Base tags for all Six Flags events
    base_tags = ["six-flags", "theme-park", "family-friendly", "rides", "roller-coasters", "outdoor"]

    # Check against known event types
    for keyword, metadata in EVENT_KEYWORDS.items():
        if keyword in text:
            tags = base_tags + metadata["tags"]
            return metadata["category"], metadata.get("subcategory"), tags

    # Check for concert/music events
    if any(word in text for word in ["concert", "music", "band", "performance", "show"]):
        return "music", "concert", base_tags + ["concert", "live-music"]

    # Default to family events for theme park
    return "family", "festival", base_tags


def parse_dates(date_text: str) -> list[str]:
    """
    Parse Six Flags date formats which can be complex:
    - "May 1, 2026"
    - "April 11, 17, 18, 24, & 25, and May 1, 2, & 9, 2026"
    - "April 16, April 23, May 7th, and May 14th, 2026"

    Returns list of dates in YYYY-MM-DD format.
    """
    dates = []
    current_year = datetime.now().year

    # Extract year from text
    year_match = re.search(r'\b(202\d)\b', date_text)
    year = int(year_match.group(1)) if year_match else current_year

    # Strategy: Parse the text segment by segment
    # Split by "and" to handle multiple month sections
    segments = re.split(r'\s+and\s+', date_text, flags=re.IGNORECASE)

    for segment in segments:
        # Find all month-day patterns in this segment
        # Pattern: "Month Day" or "Month Dayst/nd/rd/th"
        month_day_pattern = r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?'
        matches = re.findall(month_day_pattern, segment, re.IGNORECASE)

        if matches:
            # We have explicit "Month Day" pairs
            for month_str, day_str in matches:
                try:
                    date_str = f"{month_str} {day_str} {year}"
                    dt = datetime.strptime(date_str, "%B %d %Y")
                    dates.append(dt.strftime("%Y-%m-%d"))
                except ValueError:
                    continue

        # Also look for standalone day numbers after we've found a month
        # e.g., "April 11, 17, 18" - the 17 and 18 belong to April
        month_match = re.search(r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\b', segment, re.IGNORECASE)
        if month_match:
            month_str = month_match.group(1)
            # Get the position of the month
            month_pos = month_match.end()
            # Look for standalone numbers after the month (not part of Month Day pattern)
            remaining_text = segment[month_pos:]

            # Find numbers that could be days, but aren't immediately preceded by a month name
            # Pattern: comma or & followed by optional space and a day number
            standalone_days = re.findall(r'[,&]\s*(\d{1,2})(?:st|nd|rd|th)?\b', remaining_text)

            for day_str in standalone_days:
                day = int(day_str)
                # Validate day is reasonable (1-31)
                if 1 <= day <= 31:
                    try:
                        date_str = f"{month_str} {day_str} {year}"
                        dt = datetime.strptime(date_str, "%B %d %Y")
                        dates.append(dt.strftime("%Y-%m-%d"))
                    except ValueError:
                        continue

    # Remove duplicates and sort
    dates = sorted(list(set(dates)))
    return dates


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Six Flags Over Georgia events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Get or create venues
        venue_id_sixflags = get_or_create_venue(VENUE_DATA_SIXFLAGS)
        venue_id_whitewater = get_or_create_venue(VENUE_DATA_WHITEWATER)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Six Flags events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to ensure all content loads
            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event articles
            articles = page.query_selector_all('article')
            logger.info(f"Found {len(articles)} potential event articles")

            seen_events = set()

            for article in articles:
                try:
                    # Get article text
                    text = article.inner_text()
                    if not text:
                        continue

                    lines = [l.strip() for l in text.split('\n') if l.strip()]
                    if len(lines) < 2:
                        continue

                    # Skip if it's not an event (e.g., ride attractions)
                    if not any(keyword in text.lower() for keyword in ['event', 'nite', 'days', 'fest', 'parks']):
                        continue

                    # Extract title (first non-empty line)
                    title = None
                    date_text = None
                    description = None
                    event_url = None

                    # Find link for more details
                    link = article.query_selector('a')
                    if link:
                        href = link.get_attribute('href')
                        if href:
                            if href.startswith('/'):
                                event_url = f"https://www.sixflags.com{href}"
                            elif href.startswith('http'):
                                event_url = href
                            else:
                                # Relative URL without leading slash
                                event_url = f"https://www.sixflags.com/overgeorgia/{href}"

                    # Parse lines to extract title and date
                    for i, line in enumerate(lines):
                        # Skip "Group Event" label
                        if line.lower() == "group event":
                            continue
                        # Skip "View Group Event" button text
                        if "view" in line.lower() and "event" in line.lower():
                            continue

                        # Title is typically the first substantive line
                        if not title and len(line) > 5 and line not in ['Group Event', 'View Group Event']:
                            title = line
                            continue

                        # Date typically contains month names or numbers
                        if title and not date_text:
                            # Check if line contains date-like content
                            if any(month in line for month in ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']):
                                date_text = line
                                # Rest is description
                                if i + 1 < len(lines):
                                    description = ' '.join(lines[i+1:])
                                break

                    if not title or not date_text:
                        continue

                    # Parse dates
                    dates = parse_dates(date_text)
                    if not dates:
                        logger.warning(f"Could not parse dates from: {date_text}")
                        continue

                    # If event URL exists, fetch more details
                    if event_url and event_url.startswith('http'):
                        try:
                            detail_page = context.new_page()
                            detail_page.goto(event_url, wait_until="networkidle", timeout=30000)
                            detail_page.wait_for_timeout(2000)

                            detail_text = detail_page.inner_text("body")

                            # Extract description from detail page
                            # Look for paragraph text that's not navigation
                            paragraphs = []
                            for p_elem in detail_page.query_selector_all('p'):
                                p_text = p_elem.inner_text().strip()
                                # Skip short paragraphs and navigation
                                if len(p_text) > 50 and not any(skip in p_text.lower() for skip in ['cookie', 'privacy policy', 'terms of use']):
                                    paragraphs.append(p_text)

                            if paragraphs:
                                description = ' '.join(paragraphs[:3])  # First 3 paragraphs

                            detail_page.close()
                        except Exception as e:
                            logger.warning(f"Could not fetch detail page for {title}: {e}")

                    # Determine venue (most events at Six Flags, but check for White Water mentions)
                    venue_id = venue_id_sixflags
                    if description and "white water" in description.lower():
                        venue_id = venue_id_whitewater
                    elif title and "white water" in title.lower():
                        venue_id = venue_id_whitewater

                    # Categorize event
                    category, subcategory, tags = categorize_event(title, description or "")

                    # Create event for each date
                    for start_date in dates:
                        # Check for duplicates
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        venue_name = VENUE_DATA_SIXFLAGS["name"] if venue_id == venue_id_sixflags else VENUE_DATA_WHITEWATER["name"]
                        content_hash = generate_content_hash(title, venue_name, start_date)

                        # Check if event already exists
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            continue

                        # Get image URL
                        image_url = None
                        if image_map:
                            # Try case-insensitive match
                            image_url = next(
                                (url for t, url in image_map.items() if t.lower() == title.lower()),
                                None
                            )

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description[:1000] if description else None,  # Limit length
                            "start_date": start_date,
                            "start_time": None,  # Six Flags doesn't provide specific times on events page
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": True,  # Most theme park events are all-day
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,  # Requires park admission
                            "price_max": None,
                            "price_note": "Requires park admission",
                            "is_free": False,
                            "source_url": event_url or EVENTS_URL,
                            "ticket_url": f"{BASE_URL}/tickets-passes",
                            "image_url": image_url,
                            "raw_text": f"{title} - {description[:200]}" if description else title,
                            "extraction_confidence": 0.90,
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
                    logger.error(f"Error processing article: {e}")
                    continue

            browser.close()

        logger.info(
            f"Six Flags crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Six Flags: {e}")
        raise

    return events_found, events_new, events_updated
