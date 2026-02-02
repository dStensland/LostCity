"""
Crawler for Brick Store Pub.
One of America's best beer bars with special events, beer celebrations, and Oktoberfest.

Located in Downtown Decatur. Site uses Cloudflare - must use Playwright.
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

BASE_URL = "https://www.brickstorepub.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Brick Store Pub",
    "slug": "brick-store-pub",
    "address": "125 E Court Sq",
    "neighborhood": "Downtown Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "venue_type": "bar",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
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
    """Parse date from various formats."""
    # Try format: "January 15, 2026" or "Jan 15, 2026"
    date_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = date_match.group(2)
        year = date_match.group(3)

        try:
            month_str = month[:3] if len(month) > 3 else month
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try format: "Monday, Jan 15" (without year)
    date_match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})",
        date_text,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = date_match.group(2)
        year = str(datetime.now().year)

        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month} {day} {int(year) + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Brick Store Pub events using Playwright."""
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

            logger.info(f"Fetching Brick Store Pub: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for date patterns and event titles
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip very short lines
                if len(line) < 5:
                    i += 1
                    continue

                # Try to parse date from current line
                start_date = parse_date(line)

                if start_date:
                    # Found a date, now look for title and time nearby
                    title = None
                    start_time = None
                    description = ""

                    # Look in surrounding lines for title and time
                    for offset in range(-2, 6):
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]

                            # Skip the date line itself
                            if idx == i:
                                continue

                            # Look for time
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result

                            # Look for title - should be a substantial line
                            if not title and len(check_line) > 10:
                                # Skip common non-title patterns
                                if re.match(r"^\d{1,2}[:/]", check_line):
                                    continue
                                if parse_date(check_line):
                                    continue
                                if re.match(r"(tickets|register|more info|view details|learn more)", check_line.lower()):
                                    continue
                                # This looks like a title
                                title = check_line

                            # Collect description from nearby lines
                            if offset > 1 and len(check_line) > 20:
                                description += " " + check_line

                    if not title:
                        i += 1
                        continue

                    # Skip events in the past
                    try:
                        event_dt = datetime.strptime(start_date, "%Y-%m-%d")
                        if event_dt.date() < datetime.now().date():
                            i += 1
                            continue
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "Brick Store Pub", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        i += 1
                        continue

                    # Determine category based on title
                    title_lower = title.lower()
                    description_lower = description.lower()

                    if any(w in title_lower for w in ["oktoberfest", "beer fest", "beer celebration", "tap takeover", "beer dinner"]):
                        category, subcategory = "food_drink", "beer_event"
                        tags = ["beer", "craft-beer", "downtown-decatur", "bar"]
                    elif any(w in title_lower for w in ["trivia", "quiz"]):
                        category, subcategory = "nightlife", "trivia"
                        tags = ["trivia", "bar", "downtown-decatur"]
                    elif any(w in title_lower for w in ["live music", "band", "acoustic", "jazz", "blues"]):
                        category, subcategory = "music", "live_music"
                        tags = ["music", "live-music", "bar", "downtown-decatur"]
                    elif any(w in title_lower for w in ["tasting", "pairing", "whiskey", "wine"]):
                        category, subcategory = "food_drink", "tasting"
                        tags = ["tasting", "craft-beer", "downtown-decatur", "bar"]
                    else:
                        category, subcategory = "nightlife", "bar_event"
                        tags = ["beer", "bar", "downtown-decatur"]

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": (description.strip() or "Event at Brick Store Pub, one of America's best beer bars")[:500],
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": None,
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
            f"Brick Store Pub crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Brick Store Pub: {e}")
        raise

    return events_found, events_new, events_updated
