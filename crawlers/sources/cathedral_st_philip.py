"""
Crawler for The Cathedral of St. Philip (cathedralatl.org).

Historic Episcopal cathedral in Buckhead hosting classical concerts,
organ recitals, jazz performances, and community events.
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

BASE_URL = "https://www.cathedralatl.org"
EVENTS_URL = f"{BASE_URL}/events/"
CONCERTS_URL = f"{BASE_URL}/worship/music/concerts/"

VENUE_DATA = {
    "name": "The Cathedral of St. Philip",
    "slug": "cathedral-of-st-philip",
    "address": "2744 Peachtree Rd NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8429,
    "lng": -84.3818,
    "venue_type": "church",
    "spot_type": "church",
    "website": BASE_URL,
    "vibes": ["historic", "faith-christian", "episcopal", "live-music", "upscale"],
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    current_year = datetime.now().year

    # Try "January 15, 2026" or "Jan 15, 2026"
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

    # Try "January 15" without year
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


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    title_lower = title.lower()
    desc_lower = description.lower()
    combined = title_lower + " " + desc_lower

    # Music events
    music_keywords = [
        "concert", "recital", "organ", "choir", "symphony", "orchestra",
        "jazz", "music", "performance", "voces8", "aso", "choral",
        "sing", "singing", "messiah", "cantata", "hymn"
    ]
    if any(kw in combined for kw in music_keywords):
        return "music"

    # Community events (races, festivals, etc.)
    community_keywords = ["5k", "race", "run", "festival", "fair", "community"]
    if any(kw in combined for kw in community_keywords):
        return "community"

    # Religious services (not concerts)
    religious_keywords = ["service", "worship", "mass", "eucharist", "prayer"]
    if any(kw in combined for kw in religious_keywords):
        return "religious"

    # Default to community for other events
    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cathedral of St. Philip events using Playwright."""
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

            # Crawl both the general events page and concerts page
            urls_to_crawl = [EVENTS_URL, CONCERTS_URL]

            for url in urls_to_crawl:
                logger.info(f"Fetching Cathedral of St. Philip: {url}")

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
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

                    # Try to find event containers (common patterns for WordPress/event plugins)
                    # Pattern 1: Look for event list items or article elements
                    event_containers = soup.find_all(["article", "div"], class_=lambda x: x and ("event" in x.lower() or "tribe" in x.lower()))

                    # Pattern 2: If no containers found, look for h2/h3 with dates
                    if not event_containers:
                        # Parse from text content
                        body_text = page.inner_text("body")
                        lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                        i = 0
                        while i < len(lines):
                            line = lines[i]

                            # Look for date patterns
                            date_match = re.search(
                                r"(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})?",
                                line,
                                re.IGNORECASE
                            )

                            if date_match:
                                start_date = parse_date(line)

                                if start_date:
                                    # Look for title nearby
                                    title = None
                                    start_time = None

                                    # Check surrounding lines for title and time
                                    for offset in [-2, -1, 1, 2, 3]:
                                        idx = i + offset
                                        if 0 <= idx < len(lines):
                                            check_line = lines[idx]

                                            # Skip navigation/UI elements
                                            skip_words = [
                                                "upcoming", "calendar", "events", "navigation",
                                                "menu", "search", "subscribe", "donate",
                                                "home", "about", "contact"
                                            ]
                                            if any(w in check_line.lower() for w in skip_words):
                                                continue

                                            # Check for time
                                            if not start_time:
                                                time_result = parse_time(check_line)
                                                if time_result:
                                                    start_time = time_result
                                                    continue

                                            # Check for title
                                            if not title and len(check_line) > 5:
                                                # Skip date patterns
                                                if not re.search(r"(\w+)\s+\d{1,2}", check_line):
                                                    # Skip price/register patterns
                                                    if not re.search(r"(free|tickets|\$|register)", check_line, re.IGNORECASE):
                                                        title = check_line
                                                        break

                                    if title:
                                        category = determine_category(title)

                                        # Skip religious services (not concerts/events)
                                        if category == "religious":
                                            i += 1
                                            continue

                                        events_found += 1

                                        content_hash = generate_content_hash(
                                            title, "The Cathedral of St. Philip", start_date
                                        )


                                        event_url = find_event_url(title, event_links, url)

                                        event_record = {
                                            "source_id": source_id,
                                            "venue_id": venue_id,
                                            "title": title,
                                            "description": f"Event at The Cathedral of St. Philip, a historic Episcopal cathedral in Buckhead.",
                                            "start_date": start_date,
                                            "start_time": start_time,
                                            "end_date": None,
                                            "end_time": None,
                                            "is_all_day": False,
                                            "category": category,
                                            "subcategory": "concert" if category == "music" else None,
                                            "tags": ["cathedral", "episcopal", "buckhead", "historic"],
                                            "price_min": None,
                                            "price_max": None,
                                            "price_note": None,
                                            "is_free": False,
                                            "source_url": event_url,
                                            "ticket_url": event_url if event_url != url else None,
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
                                # Extract title
                                title_elem = (
                                    container.find("h2") or
                                    container.find("h3") or
                                    container.find(class_=lambda x: x and "title" in x.lower())
                                )
                                if not title_elem:
                                    continue

                                title = title_elem.get_text(strip=True)

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
                                description = desc_elem.get_text(strip=True) if desc_elem else f"Event at The Cathedral of St. Philip."

                                # Determine category
                                category = determine_category(title, description)

                                # Skip religious services
                                if category == "religious":
                                    continue

                                # Extract link
                                link_elem = container.find("a", href=True)
                                event_url = link_elem["href"] if link_elem else url
                                if event_url and not event_url.startswith("http"):
                                    event_url = BASE_URL + event_url if event_url.startswith("/") else BASE_URL + "/" + event_url

                                # Extract image
                                img_elem = container.find("img", src=True)
                                image_url = img_elem["src"] if img_elem else None
                                if image_url and not image_url.startswith("http"):
                                    image_url = BASE_URL + image_url if image_url.startswith("/") else None

                                events_found += 1

                                content_hash = generate_content_hash(
                                    title, "The Cathedral of St. Philip", start_date
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
                                    "category": category,
                                    "subcategory": "concert" if category == "music" else None,
                                    "tags": ["cathedral", "episcopal", "buckhead", "historic"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": False,
                                    "source_url": event_url,
                                    "ticket_url": event_url if event_url != url else None,
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

                except Exception as e:
                    logger.error(f"Failed to crawl {url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Cathedral of St. Philip crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Cathedral of St. Philip: {e}")
        raise

    return events_found, events_new, events_updated
