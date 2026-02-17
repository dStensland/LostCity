"""
Crawler for Alzheimer's Association Georgia Chapter (alz.org/georgia).

The Georgia chapter provides critical support for people affected by Alzheimer's and dementia:
- Support groups for caregivers and families
- Educational workshops and seminars
- Community programs and resources
- Walk to End Alzheimer's and fundraising events
- Professional training for healthcare providers

Very relevant to hospital patients and caregivers (core Emory portal audience).

TECHNICAL NOTE:
The events page uses an embedded Vue.js widget that loads events dynamically.
The widget is protected by modal overlays and may require specific API calls.
Current implementation attempts to extract events from the rendered page.
If no events are found, consider:
1. Checking https://community.alz.org for event API endpoints
2. Using browser automation to interact with the search widget
3. Monitoring network requests to find the events API directly
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alz.org"
GEORGIA_URL = f"{BASE_URL}/georgia"
EVENTS_URL = f"{GEORGIA_URL}/events"

VENUE_DATA = {
    "name": "Alzheimer's Association Georgia Chapter",
    "slug": "alzheimers-association-georgia",
    "address": "41 Perimeter Center East NE, Suite 550",
    "neighborhood": "Dunwoody",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30346",
    "lat": 33.9251,
    "lng": -84.3465,
    "venue_type": "nonprofit_hq",
    "spot_type": "nonprofit_hq",
    "website": GEORGIA_URL,
    "vibes": ["family-friendly", "wheelchair-accessible"],
}


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse various date formats from Alzheimer's Association events.
    Examples: 'February 15, 2026', 'Feb 15, 2026', 'Tue, Feb 15', '2/15/2026'
    """
    try:
        # Clean up the string
        date_str = date_str.strip()

        # Remove day name if present (e.g., "Tue, Feb 15")
        date_str = re.sub(r'^[A-Za-z]+,?\s+', '', date_str)

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

        # Try "MM/DD/YYYY" format
        match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")

        # Try "MM/DD/YY" format
        match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{2})', date_str)
        if match:
            month, day, year = match.groups()
            full_year = f"20{year}"
            dt = datetime.strptime(f"{month}/{day}/{full_year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date '{date_str}': {e}")

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '6pm', '12:30pm', '1:00 PM ET'
    """
    try:
        time_str = time_str.strip().upper()
        # Remove timezone indicators
        time_str = re.sub(r'\s+(ET|EST|EDT|CT|CST|CDT|PT|PST|PDT)$', '', time_str)

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


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    # Support groups (specific category for them)
    if any(word in text for word in ["support group", "caregiver support", "family support"]):
        return "support_group"

    # Educational events
    if any(word in text for word in ["workshop", "seminar", "education", "class", "training", "lecture"]):
        return "learning"

    # Walk to End Alzheimer's and fundraising
    if any(word in text for word in ["walk to end", "fundrais", "gala", "benefit", "charity"]):
        return "fitness"

    # Conferences and professional events
    if any(word in text for word in ["conference", "symposium", "forum", "summit"]):
        return "learning"

    # Wellness/health programs
    if any(word in text for word in ["wellness", "health", "therapy", "care"]):
        return "wellness"

    # Default to community
    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    # Support groups
    if any(word in text for word in ["support group", "caregiver support"]):
        tags.append("community")

    # Family/kids
    if any(word in text for word in ["family", "families"]):
        tags.append("family-friendly")
    if "caregiver" in text or "caretaker" in text:
        tags.append("adults")

    # Educational programs
    if any(word in text for word in ["workshop", "class", "training"]):
        tags.append("educational")
    if "hands-on" in text or "interactive" in text:
        tags.append("hands-on")

    # Walk to End Alzheimer's
    if "walk to end" in text or "walk to end alzheimer" in text:
        tags.extend(["outdoor", "activism"])

    # Virtual events
    if any(word in text for word in ["virtual", "online", "zoom", "webinar"]):
        tags.append("educational")

    # Free events
    if any(word in text for word in ["free", "no cost", "no charge"]):
        tags.append("free")

    # Volunteer opportunities
    if "volunteer" in text:
        tags.append("volunteer")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary", "free admission"]):
        return True

    # Support groups are typically free
    if "support group" in text:
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "donate", "fundrais"]):
        # But some events say "free admission"
        if "free admission" in text or "free entry" in text or "no cost" in text:
            return True
        return False

    # Most educational programs are free
    return True


def should_skip_event(title: str) -> bool:
    """
    Check if event should be skipped.
    Skip fundraising walks without specific dates or generic program announcements.
    """
    title_lower = title.lower()

    # Skip vague/placeholder titles
    skip_patterns = [
        'tbd',
        'tba',
        'to be announced',
        'coming soon',
        'save the date',
    ]

    for pattern in skip_patterns:
        if pattern == title_lower.strip():
            return True

    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Alzheimer's Association Georgia Chapter events using Playwright.

    The site has an events page with JavaScript-rendered event listings.
    Focus on support groups, educational workshops, and community programs.
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

            logger.info(f"Fetching Alzheimer's Association Georgia events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find event containers - common patterns for Alzheimer's Association site
            event_selectors = [
                ".event-item",
                ".event-card",
                "[class*='event']",
                "article",
                ".card",
                ".list-item",
                ".views-row",
            ]

            events = None
            for selector in event_selectors:
                events = page.query_selector_all(selector)
                if events and len(events) > 0:
                    logger.info(f"Found {len(events)} potential events using selector: {selector}")
                    break

            if not events or len(events) == 0:
                logger.warning("No event elements found on page, trying alternate approach")
                # Try to extract from page body text
                body_text = page.inner_text("body")
                logger.debug(f"Page text preview: {body_text[:500]}")

            # If we found event elements, parse them
            if events and len(events) > 0:
                logger.info(f"Parsing {len(events)} event elements")
                for event_elem in events:
                    try:
                        event_text = event_elem.inner_text()
                        event_html = event_elem.inner_html()

                        # Extract title (usually first/largest text or h2/h3)
                        title_elem = event_elem.query_selector("h1, h2, h3, h4, .title, .event-title, [class*='title'], a[href*='event']")
                        if title_elem:
                            title = title_elem.inner_text().strip()
                        else:
                            # Fallback: first line
                            lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                            title = lines[0] if lines else None

                        if not title or len(title) < 3:
                            continue

                        # Skip non-events
                        if should_skip_event(title):
                            logger.debug(f"Skipping placeholder event: {title}")
                            continue

                        # Look for date and time in text
                        date_str = None
                        time_str = None

                        # Try to find date elements
                        date_elem = event_elem.query_selector(".date, .event-date, [class*='date'], time, [class*='when']")
                        if date_elem:
                            date_str = date_elem.inner_text().strip()

                        # Try to find time elements
                        time_elem = event_elem.query_selector(".time, .event-time, [class*='time']")
                        if time_elem:
                            time_str = time_elem.inner_text().strip()

                        # If not found in elements, search in text
                        if not date_str:
                            # Look for date patterns in text
                            date_match = re.search(r'([A-Za-z]+\s+\d{1,2}(?:,\s+\d{4})?)', event_text)
                            if not date_match:
                                date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', event_text)
                            if date_match:
                                date_str = date_match.group(1)

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
                        desc_elem = event_elem.query_selector(".description, .event-description, .excerpt, .summary, p")
                        if desc_elem:
                            description = desc_elem.inner_text().strip()
                        elif event_text:
                            # Use event text as description (clean up by removing title and date/time)
                            desc_lines = event_text.split("\n")
                            desc_lines = [l.strip() for l in desc_lines if l.strip() and l.strip() != title]
                            if desc_lines and len(desc_lines) > 1:
                                description = " ".join(desc_lines[:3])  # Take first few lines

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
                                else:
                                    event_url = GEORGIA_URL + "/" + href

                        # Look for image
                        image_url = None
                        img_elem = event_elem.query_selector("img[src]")
                        if img_elem:
                            src = img_elem.get_attribute("src")
                            if src and (src.startswith("http") or src.startswith("/")):
                                image_url = src if src.startswith("http") else BASE_URL + src

                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "Alzheimer's Association Georgia Chapter", start_date
                        )


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

        logger.info(
            f"Alzheimer's Association Georgia crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Alzheimer's Association Georgia: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Alzheimer's Association Georgia: {e}")
        raise

    return events_found, events_new, events_updated
