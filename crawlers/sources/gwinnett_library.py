"""
Crawler for Gwinnett County Public Library System events.
Uses Communico events platform (similar to DeKalb Library).
Covers all 15 library branches with storytimes, book clubs, educational programs, and more.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://gwinnettpl.libnet.info"
EVENTS_URL = f"{BASE_URL}/events?v=list"

# Map of Gwinnett County Public Library branches
BRANCH_VENUES = {
    "centerville": {
        "name": "Centerville Library",
        "slug": "centerville-library",
        "address": "3025 Bethany Church Rd",
        "city": "Snellville",
        "state": "GA",
        "zip": "30039",
        "venue_type": "library",
    },
    "collins hill": {
        "name": "Collins Hill Library",
        "slug": "collins-hill-library",
        "address": "455 Camp Perrin Rd",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30043",
        "venue_type": "library",
    },
    "dacula": {
        "name": "Dacula Library",
        "slug": "dacula-library",
        "address": "75 W Hightower Trail",
        "city": "Dacula",
        "state": "GA",
        "zip": "30019",
        "venue_type": "library",
    },
    "duluth": {
        "name": "Duluth Library",
        "slug": "duluth-library",
        "address": "3480 Howell Ferry Rd",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "venue_type": "library",
    },
    "five forks": {
        "name": "Five Forks Library",
        "slug": "five-forks-library",
        "address": "2780 Five Forks Trickum Rd SW",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30044",
        "venue_type": "library",
    },
    "grayson": {
        "name": "Grayson Library",
        "slug": "grayson-library",
        "address": "700 Grayson Pkwy",
        "city": "Grayson",
        "state": "GA",
        "zip": "30017",
        "venue_type": "library",
    },
    "hamilton mill": {
        "name": "Hamilton Mill Library",
        "slug": "hamilton-mill-library",
        "address": "3690 Braselton Hwy",
        "city": "Dacula",
        "state": "GA",
        "zip": "30019",
        "venue_type": "library",
    },
    "lawrenceville": {
        "name": "Lawrenceville Library",
        "slug": "lawrenceville-library",
        "address": "1001 Lawrenceville Hwy",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "venue_type": "library",
    },
    "lilburn": {
        "name": "Lilburn Library",
        "slug": "lilburn-library",
        "address": "4818 Church St",
        "city": "Lilburn",
        "state": "GA",
        "zip": "30047",
        "venue_type": "library",
    },
    "mountain park": {
        "name": "Mountain Park Library",
        "slug": "mountain-park-library",
        "address": "1210 Pounds Rd SW",
        "city": "Stone Mountain",
        "state": "GA",
        "zip": "30087",
        "venue_type": "library",
    },
    "norcross": {
        "name": "Norcross Library",
        "slug": "norcross-library",
        "address": "6025 Buford Hwy",
        "city": "Norcross",
        "state": "GA",
        "zip": "30071",
        "venue_type": "library",
    },
    "peachtree corners": {
        "name": "Peachtree Corners Library",
        "slug": "peachtree-corners-library",
        "address": "5570 Spalding Dr",
        "city": "Peachtree Corners",
        "state": "GA",
        "zip": "30092",
        "venue_type": "library",
    },
    "pinckneyville": {
        "name": "Pinckneyville Library",
        "slug": "pinckneyville-library",
        "address": "4650 Peachtree Industrial Blvd",
        "city": "Norcross",
        "state": "GA",
        "zip": "30071",
        "venue_type": "library",
    },
    "suwanee": {
        "name": "Suwanee Library",
        "slug": "suwanee-library",
        "address": "361 Main St",
        "city": "Suwanee",
        "state": "GA",
        "zip": "30024",
        "venue_type": "library",
    },
    "five forks": {
        "name": "Five Forks Library",
        "slug": "five-forks-library",
        "address": "2780 Five Forks Trickum Rd SW",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30044",
        "venue_type": "library",
    },
}

DEFAULT_VENUE = {
    "name": "Gwinnett County Public Library",
    "slug": "gwinnett-county-public-library",
    "city": "Lawrenceville",
    "state": "GA",
    "venue_type": "library",
}


def find_branch_venue(location_text: str) -> dict:
    """Find matching branch venue from location text."""
    if not location_text:
        return DEFAULT_VENUE

    location_lower = location_text.lower()
    for key, venue in BRANCH_VENUES.items():
        if key in location_lower:
            return venue
    return DEFAULT_VENUE


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    if not date_str:
        return None

    for fmt in ["%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%A, %B %d, %Y"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try partial formats (month day without year)
    current_year = datetime.now().year
    today = datetime.now().date()
    for fmt in ["%B %d", "%b %d"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            dt = dt.replace(year=current_year)
            if dt.date() < today:
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats like '9:30am' or '2:00 PM'."""
    if not time_str:
        return None

    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
    except Exception:
        pass
    return None


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, str, list]:
    """Determine category, subcategory, and tags from title and description."""
    text = f"{title} {description}".lower()

    tags = ["library", "free", "gwinnett"]

    # Add age-specific tags
    if any(word in text for word in ["baby", "infant", "toddler", "preschool"]):
        tags.append("kids")
        tags.append("family-friendly")
    elif any(word in text for word in ["storytime", "story time", "children"]):
        tags.append("kids")
        tags.append("family-friendly")
    elif "teen" in text or "tween" in text or "young adult" in text or "ya " in text:
        tags.append("teens")
    elif "adult" in text and "young adult" not in text:
        tags.append("adults")
    else:
        tags.append("family-friendly")

    # Determine category and subcategory
    if "book club" in text or "reading group" in text or "book discussion" in text:
        return "words", "words.bookclub", tags
    elif "storytime" in text or "story time" in text:
        return "words", "words.storytelling", tags
    elif "author" in text or "book signing" in text:
        return "words", "words.reading", tags
    elif "poetry" in text or "poem" in text:
        return "words", "words.poetry", tags
    elif "writing" in text or "writer" in text:
        return "words", "words.workshop", tags
    elif any(word in text for word in ["computer", "technology", "coding", "tech", "digital"]):
        tags.append("educational")
        return "learning", None, tags
    elif any(word in text for word in ["craft", "art", "make", "create", "diy"]):
        tags.append("hands-on")
        return "art", None, tags
    elif any(word in text for word in ["music", "concert", "sing"]):
        return "music", None, tags
    elif any(word in text for word in ["film", "movie", "cinema"]):
        return "film", None, tags
    elif any(word in text for word in ["game", "gaming", "play"]):
        tags.append("play")
        return "play", None, tags
    elif any(word in text for word in ["fitness", "yoga", "exercise", "wellness"]):
        return "fitness", None, tags
    else:
        # Default to words/lecture for general library programs
        tags.append("educational")
        return "words", "words.lecture", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Gwinnett County Public Library events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            )
            page = context.new_page()

            logger.info(f"Fetching Gwinnett Library events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll down to load more events (Communico lazy-loads content)
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Get full page text and parse events
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Find event links for URLs
            event_links = page.query_selector_all("a[href*='/event/']")
            event_urls = {}
            for link in event_links:
                title = link.inner_text().strip()
                href = link.get_attribute("href")
                if title and href:
                    event_urls[title] = href

            logger.info(f"Found {len(event_urls)} unique event titles")

            seen_titles = set()
            i = 0

            while i < len(lines):
                line = lines[i]

                # Look for event titles (lines that match our URL dict)
                if line in event_urls and line not in seen_titles:
                    title = line
                    seen_titles.add(title)

                    # Next line should have date/time format like: "Wednesday, January 29: 10:30am - 11:00am"
                    date_line = lines[i + 1] if i + 1 < len(lines) else ""
                    location_line = lines[i + 2] if i + 2 < len(lines) else ""

                    # Parse date - format variations:
                    # "Wednesday, January 14: 9:30am" or "January 14: 9:30am"
                    date_match = re.search(r"(\w+)\s+(\d{1,2}):", date_line)
                    if not date_match:
                        i += 1
                        continue

                    month_str, day = date_match.groups()
                    start_date = parse_date(f"{month_str} {day}")
                    if not start_date:
                        i += 1
                        continue

                    # Skip past events
                    try:
                        event_date = datetime.strptime(start_date, "%Y-%m-%d")
                        if event_date.date() < datetime.now().date():
                            i += 1
                            continue
                    except ValueError:
                        i += 1
                        continue

                    # Parse time - format: "9:30am - 10:00am" or "2:00 PM"
                    time_match = re.search(r"(\d{1,2}:\d{2}\s*(am|pm))", date_line, re.I)
                    start_time = parse_time(time_match.group()) if time_match else None

                    # Parse end time if present
                    end_time_match = re.search(
                        r"-\s*(\d{1,2}:\d{2}\s*(am|pm))", date_line, re.I
                    )
                    end_time = parse_time(end_time_match.group(1)) if end_time_match else None

                    # Get location from the line after date/time
                    venue_data = find_branch_venue(location_line)
                    venue_id = get_or_create_venue(venue_data)

                    href = event_urls.get(title, "")

                    events_found += 1

                    content_hash = generate_content_hash(
                        title, venue_data["name"], start_date
                    )

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Determine category and tags
                    category, subcategory, tags = determine_category_and_tags(title)

                    event_url = (
                        f"{BASE_URL}{href}"
                        if href and href.startswith("/")
                        else (href or EVENTS_URL)
                    )

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": end_time,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": image_map.get(title),
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {venue_data['name']}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Gwinnett Library crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Gwinnett Library: {e}")
        raise

    return events_found, events_new, events_updated
