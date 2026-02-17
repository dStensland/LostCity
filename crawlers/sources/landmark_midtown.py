"""
Crawler for Landmark Midtown Art Cinema (landmarktheatres.com).
Art house cinema chain location in Atlanta.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.landmarktheatres.com"
# The main showtimes page - location is selected via dropdown
SHOWTIMES_URL = f"{BASE_URL}/showtimes/"
# Venue-specific page (redirects to /our-locations/...)
VENUE_PAGE_URL = f"{BASE_URL}/our-locations/x00qm-landmark-midtown-art-cinema-atlanta/"

VENUE_DATA = {
    "name": "Landmark Midtown Art Cinema",
    "slug": "landmark-midtown-art-cinema",
    "address": "931 Monroe Drive NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "venue_type": "cinema",
    "website": VENUE_PAGE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats."""
    try:
        # Try "7:00 PM" or "7:00PM" format
        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)", time_text)
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


def extract_movies_for_date(
    page: Page, target_date: datetime, source_id: int, venue_id: int, image_map: dict = None
) -> tuple[int, int, int]:
    """Extract movies and showtimes for a specific date.

    Landmark page structure (text is concatenated without newlines):
    - "Trailer" marker (optional)
    - Rating + Duration: "PG-13 • 2 hr, 10 min" or "R • 1 hr, 50 min"
    - Title immediately follows (e.g., "H Is For Hawk")
    - "Directed by {DIRECTOR}"
    - Content advisory, Genre, Cast info
    - "Today, January 23" date marker
    - Showtimes concatenated: "1:10PM4:00PM7:00PM10:00PM"
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    date_str = target_date.strftime("%Y-%m-%d")

    try:
        # Get main content text
        main = page.query_selector("main")
        if not main:
            main = page.query_selector("body")

        # Use inner_text which preserves some spacing (better than textContent)
        # but dates and times can still be concatenated in the DOM
        text = main.inner_text()

        # Stop at Film Series section (special events handled separately)
        if "Film Series & Special Screenings" in text:
            text = text.split("Film Series & Special Screenings")[0]

        # Movie pattern for concatenated text:
        # "Trailer PG-13 • 2 hr, 10 minH Is For HawkDirected by..."
        # Key: Rating • Duration followed by Title then "Directed by"
        movie_pattern = re.compile(
            r'(?:Trailer\s*)?'  # Optional Trailer marker
            r'((?:G|PG|PG-13|R|NC-17|NR|Not Rated)\s*•\s*'  # Rating
            r'\d+\s*hr,?\s*\d*\s*min)'  # Duration
            r'\s*'
            r'([A-Z][A-Za-z0-9\s\'\"\-\:\,\.\!\?\&\(\)]+?)'  # Title (starts with capital)
            r'Directed by\s+([A-Za-z\s\-\.]+)',  # Director (confirms this is a movie)
            re.IGNORECASE
        )

        # Normalize text - add space after date numbers to prevent "January 261:10PM"
        # Pattern matches: "January 26" or "Today, January 26" followed directly by time
        text = re.sub(r'(\w+,?\s+\w+\s+\d{1,2})(\d{1,2}:\d{2}(?:AM|PM))', r'\1 \2', text, flags=re.IGNORECASE)

        # Showtime pattern: times like "4:00PM", "3:10PM" (no space before AM/PM)
        # Can be concatenated: "1:10PM4:00PM7:00PM"
        # Updated to avoid matching date numbers like "261:10PM" from "January 261:10PM"
        showtime_pattern = re.compile(r'(?<!\d)(\d{1,2}:\d{2}(?:AM|PM))', re.IGNORECASE)

        # Find all movies
        movies = []
        for match in movie_pattern.finditer(text):
            rating_duration = match.group(1).strip()
            title = match.group(2).strip()
            director = match.group(3).strip()

            # Clean up title - remove trailing whitespace and any leftover metadata
            title = re.sub(r'\s+$', '', title).strip()

            # Skip if title looks like UI text or crawler artifacts
            skip_titles = [
                "Showtimes", "Now Playing", "Coming Soon", "Landmark",
                "Another Date", "See Details", "Film Series", "Special",
                "At:", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu",
                "See Trailer", "Late Shows", "Two Shows Only",
                "A Film By", "Trailer",
            ]
            if any(skip.lower() == title.lower() for skip in skip_titles):
                continue
            if any(skip.lower() in title.lower() and len(title) < 20 for skip in skip_titles):
                continue

            if len(title) < 3 or len(title) > 100:
                continue

            movies.append({
                "title": title,
                "rating_duration": rating_duration,
                "director": director,
                "start": match.start(),
                "end": match.end()
            })

        logger.info(f"Found {len(movies)} movies on Landmark page")

        # For each movie, find showtimes in its section
        seen_movies = set()

        for i, movie in enumerate(movies):
            # Get text section for this movie (until next movie or Trailer marker)
            if i + 1 < len(movies):
                section = text[movie["end"]:movies[i + 1]["start"]]
            else:
                section = text[movie["end"]:movie["end"] + 500]  # Limit search area

            # Stop at Trailer marker (indicates start of next movie)
            if "Trailer" in section:
                section = section.split("Trailer")[0]

            # Find all showtimes in this section
            showtimes = []
            for st_match in showtime_pattern.finditer(section):
                time_str = st_match.group(1)
                # Validate time - hour must be 1-12, minute 00-59
                match_parts = re.match(r"(\d{1,2}):(\d{2})", time_str)
                if match_parts:
                    hour_val = int(match_parts.group(1))
                    min_val = int(match_parts.group(2))
                    if hour_val < 1 or hour_val > 12 or min_val > 59:
                        logger.debug(f"Skipping invalid time: {time_str} (hour={hour_val}, min={min_val})")
                        continue
                # Skip if this looks like part of duration (preceded by "hr" or "min")
                prefix = section[max(0, st_match.start()-15):st_match.start()].lower()
                if "hr" in prefix or "min" in prefix:
                    continue
                parsed = parse_time(time_str)
                if parsed:
                    showtimes.append(parsed)

            # Skip if no valid showtimes found
            if not showtimes:
                continue

            # Create ONE event per movie per day (not per showtime)
            movie_key = f"{movie['title']}|{date_str}"
            if movie_key in seen_movies:
                continue

            seen_movies.add(movie_key)
            events_found += 1

            # Sort showtimes and use earliest as the event start_time
            showtimes = sorted(set(showtimes))
            earliest_time = showtimes[0]

            # Format showtimes for display (convert back to 12-hour format)
            def format_showtime(t):
                h, m = map(int, t.split(':'))
                period = 'AM' if h < 12 else 'PM'
                h = h % 12 or 12
                return f"{h}:{m:02d} {period}"

            showtimes_display = ", ".join(format_showtime(t) for t in showtimes)

            # Build description with rating/duration and showtimes
            description = f"{movie['rating_duration']}\n\nShowtimes: {showtimes_display}"

            # Content hash based on title + venue + date only (NOT time)
            # This prevents duplicates when showtimes change
            content_hash = generate_content_hash(
                movie["title"], "Landmark Midtown Art Cinema", date_str
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
            else:
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": movie["title"],
                    "description": description,
                    "start_date": date_str,
                    "start_time": earliest_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "film",
                    "subcategory": "cinema",
                    "tags": ["film", "cinema", "arthouse", "showtime", "landmark"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": SHOWTIMES_URL,
                    "ticket_url": None,
                    # Case-insensitive image lookup
                    "image_url": next(
                        (url for title, url in (image_map or {}).items()
                         if title.lower() == movie["title"].lower()),
                        None
                    ),
                    "raw_text": None,
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                series_hint = {
                    "series_type": "film",
                    "series_title": movie["title"],
                }

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {movie['title']} on {date_str} ({len(showtimes)} showtimes)")
                except Exception as e:
                    logger.error(f"Failed to insert: {movie['title']}: {e}")

    except Exception as e:
        logger.error(f"Error extracting movies: {e}")

    return events_found, events_new, events_updated


def select_midtown_location(page: Page) -> bool:
    """Select Midtown Art Cinema from the location dropdown.

    The page starts with "PLEASE SELECT A LOCATION" and we need to:
    1. Dismiss cookie consent popup if present
    2. Click the dropdown
    3. Select "Midtown Art Cinema" from the list
    """
    try:
        # Dismiss Didomi cookie consent popup if present
        try:
            # Try clicking "Agree & Close" or similar dismiss buttons
            dismiss_selectors = [
                "button#didomi-notice-agree-button",
                "button:has-text('Agree')",
                "button:has-text('Accept')",
                "#didomi-notice-agree-button",
            ]
            for sel in dismiss_selectors:
                try:
                    dismiss_btn = page.locator(sel).first
                    if dismiss_btn.is_visible(timeout=1000):
                        dismiss_btn.click()
                        page.wait_for_timeout(1000)
                        logger.info("Dismissed cookie consent popup")
                        break
                except Exception:
                    continue
        except Exception:
            pass

        # Check if already selected (text contains "LANDMARK MIDTOWN ART CINEMA")
        page_text = page.inner_text("body")
        if "LANDMARK MIDTOWN ART CINEMA" in page_text:
            logger.info("Midtown Art Cinema already selected")
            return True

        # Click the location dropdown button
        # Button text is "SHOWTIMES FOR:\nPLEASE SELECT A LOCATION\n—"
        dropdown_selectors = [
            "button:has-text('SELECT A LOCATION')",
            "button:has-text('PLEASE SELECT')",
            "text=PLEASE SELECT A LOCATION",
            "text=Select a location",
        ]

        dropdown_clicked = False
        for selector in dropdown_selectors:
            try:
                dropdown = page.locator(selector).first
                if dropdown.is_visible(timeout=2000):
                    dropdown.click()
                    page.wait_for_timeout(1500)
                    dropdown_clicked = True
                    logger.info(f"Clicked location dropdown with selector: {selector}")
                    break
            except Exception:
                continue

        if not dropdown_clicked:
            logger.warning("Could not find location dropdown")
            return False

        # Look for Midtown Art Cinema in the dropdown options
        midtown_selectors = [
            "text=Midtown Art Cinema",
            "text=/Midtown.*Atlanta/i",
        ]

        for selector in midtown_selectors:
            try:
                option = page.locator(selector).first
                if option.is_visible(timeout=3000):
                    option.click()
                    page.wait_for_timeout(2000)
                    logger.info("Selected Midtown Art Cinema location")
                    return True
            except Exception:
                continue

        logger.warning("Could not find Midtown Art Cinema option")
        return False
    except Exception as e:
        logger.warning(f"Could not select Midtown location: {e}")
        return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Landmark Midtown Art Cinema showtimes."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)
            today = datetime.now().date()

            # Load the showtimes page
            logger.info(f"Fetching Landmark showtimes: {SHOWTIMES_URL}")
            page.goto(SHOWTIMES_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Wait for JS to render

            # Select Midtown Art Cinema location
            select_midtown_location(page)
            page.wait_for_timeout(2000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract movie poster images from page
            image_map = extract_images_from_page(page)
            logger.info(f"Extracted {len(image_map)} movie images")

            # Extract today's showtimes (already showing by default)
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            found, new, updated = extract_movies_for_date(
                page, datetime.combine(today, datetime.min.time()), source_id, venue_id, image_map
            )
            total_found += found
            total_new += new
            total_updated += updated

            # Click through dates for next 7 days
            # Date buttons show day abbreviation and number (e.g., "Fri 23")
            for day_offset in range(1, 8):
                target_date = today + timedelta(days=day_offset)
                day_num = target_date.day
                date_str = target_date.strftime("%Y-%m-%d")

                # Try to click the date button by day number
                clicked = False
                try:
                    # The date buttons contain just the day number
                    date_btn = page.locator(f"text=/^{day_num}$/").first
                    if date_btn.is_visible(timeout=1500):
                        date_btn.click()
                        page.wait_for_timeout(2000)
                        clicked = True
                except Exception:
                    pass

                if clicked:
                    # Scroll to load content for this date
                    page.evaluate("window.scrollTo(0, 0)")
                    page.wait_for_timeout(500)
                    for _ in range(2):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(800)

                    logger.info(f"Scraping {date_str}")
                    found, new, updated = extract_movies_for_date(
                        page,
                        datetime.combine(target_date, datetime.min.time()),
                        source_id,
                        venue_id,
                        image_map,
                    )
                    total_found += found
                    total_new += new
                    total_updated += updated

            browser.close()

        logger.info(
            f"Landmark Midtown crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Landmark Midtown: {e}")
        raise

    return total_found, total_new, total_updated
