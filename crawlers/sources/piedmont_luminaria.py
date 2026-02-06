"""
Crawler for Piedmont Luminaria (piedmontluminaria.org).

Annual oncology gala benefiting Piedmont Healthcare's cancer programs.
Features luminary ceremony, dinner, and fundraising activities.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.piedmontluminaria.org"

VENUE_DATA = {
    "name": "Piedmont Luminaria Event",
    "slug": "piedmont-luminaria",
    "address": "1968 Peachtree Road NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "event_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    date_text = date_text.strip()

    patterns = [
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            month, day, year = match.groups()
            try:
                month_str = month[:3] if len(month) > 3 else month
                dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont Luminaria gala information."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Piedmont Luminaria: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")
            page_title = page.title()

            # Get venue from page if specified
            venue_id = get_or_create_venue(VENUE_DATA)
            venue_name = VENUE_DATA["name"]

            # Look for location info
            location_match = re.search(r"(held at|location[:\s]+|venue[:\s]+)([^\.]+)", body_text, re.IGNORECASE)
            if location_match:
                location_text = location_match.group(2).strip()
                if location_text and len(location_text) < 100:
                    # Update venue with actual location
                    venue_data = {
                        **VENUE_DATA,
                        "name": location_text if "piedmont" not in location_text.lower() else VENUE_DATA["name"],
                    }
                    venue_id = get_or_create_venue(venue_data)
                    venue_name = venue_data["name"]

            # Extract event information
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            skip_items = [
                "home", "about", "contact", "menu", "donate", "sponsor",
                "tickets", "register", "buy", "cart",
            ]

            # Look for the main event date
            start_date = None
            title = "Piedmont Luminaria"
            description = None

            for i, line in enumerate(lines):
                # Look for date patterns
                date_match = re.search(
                    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:-\d{1,2})?,?\s+\d{4}",
                    line,
                    re.IGNORECASE
                )

                if date_match and not start_date:
                    date_text = date_match.group(0)
                    date_text = re.sub(r"-\d{1,2}", "", date_text)
                    start_date = parse_date(date_text)

                    if start_date:
                        try:
                            event_date = datetime.strptime(start_date, "%Y-%m-%d")
                            if event_date.date() < datetime.now().date():
                                start_date = None
                                continue
                        except ValueError:
                            start_date = None
                            continue

                # Look for description
                if len(line) > 100 and not description:
                    if "cancer" in line.lower() or "piedmont" in line.lower() or "luminaria" in line.lower():
                        description = line[:500]

            # If we found an event
            if start_date:
                events_found += 1

                content_hash = generate_content_hash(
                    title, venue_name, start_date
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                else:
                    if not description:
                        description = "Annual Piedmont Luminaria gala benefiting Piedmont Healthcare's cancer programs. Features a luminary ceremony, dinner, and silent auction."

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "portal_id": portal_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": "18:00",  # Typical gala start time
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": "gala",
                        "tags": ["piedmont", "healthcare", "cancer", "gala", "fundraiser", "charity", "formal"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Tickets required - see website for pricing",
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.9,
                        "is_recurring": True,
                        "recurrence_rule": "YEARLY",
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(
            f"Piedmont Luminaria crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Luminaria: {e}")
        raise

    return events_found, events_new, events_updated
