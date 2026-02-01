"""
Crawler for Plaza Theatre Atlanta (plazaatlanta.com).
Historic independent cinema showing first-run indie, classic, and cult films.

Crawls three sections:
- /now-showing - Currently playing movies
- /special-events/ - Special screenings, trivia nights, 35mm shows
- /coming-soon - Upcoming releases

Each movie has its own detail page with showtimes loaded via JavaScript.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from sources.plaza_letterboxd import get_letterboxd_movies, enrich_movie_data

logger = logging.getLogger(__name__)

BASE_URL = "https://www.plazaatlanta.com"

# Pages to scrape for movie links
SECTION_URLS = [
    f"{BASE_URL}/now-showing",
    f"{BASE_URL}/special-events/",
    f"{BASE_URL}/coming-soon",
]

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

    # Clean up the text
    date_text = date_text.strip()

    # Remove time portion if present
    date_text = re.sub(r'\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?', '', date_text, flags=re.IGNORECASE)

    # Month name mapping
    months = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12,
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
        'jun': 6, 'jul': 7, 'aug': 8,
        'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
    }

    # Try "Month Day, Year" or "Month Day"
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
                # If date is in the past, assume next year
                if date.date() < datetime.now().date():
                    date = datetime(year + 1, month, int(day))
                return date.strftime("%Y-%m-%d")
            except ValueError:
                pass

    return None


def collect_movie_urls(page: Page) -> list[dict]:
    """Collect all movie URLs from the current page.

    Returns list of {url, title} dicts.
    """
    movies = []
    seen_urls = set()

    try:
        # Method 1: Find all direct links to movie pages
        links = page.query_selector_all('a[href*="/movie/"]')

        for link in links:
            try:
                href = link.get_attribute("href")
                if not href or href in seen_urls:
                    continue

                # Make absolute URL
                if href.startswith("/"):
                    href = BASE_URL + href

                # Skip non-Plaza URLs
                if "plazaatlanta.com" not in href:
                    continue

                seen_urls.add(href)

                # Try to get title from link text or nearby elements
                title = link.inner_text().strip()
                if not title or len(title) < 2:
                    try:
                        parent = link.evaluate_handle("el => el.parentElement")
                        title = parent.evaluate("el => el.innerText || ''").split("\n")[0].strip()
                    except Exception:
                        pass

                movies.append({
                    "url": href,
                    "title": title or "Unknown",
                })

            except Exception:
                continue

        # Method 2: For pages without direct /movie/ links, click on movie cards
        # Extract movie titles and click them to get URLs
        if len(movies) == 0:
            body_text = page.inner_text("body")
            lines = body_text.split('\n')

            # Extract movie titles using multiple patterns
            movie_titles = []

            for i, line in enumerate(lines):
                line = line.strip()

                # Pattern 1: Date line (Feb 3, Jan 31) followed by movie title
                if re.match(r'^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$', line):
                    for j in range(i+1, min(i+3, len(lines))):
                        next_line = lines[j].strip()
                        if next_line and len(next_line) > 3:
                            if not re.match(r'^(?:Not Rated|Rated|·|\d)', next_line):
                                movie_titles.append(next_line)
                                break

                # Pattern 2: Year line (2026) followed by movie title
                # Coming-soon format: Tue / Feb / 3rd / 2026 / Title
                if re.match(r'^20\d{2}$', line):
                    for j in range(i+1, min(i+3, len(lines))):
                        next_line = lines[j].strip()
                        if next_line and len(next_line) > 3:
                            # Skip genre lines like "· Horror" and ratings
                            if not re.match(r'^(?:Not Rated|Rated|·|\d)', next_line):
                                if next_line not in movie_titles:
                                    movie_titles.append(next_line)
                                break

                # Pattern 3: Movie title followed by rating/duration
                # e.g., "Withdrawal " then "Not Rated" or "1 hr 33 min"
                if (len(line) > 3 and
                    i + 1 < len(lines) and
                    not line.startswith(('·', 'ENDS AT', 'Digital', 'The ', 'accessible', 'headphones'))):

                    next_line = lines[i + 1].strip() if i + 1 < len(lines) else ""
                    # Check if next line is a rating or duration or genre
                    if re.match(r'^(?:Not Rated|Rated\s*[A-Z]|[RPGN]-?\d*|\d+\s*hr|·\s*\w)', next_line):
                        title = re.sub(r'\s*$', '', line).strip()
                        if title and len(title) >= 3 and title not in movie_titles:
                            skip = ['NOW PLAYING', 'COMING SOON', 'SPECIAL', 'Today', 'Other',
                                    'calendar', 'Date', 'PLAZA', 'TARA', 'expand_more', 'arrow',
                                    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
                                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                            if not any(s.lower() == title.lower() for s in skip):
                                movie_titles.append(title)

            logger.debug(f"Found {len(movie_titles)} potential movie titles to click")

            # Click each movie title to get its URL
            for title in movie_titles[:40]:  # Limit to avoid too many clicks
                try:
                    title_el = page.locator(f"text={title}").first
                    if title_el.is_visible(timeout=1000):
                        title_el.click()
                        page.wait_for_timeout(1500)

                        new_url = page.url
                        if "/movie/" in new_url and new_url not in seen_urls:
                            seen_urls.add(new_url)
                            movies.append({
                                "url": new_url,
                                "title": title,
                            })

                        page.go_back()
                        page.wait_for_timeout(1500)

                except Exception:
                    continue

    except Exception as e:
        logger.error(f"Error collecting movie URLs: {e}")

    return movies


def extract_showtimes_from_detail(page: Page) -> list[dict]:
    """Extract showtimes from a movie detail page.

    The page has date tabs (TODAY, TOMORROW, ALL). Click ALL to see all dates.
    Dates appear as "SAT, JAN 31, 2026" followed by showtime buttons.

    Returns list of {date: "YYYY-MM-DD", time: "HH:MM"} dicts.
    """
    showtimes = []

    try:
        # Wait for initial load
        page.wait_for_timeout(3000)

        # Click "ALL" tab to see all dates
        try:
            all_tab = page.locator("button:has-text('ALL')").first
            if all_tab.is_visible(timeout=3000):
                all_tab.click()
                page.wait_for_timeout(2000)
        except Exception:
            pass  # Continue with current view

        # Get all text content
        body_text = page.inner_text("body")

        # Parse the text to find date headers and showtimes
        # Date format: "SAT, JAN 31, 2026" or "MON, FEB 2, 2026"
        # Time format: "9:45 PM" or "6:00 PM"

        current_date = None
        lines = body_text.split('\n')

        for line in lines:
            line = line.strip()

            # Check for date header pattern: "DAY, MON DD, YYYY"
            date_match = re.match(
                r'(?:MON|TUE|WED|THU|FRI|SAT|SUN),?\s+([A-Z]{3})\s+(\d{1,2}),?\s+(\d{4})',
                line,
                re.IGNORECASE
            )
            if date_match:
                month_str, day, year = date_match.groups()
                current_date = parse_date(f"{month_str} {day}, {year}")
                continue

            # Check for time pattern at start of line
            if current_date:
                time_match = re.match(r'^(\d{1,2}:\d{2}\s*(?:AM|PM))', line, re.IGNORECASE)
                if time_match:
                    parsed_time = parse_time(time_match.group(1))
                    if parsed_time:
                        showtime = {"date": current_date, "time": parsed_time}
                        if showtime not in showtimes:
                            showtimes.append(showtime)

        # If no showtimes found with ALL view, try TODAY/TOMORROW tabs
        if not showtimes:
            from datetime import timedelta
            today = datetime.now().date()

            for tab_name, offset in [("TODAY", 0), ("TOMORROW", 1)]:
                try:
                    tab = page.locator(f"button:has-text('{tab_name}')").first
                    if tab.is_visible(timeout=2000):
                        tab.click()
                        page.wait_for_timeout(1500)

                        target_date = (today + timedelta(days=offset)).strftime("%Y-%m-%d")

                        # Find showtime buttons
                        buttons = page.query_selector_all("button")
                        for btn in buttons:
                            try:
                                text = btn.inner_text().strip()
                                time_match = re.match(r'^(\d{1,2}:\d{2}\s*(?:AM|PM))', text, re.IGNORECASE)
                                if time_match:
                                    parsed_time = parse_time(time_match.group(1))
                                    if parsed_time:
                                        showtime = {"date": target_date, "time": parsed_time}
                                        if showtime not in showtimes:
                                            showtimes.append(showtime)
                            except Exception:
                                continue
                except Exception:
                    continue

    except Exception as e:
        logger.error(f"Error extracting showtimes: {e}")

    return showtimes


def extract_movie_metadata(page: Page) -> dict:
    """Extract movie metadata from detail page.

    Returns {title, description, duration, rating, image_url}.
    """
    metadata = {
        "title": None,
        "description": None,
        "duration": None,
        "rating": None,
        "image_url": None,
    }

    try:
        body_text = page.inner_text("body")

        # Extract title from h1 or page title
        try:
            h1 = page.query_selector("h1")
            if h1:
                metadata["title"] = h1.inner_text().strip()
        except Exception:
            pass

        # Extract duration (e.g., "1 hr 57 min" or "1 hour 57 minutes")
        duration_match = re.search(
            r'(\d+)\s*(?:hr|hour)s?\s*(\d+)?\s*(?:min|minute)?',
            body_text,
            re.IGNORECASE
        )
        if duration_match:
            hours = int(duration_match.group(1))
            minutes = int(duration_match.group(2)) if duration_match.group(2) else 0
            metadata["duration"] = hours * 60 + minutes

        # Extract rating
        rating_match = re.search(r'\b(G|PG|PG-13|R|NC-17|NR|Not Rated)\b', body_text)
        if rating_match:
            metadata["rating"] = rating_match.group(1)

        # Extract image
        try:
            img = page.query_selector('img[src*="poster"], img[src*="movie"], img[alt*="poster"]')
            if img:
                metadata["image_url"] = img.get_attribute("src")
        except Exception:
            pass

        # Try meta og:image
        if not metadata["image_url"]:
            try:
                og_image = page.query_selector('meta[property="og:image"]')
                if og_image:
                    metadata["image_url"] = og_image.get_attribute("content")
            except Exception:
                pass

    except Exception as e:
        logger.debug(f"Error extracting metadata: {e}")

    return metadata


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Plaza Theatre showtimes from all sections."""
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

            # Fetch Letterboxd RSS for enrichment
            letterboxd_movies = get_letterboxd_movies()
            logger.info(f"Fetched {len(letterboxd_movies)} movies from Letterboxd RSS")

            # Collect all movie URLs from all sections
            all_movie_urls = []
            seen_urls = set()

            for section_url in SECTION_URLS:
                logger.info(f"Scanning section: {section_url}")
                try:
                    page.goto(section_url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Click Plaza Theatre tab if on now-showing page
                    if "now-showing" in section_url:
                        try:
                            plaza_tab = page.locator("text=Plaza Theatre Atlanta").first
                            if plaza_tab.is_visible(timeout=2000):
                                plaza_tab.click()
                                page.wait_for_timeout(1500)
                        except Exception:
                            pass

                    movies = collect_movie_urls(page)
                    for movie in movies:
                        if movie["url"] not in seen_urls:
                            seen_urls.add(movie["url"])
                            all_movie_urls.append(movie)

                    logger.info(f"  Found {len(movies)} movie links")

                except Exception as e:
                    logger.error(f"Error scanning {section_url}: {e}")
                    continue

            logger.info(f"Total unique movies to process: {len(all_movie_urls)}")

            # Process each movie's detail page
            for movie_info in all_movie_urls:
                movie_url = movie_info["url"]
                logger.info(f"Processing: {movie_info['title'][:50]}...")

                try:
                    page.goto(movie_url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(2000)

                    # Extract metadata
                    metadata = extract_movie_metadata(page)
                    movie_title = metadata.get("title") or movie_info["title"]

                    # Clean up title
                    # Remove newlines and extra whitespace
                    movie_title = " ".join(movie_title.split())
                    # Remove format indicators
                    movie_title = re.sub(r'\s*\((?:4K|2K|35mm|70mm)\)\s*$', '', movie_title, flags=re.IGNORECASE)
                    # Remove rating suffixes
                    movie_title = re.sub(r'\s*(?:Not Rated|Rated\s*[RPGNC](?:-\d+)?)\s*$', '', movie_title, flags=re.IGNORECASE)
                    # Remove venue name suffix
                    movie_title = re.sub(r'\s*-?\s*Plaza Theatre(?:\s+Atlanta)?\s*$', '', movie_title, flags=re.IGNORECASE)
                    # Remove leading dash
                    movie_title = re.sub(r'^-\s*', '', movie_title)
                    movie_title = movie_title.strip()

                    if not movie_title or len(movie_title) < 2:
                        logger.debug(f"  Skipping - no valid title")
                        continue

                    # Extract showtimes
                    showtimes = extract_showtimes_from_detail(page)
                    logger.info(f"  Found {len(showtimes)} showtimes for '{movie_title}'")

                    if not showtimes:
                        continue

                    # Get enrichment from Letterboxd
                    enrichment = enrich_movie_data(movie_title, letterboxd_movies) or {}

                    # Build tags
                    tags = ["film", "cinema", "independent", "plaza-theatre"]
                    if enrichment.get("special_event"):
                        tags.append(enrichment["special_event"])

                    # Check for special event markers in title
                    if "35mm" in movie_info.get("title", "").lower() or "35mm" in movie_url.lower():
                        if "35mm" not in tags:
                            tags.append("35mm")
                    if "trivia" in movie_info.get("title", "").lower():
                        if "trivia" not in tags:
                            tags.append("trivia")

                    # Get best image
                    image_url = enrichment.get("image_url") or metadata.get("image_url")

                    # Create events for each showtime
                    for showtime in showtimes:
                        start_date = showtime["date"]
                        start_time = showtime["time"]

                        total_found += 1
                        content_hash = generate_content_hash(
                            movie_title, "Plaza Theatre", f"{start_date}|{start_time}"
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            total_updated += 1
                        else:
                            # Build description
                            description_parts = []
                            if metadata.get("duration"):
                                hours = metadata["duration"] // 60
                                mins = metadata["duration"] % 60
                                description_parts.append(f"{hours}h {mins}m")
                            if metadata.get("rating"):
                                description_parts.append(f"Rated {metadata['rating']}")
                            description = " • ".join(description_parts) if description_parts else None

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": movie_title,
                                "description": description,
                                "start_date": start_date,
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
                                "source_url": movie_url,
                                "ticket_url": enrichment.get("ticket_url"),
                                "image_url": image_url,
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
                            if enrichment.get("tmdb_id"):
                                series_hint["tmdb_id"] = enrichment["tmdb_id"]

                            try:
                                insert_event(event_record, series_hint=series_hint)
                                total_new += 1
                                logger.info(f"  Added: {start_date} at {start_time}")
                            except Exception as e:
                                logger.error(f"  Failed to insert: {e}")

                except Exception as e:
                    logger.error(f"Error processing {movie_url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Plaza Theatre crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Plaza Theatre: {e}")
        raise

    return total_found, total_new, total_updated
