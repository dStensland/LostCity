"""
Crawler for Boot Barn Hall (The Hall) in Gainesville, GA.
Country music venue and event space featuring concerts and special events.

Site uses JavaScript rendering (Webflow) - must use Playwright.
URL: https://www.thehallga.com/calendar
Format: JavaScript-rendered event cards with date, title, and details
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

BASE_URL = "https://www.thehallga.com"
EVENTS_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Boot Barn Hall at The Hall",
    "slug": "boot-barn-hall",
    "address": "311 Jesse Jewell Pkwy SE",
    "neighborhood": None,
    "city": "Gainesville",
    "state": "GA",
    "zip": "30501",
    "lat": 34.2979,
    "lng": -83.8241,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
}

# Month abbreviations mapping
MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4,
    "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from various formats like:
    - Jan 18, 2026
    - January 18
    - Sat Jan 18
    """
    current_year = datetime.now().year
    date_text = date_text.strip()

    # Try "Month Day, Year" format
    match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})?", date_text, re.IGNORECASE)
    if match:
        month_str, day, year = match.groups()
        month_str = month_str.lower()

        if month_str in MONTHS:
            month = MONTHS[month_str]
            year = year or str(current_year)

            try:
                dt = datetime(int(year), month, int(day))
                # If date is in the past, assume next year
                if dt < datetime.now():
                    dt = datetime(int(year) + 1, month, int(day))
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Try "Day Month Day" format (e.g., "Sat Jan 18")
    match = re.match(r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\w+)\s+(\d+)", date_text, re.IGNORECASE)
    if match:
        month_str, day = match.groups()
        month_str = month_str.lower()

        if month_str in MONTHS:
            month = MONTHS[month_str]
            year = current_year

            try:
                dt = datetime(year, month, int(day))
                # If date is in the past, assume next year
                if dt < datetime.now():
                    dt = datetime(year + 1, month, int(day))
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7PM' format."""
    if not time_text:
        return None

    time_text = time_text.strip()

    # Try "7:00 PM" or "7:00PM" format
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try "7PM" or "7 PM" format
    match = re.search(r"(\d{1,2})\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"

    return None


def determine_category(title: str, description: str = None) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    title_lower = title.lower()
    desc_lower = (description or "").lower()
    combined = f"{title_lower} {desc_lower}"

    base_tags = ["boot-barn-hall", "gainesville", "live-music"]

    if any(w in combined for w in ["country", "bluegrass", "americana"]):
        return "music", "country", base_tags + ["country"]
    if any(w in combined for w in ["rock", "metal"]):
        return "music", "rock", base_tags + ["rock"]
    if any(w in combined for w in ["comedy", "comedian", "stand-up"]):
        return "comedy", None, base_tags + ["comedy"]
    if any(w in combined for w in ["tribute", "cover band"]):
        return "music", "tribute", base_tags + ["tribute"]

    # Default for Boot Barn Hall - assume country/music
    return "music", "concert", base_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Boot Barn Hall events using Playwright."""
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Boot Barn Hall: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all events (Webflow lazy loading)
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Get all event links for URLs
            event_links = {}
            try:
                link_elements = page.query_selector_all('a[href*="/events/"], a[href*="/calendar/"]')
                for link in link_elements:
                    href = link.get_attribute("href")
                    text = link.inner_text().strip()
                    if href and text and len(text) > 3:
                        # Store first occurrence of each title
                        if text not in event_links:
                            if not href.startswith("http"):
                                href = f"{BASE_URL}{href}"
                            event_links[text.lower()] = href
            except Exception as e:
                logger.warning(f"Could not extract event links: {e}")

            # Get page text for parsing
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Skip navigation and common UI elements
            skip_items = {
                "calendar", "upcoming events", "past events", "all events",
                "get tickets", "buy tickets", "more info", "learn more",
                "home", "about", "contact", "menu", "directions",
                "book now", "reserve", "subscribe", "sign up",
                "follow us", "facebook", "instagram", "twitter",
                "privacy policy", "terms", "accessibility",
            }

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip navigation items and very short lines
                if line.lower() in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                start_date = parse_date(line)

                if start_date:
                    # Found a date - look for title and details nearby
                    title = None
                    description = None
                    start_time = None
                    ticket_url = None

                    # Look forward and backward for title
                    for offset in [1, 2, -1, -2, 3, -3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            candidate = lines[idx].strip()

                            # Skip if it's a skip item, date, or time
                            if candidate.lower() in skip_items:
                                continue
                            if parse_date(candidate):
                                continue
                            if parse_time(candidate):
                                # Save time but keep looking for title
                                if not start_time:
                                    start_time = parse_time(candidate)
                                continue

                            # Skip very short or common words
                            if len(candidate) < 4:
                                continue
                            if candidate.upper() in ["DOORS", "SHOW", "PM", "AM"]:
                                continue

                            # This looks like a title
                            if len(candidate) > 3 and not title:
                                title = candidate
                                break

                    # Look for time if not found yet
                    if not start_time:
                        for j in range(max(0, i-3), min(len(lines), i+5)):
                            time_result = parse_time(lines[j])
                            if time_result:
                                start_time = time_result
                                break

                    # Look for description (longer text blocks)
                    for j in range(max(0, i-2), min(len(lines), i+6)):
                        if len(lines[j]) > 80 and lines[j] != title:
                            description = lines[j][:500]
                            break

                    # Skip if we don't have a title
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
                        title, "Boot Barn Hall", start_date
                    )

                    # Check for existing event
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Try to find event-specific URL
                    event_url = EVENTS_URL
                    for key, url in event_links.items():
                        # Match if title is similar to link text
                        if title.lower() in key or key in title.lower():
                            event_url = url
                            ticket_url = url
                            break

                    # Determine category
                    category, subcategory, tags = determine_category(title, description)

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
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": ticket_url or event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{line} - {title}",
                        "extraction_confidence": 0.85,
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
            f"Boot Barn Hall crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Boot Barn Hall: {e}")
        raise

    return events_found, events_new, events_updated
