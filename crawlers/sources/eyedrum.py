"""
Crawler for Eyedrum Art & Music Gallery.
Community art space for art, music, film, and literary events - West End.

Site structure: Text-based listings with Title/Date/Time/Description/View Event pattern.
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

BASE_URL = "https://eyedrum.org"
EVENTS_URL = f"{BASE_URL}/calendar-events-performances-art-music"

VENUE_DATA = {
    "name": "Eyedrum",
    "slug": "eyedrum",
    "address": "515 Ralph David Abernathy Blvd SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "gallery",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from format like 'Friday, January 30, 2026'."""
    date_text = date_text.strip()

    # Try "Friday, January 30, 2026" format
    try:
        # Remove day of week prefix
        if ',' in date_text:
            parts = date_text.split(',', 1)
            if len(parts) == 2:
                date_text = parts[1].strip()

        dt = datetime.strptime(date_text, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try without year
    now = datetime.now()
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=now.year)
        if dt < now:
            dt = dt.replace(year=now.year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '7:00 PM' to HH:MM."""
    if not time_text:
        return None

    # Extract first time from range like "7:00 PM  10:30 PM"
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)", time_text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        period = match.group(3).upper()

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    title_lower = title.lower()
    desc_lower = (description or "").lower()
    combined = f"{title_lower} {desc_lower}"
    tags = ["art", "eyedrum", "west-end", "diy"]

    # Drawing/art classes
    if any(w in combined for w in ["drawing", "art class", "workshop"]):
        return "art", "workshop", tags + ["workshop", "class"]

    # Improv/jam sessions
    if any(w in combined for w in ["improv", "session", "jam", "players session"]):
        return "music", "jazz", tags + ["music", "improv", "jam"]

    # Music events (most common at Eyedrum)
    if any(w in combined for w in ["dj", "electronic", "techno", "house", "ambient"]):
        return "music", "electronic", tags + ["music", "electronic"]
    if any(w in combined for w in ["punk", "noise", "experimental", "grind"]):
        return "music", "punk", tags + ["music", "experimental"]
    if any(w in combined for w in ["jazz", "creative music"]):
        return "music", "jazz", tags + ["music", "jazz"]
    if any(w in combined for w in ["hip hop", "hip-hop", "rap"]):
        return "music", "hiphop", tags + ["music", "hiphop"]

    # Film/screening
    if any(w in combined for w in ["film", "screening", "movie", "cinema"]):
        return "film", "screening", tags + ["film"]

    # Literary
    if any(w in combined for w in ["poetry", "reading", "literary", "zine"]):
        return "learning", "lecture", tags + ["literary", "poetry"]

    # Art events
    if any(w in combined for w in ["exhibition", "exhibit", "gallery", "opening"]):
        return "art", "exhibition", tags + ["exhibition", "gallery"]

    # Performance
    if any(w in combined for w in ["performance", "dance", "theater", "theatre"]):
        return "theater", "performance", tags + ["performance"]

    # Default to music since Eyedrum is primarily a music venue
    return "music", None, tags + ["music", "live"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Eyedrum events using Playwright."""
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

            logger.info(f"Fetching Eyedrum: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Dismiss cookie banner if present
            try:
                accept_btn = page.query_selector('button:has-text("Accept")')
                if accept_btn:
                    accept_btn.click()
                    page.wait_for_timeout(500)
            except Exception:
                pass

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Get body text and parse events
            body_text = page.inner_text('body')
            lines = [l.strip() for l in body_text.split('\n') if l.strip()]

            # Pattern: Title / "Day, Month DD, YYYY" / "HH:MM PM  HH:MM PM" / "eyedrum (map)" / Description / "View Event →"
            i = 0
            seen_events = set()

            # Days of week indicate start of a date line
            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

            while i < len(lines):
                line = lines[i]

                # Check if this line starts with a day of week (date line)
                is_date_line = any(line.startswith(day) for day in days)

                if is_date_line:
                    # Look back for title (previous non-utility line)
                    title = None
                    for j in range(i - 1, max(0, i - 5), -1):
                        prev_line = lines[j]
                        # Skip utility lines
                        if prev_line in ['View Event →', 'Decline', 'Accept', 'Skip to Content', 'calendar', 'donate', 'upcoming events.']:
                            continue
                        if 'eyedrum (map)' in prev_line.lower():
                            continue
                        if re.match(r'^\d{1,2}:\d{2}\s*(AM|PM)', prev_line):
                            continue
                        # This is likely the title
                        title = prev_line
                        break

                    if not title:
                        i += 1
                        continue

                    # Parse date
                    start_date = parse_date(line)
                    if not start_date:
                        i += 1
                        continue

                    # Look ahead for time
                    start_time = None
                    if i + 1 < len(lines):
                        time_line = lines[i + 1]
                        if re.search(r'\d{1,2}:\d{2}\s*(AM|PM)', time_line):
                            start_time = parse_time(time_line)

                    # Look ahead for description
                    description = None
                    for j in range(i + 2, min(len(lines), i + 8)):
                        check_line = lines[j]
                        # Stop at "View Event" which marks end of event
                        if 'View Event' in check_line:
                            break
                        # Skip utility lines
                        if 'eyedrum (map)' in check_line.lower():
                            continue
                        if re.match(r'^\d{1,2}:\d{2}\s*(AM|PM)', check_line):
                            continue
                        # Longer text is description
                        if len(check_line) > 40:
                            description = check_line[:500]
                            break

                    # Skip duplicates
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Eyedrum", start_date
                    )

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Determine category
                    category, subcategory, tags = determine_category(title, description)

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
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Sliding scale / donation",
                        "is_free": False,
                        "source_url": EVENTS_URL,
                        "ticket_url": EVENTS_URL,
                        "image_url": None,
                        "raw_text": f"{title}\n{line}\n{description or ''}"[:500],
                        "extraction_confidence": 0.80,
                        "is_recurring": "every" in title.lower() or "every" in (description or "").lower(),
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Eyedrum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Eyedrum: {e}")
        raise

    return events_found, events_new, events_updated
