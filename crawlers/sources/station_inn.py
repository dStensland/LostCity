"""
Crawler for Station Inn (stationinn.com).
Nashville's premier bluegrass venue since 1974.

Site may use JavaScript rendering - using Playwright for safety.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://stationinn.com"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Station Inn",
    "slug": "station-inn",
    "address": "402 12th Ave S",
    "city": "Nashville",
    "state": "TN",
    "zip": "37203",
    "neighborhood": "The Gulch",
    "venue_type": "music_venue",
    "website": BASE_URL,
    "lat": 36.1505,
    "lng": -86.7854,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    formats = [
        "%B %d, %Y",      # "January 15, 2026"
        "%b %d, %Y",      # "Jan 15, 2026"
        "%m/%d/%Y",       # "01/15/2026"
        "%Y-%m-%d",       # "2026-01-15"
        "%A, %B %d",      # "Monday, January 15" - will add current year
        "%m/%d",          # "01/15" - will add current year
        "%B %d",          # "February 1" - will add current year
    ]

    date_text = date_text.strip()

    for fmt in formats:
        try:
            if "%Y" not in fmt:
                # Add current year
                date_text_with_year = f"{date_text}/{datetime.now().year}" if "/" in date_text else f"{date_text}, {datetime.now().year}"
                try_fmt = fmt + "/%Y" if "/" in fmt else fmt + ", %Y"
                dt = datetime.strptime(date_text_with_year, try_fmt)
                # If date is in the past, assume next year
                if dt.date() < datetime.now().date():
                    date_text_with_year = f"{date_text}/{datetime.now().year + 1}" if "/" in date_text else f"{date_text}, {datetime.now().year + 1}"
                    dt = datetime.strptime(date_text_with_year, try_fmt)
            else:
                dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '19:00' format to 24-hour time."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try just hour with am/pm
    match = re.search(r"(\d{1,2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Station Inn events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Station Inn: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Get page HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event articles (The Events Calendar plugin)
            event_containers = soup.find_all("article", class_=lambda x: x and "tribe-events" in x)
            logger.info(f"Found {len(event_containers)} potential event containers")

            for container in event_containers:
                try:
                    # Extract title from tribe-events-calendar-list__event-title
                    title_elem = container.find(class_="tribe-events-calendar-list__event-title")
                    if not title_elem:
                        continue

                    # Get the link text
                    link = title_elem.find("a")
                    if link:
                        title = link.get_text(strip=True)
                    else:
                        title = title_elem.get_text(strip=True)

                    if not title or len(title) < 3:
                        continue

                    # Extract date and time from tribe-event-date-start
                    date_elem = container.find("span", class_="tribe-event-date-start")
                    if not date_elem:
                        # Try to get from time element with datetime attribute
                        time_elem = container.find("time")
                        if time_elem and time_elem.get("datetime"):
                            datetime_str = time_elem.get("datetime")
                            # Format: 2026-02-01
                            start_date = datetime_str
                            # Get time from text
                            date_text = time_elem.get_text(strip=True)
                        else:
                            continue
                    else:
                        date_text = date_elem.get_text(strip=True)

                    # Parse date and time from text like "February 1 @ 3:00 pm"
                    if "@" in date_text:
                        date_part, time_part = date_text.split("@", 1)
                        date_part = date_part.strip()
                        time_part = time_part.strip()
                    else:
                        date_part = date_text
                        time_part = None

                    start_date = parse_date(date_part)
                    if not start_date:
                        logger.debug(f"Could not parse date for: {title} ({date_part})")
                        continue

                    # Extract time
                    start_time = None
                    if time_part:
                        start_time = parse_time(time_part)

                    # Extract description from tribe-events-calendar-list__event-description
                    desc_elem = container.find(class_="tribe-events-calendar-list__event-description")
                    description = desc_elem.get_text(strip=True) if desc_elem else "Live bluegrass music at Nashville's legendary Station Inn"

                    # Extract event URL from title link
                    ticket_url = EVENTS_URL
                    if link and link.get("href"):
                        ticket_url = link["href"]
                        if not ticket_url.startswith("http"):
                            ticket_url = BASE_URL + ticket_url

                    # Extract image URL
                    image_url = None
                    img_elem = container.find("img", class_="tribe-events-calendar-list__event-featured-image")
                    if img_elem:
                        image_url = img_elem.get("src") or img_elem.get("data-src")
                        # Handle lazy loading
                        if not image_url or "data:image" in image_url:
                            image_url = img_elem.get("data-src") or img_elem.get("data-lazy-src")

                    events_found += 1

                    content_hash = generate_content_hash(title, "Station Inn", start_date)


                    # Build tags
                    tags = ["station-inn", "the-gulch", "bluegrass", "live-music", "legendary-venue"]

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



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
                        "category": "music",
                        "subcategory": "bluegrass",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Cash cover at door",
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date} - {description}",
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")

                except Exception as e:
                    logger.error(f"Failed to parse event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Station Inn crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Station Inn: {e}")
        raise

    return events_found, events_new, events_updated
