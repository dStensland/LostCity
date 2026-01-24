"""
Crawler for Whole World Improv Theatre (wholeworldtheatre.com).
Improv comedy theater near Atlantic Station.

Site structure: Shows listed on homepage with /show/[slug]/ URLs.
Uses OvationTix for ticketing.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.wholeworldtheatre.com"

VENUE_DATA = {
    "name": "Whole World Improv Theatre",
    "slug": "whole-world-improv",
    "address": "1216 Spring St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7878,
    "lng": -84.3886,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|register|account)$",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|policy|copyright)$",
    r"^(classes|workshops|private events)$",
    r"^\d+$",
    r"^[a-z]{1,3}$",
]


def is_valid_title(title: str) -> bool:
    """Check if a string looks like a valid show title."""
    if not title or len(title) < 3 or len(title) > 200:
        return False
    title_lower = title.lower().strip()
    for pattern in SKIP_PATTERNS:
        if re.match(pattern, title_lower, re.IGNORECASE):
            return False
    return True


def parse_datetime(date_text: str, time_text: str = "") -> tuple[Optional[str], Optional[str]]:
    """Parse date and time from Whole World format."""
    start_date = None
    start_time = None

    if not date_text:
        return None, None

    # Parse date patterns like "Jan 23" or "January 23, 2026"
    date_patterns = [
        (r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})?", "%b"),
        (r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})?", "%B"),
    ]

    for pattern, month_fmt in date_patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            month, day, year = match.groups()
            year = year or str(datetime.now().year)
            try:
                dt = datetime.strptime(f"{month} {day} {year}", f"{month_fmt} %d %Y")
                # If date is in past, assume next year
                if dt.date() < datetime.now().date():
                    dt = datetime(dt.year + 1, dt.month, dt.day)
                start_date = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue

    # Parse time
    combined_text = f"{date_text} {time_text}"
    time_match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", combined_text, re.IGNORECASE)
    if time_match:
        hour, minute, period = time_match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        start_time = f"{hour:02d}:{minute}"

    return start_date, start_time


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Whole World Improv shows."""
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

            logger.info(f"Fetching Whole World Improv: {BASE_URL}")
            page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find show links - uses /show/[slug]/ pattern
            show_links = page.query_selector_all('a[href*="/show/"]')

            show_urls = set()
            for link in show_links:
                href = link.get_attribute("href")
                if href and "/show/" in href:
                    full_url = href if href.startswith("http") else BASE_URL + href
                    show_urls.add(full_url)

            logger.info(f"Found {len(show_urls)} show pages")

            # Process show pages
            for show_url in show_urls:
                try:
                    page.goto(show_url, wait_until="networkidle", timeout=20000)
                    page.wait_for_timeout(1000)

                    # Get title
                    title = None
                    for selector in ["h1", ".show-title", ".entry-title"]:
                        el = page.query_selector(selector)
                        if el:
                            title = el.inner_text().strip()
                            if is_valid_title(title):
                                break
                            title = None

                    if not title:
                        # Extract from URL
                        match = re.search(r"/show/([^/]+)/?", show_url)
                        if match:
                            title = match.group(1).replace("-", " ").title()

                    if not title or not is_valid_title(title):
                        continue

                    # Get show info from page
                    show_text = page.inner_text("body")

                    # Look for upcoming dates
                    date_matches = re.findall(
                        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}).*?(\d{1,2}:\d{2}\s*(?:AM|PM))",
                        show_text,
                        re.IGNORECASE
                    )

                    if not date_matches:
                        # Try full month names
                        date_matches = re.findall(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}).*?(\d{1,2}:\d{2}\s*(?:AM|PM))",
                            show_text,
                            re.IGNORECASE
                        )

                    # Get price if available
                    price_match = re.search(r"\$(\d+)", show_text)
                    price = int(price_match.group(1)) if price_match else None

                    # Get description
                    description = None
                    for selector in [".show-description", "article p", ".entry-content p"]:
                        el = page.query_selector(selector)
                        if el:
                            desc = el.inner_text().strip()
                            if desc and len(desc) > 20:
                                description = desc[:500]
                                break

                    # Process each date found
                    for date_match in date_matches[:5]:  # Limit to next 5 dates
                        month, day, time_str = date_match
                        date_text = f"{month} {day}"
                        start_date, start_time = parse_datetime(date_text, time_str)

                        if not start_date:
                            continue

                        # Skip past events
                        try:
                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue
                        except ValueError:
                            continue

                        events_found += 1

                        content_hash = generate_content_hash(title, "Whole World Improv", start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description or f"{title} at Whole World Improv Theatre",
                            "start_date": start_date,
                            "start_time": start_time or "20:00",
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "comedy",
                            "subcategory": "improv",
                            "tags": ["whole-world-improv", "comedy", "improv", "midtown"],
                            "price_min": price,
                            "price_max": price,
                            "price_note": f"${price}" if price else None,
                            "is_free": False,
                            "source_url": show_url,
                            "ticket_url": show_url,
                            "image_url": None,
                            "raw_text": f"{title} - {date_text} {time_str}",
                            "extraction_confidence": 0.85,
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
                    logger.warning(f"Failed to process {show_url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Whole World Improv crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Whole World Improv: {e}")
        raise

    return events_found, events_new, events_updated
