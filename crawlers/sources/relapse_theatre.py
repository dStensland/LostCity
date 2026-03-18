"""
Crawler for Relapse Theatre (relapsetheatre.com).
West Midtown improv, standup, and sketch comedy venue.

Uses Seat Engine for ticketing at therelapsetheater-com.seatengine.com/events.
Playwright-based — Seat Engine pages are JS-rendered.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.relapsetheatre.com"
EVENTS_URL = "https://therelapsetheater-com.seatengine.com/events"

VENUE_DATA = {
    "name": "Relapse Theatre",
    "slug": "relapse-theatre",
    "address": "380 14th St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7880,
    "lng": -84.4010,
    "venue_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BASE_URL,
    "description": (
        "Atlanta's home for improv, standup, and sketch comedy. Multiple shows nightly "
        "with a full-service bar featuring 200+ brands. Classes and workshops for "
        "aspiring performers. Recently remodeled."
    ),
    "vibes": ["comedy", "improv", "live-shows", "late-night", "fun"],
}


def parse_date_text(text: str) -> Optional[tuple[str, str]]:
    """
    Parse date/time from Seat Engine format.
    Examples: "Mar 18, 2026 8:00 PM", "March 18, 2026 at 8:00 PM",
              "Tue, Mar 18 8:00 PM", "3/18/2026 8:00 PM"
    Returns (YYYY-MM-DD, HH:MM) or None.
    """
    # Pattern 1: "Mon DD, YYYY H:MM AM/PM" or "Month DD, YYYY at H:MM AM/PM"
    pattern1 = r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)"
    match = re.search(pattern1, text, re.IGNORECASE)
    if match:
        month_str, day, year, hour, minute, period = match.groups()
        try:
            month_num = datetime.strptime(month_str[:3], "%b").month
        except ValueError:
            return None
        hour_int = int(hour)
        if period.upper() == "PM" and hour_int != 12:
            hour_int += 12
        elif period.upper() == "AM" and hour_int == 12:
            hour_int = 0
        return (f"{year}-{month_num:02d}-{int(day):02d}", f"{hour_int:02d}:{minute}")

    # Pattern 2: "Day, Mon DD H:MM AM/PM" (no year — assume current/next)
    pattern2 = r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+([A-Za-z]+)\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)"
    match = re.search(pattern2, text, re.IGNORECASE)
    if match:
        month_str, day, hour, minute, period = match.groups()
        try:
            month_num = datetime.strptime(month_str[:3], "%b").month
        except ValueError:
            return None
        now = datetime.now()
        year = now.year
        candidate = datetime(year, month_num, int(day))
        if candidate < now - __import__("datetime").timedelta(days=30):
            year += 1
        hour_int = int(hour)
        if period.upper() == "PM" and hour_int != 12:
            hour_int += 12
        elif period.upper() == "AM" and hour_int == 12:
            hour_int = 0
        return (f"{year}-{month_num:02d}-{int(day):02d}", f"{hour_int:02d}:{minute}")

    # Pattern 3: "M/DD/YYYY H:MM AM/PM"
    pattern3 = r"(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)"
    match = re.search(pattern3, text, re.IGNORECASE)
    if match:
        month, day, year, hour, minute, period = match.groups()
        hour_int = int(hour)
        if period.upper() == "PM" and hour_int != 12:
            hour_int += 12
        elif period.upper() == "AM" and hour_int == 12:
            hour_int = 0
        return (f"{year}-{int(month):02d}-{int(day):02d}", f"{hour_int:02d}:{minute}")

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Relapse Theatre events from Seat Engine ticketing page."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Relapse Theatre events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try multiple selectors for Seat Engine event containers
            selectors = [
                ".event-card",
                ".event-list-item",
                ".se-event",
                "[data-event-id]",
                ".event",
                "article",
                ".show-card",
                ".performance-card",
            ]

            event_elements = []
            for selector in selectors:
                event_elements = page.query_selector_all(selector)
                if event_elements:
                    logger.info(f"Found {len(event_elements)} events with selector: {selector}")
                    break

            if not event_elements:
                # Fallback: try to extract from page text
                page_text = page.inner_text("body")
                logger.warning(f"No event elements found with known selectors. Page text preview: {page_text[:500]}")
                browser.close()
                return 0, 0, 0

            eastern = ZoneInfo("America/New_York")

            for idx, event_el in enumerate(event_elements):
                try:
                    event_text = event_el.inner_text()
                    lines = [ln.strip() for ln in event_text.split("\n") if ln.strip()]

                    if len(lines) < 2:
                        continue

                    # Extract title — usually the most prominent text
                    title = None
                    for line in lines[:5]:
                        # Skip date-only lines, price lines, button text
                        if re.match(r"^(Buy|Get|Sold|More|\$|Free)", line, re.IGNORECASE):
                            continue
                        if re.match(r"^\d{1,2}[:/]\d{2}", line):
                            continue
                        if len(line) > 5 and not re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*$", line):
                            title = line
                            break

                    if not title:
                        continue

                    # Extract date/time
                    showtime = None
                    for line in lines:
                        result = parse_date_text(line)
                        if result:
                            showtime = result
                            break

                    # Also try the full event text
                    if not showtime:
                        showtime = parse_date_text(event_text)

                    if not showtime:
                        logger.debug(f"No showtime found for: {title}")
                        continue

                    start_date, start_time = showtime

                    # Skip past events
                    event_dt = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
                    event_dt = event_dt.replace(tzinfo=eastern)
                    if event_dt < datetime.now(eastern):
                        continue

                    # Extract image
                    image_url = None
                    img_el = event_el.query_selector("img")
                    if img_el:
                        image_url = img_el.get_attribute("src")

                    # Extract description
                    description = ""
                    desc_lines = []
                    found_title = False
                    for line in lines:
                        if line == title:
                            found_title = True
                            continue
                        if found_title and len(line) > 20:
                            if re.match(r"^(Buy|Get|Sold|\$|Free|More Info)", line, re.IGNORECASE):
                                break
                            desc_lines.append(line)
                            if len(desc_lines) >= 3:
                                break
                    description = " ".join(desc_lines) if desc_lines else f"Comedy show at Relapse Theatre"

                    # Extract ticket URL
                    ticket_url = None
                    link_el = event_el.query_selector("a[href*='event'], a[href*='ticket'], a[href*='buy']")
                    if link_el:
                        ticket_url = link_el.get_attribute("href")
                        if ticket_url and not ticket_url.startswith("http"):
                            ticket_url = f"https://therelapsetheater-com.seatengine.com{ticket_url}"

                    # Extract price
                    price_min = None
                    price_match = re.search(r"\$(\d+(?:\.\d{2})?)", event_text)
                    if price_match:
                        price_min = float(price_match.group(1))

                    events_found += 1

                    content_hash = generate_content_hash(title, "Relapse Theatre", start_date)
                    current_hashes.add(content_hash)

                    # Determine subcategory from title
                    title_lower = title.lower()
                    subcategory = "comedy"
                    if "improv" in title_lower:
                        subcategory = "improv"
                    elif "standup" in title_lower or "stand-up" in title_lower or "stand up" in title_lower:
                        subcategory = "standup"
                    elif "sketch" in title_lower:
                        subcategory = "sketch"
                    elif "open mic" in title_lower:
                        subcategory = "open_mic"

                    tags = ["comedy", "relapse-theatre"]
                    if subcategory == "improv":
                        tags.append("improv")
                    elif subcategory == "standup":
                        tags.append("standup")
                    elif subcategory == "sketch":
                        tags.append("sketch")

                    is_free = "free" in event_text.lower() and "$" not in event_text

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
                        "category": "comedy",
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": None,
                        "is_free": is_free,
                        "source_url": ticket_url or EVENTS_URL,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": event_text[:500],
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
                        logger.info(f"Added: {title} on {start_date} at {start_time}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process event {idx}: {e}")
                    continue

            browser.close()

            # Remove stale events
            remove_stale_source_events(source_id, current_hashes)

        logger.info(
            f"Relapse Theatre crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Relapse Theatre: {e}")
        raise

    return events_found, events_new, events_updated
