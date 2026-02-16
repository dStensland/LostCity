"""
Crawler for CancerCare (cancercare.org).

CancerCare is a national nonprofit providing free, professional support services
for anyone affected by cancer: people with cancer, caregivers, loved ones, and
the bereaved. Services include:

- Free support groups (online and phone-based)
- Educational workshops and webinars
- Counseling sessions
- Financial assistance programs
- Publications and resources

While headquartered in NYC, their virtual programs serve patients nationwide,
including Atlanta/Emory portal audience. Most services are free and accessible
remotely.

STRATEGY:
- Check https://www.cancercare.org/connect-workshops or similar events page
- Extract online support groups, webinars, workshops
- Tag: virtual events, support groups, educational programs
- Category: "support_group" for groups, "learning" for workshops/webinars
- Most/all events are free and virtual
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from datetime import datetime

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cancercare.org"
EVENTS_URL = f"{BASE_URL}/connect-workshops"

VENUE_DATA = {
    "name": "CancerCare",
    "slug": "cancercare",
    "address": "275 Seventh Avenue, Floor 22",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "lat": 40.7465,
    "lng": -73.9932,
    "venue_type": "organization",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["inclusive"],
}


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse various date formats from CancerCare events.
    Examples: 'February 15, 2026', 'Feb 15, 2026', '2/15/2026'
    """
    try:
        date_str = date_str.strip()
        current_year = datetime.now().year

        # Try "Month DD, YYYY" format
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")

        # Try "Month DD" format (no year)
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2})', date_str)
        if match:
            month, day = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d")

        # Try "MM/DD/YYYY" format
        match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date '{date_str}': {e}")

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '1:00 PM ET'
    """
    try:
        time_str = time_str.strip().upper()
        # Remove timezone indicators
        time_str = re.sub(r'\s+(ET|EST|EDT|CT|CST|CDT|PT|PST|PDT)$', '', time_str)

        # Extract first time if range
        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

        # Pattern: H:MM AM/PM or H AM/PM
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


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = []

    # Support groups
    if any(word in text for word in ["support group", "peer support", "caregiver support"]):
        category = "support_group"
        tags.extend(["community", "support"])
    # Workshops and educational webinars
    elif any(word in text for word in ["workshop", "webinar", "class", "training", "education", "seminar"]):
        category = "learning"
        tags.append("educational")
    # Counseling sessions
    elif any(word in text for word in ["counseling", "therapy", "one-on-one"]):
        category = "wellness"
        tags.append("mental-health")
    else:
        category = "community"

    # Virtual events
    if any(word in text for word in ["virtual", "online", "zoom", "webinar", "phone"]):
        tags.append("virtual")

    # Cancer-specific types
    if any(word in text for word in ["breast cancer", "lung cancer", "prostate cancer", "ovarian cancer"]):
        tags.append("cancer-specific")

    # Caregiver-focused
    if "caregiver" in text or "family" in text:
        tags.append("family-friendly")

    # Most CancerCare services are free
    is_free = True
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary"]):
        tags.append("free")
        is_free = True

    return category, list(set(tags)), is_free


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl CancerCare events (support groups, workshops, webinars).

    The site may have JavaScript-rendered content, so we use Playwright.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching CancerCare events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load lazy content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find event containers
            event_selectors = [
                ".event-item",
                ".event-card",
                ".event",
                "[class*='event']",
                ".workshop-item",
                ".program-item",
                "article",
                ".card",
            ]

            events = None
            for selector in event_selectors:
                events = page.query_selector_all(selector)
                if events and len(events) > 0:
                    logger.info(f"Found {len(events)} potential events using selector: {selector}")
                    break

            if not events or len(events) == 0:
                logger.info("No event elements found on page")
                # Log page text for debugging
                body_text = page.inner_text("body")
                logger.debug(f"Page text preview: {body_text[:500]}")
                browser.close()
                logger.info(f"CancerCare venue record ensured (ID: {venue_id})")
                return 0, 0, 0

            # Parse each event
            logger.info(f"Parsing {len(events)} event elements")
            for event_elem in events:
                try:
                    event_text = event_elem.inner_text()

                    # Extract title
                    title_elem = event_elem.query_selector("h1, h2, h3, h4, .title, [class*='title']")
                    if title_elem:
                        title = title_elem.inner_text().strip()
                    else:
                        # Fallback: first line
                        lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                        title = lines[0] if lines else None

                    if not title or len(title) < 3:
                        continue

                    # Extract date
                    date_str = None
                    date_elem = event_elem.query_selector(".date, .event-date, [class*='date'], time")
                    if date_elem:
                        date_str = date_elem.inner_text().strip()

                    # Search in text if not found
                    if not date_str:
                        date_match = re.search(
                            r'([A-Za-z]+\s+\d{1,2}(?:,\s+\d{4})?)',
                            event_text
                        )
                        if not date_match:
                            date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', event_text)
                        if date_match:
                            date_str = date_match.group(1)

                    if not date_str:
                        logger.debug(f"No date found for: {title}")
                        continue

                    start_date = parse_date_string(date_str)
                    if not start_date:
                        logger.debug(f"Could not parse date '{date_str}' for: {title}")
                        continue

                    events_found += 1

                    # Extract time
                    time_str = None
                    time_elem = event_elem.query_selector(".time, .event-time, [class*='time']")
                    if time_elem:
                        time_str = time_elem.inner_text().strip()
                    else:
                        time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM)', event_text, re.IGNORECASE)
                        if time_match:
                            time_str = time_match.group(0)

                    start_time = parse_time_string(time_str) if time_str else None

                    # Extract description
                    description = None
                    desc_elem = event_elem.query_selector(".description, .excerpt, .summary, p")
                    if desc_elem:
                        description = desc_elem.inner_text().strip()
                        if len(description) > 500:
                            description = description[:497] + "..."

                    # Extract event URL
                    link_elem = event_elem.query_selector("a[href]")
                    event_url = EVENTS_URL
                    if link_elem:
                        href = link_elem.get_attribute("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    # Extract image
                    image_url = None
                    img_elem = event_elem.query_selector("img[src]")
                    if img_elem:
                        src = img_elem.get_attribute("src")
                        if src and (src.startswith("http") or src.startswith("/")):
                            image_url = src if src.startswith("http") else BASE_URL + src

                    # Determine category and tags
                    category, tags, is_free = determine_category_and_tags(title, description or "")

                    # Generate content hash
                    content_hash = generate_content_hash(title, "CancerCare", start_date)

                    # Check if already exists
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        logger.debug(f"Event already exists: {title}")
                        continue

                    # Create event record
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
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free",
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": image_url,
                        "raw_text": event_text[:500] if event_text else None,
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
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.warning(f"Error parsing event element: {e}")
                    continue

            browser.close()

        logger.info(
            f"CancerCare crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching CancerCare events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl CancerCare: {e}")
        raise

    return events_found, events_new, events_updated
