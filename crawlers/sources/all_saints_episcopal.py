"""
Crawler for All Saints' Episcopal Church (allsaintsatlanta.org).

Midtown Episcopal church hosting the Jazz at All Saints concert series
with nationally known jazz artists.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url, normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://allsaintsatlanta.org"
JAZZ_URL = f"{BASE_URL}/music/jazz-at-all-saints/"

VENUE_DATA = {
    "name": "All Saints' Episcopal Church",
    "slug": "all-saints-episcopal",
    "address": "634 West Peachtree St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7721,
    "lng": -84.3893,
    "venue_type": "church",
    "spot_type": "church",
    "website": BASE_URL,
    "vibes": ["faith-christian", "episcopal", "live-music", "intimate"],
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    current_year = datetime.now().year

    # Try "Sunday, February 16, 2026" or "Sunday February 16"
    match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})?",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        year = year or str(current_year)
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                if not match.group(3) and dt.date() < datetime.now().date():
                    # If no year provided and date is in past, assume next year
                    dt = datetime.strptime(f"{month} {day} {int(year) + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Try "February 16, 2026" or "Feb 16, 2026"
    match = re.search(
        r"(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Try "February 16" without year
    match = re.search(
        r"(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day = match.groups()
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                if dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats to HH:MM."""
    if not time_text:
        return None

    # Try using the utility function
    normalized = normalize_time_format(time_text)
    if normalized:
        return normalized

    # Try patterns like "7:00 pm" or "7pm"
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        time_text,
        re.IGNORECASE
    )
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl All Saints' Episcopal jazz series using Playwright."""
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

            logger.info(f"Fetching All Saints' Episcopal: {JAZZ_URL}")

            page.goto(JAZZ_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event links
            event_links = extract_event_links(page, BASE_URL)

            # Get page HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Try to find structured jazz concert listings
            # Common patterns: article, div with class containing "event" or "concert"
            event_containers = soup.find_all(
                ["article", "div", "section"],
                class_=lambda x: x and any(w in x.lower() for w in ["event", "concert", "jazz", "performance"])
            )

            # If no structured containers, parse from text
            if not event_containers:
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Look for date patterns
                    date_match = re.search(
                        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+)\s+(\d{1,2})",
                        line,
                        re.IGNORECASE
                    )

                    if date_match:
                        start_date = parse_date(line)

                        if start_date:
                            # Look for title and time nearby
                            title = None
                            start_time = None

                            # Check surrounding lines
                            for offset in [-3, -2, -1, 1, 2, 3, 4]:
                                idx = i + offset
                                if 0 <= idx < len(lines):
                                    check_line = lines[idx]

                                    # Skip navigation/UI elements
                                    skip_words = [
                                        "upcoming", "calendar", "events", "navigation",
                                        "menu", "search", "subscribe", "donate",
                                        "home", "about", "contact", "music", "jazz at all saints"
                                    ]
                                    if any(w in check_line.lower() for w in skip_words):
                                        continue

                                    # Check for time
                                    if not start_time:
                                        time_result = parse_time(check_line)
                                        if time_result:
                                            start_time = time_result
                                            continue

                                    # Check for title (artist/band name)
                                    if not title and len(check_line) > 5:
                                        # Skip date patterns
                                        if not re.search(r"(?:January|February|March|April|May|June|July|August|September|October|November|December)", check_line, re.IGNORECASE):
                                            # Skip price/register patterns
                                            if not re.search(r"(free|tickets|\$|register|admission|cost)", check_line, re.IGNORECASE):
                                                # This is likely the artist/title
                                                title = check_line
                                                break

                            if title:
                                events_found += 1

                                content_hash = generate_content_hash(
                                    title, "All Saints' Episcopal Church", start_date
                                )


                                event_url = find_event_url(title, event_links, JAZZ_URL)

                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": f"Jazz at All Saints featuring {title}. Part of the monthly jazz concert series at All Saints' Episcopal Church in Midtown Atlanta.",
                                    "start_date": start_date,
                                    "start_time": start_time,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": "music",
                                    "subcategory": "concert",
                                    "tags": ["jazz", "episcopal", "midtown", "live-music", "intimate"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": False,
                                    "source_url": event_url,
                                    "ticket_url": event_url if event_url != JAZZ_URL else None,
                                    "image_url": None,
                                    "raw_text": f"{title} - {start_date}",
                                    "extraction_confidence": 0.80,
                                    "is_recurring": False,
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

            else:
                # Process structured event containers
                for container in event_containers:
                    try:
                        # Extract title (artist/band name)
                        title_elem = (
                            container.find("h2") or
                            container.find("h3") or
                            container.find("h4") or
                            container.find(class_=lambda x: x and "title" in x.lower())
                        )
                        if not title_elem:
                            continue

                        title = title_elem.get_text(strip=True)

                        # Skip if this is just a heading/label
                        if len(title) < 5 or title.lower() in ["jazz at all saints", "upcoming concerts", "schedule"]:
                            continue

                        # Extract date
                        date_elem = container.find(class_=lambda x: x and "date" in x.lower())
                        if not date_elem:
                            # Try to find date in text content
                            date_elem = container

                        date_text = date_elem.get_text()
                        start_date = parse_date(date_text)

                        if not start_date:
                            continue

                        # Extract time
                        time_text = date_text
                        start_time = parse_time(time_text)

                        # Extract description
                        desc_elem = container.find(class_=lambda x: x and ("description" in x.lower() or "excerpt" in x.lower()))
                        description = desc_elem.get_text(strip=True) if desc_elem else f"Jazz at All Saints featuring {title}. Part of the monthly jazz concert series at All Saints' Episcopal Church in Midtown Atlanta."

                        # Extract link
                        link_elem = container.find("a", href=True)
                        event_url = link_elem["href"] if link_elem else JAZZ_URL
                        if event_url and not event_url.startswith("http"):
                            event_url = BASE_URL + event_url if event_url.startswith("/") else BASE_URL + "/" + event_url

                        # Extract image
                        img_elem = container.find("img", src=True)
                        image_url = img_elem["src"] if img_elem else None
                        if image_url and not image_url.startswith("http"):
                            image_url = BASE_URL + image_url if image_url.startswith("/") else None

                        events_found += 1

                        content_hash = generate_content_hash(
                            title, "All Saints' Episcopal Church", start_date
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

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
                            "category": "music",
                            "subcategory": "concert",
                            "tags": ["jazz", "episcopal", "midtown", "live-music", "intimate"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url if event_url != JAZZ_URL else None,
                            "image_url": image_url,
                            "raw_text": f"{title} - {start_date}",
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

                    except Exception as e:
                        logger.error(f"Failed to parse event container: {e}")
                        continue

            browser.close()

        logger.info(
            f"All Saints' Episcopal crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl All Saints' Episcopal: {e}")
        raise

    return events_found, events_new, events_updated
