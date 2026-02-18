"""
Crawler for Plaza Theatre Atlanta (plazaatlanta.com).
Historic independent cinema showing first-run indie, classic, and cult films.

The site is a Quasar/Vue.js SPA with the following structure:

NOW SHOWING PAGE (/now-showing):
- Movies are rendered as .movie-container elements after JS loads (4-5s wait)
- Site shows both Plaza Theatre and Tara Theatre with tabs at top
- Must click "Plaza Theatre Atlanta" tab to see correct schedule
- Each movie container has:
  - .text-h5: Movie title (may include format like "35mm" or rating)
  - button elements: Showtimes with format "7:00 PM\\nENDS AT 9:00 PM"
  - img.q-img__image: Poster image
- Day selector buttons at top (Today, Mon, Tue, etc. + "Other" for calendar)
- Clicking a day button updates the schedule dynamically

SPECIAL EVENTS PAGE (/special-events/):
- Text-based layout with date headers
- Format: "Feb 4" followed by event title and optional description
- May include embedded time like "Event Title at 9:45 PM"

ENRICHMENT:
- Uses Letterboxd RSS feed for TMDB IDs, high-quality posters, and special event detection
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, remove_stale_source_events
from dedupe import generate_content_hash
from sources.plaza_letterboxd import get_letterboxd_movies, enrich_movie_data

logger = logging.getLogger(__name__)

BASE_URL = "https://www.plazaatlanta.com"

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


def parse_date(date_text: str, year: int = None) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD.

    Handles:
    - "January 31" or "Jan 31"
    - "January 31, 2026"
    - "Jan 31 at 9:45 PM" (extracts just the date part)
    """
    if year is None:
        year = datetime.now().year

    date_text = date_text.strip()

    # Remove time portion if present
    date_text = re.sub(r'\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?', '', date_text, flags=re.IGNORECASE)

    months = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12,
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
        'jun': 6, 'jul': 7, 'aug': 8,
        'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
    }

    match = re.match(
        r'([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?',
        date_text,
        re.IGNORECASE
    )
    if match:
        month_str, day, parsed_year = match.groups()
        month = months.get(month_str.lower())
        if month:
            if parsed_year:
                year = int(parsed_year)
            try:
                date = datetime(year, month, int(day))
                if date.date() < datetime.now().date():
                    date = datetime(year + 1, month, int(day))
                return date.strftime("%Y-%m-%d")
            except ValueError:
                pass

    return None


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


