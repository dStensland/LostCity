"""
Crawler for Tara Theatre Atlanta (taraatlanta.com).
Classic Atlanta cinema showing independent and art house films.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash, remove_stale_source_events
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)


def extract_movie_images(page: Page) -> dict[str, str]:
    """Extract movie title to image URL mapping from the page."""
    image_map = {}
    try:
        images = page.query_selector_all("img[alt]")
        for img in images:
            alt = img.get_attribute("alt")
            src = img.get_attribute("src")
            if alt and src and "imgix.net" in src and len(alt) > 3:
                skip_alts = ["Logo", "Rated", "expand", "arrow", "play_arrow", "Icon"]
                if not any(skip in alt for skip in skip_alts):
                    image_map[alt.strip()] = src
    except Exception as e:
        logger.warning(f"Error extracting movie images: {e}")
    logger.info(f"Extracted {len(image_map)} movie images")
    return image_map


def find_image_for_movie(title: str, image_map: dict[str, str]) -> Optional[str]:
    """Find image URL for a movie title, with fuzzy matching."""
    if title in image_map:
        return image_map[title]
    title_lower = title.lower()
    for img_title, url in image_map.items():
        if img_title.lower() == title_lower:
            return url
    for img_title, url in image_map.items():
        if title_lower in img_title.lower() or img_title.lower() in title_lower:
            return url
    return None

BASE_URL = "https://www.taraatlanta.com"
HOME_URL = f"{BASE_URL}/home"
COMING_SOON_URL = f"{BASE_URL}/coming-soon"

VENUE_DATA = {
    "name": "Tara Theatre",
    "slug": "tara-theatre",
    "address": "2345 Cheshire Bridge Rd NE",
    "neighborhood": "Cheshire Bridge",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
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


def extract_movies_for_date(
    page: Page,
    target_date: datetime,
    source_id: int,
    venue_id: int,
    image_map: Optional[dict[str, str]] = None,
    seen_hashes: Optional[set] = None,
) -> tuple[int, int, int]:
    """Extract movies and showtimes for a specific date.

    New Tara Theatre format (2026):
    - Movies appear as cards with title, duration, description, then showtimes
    - Structure:
      "Sound of Falling (2026)"
      "2 hr 35 min·Drama·"
      "Description..."
      "4:30 PM"
      "THEATRE 3 (THE KENNY)"
      "7:00 PM"
      "THEATRE 2 (THE JACK)"
    """
    events_found = 0
    events_new = 0
    events_updated = 0
    image_map = image_map or {}

    date_str = target_date.strftime("%Y-%m-%d")

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    seen_movies = set()
    matches = []  # List of (title, [times], description)

    # Find movie titles by looking for duration pattern on next line
    # Title patterns: "Movie Name (2026)" or "Movie Name"
    # Duration pattern: "X hr Y min" or "X hr" followed by genre
    duration_pattern = re.compile(r'^(\d+)\s*hr(?:\s*(\d+)\s*min)?', re.IGNORECASE)
    time_pattern = re.compile(r'^(\d{1,2}:\d{2})\s*(AM|PM)$', re.IGNORECASE)

    current_movie = None
    current_times = []
    current_desc_lines = []
    seen_first_time = False

    skip_titles = [
        "NOW PLAYING", "COMING SOON", "THE TARA", "Plaza Theatre",
        "Today", "Other", "Date", "STORE", "ABOUT", "DONATE", "RENTALS",
        "accessible", "theater_comedy", "Digital", "THEATRE", "Theatre",
        "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Feb", "Jan",
        "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Check if this line is a time
        time_match = time_pattern.match(line)
        if time_match and current_movie:
            seen_first_time = True
            hour = int(time_match.group(1).split(':')[0])
            minute = time_match.group(1).split(':')[1]
            period = time_match.group(2).upper()
            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0
            formatted_time = f"{hour:02d}:{minute}"
            if formatted_time not in current_times:
                current_times.append(formatted_time)
            i += 1
            continue

        # Check if next line is a duration (indicates current line is a movie title)
        if i + 1 < len(lines):
            next_line = lines[i + 1]
            if duration_pattern.match(next_line):
                # Save previous movie if we have one with times
                if current_movie and current_times:
                    desc = " ".join(current_desc_lines).strip() or None
                    matches.append((current_movie, current_times, desc))

                # Check if this looks like a valid movie title
                if (len(line) >= 3 and
                    not any(skip.lower() == line.lower() for skip in skip_titles) and
                    not line.startswith("·") and
                    not re.match(r'^\d+$', line)):
                    current_movie = line
                    current_times = []
                    current_desc_lines = []
                    seen_first_time = False
                else:
                    current_movie = None
                    current_times = []
                    current_desc_lines = []
                    seen_first_time = False

                i += 1
                continue

        # Collect description lines between duration and first showtime
        if current_movie and not seen_first_time:
            if (not duration_pattern.match(line) and
                'THEATRE' not in line.upper() and
                len(line) > 20 and
                '·' not in line):
                current_desc_lines.append(line)

        i += 1

    # Don't forget the last movie
    if current_movie and current_times:
        desc = " ".join(current_desc_lines).strip() or None
        matches.append((current_movie, current_times, desc))

    logger.info(f"Found {len(matches)} movies with showtimes for {date_str}")

    # Debug: show what was found
    for m in matches[:3]:
        logger.debug(f"  Extracted: '{m[0][:40]}' | {m[1]}")

    for title_part, times_list, movie_desc in matches:
        title_part = title_part.strip()

        # Clean up title - remove common prefixes
        for prefix in ["NOW PLAYING ", "COMING SOON ", "News Carousel "]:
            if title_part.startswith(prefix):
                title_part = title_part[len(prefix):].strip()

        # Skip if title is empty or too short
        if len(title_part) < 3:
            continue

        # Skip UI text and navigation elements
        skip_words = [
            "STORE", "ABOUT", "DONATE", "RENTALS", "THE TARA", "Plaza Theatre",
            "Today", "Select", "Showtimes", "Subscribe", "Mailing List", "Email",
            "Facebook", "Instagram", "Copyright", "All rights", "Father Mother",
            "Get Tickets", "Join", "searchTitle", "My Movies", "Accessibility",
            "TBA", "To Be Announced", "Coming Soon", "Upcoming", "News Carousel",
            "NOW PLAYING",
        ]
        if any(skip.lower() in title_part.lower() for skip in skip_words):
            continue

        # Skip if title is too long (probably not a movie title)
        if len(title_part) > 100:
            continue

        # Skip placeholder titles (TBA, TBD, etc.)
        if re.match(r'^(TBA|TBD|TBC|To Be Announced|To Be Determined)(\s*\([^)]+\))?$', title_part, re.IGNORECASE):
            continue

        # Skip movies with no valid showtimes
        if not times_list:
            logger.debug(f"Skipping '{title_part}' - no valid showtimes")
            continue

        # Create events for each valid showtime
        for showtime in times_list:
            movie_key = f"{title_part}|{date_str}|{showtime}"
            if movie_key in seen_movies:
                continue
            seen_movies.add(movie_key)

            events_found += 1

            content_hash = generate_content_hash(
                title_part, "Tara Theatre", f"{date_str}|{showtime}"
            )
            if seen_hashes is not None:
                seen_hashes.add(content_hash)

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
            else:
                # Try to find image with title normalization
                clean_title = re.sub(r'\s*\(\d{4}\)\s*$', '', title_part)  # Remove year
                clean_title = re.sub(r'\s*\(Digital\)\s*$', '', clean_title, flags=re.IGNORECASE)
                movie_image = find_image_for_movie(title_part, image_map)
                if not movie_image:
                    movie_image = find_image_for_movie(clean_title, image_map)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title_part,
                    "description": movie_desc,
                    "start_date": date_str,
                    "start_time": showtime,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "film",
                    "subcategory": "cinema",
                    "tags": ["film", "cinema", "arthouse", "showtime", "tara-theatre"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": HOME_URL,
                    "ticket_url": None,
                    "image_url": movie_image,
                    "raw_text": None,
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        f"Added: {title_part} on {date_str} at {showtime}"
                    )
                except Exception as e:
                    logger.error(f"Failed to insert: {title_part}: {e}")
    return events_found, events_new, events_updated


def extract_upcoming_movies(
    page: Page,
    source_id: int,
    venue_id: int,
    source_url: str,
    image_map: Optional[dict[str, str]] = None,
) -> tuple[int, int, int]:
    """Extract movies from Coming Soon page."""
    events_found = 0
    events_new = 0
    events_updated = 0

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    skip_patterns = [
        "NOW PLAYING",
        "COMING SOON",
        "STORE",
        "ABOUT",
        "DONATE",
        "RENTALS",
        "THE TARA",
        "Plaza Theatre",
        "expand_more",
        "arrow_drop_down",
        "calendar_today",
        "swap_vert",
        "keyboard_arrow",
        "chevron",
        "arrow_",
        "Digital",
        "accessible",
        "headphones",
        "closed_caption",
        "CAPTION",
        "SUBTITLED",
        "Select",
        "Loading",
        "Popping",
        "Starting",
        "SHOWTIMES",
        "announced",
        "Buy Tickets",
        "More Info",
        "SUBSCRIBE",
        "Email",
        "Facebook",
        "Instagram",
        "Twitter",
        "Title, genre",
        "actor, date",
        "Release Date",
        "screen-reader",
        "Accessibility",
        "Feedback",
        "Cheshire Bridge",
        "Atlanta, GA",
        "30324",
        "ACCEPT",
        "DISMISS",
        "Movies",
        "Explore Movies",
        "TBA",
        "OPENS",
        "Opens",
        "©",
        "Copyright",
        "All Rights Reserved",
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
        if (
            line.startswith("·")
            or line.startswith("_")
            or re.match(r"^[a-z_]+$", line)
            or re.match(r"^\d{1,2}$", line)
            or re.match(r"^\d{1,2}/\d{1,2}", line)
            or re.match(r"^\d{1,2}:\d{2}", line)
            or re.match(r"^\d+\s*(hr|min)", line)
            or re.match(r"^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$", line)
            or re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)", line, re.IGNORECASE)
            or re.match(
                r"^(January|February|March|April|May|June|July|August|September|October|November|December)",
                line,
                re.IGNORECASE,
            )
            or re.match(
                r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$",
                line,
                re.IGNORECASE,
            )
        ):
            continue

        # Skip ratings and genre-only lines
        if re.match(
            r"^(Not Rated|G|PG|PG-13|R|NC-17|NR|Unrated)$", line, re.IGNORECASE
        ):
            continue
        if re.match(r"^[A-Z][a-z]+(\s*·\s*[A-Z][a-z]+)+$", line):
            continue

        # Check if it looks like a movie title
        if not (line[0].isupper() or line[0].isdigit()):
            continue

        # Skip if too long (probably a description)
        if len(line) > 80:
            continue

        # Skip if already seen
        if line in seen_movies:
            continue

        movie_title = line
        seen_movies.add(movie_title)
        events_found += 1

        content_hash = generate_content_hash(
            movie_title, "Tara Theatre", "coming-soon"
        )

        existing = find_event_by_hash(content_hash)
        if existing:
            events_updated += 1
        else:
            # Use date 30 days from now as placeholder
            placeholder_date = (datetime.now() + timedelta(days=30)).strftime(
                "%Y-%m-%d"
            )

            movie_image = find_image_for_movie(movie_title, image_map or {})

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": movie_title,
                "description": "Coming Soon",
                "start_date": placeholder_date,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
                "category": "film",
                "subcategory": "cinema",
                "tags": ["film", "cinema", "arthouse", "tara-theatre", "coming-soon"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": source_url,
                "ticket_url": None,
                "image_url": movie_image,
                "raw_text": None,
                "extraction_confidence": 0.75,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added coming soon: {movie_title}")
            except Exception as e:
                logger.error(f"Failed to insert coming soon: {movie_title}: {e}")

    return events_found, events_new, events_updated


def _click_tara_tab(page: Page) -> None:
    """Click the 'THE TARA' tab if visible (site shows both Tara and Plaza)."""
    try:
        tara_tab = page.locator("text=THE TARA").first
        if tara_tab.is_visible(timeout=2000):
            tara_tab.click()
            page.wait_for_timeout(1500)
    except Exception:
        pass


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Tara Theatre showtimes for today and upcoming days."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0
    seen_hashes = set()  # Track all hashes from this crawl for stale cleanup

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
            logger.info(f"Fetching Tara Theatre: {HOME_URL}")
            page.goto(HOME_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)  # Wait for JS to load

            # Click "THE TARA" tab (site shows both Tara and Plaza)
            _click_tara_tab(page)

            # Extract movie images from the page
            image_map = extract_movie_images(page)

            # First, get today's showtimes (default view)
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            found, new, updated = extract_movies_for_date(
                page, datetime.combine(today, datetime.min.time()), source_id, venue_id, image_map, seen_hashes
            )
            total_found += found
            total_new += new
            total_updated += updated
            if found > 0:
                logger.info(
                    f"  {today.strftime('%Y-%m-%d')}: {found} movies found, {new} new"
                )

            # Navigate upcoming days via the Quasar date picker (calendar).
            # The site's day-name buttons ("Fri", "Sat") are unreliable because
            # text locators match other page elements. Instead, we click "Other"
            # to open the Q-Date picker and use JS to click specific day buttons
            # within the .q-date element.
            current_calendar_month = today.month

            for day_offset in range(1, 14):
                target_date = today + timedelta(days=day_offset)
                day_num = target_date.day
                target_month = target_date.month
                date_str = target_date.strftime("%Y-%m-%d")

                # Open the calendar picker
                try:
                    other_btn = page.locator("text=Other").first
                    if not other_btn.is_visible(timeout=2000):
                        logger.debug(f"Other button not visible for {date_str}")
                        continue
                    other_btn.click()
                    page.wait_for_timeout(1500)
                except Exception:
                    logger.debug(f"Could not open calendar for {date_str}")
                    continue

                # Navigate to the correct month if needed
                if target_month != current_calendar_month:
                    try:
                        page.evaluate("""() => {
                            const picker = document.querySelector('.q-date');
                            if (!picker) return;
                            const nextBtn = picker.querySelector('.q-date__arrow button[aria-label="Next month"]');
                            if (nextBtn) nextBtn.click();
                        }""")
                        page.wait_for_timeout(1000)
                        current_calendar_month = target_month
                    except Exception:
                        logger.debug(f"Could not navigate to month {target_month}")

                # Click the target day within the calendar
                click_result = page.evaluate(f"""() => {{
                    const picker = document.querySelector('.q-date');
                    if (!picker) return 'no_picker';
                    const items = picker.querySelectorAll('.q-date__calendar-item');
                    for (const item of items) {{
                        const btn = item.querySelector('button');
                        if (btn && btn.innerText.trim() === '{day_num}') {{
                            const isAvailable = item.classList.contains('q-date__calendar-item--in');
                            btn.click();
                            return isAvailable ? 'ok' : 'unavailable';
                        }}
                    }}
                    return 'not_found';
                }}""")

                if click_result != "ok":
                    if click_result == "unavailable":
                        logger.info(f"  {date_str}: No showtimes scheduled (calendar --out)")
                    else:
                        logger.debug(f"  {date_str}: Calendar click result: {click_result}")
                    # Stop after first unavailable date (theater hasn't published further)
                    break

                page.wait_for_timeout(2000)

                # Re-select THE TARA tab (may reset after date change)
                _click_tara_tab(page)

                logger.info(f"Scraping {date_str}")
                found, new, updated = extract_movies_for_date(
                    page,
                    datetime.combine(target_date, datetime.min.time()),
                    source_id,
                    venue_id,
                    image_map,
                    seen_hashes,
                )
                total_found += found
                total_new += new
                total_updated += updated

                if found == 0:
                    logger.info(f"  {date_str}: No showtimes found")
                    break

            # Skip Coming Soon page - these movies don't have real dates/times
            # and show up as TBA which isn't useful for users
            # The movies will be picked up when they get actual showtimes
            logger.info("Skipping Coming Soon page (no actual showtimes)")

            browser.close()

        # Remove stale showtimes that are no longer on the theater's schedule
        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info(f"Removed {stale_removed} stale showtimes no longer on schedule")

        logger.info(
            f"Tara Theatre crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Tara Theatre: {e}")
        raise

    return total_found, total_new, total_updated
