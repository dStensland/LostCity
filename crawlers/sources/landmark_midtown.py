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

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.landmarktheatres.com"
# Use venue-specific URL which already has location set
VENUE_PAGE_URL = f"{BASE_URL}/atlanta/midtown-art-cinema"
SHOWTIMES_URL = f"{VENUE_PAGE_URL}/film"
FILM_SERIES_URL = f"{BASE_URL}/film-series/"
SPECIAL_SCREENINGS_URL = f"{BASE_URL}/special-screenings/"

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
    page: Page, target_date: datetime, source_id: int, venue_id: int
) -> tuple[int, int, int]:
    """Extract movies and showtimes for a specific date."""
    events_found = 0
    events_new = 0
    events_updated = 0

    date_str = target_date.strftime("%Y-%m-%d")

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    current_movie = None
    seen_movies = set()

    skip_words = [
        # Navigation and UI
        "NOW PLAYING",
        "COMING SOON",
        "SEE DETAILS",
        "CLICK HERE",
        "LANDMARK",
        "THEATRES",
        "SIGN UP",
        "LOG IN",
        "MENU",
        "SEARCH",
        "TRAILER",
        "See trailer",
        "MY LANDMARK",
        "GIFT CARDS",
        "LOCATIONS",
        "ABOUT",
        "EVENTS",
        "FAQ",
        "CONTACT",
        "CAREERS",
        "PRIVACY",
        "TERMS",
        "ACCESSIBILITY",
        "NEWSLETTER",
        "SUBSCRIBE",
        "FOLLOW",
        "Facebook",
        "Instagram",
        "Twitter",
        "YouTube",
        "TikTok",
        "©",
        "Copyright",
        "All Rights Reserved",
        "Monroe Drive",
        "Atlanta, GA",
        "30308",
        "MIDTOWN ART CINEMA",
        "Select Date",
        "Today",
        "Loading",
        # Cookie and consent
        "Cookie",
        "Accept and Continue",
        "Skip to main",
        "consent",
        # Page structure
        "SHOWTIMES FOR",
        "PLEASE SELECT",
        "SELECT A LOCATION",
        "SHOWTIMES",
        "MOVIES",
        "LOYALTY",
        "ANOTHER DATE",
        "Home",
        "More",
        "Film Series",
        "Special Screenings",
        # Movie metadata (not titles)
        "Directed by",
        "A FILM BY",
        "See trailer of the movie",
        "GENRE:",
        "CAST:",
        "STARRING:",
        # Ratings and runtimes
        "HR,",
        "MIN",
        "• 1 HR",
        "• 2 HR",
        "• 3 HR",
        # Buttons
        "BUY TICKETS",
        "GET TICKETS",
        "LEARN MORE",
        "VIEW DETAILS",
        "SEE MORE",
        "RESERVE",
    ]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Skip UI elements
        if any(w.lower() in line.lower() for w in skip_words):
            i += 1
            continue

        # Skip short lines
        if len(line) < 3:
            i += 1
            continue

        # Skip lines that are just numbers or dates
        if re.match(r"^\d{1,2}$", line) or re.match(r"^\d{1,2}/\d{1,2}", line):
            i += 1
            continue

        # Look for movie titles - typically followed by runtime or genre
        # Movie titles are usually in caps or title case
        if i + 1 < len(lines):
            next_line = lines[i + 1]

            # Check if next line has runtime pattern "1h 45m" or "2 hr 10 min" or genre
            runtime_match = re.match(r"(\d+)\s*h(?:r|our)?\s*(\d+)?\s*m(?:in)?", next_line, re.IGNORECASE)
            genre_indicators = ["Drama", "Comedy", "Thriller", "Horror", "Documentary", "Romance", "Action", "Sci-Fi"]
            has_genre = any(g.lower() in next_line.lower() for g in genre_indicators)

            if runtime_match or has_genre:
                # This line is likely a movie title
                if len(line) > 2 and line[0].isupper():
                    current_movie = line
                    i += 2
                    continue

        # Look for showtime patterns
        time_match = re.match(r"^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))$", line)
        if time_match and current_movie:
            showtime = time_match.group(1)
            start_time = parse_time(showtime)

            movie_key = f"{current_movie}|{date_str}|{start_time}"
            if movie_key not in seen_movies:
                seen_movies.add(movie_key)
                events_found += 1

                content_hash = generate_content_hash(
                    current_movie, "Landmark Midtown Art Cinema", f"{date_str}|{start_time}"
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                else:
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": current_movie,
                        "description": None,
                        "start_date": date_str,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "film",
                        "subcategory": "cinema",
                        "tags": ["film", "cinema", "arthouse", "landmark"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": SHOWTIMES_URL,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {current_movie} on {date_str} at {start_time}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {current_movie}: {e}")

        # Also check for movie without specific showtime (just playing today)
        if current_movie and current_movie not in seen_movies:
            # If we found a movie but no showtimes yet, record it as playing
            movie_key = f"{current_movie}|{date_str}|all-day"
            if movie_key not in seen_movies:
                seen_movies.add(movie_key)
                # Don't count as event yet, wait for showtimes

        i += 1

    # Fallback: Only if we found NO movies at all from showtimes, look for titles
    # This should rarely trigger if the location selection works
    if not events_found:
        # Very strict pattern for movie titles - must be ALL CAPS, no metadata patterns
        for line in lines:
            # Must be reasonable length
            if len(line) < 5 or len(line) > 50:
                continue
            # Skip if in skip_words
            if any(w.lower() in line.lower() for w in skip_words):
                continue
            # Must be ALL CAPS (movie titles on Landmark are uppercase)
            if not line.isupper():
                continue
            # Skip rating/runtime patterns like "R • 1 HR, 40 MIN" or "PG-13 • 2 HR"
            if re.match(r"^(G|PG|PG-13|R|NC-17|NR)\s*•", line):
                continue
            # Skip lines with bullet separators (metadata)
            if " • " in line:
                continue
            # Skip lines that are just single words (navigation items)
            if " " not in line:
                continue
            # Skip already seen
            if line in seen_movies:
                continue

            # This looks like a movie title
            seen_movies.add(line)
            events_found += 1

            content_hash = generate_content_hash(
                line, "Landmark Midtown Art Cinema", date_str
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
            else:
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": line.title(),  # Convert to title case
                    "description": "Now Playing",
                    "start_date": date_str,
                    "start_time": None,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": "film",
                    "subcategory": "cinema",
                    "tags": ["film", "cinema", "arthouse", "landmark"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": SHOWTIMES_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": None,
                    "extraction_confidence": 0.70,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added (no time): {line} on {date_str}")
                except Exception as e:
                    logger.error(f"Failed to insert: {line}: {e}")

    return events_found, events_new, events_updated


def extract_special_events(
    page: Page,
    source_id: int,
    venue_id: int,
    source_url: str,
) -> tuple[int, int, int]:
    """Extract special events from film series or special screenings pages."""
    events_found = 0
    events_new = 0
    events_updated = 0

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    skip_patterns = [
        # Navigation and UI
        "NOW PLAYING",
        "COMING SOON",
        "SEE DETAILS",
        "CLICK HERE",
        "LANDMARK",
        "THEATRES",
        "SIGN UP",
        "LOG IN",
        "MENU",
        "SEARCH",
        "MY LANDMARK",
        "GIFT CARDS",
        "LOCATIONS",
        "ABOUT",
        "FAQ",
        "CONTACT",
        "CAREERS",
        "PRIVACY",
        "TERMS",
        "NEWSLETTER",
        "SUBSCRIBE",
        "FOLLOW",
        "Facebook",
        "Instagram",
        "Twitter",
        "YouTube",
        "TikTok",
        "©",
        "Copyright",
        "Monroe Drive",
        "Atlanta, GA",
        "MIDTOWN ART CINEMA",
        "Loading",
        "All Rights Reserved",
        # Cookie and consent
        "Cookie",
        "Accept and Continue",
        "Skip to main",
        "consent",
        # Page structure
        "SHOWTIMES FOR",
        "PLEASE SELECT",
        "SELECT A LOCATION",
        "SHOWTIMES",
        "MOVIES",
        "LOYALTY",
        "ANOTHER DATE",
        "Home",
        "More",
        "Film Series",
        "Special Screenings",
        "Event Movies",
        # Movie metadata
        "Directed by",
        "A FILM BY",
        "GENRE:",
        "CAST:",
        "STARRING:",
        "HR,",
        "MIN",
        # Trailer/preview patterns
        "TRAILER",
        "See trailer of",
        "Watch trailer",
        "View trailer",
        # Buttons
        "BUY TICKETS",
        "GET TICKETS",
        "LEARN MORE",
        "VIEW DETAILS",
        "SEE MORE",
        "RESERVE",
    ]

    seen_events = set()
    current_event = None
    current_date = None

    for i, line in enumerate(lines):
        # Skip short lines
        if len(line) < 5:
            continue

        # Skip UI elements
        if any(skip.lower() in line.lower() for skip in skip_patterns):
            continue

        # Look for date patterns
        date_match = re.search(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s*(\d{4}))?",
            line,
            re.IGNORECASE
        )
        if date_match:
            month, day, year = date_match.groups()
            year = year or str(datetime.now().year)
            try:
                dt = datetime.strptime(f"{month} {day}, {year}", "%B %d, %Y")
                current_date = dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
            continue

        # Look for event titles (capitalized, reasonable length)
        if len(line) > 5 and len(line) < 100 and line[0].isupper():
            # Skip if it looks like a date or time
            if re.match(r"^\d", line) or re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)", line, re.IGNORECASE):
                continue

            current_event = line

            if current_event and current_event not in seen_events:
                seen_events.add(current_event)
                events_found += 1

                # Use current_date if found, otherwise 14 days from now
                event_date = current_date or (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")

                content_hash = generate_content_hash(
                    current_event, "Landmark Midtown Art Cinema", f"event-{event_date}"
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                else:
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": current_event,
                        "description": "Special Event",
                        "start_date": event_date,
                        "start_time": None,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": True,
                        "category": "film",
                        "subcategory": "special-screening",
                        "tags": ["film", "cinema", "arthouse", "landmark", "special-event"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": source_url,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.75,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added event: {current_event} on {event_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event: {current_event}: {e}")

    return events_found, events_new, events_updated


def select_midtown_location(page: Page) -> bool:
    """Try to select Midtown Art Cinema from the location dropdown."""
    try:
        # Look for location selector/dropdown
        location_selectors = [
            "text=Please select a location",
            "text=Select a location",
            "[data-testid='location-selector']",
            "button:has-text('location')",
            ".location-select",
        ]

        for selector in location_selectors:
            try:
                loc_btn = page.locator(selector).first
                if loc_btn.is_visible(timeout=2000):
                    loc_btn.click()
                    page.wait_for_timeout(1500)

                    # Extract images from page
                    image_map = extract_images_from_page(page)
                    break
            except Exception:
                continue

        # Now look for Midtown Art Cinema in the dropdown
        midtown_selectors = [
            "text=Midtown Art Cinema",
            "text=midtown art cinema",
            "text=Atlanta",
            "[data-location='midtown-art-cinema']",
        ]

        for selector in midtown_selectors:
            try:
                midtown_btn = page.locator(selector).first
                if midtown_btn.is_visible(timeout=2000):
                    midtown_btn.click()
                    page.wait_for_timeout(2000)
                    logger.info("Selected Midtown Art Cinema location")
                    return True
            except Exception:
                continue

        return False
    except Exception as e:
        logger.warning(f"Could not select Midtown location: {e}")
        return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Landmark Midtown Art Cinema showtimes and events."""
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

            # ========== SHOWTIMES PAGE ==========
            logger.info(f"Fetching Landmark showtimes: {SHOWTIMES_URL}")
            page.goto(SHOWTIMES_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Select Midtown Art Cinema location
            select_midtown_location(page)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get today's showtimes
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            found, new, updated = extract_movies_for_date(
                page, datetime.combine(today, datetime.min.time()), source_id, venue_id
            )
            total_found += found
            total_new += new
            total_updated += updated
            if found > 0:
                logger.info(f"  {today.strftime('%Y-%m-%d')}: {found} movies found, {new} new")

            # Try to click through dates for next 7 days
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

            for day_offset in range(1, 8):
                target_date = today + timedelta(days=day_offset)
                day_name = day_names[target_date.weekday()]
                day_num = target_date.day
                date_str = target_date.strftime("%Y-%m-%d")

                # Try to click date selector
                clicked = False
                try:
                    # Look for date picker or day buttons
                    day_btn = page.locator(f"text={day_name}").first
                    if day_btn.is_visible(timeout=1000):
                        day_btn.click()
                        page.wait_for_timeout(2000)
                        clicked = True
                except Exception:
                    pass

                if not clicked:
                    try:
                        # Try clicking by date number
                        date_btn = page.locator(f"text=/^{day_num}$/").first
                        if date_btn.is_visible(timeout=1000):
                            date_btn.click()
                            page.wait_for_timeout(2000)
                            clicked = True
                    except Exception:
                        pass

                if clicked:
                    logger.info(f"Scraping {day_name} {day_num} ({date_str})")
                    found, new, updated = extract_movies_for_date(
                        page,
                        datetime.combine(target_date, datetime.min.time()),
                        source_id,
                        venue_id,
                    )
                    total_found += found
                    total_new += new
                    total_updated += updated

                    if found > 0:
                        logger.info(f"  {date_str}: {found} movies found, {new} new")

            # ========== FILM SERIES PAGE ==========
            logger.info(f"Fetching Landmark film series: {FILM_SERIES_URL}")
            page.goto(FILM_SERIES_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Select Midtown Art Cinema location
            select_midtown_location(page)

            # Scroll to load content
            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            found, new, updated = extract_special_events(page, source_id, venue_id, FILM_SERIES_URL)
            total_found += found
            total_new += new
            total_updated += updated
            if found > 0:
                logger.info(f"Film Series: {found} found, {new} new")

            # ========== SPECIAL SCREENINGS PAGE ==========
            logger.info(f"Fetching Landmark special screenings: {SPECIAL_SCREENINGS_URL}")
            page.goto(SPECIAL_SCREENINGS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Select Midtown Art Cinema location
            select_midtown_location(page)

            # Scroll to load content
            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            found, new, updated = extract_special_events(page, source_id, venue_id, SPECIAL_SCREENINGS_URL)
            total_found += found
            total_new += new
            total_updated += updated
            if found > 0:
                logger.info(f"Special Screenings: {found} found, {new} new")

            browser.close()

        logger.info(
            f"Landmark Midtown crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Landmark Midtown: {e}")
        raise

    return total_found, total_new, total_updated
