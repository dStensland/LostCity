"""
Crawler for Asian Americans Advancing Justice - Atlanta.
Civil rights organization serving AAPI, NHPI communities.
Covers community events, know-your-rights workshops, citizenship drives, advocacy events.
Site: https://www.advancingjustice-atlanta.org

NOTE: This organization has limited public-facing event calendars.
They primarily run ongoing programs (Georgia Leadership Lab, legal clinics)
rather than one-off public events. This crawler checks for any announced
upcoming community events, workshops, or public programs.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.advancingjustice-atlanta.org"

VENUE_DATA = {
    "name": "Asian Americans Advancing Justice - Atlanta",
    "slug": "advancing-justice-atlanta",
    "address": "5680 Oakbrook Pkwy #148",
    "neighborhood": "Norcross",
    "city": "Norcross",
    "state": "GA",
    "zip": "30093",
    "lat": 33.9271,
    "lng": -84.2132,
    "venue_type": "nonprofit_hq",
    "website": BASE_URL,
    "vibes": [],  # No specific vibes apply from the standard list
}


def parse_date_from_text(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from various text formats.

    Examples:
    - "March 17, 2026"
    - "Applications due March 17"
    - "January 28 @ 6:00 pm"
    """
    current_year = datetime.now().year

    # Month names mapping
    months = {
        "january": "01", "february": "02", "march": "03", "april": "04",
        "may": "05", "june": "06", "july": "07", "august": "08",
        "september": "09", "october": "10", "november": "11", "december": "12",
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "jun": "06", "jul": "07", "aug": "08", "sep": "09",
        "sept": "09", "oct": "10", "nov": "11", "dec": "12",
    }

    # Try to extract date with various patterns
    # Pattern: Month DD, YYYY or Month DD
    date_match = re.search(
        r'\b(january|february|march|april|may|june|july|august|september|october|november|december|'
        r'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b',
        text,
        re.IGNORECASE
    )

    if not date_match:
        return None, None

    month_name = date_match.group(1).lower().replace(".", "")
    day = int(date_match.group(2))
    year = int(date_match.group(3)) if date_match.group(3) else current_year

    # If parsed date is in the past, assume next year
    if month_name in months:
        month = months[month_name]
        parsed_date = datetime(year, int(month), day)
        if parsed_date.date() < datetime.now().date():
            year += 1

        start_date = f"{year}-{month}-{day:02d}"

        # Try to extract time if present
        time_match = re.search(
            r'(\d{1,2}):(\d{2})\s*(am|pm)',
            text,
            re.IGNORECASE
        )

        start_time = None
        if time_match:
            hour = int(time_match.group(1))
            minute = time_match.group(2)
            period = time_match.group(3).lower()

            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

            start_time = f"{hour:02d}:{minute}"

        return start_date, start_time

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Asian Americans Advancing Justice - Atlanta for public events.

    Note: This organization primarily runs ongoing programs rather than
    discrete public events. This crawler checks their main pages for any
    announced upcoming community events or workshops.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # Pages to check for events
            pages_to_check = [
                ("https://www.advancingjustice-atlanta.org/georgia-leadership-lab", "Georgia Leadership Lab"),
                ("https://www.advancingjustice-atlanta.org/candidatetraining", "Candidate Training"),
                ("https://www.advancingjustice-atlanta.org/clinics", "Legal Clinics"),
            ]

            for url, page_title in pages_to_check:
                try:
                    page.goto(url, wait_until="networkidle", timeout=30000)

                    # Get page text
                    body_text = page.evaluate('document.body.innerText')

                    # Skip if it's a 404
                    if "couldn't find the page" in body_text.lower():
                        logger.info(f"Page not found: {url}")
                        continue

                    # Look for date patterns that might indicate upcoming events
                    # Common patterns: "Applications due March 17", "Deadline: February 28", etc.
                    date_indicators = [
                        r'deadline[:\s]+([^.]+)',
                        r'applications?\s+(?:due|close)[:\s]+([^.]+)',
                        r'apply\s+by[:\s]+([^.]+)',
                        r'next\s+(?:cohort|session|training)[:\s]+([^.]+)',
                        r'upcoming[:\s]+([^.]+)',
                        r'join\s+us[:\s]+([^.]+)',
                    ]

                    for pattern in date_indicators:
                        matches = re.finditer(pattern, body_text, re.IGNORECASE)
                        for match in matches:
                            date_text = match.group(1).strip()
                            start_date, start_time = parse_date_from_text(date_text)

                            if start_date:
                                # Found a potential event
                                events_found += 1

                                # Generate title based on page and context
                                title = f"{page_title} Application Deadline" if "application" in match.group(0).lower() else page_title

                                # Extract description from page
                                # Get first 500 chars of meaningful content
                                desc_lines = [line.strip() for line in body_text.split('\n') if line.strip()]
                                # Skip navigation and header
                                desc_lines = [l for l in desc_lines if len(l) > 50]
                                description = " ".join(desc_lines[:3])[:500] if desc_lines else page_title

                                # Get image from page
                                image_url = None
                                try:
                                    og_image = page.query_selector('meta[property="og:image"]')
                                    if og_image:
                                        image_url = og_image.get_attribute('content')
                                except Exception:
                                    pass

                                content_hash = generate_content_hash(
                                    title,
                                    VENUE_DATA["name"],
                                    start_date
                                )

                                # Check if exists
                                if find_event_by_hash(content_hash):
                                    events_updated += 1
                                    continue

                                # Determine category based on page type
                                category = "learning"  # Default
                                tags = ["activism", "community", "educational"]

                                if "clinic" in page_title.lower():
                                    category = "community"
                                    tags.append("volunteer")
                                elif "training" in page_title.lower() or "lab" in page_title.lower():
                                    category = "learning"
                                    tags.append("class")

                                # Check if it's free
                                is_free = "free" in body_text.lower() or "no cost" in body_text.lower()

                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": description,
                                    "start_date": start_date,
                                    "start_time": start_time,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": start_time is None,
                                    "category": category,
                                    "subcategory": None,
                                    "tags": tags,
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": "RSVP or application required",
                                    "is_free": is_free,
                                    "source_url": url,
                                    "ticket_url": url,
                                    "image_url": image_url,
                                    "raw_text": json.dumps({
                                        "page_title": page_title,
                                        "date_context": match.group(0),
                                        "description_preview": description[:200],
                                    }),
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
                                    logger.error(f"Failed to insert event '{title}': {e}")

                                # Only take first date match per page to avoid duplicates
                                break

                except PlaywrightTimeout:
                    logger.warning(f"Timeout loading {url}")
                    continue
                except Exception as e:
                    logger.error(f"Error processing {url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Advancing Justice Atlanta: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Advancing Justice Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
