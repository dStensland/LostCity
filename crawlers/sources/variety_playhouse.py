"""
Crawler for Variety Playhouse (variety-playhouse.com/calendar).
Atlanta's beloved Little Five Points music venue since 1940.

Site uses JavaScript rendering - must use Playwright.
Format: TITLE, (opener), DAY MON DD, YYYY H:MM PM, TICKETS/SOLD OUT
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, enrich_event_record
from description_fetcher import fetch_description_playwright

logger = logging.getLogger(__name__)

BASE_URL = "https://www.variety-playhouse.com"
CALENDAR_URL = f"{BASE_URL}/calendar/"

VENUE_DATA = {
    "name": "Variety Playhouse",
    "slug": "variety-playhouse",
    "address": "1099 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '8:00 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Variety Playhouse events using Playwright."""
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

            logger.info(f"Fetching Variety Playhouse: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event detail links from page
            detail_links = page.evaluate("""
                () => {
                    const links = {};
                    document.querySelectorAll('a[href*="/shows/"], a[href*="/events/"]').forEach(a => {
                        const text = a.textContent.trim();
                        const href = a.href;
                        if (text && text.length > 3 && href) {
                            links[text] = href;
                        }
                    });
                    return links;
                }
            """)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - format is:
            # TITLE (all caps or mixed case)
            # OPENER (optional, if present)
            # DAY, MON DD, YYYY H:MM PM
            # TICKETS / SOLD OUT / CANCELLED

            i = 0
            current_month_year = None
            new_events = []

            while i < len(lines):
                line = lines[i]

                # Skip navigation/header items
                skip_items = ["calendar", "the venue", "getting here", "newsletter",
                             "rental info", "search", "our shows", "if you are using"]
                if line.lower() in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Check for month header like "JANUARY  2026"
                month_match = re.match(r"(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})", line, re.IGNORECASE)
                if month_match:
                    current_month_year = f"{month_match.group(1)} {month_match.group(2)}"
                    i += 1
                    continue

                # Look for date pattern: "SAT, JAN 24, 2026 8:00 PM"
                date_match = re.match(
                    r"([A-Z]{3}),\s+([A-Z]{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    # We found a date line - look back for title
                    day_name, month, day, year, time_str = date_match.groups()

                    # Title should be 1-3 lines before this
                    title = None
                    opener = None

                    # Check previous lines for title
                    for back in range(1, 4):
                        if i - back >= 0:
                            prev_line = lines[i - back]
                            # Skip if it's a status word or month header
                            if prev_line.upper() in ["TICKETS", "SOLD OUT", "CANCELLED"]:
                                continue
                            if re.match(r"(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{4}", prev_line, re.IGNORECASE):
                                continue
                            # This could be title or opener
                            if title is None:
                                # Check if next line back exists and could be main title
                                if i - back - 1 >= 0:
                                    prev_prev = lines[i - back - 1]
                                    if prev_prev.upper() not in ["TICKETS", "SOLD OUT", "CANCELLED"] and not re.match(r"(JANUARY|FEBRUARY)", prev_prev, re.IGNORECASE):
                                        # prev_line might be opener, prev_prev might be title
                                        opener = prev_line
                                        title = prev_prev
                                        break
                                title = prev_line
                                break

                    if not title:
                        i += 1
                        continue

                    # Parse date
                    try:
                        dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Parse time
                    start_time = parse_time(time_str)

                    # Check next line for status
                    status = "available"
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].upper()
                        if "SOLD OUT" in next_line:
                            status = "sold_out"
                        elif "CANCELLED" in next_line:
                            status = "cancelled"
                            i += 1
                            continue  # Skip cancelled shows

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(title, "Variety Playhouse", start_date)

                    # Check for existing

                    # Build description
                    description = None
                    if opener:
                        description = f"With {opener}"

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
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["music", "concert", "variety-playhouse", "little-five-points"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Sold Out" if status == "sold_out" else None,
                        "is_free": None,
                        "source_url": CALENDAR_URL,
                        "ticket_url": CALENDAR_URL,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {opener}" if opener else title,
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    new_events.append(event_record)

                i += 1

            # Fetch descriptions from detail pages for new events
            detail_page = context.new_page()
            detail_fetches = 0
            for evt in new_events:
                title = evt["title"]
                detail_url = detail_links.get(title)
                if not evt.get("description") and detail_url and detail_fetches < 20:
                    desc = fetch_description_playwright(detail_page, detail_url)
                    if desc:
                        evt["description"] = desc
                    detail_fetches += 1
                    page.wait_for_timeout(1000)

                # Enrich from detail page
                enrich_event_record(evt, source_name="Variety Playhouse")

                # Synthetic fallback
                if not evt.get("description"):
                    evt["description"] = f"Live music at Variety Playhouse."

                # Determine is_free if still unknown after enrichment
                if evt.get("is_free") is None:
                    desc_lower = (evt.get("description") or "").lower()
                    title_lower = evt.get("title", "").lower()
                    combined = f"{title_lower} {desc_lower}"
                    if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                        evt["is_free"] = True
                        evt["price_min"] = evt.get("price_min") or 0
                        evt["price_max"] = evt.get("price_max") or 0
                    else:
                        evt["is_free"] = False

                try:
                    insert_event(evt)
                    events_new += 1
                    logger.info(f"Added: {title} on {evt['start_date']}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            detail_page.close()
            browser.close()

        logger.info(
            f"Variety Playhouse crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Variety Playhouse: {e}")
        raise

    return events_found, events_new, events_updated
