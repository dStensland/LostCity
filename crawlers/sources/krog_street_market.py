"""
Crawler for The Krog District (thekrogdistrict.com).
Formerly Krog Street Market - popular food hall in Inman Park with restaurants and events.

Site uses Squarespace with JavaScript rendering - must use Playwright.
Events are in .eventlist-event containers with structured date/time fields.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, remove_stale_source_events
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.thekrogdistrict.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Krog Street Market",
    "slug": "krog-street-market",
    "address": "99 Krog St NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7575,
    "lng": -84.3641,
    "venue_type": "food_hall",
    "spot_type": "food_hall",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format to HH:MM 24-hour format."""
    if not time_text:
        return None

    # Handle time ranges like "7:00 PM  9:00 PM" - extract start time
    time_text = time_text.strip()

    # Look for first time in the string
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def parse_full_date(date_text: str) -> Optional[str]:
    """Parse date from 'Wednesday, February 4, 2026' format to YYYY-MM-DD."""
    if not date_text:
        return None

    # Try full format: "Wednesday, February 4, 2026"
    match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )

    if match:
        month_name = match.group(1)
        day = match.group(2)
        year = match.group(3)

        try:
            dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["krog-street-market", "food-hall", "inman-park", "beltline"]

    # Check specific event types first before generic terms
    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "nightlife", "trivia", tags + ["trivia"]
    if any(w in title_lower for w in ["comedy", "punchlines"]):
        return "nightlife", "comedy", tags + ["comedy"]
    if any(w in title_lower for w in ["yoga", "fitness"]):
        return "fitness", None, tags + ["fitness"]
    if any(w in title_lower for w in ["kids", "family", "children"]):
        return "family", None, tags + ["family"]
    if any(w in title_lower for w in ["music", "concert", "live", "dj", "band"]):
        return "music", "live", tags + ["live-music"]
    if any(w in title_lower for w in ["tasting", "wine", "chef", "dinner", "brunch"]):
        return "food_drink", "tasting", tags + ["food"]
    # Only match "market" if it's not part of "Krog Street Market"
    if "market" in title_lower and "krog street market" not in title_lower:
        return "community", "market", tags + ["market"]
    if any(w in title_lower for w in ["pop-up", "vendor", "makers"]):
        return "community", "market", tags + ["market"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Krog District events using Playwright DOM extraction."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching The Krog District events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all lazy-loaded content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract events from DOM using page.evaluate
            raw_events = page.evaluate("""
                () => {
                    const eventItems = document.querySelectorAll('.eventlist-event');
                    return Array.from(eventItems).map(item => {
                        const titleEl = item.querySelector('.eventlist-title a, .eventlist-title');
                        const linkEl = item.querySelector('a[href*="/events/"]');
                        const columnInfo = item.querySelector('.eventlist-column-info');
                        const imgEl = item.querySelector('img[data-src], img[src]');
                        const timeEl = item.querySelector('.eventlist-meta-time');

                        // Get full text which includes the complete date
                        const fullText = columnInfo ? columnInfo.innerText.trim() : item.innerText.trim();

                        return {
                            title: titleEl ? titleEl.innerText.trim() : null,
                            url: linkEl ? linkEl.href : null,
                            fullText: fullText,
                            time: timeEl ? timeEl.innerText.trim() : null,
                            image: imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null
                        };
                    }).filter(e => e.title);
                }
            """)

            logger.info(f"Found {len(raw_events)} events on page")

            for event_data in raw_events:
                title = event_data["title"]
                full_text = event_data["fullText"]
                time_text = event_data["time"]
                event_url = event_data["url"] or EVENTS_URL
                image_url = event_data["image"]

                # Parse date from full text (format: "Wednesday, February 4, 2026")
                start_date = parse_full_date(full_text)
                if not start_date:
                    logger.debug(f"Skipping event with unparseable date: {title}")
                    continue

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < datetime.now().date():
                        logger.debug(f"Skipping past event: {title} on {start_date}")
                        continue
                except ValueError:
                    logger.debug(f"Invalid date format: {start_date}")
                    continue

                events_found += 1

                # Parse time - if not found, default to 6:00 PM for food hall events
                start_time = parse_time(time_text) if time_text else None
                if not start_time:
                    start_time = "18:00"
                    logger.debug(f"No time found for {title}, defaulting to 6:00 PM")

                # Generate content hash for deduplication
                content_hash = generate_content_hash(
                    title, "Krog Street Market", start_date
                )
                seen_hashes.add(content_hash)

                # Check for existing event

                # Determine category
                category, subcategory, tags = determine_category(title)
                is_free = "free" in title.lower() or "free" in full_text.lower()

                # Extract description from full text (after the time/location info)
                description = None
                lines = full_text.split("\n")
                if len(lines) > 3:
                    # Skip title, date, time/location lines, get description
                    desc_lines = [l.strip() for l in lines[3:] if l.strip() and "View Event" not in l]
                    if desc_lines:
                        description = " ".join(desc_lines)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description or "Event at The Krog District",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,  # All events have times or default time
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": full_text[:500],
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
                    logger.error(f"Failed to insert event {title}: {e}")

            # Remove stale events that are no longer on the site
            try:
                removed = remove_stale_source_events(source_id, seen_hashes)
                if removed > 0:
                    logger.info(f"Removed {removed} stale events")
            except Exception as e:
                logger.error(f"Failed to remove stale events: {e}")

            browser.close()

        logger.info(
            f"Krog Street Market crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Krog Street Market: {e}")
        raise

    return events_found, events_new, events_updated
