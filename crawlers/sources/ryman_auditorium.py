"""
Crawler for Ryman Auditorium (ryman.com/events).
Nashville's iconic music venue - "The Mother Church of Country Music"

Venue capacity: 2,362
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

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ryman.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Ryman Auditorium",
    "slug": "ryman-auditorium",
    "address": "116 5th Ave N",
    "city": "Nashville",
    "state": "TN",
    "zip": "37219",
    "neighborhood": "Downtown",
    "venue_type": "music_venue",
    "website": BASE_URL,
    "lat": 36.1612,
    "lng": -86.7769,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    # Try common formats
    formats = [
        "%B %d, %Y",      # "January 15, 2026"
        "%b %d, %Y",      # "Jan 15, 2026"
        "%m/%d/%Y",       # "01/15/2026"
        "%Y-%m-%d",       # "2026-01-15"
    ]

    date_text = date_text.strip()

    for fmt in formats:
        try:
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
    """Crawl Ryman Auditorium events using Playwright."""
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

            logger.info(f"Fetching Ryman Auditorium: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event items - Ryman uses "eventItem" class
            event_containers = soup.find_all("div", class_="eventItem")

            logger.info(f"Found {len(event_containers)} event containers")

            for container in event_containers:
                try:
                    # Extract title from h3.title > a
                    title_elem = container.find("h3", class_="title")
                    if not title_elem:
                        continue

                    title_link = title_elem.find("a")
                    if not title_link:
                        continue

                    title = title_link.get_text(strip=True)
                    if not title or len(title) < 3:
                        continue

                    # Check for tagline (supporting act) and append if present
                    tagline_elem = container.find("h4", class_="tagline")
                    if tagline_elem:
                        tagline = tagline_elem.get_text(strip=True)
                        title = f"{title} {tagline}"

                    # Extract date components
                    date_container = container.find("div", class_="date")
                    if not date_container:
                        continue

                    # Try to parse date from structured elements
                    month_elem = date_container.find("span", class_="m-date__month")
                    day_elem = date_container.find("span", class_="m-date__day")
                    year_elem = date_container.find("span", class_="m-date__year")
                    hour_elem = date_container.find("span", class_="m-date__hour")

                    if not month_elem or not day_elem or not year_elem:
                        logger.debug(f"Missing date components for {title}")
                        continue

                    # Build date string
                    month = month_elem.get_text(strip=True)
                    day = day_elem.get_text(strip=True)
                    year = year_elem.get_text(strip=True).replace(",", "").strip()

                    date_text = f"{month} {day}, {year}"
                    start_date = parse_date(date_text)

                    if not start_date:
                        logger.debug(f"Could not parse date: {date_text}")
                        continue

                    # Extract time if present
                    start_time = None
                    if hour_elem:
                        time_text = hour_elem.get_text(strip=True)
                        start_time = parse_time(time_text)

                    # Extract event URL and use it as ticket URL
                    event_url = None
                    if title_link and title_link.get("href"):
                        event_url = title_link["href"]
                        if event_url.startswith("/"):
                            event_url = BASE_URL + event_url

                    ticket_url = event_url if event_url else EVENTS_URL

                    # Extract image URL
                    image_url = None
                    thumb_elem = container.find("div", class_="thumb")
                    if thumb_elem:
                        img_elem = thumb_elem.find("img")
                        if img_elem:
                            image_url = img_elem.get("src") or img_elem.get("data-src")
                            if image_url and image_url.startswith("/"):
                                image_url = BASE_URL + image_url

                    # Build description
                    description = f"Live performance at the historic Ryman Auditorium"

                    events_found += 1

                    content_hash = generate_content_hash(title, "Ryman Auditorium", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Build tags
                    tags = ["ryman-auditorium", "downtown-nashville", "historic-venue", "live-music"]

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
                        "subcategory": "concert",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Tickets required",
                        "is_free": False,
                        "source_url": EVENTS_URL,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_text} - {description}",
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
            f"Ryman Auditorium crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ryman Auditorium: {e}")
        raise

    return events_found, events_new, events_updated
