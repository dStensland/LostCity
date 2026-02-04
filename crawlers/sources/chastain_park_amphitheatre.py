"""
Crawler for Chastain Park Amphitheatre.
Outdoor concert venue managed by Live Nation. Hosts 20-40 concerts per season (May-Oct).

Note: chastain_arts.py covers the Chastain Arts Center (classes/gallery).
This crawler is for the separate Amphitheatre concert venue.

Strategy: Since this is a Live Nation venue, Ticketmaster may capture some events.
This crawler ensures the venue exists in our DB and scrapes the venue website
for any events not covered by Ticketmaster.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.livenation.com"
VENUE_URL = f"{BASE_URL}/venue/KovZpZAEkAaA/synovus-bank-amphitheater-at-chastain-park-events"

VENUE_DATA = {
    "name": "Synovus Bank Amphitheater at Chastain Park",
    "slug": "chastain-park-amphitheatre",  # Keep for backwards compat
    "address": "4469 Stella Dr NW",
    "neighborhood": "Chastain Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30327",
    "lat": 33.8705,
    "lng": -84.3879,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": "https://www.livenation.com/venue/KovZpZAEkAaA/synovus-bank-amphitheater-at-chastain-park-events",
    "vibes": ["outdoor", "concert", "date-night", "picnic", "iconic", "summer"],
}


def parse_event_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from Live Nation listings.

    Handles formats like "Sat Apr 18, 2026" or "Mon Feb 10 2026"
    """
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Common formats: "May 15, 2026", "Sat May 15 2026", "Sat Apr 18, 2026"
    for fmt in ["%B %d, %Y", "%b %d, %Y", "%Y-%m-%d",
                "%A %B %d %Y", "%a %b %d %Y",
                "%a %B %d, %Y", "%a %b %d, %Y"]:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            continue

    # Try extracting from mixed text: "Sat · May 15, 2026 · 7:30 PM"
    match = re.search(r"(\w+\s+\w+\s+\d+,?\s*\d{4})", date_text)
    if match:
        for fmt in ["%a %B %d, %Y", "%a %b %d, %Y", "%a %B %d %Y", "%a %b %d %Y",
                    "%B %d, %Y", "%b %d, %Y", "%B %d %Y"]:
            try:
                dt = datetime.strptime(match.group(1), fmt)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

    return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '7:30 PM' to '19:30'."""
    if not time_text:
        return None
    match = re.search(r"(\d{1,2}:\d{2}\s*[AaPp][Mm])", time_text)
    if match:
        for fmt in ["%I:%M %p", "%I:%M%p"]:
            try:
                dt = datetime.strptime(match.group(1).strip(), fmt)
                return dt.strftime("%H:%M")
            except ValueError:
                continue
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Chastain Park Amphitheatre events from Live Nation."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Chastain Park Amphitheatre events: {VENUE_URL}")
            page.goto(VENUE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all events
            for _ in range(5):
                page.keyboard.press("End")
                page.wait_for_timeout(1000)

            # Find event containers with "Buy Tickets" text (Chakra UI layout)
            # Pattern: "Sat Apr 18, 2026 ▪︎ 8PMArtist NameBuy TicketsMore Info"
            all_containers = page.query_selector_all("div.css-0")
            logger.info(f"Found {len(all_containers)} potential containers")

            seen = set()

            for container in all_containers:
                try:
                    text = container.inner_text().strip()
                    if not text or "Buy Tickets" not in text:
                        continue

                    # Find ticket link
                    ticket_link = container.query_selector('a[href*="ticketmaster.com"]')
                    if not ticket_link:
                        continue

                    ticket_url = ticket_link.get_attribute("href")
                    if not ticket_url or ticket_url in seen:
                        continue
                    seen.add(ticket_url)

                    # Parse date: "(Mon|Tue|...) (Jan|Feb|...) DD, YYYY"
                    date_match = re.search(
                        r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})",
                        text
                    )
                    if not date_match:
                        continue

                    date_str = f"{date_match.group(1)} {date_match.group(2)} {date_match.group(3)}, {date_match.group(4)}"
                    start_date, _ = parse_event_date(date_str)

                    if not start_date:
                        continue

                    # Skip past events
                    if start_date < datetime.now().strftime("%Y-%m-%d"):
                        continue

                    # Parse time: after ▪︎ symbol
                    start_time = None
                    time_match = re.search(r"▪︎\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))", text)
                    if time_match:
                        time_str = time_match.group(1).strip()
                        start_time = parse_time(time_str)

                    # Parse title: text between time and "Buy Tickets"
                    title = None
                    if time_match:
                        after_time = text[time_match.end():]
                        buy_idx = after_time.find("Buy Tickets")
                        if buy_idx > 0:
                            title = after_time[:buy_idx].strip()
                    else:
                        # Fallback: between date and "Buy Tickets"
                        after_date = text[date_match.end():]
                        buy_idx = after_date.find("Buy Tickets")
                        if buy_idx > 0:
                            title = after_date[:buy_idx].strip()
                            # Remove leading ▪︎ and time if present
                            title = re.sub(r"^▪︎\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)\s*", "", title).strip()

                    if not title or len(title) < 3:
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:500],
                        "description": f"{title} at Chastain Park Amphitheatre, Atlanta's beloved outdoor concert venue.",
                        "start_date": start_date,
                        "start_time": start_time or "19:30",
                        "end_date": start_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "music.concert",
                        "tags": ["outdoor", "concert", "date-night", "picnic", "iconic", "live-nation"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See Ticketmaster for tickets",
                        "is_free": False,
                        "source_url": ticket_url,
                        "ticket_url": ticket_url,
                        "image_url": None,
                        "raw_text": text[:500],
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
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing event container: {e}")
                    continue

            browser.close()

        logger.info(
            f"Chastain Park crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Chastain Park Amphitheatre: {e}")
        raise

    return events_found, events_new, events_updated
