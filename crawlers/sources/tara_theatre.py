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

from db import get_or_create_venue, insert_event, find_event_by_hash
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
) -> tuple[int, int, int]:
    """Extract movies and showtimes for a specific date.

    New Tara Theatre format (pipe-delimited):
    - Format: "Title (optional year) | Time, Time, Time"
    - Examples:
      "Hamnet (2025) | 12:45PM, 5:15PM"
      "Marty Supreme (2025) | 1:15PM, 8:00PM"
      "Cutting Through Rocks | 6:00PM"
    """
    events_found = 0
    events_new = 0
    events_updated = 0
    image_map = image_map or {}

    date_str = target_date.strftime("%Y-%m-%d")

    body_text = page.inner_text("body")

    seen_movies = set()

    # The page returns movies in a format like:
    # "NOW PLAYING Hamnet (2025) | 12:45PM, 5:15PM Marty Supreme (2025) | 1:15PM, 8:00PM ..."
    # Structure: Title1 | Times1 Title2 | Times2 Title3 | Times3
    # Split by pipe, then parse: first part = Title1, subsequent parts = "Times Title"

    matches = []
    time_pattern = re.compile(r'^((?:\d{1,2}:\d{2}\s*[AP]M,?\s*)+)', re.IGNORECASE)

    for line in body_text.split("\n"):
        if "|" not in line or not re.search(r'\d{1,2}:\d{2}\s*[AP]M', line, re.IGNORECASE):
            continue

        parts = line.split("|")
        if len(parts) < 2:
            continue

        # Build list of (title, times) by processing parts in order
        titles = []
        times_list = []

        # First part is the first movie title
        first_title = parts[0].strip()
        for prefix in ["NOW PLAYING ", "COMING SOON "]:
            if first_title.startswith(prefix):
                first_title = first_title[len(prefix):].strip()
        titles.append(first_title)

        # Each subsequent part starts with times, followed by next title
        for part in parts[1:]:
            part = part.strip()
            time_match = time_pattern.match(part)
            if time_match:
                times_str = time_match.group(1).strip().rstrip(',')
                times_list.append(times_str)

                # Text after times is the next movie title
                next_title = part[time_match.end():].strip()
                if next_title and len(next_title) > 2:
                    titles.append(next_title)

        # Pair titles with their times
        for i, title in enumerate(titles):
            if i < len(times_list):
                matches.append((title, times_list[i]))

        break  # Only process first matching line

    logger.info(f"Found {len(matches)} movie showtimes for {date_str}")

    # Debug: show what was found
    for m in matches[:3]:
        logger.debug(f"  Extracted: '{m[0][:40]}' | '{m[1]}'")

    for title_part, times_part in matches:
        title_part = title_part.strip()
        times_part = times_part.strip()

        # Clean up title - remove common prefixes
        for prefix in ["NOW PLAYING ", "COMING SOON ", "News Carousel "]:
            if title_part.startswith(prefix):
                title_part = title_part[len(prefix):].strip()

        # Skip if title contains multiple movie indicators (bad match)
        if "NOW PLAYING" in title_part or " - " in title_part and len(title_part) > 40:
            logger.debug(f"Skipping bad match: '{title_part[:50]}...'")
            continue

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

        # Skip if times section contains TBA without actual times
        has_tba = re.search(r'\bTBA\b', times_part, re.IGNORECASE)
        has_real_time = re.search(r'\d{1,2}:\d{2}\s*[AP]M', times_part, re.IGNORECASE)
        if has_tba and not has_real_time:
            logger.debug(f"Skipping '{title_part}' - only TBA times found")
            continue

        # Parse comma-separated times
        # Handle formats like "12:45PM", "1:00PM", "8:00PM"
        time_strings = [t.strip() for t in times_part.split(",")]

        valid_showtimes = []
        for time_str in time_strings:
            # Clean up the time string (remove extra spaces)
            time_str = re.sub(r'\s+', '', time_str)

            # Parse time - handle formats like "12:45PM" or "1:00PM"
            start_time = parse_time(time_str)
            if start_time:
                valid_showtimes.append((time_str, start_time))

        # Skip movies with no valid showtimes
        if not valid_showtimes:
            logger.debug(f"Skipping '{title_part}' - no valid showtimes extracted from '{times_part}'")
            continue

        # Create events for each valid showtime
        for time_str, start_time in valid_showtimes:
            movie_key = f"{title_part}|{date_str}|{start_time}"
            if movie_key in seen_movies:
                continue
            seen_movies.add(movie_key)

            events_found += 1

            content_hash = generate_content_hash(
                title_part, "Tara Theatre", f"{date_str}|{start_time}"
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
            else:
                movie_image = find_image_for_movie(title_part, image_map)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title_part,
                    "description": None,  # No duration info in new format
                    "start_date": date_str,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "film",
                    "subcategory": "cinema",
                    "tags": ["film", "cinema", "arthouse", "tara-theatre"],
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
                        f"Added: {title_part} on {date_str} at {start_time}"
                    )
                except Exception as e:
                    logger.error(f"Failed to insert: {title_part}: {e}")

    logger.info(f"Found {events_found} movie showtimes for {date_str}")
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Tara Theatre showtimes for today and upcoming days."""
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
            logger.info(f"Fetching Tara Theatre: {HOME_URL}")
            page.goto(HOME_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)  # Wait for JS to load

            # Extract movie images from the page
            image_map = extract_movie_images(page)

            # First, get today's showtimes (default view)
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            found, new, updated = extract_movies_for_date(
                page, datetime.combine(today, datetime.min.time()), source_id, venue_id, image_map
            )
            total_found += found
            total_new += new
            total_updated += updated
            if found > 0:
                logger.info(
                    f"  {today.strftime('%Y-%m-%d')}: {found} movies found, {new} new"
                )

            # Click through the quick-select day buttons (Sat, Sun, Mon, Tue, etc.)
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
                    page,
                    datetime.combine(target_date, datetime.min.time()),
                    source_id,
                    venue_id,
                    image_map,
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

            # Skip Coming Soon page - these movies don't have real dates/times
            # and show up as TBA which isn't useful for users
            # The movies will be picked up when they get actual showtimes
            logger.info("Skipping Coming Soon page (no actual showtimes)")

            browser.close()

        logger.info(
            f"Tara Theatre crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Tara Theatre: {e}")
        raise

    return total_found, total_new, total_updated