def extract_movies_for_date(
    page: Page,
    target_date: datetime,
    source_id: int,
    venue_id: int,
    letterboxd_movies: list[dict],
    image_map: dict[str, str],
    seen_hashes: set,
) -> tuple[int, int, int]:
    """Extract movies and showtimes for the currently displayed date.

    The page should already be showing the correct date's schedule.
    Movies appear as .movie-container elements with:
    - .text-h5 for title
    - button elements for showtimes (text like "6:30 PM\\nENDS AT 8:13 PM")
    - img.q-img__image for poster
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    date_str = target_date.strftime("%Y-%m-%d")

    # Try DOM-based extraction first using .movie-container elements
    containers = page.query_selector_all(".movie-container")
    logger.debug(f"Found {len(containers)} .movie-container elements for {date_str}")

    # Log a warning if no containers found (might indicate site change)
    if len(containers) == 0:
        logger.warning(f"No .movie-container elements found for {date_str} - site structure may have changed, falling back to text extraction")

    if containers:
        for container in containers:
            try:
                # Extract title
                title_el = container.query_selector(".text-h5")
                if not title_el:
                    continue
                movie_title = title_el.inner_text().strip()
                if not movie_title or len(movie_title) < 2:
                    continue

                # Clean up title
                movie_title = " ".join(movie_title.split())
                movie_title = re.sub(r'\s*\((?:4K|2K|35mm|70mm)\)\s*$', '', movie_title, flags=re.IGNORECASE)
                movie_title = re.sub(r'\s*(?:Not Rated|Rated\s*[RPGNC](?:-\d+)?)\s*$', '', movie_title, flags=re.IGNORECASE)
                movie_title = movie_title.strip()

                if not movie_title or len(movie_title) < 2:
                    continue

                # Extract showtimes from buttons within this container
                buttons = container.query_selector_all("button")
                showtimes = []
                for btn in buttons:
                    try:
                        btn_text = btn.inner_text().strip()
                        # Button text is like "6:30 PM\nENDS AT 8:13 PM" or just "6:30 PM"
                        first_line = btn_text.split("\n")[0].strip()
                        parsed_time = parse_time(first_line)
                        if parsed_time and parsed_time not in showtimes:
                            showtimes.append(parsed_time)
                    except Exception:
                        continue

                if not showtimes:
                    logger.warning(f"  Movie '{movie_title}' found but has no showtimes on {date_str} - skipping")
                    continue

                logger.debug(f"  Processing '{movie_title}' with {len(showtimes)} showtime(s): {', '.join(showtimes)}")

                # Extract image from this container
                img_el = container.query_selector("img.q-img__image")
                container_image = None
                if img_el:
                    container_image = img_el.get_attribute("src")

                # Get Letterboxd enrichment
                enrichment = enrich_movie_data(movie_title, letterboxd_movies) or {}

                # Build tags
                tags = ["film", "cinema", "independent", "showtime", "plaza-theatre"]
                if enrichment.get("special_event"):
                    tags.append(enrichment["special_event"])

                # Best image: Letterboxd > container image > image_map
                image_url = (
                    enrichment.get("image_url")
                    or container_image
                    or find_image_for_movie(movie_title, image_map)
                )

                # Create event for each showtime
                for start_time in showtimes:
                    events_found += 1
                    content_hash = generate_content_hash(
                        movie_title, "Plaza Theatre", f"{date_str}|{start_time}"
                    )
                    seen_hashes.add(content_hash)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": movie_title,
                        "description": None,
                        "start_date": date_str,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "film",
                        "subcategory": "cinema",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": f"{BASE_URL}/now-showing",
                        "ticket_url": enrichment.get("ticket_url"),
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        if smart_update_existing_event(existing, event_record):
                            events_updated += 1
                    else:
                        series_hint = {
                            "series_type": "film",
                            "series_title": movie_title,
                        }
                        if enrichment.get("tmdb_id"):
                            series_hint["tmdb_id"] = enrichment["tmdb_id"]

                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(f"  Added: {movie_title} on {date_str} at {start_time}")
                        except Exception as e:
                            logger.error(f"  Failed to insert: {e}")

            except Exception as e:
                logger.debug(f"Error processing movie container: {e}")
                continue
    else:
        # Fallback: text-based extraction (same approach as Tara crawler)
        events_found, events_new, events_updated = _extract_movies_from_text(
            page, date_str, source_id, venue_id, letterboxd_movies, image_map, seen_hashes
        )

    logger.info(f"  {date_str}: {events_found} showtimes found, {events_new} new")
    return events_found, events_new, events_updated


def _extract_movies_from_text(
    page: Page,
    date_str: str,
    source_id: int,
    venue_id: int,
    letterboxd_movies: list[dict],
    image_map: dict[str, str],
    seen_hashes: set,
) -> tuple[int, int, int]:
    """Fallback text-based extraction if DOM selectors don't work."""
    events_found = 0
    events_new = 0
    events_updated = 0

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    duration_pattern = re.compile(r'^(\d+)\s*hr(?:\s*(\d+)\s*min)?', re.IGNORECASE)
    time_pattern = re.compile(r'^(\d{1,2}:\d{2})\s*(AM|PM)$', re.IGNORECASE)

    current_movie = None
    current_times = []
    matches = []

    skip_titles = [
        "NOW PLAYING", "COMING SOON", "SPECIAL", "PLAZA THEATRE", "TARA",
        "Today", "Other", "Date", "STORE", "ABOUT", "DONATE", "RENTALS",
        "accessible", "Digital", "THEATRE", "Theatre",
        "Showtimes, news and more", "Showtimes",
        "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue",
        "Feb", "Jan", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Check if this line is a time
        time_match = time_pattern.match(line)
        if time_match and current_movie:
            parsed = parse_time(line)
            if parsed and parsed not in current_times:
                current_times.append(parsed)
            i += 1
            continue

        # Check if next line is a duration (indicates current line is a movie title)
        if i + 1 < len(lines) and duration_pattern.match(lines[i + 1]):
            if current_movie and current_times:
                matches.append((current_movie, current_times))

            if (len(line) >= 3 and
                not any(skip.lower() == line.lower() for skip in skip_titles) and
                not line.startswith("·") and
                not re.match(r'^\d+$', line)):
                current_movie = line
                current_times = []
            else:
                current_movie = None
                current_times = []
            i += 1
            continue

        i += 1

    if current_movie and current_times:
        matches.append((current_movie, current_times))

    for title, times_list in matches:
        title = " ".join(title.split())
        title = re.sub(r'\s*\((?:4K|2K|35mm|70mm)\)\s*$', '', title, flags=re.IGNORECASE)
        title = title.strip()
        if len(title) < 2 or not times_list:
            continue

        enrichment = enrich_movie_data(title, letterboxd_movies) or {}
        tags = ["film", "cinema", "independent", "showtime", "plaza-theatre"]
        if enrichment.get("special_event"):
            tags.append(enrichment["special_event"])
        image_url = enrichment.get("image_url") or find_image_for_movie(title, image_map)

        for start_time in times_list:
            events_found += 1
            content_hash = generate_content_hash(
                title, "Plaza Theatre", f"{date_str}|{start_time}"
            )
            seen_hashes.add(content_hash)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": None,
                "start_date": date_str,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "film",
                "subcategory": "cinema",
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": f"{BASE_URL}/now-showing",
                "ticket_url": enrichment.get("ticket_url"),
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.85,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                if smart_update_existing_event(existing, event_record):
                    events_updated += 1
            else:
                series_hint = {
                    "series_type": "film",
                    "series_title": title,
                }
                if enrichment.get("tmdb_id"):
                    series_hint["tmdb_id"] = enrichment["tmdb_id"]

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"  Added: {title} on {date_str} at {start_time}")
                except Exception as e:
                    logger.error(f"  Failed to insert: {e}")

    return events_found, events_new, events_updated


