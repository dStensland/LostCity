"""
Crawler for Zoo Atlanta (zooatlanta.org).
Historic zoo in Grant Park with special events and programs.

Site uses JavaScript rendering - must use Playwright.
URL: /visit/events/
Format: TITLE, Date range, Description, "READ MORE"
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

BASE_URL = "https://zooatlanta.org"
EVENTS_URL = f"{BASE_URL}/visit/events/"

VENUE_DATA = {
    "name": "Zoo Atlanta",
    "slug": "zoo-atlanta",
    "address": "800 Cherokee Ave SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.7328,
    "lng": -84.3697,
    "venue_type": "zoo",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats like 'March 14, 2026' or 'April 26'."""
    date_text = date_text.strip()

    # Full date: "March 14, 2026"
    match = re.search(r"(\w+)\s+(\d{1,2}),?\s*(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Short month: "Feb. 14" or "Feb 14"
    match = re.search(r"(\w+)\.?\s+(\d{1,2})", date_text)
    if match:
        month, day = match.groups()
        year = datetime.now().year
        # Try full month name first
        for fmt in ["%B %d", "%b %d"]:
            try:
                dt = datetime.strptime(f"{month} {day}", fmt)
                dt = dt.replace(year=year)
                if dt < datetime.now():
                    dt = dt.replace(year=year + 1)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Zoo Atlanta events using Playwright."""
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

            logger.info(f"Fetching Zoo Atlanta: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = ["visit", "visit home", "zoo map", "experiences", "create an itinerary",
                         "events", "groups", "support", "donate", "individual giving",
                         "corporate giving", "volunteer", "beastly feast", "learn", "teachers",
                         "parents", "teens", "adults", "schools", "animals", "conservation",
                         "research", "plan an event", "panda legacy", "search", "today",
                         "tickets", "membership", "read more", "last admission", "before you go",
                         "getting here", "rules", "accessibility", "chill factors", "hot tips",
                         "all free events", "events for adults", "events for kids",
                         "member events", "educator events", "connect with your wild side",
                         "about", "site map", "careers", "privacy policy", "press"]

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip nav/UI items
                if line.lower() in skip_items or len(line) < 5:
                    i += 1
                    continue

                # Look for event titles (typically all caps or title case, followed by date)
                # Events have: TITLE, date line, description, "READ MORE"
                is_title_like = (
                    len(line) > 10 and
                    len(line) < 100 and
                    not line.lower().startswith("select") and
                    not re.match(r"^\d", line) and
                    line[0].isupper()
                )

                if is_title_like:
                    # Check if next line looks like a date
                    if i + 1 < len(lines):
                        next_line = lines[i + 1]

                        # Date patterns: "Select nights, Nov. 21 - Jan. 18", "February 14 and 15", "March 14, 2026"
                        date_found = False
                        start_date = None

                        # Check for explicit date with year
                        if re.search(r"\d{4}", next_line):
                            start_date = parse_date(next_line)
                            date_found = start_date is not None
                        # Check for month and day
                        elif re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}", next_line, re.IGNORECASE):
                            start_date = parse_date(next_line)
                            date_found = start_date is not None

                        if date_found and start_date:
                            title = line

                            # Get description (2 lines after title)
                            description = None
                            if i + 2 < len(lines):
                                desc_line = lines[i + 2]
                                if desc_line.lower() not in skip_items and len(desc_line) > 20:
                                    description = desc_line[:500]

                            # Check for duplicates
                            event_key = f"{title}|{start_date}"
                            if event_key in seen_events:
                                i += 1
                                continue
                            seen_events.add(event_key)

                            events_found += 1

                            # Generate content hash
                            content_hash = generate_content_hash(title, "Zoo Atlanta", start_date)

                            # Check for existing
                            existing = find_event_by_hash(content_hash)
                            if existing:
                                events_updated += 1
                                i += 1
                                continue

                            # Determine category
                            title_lower = title.lower()
                            if any(w in title_lower for w in ["brew", "sip", "night out"]):
                                category = "food_drink"
                                subcategory = "beer"
                                tags = ["zoo-atlanta", "grant-park", "adults-only", "21+"]
                            elif any(w in title_lower for w in ["run", "5k", "race"]):
                                category = "fitness"
                                subcategory = "running"
                                tags = ["zoo-atlanta", "grant-park", "fitness", "running"]
                            elif any(w in title_lower for w in ["gala", "beastly"]):
                                category = "community"
                                subcategory = "fundraiser"
                                tags = ["zoo-atlanta", "grant-park", "gala", "fundraiser"]
                            elif any(w in title_lower for w in ["educator", "teacher"]):
                                category = "community"
                                subcategory = "education"
                                tags = ["zoo-atlanta", "grant-park", "education", "teachers"]
                            elif any(w in title_lower for w in ["science", "bird"]):
                                category = "community"
                                subcategory = "education"
                                tags = ["zoo-atlanta", "grant-park", "science", "family"]
                            elif any(w in title_lower for w in ["illuminights", "lights"]):
                                category = "family"
                                subcategory = "holiday"
                                tags = ["zoo-atlanta", "grant-park", "holiday", "lights", "family"]
                            else:
                                category = "family"
                                subcategory = "zoo"
                                tags = ["zoo-atlanta", "grant-park", "family", "zoo", "animals"]

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description,
                                "start_date": start_date,
                                "start_time": None,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": True,
                                "category": category,
                                "subcategory": subcategory,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": "May require separate ticket",
                                "is_free": False,
                                "source_url": EVENTS_URL,
                                "ticket_url": EVENTS_URL,
                                "image_url": None,
                                "raw_text": f"{title} - {next_line}",
                                "extraction_confidence": 0.85,
                                "is_recurring": False,
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
            f"Zoo Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Zoo Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
