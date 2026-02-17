"""
Crawler for ALS United of Georgia (alsgeorgia.org).

ALS United of Georgia provides support, education, and resources for individuals with ALS
(Amyotrophic Lateral Sclerosis / Lou Gehrig's disease) and their families.

Events include:
- WalkALS Atlanta (September)
- Monthly support groups (patients, caregivers, newly diagnosed)
- Educational workshops
- Equipment loan program info sessions
- Advocacy events

Highly relevant for hospital portal (neurological care, family support, equipment resources).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://alsgeorgia.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "ALS United of Georgia",
    "slug": "als-united-georgia",
    "address": "1955 Cliff Valley Way NE, Suite 100",
    "neighborhood": "Briarcliff",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.8120,
    "lng": -84.3230,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["als", "neurological", "support"],
}


def parse_date_string(date_str: str) -> Optional[str]:
    """Parse date string to YYYY-MM-DD format."""
    try:
        date_str = date_str.strip()
        date_str = re.sub(r'^[A-Za-z]+,?\s+', '', date_str)

        current_year = datetime.now().year

        # Month DD, YYYY
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")

        # Month DD (no year)
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2})', date_str)
        if match:
            month, day = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d")

        # MM/DD/YYYY
        match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date '{date_str}': {e}")

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string to 24-hour format."""
    try:
        time_str = time_str.strip().upper()
        time_str = re.sub(r'\s+(ET|EST|EDT)$', '', time_str)

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


def determine_category(title: str, description: str = "") -> str:
    """Determine event category."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["support group", "caregiver support", "patient support"]):
        return "support_group"

    if any(word in text for word in ["walkals", "walk", "run", "5k"]):
        return "fitness"

    if any(word in text for word in ["workshop", "seminar", "education", "lecture", "info session"]):
        return "learning"

    if any(word in text for word in ["gala", "fundraiser", "benefit"]):
        return "community"

    return "learning"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags."""
    text = f"{title} {description}".lower()
    tags = ["als", "neurological"]

    if "support group" in text:
        tags.append("support-group")

    if "family" in text or "caregiver" in text:
        tags.append("family-friendly")

    if "walk" in text or "run" in text:
        tags.extend(["outdoor", "activism"])

    if any(word in text for word in ["workshop", "education"]):
        tags.append("educational")

    if "free" in text or "no cost" in text:
        tags.append("free")

    if "newly diagnosed" in text:
        tags.append("adults")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["free", "no cost", "complimentary"]):
        return True

    # Support groups are typically free
    if "support group" in text:
        return True

    if any(word in text for word in ["$", "ticket", "registration fee"]):
        return False

    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl ALS United of Georgia events using Playwright."""
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

            logger.info(f"Fetching ALS United Georgia events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try common event selectors
            event_selectors = [
                ".event-item",
                ".event-card",
                "[class*='event']",
                "article",
                ".card",
                ".views-row",
            ]

            events = None
            for selector in event_selectors:
                events = page.query_selector_all(selector)
                if events and len(events) > 0:
                    logger.info(f"Found {len(events)} events using selector: {selector}")
                    break

            if not events or len(events) == 0:
                logger.warning("No event elements found on page")
                browser.close()
                return events_found, events_new, events_updated

            logger.info(f"Parsing {len(events)} event elements")
            for event_elem in events:
                try:
                    event_text = event_elem.inner_text()

                    # Extract title
                    title_elem = event_elem.query_selector("h1, h2, h3, h4, .title, [class*='title'], a")
                    if title_elem:
                        title = title_elem.inner_text().strip()
                    else:
                        lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                        title = lines[0] if lines else None

                    if not title or len(title) < 3:
                        continue

                    # Look for date and time
                    date_str = None
                    time_str = None

                    date_elem = event_elem.query_selector(".date, [class*='date'], time, [class*='when']")
                    if date_elem:
                        date_str = date_elem.inner_text().strip()

                    time_elem = event_elem.query_selector(".time, [class*='time']")
                    if time_elem:
                        time_str = time_elem.inner_text().strip()

                    # Search in text if not found
                    if not date_str:
                        date_match = re.search(r'([A-Za-z]+\s+\d{1,2}(?:,\s+\d{4})?)', event_text)
                        if not date_match:
                            date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', event_text)
                        if date_match:
                            date_str = date_match.group(1)

                    if not time_str:
                        time_match = re.search(r'(\d{1,2}(?::\d{2})?\s*[AP]M)', event_text, re.IGNORECASE)
                        if time_match:
                            time_str = time_match.group(1)

                    start_date = parse_date_string(date_str) if date_str else None
                    start_time = parse_time_string(time_str) if time_str else None

                    if not start_date:
                        logger.debug(f"No valid date found for: {title}")
                        continue

                    # Extract description
                    description = ""
                    desc_elem = event_elem.query_selector(".description, .excerpt, .summary, p")
                    if desc_elem:
                        description = desc_elem.inner_text().strip()

                    # Event URL
                    link_elem = event_elem.query_selector("a[href]")
                    event_url = EVENTS_URL
                    if link_elem:
                        href = link_elem.get_attribute("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    # Image
                    image_url = None
                    img_elem = event_elem.query_selector("img[src]")
                    if img_elem:
                        src = img_elem.get_attribute("src")
                        if src:
                            image_url = src if src.startswith("http") else BASE_URL + src

                    events_found += 1

                    category = determine_category(title, description)
                    tags = extract_tags(title, description)
                    is_free = is_free_event(title, description)

                    content_hash = generate_content_hash(title, "ALS United Georgia", start_date)


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
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": event_text[:500] if event_text else None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

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

        logger.info(f"ALS United Georgia crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching ALS United Georgia: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl ALS United Georgia: {e}")
        raise

    return events_found, events_new, events_updated
