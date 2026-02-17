"""
Crawler for Piedmont HealthCare Events Calendar (piedmonthealthcare.com/events).

Note: piedmonthealthcare.com is a different organization from piedmont.org (Piedmont Healthcare).
This site covers multi-site events across the Piedmont HealthCare system.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.piedmonthealthcare.com"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Piedmont HealthCare",
    "slug": "piedmont-healthcare-nc",
    "address": "125 E. Medical Drive",
    "neighborhood": None,
    "city": "Statesville",
    "state": "NC",
    "zip": "28677",
    "venue_type": "hospital",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    date_text = date_text.strip()

    patterns = [
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        r"(\d{1,2})/(\d{1,2})/(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            groups = match.groups()
            if len(groups) == 3:
                if groups[0].isdigit():
                    # MM/DD/YYYY
                    try:
                        dt = datetime(int(groups[2]), int(groups[0]), int(groups[1]))
                        return dt.strftime("%Y-%m-%d")
                    except ValueError:
                        continue
                else:
                    # Month DD, YYYY
                    try:
                        month = groups[0][:3] if len(groups[0]) > 3 else groups[0]
                        dt = datetime.strptime(f"{month} {groups[1]} {groups[2]}", "%b %d %Y")
                        return dt.strftime("%Y-%m-%d")
                    except ValueError:
                        continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    if not time_text:
        return None

    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)", time_text)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3).upper()

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    text = f"{title} {description}".lower()
    base_tags = ["piedmont", "healthcare"]

    if "class" in text or "education" in text or "learn" in text:
        return "learning", "health-education", base_tags + ["class", "education"]
    if "support group" in text or "support" in text:
        return "community", "support-group", base_tags + ["support-group"]
    if "screening" in text or "health fair" in text:
        return "wellness", "health-screening", base_tags + ["screening", "free"]
    if "yoga" in text or "fitness" in text or "exercise" in text:
        return "fitness", "class", base_tags + ["fitness", "exercise"]
    if "diabetes" in text:
        return "wellness", "health-education", base_tags + ["diabetes", "education"]
    if "childbirth" in text or "maternity" in text or "prenatal" in text or "baby" in text:
        return "family", "maternity", base_tags + ["maternity", "prenatal"]
    if "cpr" in text or "first aid" in text:
        return "learning", "safety", base_tags + ["cpr", "safety", "certification"]

    return "community", "health", base_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont HealthCare events calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Piedmont HealthCare Events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            skip_items = [
                "home", "about", "contact", "menu", "search", "events",
                "calendar", "find a doctor", "locations", "services",
                "patient portal", "careers", "donate",
            ]

            seen_events = set()
            i = 0

            while i < len(lines):
                line = lines[i]
                line_lower = line.lower()

                if line_lower in skip_items or len(line) < 5:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.search(
                    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:-\d{1,2})?,?\s+\d{4}",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    date_text = date_match.group(0)
                    date_text = re.sub(r"-\d{1,2}", "", date_text)
                    start_date = parse_date(date_text)

                    if not start_date:
                        i += 1
                        continue

                    try:
                        event_date = datetime.strptime(start_date, "%Y-%m-%d")
                        if event_date.date() < datetime.now().date():
                            i += 1
                            continue
                    except ValueError:
                        i += 1
                        continue

                    title = None
                    description = None
                    start_time = None
                    location = None

                    # Look for title in previous lines
                    for offset in range(-5, 0):
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx].strip()
                            if check_line.lower() in skip_items:
                                continue
                            if 10 < len(check_line) < 150:
                                if not re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d", check_line, re.IGNORECASE):
                                    title = check_line
                                    break

                    # Look for time, location, and description in following lines
                    for offset in range(1, 8):
                        idx = i + offset
                        if idx < len(lines):
                            check_line = lines[idx].strip()
                            if check_line.lower() in skip_items:
                                continue

                            # Look for time
                            if not start_time:
                                time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))", check_line)
                                if time_match:
                                    start_time = parse_time(time_match.group(1))
                                    continue

                            # Look for location
                            if not location and any(loc in check_line.lower() for loc in ["location", "room", "building", "center", "hospital"]):
                                location = check_line

                            # Look for description
                            if len(check_line) > 50 and not description:
                                description = check_line[:500]

                    if not title:
                        i += 1
                        continue

                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Determine venue
                    venue_data = VENUE_DATA.copy()
                    if location:
                        # Try to extract a specific venue
                        venue_data["name"] = location[:100] if len(location) > 5 else VENUE_DATA["name"]

                    venue_id = get_or_create_venue(venue_data)

                    content_hash = generate_content_hash(
                        title, venue_data["name"], start_date
                    )


                    category, subcategory, tags = determine_category(title, description or "")

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "portal_id": portal_id,
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
                        "price_note": "Registration may be required",
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.8,
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

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Piedmont HealthCare Events crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont HealthCare Events: {e}")
        raise

    return events_found, events_new, events_updated
