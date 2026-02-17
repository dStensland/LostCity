"""
Crawler for Illuminarium Atlanta (illuminarium.com/atlanta).
Immersive art and entertainment experiences with shows, yoga, and special events.
Uses JavaScript rendering - requires Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.illuminarium.com"
ATLANTA_URL = f"{BASE_URL}/atlanta"

VENUE_DATA = {
    "name": "Illuminarium Atlanta",
    "slug": "illuminarium-atlanta",
    "address": "550 Somerset Terrace NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7714,
    "lng": -84.3654,
    "venue_type": "entertainment",
    "spot_type": "arts",
    "website": ATLANTA_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date or date range from various formats.

    Examples:
    - "February 21, 2026"
    - "Monday, February 21, 2026"
    - "Feb 21 - Feb 23, 2026"
    - "2026-02-21"
    """
    current_year = datetime.now().year

    # ISO format: "2026-02-21"
    match = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_text)
    if match:
        return date_text[:10], None

    # Single date with optional day of week: "Monday, February 21, 2026"
    match = re.match(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,\s]*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            month_name = match.group(1)
            day = match.group(2)
            year = match.group(3)
            if len(month_name) > 3:
                dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
            else:
                dt = datetime.strptime(f"{month_name} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    # Date range: "Feb 21 - Feb 23, 2026"
    match = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*-\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            start_month = match.group(1)
            start_day = match.group(2)
            end_month = match.group(3) if match.group(3) else start_month
            end_day = match.group(4)
            year = match.group(5)

            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%b %d %Y")

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Date without year
    match = re.match(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,\s]*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            month_name = match.group(1)
            day = match.group(2)
            if len(month_name) > 3:
                dt = datetime.strptime(f"{month_name} {day} {current_year}", "%B %d %Y")
            else:
                dt = datetime.strptime(f"{month_name} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '10:00 AM', '10:00pm', '22:00' or similar format."""
    # 12-hour format with AM/PM
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    # 24-hour format
    match = re.search(r"(\d{2}):(\d{2})", time_text)
    if match:
        return f"{match.group(1)}:{match.group(2)}"

    return None


def determine_category(title: str, description: str) -> tuple[str, Optional[str]]:
    """
    Determine event category and subcategory based on content.
    Returns (category, subcategory)
    """
    text = f"{title} {description}".lower()

    # Check for specific event types
    if any(word in text for word in ["yoga", "meditation", "wellness", "fitness"]):
        return "wellness", None
    elif any(word in text for word in ["viewing party", "watch party", "screening"]):
        return "film", None
    elif any(word in text for word in ["private event", "corporate", "rental"]):
        return "community", None
    elif any(word in text for word in ["space", "wild", "safari", "amplified", "ocean", "show", "experience"]):
        # Core immersive shows
        if any(word in text for word in ["family", "kids", "children"]):
            return "family", None
        else:
            return "art", "installation"

    # Default to art/experience
    return "art", "installation"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Illuminarium Atlanta events using Playwright."""
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Illuminarium Atlanta: {ATLANTA_URL}")

            # Navigate to Atlanta page
            page.goto(ATLANTA_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)

            # Wait for content to load
            try:
                page.wait_for_selector("a[href*='tickets'], a[href*='events'], [class*='show'], [class*='experience'], [class*='event']", timeout=10000)
            except Exception:
                logger.warning("Could not find event selectors, continuing anyway")

            # Extract images
            image_map = extract_images_from_page(page)

            # Scroll to load all content (handle lazy loading)
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

                # Try to click "Load More" or "View All" button if present
                try:
                    load_more = page.query_selector("button:has-text('Load More'), button:has-text('View All'), button:has-text('Show More'), a:has-text('More')")
                    if load_more and load_more.is_visible():
                        load_more.click()
                        page.wait_for_timeout(2000)
                except Exception:
                    pass

            # Look for shows/experiences
            # Try multiple selector patterns
            show_containers = page.query_selector_all(
                '.show, .experience, .event, .card, [class*="show"], [class*="experience"], [class*="event-"], [class*="program"]'
            )

            logger.info(f"Found {len(show_containers)} potential show/event containers")

            for container in show_containers:
                try:
                    # Find title
                    title_elem = container.query_selector('h1, h2, h3, h4, .title, .name, [class*="title"], [class*="name"]')
                    if not title_elem:
                        continue

                    title_text = title_elem.inner_text().strip()

                    # Skip if title is too short or looks like navigation
                    if len(title_text) < 3 or title_text.lower() in ['shows', 'experiences', 'events', 'upcoming', 'book now', 'buy tickets']:
                        continue

                    # Find description
                    desc_elem = container.query_selector('.description, .summary, .content, p, [class*="description"], [class*="summary"]')
                    description = desc_elem.inner_text().strip() if desc_elem else ""

                    if not description:
                        # Try to get broader context from container
                        description = container.inner_text().strip()

                    if len(description) > 500:
                        description = description[:497] + "..."

                    if not description or len(description) < 10:
                        description = f"{title_text} - Immersive experience at Illuminarium Atlanta"

                    # Look for dates - this venue may have ongoing shows rather than specific dates
                    date_elem = container.query_selector('.date, .event-date, time, [class*="date"], [datetime]')

                    start_date = None
                    end_date = None

                    if date_elem:
                        date_text = date_elem.inner_text().strip()
                        # Also check for datetime attribute
                        datetime_attr = date_elem.get_attribute("datetime")
                        if datetime_attr:
                            date_text = datetime_attr

                        start_date, end_date = parse_date_range(date_text)

                    # For ongoing shows without specific dates, use current date as start
                    if not start_date:
                        # Check if this looks like an ongoing show (Space, Wild, etc.)
                        if any(word in title_text.lower() for word in ["space", "wild", "safari", "amplified", "ocean"]):
                            # Use today as start date for ongoing shows
                            start_date = datetime.now().strftime("%Y-%m-%d")
                            logger.debug(f"Using current date for ongoing show: {title_text}")
                        else:
                            # Try to find date in nearby text
                            nearby_text = container.inner_text()
                            for line in nearby_text.split("\n"):
                                start_date, end_date = parse_date_range(line.strip())
                                if start_date:
                                    break

                    # Skip if we still don't have a date
                    if not start_date:
                        logger.debug(f"No date found for: {title_text}")
                        continue

                    events_found += 1

                    # Find time
                    time_elem = container.query_selector('.time, .event-time, [class*="time"], [class*="showtime"]')
                    time_text = time_elem.inner_text().strip() if time_elem else ""
                    start_time = parse_time(time_text) if time_text else None

                    # Determine category
                    category, subcategory = determine_category(title_text, description)

                    # Check for pricing info
                    text_content = f"{title_text} {description}".lower()
                    is_free = any(word in text_content for word in ["free", "no cost", "no charge", "complimentary"])

                    # Find ticket URL
                    ticket_url = None
                    ticket_link = container.query_selector('a[href*="ticket"], a[href*="book"], a[href*="buy"]')
                    if ticket_link:
                        ticket_url = ticket_link.get_attribute('href')
                        if ticket_url and ticket_url.startswith('/'):
                            ticket_url = BASE_URL + ticket_url

                    if not ticket_url:
                        ticket_url = ATLANTA_URL

                    # Find image
                    image_url = None
                    img_elem = container.query_selector('img')
                    if img_elem:
                        image_url = img_elem.get_attribute('src')
                        if image_url and image_url.startswith('/'):
                            image_url = BASE_URL + image_url
                    if not image_url:
                        image_url = image_map.get(title_text)

                    # Generate content hash
                    content_hash = generate_content_hash(title_text, VENUE_DATA["name"], start_date)

                    # Check if exists

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title_text,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": ["immersive", "experience", "family-friendly", "beltline", "poncey-highland"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": ATLANTA_URL,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": f"{title_text} - {start_date}",
                        "extraction_confidence": 0.75,
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
                        logger.info(f"Added: {title_text} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title_text}': {e}")

                except Exception as e:
                    logger.debug(f"Error processing show container: {e}")
                    continue

            # Also check for special events page if it exists
            try:
                events_link = page.query_selector('a[href*="events"], a[href*="special"]')
                if events_link:
                    events_url = events_link.get_attribute('href')
                    if events_url:
                        if events_url.startswith('/'):
                            events_url = BASE_URL + events_url

                        logger.info(f"Checking special events page: {events_url}")
                        page.goto(events_url, wait_until='domcontentloaded', timeout=30000)
                        page.wait_for_timeout(2000)

                        # Look for event items on this page
                        event_items = page.query_selector_all('.event, .event-item, [class*="event-"], article, .card')

                        for item in event_items:
                            try:
                                title_elem = item.query_selector('h1, h2, h3, h4, .title')
                                if not title_elem:
                                    continue

                                title_text = title_elem.inner_text().strip()
                                if len(title_text) < 3:
                                    continue

                                # Find date
                                date_elem = item.query_selector('.date, .event-date, time, [class*="date"]')
                                if not date_elem:
                                    continue

                                date_text = date_elem.inner_text().strip()
                                start_date, end_date = parse_date_range(date_text)

                                if not start_date:
                                    continue

                                events_found += 1

                                # Find description
                                desc_elem = item.query_selector('.description, p, [class*="description"]')
                                description = desc_elem.inner_text().strip() if desc_elem else ""
                                if len(description) > 500:
                                    description = description[:497] + "..."
                                if not description:
                                    description = f"{title_text} at Illuminarium Atlanta"

                                # Find time
                                time_elem = item.query_selector('.time, .event-time, [class*="time"]')
                                time_text = time_elem.inner_text().strip() if time_elem else ""
                                start_time = parse_time(time_text) if time_text else None

                                # Determine category
                                category, subcategory = determine_category(title_text, description)

                                # Generate content hash
                                content_hash = generate_content_hash(title_text, VENUE_DATA["name"], start_date)

                                # Check if exists
                                existing = find_event_by_hash(content_hash)
                                if existing:
                                    smart_update_existing_event(existing, event_record)
                                    events_updated += 1
                                    continue

                                # Check for pricing
                                text_content = f"{title_text} {description}".lower()
                                is_free = any(word in text_content for word in ["free", "no cost", "complimentary"])

                                # Find ticket URL
                                ticket_url = None
                                ticket_link = item.query_selector('a[href*="ticket"], a[href*="book"]')
                                if ticket_link:
                                    ticket_url = ticket_link.get_attribute('href')
                                    if ticket_url and ticket_url.startswith('/'):
                                        ticket_url = BASE_URL + ticket_url
                                if not ticket_url:
                                    ticket_url = events_url

                                # Find image
                                image_url = None
                                img_elem = item.query_selector('img')
                                if img_elem:
                                    image_url = img_elem.get_attribute('src')
                                    if image_url and image_url.startswith('/'):
                                        image_url = BASE_URL + image_url

                                # Build event record
                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title_text,
                                    "description": description,
                                    "start_date": start_date,
                                    "start_time": start_time,
                                    "end_date": end_date,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": category,
                                    "subcategory": subcategory,
                                    "tags": ["immersive", "experience", "family-friendly", "beltline", "poncey-highland"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": is_free,
                                    "source_url": events_url,
                                    "ticket_url": ticket_url,
                                    "image_url": image_url,
                                    "raw_text": f"{title_text} - {start_date}",
                                    "extraction_confidence": 0.80,
                                    "is_recurring": False,
                                    "recurrence_rule": None,
                                    "content_hash": content_hash,
                                }

                                try:
                                    insert_event(event_record)
                                    events_new += 1
                                    logger.info(f"Added special event: {title_text} on {start_date}")
                                except Exception as e:
                                    logger.error(f"Failed to insert event '{title_text}': {e}")

                            except Exception as e:
                                logger.debug(f"Error processing special event: {e}")
                                continue

            except Exception as e:
                logger.debug(f"No special events page or error accessing it: {e}")

            browser.close()

        logger.info(
            f"Illuminarium Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Illuminarium Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
