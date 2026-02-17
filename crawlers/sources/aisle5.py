"""
Crawler for Aisle 5 (aisle5atl.com).

Music venue in Little Five Points using SeeTickets plugin for event listings.
Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://aisle5atl.com"
EVENTS_URL = "https://aisle5atl.com/calendar/"

VENUE_DATA = {
    "name": "Aisle 5",
    "slug": "aisle-5",
    "address": "1123 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7645,
    "lng": -84.3489,
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00PM' or '7:00 PM' format to 24-hour time."""
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


def parse_date(date_text: str) -> Optional[str]:
    """Parse 'Mon Jan 26' or 'MonJan26' format to YYYY-MM-DD."""
    # Try to parse date like "Mon Jan 26" or "MonJan26" (with or without spaces)
    match = re.match(
        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*([A-Za-z]+)\s*(\d{1,2})",
        date_text
    )
    if match:
        month_str, day = match.groups()
        current_year = datetime.now().year
        try:
            dt = datetime.strptime(f"{month_str} {day} {current_year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return None
    return None


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Parse price from '$25.00' format. Returns (min, max, note)."""
    match = re.search(r"\$(\d+(?:\.\d{2})?)", price_text)
    if match:
        price = float(match.group(1))
        return price, price, None
    return None, None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Aisle 5 events using Playwright and parse SeeTickets event listings."""
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

            logger.info(f"Fetching Aisle 5: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)

            # Wait for SeeTickets events to load
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Get page HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event containers
            event_containers = soup.find_all("div", class_="seetickets-list-event-container")

            logger.info(f"Found {len(event_containers)} event containers")

            for container in event_containers:
                try:
                    # Extract title
                    title_elem = container.find("p", class_="event-title")
                    if not title_elem:
                        continue
                    title_link = title_elem.find("a")
                    title = title_link.get_text(strip=True) if title_link else title_elem.get_text(strip=True)

                    # Extract date
                    date_elem = container.find("p", class_="event-date")
                    if not date_elem:
                        continue
                    date_text = date_elem.get_text(strip=True)
                    start_date = parse_date(date_text)
                    if not start_date:
                        logger.warning(f"Could not parse date: {date_text}")
                        continue

                    # Extract times (door time and show time)
                    door_time = None
                    show_time = None
                    door_elem = container.find("span", class_="see-doortime")
                    show_elem = container.find("span", class_="see-showtime")

                    if show_elem:
                        show_time_text = show_elem.get_text(strip=True)
                        show_time = parse_time(show_time_text)

                    if door_elem:
                        door_time_text = door_elem.get_text(strip=True)
                        door_time = parse_time(door_time_text)

                    # Use show time as primary start time, door time as backup
                    start_time = show_time or door_time

                    # Extract supporting talent/subtitle
                    supporting_elem = container.find("p", class_="supporting-talent")
                    supporting = supporting_elem.get_text(strip=True) if supporting_elem else None

                    # Extract genre
                    genre_elem = container.find("p", class_="genre")
                    genre = genre_elem.get_text(strip=True) if genre_elem else None

                    # Extract price
                    price_min = None
                    price_max = None
                    price_note = None
                    price_elem = container.find("span", class_="price")
                    if price_elem:
                        price_text = price_elem.get_text(strip=True)
                        price_min, price_max, price_note = parse_price(price_text)

                    # Extract ticket URL
                    ticket_url = EVENTS_URL
                    ticket_link = container.find("a", class_="seetickets-buy-btn")
                    if ticket_link and ticket_link.get("href"):
                        ticket_url = ticket_link["href"]

                    # Extract image URL
                    image_url = None
                    img_elem = container.find("img", class_="seetickets-list-view-event-image")
                    if img_elem and img_elem.get("src"):
                        image_url = img_elem["src"]

                    # Build description
                    description_parts = []
                    if supporting:
                        description_parts.append(f"Featuring {supporting}")
                    if genre:
                        description_parts.append(f"Genre: {genre}")
                    if door_time and show_time:
                        description_parts.append(f"Doors at {door_time_text}, show at {show_time_text}")
                    description = ". ".join(description_parts) if description_parts else "Live music at Aisle 5"

                    events_found += 1

                    content_hash = generate_content_hash(title, "Aisle 5", start_date)


                    # Build tags
                    tags = ["aisle-5", "little-five-points", "live-music"]
                    if genre:
                        tags.append(genre.lower().replace(" ", "-"))

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
                        "subcategory": "concert",
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_text} - {description}",
                        "extraction_confidence": 0.95,
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
            f"Aisle 5 crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Aisle 5: {e}")
        raise

    return events_found, events_new, events_updated
