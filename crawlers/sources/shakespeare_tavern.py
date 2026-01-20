"""
Crawler for Shakespeare Tavern Playhouse (shakespearetavern.com).
Atlanta's home for Shakespeare and classic theater performances.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.shakespearetavern.com"
EVENTS_URL = f"{BASE_URL}/shows"

VENUE_DATA = {
    "name": "Shakespeare Tavern Playhouse",
    "slug": "shakespeare-tavern",
    "address": "499 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date to YYYY-MM-DD format."""
    date_text = date_text.strip()

    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%A, %B %d, %Y",
        "%A, %B %d",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_text, fmt)
            if dt.year == 1900:
                dt = dt.replace(year=datetime.now().year)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})?",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        year = year or str(datetime.now().year)
        try:
            dt = datetime.strptime(f"{month} {day}, {year}", "%B %d, %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    try:
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_text.lower())
        if not match:
            return None

        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        period = match.group(3)

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"
    except Exception:
        return None


def extract_shows(page: Page, source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Extract shows from the page."""
    events_found = 0
    events_new = 0
    events_updated = 0

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    seen_shows = set()

    skip_words = [
        "MENU",
        "HOME",
        "SHOWS",
        "ABOUT",
        "CONTACT",
        "DONATE",
        "TICKETS",
        "BUY TICKETS",
        "GET TICKETS",
        "SIGN UP",
        "LOG IN",
        "SUBSCRIBE",
        "NEWSLETTER",
        "Facebook",
        "Instagram",
        "Twitter",
        "©",
        "Copyright",
        "Peachtree St",
        "Atlanta, GA",
        "30308",
        "Privacy Policy",
        "Terms",
    ]

    current_show = None

    # Look for show listings
    for i, line in enumerate(lines):
        if len(line) < 5:
            continue

        if any(w.lower() in line.lower() for w in skip_words):
            continue

        # Look for show titles - usually in caps or title case
        if len(line) > 5 and len(line) < 80 and line[0].isupper():
            # Check if it looks like a date
            if parse_date(line):
                if current_show:
                    current_show["start_date"] = parse_date(line)
                continue

            # Check if it looks like a time
            if re.match(r"^\d{1,2}:\d{2}", line) or re.match(r"^\d{1,2}\s*(am|pm)", line, re.IGNORECASE):
                if current_show:
                    current_show["start_time"] = parse_time(line)
                continue

            # This might be a show title
            # Skip if it's too generic
            if line.lower() in ["now playing", "coming soon", "current season", "upcoming shows"]:
                continue

            current_show = {
                "title": line,
                "start_date": None,
                "start_time": None,
            }

        # Look for date ranges like "January 10 - February 15, 2026"
        range_match = re.search(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–]\s*(January|February|March|April|May|June|July|August|September|October|November|December)?\s*(\d{1,2}),?\s*(\d{4})?",
            line,
            re.IGNORECASE
        )
        if range_match and current_show:
            start_month, start_day, end_month, end_day, year = range_match.groups()
            year = year or str(datetime.now().year)
            current_show["start_date"] = parse_date(f"{start_month} {start_day}, {year}")
            end_month = end_month or start_month
            current_show["end_date"] = parse_date(f"{end_month} {end_day}, {year}")

        # If we have a complete show, save it
        if current_show and current_show.get("start_date"):
            show_key = f"{current_show['title']}|{current_show['start_date']}"
            if show_key not in seen_shows:
                seen_shows.add(show_key)
                events_found += 1

                content_hash = generate_content_hash(
                    current_show["title"], "Shakespeare Tavern Playhouse", current_show["start_date"]
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                else:
                    # Determine subcategory
                    title_lower = current_show["title"].lower()
                    if "shakespeare" in title_lower or any(play in title_lower for play in ["hamlet", "macbeth", "othello", "romeo", "juliet", "lear", "tempest", "midsummer"]):
                        subcategory = "shakespeare"
                    elif "musical" in title_lower:
                        subcategory = "musical"
                    else:
                        subcategory = "play"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": current_show["title"],
                        "description": None,
                        "start_date": current_show["start_date"],
                        "start_time": current_show.get("start_time"),
                        "end_date": current_show.get("end_date"),
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": subcategory,
                        "tags": ["theater", "shakespeare", "classic-theater", "midtown"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": EVENTS_URL,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": True if current_show.get("end_date") else False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {current_show['title']} on {current_show['start_date']}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {current_show['title']}: {e}")

            current_show = None

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Shakespeare Tavern Playhouse shows."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            # Fetch the shows page
            logger.info(f"Fetching Shakespeare Tavern: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            found, new, updated = extract_shows(page, source_id, venue_id)
            total_found += found
            total_new += new
            total_updated += updated

            # Also try the main page
            logger.info(f"Fetching Shakespeare Tavern main: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            found, new, updated = extract_shows(page, source_id, venue_id)
            total_found += found
            total_new += new
            total_updated += updated

            browser.close()

        logger.info(
            f"Shakespeare Tavern crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Shakespeare Tavern: {e}")
        raise

    return total_found, total_new, total_updated
