"""
Crawler for PushPush Arts (pushpusharts.com/events).

PushPush Arts is a 25-year-old artist development center in College Park
that hosts workshops, performances, exhibitions, artist markets, and open studios.

Site uses Squarespace - needs Playwright for JS rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.pushpusharts.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "PushPush Arts",
    "slug": "pushpush-arts",
    "address": "1805 Harvard Avenue",
    "neighborhood": "Historic College Park",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "venue_type": "gallery",
    "website": BASE_URL,
}


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse various date formats from PushPush events.
    Examples: 'February 15, 2026', 'Feb 15', 'Sat, Feb 15', 'Jan. 23 - Feb. 7'
    """
    try:
        # Clean up the string
        date_str = date_str.strip()

        # Remove day name if present (e.g., "Sat, Feb 15")
        date_str = re.sub(r'^[A-Za-z]+,?\s+', '', date_str)

        current_year = datetime.now().year

        # Try "Month DD, YYYY" format
        match = re.search(r'([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")

        # Try "Month DD" format (no year)
        match = re.search(r'([A-Za-z]+)\.?\s+(\d{1,2})', date_str)
        if match:
            month, day = match.groups()
            # Try full month name first
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                # Try abbreviated month name
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d")

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date '{date_str}': {e}")

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '7:30 PM', '6pm', '7:30pm'
    """
    try:
        time_str = time_str.strip().upper()

        # Pattern: H:MM AM/PM or H AM/PM or HAM/PM
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    tags = ["arts", "gallery", "college-park", "artist-development"]

    # Performance / Theater
    if any(word in text for word in ["performance", "theater", "theatre", "show", "short plays", "play"]):
        return "theater", "performance", tags + ["theater", "performance"]

    # Workshop / Class
    if any(word in text for word in ["workshop", "class", "training", "seminar", "learn"]):
        return "education", "workshop", tags + ["workshop", "education"]

    # Exhibition / Opening
    if any(word in text for word in ["exhibition", "exhibit", "gallery", "opening", "art show", "installation"]):
        return "art", "exhibition", tags + ["exhibition", "visual-arts"]

    # Artist Market
    if any(word in text for word in ["market", "artist market", "makers market", "pop-up"]):
        return "market", None, tags + ["market", "shopping", "artist-market"]

    # Open Studios
    if any(word in text for word in ["open studio", "studio visit", "artist studios"]):
        return "art", "studio", tags + ["open-studios", "studio-visit"]

    # Music / Concert
    if any(word in text for word in ["concert", "music", "dj", "live music", "band"]):
        return "music", "performance", tags + ["music", "performance"]

    # Film
    if any(word in text for word in ["film", "screening", "movie", "documentary"]):
        return "film", None, tags + ["film"]

    # Community Events
    if any(word in text for word in ["volunteer", "community", "fundraiser"]):
        return "community", None, tags + ["community"]

    # Default to art
    return "art", None, tags


def extract_tags_from_content(title: str, description: str = "") -> list[str]:
    """Extract additional tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    if any(word in text for word in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")
    if any(word in text for word in ["free", "no cost", "no charge"]):
        tags.append("free")
    if any(word in text for word in ["opening", "reception"]):
        tags.append("opening-reception")
    if any(word in text for word in ["experimental", "avant-garde"]):
        tags.append("experimental")
    if any(word in text for word in ["dance", "movement"]):
        tags.append("dance")
    if any(word in text for word in ["poetry", "spoken word", "reading"]):
        tags.append("poetry")

    return tags


def is_free_event(title: str, description: str = "", price_text: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description} {price_text}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary", "donation"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "admission"]):
        # But some events say "free admission"
        if "free admission" in text or "free entry" in text or "donation" in text:
            return True
        return False

    # Default to free (many PushPush events are free or donation-based)
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl PushPush Arts events using Playwright.

    The site uses Squarespace with JavaScript-rendered event listings.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get venue ID
            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching PushPush Arts events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Try to find event containers - Squarespace common patterns
            event_selectors = [
                ".eventitem",
                ".event-item",
                ".sqs-block-summary-v2 .summary-item",
                "[class*='event']",
                "article",
                ".summary-item",
            ]

            event_elements = None
            for selector in event_selectors:
                event_elements = page.query_selector_all(selector)
                if event_elements and len(event_elements) > 0:
                    logger.info(f"Found {len(event_elements)} events using selector: {selector}")
                    break

            if not event_elements:
                logger.warning("No event elements found on page, trying body text parsing")
                # Fallback: parse body text
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Simple line-by-line parsing
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Look for date patterns
                    date_match = re.search(
                        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}',
                        line,
                        re.IGNORECASE
                    )

                    if date_match:
                        date_str = date_match.group(0)
                        start_date = parse_date_string(date_str)

                        if start_date:
                            # Look for title nearby
                            title = None
                            time_str = None
                            description = None

                            for offset in [-2, -1, 1, 2, 3]:
                                idx = i + offset
                                if 0 <= idx < len(lines):
                                    check_line = lines[idx]

                                    # Look for time
                                    if not time_str:
                                        time_result = parse_time_string(check_line)
                                        if time_result:
                                            time_str = time_result
                                            continue

                                    # Look for title
                                    if not title and len(check_line) > 5:
                                        if not re.match(r'\d{1,2}[:/]', check_line):
                                            if check_line.lower() not in ['events', 'calendar', 'home', 'about']:
                                                title = check_line

                            if title:
                                events_found += 1

                                category, subcategory, base_tags = determine_category(title, description or "")
                                extra_tags = extract_tags_from_content(title, description or "")
                                all_tags = list(set(base_tags + extra_tags))

                                content_hash = generate_content_hash(
                                    title, "PushPush Arts", start_date
                                )

                                if find_event_by_hash(content_hash):
                                    events_updated += 1
                                    i += 1
                                    continue

                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": description,
                                    "start_date": start_date,
                                    "start_time": time_str,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": time_str is None,
                                    "category": category,
                                    "subcategory": subcategory,
                                    "tags": all_tags,
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": is_free_event(title, description or ""),
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

            # If we found event elements, parse them
            elif event_elements:
                for event_elem in event_elements:
                    try:
                        event_text = event_elem.inner_text()

                        # Extract title (usually first/largest text or h2/h3)
                        title_elem = event_elem.query_selector("h1, h2, h3, h4, .title, .event-title, [class*='title']")
                        if title_elem:
                            title = title_elem.inner_text().strip()
                        else:
                            # Fallback: first line
                            lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                            title = lines[0] if lines else None

                        if not title or len(title) < 3:
                            continue

                        # Look for date and time in text
                        date_str = None
                        time_str = None

                        # Try to find date elements
                        date_elem = event_elem.query_selector(".date, .event-date, [class*='date'], time")
                        if date_elem:
                            date_str = date_elem.inner_text().strip()

                        # Try to find time elements
                        time_elem = event_elem.query_selector(".time, .event-time, [class*='time']")
                        if time_elem:
                            time_str = time_elem.inner_text().strip()

                        # If not found in elements, search in text
                        if not date_str:
                            # Look for date patterns in text
                            date_match = re.search(
                                r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?',
                                event_text,
                                re.IGNORECASE
                            )
                            if date_match:
                                date_str = date_match.group(0)

                        if not time_str:
                            # Look for time patterns
                            time_match = re.search(r'(\d{1,2}(?::\d{2})?\s*[AP]M)', event_text, re.IGNORECASE)
                            if time_match:
                                time_str = time_match.group(1)

                        # Parse dates and times
                        start_date = parse_date_string(date_str) if date_str else None
                        start_time = parse_time_string(time_str) if time_str else None

                        if not start_date:
                            logger.debug(f"No valid date found for: {title}")
                            continue

                        # Extract description
                        description = ""
                        desc_elem = event_elem.query_selector(".description, .event-description, .excerpt, .summary-excerpt, p")
                        if desc_elem:
                            description = desc_elem.inner_text().strip()

                        # Extract image
                        image_url = None
                        img_elem = event_elem.query_selector("img")
                        if img_elem:
                            src = img_elem.get_attribute("src")
                            if src:
                                if src.startswith("http"):
                                    image_url = src
                                elif src.startswith("//"):
                                    image_url = "https:" + src
                                elif src.startswith("/"):
                                    image_url = BASE_URL + src

                        # Look for event URL
                        link_elem = event_elem.query_selector("a[href]")
                        event_url = EVENTS_URL
                        if link_elem:
                            href = link_elem.get_attribute("href")
                            if href:
                                if href.startswith("http"):
                                    event_url = href
                                elif href.startswith("/"):
                                    event_url = BASE_URL + href

                        events_found += 1

                        category, subcategory, base_tags = determine_category(title, description)
                        extra_tags = extract_tags_from_content(title, description)
                        all_tags = list(set(base_tags + extra_tags))

                        content_hash = generate_content_hash(
                            title, "PushPush Arts", start_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description if description else None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": all_tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": is_free_event(title, description, ""),
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_url or image_map.get(title),
                            "raw_text": event_text[:500],
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
                        logger.warning(f"Error parsing event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"PushPush Arts crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching PushPush Arts: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl PushPush Arts: {e}")
        raise

    return events_found, events_new, events_updated
