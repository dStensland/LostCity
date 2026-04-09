"""
Crawler for Tara Theatre Atlanta (taraatlanta.com).
Classic Atlanta cinema showing independent and art house films.
"""

from __future__ import annotations

import json
import re
import logging
import time
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright, Page

from db import (
    get_or_create_place,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    build_screening_bundle_from_event_rows,
    entries_to_event_like_rows,
)

logger = logging.getLogger(__name__)
SHOWTIME_LINE_RE = re.compile(r"^\d{1,2}:\d{2}\s*(AM|PM)$", re.IGNORECASE)
ATLANTA_TZ = ZoneInfo("America/New_York")


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


def _build_movie_detail_url(movie: dict) -> Optional[str]:
    """Return Tara's canonical per-movie page when GraphQL exposes a slug."""
    slug = str((movie or {}).get("urlSlug") or "").strip().strip("/")
    if not slug:
        return None
    return f"{BASE_URL}/movie/{slug}/"

BASE_URL = "https://www.taraatlanta.com"
HOME_URL = f"{BASE_URL}/home"
COMING_SOON_URL = f"{BASE_URL}/coming-soon"

PLACE_DATA = {
    "name": "Tara Theatre",
    "slug": "tara-theatre",
    "address": "2345 Cheshire Bridge Rd NE",
    "neighborhood": "Cheshire Bridge",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.7545,
    "lng": -84.3898,
    "place_type": "cinema",
    "website": BASE_URL,
    "_destination_details": {
        "commitment_tier": "hour",
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "family_suitability": "caution",
        "practical_notes": "Free surface lot behind the theater. One of Atlanta's last surviving neighborhood cinemas — opened in 1968. Programming focuses on independent and specialty releases; check individual film ratings before bringing children.",
    },
    "_venue_features": [
        {
            "slug": "historic-single-screen",
            "title": "Historic Single-Screen Theater (Est. 1968)",
            "feature_type": "experience",
            "description": "One of Atlanta's last original neighborhood movie palaces, operating continuously since 1968. Classic single-auditorium format with a genuine movie-house atmosphere.",
            "is_free": False,
            "sort_order": 1,
        },
        {
            "slug": "independent-specialty-programming",
            "title": "Independent & Specialty Film Programming",
            "feature_type": "experience",
            "description": "Curated mix of independent releases, foreign films, cult classics, and specialty screenings not available at mainstream chains.",
            "is_free": False,
            "sort_order": 2,
        },
    ],
    "_venue_specials": [
        {
            "title": "Regal Crown Club Rewards",
            "type": "recurring_deal",
            "description": "Earn points on every ticket and concession purchase through the Regal Crown Club loyalty program. Points redeem for free tickets and concessions.",
            "days_of_week": [1, 2, 3, 4, 5, 6, 7],
            "price_note": "Free loyalty program — sign up at regal.com",
        },
        {
            "title": "Tuesday Discount",
            "type": "recurring_deal",
            "description": "Reduced admission on all Tuesday screenings.",
            "days_of_week": [2],
            "price_note": "Discounted Tuesday rate — check box office for current pricing",
        },
    ],
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
) -> list[dict]:
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

    Returns a list of screening entry dicts for later bulk persistence.
    """
    entries: list[dict] = []
    image_map = image_map or {}
    if seen_hashes is None:
        seen_hashes = set()

    date_str = target_date.strftime("%Y-%m-%d")

    # Primary path: DOM card extraction (more reliable than body-text parsing).
    containers = page.query_selector_all(".movie-container")
    if containers:
        for container in containers:
            try:
                title_el = container.query_selector(".text-h5") or container.query_selector("h5")
                if not title_el:
                    continue
                raw_title = (title_el.inner_text() or "").strip()
                if not raw_title:
                    continue

                # Some cards include rating on a second line (e.g. "Dreams (2026)\\nNR")
                title_part = raw_title.split("\n")[0].strip()
                title_part = re.sub(
                    r"\s*(NR|Not Rated|G|PG|PG-13|R|NC-17)$",
                    "",
                    title_part,
                    flags=re.IGNORECASE,
                ).strip()
                if len(title_part) < 3:
                    continue

                times_list: list[str] = []
                for btn in container.query_selector_all("button"):
                    btn_text = (btn.inner_text() or "").strip()
                    if not btn_text:
                        continue
                    first_line = btn_text.split("\n")[0].strip()
                    parsed = parse_time(first_line)
                    if parsed and parsed not in times_list:
                        times_list.append(parsed)
                if not times_list:
                    continue

                # Best-effort description from card body text.
                movie_desc = None
                try:
                    card_lines = [line.strip() for line in (container.inner_text() or "").split("\n") if line.strip()]
                    for line in card_lines:
                        if line == raw_title or line == title_part:
                            continue
                        if SHOWTIME_LINE_RE.match(line):
                            continue
                        if "THEATRE" in line.upper():
                            continue
                        if re.match(r'^\d+\s*hr(?:\s*\d+\s*min)?', line, re.IGNORECASE):
                            continue
                        if len(line) > 40:
                            movie_desc = line
                            break
                except Exception:
                    pass

                container_image = None
                try:
                    img_el = container.query_selector("img.q-img__image") or container.query_selector("img")
                    if img_el:
                        container_image = img_el.get_attribute("src")
                except Exception:
                    pass

                for showtime in times_list:
                    # In-process dedup guard
                    showtime_key = (title_part, date_str, showtime)
                    if showtime_key in seen_hashes:
                        continue
                    seen_hashes.add(showtime_key)

                    clean_title = re.sub(r'\s*\(\d{4}\)\s*$', '', title_part)
                    movie_image = (
                        container_image
                        or find_image_for_movie(title_part, image_map)
                        or find_image_for_movie(clean_title, image_map)
                    )

                    entries.append({
                        "title": title_part,
                        "start_date": date_str,
                        "start_time": showtime,
                        "image_url": movie_image,
                        "source_url": HOME_URL,
                        "ticket_url": None,
                        "description": movie_desc,
                        "tags": ["film", "cinema", "arthouse", "showtime", "tara-theatre"],
                        "source_id": source_id,
                        "place_id": venue_id,
                    })
                    logger.info(f"Queued: {title_part} on {date_str} at {showtime}")
            except Exception as e:
                logger.debug(f"Skipping invalid movie card: {e}")
                continue

        if entries:
            logger.info(f"Found {len(containers)} movies with showtimes for {date_str}")
            return entries

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    seen_movies: set[str] = set()
    matches = []  # List of (title, [times], description)

    # Find movie titles by looking for duration pattern on next line
    # Title patterns: "Movie Name (2026)" or "Movie Name"
    # Duration pattern: "X hr Y min" or "X hr" followed by genre
    duration_pattern = re.compile(r'^(\d+)\s*hr(?:\s*(\d+)\s*min)?', re.IGNORECASE)
    time_pattern = re.compile(r'^(\d{1,2}:\d{2})\s*(AM|PM)$', re.IGNORECASE)

    current_movie = None
    current_times: list[str] = []
    current_desc_lines: list[str] = []
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

        # Create entries for each valid showtime
        for showtime in times_list:
            movie_key = f"{title_part}|{date_str}|{showtime}"
            if movie_key in seen_movies:
                continue
            seen_movies.add(movie_key)

            # In-process dedup guard
            showtime_key = (title_part, date_str, showtime)
            if showtime_key in seen_hashes:
                continue
            seen_hashes.add(showtime_key)

            # Try to find image with title normalization
            clean_title = re.sub(r'\s*\(\d{4}\)\s*$', '', title_part)  # Remove year
            clean_title = re.sub(r'\s*\(Digital\)\s*$', '', clean_title, flags=re.IGNORECASE)
            movie_image = find_image_for_movie(title_part, image_map)
            if not movie_image:
                movie_image = find_image_for_movie(clean_title, image_map)

            entries.append({
                "title": title_part,
                "start_date": date_str,
                "start_time": showtime,
                "image_url": movie_image,
                "source_url": HOME_URL,
                "ticket_url": None,
                "description": movie_desc,
                "tags": ["film", "cinema", "arthouse", "showtime", "tara-theatre"],
                "source_id": source_id,
                "place_id": venue_id,
            })
            logger.info(f"Queued: {title_part} on {date_str} at {showtime}")

    return entries


def extract_upcoming_movies(
    page: Page,
    source_id: int,
    venue_id: int,
    source_url: str,
    image_map: Optional[dict[str, str]] = None,
) -> list[dict]:
    """Extract movies from Coming Soon page.

    Returns a list of screening entry dicts for later bulk persistence.
    """
    entries: list[dict] = []

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

        # Use date 30 days from now as placeholder
        placeholder_date = (datetime.now() + timedelta(days=30)).strftime(
            "%Y-%m-%d"
        )

        movie_image = find_image_for_movie(movie_title, image_map or {})

        entries.append({
            "title": movie_title,
            "start_date": placeholder_date,
            "start_time": None,
            "image_url": movie_image,
            "source_url": source_url,
            "ticket_url": None,
            "description": "Coming Soon",
            "tags": ["film", "cinema", "arthouse", "tara-theatre", "coming-soon"],
            "source_id": source_id,
            "place_id": venue_id,
        })
        logger.info(f"Queued coming soon: {movie_title}")

    return entries


def _click_tara_tab(page: Page) -> None:
    """Click the 'THE TARA' tab if visible (site shows both Tara and Plaza)."""
    try:
        tara_tab = page.locator("text=THE TARA").first
        if tara_tab.is_visible(timeout=2000):
            tara_tab.click()
            page.wait_for_timeout(1500)
    except Exception:
        pass


def _dismiss_cookie_banner(page: Page) -> None:
    """Dismiss cookie/accessibility notification overlays when present."""
    for selector in (
        "text=ACCEPT & DISMISS",
        "button:has-text('ACCEPT & DISMISS')",
        ".q-notification button:has-text('ACCEPT & DISMISS')",
    ):
        try:
            btn = page.locator(selector).first
            if btn.is_visible(timeout=800):
                btn.click(timeout=2000)
                page.wait_for_timeout(500)
                return
        except Exception:
            continue


def _open_calendar_picker(page: Page) -> bool:
    """
    Open Tara's Q-Date calendar picker reliably.

    On some renders, the date controls are hidden behind an intermediate
    "VIEW NEXT SHOWINGS" action or blocked by cookie overlays.
    """
    _dismiss_cookie_banner(page)
    _click_tara_tab(page)

    # If the picker is already open, we're done.
    try:
        picker = page.locator(".q-date").first
        if picker.is_visible(timeout=500):
            return True
    except Exception:
        pass

    for attempt in range(2):
        for selector in (
            "button:has-text('Other')",
            "li:has-text('Other')",
            "text=Other",
        ):
            try:
                control = page.locator(selector).first
                if not control.is_visible(timeout=800):
                    continue
                control.click(timeout=2000)
                page.wait_for_timeout(900)
                picker = page.locator(".q-date").first
                if picker.is_visible(timeout=1200):
                    return True
            except Exception:
                continue

        # Some sessions require expanding from a collapsed showtimes state.
        try:
            next_showings = page.locator("text=VIEW NEXT SHOWINGS").first
            if next_showings.is_visible(timeout=1000):
                next_showings.click(timeout=2000)
                page.wait_for_timeout(1200)
        except Exception:
            pass

        _dismiss_cookie_banner(page)
        _click_tara_tab(page)

    return False


def _count_showtime_lines(page: Page) -> int:
    """
    Count detectable showtime signals on the page.

    We keep the legacy text-line signal, but also count showtime buttons within
    `.movie-container` cards because the current Tara UI often renders times in
    buttons without exposing clean standalone body text lines.
    """
    signals = 0

    try:
        body_text = page.inner_text("body")
        signals += sum(
            1 for line in body_text.split("\n") if SHOWTIME_LINE_RE.match(line.strip())
        )
    except Exception:
        pass

    try:
        for container in page.query_selector_all(".movie-container"):
            for btn in container.query_selector_all("button"):
                btn_text = (btn.inner_text() or "").strip()
                if not btn_text:
                    continue
                first_line = btn_text.split("\n")[0].strip()
                if parse_time(first_line):
                    signals += 1
    except Exception:
        pass

    return signals


def _ensure_showtime_ready(
    page: Page,
    label: str,
    *,
    max_attempts: int = 3,
    allow_reload: bool = True,
    showings_cache: Optional[dict[str, list[dict]]] = None,
    cache_date: Optional[str] = None,
) -> bool:
    """
    Ensure the page has showtime text before parsing.

    Tara occasionally renders a partial page snapshot with no showtimes yet.
    This helper adds a bounded wait/retry so we don't record false zero-result
    "success" runs from transient render timing.
    """
    for attempt in range(1, max_attempts + 1):
        _click_tara_tab(page)

        # Prefer authoritative GraphQL readiness when available for this date.
        if showings_cache is not None and cache_date:
            if cache_date in showings_cache:
                cached = showings_cache.get(cache_date) or []
                logger.info(
                    "GraphQL readiness signal for %s on attempt %s (%s rows)",
                    label,
                    attempt,
                    len(cached),
                )
                return True

        line_count = _count_showtime_lines(page)
        if line_count > 0:
            if attempt > 1:
                logger.info(
                    "Showtime signal recovered for %s on attempt %s (%s lines)",
                    label,
                    attempt,
                    line_count,
                )
            return True

        if attempt == max_attempts:
            break

        wait_ms = 1200 * attempt
        logger.warning(
            "No showtime signals detected for %s (attempt %s/%s); waiting %sms",
            label,
            attempt,
            max_attempts,
            wait_ms,
        )
        page.wait_for_timeout(wait_ms)

        # Re-check after a wait before doing an expensive reload.
        if showings_cache is not None and cache_date and cache_date in showings_cache:
            cached = showings_cache.get(cache_date) or []
            logger.info(
                "GraphQL signal appeared for %s after wait (%s rows)",
                label,
                len(cached),
            )
            return True

        line_count = _count_showtime_lines(page)
        if line_count > 0:
            logger.info("Showtime signal appeared for %s after wait (%s lines)", label, line_count)
            return True

        if allow_reload:
            logger.info("Reloading Tara page to recover partial render (%s)", label)
            page.reload(wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

    logger.warning("Proceeding without showtime readiness signal for %s", label)
    return False


def _capture_showings_graphql_response(response, showings_cache: dict[str, list[dict]]) -> None:
    """Capture Tara GraphQL showingsForDate responses keyed by requested date."""
    try:
        if "/graphql" not in response.url:
            return
        request = response.request
        if request.method != "POST":
            return
        payload_raw = request.post_data or ""
        if "showingsForDate" not in payload_raw:
            return
        payload = json.loads(payload_raw)
        date_str = ((payload.get("variables") or {}).get("date") or "").strip()
        if not date_str:
            return
        body = response.json()
        showings = (((body.get("data") or {}).get("showingsForDate") or {}).get("data") or [])
        if isinstance(showings, list):
            showings_cache[date_str] = showings
    except Exception:
        # Non-fatal: we still have text parsing fallback.
        return


def _wait_for_showings_cache(
    showings_cache: dict[str, list[dict]], date_str: str, timeout_seconds: float = 6.0
) -> list[dict] | None:
    """Wait briefly for a showingsForDate GraphQL response to land in cache."""
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        showings = showings_cache.get(date_str)
        if showings is not None:
            return showings
        time.sleep(0.2)
    return showings_cache.get(date_str)


def _extract_movies_from_graphql_showings(
    showings: list[dict],
    source_id: int,
    venue_id: int,
    image_map: dict[str, str],
    seen_hashes: set | None = None,
) -> list[dict]:
    """
    Extract entries from Tara's authoritative showingsForDate GraphQL payload.

    This captures all per-day showtimes, including cases where body-text parsing
    misses movies/times due partial or collapsed UI render states.

    Returns a list of screening entry dicts for later bulk persistence.
    """
    entries: list[dict] = []
    seen_slots: set[tuple[str, str, str]] = set()

    for showing in showings:
        movie = showing.get("movie") or {}
        title = str(movie.get("name") or "").strip()
        if not title or len(title) < 3:
            continue
        if not showing.get("published", True):
            continue
        if showing.get("private"):
            continue

        time_raw = str(showing.get("time") or "").strip()
        if not time_raw:
            continue
        try:
            start_dt = datetime.fromisoformat(time_raw.replace("Z", "+00:00")).astimezone(ATLANTA_TZ)
        except Exception:
            continue

        start_date = start_dt.strftime("%Y-%m-%d")
        start_time = start_dt.strftime("%H:%M")
        slot_key = (title, start_date, start_time)
        if slot_key in seen_slots:
            continue
        seen_slots.add(slot_key)

        # In-process dedup guard
        showtime_key = (title, start_date, start_time)
        if seen_hashes is not None:
            if showtime_key in seen_hashes:
                continue
            seen_hashes.add(showtime_key)

        synopsis = str(movie.get("synopsis") or "").strip() or None
        movie_image = find_image_for_movie(title, image_map)
        movie_detail_url = _build_movie_detail_url(movie)

        entries.append({
            "title": title,
            "start_date": start_date,
            "start_time": start_time,
            "image_url": movie_image,
            "source_url": movie_detail_url or HOME_URL,
            "ticket_url": movie_detail_url,
            "description": synopsis,
            "tags": ["film", "cinema", "arthouse", "showtime", "tara-theatre"],
            "source_id": source_id,
            "place_id": venue_id,
        })
        logger.info(f"Queued: {title} on {start_date} at {start_time}")

    return entries


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Tara Theatre showtimes for today and upcoming days."""
    source_id = source["id"]
    total_new = 0
    total_updated = 0
    all_entries: list[dict] = []
    seen_hashes: set = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()
            showings_cache: dict[str, list[dict]] = {}
            page.on("response", lambda response: _capture_showings_graphql_response(response, showings_cache))

            venue_id = get_or_create_place(PLACE_DATA)
            today = datetime.now().date()

            # Load the now-showing page
            logger.info(f"Fetching Tara Theatre: {HOME_URL}")
            page.goto(HOME_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)  # Wait for JS to load

            # Click "THE TARA" tab (site shows both Tara and Plaza)
            _click_tara_tab(page)
            _dismiss_cookie_banner(page)
            _ensure_showtime_ready(
                page,
                today.strftime("%Y-%m-%d"),
                max_attempts=3,
                allow_reload=True,
                showings_cache=showings_cache,
                cache_date=today.strftime("%Y-%m-%d"),
            )

            # Extract movie images from the page
            image_map = extract_movie_images(page)

            # First, get today's showtimes (default view)
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            today_date_str = today.strftime("%Y-%m-%d")
            today_showings = _wait_for_showings_cache(showings_cache, today_date_str, timeout_seconds=4.0)
            if today_showings:
                day_entries = _extract_movies_from_graphql_showings(
                    today_showings, source_id, venue_id, image_map, seen_hashes
                )
                logger.info(
                    "Using GraphQL showings for %s (%s rows)",
                    today_date_str,
                    len(today_showings),
                )
            else:
                day_entries = extract_movies_for_date(
                    page, datetime.combine(today, datetime.min.time()), source_id, venue_id, image_map, seen_hashes
                )
            if not day_entries:
                logger.warning(
                    "No showtimes parsed for today on first pass; retrying once with readiness wait"
                )
                _ensure_showtime_ready(
                    page,
                    today.strftime("%Y-%m-%d"),
                    max_attempts=2,
                    allow_reload=True,
                    showings_cache=showings_cache,
                    cache_date=today.strftime("%Y-%m-%d"),
                )
                day_entries = extract_movies_for_date(
                    page,
                    datetime.combine(today, datetime.min.time()),
                    source_id,
                    venue_id,
                    image_map,
                    seen_hashes,
                )
            all_entries.extend(day_entries)
            if day_entries:
                logger.info(
                    f"  {today.strftime('%Y-%m-%d')}: {len(day_entries)} movies found"
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
                if not _open_calendar_picker(page):
                    logger.warning(f"Could not open calendar picker for {date_str}; stopping date crawl")
                    break

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
                showings = _wait_for_showings_cache(showings_cache, date_str, timeout_seconds=4.0)
                if showings:
                    day_entries = _extract_movies_from_graphql_showings(
                        showings, source_id, venue_id, image_map, seen_hashes
                    )
                    logger.info("  %s: Using GraphQL showings (%s rows)", date_str, len(showings))
                else:
                    day_entries = extract_movies_for_date(
                        page,
                        datetime.combine(target_date, datetime.min.time()),
                        source_id,
                        venue_id,
                        image_map,
                        seen_hashes,
                    )
                if not day_entries:
                    logger.info(f"  {date_str}: No showtimes found on first pass; retrying once")
                    _ensure_showtime_ready(
                        page,
                        date_str,
                        max_attempts=2,
                        allow_reload=False,
                        showings_cache=showings_cache,
                        cache_date=date_str,
                    )
                    retry_entries = extract_movies_for_date(
                        page,
                        datetime.combine(target_date, datetime.min.time()),
                        source_id,
                        venue_id,
                        image_map,
                        seen_hashes,
                    )
                    day_entries = retry_entries
                    if retry_entries:
                        logger.info(f"  {date_str}: Recovered {len(retry_entries)} movies on retry")

                all_entries.extend(day_entries)

                if not day_entries:
                    logger.info(f"  {date_str}: No showtimes found")
                    break

            # Skip Coming Soon page - these movies don't have real dates/times
            # and show up as TBA which isn't useful for users
            # The movies will be picked up when they get actual showtimes
            logger.info("Skipping Coming Soon page (no actual showtimes)")

            browser.close()

        # --- Screening-primary persistence ---
        total_found = len(all_entries)
        source_slug = source.get("slug", "tara-theatre")

        event_like_rows = entries_to_event_like_rows(all_entries)

        bundle = build_screening_bundle_from_event_rows(
            source_id=source_id, source_slug=source_slug, events=event_like_rows,
        )
        screening_summary = persist_screening_bundle(bundle)
        logger.info(
            "Tara screening sync: %s titles, %s runs, %s times",
            screening_summary.get("titles", 0),
            screening_summary.get("runs", 0),
            screening_summary.get("times", 0),
        )

        run_summary = sync_run_events_from_screenings(source_id=source_id, source_slug=source_slug)
        total_new = run_summary.get("events_created", 0)
        total_updated = run_summary.get("events_updated", 0)

        run_event_hashes = run_summary.get("run_event_hashes", set())
        if run_event_hashes:
            remove_stale_showtime_events(source_id=source_id, run_event_hashes=run_event_hashes)

        logger.info(
            f"Tara Theatre crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Tara Theatre: {e}")
        raise

    return total_found, total_new, total_updated
