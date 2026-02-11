"""
Crawler for St. Luke's Episcopal Church (stlukesatlanta.org).

Historic downtown Episcopal church hosting free lunchtime recitals,
Quartet-in-Residence performances, and seasonal concerts.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url, normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://stlukesatlanta.org"
MUSIC_URL = f"{BASE_URL}/music"

VENUE_DATA = {
    "name": "St. Luke's Episcopal Church",
    "slug": "st-lukes-episcopal-atlanta",
    "address": "435 Peachtree St NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7648,
    "lng": -84.3851,
    "venue_type": "church",
    "spot_type": "church",
    "website": BASE_URL,
    "vibes": ["faith-christian", "episcopal", "live-music", "historic"],
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    current_year = datetime.now().year

    # Try "Friday, March 14, 2026" or "Friday March 14"
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

    # Try "March 14, 2026" or "Mar 14, 2026"
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

    # Try "March 14" without year
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

    # Try patterns like "12:15 pm" or "12:15pm"
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
        "recital", "concert", "quartet", "organ", "choir", "music",
        "performance", "messiah", "cantata", "symphony", "ensemble"
    ]
    if any(kw in combined for kw in music_keywords):
        return "music"

    # Religious services (not concerts)
    religious_keywords = ["service", "worship", "mass", "eucharist", "prayer"]
    if any(kw in combined for kw in religious_keywords):
        return "religious"

    # Default to community for other events
    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl St. Luke's Episcopal music events using Playwright."""
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

            logger.info(f"Fetching St. Luke's Episcopal: {MUSIC_URL}")

            page.goto(MUSIC_URL, wait_until="domcontentloaded", timeout=30000)
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

            # Try to find structured concert listings
            event_containers = soup.find_all(
                ["article", "div", "section"],
                class_=lambda x: x and any(w in x.lower() for w in ["event", "concert", "recital", "performance", "music"])
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
                                        "home", "about", "contact", "music program"
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
                                        if not re.search(r"(?:January|February|March|April|May|June|July|August|September|October|November|December)", check_line, re.IGNORECASE):
                                            # Skip price/register patterns
                                            if not re.search(r"(free|tickets|\$|register|admission)", check_line, re.IGNORECASE):
                                                title = check_line
                                                break

                            if title:
                                # Determine category
                                category = determine_category(title)

                                # Skip religious services (not concerts)
                                if category == "religious":
                                    i += 1
                                    continue

                                events_found += 1

                                content_hash = generate_content_hash(
                                    title, "St. Luke's Episcopal Church", start_date
                                )

                                if find_event_by_hash(content_hash):
                                    events_updated += 1
                                    i += 1
                                    continue

                                event_url = find_event_url(title, event_links, MUSIC_URL)

                                # Check if it's a lunchtime recital (typically free)
                                is_free = "lunchtime" in title.lower() or (start_time and start_time.startswith("12:"))

                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": f"Event at St. Luke's Episcopal Church, a historic downtown Atlanta church known for its music program.",
                                    "start_date": start_date,
                                    "start_time": start_time,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": category,
                                    "subcategory": "concert" if category == "music" else None,
                                    "tags": ["episcopal", "downtown", "historic", "live-music"],
                                    "price_min": 0 if is_free else None,
                                    "price_max": 0 if is_free else None,
                                    "price_note": "Free admission" if is_free else None,
                                    "is_free": is_free,
                                    "source_url": event_url,
                                    "ticket_url": event_url if event_url != MUSIC_URL else None,
                                    "image_url": None,
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

            else:
                # Process structured event containers
                for container in event_containers:
                    try:
                        # Extract title
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
                        if len(title) < 5 or title.lower() in ["music", "concerts", "upcoming events", "schedule"]:
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
                        description = desc_elem.get_text(strip=True) if desc_elem else f"Event at St. Luke's Episcopal Church, a historic downtown Atlanta church known for its music program."

                        # Determine category
                        category = determine_category(title, description)

                        # Skip religious services
                        if category == "religious":
                            continue

                        # Extract link
                        link_elem = container.find("a", href=True)
                        event_url = link_elem["href"] if link_elem else MUSIC_URL
                        if event_url and not event_url.startswith("http"):
                            event_url = BASE_URL + event_url if event_url.startswith("/") else BASE_URL + "/" + event_url

                        # Extract image
                        img_elem = container.find("img", src=True)
                        image_url = img_elem["src"] if img_elem else None
                        if image_url and not image_url.startswith("http"):
                            image_url = BASE_URL + image_url if image_url.startswith("/") else None

                        # Check if it's a lunchtime recital (typically free)
                        is_free = "lunchtime" in title.lower() or "lunchtime" in description.lower() or (start_time and start_time.startswith("12:"))

                        events_found += 1

                        content_hash = generate_content_hash(
                            title, "St. Luke's Episcopal Church", start_date
                        )

                        if find_event_by_hash(content_hash):
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
                            "tags": ["episcopal", "downtown", "historic", "live-music"],
                            "price_min": 0 if is_free else None,
                            "price_max": 0 if is_free else None,
                            "price_note": "Free admission" if is_free else None,
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": event_url if event_url != MUSIC_URL else None,
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
            f"St. Luke's Episcopal crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl St. Luke's Episcopal: {e}")
        raise

    return events_found, events_new, events_updated
