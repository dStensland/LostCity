"""
Crawler for Dad's Garage Theatre (dadsgarage.com).
Improv and sketch comedy theater in Old Fourth Ward.

Site structure: Squarespace event list at /shows/ with event articles.
Each article has title, date tag, time, description, link, and image.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://dadsgarage.com"
SHOWS_URL = f"{BASE_URL}/shows/"

VENUE_DATA = {
    "name": "Dad's Garage Theatre",
    "slug": "dads-garage",
    "address": "569 Ezzard St SE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7558,
    "lng": -84.3685,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}


def parse_date_tag(date_text: str) -> Optional[str]:
    """
    Parse Dad's Garage date tag format.
    Date tag shows: "JAN\n31" or "FEB\n4"
    Returns date in YYYY-MM-DD format.
    """
    if not date_text:
        return None

    # Clean up the text - remove extra whitespace
    date_text = " ".join(date_text.split())

    # Pattern: "JAN 31" or "JANUARY 31"
    match = re.match(
        r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2})",
        date_text,
        re.IGNORECASE
    )

    if not match:
        return None

    month_abbr, day = match.groups()

    # Get current year, or next year if date is in the past
    current_year = datetime.now().year
    current_month = datetime.now().month

    # Map month abbreviation to month number
    month_map = {
        "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
    }

    month_num = month_map.get(month_abbr.upper()[:3])
    if not month_num:
        return None

    # Determine year - if month is before current month, it's next year
    year = current_year
    if month_num < current_month or (month_num == current_month and int(day) < datetime.now().day):
        year = current_year + 1

    try:
        dt = datetime(year, month_num, int(day))
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_time_range(time_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse time range from Dad's Garage format.
    Time: "8:00 PM  9:30 PM" or "3:00 PM  4:00 PM"
    Returns (start_time, end_time) in HH:MM format.
    """
    if not time_text:
        return None, None

    # Extract all times from text
    times = re.findall(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)

    if not times:
        return None, None

    def convert_to_24h(hour: str, minute: str, period: str) -> str:
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    start_time = convert_to_24h(*times[0])
    end_time = convert_to_24h(*times[1]) if len(times) > 1 else None

    return start_time, end_time


def determine_tags(title: str, description: str = "") -> list[str]:
    """Determine event tags based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["dads-garage", "comedy", "improv", "old-fourth-ward"]

    if "theatresports" in text or "tournament" in text:
        tags.extend(["competition", "theatresports"])
    if "adventure playhouse" in text or "kid" in text:
        tags.extend(["family-friendly", "kids"])
    if "blackground" in text:
        tags.append("black-voices")
    if "valentine" in text or "sexy" in text or "sex" in text:
        tags.extend(["date-night", "21+"])
    if "quick & dirty" in text or "quick and dirty" in text:
        tags.append("weekly-show")
    if "write club" in text:
        tags.append("literary")
    if "road trip" in text:
        tags.append("popular-show")
    if "after dark" in text:
        tags.extend(["late-night", "free"])

    return list(set(tags))


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Dad's Garage shows using Playwright.

    Site uses Squarespace event list with article elements.
    Each article contains:
    - .eventlist-title for show name
    - .eventlist-datetag for date (e.g., "JAN\n31")
    - .eventlist-meta-time for time range
    - .eventlist-description for show description
    - a[href*="/shows/"] for event link
    - img for event poster
    """
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Dad's Garage: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load more events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event articles (skip first which is the calendar header)
            articles = page.query_selector_all("article")
            logger.info(f"Found {len(articles)} article elements")

            # Skip first article which is typically the calendar/header
            for article in articles[1:]:
                try:
                    # Extract title
                    title_el = article.query_selector(".eventlist-title")
                    if not title_el:
                        continue

                    title = title_el.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Extract date
                    date_el = article.query_selector(".eventlist-datetag")
                    if not date_el:
                        continue

                    date_text = date_el.inner_text().strip()
                    start_date = parse_date_tag(date_text)

                    if not start_date:
                        logger.warning(f"Could not parse date for: {title} - {date_text}")
                        continue

                    # Skip past events
                    try:
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue
                    except ValueError:
                        pass

                    # Extract time
                    time_el = article.query_selector(".eventlist-meta-time")
                    time_text = time_el.inner_text().strip() if time_el else ""
                    start_time, end_time = parse_time_range(time_text)

                    # Extract description
                    desc_el = article.query_selector(".eventlist-description")
                    description = None
                    if desc_el:
                        desc_text = desc_el.inner_text().strip()
                        # Remove "Get Tickets" prefix if present
                        desc_text = re.sub(r"^Get Tickets\s+", "", desc_text)
                        if len(desc_text) > 20:
                            description = desc_text[:500]

                    # Extract event URL
                    link_el = article.query_selector('a[href*="/shows/"]')
                    event_url = None
                    if link_el:
                        href = link_el.get_attribute("href")
                        if href:
                            event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

                    # Extract image
                    img_el = article.query_selector("img")
                    image_url = None
                    if img_el:
                        image_url = img_el.get_attribute("data-src") or img_el.get_attribute("src")
                        if image_url and not image_url.startswith("http"):
                            image_url = f"{BASE_URL}{image_url}"

                    events_found += 1

                    # Generate content hash for deduplication
                    content_hash = generate_content_hash(title, "Dad's Garage Theatre", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Determine tags based on content
                    tags = determine_tags(title, description or "")

                    # Determine if it's free (After Dark shows are free)
                    is_free = "after dark" in title.lower()

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time or "20:00",  # Default to 8 PM
                        "end_date": start_date if end_time else None,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": "comedy",
                        "subcategory": "improv",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url or SHOWS_URL,
                        "ticket_url": event_url or SHOWS_URL,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_text} {time_text}"[:500],
                        "extraction_confidence": 0.92,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {start_time}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Error processing article: {e}")
                    continue

            browser.close()

        logger.info(
            f"Dad's Garage crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Dad's Garage: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Dad's Garage: {e}")
        raise

    return events_found, events_new, events_updated
