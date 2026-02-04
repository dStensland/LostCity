"""
Crawler for Defy Atlanta.

NOTE: Defy Atlanta was acquired by Sky Zone and now redirects to Sky Zone Atlanta.
The defyatlanta.com domain no longer exists. This crawler is deprecated.
Use sky_zone_atlanta.py instead, which includes the Sky Zone Atlanta location
at 3200 Northlake Pkwy NE (formerly Defy Atlanta).

This file is kept for reference but should not be used.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, normalize_time_format

logger = logging.getLogger(__name__)

# NOTE: Defy Atlanta was acquired by Sky Zone. This URL no longer exists.
# The location now operates as Sky Zone Atlanta at 3200 Northlake Pkwy NE, Atlanta, GA 30345
# See sky_zone_atlanta.py for the current crawler.
BASE_URL = "https://www.skyzone.com/atlanta/"  # Redirects from old Defy domain
EVENTS_URL = f"{BASE_URL}events"

# DEPRECATED: This venue is now Sky Zone Atlanta
DEFY_VENUE = {
    "name": "Sky Zone Atlanta (formerly Defy Atlanta)",
    "slug": "sky-zone-atlanta",
    "address": "3200 Northlake Pkwy NE",
    "neighborhood": None,
    "city": "Atlanta",
    "state": "GA",
    "zip": "30345",
    "venue_type": "entertainment",
    "website": BASE_URL,
}


def parse_date_from_text(date_text: str) -> Optional[str]:
    """
    Parse date from various formats.
    Examples:
    - "January 31, 2026"
    - "Jan 31"
    - "2026-01-31"
    - "Friday, Jan 31"
    """
    if not date_text:
        return None

    date_text = date_text.strip()
    current_year = datetime.now().year

    # Try ISO format first
    if re.match(r'\d{4}-\d{2}-\d{2}', date_text):
        return date_text[:10]

    # Try "Month DD, YYYY" format
    match = re.search(
        r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})',
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "Mon DD" format (assume current or next year)
    match = re.search(
        r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})',
        date_text,
        re.IGNORECASE
    )
    if match:
        month_abbr, day = match.groups()
        try:
            dt = datetime.strptime(f"{month_abbr} {day} {current_year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_abbr} {day} {current_year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_from_text(time_text: str) -> Optional[str]:
    """Parse time from text like '7:00 PM' or '7pm'."""
    if not time_text:
        return None
    return normalize_time_format(time_text)


def determine_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["family-friendly", "kids", "indoor", "active", "trampoline"]

    if any(word in text for word in ["toddler", "little jumper", "preschool", "ages 2-5"]):
        tags.append("toddlers")
    if any(word in text for word in ["glow", "glow night", "black light"]):
        tags.append("glow-night")
    if any(word in text for word in ["fitness", "workout", "exercise", "class"]):
        tags.append("fitness")
    if any(word in text for word in ["open jump", "general admission", "freestyle"]):
        tags.append("open-jump")
    if any(word in text for word in ["special needs", "sensory", "autism"]):
        tags.append("sensory-friendly")
    if any(word in text for word in ["teen", "teens only", "13+"]):
        tags.append("teens")
    if any(word in text for word in ["dodgeball", "basketball", "competition"]):
        tags.append("sports")

    return list(set(tags))


def extract_price_info(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Extract price information from text.
    Returns: Tuple of (price_min, price_max, price_note, is_free)
    """
    text_lower = text.lower()

    # Check for free
    if "free" in text_lower or "no charge" in text_lower:
        return 0, 0, "Free", True

    # Find dollar amounts
    amounts = re.findall(r'\$(\d+(?:\.\d{2})?)', text)
    if not amounts:
        return None, None, None, False

    amounts = [float(a) for a in amounts]
    return min(amounts), max(amounts), None, False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Defy Atlanta events using Playwright.

    The site may use JavaScript to load event information.
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

            # Get venue ID for Defy Atlanta
            venue_id = get_or_create_venue(DEFY_VENUE)

            logger.info(f"Fetching Defy Atlanta events: {EVENTS_URL}")

            # Try multiple possible URLs
            urls_to_try = [
                EVENTS_URL,
                f"{BASE_URL}/calendar",
                f"{BASE_URL}/special-events",
                BASE_URL,  # Homepage might have event info
            ]

            for url in urls_to_try:
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Scroll to load all content
                    for _ in range(5):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    # Extract images from page
                    image_map = extract_images_from_page(page)

                    # Get page text
                    body_text = page.inner_text("body")

                    # Look for event-related keywords to see if this page has events
                    event_keywords = ["toddler time", "glow night", "open jump", "special event", "fitness class"]
                    if not any(keyword in body_text.lower() for keyword in event_keywords):
                        logger.debug(f"No event keywords found on {url}, trying next URL")
                        continue

                    # Parse events from text
                    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                    i = 0
                    while i < len(lines):
                        line = lines[i]

                        # Skip short lines
                        if len(line) < 5:
                            i += 1
                            continue

                        # Look for event titles (common patterns)
                        is_event_title = False
                        title = None

                        # Check for known event types
                        for event_type in ["Toddler Time", "Little Jumpers", "Glow Night", "Teen Night",
                                         "Open Jump", "Fitness", "Special Event", "Sensory"]:
                            if event_type.lower() in line.lower():
                                is_event_title = True
                                title = line
                                break

                        if not is_event_title:
                            i += 1
                            continue

                        # Look for date nearby (next few lines)
                        start_date = None
                        start_time = None
                        description = ""

                        for j in range(i + 1, min(i + 10, len(lines))):
                            check_line = lines[j]

                            # Try to parse as date
                            date_result = parse_date_from_text(check_line)
                            if date_result:
                                start_date = date_result
                                # Try to parse time from same line
                                time_result = parse_time_from_text(check_line)
                                if time_result:
                                    start_time = time_result
                                break

                            # Collect description
                            if len(check_line) > 20 and not re.match(r'^\d{1,2}:\d{2}', check_line):
                                description = check_line

                        if not start_date:
                            i += 1
                            continue

                        events_found += 1

                        # Extract price info
                        context_text = " ".join(lines[i:min(i+10, len(lines))])
                        price_min, price_max, price_note, is_free = extract_price_info(context_text)

                        # Determine tags
                        tags = determine_tags(title, description)

                        content_hash = generate_content_hash(
                            title, "Defy Atlanta", start_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            i += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description if description else f"{title} at Defy Atlanta trampoline park",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "entertainment",
                            "subcategory": "active",
                            "tags": tags,
                            "price_min": price_min,
                            "price_max": price_max,
                            "price_note": price_note,
                            "is_free": is_free,
                            "source_url": url,
                            "ticket_url": url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} | {start_date} | {description[:200]}"[:500],
                            "extraction_confidence": 0.75,
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

                    # If we found events, stop trying other URLs
                    if events_found > 0:
                        break

                except PlaywrightTimeout:
                    logger.warning(f"Timeout loading {url}, trying next URL")
                    continue
                except Exception as e:
                    logger.warning(f"Error loading {url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Defy Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Defy Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
