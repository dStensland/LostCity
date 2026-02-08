"""
Crawler for WRFG Radio Free Georgia (wrfg.org).

Community radio station hosting live music events, fundraisers, cultural programs,
and community gatherings. Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://www.wrfg.org"
EVENTS_URL = f"{BASE_URL}/events"

# WRFG Radio Free Georgia venue
VENUE_DATA = {
    "name": "WRFG Radio Free Georgia",
    "slug": "wrfg-radio-free-georgia",
    "address": "1083 Austin Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "radio_station",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse date from various formats.
    Examples: 'February 15, 2026', 'Feb 15', 'Saturday, March 5, 2026'
    """
    date_str = date_str.strip()

    # Remove day of week if present
    day_pattern = r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*"
    date_str = re.sub(day_pattern, "", date_str, flags=re.I)

    current_year = datetime.now().year

    # Try various date formats
    formats = [
        "%B %d, %Y",
        "%B %d %Y",
        "%b %d, %Y",
        "%b %d %Y",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try without year
    for fmt in ["%B %d", "%b %d", "%m/%d"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            dt = dt.replace(year=current_year)
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from format like '7:00 PM' or '2:30pm'."""
    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
    except Exception:
        pass
    return None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["concert", "show", "live music", "performance", "band", "dj"]):
        return "music"
    if any(word in text for word in ["fundraiser", "gala", "benefit", "radiothon", "pledge drive"]):
        return "community"
    if any(word in text for word in ["workshop", "class", "training", "education"]):
        return "education"
    if any(word in text for word in ["meeting", "town hall", "community gathering"]):
        return "community"

    return "music"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["radio", "community"]

    if any(word in text for word in ["music", "concert", "show", "band", "live"]):
        tags.append("music")
    if any(word in text for word in ["fundraiser", "benefit", "radiothon", "pledge"]):
        tags.append("fundraiser")
    if any(word in text for word in ["hip-hop", "hip hop", "rap"]):
        tags.append("hip-hop")
    if any(word in text for word in ["jazz"]):
        tags.append("jazz")
    if any(word in text for word in ["rock", "punk"]):
        tags.append("rock")
    if any(word in text for word in ["electronic", "techno", "house"]):
        tags.append("electronic")
    if any(word in text for word in ["blues"]):
        tags.append("blues")
    if any(word in text for word in ["soul", "r&b"]):
        tags.append("soul")
    if any(word in text for word in ["world music", "international", "latin", "african"]):
        tags.append("world-music")
    if any(word in text for word in ["volunteer", "community service"]):
        tags.append("volunteer")
    if "free" in text:
        tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "", price_text: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description} {price_text}".lower()

    # Check for free indicators (excluding "no cover" which just means no door charge)
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "admission", "cover charge"]):
        return False

    # Default to unknown for music events
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl WRFG Radio Free Georgia events using Playwright.
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

            logger.info(f"Fetching WRFG Radio Free Georgia events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Try multiple selectors for events
            event_selectors = [
                ".event-item",
                ".event",
                "[class*='event']",
                ".tribe-event",
                ".eo-event",
                "article",
            ]

            events_processed = set()

            for selector in event_selectors:
                try:
                    elements = page.query_selector_all(selector)

                    for elem in elements:
                        try:
                            elem_text = elem.inner_text()

                            # Skip if too short
                            if len(elem_text) < 20:
                                continue

                            # Try to extract title
                            title_elem = elem.query_selector("h1, h2, h3, h4, .title, [class*='title']")
                            if not title_elem:
                                continue

                            title = title_elem.inner_text().strip()

                            # Skip duplicates
                            if title in events_processed:
                                continue

                            # Skip navigation/header elements
                            if len(title) < 10 or title.lower() in ["events", "upcoming events", "calendar"]:
                                continue

                            # Try to find date
                            date_elem = elem.query_selector(".date, .event-date, time, [class*='date']")
                            if not date_elem:
                                # Look for date pattern in text
                                date_match = re.search(
                                    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s*\d{4})?",
                                    elem_text,
                                    re.I
                                )
                                if not date_match:
                                    continue
                                date_text = date_match.group(0)
                            else:
                                date_text = date_elem.inner_text().strip()

                            start_date = parse_date(date_text)
                            if not start_date:
                                continue

                            # Try to find time
                            time_match = re.search(r"\d{1,2}:\d{2}\s*(?:AM|PM)", elem_text, re.I)
                            start_time = parse_time(time_match.group(0)) if time_match else None

                            # Extract description
                            desc_elem = elem.query_selector("p, .description, .excerpt, [class*='description']")
                            description = desc_elem.inner_text().strip() if desc_elem else ""

                            if len(description) > 500:
                                description = description[:497] + "..."

                            # Extract price info
                            price_text = ""
                            price_elem = elem.query_selector(".price, [class*='price'], [class*='cost']")
                            if price_elem:
                                price_text = price_elem.inner_text().strip()

                            # Extract venue/location info
                            location_elem = elem.query_selector(".location, .venue, [class*='location'], [class*='venue']")
                            location = location_elem.inner_text().strip() if location_elem else ""

                            # Try to extract event URL
                            link_elem = elem.query_selector("a")
                            source_url = EVENTS_URL
                            if link_elem:
                                href = link_elem.get_attribute("href")
                                if href:
                                    if href.startswith("/"):
                                        source_url = BASE_URL + href
                                    elif href.startswith("http"):
                                        source_url = href

                            events_found += 1
                            events_processed.add(title)

                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description, price_text)

                            # Handle "no cover" separately from is_free
                            combined_text = f"{title} {description} {price_text}".lower()
                            note = price_text if price_text else None
                            if "no cover" in combined_text and not note:
                                note = "No cover"

                            content_hash = generate_content_hash(
                                title, VENUE_DATA["name"], start_date
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            # Add location to description if available and not in title
                            full_description = description
                            if location and location.lower() not in title.lower():
                                if full_description:
                                    full_description = f"{description}\n\nLocation: {location}"
                                else:
                                    full_description = f"Location: {location}"

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": full_description if full_description else None,
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": category,
                                "subcategory": None,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": note,
                                "is_free": is_free,
                                "source_url": source_url,
                                "ticket_url": source_url,
                                "image_url": image_map.get(title),
                                "raw_text": elem_text[:500] if elem_text else None,
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

                        except Exception as e:
                            logger.debug(f"Error processing element: {e}")
                            continue

                except Exception as e:
                    logger.debug(f"Error with selector {selector}: {e}")
                    continue

            browser.close()

        logger.info(
            f"WRFG Radio Free Georgia crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching WRFG Radio Free Georgia: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl WRFG Radio Free Georgia: {e}")
        raise

    return events_found, events_new, events_updated
