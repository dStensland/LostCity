"""
Crawler for Terminus Modern Ballet Theatre.
Professional modern ballet company with performances.

Parses the tickets page for upcoming performances with dates and venues.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.terminusmbt.com"
EVENTS_URL = f"{BASE_URL}/tickets"

VENUE_DATA = {
    "name": "Terminus Modern Ballet Theatre",
    "slug": "terminus-modern-ballet",
    "address": "75 Bennett St NW, Suite A-2",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "performing_arts",
    "website": BASE_URL,
}


def parse_date_text(date_text: str, current_year: int) -> list[datetime]:
    """Parse date text like 'Jan. 31' or 'Mar. 6-8' into datetime objects."""
    dates = []

    # Pattern for single date: "Jan. 31" or "January 31"
    single_match = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})$",
        date_text.strip(),
        re.IGNORECASE
    )
    if single_match:
        month_str = single_match.group(1)[:3]
        day = int(single_match.group(2))
        try:
            dt = datetime.strptime(f"{month_str} {day} {current_year}", "%b %d %Y")
            # If date is in the past, try next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%b %d %Y")
            dates.append(dt)
        except ValueError:
            pass
        return dates

    # Pattern for date range: "Mar. 6-8" or "March 6-8"
    range_match = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})",
        date_text.strip(),
        re.IGNORECASE
    )
    if range_match:
        month_str = range_match.group(1)[:3]
        start_day = int(range_match.group(2))
        end_day = int(range_match.group(3))

        for day in range(start_day, end_day + 1):
            try:
                dt = datetime.strptime(f"{month_str} {day} {current_year}", "%b %d %Y")
                if dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%b %d %Y")
                dates.append(dt)
            except ValueError:
                pass

    return dates


def crawl(source: dict) -> tuple[int, int, int]:
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

            logger.info(f"Fetching Terminus Modern Ballet: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
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
            current_year = datetime.now().year

            # Look for "UPCOMING PERFORMANCES" section
            performances_section = re.search(
                r"UPCOMING PERFORMANCES(.+?)(?:company portal|SUPPORT|MAILING LIST|$)",
                body_text,
                re.DOTALL | re.IGNORECASE
            )

            if performances_section:
                section_text = performances_section.group(1)

                # Parse individual performances
                # Pattern: Title\nDate\nVenue\nDescription
                lines = [l.strip() for l in section_text.split('\n') if l.strip()]

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip navigation/button text
                    if line.lower() in ['explore', 'discover more', 'meet the terminators', 'latest news', 'ways to give']:
                        i += 1
                        continue

                    # Look for date pattern in next line
                    if i + 1 < len(lines):
                        potential_date = lines[i + 1]
                        dates = parse_date_text(potential_date, current_year)

                        if dates:
                            title = line
                            # Get venue if available
                            location = lines[i + 2] if i + 2 < len(lines) else "Terminus Modern Ballet Theatre"

                            # Skip if title looks like a date or navigation
                            if re.match(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", title, re.IGNORECASE):
                                i += 1
                                continue

                            for event_date in dates:
                                events_found += 1
                                start_date_str = event_date.strftime("%Y-%m-%d")

                                content_hash = generate_content_hash(title, "Terminus Modern Ballet Theatre", start_date_str)


                                # Get specific event URL


                                event_url = find_event_url(title, event_links, EVENTS_URL)



                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": f"{title} by Terminus Modern Ballet Theatre at {location}. Contemporary ballet performance.",
                                    "start_date": start_date_str,
                                    "start_time": "19:30",  # Default evening performance
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": "theater",
                                    "subcategory": "ballet",
                                    "tags": ["ballet", "modern-dance", "contemporary", "performing-arts"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": False,
                                    "source_url": event_url,
                                    "ticket_url": event_url,
                                    "image_url": image_map.get(title),
                                    "raw_text": f"{title} - {start_date_str} at {location}",
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
                                    logger.info(f"Added: {title} on {start_date_str}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {title}: {e}")

                            i += 3  # Skip title, date, venue
                            continue

                    i += 1

            browser.close()

        logger.info(f"Terminus Modern Ballet crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Terminus Modern Ballet: {e}")
        raise

    return events_found, events_new, events_updated
