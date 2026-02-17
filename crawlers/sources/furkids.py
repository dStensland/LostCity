"""
Crawler for Furkids Animal Rescue & Shelters (furkids.org).
Georgia's largest no-kill animal rescue with adoption events, volunteer opportunities,
fundraisers, and community programs.

Events page uses modals for detail pages. Uses Playwright for JS-rendered content.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, date
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://furkids.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Furkids Animal Rescue",
    "slug": "furkids-animal-rescue",
    "address": "5235 Union Hill Rd",
    "neighborhood": "Cumming",
    "city": "Cumming",
    "state": "GA",
    "zip": "30028",
    "lat": 34.2026,
    "lng": -84.1322,
    "venue_type": "animal_shelter",
    "spot_type": "animal_shelter",
    "website": BASE_URL,
    "vibes": ["dog-friendly", "family-friendly", "adoption", "no-kill"],
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from formats like 'Saturday, February 7, 2026' or 'February 28, 2026'."""
    date_text = date_text.strip()
    now = datetime.now()
    year = now.year

    # Remove day of week prefix
    date_text = re.sub(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*",
        "", date_text, flags=re.IGNORECASE,
    )

    # Try various date formats
    for fmt in ("%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y", "%B %d", "%b %d"):
        try:
            dt = datetime.strptime(date_text, fmt)
            if "%Y" not in fmt:
                dt = dt.replace(year=year)
                # If date is in the past, assume next year
                if dt.date() < now.date():
                    dt = dt.replace(year=year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from formats like '11:00am', '4:00 PM', '2pm'."""
    if not time_text:
        return None

    time_text = time_text.strip()

    # Match patterns like "11:00am", "4:00 PM", "2pm", "10:30AM"
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def parse_time_range(time_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse time ranges like '4:00 PM – 6:30 PM' or '11AM - 2PM'."""
    if not time_text:
        return None, None

    # Match time ranges with various separators
    range_match = re.search(
        r"(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))",
        time_text, re.IGNORECASE
    )

    if range_match:
        start_time = parse_time(range_match.group(1))
        end_time = parse_time(range_match.group(2))
        return start_time, end_time

    # Single time
    single_time = parse_time(time_text)
    return single_time, None


def categorize_event(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Categorize event based on title and description."""
    text = f"{title} {description}".lower()
    base_tags = ["animals", "adoption", "furkids", "no-kill"]

    # Adoption events
    if any(word in text for word in ["adoption", "adopt", "meet the pets", "open house"]):
        return "family", "adoption-event", base_tags + ["family-friendly"]

    # Vaccine/medical clinics
    if any(word in text for word in ["vaccine", "vaccination", "clinic", "spay", "neuter", "wellness"]):
        return "family", "pet-clinic", base_tags + ["pets", "family-friendly"]

    # Volunteer events
    if any(word in text for word in ["volunteer", "orientation"]):
        return "community", "volunteer", base_tags + ["volunteer"]

    # Foster events
    if "foster" in text:
        return "community", "foster", base_tags + ["volunteer", "foster"]

    # Fundraisers
    if any(word in text for word in ["fundraiser", "gala", "benefit", "strut your mutt", "donation", "auction"]):
        return "community", "fundraiser", base_tags + ["fundraiser"]

    # Book events
    if any(word in text for word in ["book launch", "book signing", "author"]):
        return "arts_culture", "book-event", base_tags + ["books", "fundraiser"]

    # Educational workshops
    if any(word in text for word in ["workshop", "class", "training", "seminar", "learn"]):
        return "learning", "workshop", base_tags + ["education", "family-friendly"]

    # Field trips / special programs
    if any(word in text for word in ["field trip", "doggie day out", "day out"]):
        return "family", "animal-event", base_tags + ["family-friendly", "dog-friendly"]

    # Default to family event
    return "family", "animal-event", base_tags + ["family-friendly"]


def extract_event_details(page, modal_url: str) -> Optional[dict]:
    """Navigate to modal URL and extract event details."""
    try:
        page.goto(modal_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Extract title
        title_elem = soup.select_one(".modal-title, h1, h2")
        if not title_elem:
            return None
        title = title_elem.get_text(strip=True)

        # Get modal body text
        body = soup.select_one(".modal-body")
        if not body:
            return None

        body_text = body.get_text()
        lines = [line.strip() for line in body_text.split("\n") if line.strip()]

        # Parse start date and time
        # Format: "Starts Saturday, February 7, 2026 at 11:00am"
        start_date = None
        start_time = None
        end_time = None

        for line in lines:
            if "starts" in line.lower():
                # Extract date
                date_match = re.search(
                    r"(?:starts\s+)?(?:on\s+)?(\w+,?\s+\w+\s+\d{1,2},?\s+\d{4})",
                    line, re.IGNORECASE
                )
                if date_match:
                    start_date = parse_date(date_match.group(1))

                # Extract time
                time_match = re.search(r"at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))", line, re.IGNORECASE)
                if time_match:
                    start_time = parse_time(time_match.group(1))

        if not start_date:
            logger.warning(f"Could not parse date from modal: {title}")
            return None

        # Build description from body text
        description_parts = []
        for line in lines:
            # Skip the date/time line
            if "starts" in line.lower():
                continue
            # Collect description lines
            if len(line) > 20 and not line.startswith("Share:"):
                description_parts.append(line)

        description = " ".join(description_parts[:5])  # First few lines

        # Look for time ranges in description (e.g., "11AM - 2PM")
        if description and not end_time:
            start_parsed, end_parsed = parse_time_range(description)
            if start_parsed and not start_time:
                start_time = start_parsed
            if end_parsed:
                end_time = end_parsed

        # Extract image if available
        image_url = None
        img = soup.select_one(".modal-body img, .event-image img")
        if img and img.get("src"):
            image_url = img["src"]
            if not image_url.startswith("http"):
                image_url = f"{BASE_URL}{image_url}"

        return {
            "title": title,
            "description": description[:1000] if description else f"{title} at Furkids Animal Rescue",
            "start_date": start_date,
            "start_time": start_time,
            "end_time": end_time,
            "image_url": image_url,
            "source_url": modal_url,
        }

    except Exception as e:
        logger.error(f"Error fetching modal {modal_url}: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Furkids Animal Rescue events using Playwright."""
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

            logger.info(f"Fetching Furkids events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load lazy content and calendar
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2000)

            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event modal links
            event_links = []
            for link in soup.select('a[href*="/events/"]'):
                href = link.get("href", "")
                if "/modal/" in href:
                    full_url = href if href.startswith("http") else f"{BASE_URL}{href}"
                    if full_url not in event_links:
                        event_links.append(full_url)

            logger.info(f"Found {len(event_links)} event modal URLs")

            today = date.today()

            for modal_url in event_links:
                event_data = extract_event_details(page, modal_url)

                if not event_data:
                    continue

                # Skip past events
                try:
                    event_date = datetime.strptime(event_data["start_date"], "%Y-%m-%d").date()
                    if event_date < today:
                        logger.debug(f"Skipping past event: {event_data['title']}")
                        continue
                except (ValueError, TypeError):
                    logger.warning(f"Invalid date for event: {event_data['title']}")
                    continue

                events_found += 1

                # Categorize event
                category, subcategory, tags = categorize_event(
                    event_data["title"],
                    event_data["description"]
                )

                # Generate content hash for deduplication
                content_hash = generate_content_hash(
                    event_data["title"],
                    "Furkids Animal Rescue",
                    event_data["start_date"]
                )


                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": event_data["title"],
                    "description": event_data["description"],
                    "start_date": event_data["start_date"],
                    "start_time": event_data["start_time"],
                    "end_date": None,
                    "end_time": event_data["end_time"],
                    "is_all_day": False,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free or discounted adoption fees may apply",
                    "is_free": True,
                    "source_url": event_data["source_url"],
                    "ticket_url": event_data["source_url"],
                    "image_url": event_data["image_url"],
                    "raw_text": f"{event_data['title']} - {event_data['description'][:200]}",
                    "extraction_confidence": 0.90,
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
                    logger.info(
                        f"  Added: [{category}] {event_data['title']} on {event_data['start_date']} "
                        f"at {event_data['start_time']}"
                    )
                except Exception as e:
                    logger.error(f"  Failed to insert: {event_data['title']}: {e}")

            browser.close()

        logger.info(
            f"Furkids crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Furkids: {e}")
        raise

    return events_found, events_new, events_updated