def extract_special_events(
    page: Page,
    source_id: int,
    venue_id: int,
    letterboxd_movies: list[dict],
    image_map: dict[str, str],
    seen_hashes: set,
) -> tuple[int, int, int]:
    """Extract special events from /special-events/ page.

    Special events are listed as text blocks with format:
    "Feb 4" (date line)
    "Event Title"
    "Description text..."
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Date pattern: "Feb 4", "January 15", etc.
    date_pattern = re.compile(
        r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|'
        r'January|February|March|April|May|June|July|August|September|October|November|December)'
        r'\s+(\d{1,2})(?:,?\s+(\d{4}))?$',
        re.IGNORECASE
    )

    skip_lines = [
        "SPECIAL EVENTS", "PLAZA THEATRE", "NOW PLAYING", "COMING SOON",
        "STORE", "ABOUT", "DONATE", "RENTALS", "accessible", "expand_more",
        "arrow", "Email", "Facebook", "Instagram", "Copyright", "Subscribe",
        "Mailing List", "Join", "Newsletter", "Sign Up",
        "Showtimes, news and more", "Showtimes",
    ]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for date lines
        date_match = date_pattern.match(line)
        if date_match:
            event_date = parse_date(line)
            if not event_date:
                i += 1
                continue

            # Next non-empty line should be the event title
            title = None
            description = None
            time_str = None

            j = i + 1
            while j < len(lines) and j < i + 5:
                next_line = lines[j].strip()
                if not next_line or any(skip.lower() in next_line.lower() for skip in skip_lines):
                    j += 1
                    continue

                # Check if this is another date (next event)
                if date_pattern.match(next_line):
                    break

                if title is None:
                    # Check if there's a time embedded: "Event at 9:45 PM"
                    at_time = re.search(r'\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))', next_line, re.IGNORECASE)
                    if at_time:
                        time_str = parse_time(at_time.group(1))
                        title = re.sub(r'\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)', '', next_line, flags=re.IGNORECASE).strip()
                    else:
                        title = next_line

                    # Skip UI noise
                    if len(title) < 3 or any(skip.lower() in title.lower() for skip in skip_lines):
                        title = None
                        j += 1
                        continue
                elif description is None:
                    # Check if it's a standalone time
                    standalone_time = parse_time(next_line)
                    if standalone_time:
                        time_str = standalone_time
                    elif not date_pattern.match(next_line):
                        description = next_line
                j += 1

            if title:
                title = " ".join(title.split())
                # Remove format indicators
                title = re.sub(r'\s*\((?:4K|2K|35mm|70mm)\)\s*$', '', title, flags=re.IGNORECASE)
                title = title.strip()

                if len(title) >= 3:
                    events_found += 1

                    content_hash = generate_content_hash(
                        title, "Plaza Theatre", f"{event_date}|{time_str or '00:00'}"
                    )
                    seen_hashes.add(content_hash)

                    enrichment = enrich_movie_data(title, letterboxd_movies) or {}
                    tags = ["film", "cinema", "independent", "plaza-theatre", "special-event"]
                    if enrichment.get("special_event"):
                        tags.append(enrichment["special_event"])

                    # Check title for special markers
                    if "35mm" in title.lower():
                        tags.append("35mm")
                    if "trivia" in title.lower():
                        tags.append("trivia")

                    image_url = (
                        enrichment.get("image_url")
                        or find_image_for_movie(title, image_map)
                    )

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": event_date,
                        "start_time": time_str,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": time_str is None,
                        "category": "film",
                        "subcategory": "special_screening",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": f"{BASE_URL}/special-events/",
                        "ticket_url": enrichment.get("ticket_url"),
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        if smart_update_existing_event(existing, event_record):
                            events_updated += 1
                    else:
                        series_hint = {
                            "series_type": "film",
                            "series_title": title,
                        }
                        if enrichment.get("tmdb_id"):
                            series_hint["tmdb_id"] = enrichment["tmdb_id"]

                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(f"  Added special event: {title} on {event_date}")
                        except Exception as e:
                            logger.error(f"  Failed to insert special event: {e}")

            i = j if j > i + 1 else i + 1
        else:
            i += 1

    return events_found, events_new, events_updated


def _click_plaza_tab(page: Page) -> None:
    """Click the 'Plaza Theatre Atlanta' tab if visible."""
    try:
        plaza_tab = page.locator("text=Plaza Theatre Atlanta").first
        if plaza_tab.is_visible(timeout=2000):
            plaza_tab.click()
            page.wait_for_timeout(1500)
    except Exception:
        pass


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Plaza Theatre showtimes from now-showing and special-events pages."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0
    seen_hashes = set()

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

            # Fetch Letterboxd RSS for enrichment
            letterboxd_movies = get_letterboxd_movies()
            logger.info(f"Fetched {len(letterboxd_movies)} movies from Letterboxd RSS")

            # --- Now Showing page ---
            now_showing_url = f"{BASE_URL}/now-showing"
            logger.info(f"Fetching: {now_showing_url}")
            page.goto(now_showing_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Click "Plaza Theatre Atlanta" tab (site shows both Plaza and Tara)
            _click_plaza_tab(page)

            # Extract movie images
            image_map = extract_movie_images(page)

            # Extract today's showtimes (default view)
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            found, new, updated = extract_movies_for_date(
                page, datetime.combine(today, datetime.min.time()),
                source_id, venue_id, letterboxd_movies, image_map, seen_hashes
            )
            total_found += found
            total_new += new
            total_updated += updated

            # Navigate upcoming days via the Quasar date picker (calendar).
            # The site's day-name buttons ("Fri", "Sat") are unreliable because
            # text locators match other page elements (e.g. "EVERY FRIDAY AT 11PM").
            # Instead, we click "Other" to open the Q-Date picker and use JS to
            # click specific day buttons within the .q-date element.
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

                # Re-select Plaza Theatre tab (may reset after date change)
                _click_plaza_tab(page)

                logger.info(f"Scraping {date_str}")
                found, new, updated = extract_movies_for_date(
                    page, datetime.combine(target_date, datetime.min.time()),
                    source_id, venue_id, letterboxd_movies, image_map, seen_hashes
                )
                total_found += found
                total_new += new
                total_updated += updated

                if found == 0:
                    logger.info(f"  {date_str}: No showtimes found")
                    break

            # --- Special Events page ---
            special_url = f"{BASE_URL}/special-events/"
            logger.info(f"Fetching: {special_url}")
            try:
                page.goto(special_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                found, new, updated = extract_special_events(
                    page, source_id, venue_id, letterboxd_movies, image_map, seen_hashes
                )
                total_found += found
                total_new += new
                total_updated += updated
            except Exception as e:
                logger.error(f"Error crawling special events: {e}")

            browser.close()

        # Remove stale showtimes that are no longer on the theater's schedule
        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info(f"Removed {stale_removed} stale showtimes no longer on schedule")

        logger.info(
            f"Plaza Theatre crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Plaza Theatre: {e}")
        raise

    return total_found, total_new, total_updated
