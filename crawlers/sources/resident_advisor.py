"""
Crawler for Resident Advisor (ra.co/events/us/atlanta).
Electronic music and DJ events in Atlanta.
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

BASE_URL = "https://ra.co"
EVENTS_URL = f"{BASE_URL}/events/us/atlanta"


def parse_date(date_text: str) -> Optional[str]:
    """Parse RA date format (e.g., 'Sat, 18 Jan' or '18 Jan 2026')."""
    current_year = datetime.now().year

    # Try "Sat, 18 Jan" format
    match = re.search(r"(\d{1,2})\s+(\w{3})", date_text)
    if match:
        day, month = match.groups()
        for year in [current_year, current_year + 1]:
            try:
                dt = datetime.strptime(f"{day} {month} {year}", "%d %b %Y")
                # Use current year if date is in the future, else next year
                if dt >= datetime.now() or year == current_year + 1:
                    return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Try "January 18, 2026" format
    match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})?", date_text)
    if match:
        month, day, year = match.groups()
        year = year or str(current_year)
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from RA format."""
    try:
        # "23:00" 24-hour format
        match = re.search(r"(\d{1,2}):(\d{2})", time_text)
        if match:
            hour, minute = match.groups()
            return f"{int(hour):02d}:{minute}"
        return None
    except Exception:
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Resident Advisor Atlanta events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Resident Advisor: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)  # Extra time for JS rendering

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load more events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2000)

            # RA typically has event cards/links
            # Look for event link elements
            event_links = page.query_selector_all('a[href*="/events/"]')

            seen_urls = set()

            for link in event_links:
                try:
                    href = link.get_attribute("href")
                    if not href or href in seen_urls:
                        continue
                    if "/events/us/" in href or href == "/events":
                        continue  # Skip region links

                    # Get full URL
                    event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

                    # Skip if already seen
                    if event_url in seen_urls:
                        continue
                    seen_urls.add(event_url)

                    # Get text content of the link/card
                    card_text = link.inner_text()
                    if not card_text or len(card_text) < 5:
                        continue

                    lines = [l.strip() for l in card_text.split("\n") if l.strip()]
                    if not lines:
                        continue

                    # Parse event info from card
                    title = None
                    venue_name = None
                    date_text = None
                    time_text = None

                    for line in lines:
                        # Date pattern - "Sat, 18 Jan" or day names
                        if re.match(
                            r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)", line, re.IGNORECASE
                        ):
                            date_text = line
                            continue

                        # Time pattern - "23:00" or "23:00 - 06:00"
                        if re.search(r"\d{1,2}:\d{2}", line):
                            time_text = line
                            continue

                        # Title - usually the longest/first substantial line
                        if not title and len(line) > 3 and len(line) < 200:
                            # Skip common non-titles
                            if line.lower() in [
                                "tickets",
                                "going",
                                "interested",
                                "free",
                                "sold out",
                            ]:
                                continue
                            title = line
                            continue

                        # Venue - after title
                        if (
                            title
                            and not venue_name
                            and len(line) > 2
                            and len(line) < 100
                        ):
                            if line.lower() not in [
                                "tickets",
                                "going",
                                "interested",
                                "free",
                                "sold out",
                            ]:
                                venue_name = line

                    if not title or not date_text:
                        continue

                    start_date = parse_date(date_text)
                    if not start_date:
                        continue

                    start_time = parse_time(time_text or "")

                    # Create/get venue
                    if venue_name:
                        venue_data = {
                            "name": venue_name,
                            "slug": re.sub(
                                r"[^a-z0-9]+", "-", venue_name.lower()
                            ).strip("-"),
                            "city": "Atlanta",
                            "state": "GA",
                            "spot_type": "club",
                        }
                    else:
                        venue_data = {
                            "name": "Atlanta",
                            "slug": "atlanta-tbd",
                            "city": "Atlanta",
                            "state": "GA",
                        }

                    venue_id = get_or_create_venue(venue_data)
                    events_found += 1

                    content_hash = generate_content_hash(
                        title, venue_name or "Atlanta", start_date
                    )

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

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
                        "category": "music",
                        "subcategory": "dj",
                        "tags": ["electronic", "dance", "dj", "nightlife"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": None,
                        "extraction_confidence": 0.75,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {venue_name}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing event link: {e}")
                    continue

            browser.close()

        logger.info(
            f"Resident Advisor crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Resident Advisor: {e}")
        raise

    return events_found, events_new, events_updated
