"""
Crawler for Believe Music Hall (believemusichall.com).
Major EDM venue on Ralph David Abernathy with international DJs.
Uses Playwright for JavaScript-rendered content.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.believemusichall.com"
# Main page has events; /events returns 404
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Believe Music Hall",
    "slug": "believe-music-hall",
    "address": "181 Ralph David Abernathy Blvd",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7418,
    "lng": -84.4089,
    "venue_type": "nightclub",
    "spot_type": "nightclub",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from 'Fri Jan 23' or 'Sat Jan 24' format."""
    current_year = datetime.now().year

    # Pattern: "Fri Jan 23" or "Sat Jan 24"
    match = re.match(r"(\w{3})\s+(\w{3})\s+(\d{1,2})", date_text)
    if match:
        _, month, day = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt < datetime.now():
                dt = datetime.strptime(f"{month} {day} {current_year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from 'Doors: 10:00PM' or '10:00PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Believe Music Hall events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)
            all_lines = []

            # Crawl multiple pages (site has pagination 1, 2, 3, 4)
            for page_num in range(1, 5):
                if page_num == 1:
                    logger.info(f"Fetching Believe Music Hall: {EVENTS_URL}")
                    page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
                else:
                    # Click pagination number
                    try:
                        logger.info(f"Fetching Believe Music Hall page {page_num}")
                        # Find and click the page number
                        page.click(f'text="{page_num}"', timeout=5000)
                    except Exception as e:
                        logger.debug(f"Could not navigate to page {page_num}: {e}")
                        break

                page.wait_for_timeout(2000)

                # Extract images from page
                image_map = extract_images_from_page(page)

                # Extract event links for specific URLs
                event_links = extract_event_links(page, BASE_URL)

                # Scroll to load content
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(500)

                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]
                all_lines.extend(lines)

            browser.close()

            # Parse events from collected lines
            # Pattern: title line ends with "@" venue "|", followed by date line "Fri Jan 23"
            date_pattern = re.compile(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\w{3})\s+(\d{1,2})$", re.IGNORECASE)

            i = 0
            while i < len(all_lines):
                line = all_lines[i]
                match = date_pattern.match(line)

                if match:
                    # Found a date line - look backwards for the title
                    start_date = parse_date(line)

                    if not start_date:
                        i += 1
                        continue

                    # Look backwards for title (should be 1-2 lines before date)
                    title = None
                    for j in range(i - 1, max(i - 5, -1), -1):
                        prev_line = all_lines[j]

                        # Skip navigation, common non-title lines
                        skip_patterns = [
                            "Share Event",
                            "Buy Tickets",
                            "at Believe Music Hall",
                            "Doors:",
                            "VIP Tables",
                            "Private Event",
                            "Book VIP",
                            "Book Private",
                            "Upcoming Events",
                            "Contact",
                            "Facebook",
                            "Instagram",
                            "HOME",
                            "TICKETS",
                            "FAQ",
                            "MENU",
                            "SOCIALS",
                            "CONTACT",
                        ]
                        if any(skip in prev_line for skip in skip_patterns):
                            continue

                        # Skip short lines (usually page numbers)
                        if len(prev_line) < 5:
                            continue

                        # Skip other date lines
                        if date_pattern.match(prev_line):
                            break

                        # Skip lines that look like formatted dates "Sat, Jan 24th!"
                        if re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\w{3}\s+\d{1,2}", prev_line, re.IGNORECASE):
                            continue

                        # Skip "Iris Presents" promoter lines that don't have artist names
                        if re.match(r"^Iris Presents:?\s*$", prev_line, re.IGNORECASE):
                            continue

                        # This should be the title line
                        title = prev_line
                        break

                    if title:
                        # Clean up title - remove trailing " |" if present
                        title = re.sub(r"\s*\|\s*$", "", title)

                        # Look for time in nearby lines
                        start_time = "22:00"  # Default to 10 PM
                        for j in range(i + 1, min(i + 4, len(all_lines))):
                            next_line = all_lines[j]
                            if "Doors:" in next_line or "Show:" in next_line:
                                parsed_time = parse_time(next_line)
                                if parsed_time:
                                    start_time = parsed_time
                                break

                        events_found += 1

                        content_hash = generate_content_hash(
                            title, "Believe Music Hall", start_date
                        )


                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "nightlife",
                            "subcategory": "club",
                            "tags": [
                                "believe",
                                "nightclub",
                                "edm",
                                "electronic",
                                "dj",
                                "west-end",
                            ],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": None,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_map.get(title),
                            "raw_text": None,
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        # Enrich from detail page
                        enrich_event_record(event_record, source_name="Believe Music Hall")

                        # Determine is_free if still unknown after enrichment
                        if event_record.get("is_free") is None:
                            desc_lower = (event_record.get("description") or "").lower()
                            title_lower = event_record.get("title", "").lower()
                            combined = f"{title_lower} {desc_lower}"
                            if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                                event_record["is_free"] = True
                                event_record["price_min"] = event_record.get("price_min") or 0
                                event_record["price_max"] = event_record.get("price_max") or 0
                            else:
                                event_record["is_free"] = False

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            i += 1
                            continue

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

        logger.info(
            f"Believe Music Hall crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Believe Music Hall: {e}")
        raise

    return events_found, events_new, events_updated
