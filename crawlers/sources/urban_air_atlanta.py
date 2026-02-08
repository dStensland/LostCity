"""
Crawler for Urban Air Adventure Parks - Atlanta locations.

Urban Air has multiple Atlanta-area locations (Snellville, Buford, etc.) offering
trampoline parks, obstacle courses, climbing walls, and special events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, normalize_time_format

logger = logging.getLogger(__name__)

# Urban Air locations in Atlanta area
URBAN_AIR_LOCATIONS = [
    {
        "name": "Urban Air Snellville",
        "slug": "urban-air-snellville",
        "address": "1905 Scenic Hwy N",
        "city": "Snellville",
        "zip": "30078",
        "url": "https://www.urbanair.com/georgia-snellville/",
    },
    {
        "name": "Urban Air Buford",
        "slug": "urban-air-buford",
        "address": "3235 Woodward Crossing Blvd",
        "city": "Buford",
        "zip": "30519",
        "url": "https://www.urbanair.com/georgia-buford/",
    },
    {
        "name": "Urban Air Kennesaw",
        "slug": "urban-air-kennesaw",
        "address": "400 Ernest W Barrett Pkwy NW",
        "city": "Kennesaw",
        "zip": "30144",
        "url": "https://www.urbanair.com/georgia-kennesaw/",
    },
]


def parse_date_from_text(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    if not date_text:
        return None

    date_text = date_text.strip()
    current_year = datetime.now().year

    # Try ISO format
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

    # Try "Mon DD" format
    match = re.search(
        r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})',
        date_text,
        re.IGNORECASE
    )
    if match:
        month_abbr, day = match.groups()
        try:
            dt = datetime.strptime(f"{month_abbr} {day} {current_year}", "%b %d %Y")
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_abbr} {day} {current_year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_from_text(time_text: str) -> Optional[str]:
    """Parse time from text."""
    if not time_text:
        return None
    return normalize_time_format(time_text)


def determine_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["family-friendly", "kids", "indoor", "active", "trampoline"]

    if any(word in text for word in ["toddler", "little", "preschool", "ages 2-5", "ages 3-6"]):
        tags.append("toddlers")
    if any(word in text for word in ["glow", "glow night", "black light"]):
        tags.append("glow-night")
    if any(word in text for word in ["fitness", "workout", "exercise", "class"]):
        tags.append("fitness")
    if any(word in text for word in ["jump time", "general admission", "freestyle"]):
        tags.append("open-jump")
    if any(word in text for word in ["special needs", "sensory", "autism-friendly"]):
        tags.append("sensory-friendly")
    if any(word in text for word in ["teen", "teens only", "13+"]):
        tags.append("teens")
    if any(word in text for word in ["dodgeball", "basketball", "ninja", "warrior"]):
        tags.append("sports")
    if any(word in text for word in ["climb", "climbing wall", "rope course"]):
        tags.append("climbing")

    return list(set(tags))


def extract_price_info(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """Extract price information from text."""
    text_lower = text.lower()

    if "free" in text_lower or "no charge" in text_lower:
        return 0, 0, "Free", True

    amounts = re.findall(r'\$(\d+(?:\.\d{2})?)', text)
    if not amounts:
        return None, None, None, False

    amounts = [float(a) for a in amounts]
    return min(amounts), max(amounts), None, False


def crawl_location(page, location: dict, source_id: int) -> tuple[int, int, int]:
    """Crawl events for a single Urban Air location."""
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {
        "name": location["name"],
        "slug": location["slug"],
        "address": location["address"],
        "neighborhood": None,
        "city": location["city"],
        "state": "GA",
        "zip": location["zip"],
        "venue_type": "entertainment",
        "website": location["url"],
    }

    venue_id = get_or_create_venue(venue_data)

    logger.info(f"Fetching events for {location['name']}: {location['url']}")

    # Try multiple possible event URLs
    urls_to_try = [
        location["url"],
        f"{location['url']}/events",
        f"{location['url']}/calendar",
    ]

    for url in urls_to_try:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images
            image_map = extract_images_from_page(page)

            # Get page text
            body_text = page.inner_text("body")

            # Check for event keywords
            event_keywords = ["toddler time", "glow night", "jump time", "special event", "fitness"]
            if not any(keyword in body_text.lower() for keyword in event_keywords):
                logger.debug(f"No event keywords found on {url}")
                continue

            # Parse events from text
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            i = 0
            while i < len(lines):
                line = lines[i]

                if len(line) < 5:
                    i += 1
                    continue

                # Look for event titles
                is_event_title = False
                title = None

                for event_type in ["Toddler Time", "Little Jumpers", "Glow Night", "Teen Night",
                                 "Jump Time", "Fitness", "Special Event", "Sensory", "Survivor Night"]:
                    if event_type.lower() in line.lower():
                        is_event_title = True
                        title = line
                        break

                if not is_event_title:
                    i += 1
                    continue

                # Look for date nearby
                start_date = None
                start_time = None
                description = ""

                for j in range(i + 1, min(i + 10, len(lines))):
                    check_line = lines[j]

                    date_result = parse_date_from_text(check_line)
                    if date_result:
                        start_date = date_result
                        time_result = parse_time_from_text(check_line)
                        if time_result:
                            start_time = time_result
                        break

                    if len(check_line) > 20 and not re.match(r'^\d{1,2}:\d{2}', check_line):
                        description = check_line

                if not start_date:
                    i += 1
                    continue

                events_found += 1

                # Extract price
                context_text = " ".join(lines[i:min(i+10, len(lines))])
                price_min, price_max, price_note, is_free = extract_price_info(context_text)

                # Determine tags
                tags = determine_tags(title, description)

                content_hash = generate_content_hash(
                    title, location["name"], start_date
                )

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    i += 1
                    continue

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description if description else f"{title} at {location['name']}",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "family",
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
                    logger.info(f"Added: {title} on {start_date} at {location['name']}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            # If we found events, stop trying other URLs for this location
            if events_found > 0:
                break

        except PlaywrightTimeout:
            logger.warning(f"Timeout loading {url}")
            continue
        except Exception as e:
            logger.warning(f"Error loading {url}: {e}")
            continue

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl all Urban Air Atlanta locations.
    """
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Crawl each location
            for location in URBAN_AIR_LOCATIONS:
                try:
                    found, new, updated = crawl_location(page, location, source_id)
                    total_found += found
                    total_new += new
                    total_updated += updated
                except Exception as e:
                    logger.error(f"Failed to crawl {location['name']}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Urban Air Atlanta crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Urban Air Atlanta: {e}")
        raise

    return total_found, total_new, total_updated
