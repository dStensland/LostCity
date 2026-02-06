"""
Crawler for Bluebird Cafe (bluebirdcafe.com/shows/).
Famous intimate Nashville venue known for songwriter rounds and acoustic performances.

Site uses JavaScript rendering - must use Playwright.
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
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://bluebirdcafe.com"
EVENTS_URL = f"{BASE_URL}/shows/"

VENUE_DATA = {
    "name": "Bluebird Cafe",
    "slug": "bluebird-cafe",
    "address": "4104 Hillsboro Pike",
    "city": "Nashville",
    "state": "TN",
    "zip": "37215",
    "neighborhood": "Green Hills",
    "venue_type": "music_venue",
    "website": BASE_URL,
    "lat": 36.1028,
    "lng": -86.8092,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    formats = [
        "%B %d, %Y",      # "January 15, 2026"
        "%b %d, %Y",      # "Jan 15, 2026"
        "%m/%d/%Y",       # "01/15/2026"
        "%Y-%m-%d",       # "2026-01-15"
        "%A, %B %d",      # "Monday, January 15" - will add current year
        "%B %d",          # "February 2" - will add current year
    ]

    date_text = date_text.strip()

    for fmt in formats:
        try:
            if "%Y" not in fmt:
                # Add current year
                date_text_with_year = f"{date_text}, {datetime.now().year}"
                try_fmt = fmt + ", %Y"
                dt = datetime.strptime(date_text_with_year, try_fmt)
                # If date is in the past, assume next year
                if dt.date() < datetime.now().date():
                    date_text_with_year = f"{date_text}, {datetime.now().year + 1}"
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
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Bluebird Cafe events using Playwright."""
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

            logger.info(f"Fetching Bluebird Cafe: {EVENTS_URL}")
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

            # Find all event sections (using TicketWeb widget)
            event_containers = soup.find_all("div", class_="tw-section")
            logger.info(f"Found {len(event_containers)} potential event containers")

            for container in event_containers:
                try:
                    # Extract date first from tw-event-date
                    date_elem = container.find(class_="tw-event-date")
                    if not date_elem:
                        continue

                    date_text = date_elem.get_text(strip=True)
                    start_date = parse_date(date_text)

                    if not start_date:
                        logger.debug(f"Could not parse date: {date_text}")
                        continue

                    # Extract title from tw-name
                    # The structure is: <a><span class="tw-event-date">date</span>Title</a>
                    title_elem = container.find(class_="tw-name")
                    if not title_elem:
                        continue

                    link = title_elem.find("a")
                    if link:
                        # Get all text, then remove the date part
                        full_text = link.get_text(strip=True)
                        # Remove the date prefix
                        title = full_text.replace(date_text, "").strip()
                    else:
                        title = title_elem.get_text(strip=True).replace(date_text, "").strip()

                    if not title or len(title) < 3:
                        continue

                    # Extract time from tw-event-time
                    time_elem = container.find(class_="tw-event-time")
                    start_time = None
                    if time_elem:
                        time_text = time_elem.get_text(strip=True)
                        # Format is usually "Show: 6:00 pm" or "Doors: 5:00 pm"
                        start_time = parse_time(time_text)

                    # Extract description (usually not available in ticket widget)
                    description = None

                    # Check if it's a songwriter round or solo show
                    if "round" in title.lower():
                        description = "Songwriter round featuring multiple artists in the round"
                    elif "open mic" in title.lower():
                        description = "Open mic night at Nashville's legendary Bluebird Cafe"
                    else:
                        description = "Intimate acoustic performance at Nashville's legendary Bluebird Cafe"

                    # Extract ticket URL (from tw-name link)
                    ticket_url = EVENTS_URL
                    link_elem = container.find("a", href=True)
                    if link_elem and link_elem.get("href"):
                        ticket_url = link_elem["href"]
                        # TicketWeb URLs are absolute
                        if not ticket_url.startswith("http"):
                            ticket_url = BASE_URL + ticket_url

                    # Extract image URL
                    image_url = None
                    img_elem = container.find("img", class_="event-img")
                    if img_elem:
                        image_url = img_elem.get("src") or img_elem.get("data-src")

                    events_found += 1

                    content_hash = generate_content_hash(title, "Bluebird Cafe", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Build tags
                    tags = ["bluebird-cafe", "green-hills", "songwriter", "acoustic", "intimate-venue"]

                    # Add specific tags based on title
                    if "round" in title.lower():
                        tags.append("songwriter-round")
                    if "early show" in title.lower():
                        tags.append("early-show")
                    if "late show" in title.lower():
                        tags.append("late-show")

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
                        "subcategory": "acoustic",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Reservations recommended",
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date} - {description}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")

                except Exception as e:
                    logger.error(f"Failed to parse event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Bluebird Cafe crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Bluebird Cafe: {e}")
        raise

    return events_found, events_new, events_updated
