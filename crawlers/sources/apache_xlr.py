"""
Crawler for Apache XLR (apachexlr.com).

A cafe and music venue in Kirkwood, Atlanta.
Site uses Wix - requires JavaScript rendering via Playwright.
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

BASE_URL = "https://www.apachexlr.com"
EVENTS_URL = BASE_URL  # Check if there's a dedicated /events page

VENUE_DATA = {
    "name": "Apache XLR",
    "slug": "apache-xlr",
    "address": "64 Wyman St SE",
    "neighborhood": "Kirkwood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30317",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    current_year = datetime.now().year
    date_text = date_text.strip()

    # Try "Jan 18, 2026" or "January 18, 2026" format
    match = re.match(r"(\w+)\s+(\d{1,2}),?\s*(\d{4})?", date_text)
    if match:
        month, day, year = match.groups()
        year = year or str(current_year)
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                if dt.date() < datetime.now().date():
                    dt = dt.replace(year=current_year + 1)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Try "Sat Jan 18" or "Saturday, January 18" format
    match = re.match(r"(?:\w+day,?\s+)?(\w+)\s+(\d{1,2})", date_text, re.IGNORECASE)
    if match:
        month, day = match.groups()
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                if dt.date() < datetime.now().date():
                    dt = dt.replace(year=current_year + 1)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Try "1/18/2026" or "01/18/26" format
    match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", date_text)
    if match:
        month, day, year = match.groups()
        if len(year) == 2:
            year = "20" + year
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7PM' format."""
    try:
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(AM|PM)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            minute = minute or "00"
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Apache XLR events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Apache XLR: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content (Wix often lazy-loads)
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Get page content
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Date patterns to look for
            date_patterns = [
                # "FRI, JAN 16" or "Friday, January 16"
                re.compile(
                    r"(?:MON|TUE|WED|THU|FRI|SAT|SUN|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,.]?\s+"
                    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+"
                    r"(\d{1,2})(?:,?\s+(\d{4}))?",
                    re.IGNORECASE,
                ),
                # "January 16, 2026"
                re.compile(
                    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+"
                    r"(\d{1,2}),?\s*(\d{4})?",
                    re.IGNORECASE,
                ),
                # "1/16/2026"
                re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})"),
            ]

            i = 0
            while i < len(lines):
                line = lines[i]

                # Check if line matches a date pattern
                date_match = None
                start_date = None
                for pattern in date_patterns:
                    match = pattern.search(line)
                    if match:
                        date_match = match
                        start_date = parse_date(match.group(0))
                        break

                if start_date:
                    # Found a date - look for title in surrounding lines
                    title = None
                    start_time = None

                    # Check for time in the same line or nearby
                    time_match = parse_time(line)
                    if time_match:
                        start_time = time_match

                    # Look for title - check lines before and after the date
                    for offset in [-1, -2, 1, 2, -3, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]

                            # Skip navigation, dates, times, and common UI text
                            skip_patterns = [
                                r"^(MON|TUE|WED|THU|FRI|SAT|SUN|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$",
                                r"^\d{1,2}:\d{2}\s*(AM|PM)$",
                                r"^(TICKETS|BUY|RSVP|MORE INFO|LEARN MORE|SOLD OUT|FREE)$",
                                r"^(Home|About|Contact|Events|Menu|Gallery|Book|Shop)$",
                                r"^\$\d+",
                                r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)",
                            ]
                            if any(re.match(p, check_line, re.IGNORECASE) for p in skip_patterns):
                                continue

                            # Skip very short lines
                            if len(check_line) < 4:
                                continue

                            # Skip lines that are just dates
                            if parse_date(check_line):
                                continue

                            # Check for time if we don't have one
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue

                            # This is likely the title
                            if not title and len(check_line) > 3:
                                title = check_line
                                break

                    if title:
                        events_found += 1

                        content_hash = generate_content_hash(title, "Apache XLR", start_date)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            i += 1
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
                            "is_all_day": start_time is None,
                            "category": "music",
                            "subcategory": "concert",
                            "tags": ["music", "live-music"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": EVENTS_URL,
                            "ticket_url": None,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.80,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Apache XLR crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Apache XLR: {e}")
        raise

    return events_found, events_new, events_updated
