"""
Crawler for Ebenezer Baptist Church public events.
https://www.ebenezeratl.org/upcoming-events/

Historic church founded by Martin Luther King Sr. in 1886.
Focuses on PUBLIC community events - Bible studies, lectures, concerts.
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

BASE_URL = "https://www.ebenezeratl.org"
EVENTS_URL = f"{BASE_URL}/upcoming-events/"

VENUE_DATA = {
    "name": "Ebenezer Baptist Church",
    "slug": "ebenezer-baptist-church",
    "address": "101 Jackson St NE",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7561,
    "lng": -84.3728,
    "venue_type": "church",
    "website": BASE_URL,
}

# Skip member-only or internal church business
SKIP_KEYWORDS = [
    "member", "congregation", "deacon", "trustee", "pastor search",
    "business meeting", "board meeting", "staff meeting"
]

# Public event indicators
PUBLIC_KEYWORDS = [
    "community", "public", "all are welcome", "open to",
    "lecture", "concert", "symposium", "mlk", "martin luther king"
]


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '7pm', '10:30 AM', 'noon'."""
    if "noon" in time_text.lower():
        return "12:00"

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["ebenezer-baptist", "faith", "sweet-auburn"]

    # Check if it's MLK-related (important historical events)
    if any(kw in text for kw in ["mlk", "martin luther king", "civil rights"]):
        tags.extend(["mlk", "civil-rights", "black-history"])
        if "birthday" in text or "celebration" in text:
            return "community", "celebration", tags

    # Bible study
    if "bible study" in text:
        tags.extend(["bible-study", "education"])
        return "community", "education", tags

    # Prayer groups
    if "prayer" in text:
        tags.extend(["prayer", "spirituality"])
        return "community", "spiritual", tags

    # Youth/Young Adult events
    if any(kw in text for kw in ["youth", "young adult", "yam"]):
        tags.extend(["young-adults", "18-35"])
        return "community", "youth", tags

    # Music/Concert
    if any(kw in text for kw in ["concert", "choir", "music", "symphony"]):
        tags.extend(["music", "live-music"])
        return "music", "gospel", tags

    # Lecture/Educational
    if any(kw in text for kw in ["lecture", "symposium", "talk", "discussion"]):
        tags.extend(["education", "lecture"])
        return "community", "education", tags

    # Default to faith/community
    return "community", "faith", tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public/community-facing vs. member-only."""
    text = f"{title} {description}".lower()

    # Explicit skip keywords
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    # Explicit public indicators
    if any(kw in text for kw in PUBLIC_KEYWORDS):
        return True

    # Bible studies that say "join us" are generally public
    if "bible study" in text and "join" in text:
        return True

    # MLK events are public
    if "mlk" in text or "martin luther king" in text:
        return True

    # Concerts/music events are usually public
    if any(kw in text for kw in ["concert", "music", "performance", "symphony"]):
        return True

    # Default: assume public if no member-only indicators
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ebenezer Baptist Church public events using Playwright."""
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

            logger.info(f"Fetching Ebenezer Baptist Church: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            browser.close()

            # Parse events from text content
            # Structure appears to be: Title, Description, Time info
            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip short lines and navigation
                if len(line) < 10:
                    i += 1
                    continue

                # Look for event titles (bold/emphasized text that contains event keywords)
                is_event_title = False
                title_lower = line.lower()

                # Check for event-like titles
                if any(kw in title_lower for kw in [
                    "bible study", "prayer", "worship", "ministry", "fellowship",
                    "young adult", "women's", "men's", "navigating our world",
                    "tuesday bible", "concert", "lecture", "mlk", "celebration"
                ]):
                    is_event_title = True

                if not is_event_title:
                    i += 1
                    continue

                title = line

                # Gather description from next few lines
                description_parts = []
                start_time = None
                recurrence_pattern = None
                j = i + 1

                for offset in range(1, 10):
                    if i + offset >= len(lines):
                        break

                    next_line = lines[i + offset]

                    # Stop if we hit another event title
                    if any(kw in next_line.lower() for kw in [
                        "bible study", "prayer meeting", "women's", "men's"
                    ]) and offset > 3:
                        break

                    # Look for time info
                    if not start_time:
                        time_result = parse_time(next_line)
                        if time_result:
                            start_time = time_result

                    # Look for recurrence patterns
                    if re.search(r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)", next_line, re.IGNORECASE):
                        if "after the first sunday" in next_line.lower():
                            recurrence_pattern = "first Monday of month"
                        elif re.search(r"(\d+)(?:st|nd|rd|th)\s+(?:and|&)\s+(\d+)(?:st|nd|rd|th)", next_line, re.IGNORECASE):
                            recurrence_pattern = next_line
                        elif "each" in next_line.lower() or "every" in next_line.lower():
                            recurrence_pattern = next_line

                    description_parts.append(next_line)

                description = " ".join(description_parts[:3])  # First 3 lines

                # Check if public
                if not is_public_event(title, description):
                    logger.debug(f"Skipping member-only event: {title}")
                    i += 1
                    continue

                # For recurring events, create a sample date (next occurrence)
                # For now, use a placeholder - in production you'd calculate next occurrence
                if recurrence_pattern:
                    # Use first day of next month as placeholder
                    now = datetime.now()
                    if now.month == 12:
                        start_date = f"{now.year + 1}-01-15"
                    else:
                        start_date = f"{now.year}-{now.month + 1:02d}-15"
                else:
                    # Look for specific date in description
                    date_match = re.search(
                        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})",
                        description,
                        re.IGNORECASE
                    )
                    if date_match:
                        month = date_match.group(1)
                        day = int(date_match.group(2))
                        try:
                            dt = datetime.strptime(f"{month} {day} {datetime.now().year}", "%B %d %Y")
                            if dt.date() < datetime.now().date():
                                dt = datetime.strptime(f"{month} {day} {datetime.now().year + 1}", "%B %d %Y")
                            start_date = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            # Skip if can't parse date
                            i += 1
                            continue
                    else:
                        # Skip events without clear dates
                        i += 1
                        continue

                # Dedupe
                event_key = f"{title}|{start_date}"
                if event_key in seen_events:
                    i += 1
                    continue
                seen_events.add(event_key)

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(
                    title, "Ebenezer Baptist Church", start_date
                )

                # Check for existing
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    i += 1
                    continue

                # Determine category and tags
                category, subcategory, tags = determine_category_and_tags(title, description)

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:200],
                    "description": description[:1000] if description else None,
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
                    "price_note": "Free - donations welcome",
                    "is_free": True,
                    "source_url": EVENTS_URL,
                    "ticket_url": EVENTS_URL,
                    "image_url": None,
                    "raw_text": f"{title} {description}"[:500],
                    "extraction_confidence": 0.80,
                    "is_recurring": bool(recurrence_pattern),
                    "recurrence_rule": recurrence_pattern,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title[:50]}... on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

                i += 1

        logger.info(
            f"Ebenezer Baptist Church crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ebenezer Baptist Church: {e}")
        raise

    return events_found, events_new, events_updated
