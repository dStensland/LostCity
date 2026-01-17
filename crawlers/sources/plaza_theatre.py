"""
Crawler for Plaza Theatre Atlanta (plazaatlanta.com).
Historic independent cinema showing first-run indie, classic, and cult films.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.plazaatlanta.com"
NOW_SHOWING_URL = f"{BASE_URL}/now-showing"
COMING_SOON_URL = f"{BASE_URL}/coming-soon"
SPECIAL_EVENTS_URL = f"{BASE_URL}/special-events/"

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
    """Parse time from '7:00 PM' or '7:00PM' format."""
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


def extract_movies_for_date(page: Page, target_date: datetime, source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Extract movies and showtimes for a specific date."""
    events_found = 0
    events_new = 0
    events_updated = 0

    date_str = target_date.strftime("%Y-%m-%d")

    # Get all movie cards/sections
    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Track current movie being parsed
    current_movie = None
    current_duration = None
    seen_movies = set()

    # Skip words for navigation/UI elements
    skip_words = [
        "NOW PLAYING", "COMING SOON", "SPECIAL PROGRAMS", "START DATES",
        "RENTALS", "NEWS", "VISIT US", "STORE", "Today", "COMING SOON TO PLAZA",
        "expand_more", "arrow_drop_down", "calendar_today",
        "PLAZA THEATRE", "The Tara", "Digital", "accessible",
        "headphones", "closed_caption", "CAPTION", "SUBTITLED",
        "Not Rated", "Select", "Loading", "Popping", "Starting",
        "SHOWTIMES", "announced", "Tuesday", "rental event",
        "Buy Tickets", "More Info", "Trash & Trivia", "Silver Scream",
        "WussyVision", "SUBSCRIBE", "Email", "Facebook", "Instagram"
    ]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Skip UI elements
        if any(w.lower() in line.lower() for w in skip_words):
            i += 1
            continue

        # Skip short lines and numbers
        if len(line) < 4 or re.match(r"^\d{1,2}$", line):
            i += 1
            continue

        # Movie title pattern - duration may be on next line or line after rating
        if i + 1 < len(lines):
            next_line = lines[i + 1]
            # Check if next line is duration: "2 hr 19 min" or "1 hr 45 min · Drama"
            duration_match = re.match(r"(\d+)\s*hr\s*(\d+)?\s*min", next_line)
            if duration_match:
                current_movie = line
                current_duration = next_line
                i += 2
                continue

            # Check if next line is a rating (Not Rated, PG, R, etc.) and duration is line after
            if i + 2 < len(lines) and re.match(r"^(Not Rated|G|PG|PG-13|R|NC-17|NR|Unrated)$", next_line, re.IGNORECASE):
                line_after = lines[i + 2]
                duration_match = re.match(r"(\d+)\s*hr\s*(\d+)?\s*min", line_after)
                if duration_match:
                    current_movie = line
                    current_duration = line_after
                    i += 3
                    continue

        # Time pattern - showtime for current movie (e.g., "7:00PM", "11:15AM")
        time_match = re.match(r"^(\d{1,2}:\d{2}\s*(?:AM|PM))$", line, re.IGNORECASE)
        if time_match and current_movie:
            showtime = time_match.group(1)
            start_time = parse_time(showtime)

            # Create unique key for movie + date + time
            movie_key = f"{current_movie}|{date_str}|{start_time}"
            if movie_key not in seen_movies:
                seen_movies.add(movie_key)
                events_found += 1

                content_hash = generate_content_hash(current_movie, "Plaza Theatre", date_str)

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                else:
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": current_movie,
                        "description": current_duration,
                        "start_date": date_str,
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
                        "source_url": NOW_SHOWING_URL,
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
                        logger.info(f"Added: {current_movie} on {date_str} at {start_time}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {current_movie}: {e}")

        i += 1

    return events_found, events_new, events_updated


