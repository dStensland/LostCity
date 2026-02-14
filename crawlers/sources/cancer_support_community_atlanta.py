"""
Crawler for Cancer Support Community Atlanta (cscatlanta.org).

100+ FREE programs per month: support groups, exercise classes, nutrition workshops,
stress reduction, social gatherings for people affected by cancer.

Events are hosted on Gnosis platform (cscatl.gnosishosting.net) - requires Playwright.
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

BASE_URL = "https://www.cscatlanta.org"
CALENDAR_URL = "https://cscatl.gnosishosting.net/Events/Calendar"

VENUE_DATA = {
    "name": "Cancer Support Community Atlanta",
    "slug": "cancer-support-community-atlanta",
    "address": "1100 Johnson Ferry Rd NE, Building 2, Suite LL90",
    "neighborhood": "Sandy Springs",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.9421,
    "lng": -84.3564,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["inclusive", "wellness"],
}

# Program type mapping to categories
PROGRAM_TYPES = {
    "support group": ("support_group", None, ["cancer", "support-group", "free"]),
    "support": ("support_group", None, ["cancer", "support-group", "free"]),
    "exercise": ("fitness", None, ["cancer", "exercise", "free", "wellness"]),
    "fitness": ("fitness", None, ["cancer", "exercise", "free", "wellness"]),
    "yoga": ("fitness", "yoga", ["cancer", "yoga", "free", "wellness"]),
    "nutrition": ("learning", "workshop", ["cancer", "nutrition", "free"]),
    "cooking": ("learning", "workshop", ["cancer", "nutrition", "free", "cooking"]),
    "stress reduction": ("wellness", None, ["cancer", "meditation", "free", "stress-relief"]),
    "stress management": ("wellness", None, ["cancer", "meditation", "free", "stress-relief"]),
    "meditation": ("wellness", None, ["cancer", "meditation", "free"]),
    "mindfulness": ("wellness", None, ["cancer", "meditation", "free", "mindfulness"]),
    "education": ("learning", None, ["cancer", "education", "free"]),
    "workshop": ("learning", "workshop", ["cancer", "education", "free"]),
    "social": ("community", None, ["cancer", "social", "free"]),
    "gathering": ("community", None, ["cancer", "social", "free"]),
    "art": ("art", None, ["cancer", "art-therapy", "free"]),
    "music": ("music", None, ["cancer", "music-therapy", "free"]),
    "therapy": ("wellness", None, ["cancer", "therapy", "free"]),
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '10:00 AM' or '10:00 a.m.' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        period_lower = period.lower().replace(".", "")
        if period_lower == "pm" and hour != 12:
            hour += 12
        elif period_lower == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    # Try "Month DD, YYYY" format
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_text,
        re.IGNORECASE
    )
    if match:
        month = match.group(1)
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(datetime.now().year)

        try:
            month_str = month[:3] if len(month) > 3 else month
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try MM/DD/YYYY format
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try YYYY-MM-DD format
    match = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", date_text)
    if match:
        year, month, day = match.groups()
        try:
            dt = datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category based on program type."""
    text = f"{title} {description}".lower()

    # Check each program type
    for keyword, (category, subcategory, tags) in PROGRAM_TYPES.items():
        if keyword in text:
            return category, subcategory, tags

    # Default to wellness
    return "wellness", None, ["cancer", "free"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cancer Support Community Atlanta events using Playwright."""
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

            logger.info(f"Fetching CSC Atlanta calendar: {CALENDAR_URL}")

            try:
                page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(4000)
            except Exception as e:
                logger.error(f"Failed to load calendar page: {e}")
                browser.close()
                return 0, 0, 0

            # Try to click on list view or expand events if there's a button
            try:
                # Look for common calendar view switches
                list_view_selectors = [
                    "text='List View'",
                    "text='List'",
                    "button:has-text('List')",
                    "[aria-label*='list']",
                ]
                for selector in list_view_selectors:
                    try:
                        if page.locator(selector).count() > 0:
                            page.click(selector, timeout=2000)
                            page.wait_for_timeout(2000)
                            logger.info("Switched to list view")
                            break
                    except:
                        pass
            except Exception as e:
                logger.debug(f"Could not find list view button: {e}")

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            logger.info(f"Extracted {len(lines)} lines from calendar")

            # Parse events - look for date patterns and event titles
            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip very short lines
                if len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                date_str = parse_date(line)

                if date_str:
                    # Found a date - look for title and time in surrounding lines
                    title = None
                    start_time = None
                    description = None

                    # Look forward and backward for context
                    for offset in [-3, -2, -1, 1, 2, 3, 4, 5, 6]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]

                            # Try to extract time
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue

                            # Try to extract title (avoid generic navigation text)
                            if not title and len(check_line) > 5 and len(check_line) < 200:
                                # Skip navigation and common UI elements
                                skip_keywords = [
                                    "calendar", "view", "month", "week", "day",
                                    "next", "previous", "today", "register",
                                    "more info", "details", "location:",
                                ]
                                if not any(skip in check_line.lower() for skip in skip_keywords):
                                    # Avoid lines that are just times or dates
                                    if not re.match(r"^\d{1,2}:\d{2}", check_line):
                                        if not re.match(r"^(January|February|March|April|May|June|July|August|September|October|November|December)", check_line):
                                            title = check_line
                                            continue

                            # Try to extract description
                            if title and not description and len(check_line) > 20 and len(check_line) < 300:
                                if check_line != title:
                                    description = check_line

                    # Must have a title
                    if not title or len(title) < 5:
                        i += 1
                        continue

                    # Dedupe by title and date
                    event_key = f"{title}|{date_str}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    content_hash = generate_content_hash(title, "Cancer Support Community Atlanta", date_str)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        i += 1
                        continue

                    # Determine category and tags
                    category, subcategory, tags = determine_category_and_tags(
                        title, description if description else ""
                    )

                    # Build full description
                    full_description = description if description else "Free cancer support program."
                    if "support group" in title.lower():
                        full_description = f"Support group for people affected by cancer. {full_description}"
                    elif "exercise" in title.lower() or "yoga" in title.lower():
                        full_description = f"Exercise program for people affected by cancer. {full_description}"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": full_description[:500],
                        "start_date": date_str,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,  # All CSC Atlanta programs are free
                        "source_url": CALENDAR_URL,
                        "ticket_url": CALENDAR_URL,
                        "image_url": None,
                        "raw_text": f"{title} - {full_description}"[:500],
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title[:50]}... on {date_str}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"CSC Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl CSC Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
