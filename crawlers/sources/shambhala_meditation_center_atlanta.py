"""
Crawler for Shambhala Meditation Center of Atlanta.
https://atlanta.shambhala.org/monthly-calendar/

Shambhala meditation center in Decatur offering open houses, meditation instruction,
Tai Chi/Qigong, LGBTQ Sangha, POC Sangha, and special practice sessions.
Most events are free or by donation and explicitly public.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlanta.shambhala.org"
CALENDAR_URL = f"{BASE_URL}/monthly-calendar/"

VENUE_DATA = {
    "name": "Shambhala Meditation Center of Atlanta",
    "slug": "shambhala-meditation-center-atlanta",
    "address": "1447 Church St",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7748,
    "lng": -84.2963,
    "venue_type": "community_center_religious",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["faith-buddhist", "intimate", "all-ages", "lgbtq-friendly"],
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from formats like '7pm', '10:30 AM', '6:00 pm'."""
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


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from various formats used by the Shambhala calendar plugin.
    Examples: "February 10", "Feb 10 2026", "Monday, February 10"
    Returns YYYY-MM-DD format.
    """
    current_year = datetime.now().year

    # Try full month name with optional year
    date_match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2})(?:,?\s+(\d{4}))?",
        date_text,
        re.IGNORECASE
    )

    if date_match:
        month_name = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year

        try:
            dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
            # If date is in the past and no year was specified, assume next year
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month_name} {day} {year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def determine_category_and_series(title: str, description: str) -> tuple[str, Optional[str], list[str], Optional[dict]]:
    """Determine category, subcategory, tags, and series hint based on event content."""
    text = f"{title} {description}".lower()
    tags = ["faith-buddhist", "meditation", "shambhala"]

    # LGBTQ Sangha
    if "lgbtq" in text or "queer dharma" in text:
        return "wellness", None, tags + ["lgbtq", "lgbtq-friendly"], {
            "series_type": "recurring_show",
            "series_title": "LGBTQ Sangha",
            "frequency": "monthly",
            "description": "Monthly LGBTQ meditation and community gathering",
        }

    # POC/BIPOC Sangha
    if "poc" in text or "bipoc" in text or "people of color" in text:
        return "wellness", None, tags + ["poc", "bipoc"], {
            "series_type": "recurring_show",
            "series_title": "BIPOC Sangha",
            "frequency": "monthly",
            "description": "Monthly meditation for Black, Indigenous, and People of Color",
        }

    # Tai Chi / Qigong
    if "tai chi" in text or "qigong" in text:
        return "wellness", None, tags + ["tai-chi", "movement"], {
            "series_type": "recurring_show",
            "series_title": "Tai Chi & Qigong",
            "frequency": "weekly",
            "description": "Weekly Tai Chi and Qigong practice",
        }

    # Open House / Introductory events
    if "open house" in text or "open meditation" in text:
        return "wellness", None, tags + ["beginner-friendly", "all-levels"], None

    # Meditation instruction
    if "meditation instruction" in text or "intro to meditation" in text or "basics of meditation" in text:
        return "learning", None, tags + ["beginner", "instruction"], None

    # Practice sessions (recurring)
    if "practice" in text and not "tai chi" in text:
        if "morning" in text:
            return "wellness", None, tags + ["morning", "practice"], {
                "series_type": "recurring_show",
                "series_title": "Morning Meditation Practice",
                "frequency": "weekly",
                "description": "Weekly morning meditation practice",
            }
        if "evening" in text:
            return "wellness", None, tags + ["evening", "practice"], {
                "series_type": "recurring_show",
                "series_title": "Evening Meditation Practice",
                "frequency": "weekly",
                "description": "Weekly evening meditation practice",
            }
        if "sunday" in text:
            return "wellness", None, tags + ["sunday"], {
                "series_type": "recurring_show",
                "series_title": "Sunday Meditation",
                "frequency": "weekly",
                "day_of_week": "Sunday",
                "description": "Weekly Sunday meditation",
            }
        return "wellness", None, tags + ["practice"], None

    # Workshops and special teachings
    if any(kw in text for kw in ["workshop", "teaching", "seminar", "class"]):
        return "learning", None, tags + ["workshop"], None

    # Special events and celebrations
    if any(kw in text for kw in ["celebration", "gathering", "potluck"]):
        return "community", None, tags + ["social"], None

    # Default to wellness for meditation-focused events
    return "wellness", None, tags, None


def extract_events_from_calendar_plugin(page) -> list[dict]:
    """
    Extract events from Shambhala's WordPress calendar plugin.
    The site uses a custom Shambhala programs plugin with calendar shortcode.
    """
    events = []

    # Wait for calendar to load
    page.wait_for_timeout(2000)

    # Try multiple selectors that might contain events
    # Shambhala centers often use custom plugins, so we need to be flexible
    selectors = [
        ".program-item",
        ".calendar-event",
        ".event-item",
        "article.program",
        ".rs-listing-item",  # Retreat Guru plugin
        ".sdb-program",  # Shambhala Database Calendar
        "div[class*='program']",
        "li[class*='event']",
    ]

    for selector in selectors:
        elements = page.query_selector_all(selector)
        if elements:
            logger.info(f"Found {len(elements)} events using selector: {selector}")

            for elem in elements:
                try:
                    text = elem.inner_text().strip()
                    if len(text) < 10:
                        continue

                    # Extract title
                    title_elem = elem.query_selector("h2, h3, h4, .program-title, .event-title, strong")
                    title = title_elem.inner_text().strip() if title_elem else text.split("\n")[0]

                    # Get full text for date/time parsing
                    full_text = text

                    # Try to extract link
                    link_elem = elem.query_selector("a")
                    event_url = link_elem.get_attribute("href") if link_elem else CALENDAR_URL
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    events.append({
                        "title": title,
                        "full_text": full_text,
                        "url": event_url,
                    })
                except Exception as e:
                    logger.debug(f"Error extracting event with {selector}: {e}")
                    continue

            # If we found events, stop trying other selectors
            if events:
                break

    # If no events found with specific selectors, try parsing the page content more broadly
    if not events:
        logger.info("No events found with specific selectors, trying broad text parsing")
        html = page.content()
        soup = BeautifulSoup(html, "lxml")

        # Look for calendar table or event list structures
        calendar_containers = soup.find_all(["table", "div"], class_=lambda x: x and ("calendar" in x.lower() or "program" in x.lower()))

        for container in calendar_containers:
            text_content = container.get_text(separator="\n", strip=True)
            lines = [l.strip() for l in text_content.split("\n") if l.strip()]

            # Look for date patterns followed by event info
            current_date = None
            for i, line in enumerate(lines):
                # Check if this line contains a date
                parsed_date = parse_date(line)
                if parsed_date:
                    current_date = parsed_date
                    # Next lines might be events for this date
                    continue

                if current_date and len(line) > 10:
                    # This might be an event
                    events.append({
                        "title": line,
                        "full_text": line,
                        "url": CALENDAR_URL,
                        "parsed_date": current_date,
                    })

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Shambhala Meditation Center of Atlanta events using Playwright."""
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

            logger.info(f"Fetching Shambhala Atlanta calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)

            # Scroll to load dynamic content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract events
            event_items = extract_events_from_calendar_plugin(page)
            logger.info(f"Extracted {len(event_items)} potential events")

            seen_events = set()

            for event_data in event_items:
                try:
                    title = event_data["title"]

                    # Skip if title is too short or looks like a header
                    if len(title) < 5 or title.lower() in ["date", "time", "event", "program", "calendar"]:
                        continue

                    full_text = event_data.get("full_text", title)

                    # Parse date
                    start_date = event_data.get("parsed_date") or parse_date(full_text)
                    if not start_date:
                        logger.debug(f"No date found for: {title[:50]}")
                        continue

                    # Skip past events
                    event_date = datetime.strptime(start_date, "%Y-%m-%d")
                    if event_date.date() < datetime.now().date():
                        continue

                    # Parse time
                    start_time = parse_time(full_text)

                    # Build description from full text (excluding title and date/time info)
                    description_lines = []
                    for line in full_text.split("\n"):
                        if line.strip() == title:
                            continue
                        if parse_date(line) or parse_time(line):
                            continue
                        if len(line) > 20:
                            description_lines.append(line.strip())
                            if len(description_lines) >= 2:
                                break

                    description = " ".join(description_lines) if description_lines else f"Event at Shambhala Meditation Center of Atlanta"

                    # Dedupe by title + date
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Shambhala Meditation Center of Atlanta", start_date
                    )

                    # Check for existing
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Determine category and tags
                    category, subcategory, tags, series_hint = determine_category_and_series(title, description)

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
                        "source_url": event_data.get("url", CALENDAR_URL),
                        "ticket_url": event_data.get("url", CALENDAR_URL),
                        "image_url": None,
                        "raw_text": full_text[:500],
                        "extraction_confidence": 0.75,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title[:50]}... on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Shambhala Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Shambhala Meditation Center of Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
