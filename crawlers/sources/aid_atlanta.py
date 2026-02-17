"""
Crawler for AID Atlanta public health and community events.
https://www.aidatlanta.org/events/

AID Atlanta is a critical HIV/AIDS service organization serving Atlanta.
They host public events including:
- Free HIV/STI testing events
- PrEP enrollment events
- Community health programs
- Fundraisers (AIDS Walk Atlanta, Pride Run, etc.)
- Educational workshops

Language is kept respectful and non-stigmatizing.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.aidatlanta.org"
EVENTS_URL = f"{BASE_URL}/events/"

# Main headquarters venue
VENUE_DATA = {
    "name": "AID Atlanta",
    "slug": "aid-atlanta",
    "address": "1438 W Peachtree St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7920,
    "lng": -84.3835,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["lgbtq-friendly", "community", "health-services"],
}


def parse_date_and_time(date_text: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse date and time from The Events Calendar format.

    Examples:
    - "January 25, 2025 @ 6:30 pm - 10:30 pm"
    - "February 14, 2026 @ 2:00 pm"
    - "September 28, 2024 @ 10:00 am - 2:30 pm"

    Returns:
        Tuple of (start_date, start_time, end_time)
    """
    if not date_text:
        return None, None, None

    current_year = datetime.now().year

    # Remove extra whitespace
    date_text = " ".join(date_text.split())

    # Split date from time(s) using @ separator
    parts = re.split(r'\s+@\s+', date_text)
    if len(parts) < 1:
        return None, None, None

    date_part = parts[0].strip()
    time_part = parts[1].strip() if len(parts) > 1 else None

    # Parse date: "January 25, 2025" or "January 25"
    date_match = re.match(
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?',
        date_part,
        re.IGNORECASE
    )

    if not date_match:
        return None, None, None

    month_name = date_match.group(1)
    day = int(date_match.group(2))
    year = int(date_match.group(3)) if date_match.group(3) else current_year

    try:
        dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
        # If no year was specified and date is in the past, assume next year
        if not date_match.group(3) and dt.date() < datetime.now().date():
            dt = datetime.strptime(f"{month_name} {day} {year + 1}", "%B %d %Y")

        start_date = dt.strftime("%Y-%m-%d")
    except ValueError:
        return None, None, None

    # Parse time(s) if present
    start_time = None
    end_time = None

    if time_part:
        # Handle time range: "6:30 pm - 10:30 pm"
        time_range_match = re.match(
            r'(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)',
            time_part,
            re.IGNORECASE
        )
        if time_range_match:
            # Start time
            hour1 = int(time_range_match.group(1))
            minute1 = int(time_range_match.group(2))
            period1 = time_range_match.group(3).lower()

            if period1 == 'pm' and hour1 != 12:
                hour1 += 12
            elif period1 == 'am' and hour1 == 12:
                hour1 = 0

            start_time = f"{hour1:02d}:{minute1:02d}"

            # End time
            hour2 = int(time_range_match.group(4))
            minute2 = int(time_range_match.group(5))
            period2 = time_range_match.group(6).lower()

            if period2 == 'pm' and hour2 != 12:
                hour2 += 12
            elif period2 == 'am' and hour2 == 12:
                hour2 = 0

            end_time = f"{hour2:02d}:{minute2:02d}"
        else:
            # Single time: "6:30 pm"
            time_match = re.match(
                r'(\d{1,2}):(\d{2})\s*(am|pm)',
                time_part,
                re.IGNORECASE
            )
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2))
                period = time_match.group(3).lower()

                if period == 'pm' and hour != 12:
                    hour += 12
                elif period == 'am' and hour == 12:
                    hour = 0

                start_time = f"{hour:02d}:{minute:02d}"

    return start_date, start_time, end_time


