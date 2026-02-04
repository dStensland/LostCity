"""
Crawler for SCAD FASH Museum of Fashion + Film (scadfash.org).

Fashion and film museum in Midtown Atlanta operated by SCAD.
Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://scadfash.org"
EVENTS_URL = f"{BASE_URL}/events"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions"

VENUE_DATA = {
    "name": "SCAD FASH Museum of Fashion + Film",
    "slug": "scad-fash",
    "address": "1600 Peachtree St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "museum",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from various formats.
    Examples: 'February 15', 'Feb 15, 2026', 'March 3'
    """
    date_text = date_text.strip()
    now = datetime.now()
    year = now.year

    # Try "February 15, 2026" format
    try:
        dt = datetime.strptime(date_text, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "February 15" format
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=year)
        if dt < now:
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "Feb 15" format
    try:
        dt = datetime.strptime(date_text, "%b %d")
        dt = dt.replace(year=year)
        if dt < now:
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from formats like '6:00 PM', '2 PM', '10:30 AM'."""
    if not time_text:
        return None

    time_text = time_text.strip()

    # Pattern: "6:00 PM" or "6 PM"
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        time_text,
        re.IGNORECASE
    )
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags based on event content."""
    text = f"{title} {description}".lower()
    tags = ["fashion", "film", "museum", "design", "midtown"]

    if any(w in text for w in ["exhibition", "exhibit", "opening", "gallery"]):
        return "art", "exhibition", tags + ["exhibition"]
    if any(w in text for w in ["film", "screening", "movie"]):
        return "film", "screening", tags + ["screening"]
    if any(w in text for w in ["fashion show", "runway"]):
        return "art", "fashion", tags + ["fashion-show"]
    if any(w in text for w in ["workshop", "class", "studio"]):
        return "art", "workshop", tags + ["workshop", "class"]
    if any(w in text for w in ["tour", "gallery tour"]):
        return "art", "tour", tags + ["tour"]
    if any(w in text for w in ["lecture", "talk", "discussion", "panel"]):
        return "education", "lecture", tags + ["lecture", "education"]
    if any(w in text for w in ["reception", "opening reception", "gala"]):
        return "art", "reception", tags + ["reception", "social"]

    return "art", "exhibition", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl SCAD FASH Museum events using Playwright."""
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

            # Try both events and exhibitions pages
            for url in [EVENTS_URL, EXHIBITIONS_URL]:
                logger.info(f"Fetching SCAD FASH: {url}")
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(5000)

                # Extract images from page
                image_map = extract_images_from_page(page)

                # Scroll to load all content
                for _ in range(5):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1500)

                # Get page text
                body_text = page.inner_text("body")
                lines = [line.strip() for line in body_text.split("\n") if line.strip()]

                # Skip navigation items
                skip_items = [
                    "skip to main",
                    "menu",
                    "home",
                    "about",
                    "exhibitions",
                    "events",
                    "visit",
                    "shop",
                    "support",
                    "calendar",
                    "upcoming",
                    "current",
                    "past",
                    "view all",
                    "learn more",
                ]

                i = 0
                seen_events = set()

                while i < len(lines):
                    line = lines[i]
                    line_lower = line.lower()

                    # Skip nav/UI items
                    if line_lower in skip_items or len(line) < 3:
                        i += 1
                        continue

                    # Look for date patterns
                    date_match = re.match(
                        r"^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s+\d{4})?$",
                        line,
                        re.IGNORECASE,
                    )

                    if date_match:
                        start_date = parse_date(line)
                        if not start_date:
                            i += 1
                            continue

                        # Look for title and time in surrounding lines
                        title = None
                        start_time = None
                        description = None

                        # Check previous lines for title
                        for offset in [-2, -1]:
                            idx = i + offset
                            if idx >= 0:
                                potential_title = lines[idx].strip()
                                if len(potential_title) > 5 and potential_title.lower() not in skip_items:
                                    if not re.match(r"^(January|February|March)", potential_title, re.IGNORECASE):
                                        title = potential_title
                                        break

                        # Check next lines for time and description
                        for offset in [1, 2, 3, 4]:
                            idx = i + offset
                            if idx < len(lines):
                                check_line = lines[idx].strip()

                                # Check for time
                                if not start_time:
                                    time_result = parse_time(check_line)
                                    if time_result:
                                        start_time = time_result
                                        continue

                                # Check for description
                                if not description and len(check_line) > 30:
                                    if not re.match(r"^(more info|learn more|register|buy tickets|rsvp)", check_line.lower()):
                                        description = check_line[:500]

                        if not title:
                            i += 1
                            continue

                        # Check for duplicates
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            i += 1
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "SCAD FASH Museum", start_date
                        )

                        # Check for existing
                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            i += 1
                            continue

                        # Determine category
                        category, subcategory, tags = determine_category(title, description or "")

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
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Museum admission may apply",
                            "is_free": False,
                            "source_url": url,
                            "ticket_url": url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.83,
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
            f"SCAD FASH Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl SCAD FASH Museum: {e}")
        raise

    return events_found, events_new, events_updated
