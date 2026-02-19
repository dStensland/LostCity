"""
Crawler for Women's Resource Center to End Domestic Violence (wrcdv.org).

WRCDV is Georgia's oldest and largest domestic violence program, serving DeKalb
County and metro Atlanta since 1977. Provides crisis intervention, emergency
shelter, legal advocacy, support groups, and community education.

24/7 Crisis Hotline: 404-688-9436

Events include:
- Dating violence prevention workshops for youth
- Community education events on domestic violence awareness
- Support groups for survivors
- Professional training for first responders and social workers
- Fundraising galas and community outreach events

STRATEGY:
- Scrape the Wix-based events page at /events
- REQUIRES Playwright (JavaScript-rendered Wix platform)
- May need to inspect network requests for Wix event data (window.viewerModel)
- Extract events from rendered page if structured selectors fail
- Tag appropriately: domestic-violence, crisis-support, women, safety, education
- Most events are free community education/support

Category mapping:
- "education" for workshops and prevention programs
- "community" for support groups and outreach events
- "learning" for professional training
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.wrcdv.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Women's Resource Center to End Domestic Violence",
    "slug": "wrcdv",
    "address": "660 DeKalb Medical Pkwy",
    "neighborhood": "Lithonia",
    "city": "Lithonia",
    "state": "GA",
    "zip": "30058",
    "lat": 33.7072,
    "lng": -84.1052,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    # Note: vibes are for venue atmosphere/amenities, not program types
    # Tags on events will capture domestic-violence, crisis-support, etc.
}


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '6pm', '12:30pm', '9:00 AM - 1:00 PM'
    """
    try:
        time_str = time_str.strip().upper()

        # If it's a range, extract the first time
        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

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


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = ["domestic-violence", "crisis-support", "women"]

    # Support groups
    if any(word in text for word in ["support group", "survivors", "healing", "recovery"]):
        category = "community"
        tags.extend(["support-group", "mental-health", "healing"])

    # Youth/teen prevention programs
    elif any(word in text for word in ["dating violence", "teen", "youth", "prevention", "healthy relationships"]):
        category = "education"
        tags.extend(["youth", "prevention", "education", "safety"])

    # Professional training
    elif any(word in text for word in ["training", "professional", "first responder", "social worker", "ceu"]):
        category = "learning"
        tags.extend(["training", "professional-development", "advocacy"])

    # Community education workshops
    elif any(word in text for word in ["workshop", "education", "awareness", "seminar", "presentation"]):
        category = "education"
        tags.extend(["workshop", "education", "awareness"])

    # Fundraisers and galas
    elif any(word in text for word in ["gala", "fundraiser", "benefit", "auction", "dinner"]):
        category = "community"
        tags.extend(["fundraiser", "charity"])

    # Outreach and advocacy events
    elif any(word in text for word in ["outreach", "advocacy", "awareness", "purple ribbon", "october"]):
        category = "community"
        tags.extend(["advocacy", "awareness", "outreach"])

    # Default to community
    else:
        category = "community"

    # Only mark free when explicitly stated
    is_free = False
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary"]):
        is_free = True
        tags.append("free")
    elif any(word in text for word in ["ticket", "$", "donation", "gala", "fundraiser"]):
        is_free = False

    # Add safety and empowerment tags
    if any(word in text for word in ["safety", "safety plan", "restraining order", "legal"]):
        tags.append("safety")
    if any(word in text for word in ["empower", "empowerment", "strength", "resilience"]):
        tags.append("empowerment")

    return category, list(set(tags)), is_free


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl WRCDV events using Playwright.

    The site uses Wix platform which requires JavaScript rendering.
    May need to check network requests or extract from window.viewerModel.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching WRCDV events with Playwright: {EVENTS_URL}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)

            # Wait for Wix to render content
            page.wait_for_timeout(5000)

            # Scroll to load any lazy-loaded content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            html_content = page.content()
            soup = BeautifulSoup(html_content, "html.parser")
            browser.close()

        # Look for Wix event list items
        events = soup.select('li[data-hook="event-list-item"]')

        if not events or len(events) == 0:
            logger.info("No event list items found")
            logger.info(f"WRCDV venue record ensured (ID: {venue_id})")
            return 0, 0, 0

        logger.info(f"Found {len(events)} event list items")

        # Parse each event
        today = datetime.now().date()
        seen_events = set()

        for event_elem in events:
            try:
                # Extract title using Wix data-hook
                title_elem = event_elem.select_one('[data-hook="ev-list-item-title"]')
                if not title_elem:
                    logger.debug("No title element found in event item")
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Extract date using Wix data-hook
                date_elem = event_elem.select_one('[data-hook="ev-date"], [data-hook="ev-date-tbd"]')
                if not date_elem:
                    logger.debug(f"No date element found for: {title}")
                    continue

                date_str = date_elem.get_text(strip=True)

                if not date_str:
                    logger.debug(f"No date found for: {title}")
                    continue

                # Parse date
                start_date = parse_human_date(date_str)
                if not start_date:
                    logger.debug(f"Could not parse date '{date_str}' for: {title}")
                    continue

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < today:
                        logger.debug(f"Skipping past event: {title} on {start_date}")
                        continue
                except ValueError:
                    continue

                # Dedupe check
                event_key = f"{title}|{start_date}"
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)

                events_found += 1

                # Extract time
                time_str = None
                time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', event_elem.get_text())
                if time_match:
                    time_str = time_match.group(0)

                start_time = None
                if time_str:
                    start_time = parse_time_string(time_str)

                # Extract description - may be in collapsed section
                description = None
                # Note: Wix events often don't show description in list view
                # Could be extracted by clicking into detail view, but skip for now

                # Extract image from Wix img element
                image_url = None
                img_elem = event_elem.select_one('img[alt]')
                if img_elem:
                    image_url = img_elem.get("src")

                # Extract event URL from RSVP/details button
                link_elem = event_elem.select_one('[data-hook="ev-rsvp-button"]')
                event_url = EVENTS_URL
                if link_elem:
                    href = link_elem.get("href")
                    if href:
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href

                # Determine category and tags
                category, tags, is_free = determine_category_and_tags(title, description or "")

                # Generate content hash for deduplication
                content_hash = generate_content_hash(
                    title, "Women's Resource Center to End Domestic Violence", start_date
                )

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
                    "price_note": "Free" if is_free else None,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": None,
                    "image_url": image_url,
                    "raw_text": event_elem.get_text()[:500],
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    logger.debug(f"Event updated: {title}")
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{title}': {e}")

            except Exception as e:
                logger.warning(f"Error parsing event element: {e}")
                continue

        logger.info(
            f"WRCDV crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching WRCDV events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl WRCDV: {e}")
        raise

    return events_found, events_new, events_updated
