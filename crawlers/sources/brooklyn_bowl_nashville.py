"""
Crawler for Brooklyn Bowl Nashville (brooklynbowl.com/nashville/shows/all).

Music venue and bowling alley in Germantown, part of Brooklyn Bowl chain.
Uses JavaScript rendering for event listings.
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

BASE_URL = "https://www.brooklynbowl.com"
CALENDAR_URL = f"{BASE_URL}/nashville/shows/all"

VENUE_DATA = {
    "name": "Brooklyn Bowl Nashville",
    "slug": "brooklyn-bowl-nashville",
    "address": "925 3rd Ave N",
    "neighborhood": "Germantown",
    "city": "Nashville",
    "state": "TN",
    "zip": "37201",
    "lat": 36.1730,
    "lng": -86.7784,
    "venue_type": "music_venue",
    "website": f"{BASE_URL}/nashville",
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7:00PM' format to 24-hour time."""
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


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Parse price from text. Returns (min, max, note)."""
    # Try to find price pattern like $25.00 or $25
    match = re.search(r"\$(\d+(?:\.\d{2})?)", price_text)
    if match:
        price = float(match.group(1))
        return price, price, None
    return None, None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Brooklyn Bowl Nashville events using Playwright."""
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

            logger.info(f"Fetching Brooklyn Bowl Nashville: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event containers - Brooklyn Bowl uses eventItem entry class
            event_containers = soup.find_all("div", class_=re.compile(r"eventItem entry"))

            logger.info(f"Found {len(event_containers)} event containers")

            for container in event_containers:
                try:
                    # Extract title from heading
                    title_elem = container.find(["h2", "h3", "h4"])
                    if not title_elem:
                        continue

                    title_link = title_elem.find("a")
                    title = title_link.get_text(strip=True) if title_link else title_elem.get_text(strip=True)

                    # Extract event URL
                    event_url = CALENDAR_URL
                    link_elem = container.find("a", href=re.compile(r"/nashville/events/detail/"))
                    if not link_elem:
                        link_elem = container.find("a")
                    if link_elem and link_elem.get("href"):
                        event_url = link_elem["href"]
                        if not event_url.startswith("http"):
                            event_url = BASE_URL + event_url

                    # Extract date from .m-date structure
                    # Look for aria-label with full date
                    date_div = container.find("div", {"aria-label": re.compile(r"[A-Z][a-z]+ +\d+ \d{4}")})
                    if not date_div:
                        continue

                    start_date = None
                    start_time = None

                    # Parse aria-label date (format: "February  2 2026")
                    aria_label = date_div.get("aria-label", "")
                    date_match = re.search(r"([A-Za-z]+)\s+(\d+)\s+(\d{4})", aria_label)
                    if date_match:
                        month, day, year = date_match.groups()
                        try:
                            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                            start_date = dt.strftime("%Y-%m-%d")
                        except:
                            logger.warning(f"Could not parse date: {month} {day} {year}")
                            continue
                    else:
                        continue

                    # Extract time from showings
                    time_elem = container.find("div", class_="showings")
                    if time_elem:
                        time_text = time_elem.get_text(strip=True)
                        time_match = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", time_text, re.IGNORECASE)
                        if time_match:
                            start_time = parse_time(time_match.group(1))

                    # Extract description
                    description = None
                    desc_elem = container.find(["p", "div"], class_=re.compile(r"description|excerpt|content|support"))
                    if desc_elem:
                        description = desc_elem.get_text(strip=True)[:500]

                    # Extract price
                    price_min = None
                    price_max = None
                    price_note = None
                    price_elem = container.find(["span", "div"], class_=re.compile(r"price|cost|ticket"))
                    if price_elem:
                        price_text = price_elem.get_text(strip=True)
                        price_min, price_max, price_note = parse_price(price_text)

                    # Extract image URL
                    image_url = None
                    img_elem = container.find("img")
                    if img_elem:
                        if img_elem.get("src"):
                            image_url = img_elem["src"]
                        elif img_elem.get("data-src"):
                            image_url = img_elem["data-src"]

                        if image_url and not image_url.startswith("http"):
                            image_url = BASE_URL + image_url

                    events_found += 1

                    content_hash = generate_content_hash(title, "Brooklyn Bowl Nashville", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
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
                        "is_all_day": start_time is None,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["brooklyn-bowl", "nashville", "live-music", "germantown"],
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": False,
                        "source_url": CALENDAR_URL,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.85,
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
            f"Brooklyn Bowl Nashville crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Brooklyn Bowl Nashville: {e}")
        raise

    return events_found, events_new, events_updated
