"""
Crawler for Plaza Theatre Atlanta (plazaatlanta.com).
Historic independent cinema showing first-run indie, classic, and cult films.

Rewritten to use DOM queries instead of text parsing for more reliable extraction.
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
    """Parse time from '7:00 PM' or '7:00PM' format to HH:MM."""
    try:
        # Handle both "7:00 PM" and "7:00PM"
        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text.strip(), re.IGNORECASE)
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


def parse_duration(duration_text: str) -> Optional[int]:
    """Parse duration from '1 hr 55 min' format to minutes."""
    try:
        match = re.match(r"(\d+)\s*hr\s*(\d+)?\s*min", duration_text, re.IGNORECASE)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2)) if match.group(2) else 0
            return hours * 60 + minutes
        return None
    except Exception:
        return None


def extract_movies_from_page(page: Page, date_str: str) -> dict:
    """Extract movies and showtimes using multiple methods.

    Tries text-based extraction first, falls back to button-based.
    Returns a dict of {movie_title: {duration, image, showtimes: []}}.
    """
    # Try text-based extraction first (most reliable)
    movie_showtimes = extract_via_text_blocks(page, date_str)

    # Fall back to button-based extraction
    if not movie_showtimes:
        logger.info("Text extraction found nothing, trying button extraction")
        movie_showtimes = extract_via_buttons(page)

    return movie_showtimes


def extract_via_buttons(page: Page) -> dict:
    """Extract movies by finding showtime buttons with 'Ends at' text.

    Button structure:
    - Time (e.g., "5:00 PM")
    - "Ends at X:XX PM"
    - Accessibility icons

    Walk up DOM to find containing movie card with title.
    """
    movie_showtimes = {}

    try:
        # Find all buttons that contain "Ends at" - these are showtime buttons
        buttons = page.query_selector_all("button")

        for btn in buttons:
            try:
                btn_text = btn.inner_text()

                # Only process showtime buttons (have "Ends at" text)
                if "Ends at" not in btn_text:
                    continue

                # Extract time from button
                time_match = re.search(r"^(\d{1,2}:\d{2}\s*(?:AM|PM))", btn_text, re.IGNORECASE)
                if not time_match:
                    continue

                showtime = time_match.group(1)

                # Walk up the DOM to find the movie container
                # The movie title is in a sibling/ancestor element
                parent = btn
                movie_title = None
                duration = None

                for _ in range(12):  # Walk up max 12 levels
                    try:
                        parent = parent.evaluate_handle("el => el.parentElement")
                        if not parent:
                            break

                        parent_text = parent.evaluate("el => el.innerText || ''")

                        # Look for the pattern: Title followed by "X hr Y min"
                        # The title line ends right before the duration
                        duration_match = re.search(
                            r'([^\n]{4,80})\s*(?:Not Rated|Rated\s*[A-Z]+)?\s*\n\s*'
                            r'(\d+\s*hr\s*\d*\s*min)',
                            parent_text
                        )

                        if duration_match:
                            potential_title = duration_match.group(1).strip()
                            potential_duration = duration_match.group(2).strip()

                            # Clean up title
                            potential_title = re.sub(
                                r'\s*(Not Rated|Rated\s*[A-Z]+)\s*$', '', potential_title
                            ).strip()

                            # Skip UI text
                            skip_words = [
                                "NOW PLAYING", "COMING SOON", "Digital", "Plaza Theatre",
                                "The Tara", "35MM", "70MM", "accessible", "headphones",
                                "chevron", "calendar", "Help Us"
                            ]
                            if not any(skip.lower() in potential_title.lower() for skip in skip_words):
                                if len(potential_title) >= 4:
                                    movie_title = potential_title
                                    duration = potential_duration
                                    break

                    except Exception:
                        break

                if movie_title:
                    if movie_title not in movie_showtimes:
                        movie_showtimes[movie_title] = {
                            "duration": duration,
                            "image": None,
                            "showtimes": []
                        }
                    if showtime not in movie_showtimes[movie_title]["showtimes"]:
                        movie_showtimes[movie_title]["showtimes"].append(showtime)

            except Exception:
                continue

        logger.info(f"Button extraction found {len(movie_showtimes)} movies")

    except Exception as e:
        logger.error(f"Error in button-based extraction: {e}")

    return movie_showtimes


def extract_via_text_blocks(page: Page, date_str: str) -> dict:
    """Extract movies by parsing the full page text content.

    The Plaza Theatre page structure is:
    - Movie title (may include rating inline like "Not Rated")
    - Duration line: "X hr Y min · Genre · features"
    - Description text (may be multiple lines)
    - Showtime blocks: "The {Screen}Digital{Time} Ends at {EndTime}"

    One movie can have multiple showtimes at different screens.
    """
    movie_showtimes = {}

    try:
        main = page.query_selector("main")
        if not main:
            return {}

        text = main.inner_text()

        # Split on "COMING SOON" to only process NOW PLAYING section
        if "COMING SOON TO PLAZA" in text:
            text = text.split("COMING SOON TO PLAZA")[0]

        # Find all movie+showtime blocks using regex patterns
        # Movie titles are followed by duration "X hr Y min"
        # Pattern: Title (possibly with rating) followed by duration
        movie_pattern = re.compile(
            r'([A-Z][^·\n]{3,80}?)(?:\s*(?:Not Rated|Rated\s*[A-Z]+|[GPNR]-?\d*))?\s*'
            r'(\d+\s*hr\s*\d*\s*min[^\n]*)',
            re.MULTILINE
        )

        # Showtime pattern: Screen + Digital + Time + Ends at
        # Screens are: The Lefont, The Rej, The Mike
        showtime_pattern = re.compile(
            r'(The\s+(?:Lefont|Rej|Mike))\s*Digital\s*'
            r'(\d{1,2}:\d{2}\s*(?:AM|PM))\s*'
            r'Ends at\s*\d{1,2}:\d{2}\s*(?:AM|PM)',
            re.IGNORECASE
        )

        # Find all movies with their positions
        movies = []
        for match in movie_pattern.finditer(text):
            title = match.group(1).strip()
            duration = match.group(2).strip()
            start_pos = match.start()

            # Clean up title - remove trailing ratings/whitespace
            title = re.sub(r'\s*(Not Rated|Rated\s*[A-Z]+)\s*$', '', title).strip()

            # Skip non-movie text
            skip_words = [
                "NOW PLAYING", "COMING SOON", "SPECIAL", "RENTALS", "NEWS",
                "Today", "Plaza Theatre", "The Tara", "Help Us", "Join",
                "Showtimes are", "Start dates", "When nothing", "Not finding",
                "Community", "TRASH", "Trivia", "throw down", "chevron",
            ]
            if any(skip.lower() in title.lower() for skip in skip_words):
                continue
            if len(title) < 4 or len(title) > 100:
                continue

            movies.append({
                "title": title,
                "duration": duration,
                "start": start_pos,
                "end": match.end()
            })

        # For each movie, find showtimes between this movie and the next
        for i, movie in enumerate(movies):
            # Get text section for this movie (until next movie or end)
            if i + 1 < len(movies):
                section = text[movie["end"]:movies[i + 1]["start"]]
            else:
                section = text[movie["end"]:]

            # Find all showtimes in this section
            showtimes = []
            for st_match in showtime_pattern.finditer(section):
                screen = st_match.group(1)
                time = st_match.group(2)
                showtimes.append(time)

            if showtimes:
                movie_showtimes[movie["title"]] = {
                    "duration": movie["duration"],
                    "image": None,
                    "showtimes": showtimes
                }

        logger.info(f"Text extraction found {len(movie_showtimes)} movies")

    except Exception as e:
        logger.error(f"Error in text block extraction: {e}")

    return movie_showtimes


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
            page.goto(NOW_SHOWING_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)  # Wait for JS to load

            # Click on Plaza Theatre tab if needed (there's also The Tara)
            try:
                plaza_tab = page.locator("text=Plaza Theatre Atlanta").first
                if plaza_tab.is_visible(timeout=2000):
                    plaza_tab.click()
                    page.wait_for_timeout(1500)
            except Exception:
                pass

            # Day names for clicking
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

            # Try each day for the next 10 days
            for day_offset in range(0, 11):
                target_date = today + timedelta(days=day_offset)
                day_name = day_names[target_date.weekday()]
                day_num = target_date.day
                date_str = target_date.strftime("%Y-%m-%d")

                # Click the appropriate day button
                clicked = False

                if day_offset == 0:
                    # Today is already selected by default, but click to be sure
                    try:
                        today_btn = page.locator("text=Today").first
                        if today_btn.is_visible(timeout=1000):
                            today_btn.click()
                            page.wait_for_timeout(2000)
                            clicked = True
                    except Exception:
                        clicked = True  # Assume today is already showing
                else:
                    # Try clicking by day abbreviation and number
                    for selector in [
                        f"text=/{day_name}.*{day_num}/i",
                        f"text={day_name}",
                        f"listitem:has-text('{day_num}')"
                    ]:
                        try:
                            btn = page.locator(selector).first
                            if btn.is_visible(timeout=1000):
                                btn.click()
                                page.wait_for_timeout(2000)
                                clicked = True
                                break
                        except Exception:
                            continue

                    # If still not clicked, try the "Other" date picker
                    if not clicked:
                        try:
                            other_btn = page.locator("text=Other").first
                            if other_btn.is_visible(timeout=1000):
                                other_btn.click()
                                page.wait_for_timeout(1500)
                                # Click the day number in calendar
                                day_cell = page.locator(f"text=/^{day_num}$/").first
                                if day_cell.is_visible(timeout=1000):
                                    day_cell.click()
                                    page.wait_for_timeout(2000)
                                    clicked = True
                        except Exception:
                            pass

                if not clicked and day_offset > 0:
                    logger.debug(f"Could not select date {date_str}, skipping")
                    continue

                # Check if there's a "Nothing Scheduled" message
                try:
                    nothing_msg = page.locator("text=Nothing Scheduled").first
                    if nothing_msg.is_visible(timeout=1000):
                        logger.info(f"  {date_str}: No showtimes scheduled")
                        continue
                except Exception:
                    pass

                # Extract movies for this date
                logger.info(f"Scraping {day_name} {day_num} ({date_str})")

                # Try multiple extraction methods
                movie_showtimes = extract_via_text_blocks(page, date_str)

                if not movie_showtimes:
                    movie_showtimes = extract_via_buttons(page)

                # Create events
                for movie_title, data in movie_showtimes.items():
                    for showtime in data.get("showtimes", []):
                        start_time = parse_time(showtime)
                        if not start_time:
                            continue

                        movie_key = f"{movie_title}|{date_str}|{start_time}"

                        total_found += 1
                        content_hash = generate_content_hash(
                            movie_title, "Plaza Theatre", f"{date_str}|{start_time}"
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            total_updated += 1
                        else:
                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": movie_title,
                                "description": data.get("duration"),
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
                                "image_url": data.get("image"),
                                "raw_text": None,
                                "extraction_confidence": 0.90,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            series_hint = {
                                "series_type": "film",
                                "series_title": movie_title,
                            }

                            try:
                                insert_event(event_record, series_hint=series_hint)
                                total_new += 1
                                logger.info(f"Added: {movie_title} on {date_str} at {start_time}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {movie_title}: {e}")

                if total_found == 0 and day_offset > 3:
                    # No movies found for several days, stop looking
                    break

            browser.close()

        logger.info(
            f"Plaza Theatre crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Plaza Theatre: {e}")
        raise

    return total_found, total_new, total_updated
