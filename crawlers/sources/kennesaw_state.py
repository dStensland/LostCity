"""
Crawler for Kennesaw State University ArtsKSU (ci.ovationtix.com/35355).
ArtsKSU performances at Bailey Performance Center and other KSU venues.
Uses Playwright to handle Cloudflare-protected Ovation Tix ticketing platform.
"""

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://ci.ovationtix.com/35355"

# Map venue names from Ovation Tix to our venue data
VENUE_MAP = {
    "bailey performance center": "bailey",
    "morgan concert hall": "bailey",  # Part of Bailey
    "marietta dance theater": "bailey",  # Part of Bailey
    "onyx theater": "bailey",  # Part of Bailey
    "zuckerman museum of art": "zuckerman",
    "fine arts gallery": "fine_arts",
    "fifth third bank stadium": "stadium",
    "default": "bailey",
}

VENUES = {
    "bailey": {
        "name": "Bailey Performance Center",
        "slug": "bailey-performance-center",
        "address": "488 Prillaman Way",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "performing_arts",
        "website": "https://arts.kennesaw.edu",
    },
    "zuckerman": {
        "name": "Zuckerman Museum of Art",
        "slug": "zuckerman-museum-of-art",
        "address": "492 Prillaman Way",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "museum",
        "website": "https://zuckerman.kennesaw.edu",
    },
    "fine_arts": {
        "name": "KSU Fine Arts Gallery",
        "slug": "ksu-fine-arts-gallery",
        "address": "471 Bartow Ave",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "gallery",
        "website": "https://arts.kennesaw.edu",
    },
    "stadium": {
        "name": "Fifth Third Bank Stadium",
        "slug": "fifth-third-bank-stadium",
        "address": "3200 George Busbee Parkway NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "stadium",
        "website": "https://ksuowls.com",
    },
}


def parse_date_from_text(text: str) -> Optional[str]:
    """Extract date from text like 'Friday 30 January 2026' or 'Mon, Jan 26'."""
    if not text:
        return None

    # Try to find day month year pattern (30 January 2026)
    match = re.search(r'(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})', text, re.IGNORECASE)
    if match:
        day, month_str, year = match.groups()
        month_map = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
        }
        month = month_map.get(month_str.lower())
        if month:
            return f"{year}-{month:02d}-{int(day):02d}"

    # Try abbreviated format (Mon, Jan 26)
    match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})', text, re.IGNORECASE)
    if match:
        month_str, day = match.groups()
        month_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }
        month = month_map.get(month_str.lower())
        if month:
            # Assume current year if not specified
            year = datetime.now().year
            # If month is in the past, assume next year
            current_month = datetime.now().month
            if month < current_month:
                year += 1
            return f"{year}-{month:02d}-{int(day):02d}"

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_str:
        return None

    # Try to match time patterns like "8:00 pm"
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


def categorize_event(title: str, venue_name: str) -> tuple[str, str]:
    """Determine category and subcategory."""
    title_lower = title.lower()
    venue_lower = venue_name.lower()

    # Museum/Gallery
    if "museum" in venue_lower or "gallery" in venue_lower or "exhibition" in title_lower:
        return "museums", "exhibition"

    # Dance
    if any(word in title_lower for word in ["dance", "ballet", "choreograph"]):
        return "theater", "dance"

    # Theater
    if any(word in title_lower for word in ["play", "theater", "theatre", "drama"]):
        return "theater", "performance"

    # Music - specific types
    if any(word in title_lower for word in ["jazz", "symphony", "orchestra", "ensemble", "choir", "concert", "recital", "piano", "violin"]):
        if "jazz" in title_lower:
            return "music", "jazz"
        elif any(word in title_lower for word in ["symphony", "orchestra", "ensemble"]):
            return "music", "classical"
        else:
            return "music", "concert"

    # Default to arts/performance
    return "arts", "performance"


