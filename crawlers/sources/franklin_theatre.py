"""
Crawler for Franklin Theatre (franklintheatre.com/all-events).
Historic theater in downtown Franklin, TN featuring live music and films.

NOTE: This venue is in Franklin, TN (not Nashville proper).

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.franklintheatre.com"
EVENTS_URL = f"{BASE_URL}/all-events/"

VENUE_DATA = {
    "name": "Franklin Theatre",
    "slug": "franklin-theatre",
    "address": "419 Main St",
    "neighborhood": "Downtown Franklin",
    "city": "Franklin",  # NOTE: Franklin, not Nashville
    "state": "TN",
    "zip": "37064",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range like 'Feb 14-15' or 'March 8'.
    Returns (start_date, end_date) tuple.
    """
    date_text = date_text.strip()
    current_year = datetime.now().year

    # Pattern: "Feb 14-15" (same month)
    match = re.match(r"([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*(\d{1,2})", date_text, re.IGNORECASE)
    if match:
        month, start_day, end_day = match.groups()
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {current_year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {current_year}", "%b %d %Y")
            # If dates are in the past, assume next year
            now = datetime.now()
            if start_dt < now:
                start_dt = start_dt.replace(year=current_year + 1)
                end_dt = end_dt.replace(year=current_year + 1)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            # Try with full month name
            try:
                start_dt = datetime.strptime(f"{month} {start_day} {current_year}", "%B %d %Y")
                end_dt = datetime.strptime(f"{month} {end_day} {current_year}", "%B %d %Y")
                if start_dt < datetime.now():
                    start_dt = start_dt.replace(year=current_year + 1)
                    end_dt = end_dt.replace(year=current_year + 1)
                return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Pattern: Single date "March 8" or "Feb 14"
    match = re.match(r"([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?", date_text, re.IGNORECASE)
    if match:
        month, day, year = match.groups()
        year = year or current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            # If date is in the past, assume next year (unless year was explicit)
            if not match.group(3) and dt < datetime.now():
                dt = dt.replace(year=int(year) + 1)
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            # Try with full month name
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                if not match.group(3) and dt < datetime.now():
                    dt = dt.replace(year=int(year) + 1)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                pass

    return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '7:30 PM' or '8pm' to HH:MM."""
    if not time_text:
        return None

    time_text = time_text.strip()

    # Look for time pattern
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).upper()

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Franklin Theatre events using Playwright."""
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

            logger.info(f"Fetching Franklin Theatre: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = [
                "skip to content", "tickets", "calendar", "membership", "about",
                "buy tickets", "learn more", "events", "all events", "upcoming events",
                "franklin theatre", "view all", "filter", "films", "music",
                "special events", "sold out",
            ]

            browser.close()

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]
                line_lower = line.lower()

                # Skip nav/UI items
                if line_lower in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date pattern
                start_date, end_date = parse_date_range(line)

                if start_date:
                    # Found a date line, look ahead for title and time
                    title = None
                    start_time = None

                    # Check next few lines for title and time
                    for offset in range(1, 5):
                        if i + offset >= len(lines):
                            break

                        next_line = lines[i + offset]

                        # Check if line contains time
                        if re.search(r"\d{1,2}(?::\d{2})?\s*(?:AM|PM)", next_line, re.IGNORECASE):
                            start_time = parse_time(next_line)
                            continue

                        # Skip if it's a navigation item
                        if next_line.lower() in skip_items:
                            continue

                        # This should be the title
                        if not title and len(next_line) > 3:
                            title = next_line
                            break

                    if not title:
                        i += 1
                        continue

                    # Check for duplicates
                    event_key = f"{title}|{start_date}|{start_time}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Franklin Theatre", start_date
                    )

                    # Check for existing

                    # Determine category based on content
                    event_category = "music"
                    subcategory = "concert"
                    tags = ["franklin-theatre", "franklin-tn", "live-music"]

                    title_lower = title.lower()
                    if any(w in title_lower for w in ["film", "movie", "screening"]):
                        event_category = "film"
                        subcategory = "screening"
                        tags = ["franklin-theatre", "franklin-tn", "film"]
                    elif any(w in title_lower for w in ["comedy", "comedian"]):
                        event_category = "comedy"
                        subcategory = None
                        tags.append("comedy")
                    elif any(w in title_lower for w in ["kids", "family", "children"]):
                        event_category = "family"
                        subcategory = "kids"
                        tags.extend(["family", "kids"])
                    elif any(w in title_lower for w in ["country", "bluegrass", "americana"]):
                        tags.append("country")
                    elif any(w in title_lower for w in ["jazz", "blues"]):
                        tags.append(title_lower.split()[0])

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": event_category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{line} {title}",
                        "extraction_confidence": 0.85,
                        "is_recurring": end_date is not None,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

        logger.info(
            f"Franklin Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Franklin Theatre: {e}")
        raise

    return events_found, events_new, events_updated
