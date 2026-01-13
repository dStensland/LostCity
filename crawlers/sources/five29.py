"""
Crawler for 529 (529atlanta.com).
An indie music venue in East Atlanta Village.
"""

import re
import logging
from datetime import datetime
from bs4 import BeautifulSoup
from typing import Optional

from utils import fetch_page, slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash, is_duplicate

logger = logging.getLogger(__name__)

BASE_URL = "https://529atlanta.com"
CALENDAR_URL = f"{BASE_URL}/calendar/"

# Venue info (static - it's always 529)
VENUE_DATA = {
    "name": "529",
    "slug": "529",
    "address": "529 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "music_venue",
    "website": BASE_URL
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from format like 'Mar 18, 2026' to 'YYYY-MM-DD'.
    Handles formats: 'Mar 18, 2026', 'March 18, 2026', 'Mar 18 2026'
    """
    try:
        date_text = date_text.strip()

        # Try various formats
        formats = [
            "%b %d, %Y",    # Mar 18, 2026
            "%B %d, %Y",    # March 18, 2026
            "%b %d %Y",     # Mar 18 2026
            "%B %d %Y",     # March 18 2026
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_text, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        logger.warning(f"Failed to parse date '{date_text}'")
        return None
    except Exception as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")
        return None


def parse_time(time_text: str) -> Optional[str]:
    """
    Parse time from format like '8:00 pm' or '9:00pm' to 'HH:MM' (24-hour).
    """
    try:
        # Extract time portion
        match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)', time_text.lower())
        if not match:
            return None

        hour = int(match.group(1))
        minute = int(match.group(2))
        period = match.group(3)

        if period == 'pm' and hour != 12:
            hour += 12
        elif period == 'am' and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"
    except Exception as e:
        logger.warning(f"Failed to parse time '{time_text}': {e}")
        return None


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Parse price from format like '$15Adv/$20Dos' or '$10Adv/$13Dos' or 'Free'.
    Returns (price_min, price_max, is_free).
    """
    try:
        price_text = price_text.strip().lower()

        # Check for free
        if 'free' in price_text:
            return 0.0, 0.0, True

        # Look for Adv/Dos pattern: $15Adv/$20Dos
        adv_match = re.search(r'\$(\d+(?:\.\d{2})?)\s*adv', price_text)
        dos_match = re.search(r'\$(\d+(?:\.\d{2})?)\s*dos', price_text)

        price_min = float(adv_match.group(1)) if adv_match else None
        price_max = float(dos_match.group(1)) if dos_match else None

        # If only one price found
        if price_min is None and price_max is not None:
            price_min = price_max
        elif price_max is None and price_min is not None:
            price_max = price_min

        # Fallback: just look for any dollar amount
        if price_min is None:
            match = re.search(r'\$(\d+(?:\.\d{2})?)', price_text)
            if match:
                price_min = float(match.group(1))
                price_max = price_min

        is_free = price_min == 0 if price_min is not None else False
        return price_min, price_max, is_free

    except Exception as e:
        logger.warning(f"Failed to parse price '{price_text}': {e}")
        return None, None, False


def extract_events_from_calendar(html: str) -> list[dict]:
    """
    Extract event links and basic info from the calendar page.
    Returns list of event URLs to fetch individually.
    """
    soup = BeautifulSoup(html, "lxml")
    event_urls = set()

    # Find all links to event pages
    for link in soup.find_all('a', href=True):
        href = link['href']
        if '/events/' in href and re.search(r'/events/\d+/?', href):
            if href.startswith('/'):
                href = BASE_URL + href
            event_urls.add(href)

    return list(event_urls)


def extract_event_from_page(html: str, url: str) -> Optional[dict]:
    """
    Extract event details from an individual event page.

    529 uses a specific format in fl-module-content elements:
    "WednesdayMar 18, 202621+|8:00 pm|$13Adv/$15Dos529 Presents:More Cheese..."
    """
    soup = BeautifulSoup(html, "lxml")
    event = {}

    try:
        # Find the fl-module-content element with the event details
        # Look for the one containing age restriction and time
        event_text = None
        for el in soup.select('.fl-module-content'):
            text = el.get_text(strip=True)
            # Event text contains age restriction and time pattern
            if re.search(r'(18|21)\+\|', text) and re.search(r'\d{1,2}:\d{2}\s*(?:am|pm)', text, re.IGNORECASE):
                event_text = text
                break

        if not event_text:
            logger.debug(f"No event content found on {url}")
            return None

        # Parse the concatenated format: "WednesdayMar 18, 202621+|8:00 pm|$13Adv/$15Dos529 Presents:Title..."
        # Extract date - pattern: DayMonthDD, YYYY (no spaces between day and month)
        date_pattern = r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)([A-Za-z]{3,9}\s*\d{1,2},?\s*\d{4})'
        date_match = re.search(date_pattern, event_text)
        if date_match:
            date_str = date_match.group(1).strip()
            event['start_date'] = parse_date(date_str)

        if not event.get('start_date'):
            logger.debug(f"No date found in event text on {url}")
            return None

        # Extract age restriction
        age_match = re.search(r'(\d{2})\+', event_text)
        if age_match:
            event['age_restriction'] = f"{age_match.group(1)}+"

        # Extract time
        time_match = re.search(r'(\d{1,2}:\d{2}\s*(?:am|pm))', event_text, re.IGNORECASE)
        if time_match:
            event['start_time'] = parse_time(time_match.group(1))

        # Extract price - $13Adv/$15Dos format
        price_match = re.search(r'\$(\d+)(?:Adv)?(?:/\$(\d+)(?:Dos)?)?', event_text, re.IGNORECASE)
        if price_match:
            event['price_min'] = float(price_match.group(1)) if price_match.group(1) else None
            event['price_max'] = float(price_match.group(2)) if price_match.group(2) else event['price_min']
            event['is_free'] = event['price_min'] == 0 if event['price_min'] is not None else False

        # Check for "(Free)" indicator
        if '(free)' in event_text.lower():
            event['is_free'] = True
            event['price_min'] = 0
            event['price_max'] = 0

        # Extract title - get text after presenter info (like "529 Presents:")
        # Title appears after price, before "Tickets" link text
        title_pattern = r'(?:\$\d+(?:Adv)?(?:/\$\d+(?:Dos)?)?)([^|]+?)(?:Tickets|$)'
        title_match = re.search(title_pattern, event_text, re.IGNORECASE)
        if title_match:
            title_text = title_match.group(1).strip()
            # Clean up presenter prefix
            title_text = re.sub(r'^529\s*(?:&[^:]+)?Presents?:?\s*', '', title_text, flags=re.IGNORECASE)
            # Take the first part (main artist)
            if '|' in title_text:
                parts = title_text.split('|')
                event['title'] = parts[0].strip()
                event['description'] = f"With: {', '.join(p.strip() for p in parts[1:])}"
            else:
                event['title'] = title_text

        # Fallback to h3 heading if no title found
        if not event.get('title'):
            h3 = soup.select_one('h3')
            if h3:
                event['title'] = h3.get_text(strip=True)

        if not event.get('title'):
            logger.debug(f"No title found on {url}")
            return None

        # Image
        og_image = soup.select_one('meta[property="og:image"]')
        if og_image:
            event['image_url'] = og_image.get('content')

        # Ticket URL - look for bigtickets link
        ticket_link = soup.select_one('a[href*="bigtickets"]')
        if ticket_link:
            event['ticket_url'] = ticket_link.get('href')

        event['source_url'] = url
        event['category'] = 'music'

        return event

    except Exception as e:
        logger.error(f"Failed to parse event page {url}: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl 529 events.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Fetch calendar page to get event URLs
        logger.info(f"Fetching 529 calendar: {CALENDAR_URL}")
        html = fetch_page(CALENDAR_URL)

        event_urls = extract_events_from_calendar(html)
        logger.info(f"Found {len(event_urls)} event links on 529 calendar")

        if not event_urls:
            logger.warning("No event URLs found on 529 calendar")
            return 0, 0, 0

        # Get or create venue
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch each event page
        for url in event_urls:
            try:
                logger.debug(f"Fetching event page: {url}")
                event_html = fetch_page(url)
                event_data = extract_event_from_page(event_html, url)

                if not event_data:
                    continue

                events_found += 1

                # Generate content hash for deduplication
                content_hash = generate_content_hash(
                    event_data["title"],
                    "529",
                    event_data["start_date"]
                )

                # Check for existing event
                existing = find_event_by_hash(content_hash)
                if existing:
                    logger.debug(f"Skipping duplicate: {event_data['title']}")
                    events_updated += 1
                    continue

                # Check fuzzy duplicate
                canonical_id = is_duplicate(
                    type("Event", (), {
                        "title": event_data["title"],
                        "venue": type("Venue", (), {"name": "529"})(),
                        "start_date": event_data["start_date"]
                    })(),
                    venue_id
                )

                if canonical_id:
                    logger.debug(f"Skipping fuzzy duplicate: {event_data['title']}")
                    events_updated += 1
                    continue

                # Build tags
                tags = ["indie", "live-music"]
                if event_data.get("age_restriction"):
                    tags.append(event_data["age_restriction"])

                # Insert new event
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": event_data["title"],
                    "description": None,
                    "start_date": event_data["start_date"],
                    "start_time": event_data.get("start_time"),
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "music",
                    "subcategory": "indie",
                    "tags": tags,
                    "price_min": event_data.get("price_min"),
                    "price_max": event_data.get("price_max"),
                    "price_note": None,
                    "is_free": event_data.get("is_free", False),
                    "source_url": event_data["source_url"],
                    "ticket_url": event_data.get("ticket_url"),
                    "image_url": event_data.get("image_url"),
                    "raw_text": None,
                    "extraction_confidence": 0.9,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {event_data['title']} on {event_data['start_date']}")
                except Exception as e:
                    logger.error(f"Failed to insert event {event_data['title']}: {e}")

            except Exception as e:
                logger.error(f"Failed to fetch event page {url}: {e}")
                continue

    except Exception as e:
        logger.error(f"Failed to crawl 529: {e}")
        raise

    return events_found, events_new, events_updated
