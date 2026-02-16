"""
Crawler for MedShare (medshare.org).

MedShare is a global healthcare nonprofit headquartered in Decatur, GA (near Emory).
They host signature fundraising events and regular volunteer sessions.

Crawls:
1. Special events from medshare.org/special-events/
2. Regular volunteer opportunities (scheduled sessions)

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://medshare.org"
EVENTS_URL = f"{BASE_URL}/special-events/"
VOLUNTEER_URL = f"{BASE_URL}/volunteer/atlanta/"

# MedShare HQ venue in Decatur
MEDSHARE_VENUE = {
    "name": "MedShare",
    "slug": "medshare",
    "address": "3240 Clifton Spring Rd",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30034",
    "lat": 33.7260,
    "lng": -84.2531,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "medical-supplies", "global-health", "near-emory"],
}

# Regular volunteer session schedule
VOLUNTEER_SESSIONS = [
    {"day": "Wednesday", "start_time": "09:00", "end_time": "12:00"},
    {"day": "Thursday", "start_time": "09:00", "end_time": "12:00"},
    {"day": "Thursday", "start_time": "13:00", "end_time": "16:00"},
    {"day": "Friday", "start_time": "09:00", "end_time": "12:00"},
    {"day": "Saturday", "start_time": "09:00", "end_time": "12:00"},
    {"day": "Saturday", "start_time": "13:00", "end_time": "16:00"},
]


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse various date formats from MedShare events.
    Examples: 'May 6, 2026', 'May 6, 2026 | 6:30PM'
    """
    try:
        # Clean up the string
        date_str = date_str.strip()

        # Remove time portion if present (after |)
        date_str = re.sub(r'\s*\|\s*.*$', '', date_str)

        # Try "Month DD, YYYY" format
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")

        # Try "Month DD" format (no year)
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2})', date_str)
        if match:
            month, day = match.groups()
            current_year = datetime.now().year
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d")

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date '{date_str}': {e}")

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:30PM', '6:30 PM', '10:00AM'
    """
    try:
        time_str = time_str.strip().upper()

        # Pattern: H:MM AM/PM or H AM/PM
        match = re.search(r'(\d{1,2}):?(\d{2})?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def get_next_weekday(weekday_name: str, weeks_ahead: int = 0) -> str:
    """
    Get the next occurrence of a given weekday.

    Args:
        weekday_name: Day name (e.g., 'Monday', 'Tuesday')
        weeks_ahead: How many weeks in the future (0 = next occurrence)

    Returns:
        Date string in YYYY-MM-DD format
    """
    weekdays = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6
    }

    target_weekday = weekdays.get(weekday_name)
    if target_weekday is None:
        raise ValueError(f"Invalid weekday: {weekday_name}")

    today = datetime.now().date()
    current_weekday = today.weekday()

    # Days until next occurrence
    days_ahead = (target_weekday - current_weekday) % 7
    if days_ahead == 0 and weeks_ahead == 0:
        # If today is the target day, get next week's
        days_ahead = 7

    # Add additional weeks
    days_ahead += weeks_ahead * 7

    next_date = today + timedelta(days=days_ahead)
    return next_date.strftime("%Y-%m-%d")


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl MedShare for special events and volunteer sessions using Playwright.

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get venue ID
            venue_id = get_or_create_venue(MEDSHARE_VENUE)

            # ===== Crawl special events =====
            logger.info(f"Fetching MedShare special events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Look for event sections - based on the structure we found
            event_sections = page.query_selector_all("section.f--section-c, .event-card, .event, article")

            logger.info(f"Found {len(event_sections)} potential event sections")

            for section in event_sections:
                try:
                    section_text = section.inner_text().strip()
                    if not section_text or len(section_text) < 20:
                        continue

                    # Look for date patterns in text
                    date_match = re.search(r'([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s*\|?\s*(\d{1,2}:\d{2}\s*[AP]M)?', section_text)
                    if not date_match:
                        continue

                    date_str = date_match.group(1)
                    time_str = date_match.group(2) if date_match.group(2) else None

                    start_date = parse_date_string(date_str)
                    if not start_date:
                        continue

                    start_time = parse_time_string(time_str) if time_str else None

                    # Extract title - look for heading or prominent text
                    title_elem = section.query_selector("h1, h2, h3, h4, .title, [class*='title']")
                    if title_elem:
                        title = title_elem.inner_text().strip()
                    else:
                        # Fallback: find first substantial line that's not the date
                        lines = [l.strip() for l in section_text.split("\n") if l.strip()]
                        title = None
                        for line in lines:
                            # Skip location lines, date lines, short lines
                            if line in ["Atlanta, GA", "Decatur, GA"]:
                                continue
                            if date_str in line:
                                continue
                            if len(line) > 10 and len(line) < 100:
                                title = line
                                break

                    if not title or len(title) < 3:
                        continue

                    # Extract description - get paragraphs or longer text blocks
                    description = ""
                    desc_elem = section.query_selector("p, .description, [class*='description']")
                    if desc_elem:
                        description = desc_elem.inner_text().strip()
                    elif len(section_text) > len(title) + 50:
                        # Use section text minus title as description
                        description = section_text.replace(title, "", 1).strip()
                        # Limit to first 500 chars
                        description = description[:500]

                    # Extract location if mentioned (might be different from HQ)
                    location_match = re.search(r'([\w\s]+(?:Theater|TreeHouse|Center|Hall|Park|Hotel))', section_text)
                    venue_name = location_match.group(1).strip() if location_match else "MedShare"

                    events_found += 1

                    content_hash = generate_content_hash(title, venue_name, start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Determine if it's free (fundraising events typically not free)
                    is_free = "free" in section_text.lower() or "no cost" in section_text.lower()

                    # Look for event URL
                    link_elem = section.query_selector("a[href]")
                    event_url = EVENTS_URL
                    if link_elem:
                        href = link_elem.get_attribute("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": "fundraiser",
                        "tags": ["fundraiser", "global-health", "medical-supplies", "nonprofit", "near-emory"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": None,
                        "raw_text": section_text[:500],
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added special event: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.debug(f"Error parsing event section: {e}")
                    continue

            # ===== Create recurring volunteer session events =====
            # Generate volunteer sessions for the next 8 weeks
            logger.info("Generating volunteer session events")

            for week in range(8):
                for session in VOLUNTEER_SESSIONS:
                    try:
                        session_date = get_next_weekday(session["day"], weeks_ahead=week)

                        # Skip if in the past
                        if session_date < datetime.now().strftime("%Y-%m-%d"):
                            continue

                        title = f"Volunteer Session - {session['day']} {session['start_time'][:2]}:{session['start_time'][3:5]} {'AM' if int(session['start_time'][:2]) < 12 else 'PM'}"

                        content_hash = generate_content_hash(
                            title, "MedShare", session_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        events_found += 1

                        description = (
                            "Join us for a volunteer session at MedShare! "
                            "Help sort and pack medical supplies that will be distributed to healthcare facilities "
                            "in need around the world. Youth volunteers ages 10-17 welcome. "
                            "Register in advance at medshare.org/volunteer/atlanta/"
                        )

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": session_date,
                            "start_time": session["start_time"],
                            "end_date": None,
                            "end_time": session["end_time"],
                            "is_all_day": False,
                            "category": "community",
                            "subcategory": "volunteer",
                            "tags": ["volunteer", "medical-supplies", "global-health", "family-friendly", "youth-welcome", "near-emory"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,
                            "source_url": VOLUNTEER_URL,
                            "ticket_url": VOLUNTEER_URL,
                            "image_url": None,
                            "raw_text": None,
                            "extraction_confidence": 1.0,
                            "is_recurring": True,
                            "recurrence_rule": f"Weekly on {session['day']} at {session['start_time']}",
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added volunteer session: {title} on {session_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert volunteer session: {e}")

                    except Exception as e:
                        logger.debug(f"Error creating volunteer session: {e}")
                        continue

            browser.close()

        logger.info(
            f"MedShare crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching MedShare: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl MedShare: {e}")
        raise

    return events_found, events_new, events_updated