def extract_venue_name(venue_text: str) -> Optional[str]:
    """
    Extract clean venue name from venue text.

    Example: "The Stave Room 199 Armour Drive, Atlanta" -> "The Stave Room"
    """
    if not venue_text:
        return None

    # Split on address-like patterns (street numbers)
    match = re.match(r'^(.+?)\s+\d+\s+\w+', venue_text)
    if match:
        return match.group(1).strip()

    # If no address, return the whole thing
    return venue_text.strip()


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Categorize AID Atlanta events based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["aid-atlanta", "community", "health"]

    # Testing events
    if any(kw in text for kw in ["testing", "hiv test", "sti test", "free test"]):
        tags.extend(["free", "testing", "health-screening"])
        return "wellness", "health_screening", tags

    # PrEP/PEP enrollment
    if any(kw in text for kw in ["prep", "pep", "enrollment"]):
        tags.extend(["prep", "prevention", "lgbtq-health"])
        return "wellness", "health_program", tags

    # Fundraisers (AIDS Walk, Pride Run, Casino night, etc.)
    if any(kw in text for kw in ["walk", "run", "5k", "race", "fundraiser", "casino", "gala"]):
        tags.extend(["fundraiser", "charity"])
        if "walk" in text or "run" in text or "5k" in text:
            tags.append("fitness")
            return "sports", "charity_run", tags
        return "community", "fundraiser", tags

    # Educational/Workshop
    if any(kw in text for kw in ["workshop", "training", "education", "seminar", "class"]):
        tags.extend(["education", "workshop"])
        return "wellness", "workshop", tags

    # Pride-related
    if any(kw in text for kw in ["pride", "lgbtq", "lgbtqia"]):
        tags.extend(["lgbtq", "pride"])
        return "community", "pride", tags

    # Community meetings (CAB, etc.)
    if any(kw in text for kw in ["meeting", "advisory", "board", "committee"]):
        tags.extend(["meeting", "community-organizing"])
        return "community", "meeting", tags

    # Special days (World AIDS Day, International Condom Day, etc.)
    if any(kw in text for kw in ["world aids day", "condom day", "hiv awareness"]):
        tags.extend(["awareness", "observance"])
        return "community", "awareness", tags

    # Default to community health event
    return "wellness", "community_health", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl AID Atlanta events using Playwright (The Events Calendar uses JS)."""
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

            logger.info(f"Fetching AID Atlanta events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load any lazy-loaded content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images and event links
            image_map = extract_images_from_page(page)
            event_links = extract_event_links(page, BASE_URL)

            # The Events Calendar uses article elements with tribe-events classes
            # Could be upcoming (.tribe-events-calendar-list__event) or past (.tribe-events-calendar-latest-past__event)
            event_articles = page.query_selector_all(
                "article.tribe-events-calendar-list__event, "
                "article.tribe-events-calendar-latest-past__event"
            )

            if not event_articles:
                logger.info("No events found on page")
                browser.close()
                return events_found, events_new, events_updated

            logger.info(f"Found {len(event_articles)} event articles")

            seen_events = set()
            today = datetime.now().date()

            for article in event_articles:
                try:
                    # Extract title
                    title_elem = article.query_selector(
                        ".tribe-events-calendar-list__event-title-link, "
                        ".tribe-events-calendar-latest-past__event-title-link"
                    )
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    if not title:
                        continue

                    # Extract event URL
                    event_url = title_elem.get_attribute("href")
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    # Extract date and time
                    datetime_elem = article.query_selector(
                        ".tribe-events-calendar-list__event-datetime, "
                        ".tribe-events-calendar-latest-past__event-datetime"
                    )
                    if not datetime_elem:
                        logger.debug(f"No datetime found for: {title}")
                        continue

                    datetime_text = datetime_elem.inner_text().strip()
                    start_date, start_time, end_time = parse_date_and_time(datetime_text)

                    if not start_date:
                        logger.debug(f"Could not parse date for: {title}")
                        continue

                    # Skip past events (only keep upcoming or today)
                    try:
                        event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                        if event_date < today:
                            logger.debug(f"Skipping past event: {title} on {start_date}")
                            continue
                    except ValueError:
                        continue

                    # Extract description
                    desc_elem = article.query_selector(
                        ".tribe-events-calendar-list__event-description, "
                        ".tribe-events-calendar-latest-past__event-description"
                    )
                    description = desc_elem.inner_text().strip() if desc_elem else None

                    # Extract venue (may be different from AID Atlanta HQ)
                    venue_elem = article.query_selector(
                        ".tribe-events-calendar-list__event-venue-title, "
                        ".tribe-events-calendar-latest-past__event-venue-title"
                    )
                    venue_text = venue_elem.inner_text().strip() if venue_elem else None

                    # Use custom venue if different from main office
                    # For now, we'll just note it in the description/tags
                    # In the future, we could create separate venue records
                    if venue_text:
                        venue_name = extract_venue_name(venue_text)
                        if venue_name and venue_name.lower() not in ["aid atlanta", "aidatlanta"]:
                            # Event is at external venue - note it
                            if description:
                                description = f"At {venue_name}. {description}"
                            else:
                                description = f"At {venue_name}."

                    # Extract image
                    img_elem = article.query_selector("img.tribe-events-calendar-list__event-featured-image")
                    image_url = None
                    if img_elem:
                        image_url = (
                            img_elem.get_attribute("src") or
                            img_elem.get_attribute("data-src")
                        )

                    # Fall back to image map
                    if not image_url and title in image_map:
                        image_url = image_map[title]

                    # Dedupe
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, VENUE_DATA["name"], start_date
                    )

                    # Check for existing

                    # Categorize event
                    category, subcategory, tags = categorize_event(
                        title, description or ""
                    )

                    # Determine if free (most community events are free)
                    is_free = any(kw in (description or "").lower() for kw in ["free", "no cost"])

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": description[:1000] if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": 0 if is_free else None,
                        "price_max": 0 if is_free else None,
                        "price_note": "Free" if is_free else None,
                        "is_free": is_free,
                        "source_url": event_url or EVENTS_URL,
                        "ticket_url": event_url or EVENTS_URL,
                        "image_url": image_url,
                        "raw_text": f"{title} {description or ''}"[:500],
                        "extraction_confidence": 0.9,
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
                        logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.debug(f"Failed to parse event article: {e}")
                    continue

            browser.close()

        logger.info(
            f"AID Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl AID Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
