"""
Crawler for Plaza Theatre Atlanta (plazaatlanta.com).
Historic independent cinema showing first-run indie, classic, and cult films.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://plazaatlanta.com"

VENUE_DATA = {
    "name": "Plaza Theatre",
    "slug": "plaza-theatre",
    "address": "1049 Ponce De Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "cinema",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
    try:
        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Plaza Theatre showtimes."""
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

            logger.info(f"Fetching Plaza Theatre: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Get today's date
            today = datetime.now().date()

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Track current movie being parsed
            current_movie = None
            current_duration = None
            seen_movies = set()

            i = 0
            while i < len(lines):
                line = lines[i]

                # Movie title pattern - usually has duration on next line
                # Format: "Movie Title" or "Movie Title (Year)"
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    # Check if next line is duration: "2 hr 19 min · Crime ·"
                    duration_match = re.match(r"(\d+)\s*hr\s*(\d+)?\s*min", next_line)
                    if duration_match and len(line) > 3:
                        # Skip navigation and UI elements
                        skip_words = ["NOW PLAYING", "COMING SOON", "SPECIAL PROGRAMS",
                                      "RENTALS", "NEWS", "VISIT US", "STORE", "Today",
                                      "expand_more", "arrow_drop_down", "calendar_today",
                                      "PLAZA THEATRE", "The Tara", "Digital", "accessible",
                                      "headphones", "closed_caption", "CAPTION", "SUBTITLED",
                                      "Not Rated", "Select"]
                        if not any(w.lower() in line.lower() for w in skip_words):
                            if not re.match(r"^\d", line):  # Skip dates like "13"
                                current_movie = line
                                current_duration = next_line
                                i += 2
                                continue

                # Time pattern - showtime for current movie
                time_match = re.match(r"^(\d{1,2}:\d{2}\s*(?:AM|PM))$", line, re.IGNORECASE)
                if time_match and current_movie:
                    showtime = time_match.group(1)
                    start_time = parse_time(showtime)

                    # Use today's date for showtimes
                    start_date = today.strftime("%Y-%m-%d")

                    # Create unique key for movie + date
                    movie_key = f"{current_movie}|{start_date}"
                    if movie_key not in seen_movies:
                        seen_movies.add(movie_key)
                        events_found += 1

                        content_hash = generate_content_hash(current_movie, "Plaza Theatre", start_date)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                        else:
                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": current_movie,
                                "description": current_duration,
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "film",
                                "subcategory": "cinema",
                                "tags": ["film", "cinema", "independent", "plaza-theatre"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": BASE_URL,
                                "ticket_url": None,
                                "image_url": None,
                                "raw_text": None,
                                "extraction_confidence": 0.90,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {current_movie} on {start_date} at {start_time}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {current_movie}: {e}")

                # Check for "ENDS AT" which indicates we're past showtimes
                if "ENDS AT" in line:
                    # Could skip ahead but let's just continue
                    pass

                i += 1

            browser.close()

        logger.info(f"Plaza Theatre crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Plaza Theatre: {e}")
        raise

    return events_found, events_new, events_updated
