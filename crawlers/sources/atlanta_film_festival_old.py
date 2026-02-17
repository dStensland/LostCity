"""
Crawler for Atlanta Film Festival (atlantafilmfestival.com).
Annual film festival showcasing independent films.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantafilmfestival.com"

# Festival uses multiple venues - we'll create a general festival venue
VENUE_DATA = {
    "name": "Atlanta Film Festival",
    "slug": "atlanta-film-festival",
    "address": "535 Means St NW",  # Festival HQ
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "venue_type": "festival",
    "website": BASE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Film Festival schedule."""
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

            # Try schedule page first
            schedule_url = f"{BASE_URL}/schedule"
            logger.info(f"Fetching Atlanta Film Festival: {schedule_url}")

            try:
                page.goto(schedule_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Extract images from page
                image_map = extract_images_from_page(page)
            except Exception:
                # Fall back to main page
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Look for film screenings with dates
            # Typical pattern: Film Title / Date / Time / Venue
            current_year = datetime.now().year

            i = 0
            while i < len(lines):
                line = lines[i]

                # Look for date patterns in festival schedule
                # Format varies: "April 15, 2026" or "Apr 15" etc.
                date_match = re.search(
                    r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})?",
                    line,
                    re.IGNORECASE,
                )

                if date_match:
                    month, day, year = date_match.groups()
                    year = int(year) if year else current_year

                    # Try to find film title nearby (usually before or after date)
                    title = None

                    # Check previous lines for title
                    if i > 0:
                        prev_line = lines[i - 1]
                        skip_words = [
                            "Schedule",
                            "Program",
                            "Buy",
                            "Badge",
                            "Submit",
                            "ATLFF",
                        ]
                        if len(prev_line) > 5 and not any(
                            w.lower() in prev_line.lower() for w in skip_words
                        ):
                            if not re.search(r"\d{1,2}:\d{2}", prev_line):  # Not a time
                                title = prev_line

                    if title:
                        # Parse date
                        for fmt in ["%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"]:
                            try:
                                dt = datetime.strptime(
                                    f"{month} {day}, {year}", fmt.replace(" %Y", ", %Y")
                                )
                                start_date = dt.strftime("%Y-%m-%d")
                                break
                            except ValueError:
                                try:
                                    dt = datetime.strptime(
                                        f"{month} {day} {year}",
                                        fmt.replace(", %Y", " %Y"),
                                    )
                                    start_date = dt.strftime("%Y-%m-%d")
                                    break
                                except ValueError:
                                    continue
                        else:
                            i += 1
                            continue

                        events_found += 1

                        content_hash = generate_content_hash(
                            title, "Atlanta Film Festival", start_date
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                        else:
                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": "Atlanta Film Festival screening",
                                "start_date": start_date,
                                "start_time": None,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "film",
                                "tags": [
                                    "film",
                                    "festival",
                                    "independent",
                                    "atlanta-film-festival",
                                ],
                                "price_min": None,
                                "price_max": None,
                                "price_note": "Requires festival badge or individual tickets",
                                "is_free": False,
                                "source_url": schedule_url,
                                "ticket_url": None,
                                "image_url": image_map.get(title),
                                "raw_text": None,
                                "extraction_confidence": 0.80,
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

            # If no schedule found, note that festival may not be active
            if events_found == 0:
                logger.info(
                    "No current festival schedule found - festival may be between seasons"
                )

            browser.close()

        logger.info(
            f"Atlanta Film Festival crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Film Festival: {e}")
        raise

    return events_found, events_new, events_updated
