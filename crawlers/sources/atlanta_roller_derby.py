"""
Crawler for Atlanta Roller Derby (atlantarollerderby.com).
Women's flat track roller derby league with home teams and all-star travel teams.

Site uses Squarespace with static HTML that can be parsed with Playwright.
Each event has double-header bouts (two matches per date).
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

BASE_URL = "https://atlantarollerderby.com"
SCHEDULE_URL = f"{BASE_URL}/schedule"

VENUE_DATA = {
    "name": "Atlanta Roller Derby",
    "slug": "atlanta-roller-derby",
    "address": "225 E Dougherty St",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7704,
    "lng": -84.2963,
    "venue_type": "arena",
    "spot_type": "arena",
    "website": BASE_URL,
    "description": "Atlanta's premier women's flat track roller derby league competing at Agnes Scott College.",
    "vibes": ["roller-derby", "women-sports", "live-sports", "family-friendly"],
}

# Month names to numbers
MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse date from format 'March 21' or 'February 28'.
    Returns YYYY-MM-DD string.
    """
    date_str = date_str.strip()
    match = re.match(r"(\w+)\s+(\d{1,2})", date_str, re.IGNORECASE)
    if not match:
        return None

    month_name, day = match.groups()
    month_name = month_name.lower()

    if month_name not in MONTH_MAP:
        return None

    month = MONTH_MAP[month_name]
    day = int(day)

    # Determine year (assume current year or next year if date has passed)
    now = datetime.now()
    year = now.year

    try:
        event_date = datetime(year, month, day)
        # If date is in the past, use next year
        if event_date.date() < now.date():
            year += 1
            event_date = datetime(year, month, day)

        return event_date.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_time(time_str: str) -> Optional[str]:
    """
    Parse time from format like '5:00pm' or '7:30pm'.
    Returns HH:MM in 24-hour format.
    """
    match = re.match(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str.strip(), re.IGNORECASE)
    if not match:
        return None

    hour, minute, period = match.groups()
    hour = int(hour)

    if period.lower() == "pm" and hour != 12:
        hour += 12
    elif period.lower() == "am" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute}"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Roller Derby schedule using Playwright."""
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

            # Get or create venue
            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Atlanta Roller Derby schedule: {SCHEDULE_URL}")
            page.goto(SCHEDULE_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Get page HTML
            html_content = page.content()
            browser.close()

        # Parse with BeautifulSoup
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")

        # Find all h3 date headings
        date_headings = soup.find_all("h3")

        for h3 in date_headings:
            date_text = h3.get_text(strip=True)

            # Parse the date
            start_date = parse_date(date_text)
            if not start_date:
                continue

            events_found += 1

            # Get the parent section containing event details
            section = h3.find_parent("section")
            if not section:
                logger.warning(f"No section found for date: {date_text}")
                continue

            # Extract all text content from the section
            paragraphs = section.find_all("p")

            # Variables to collect
            times = None
            bout_1 = None
            bout_2 = None
            ticket_url = None

            for p in paragraphs:
                p_text = p.get_text(strip=True)

                # Look for times (e.g., "5:00pm & 7:30pm")
                if re.search(r"\d{1,2}:\d{2}\s*(?:am|pm)", p_text, re.IGNORECASE):
                    if "&" in p_text or "and" in p_text.lower():
                        # Parse both times
                        time_matches = re.findall(r"(\d{1,2}:\d{2}\s*(?:am|pm))", p_text, re.IGNORECASE)
                        if len(time_matches) >= 2:
                            times = (parse_time(time_matches[0]), parse_time(time_matches[1]))
                    else:
                        # Single time
                        time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:am|pm))", p_text, re.IGNORECASE)
                        if time_match:
                            times = (parse_time(time_match.group(1)), None)

                # Look for bout matchups (e.g., "5:00pm: Team A vs Team B")
                # Format: "5:00pm: ..." or "7:30pm: ..."
                # Split by common time patterns to separate the two bouts
                if re.search(r"\d{1,2}:\d{2}\s*(?:am|pm)\s*:", p_text, re.IGNORECASE):
                    # Split on time patterns like "7:30pm:"
                    parts = re.split(r"(\d{1,2}:\d{2}\s*(?:am|pm)\s*:)", p_text, flags=re.IGNORECASE)

                    # Reconstruct lines with their time prefixes
                    i = 0
                    while i < len(parts):
                        if re.match(r"\d{1,2}:\d{2}\s*(?:am|pm)\s*:", parts[i], re.IGNORECASE):
                            if i + 1 < len(parts):
                                # Combine time prefix with following text
                                matchup = parts[i + 1].strip()
                                if matchup:
                                    if not bout_1:
                                        bout_1 = matchup
                                    elif not bout_2:
                                        bout_2 = matchup
                                i += 2
                            else:
                                i += 1
                        else:
                            i += 1

            # Look for ticket URL
            links = section.find_all("a")
            for link in links:
                href = link.get("href", "")
                text = link.get_text(strip=True).lower()
                if "ticket" in text or "buy" in text:
                    if href.startswith("http"):
                        ticket_url = href
                    elif href.startswith("/"):
                        ticket_url = f"{BASE_URL}{href}"

            # Build event title
            if bout_1 and bout_2:
                title = f"Roller Derby Double-Header: {bout_1} / {bout_2}"
            elif bout_1:
                title = f"Roller Derby: {bout_1}"
            else:
                title = f"Roller Derby Bout"

            # Build description
            description_parts = []
            if bout_1:
                description_parts.append(f"Bout 1: {bout_1}")
            if bout_2:
                description_parts.append(f"Bout 2: {bout_2}")
            description_parts.append("Atlanta Roller Derby hosts exciting flat track roller derby action at Agnes Scott College's Woodruff Athletic Complex.")
            description_parts.append("Doors at 5:00pm. Double-header featuring two exciting matchups.")
            description = " ".join(description_parts)

            # Determine start time (use first bout time)
            start_time = times[0] if times else "17:00"  # Default to 5pm

            # Generate content hash
            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

            # Check for existing event
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                logger.debug(f"Event already exists: {title} on {start_date}")
                continue

            # Create event record
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
                "category": "sports",
                "subcategory": "roller_derby",
                "tags": ["roller-derby", "atlanta-roller-derby", "decatur", "women-sports", "live-sports"],
                "price_min": None,
                "price_max": None,
                "price_note": "Check website for ticket pricing",
                "is_free": False,
                "source_url": ticket_url or SCHEDULE_URL,
                "ticket_url": ticket_url,
                "image_url": None,
                "raw_text": f"{date_text} | {bout_1 or ''} | {bout_2 or ''}",
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert event: {title}: {e}")

        logger.info(
            f"Atlanta Roller Derby crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Roller Derby: {e}")
        raise

    return events_found, events_new, events_updated