def extract_upcoming_movies(page: Page, source_id: int, venue_id: int, source_url: str, page_type: str = "coming-soon") -> tuple[int, int, int]:
    """Extract movies from Coming Soon or Special Events pages."""
    events_found = 0
    events_new = 0
    events_updated = 0

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Skip navigation/UI elements - be comprehensive
    skip_patterns = [
        # Navigation
        "NOW PLAYING", "COMING SOON", "SPECIAL PROGRAMS", "START DATES",
        "RENTALS", "NEWS", "VISIT US", "STORE", "COMING SOON TO PLAZA",
        # Icons and UI
        "expand_more", "arrow_drop_down", "calendar_today", "swap_vert",
        "keyboard_arrow", "chevron", "arrow_",
        # Site elements
        "PLAZA THEATRE", "The Tara", "Digital", "accessible",
        "headphones", "closed_caption", "CAPTION", "SUBTITLED",
        "Select", "Loading", "Popping", "Starting",
        "SHOWTIMES", "announced", "rental event",
        "Buy Tickets", "More Info",
        # Social/footer
        "SUBSCRIBE", "Email", "Facebook", "Instagram", "Twitter",
        # Headers
        "Title, genre", "actor, date", "Release Date",
        # Accessibility
        "screen-reader", "Option+", "Accessibility", "Feedback", "Issue Reporting",
        # Address/footer
        "Ponce DeLeon Ave", "Ponce De Leon", "Atlanta, GA", "30306",
        "Info, Parking", "Lodging", "Drive-In Movie Tribute",
        "Letterboxd", "Shaped by INDY", "ACCEPT", "DISMISS",
        "Movies", "Explore Movies",
        # Special events page specific
        "SERIES & RETROSPECTIVES", "SPECIAL EVENTS", "COMMUNITY EVENTS",
        "Signature events", "contests, raffles", "special guests",
        "continuing series", "Trivia:", "Doors ", "Movie:",
        "Presented by WABE", "More details to come", "Videodrome's",
        "97 ESTORIA", "EVERY 2ND", "Join Mailing List",
        "First Name", "Last Name", "TRASH & TRIVIA",
        # Other
        "TBA", "OPENS", "Opens", "©", "Copyright", "All Rights Reserved"
    ]

    # Known special event series prefixes to preserve
    special_prefixes = [
        "Trash & Trivia:", "Silver Scream Spookshow:", "WussyVision:",
        "Soul Cinema Sunday:", "Plazadrome:", "Plazamania:",
        "Shane Morton Presents:", "WABE Cinema Social:", "Behind the Slate:"
    ]

    seen_movies = set()

    for line in lines:
        # Skip short lines
        if len(line) < 5:
            continue

        # Skip UI elements
        if any(skip.lower() in line.lower() for skip in skip_patterns):
            continue

        # Skip lines that look like icons, dates, times, or phone numbers
        if (line.startswith("·") or
            line.startswith("_") or
            re.match(r"^[a-z_]+$", line) or
            re.match(r"^\d{1,2}$", line) or
            re.match(r"^\d{1,2}/\d{1,2}", line) or
            re.match(r"^\d{1,2}:\d{2}", line) or
            re.match(r"^\d+\s*(hr|min)", line) or
            re.match(r"^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$", line) or  # Phone number
            re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)", line, re.IGNORECASE) or
            re.match(r"^(January|February|March|April|May|June|July|August|September|October|November|December)", line, re.IGNORECASE) or
            re.match(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$", line, re.IGNORECASE)):  # "Feb 8" etc
            continue

        # Skip ratings and genre-only lines
        if re.match(r"^(Not Rated|G|PG|PG-13|R|NC-17|NR|Unrated)$", line, re.IGNORECASE):
            continue
        if re.match(r"^[A-Z][a-z]+(\s*·\s*[A-Z][a-z]+)+$", line):  # "Horror · Drama"
            continue

        # Check if it looks like a movie title (starts with capital, reasonable length)
        # Movie titles typically have capitals and may include colons, parentheses
        if not (line[0].isupper() or line[0].isdigit()):
            continue

        # Skip if too long (probably a description)
        if len(line) > 80:
            continue

        # Skip if already seen
        if line in seen_movies:
            continue

        # This looks like a movie title
        movie_title = line
        seen_movies.add(movie_title)
        events_found += 1

        # Use "coming-soon" as date identifier for hash
        content_hash = generate_content_hash(movie_title, "Plaza Theatre", "coming-soon")

        existing = find_event_by_hash(content_hash)
        if existing:
            events_updated += 1
        else:
            # Use date 30 days from now as placeholder
            placeholder_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

            # Determine if this is a special series event
            is_special = any(movie_title.startswith(prefix) for prefix in special_prefixes)

            # Set description based on page type
            if page_type == "special-events":
                description = "Special Event" if not is_special else "Special Event Series"
            else:
                description = "Coming Soon" if not is_special else "Coming Soon - Special Event Series"

            # Build tags list
            tags = ["film", "cinema", "independent", "plaza-theatre", page_type]
            if is_special:
                tags.append("special-series")

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": movie_title,
                "description": description,
                "start_date": placeholder_date,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
                "category": "film",
                "subcategory": "cinema",
                "tags": tags,
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
                logger.info(f"Added {page_type}: {movie_title}")
            except Exception as e:
                logger.error(f"Failed to insert {page_type}: {movie_title}: {e}")

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Plaza Theatre showtimes for today and upcoming days."""
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

            # Load the now-showing page
            logger.info(f"Fetching Plaza Theatre: {NOW_SHOWING_URL}")
            page.goto(NOW_SHOWING_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)  # Wait for JS to load

            # First, get today's showtimes (default view)
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            found, new, updated = extract_movies_for_date(
                page, datetime.combine(today, datetime.min.time()),
                source_id, venue_id
            )
            total_found += found
            total_new += new
            total_updated += updated
            if found > 0:
                logger.info(f"  {today.strftime('%Y-%m-%d')}: {found} movies found, {new} new")

            # Click through the quick-select day buttons (Sat, Sun, Mon, Tue, etc.)
            # weekday(): Monday=0, Tuesday=1, ..., Sunday=6
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

            # Try clicking each upcoming day for the next 10 days
            for day_offset in range(1, 11):
                target_date = today + timedelta(days=day_offset)
                day_name = day_names[target_date.weekday()]
                day_num = target_date.day
                date_str = target_date.strftime("%Y-%m-%d")

                # Try to click the day button by name or number
                clicked = False
                try:
                    # First try clicking by day name (e.g., "Sun", "Mon")
                    day_btn = page.locator(f"text={day_name}").first
                    if day_btn.is_visible(timeout=1000):
                        day_btn.click()
                        page.wait_for_timeout(2000)
                        clicked = True
                except Exception:
                    pass

                if not clicked:
                    # Try clicking "Other" and then the date number in calendar
                    try:
                        other_btn = page.locator("text=Other").first
                        if other_btn.is_visible(timeout=1000):
                            other_btn.click()
                            page.wait_for_timeout(1500)

                            # Click the day number in the calendar
                            # Be careful to click the right element
                            day_cell = page.locator(f"text=/^{day_num}$/").first
                            if day_cell.is_visible(timeout=1000):
                                day_cell.click()
                                page.wait_for_timeout(2000)
                                clicked = True
                    except Exception:
                        pass

                if not clicked:
                    logger.debug(f"Could not select date {date_str}, skipping")
                    continue

                logger.info(f"Scraping {day_name} {day_num} ({date_str})")
                found, new, updated = extract_movies_for_date(
                    page, datetime.combine(target_date, datetime.min.time()),
                    source_id, venue_id
                )
                total_found += found
                total_new += new
                total_updated += updated

                if found > 0:
                    logger.info(f"  {date_str}: {found} movies found, {new} new")
                else:
                    # If no movies found, probably no schedule for this date yet
                    logger.info(f"  {date_str}: No showtimes scheduled")
                    break  # Stop trying further dates

            # Now scrape the Coming Soon page
            logger.info(f"Fetching Coming Soon: {COMING_SOON_URL}")
            page.goto(COMING_SOON_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)  # Wait for JS to load

            found, new, updated = extract_upcoming_movies(page, source_id, venue_id, COMING_SOON_URL, "coming-soon")
            total_found += found
            total_new += new
            total_updated += updated
            if found > 0:
                logger.info(f"Coming Soon: {found} movies found, {new} new")

            # Now scrape the Special Events page
            logger.info(f"Fetching Special Events: {SPECIAL_EVENTS_URL}")
            page.goto(SPECIAL_EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)  # Wait for JS to load

            found, new, updated = extract_upcoming_movies(page, source_id, venue_id, SPECIAL_EVENTS_URL, "special-events")
            total_found += found
            total_new += new
            total_updated += updated
            if found > 0:
                logger.info(f"Special Events: {found} movies found, {new} new")

            browser.close()

        logger.info(f"Plaza Theatre crawl complete: {total_found} found, {total_new} new, {total_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Plaza Theatre: {e}")
        raise

    return total_found, total_new, total_updated
