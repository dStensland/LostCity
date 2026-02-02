"""
Crawler for 3rd & Lindsley (3rdandlindsley.com/calendar).

Nashville music venue and bar/grill in SoBro district.
Uses WordPress with Event Discovery plugin and JavaScript rendering.
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

BASE_URL = "https://www.3rdandlindsley.com"
CALENDAR_URL = f"{BASE_URL}/calendar/"

VENUE_DATA = {
    "name": "3rd & Lindsley",
    "slug": "third-and-lindsley",
    "address": "818 3rd Ave S",
    "neighborhood": "SoBro",
    "city": "Nashville",
    "state": "TN",
    "zip": "37210",
    "lat": 36.1499,
    "lng": -86.7742,
    "venue_type": "music_venue",
    "website": BASE_URL,
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
    """Crawl 3rd & Lindsley events using Playwright."""
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

            logger.info(f"Fetching 3rd & Lindsley: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event containers - Uses tw-cal-event (calendar plugin)
            event_containers = soup.find_all("div", class_="tw-cal-event")

            logger.info(f"Found {len(event_containers)} event containers")

            for container in event_containers:
                try:
                    # Extract title from .tw-name div
                    title_elem = container.find("div", class_="tw-name")
                    if not title_elem:
                        continue

                    title_link = title_elem.find("a")
                    title = title_link.get_text(strip=True) if title_link else title_elem.get_text(strip=True)

                    # Extract event URL
                    event_url = CALENDAR_URL
                    if title_link and title_link.get("href"):
                        event_url = title_link["href"]
                        if not event_url.startswith("http"):
                            event_url = BASE_URL + event_url

                    # Extract date from .tw-event-date span (format: "February 02, 2026")
                    date_elem = container.find("span", class_="tw-event-date")
                    if not date_elem:
                        continue

                    start_date = None
                    start_time = None

                    # Date is in format "February 02, 2026"
                    date_text = date_elem.get_text(strip=True)
                    try:
                        dt = datetime.strptime(date_text, "%B %d, %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except:
                        logger.warning(f"Could not parse date: {date_text}")
                        continue

                    # Extract time from .tw-calendar-event-time or .tw-calendar-event-doors
                    time_elem = container.find(["div", "span"], class_=re.compile(r"tw-calendar-event-time|tw-calendar-event-doors"))
                    if time_elem:
                        time_text = time_elem.get_text(strip=True)
                        time_match = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", time_text, re.IGNORECASE)
                        if time_match:
                            start_time = parse_time(time_match.group(1))

                    # Extract description
                    description = None
                    desc_elem = container.find(["div", "p"], class_=re.compile(r"description|excerpt|content"))
                    if desc_elem:
                        description = desc_elem.get_text(strip=True)[:500]

                    # Extract supporting acts
                    support_elem = container.find(["div", "span"], class_=re.compile(r"support|opener|with"))
                    if support_elem and not description:
                        description = f"With {support_elem.get_text(strip=True)}"

                    # Extract price
                    price_min = None
                    price_max = None
                    price_note = None
                    price_elem = container.find(["span", "div"], class_=re.compile(r"price|cost"))
                    if price_elem:
                        price_text = price_elem.get_text(strip=True)
                        price_min, price_max, price_note = parse_price(price_text)

                    # Extract image URL
                    image_url = None
                    img_elem = container.find("img")
                    if img_elem and img_elem.get("src"):
                        image_url = img_elem["src"]
                        if not image_url.startswith("http"):
                            image_url = BASE_URL + image_url

                    events_found += 1

                    content_hash = generate_content_hash(title, "3rd & Lindsley", start_date)

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
                        "tags": ["3rd-and-lindsley", "nashville", "live-music", "sobro"],
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": False,
                        "source_url": CALENDAR_URL,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date}",
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
            f"3rd & Lindsley crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl 3rd & Lindsley: {e}")
        raise

    return events_found, events_new, events_updated