def get_venue_key(venue_text: str) -> str:
    """Map venue text from Ovation Tix to our venue key."""
    venue_lower = venue_text.lower()
    for key, mapped_key in VENUE_MAP.items():
        if key in venue_lower:
            return mapped_key
    return VENUE_MAP["default"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Kennesaw State ArtsKSU events from Ovation Tix using Playwright."""
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

            logger.info(f"Fetching Kennesaw State ArtsKSU: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)  # Wait for JS and Cloudflare

            # Get main listing page HTML
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event items
            event_items = soup.find_all('li', class_='ot_prodListItem')
            logger.info(f"Found {len(event_items)} events on listing page")

            for idx, event_item in enumerate(event_items):
                try:
                    # Extract basic info from listing
                    title_elem = event_item.find('h1')
                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)

                    # Skip cancelled events
                    subtitle_elem = event_item.find('h6')
                    subtitle = subtitle_elem.get_text(strip=True) if subtitle_elem else ""
                    if "cancelled" in subtitle.lower():
                        logger.debug(f"Skipping cancelled event: {title}")
                        continue

                    # Skip museum/gallery admission unless it's an opening
                    if ("admission" in title.lower() or "general admission" in title.lower()) and "opening" not in title.lower():
                        logger.debug(f"Skipping general admission: {title}")
                        continue

                    # Get venue name from subtitle
                    venue_text = subtitle if subtitle else "Bailey Performance Center"
                    venue_key = get_venue_key(venue_text)
                    venue_data = VENUES[venue_key]
                    venue_id = get_or_create_venue(venue_data)

                    # Extract date from listing page
                    date_elem = event_item.find('span', class_='ot_ci_tag')
                    date_text = date_elem.get_text(strip=True) if date_elem else None

                    # Extract image
                    image_url = None
                    img_elem = event_item.find('div', class_='ot_prodImg')
                    if img_elem and img_elem.get('style'):
                        style = img_elem['style']
                        url_match = re.search(r'url\("([^"]+)"\)', style)
                        if url_match:
                            image_url = url_match.group(1)

                    # Click on event to get details
                    buttons = page.locator('.ot_prodInfoButton').all()
                    if idx < len(buttons):
                        buttons[idx].click()
                        page.wait_for_timeout(2000)

                        # Get event detail page
                        event_url = page.url
                        event_html = page.content()
                        event_soup = BeautifulSoup(event_html, "html.parser")

                        # Find performance dates/times
                        performance_items = event_soup.find_all('li', class_='events')

                        if performance_items:
                            # Process each performance date
                            for perf_item in performance_items:
                                # Get date from performance item
                                date_title = perf_item.find('h5', class_='ot_eventDateTitle')
                                if date_title:
                                    perf_date_text = date_title.get_text(strip=True)
                                    start_date = parse_date_from_text(perf_date_text)
                                else:
                                    start_date = parse_date_from_text(date_text) if date_text else None

                                if not start_date:
                                    continue

                                # Get time from time slot buttons
                                time_buttons = perf_item.find_all('button', class_='ot_timeSlotBtn')
                                if time_buttons:
                                    for time_btn in time_buttons:
                                        time_text = time_btn.get_text(strip=True)
                                        start_time = parse_time(time_text)

                                        events_found += 1

                                        # Check for duplicates
                                        content_hash = generate_content_hash(title, venue_data["name"], start_date)
                                        existing = find_event_by_hash(content_hash)
                                        if existing:
                                            events_updated += 1
                                            continue

                                        # Categorize
                                        category, subcategory = categorize_event(title, venue_data["name"])

                                        # Build tags
                                        tags = ["college", "kennesaw-state", "arts-ksu"]
                                        if category == "music":
                                            tags.append("classical")

                                        event_record = {
                                            "source_id": source_id,
                                            "venue_id": venue_id,
                                            "title": title,
                                            "description": None,
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
                                            "price_note": "Check Ovation Tix for pricing",
                                            "is_free": None,
                                            "source_url": event_url,
                                            "ticket_url": event_url,
                                            "image_url": image_url,
                                            "raw_text": None,
                                            "extraction_confidence": 0.85,
                                            "is_recurring": False,
                                            "recurrence_rule": None,
                                            "content_hash": content_hash,
                                        }

                                        try:
                                            enrich_event_record(event_record, "Kennesaw State University Arts")
                                            insert_event(event_record)
                                            events_new += 1
                                            logger.debug(f"Added: {title} on {start_date} at {start_time}")
                                        except Exception as e:
                                            logger.error(f"Failed to insert {title}: {e}")
                                else:
                                    # No specific times, just date
                                    start_date = parse_date_from_text(perf_date_text if date_title else date_text)
                                    if not start_date:
                                        continue

                                    events_found += 1

                                    content_hash = generate_content_hash(title, venue_data["name"], start_date)
                                    existing = find_event_by_hash(content_hash)
                                    if existing:
                                        events_updated += 1
                                        continue

                                    category, subcategory = categorize_event(title, venue_data["name"])
                                    tags = ["college", "kennesaw-state", "arts-ksu"]
                                    if category == "music":
                                        tags.append("classical")

                                    event_record = {
                                        "source_id": source_id,
                                        "venue_id": venue_id,
                                        "title": title,
                                        "description": None,
                                        "start_date": start_date,
                                        "start_time": None,
                                        "end_date": None,
                                        "end_time": None,
                                        "is_all_day": True,
                                        "category": category,
                                        "subcategory": subcategory,
                                        "tags": tags,
                                        "price_min": None,
                                        "price_max": None,
                                        "price_note": "Check Ovation Tix for pricing",
                                        "is_free": None,
                                        "source_url": event_url,
                                        "ticket_url": event_url,
                                        "image_url": image_url,
                                        "raw_text": None,
                                        "extraction_confidence": 0.85,
                                        "is_recurring": False,
                                        "recurrence_rule": None,
                                        "content_hash": content_hash,
                                    }

                                    try:
                                        enrich_event_record(event_record, "Kennesaw State University Arts")
                                        insert_event(event_record)
                                        events_new += 1
                                        logger.debug(f"Added: {title} on {start_date}")
                                    except Exception as e:
                                        logger.error(f"Failed to insert {title}: {e}")
                        else:
                            # No detailed performances found, use listing date
                            start_date = parse_date_from_text(date_text) if date_text else None
                            if not start_date:
                                logger.debug(f"No date found for {title}")
                                page.go_back(wait_until="domcontentloaded", timeout=10000)
                                page.wait_for_timeout(1000)
                                continue

                            events_found += 1

                            content_hash = generate_content_hash(title, venue_data["name"], start_date)
                            existing = find_event_by_hash(content_hash)
                            if existing:
                                events_updated += 1
                                page.go_back(wait_until="domcontentloaded", timeout=10000)
                                page.wait_for_timeout(1000)
                                continue

                            category, subcategory = categorize_event(title, venue_data["name"])
                            tags = ["college", "kennesaw-state", "arts-ksu"]
                            if category == "music":
                                tags.append("classical")

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": None,
                                "start_date": start_date,
                                "start_time": None,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": True,
                                "category": category,
                                "subcategory": subcategory,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": "Check Ovation Tix for pricing",
                                "is_free": None,
                                "source_url": event_url,
                                "ticket_url": event_url,
                                "image_url": image_url,
                                "raw_text": None,
                                "extraction_confidence": 0.85,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                enrich_event_record(event_record, "Kennesaw State University Arts")
                                insert_event(event_record)
                                events_new += 1
                                logger.debug(f"Added: {title} on {start_date}")
                            except Exception as e:
                                logger.error(f"Failed to insert {title}: {e}")

                        # Go back to listing
                        page.go_back(wait_until="domcontentloaded", timeout=10000)
                        page.wait_for_timeout(1000)

                except Exception as e:
                    logger.debug(f"Error processing event: {e}")
                    # Try to go back to listing if we got stuck
                    try:
                        if page.url != BASE_URL:
                            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                            page.wait_for_timeout(2000)
                    except:
                        pass
                    continue

            browser.close()

        logger.info(
            f"Kennesaw State ArtsKSU: Found {events_found} events, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Kennesaw State ArtsKSU: {e}")
        raise

    return events_found, events_new, events_updated
