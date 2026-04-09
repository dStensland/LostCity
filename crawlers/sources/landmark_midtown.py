"""
Crawler for Landmark Midtown Art Cinema (landmarktheatres.com).
Art house cinema chain location in Atlanta.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright, Page
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    build_screening_bundle_from_event_rows,
    entries_to_event_like_rows,
)
from utils import extract_image_url, extract_images_from_page, fetch_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.landmarktheatres.com"
# The main showtimes page - location is selected via dropdown
SHOWTIMES_URL = f"{BASE_URL}/showtimes/"
# Venue-specific page (redirects to /our-locations/...)
VENUE_PAGE_URL = f"{BASE_URL}/our-locations/x00qm-landmark-midtown-art-cinema-atlanta/"

PLACE_DATA = {
    "name": "Landmark Midtown Art Cinema",
    "slug": "landmark-midtown-art-cinema",
    "address": "931 Monroe Drive NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7803,
    "lng": -84.3688,
    "place_type": "cinema",
    "website": VENUE_PAGE_URL,
    "_destination_details": {
        "commitment_tier": "hour",
        "parking_type": "garage",
        "best_time_of_day": "evening",
        "family_suitability": "caution",
        "practical_notes": "Colony Square garage is directly adjacent. Walkable from Piedmont Park and multiple Midtown restaurants — easy to pair with dinner. Programming skews adult; check individual film ratings.",
    },
    "_venue_features": [
        {
            "slug": "indie-arthouse-programming",
            "title": "Indie & Art-House Film Programming",
            "feature_type": "experience",
            "description": "Curated selection of independent, foreign-language, and limited-release films not showing at mainstream multiplexes.",
            "is_free": False,
            "sort_order": 1,
        },
        {
            "slug": "bar-concessions",
            "title": "Bar & Concessions with Beer and Wine",
            "feature_type": "amenity",
            "description": "Full concession stand offering beer, wine, and cocktails alongside the usual popcorn and snacks — drinks allowed in the screening rooms.",
            "is_free": False,
            "sort_order": 2,
        },
        {
            "slug": "intimate-screening-rooms",
            "title": "Intimate Screening Rooms",
            "feature_type": "experience",
            "description": "Smaller, boutique-scale auditoriums designed for a close, immersive viewing experience rather than stadium-scale crowds.",
            "is_free": False,
            "sort_order": 3,
        },
    ],
    "_venue_specials": [
        {
            "title": "Matinee Pricing",
            "type": "admission",
            "description": "Discounted ticket prices for all screenings that begin before 5:00 PM.",
            "days_of_week": [1, 2, 3, 4, 5, 6, 7],
            "time_end": "17:00",
            "price_note": "Reduced matinee rate — check box office for current pricing",
        },
        {
            "title": "$5 Tuesday",
            "type": "recurring_deal",
            "description": "All tickets discounted to $5 every Tuesday.",
            "days_of_week": [2],
            "price_note": "$5 all day Tuesday",
        },
    ],
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


def _build_showtime_description(title: str, rating_duration: str, director: str) -> str:
    parts = [
        f"Film screening of {title} at Landmark Midtown Art Cinema in Midtown Atlanta."
    ]
    if rating_duration:
        parts.append(f"Rating and runtime: {rating_duration}.")
    if director:
        parts.append(f"Directed by {director}.")
    parts.append("Showtimes are scheduled through Landmark's current cinema listings.")
    return " ".join(part for part in parts if part)


def _normalize_movie_title_key(title: str) -> str:
    return re.sub(r"\s+", " ", (title or "").strip().lower())


def extract_movie_detail_links(page: Page) -> dict[str, str]:
    """Read movie detail links from the Landmark Midtown theatre page."""
    movie_links: dict[str, str] = {}
    for anchor in page.query_selector_all("a[href*='/movies/']"):
        try:
            href = (anchor.get_attribute("href") or "").strip()
            if not href:
                continue
            text = (anchor.inner_text() or "").strip()
            if not text:
                continue
            title = next(
                (line.strip() for line in text.splitlines() if line.strip()),
                "",
            )
            if not title:
                continue
            movie_links[_normalize_movie_title_key(title)] = urljoin(BASE_URL, href)
        except Exception:
            continue
    return movie_links


def extract_movie_detail_images(movie_url_map: dict[str, str]) -> dict[str, str]:
    """Fetch poster images from Landmark movie detail pages."""
    detail_images: dict[str, str] = {}
    for title_key, detail_url in movie_url_map.items():
        try:
            html = fetch_page(detail_url)
            soup = BeautifulSoup(html, "html.parser")
            image_url = extract_image_url(soup, base_url=detail_url)
            if image_url:
                detail_images[title_key] = image_url
        except Exception as exc:
            logger.warning(
                "Could not fetch Landmark poster image for %s: %s",
                detail_url,
                exc,
            )
    return detail_images


def _merge_movie_maps(
    *,
    image_map: dict[str, str],
    movie_url_map: dict[str, str],
    detail_image_map: dict[str, str],
    page: Page,
) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Refresh poster and detail-link maps from the currently visible date page."""
    page_image_map = extract_images_from_page(page)
    if page_image_map:
        image_map.update(page_image_map)

    page_movie_links = extract_movie_detail_links(page)
    new_movie_links = {
        title_key: detail_url
        for title_key, detail_url in page_movie_links.items()
        if title_key not in movie_url_map
    }
    if page_movie_links:
        movie_url_map.update(page_movie_links)
    if new_movie_links:
        detail_image_map.update(extract_movie_detail_images(new_movie_links))

    return image_map, movie_url_map, detail_image_map


def extract_movies_for_date(
    page: Page,
    target_date: datetime,
    source_id: int,
    venue_id: int,
    image_map: dict = None,
    movie_url_map: dict[str, str] | None = None,
    detail_image_map: dict[str, str] | None = None,
    seen_showtimes: set = None,
) -> list[dict]:
    """Extract movies and showtimes for a specific date.

    Returns a list of screening entry dicts (title, date, time, image, etc.)
    for later bulk persistence via screening tables.

    Landmark page structure (text is concatenated without newlines):
    - "Trailer" marker (optional)
    - Rating + Duration: "PG-13 • 2 hr, 10 min" or "R • 1 hr, 50 min"
    - Title immediately follows (e.g., "H Is For Hawk")
    - "Directed by {DIRECTOR}"
    - Content advisory, Genre, Cast info
    - "Today, January 23" date marker
    - Showtimes concatenated: "1:10PM4:00PM7:00PM10:00PM"
    """
    entries: list[dict] = []

    if seen_showtimes is None:
        seen_showtimes = set()

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
            r"(?:Trailer\s*)?"  # Optional Trailer marker
            r"((?:G|PG|PG-13|R|NC-17|NR|Not Rated)\s*•\s*"  # Rating
            r"\d+\s*hr,?\s*\d*\s*min)"  # Duration
            r"\s*"
            r"([A-Z][A-Za-z0-9\s\'\"\-\:\,\.\!\?\&\(\)]+?)"  # Title (starts with capital)
            r"Directed by\s+([A-Za-z\s\-\.]+)",  # Director (confirms this is a movie)
            re.IGNORECASE,
        )

        # Normalize text - add space after date numbers to prevent "January 261:10PM"
        # Pattern matches: "January 26" or "Today, January 26" followed directly by time
        text = re.sub(
            r"(\w+,?\s+\w+\s+\d{1,2})(\d{1,2}:\d{2}(?:AM|PM))",
            r"\1 \2",
            text,
            flags=re.IGNORECASE,
        )

        # Showtime pattern: times like "4:00PM", "3:10PM" (no space before AM/PM)
        # Can be concatenated: "1:10PM4:00PM7:00PM"
        # Updated to avoid matching date numbers like "261:10PM" from "January 261:10PM"
        showtime_pattern = re.compile(r"(?<!\d)(\d{1,2}:\d{2}(?:AM|PM))", re.IGNORECASE)

        # Find all movies
        movies = []
        for match in movie_pattern.finditer(text):
            rating_duration = match.group(1).strip()
            title = match.group(2).strip()
            director = match.group(3).strip()

            # Clean up title - remove trailing whitespace and any leftover metadata
            title = re.sub(r"\s+$", "", title).strip()

            # Skip if title looks like UI text or crawler artifacts
            skip_titles = [
                "Showtimes",
                "Now Playing",
                "Coming Soon",
                "Landmark",
                "Another Date",
                "See Details",
                "Film Series",
                "Special",
                "At:",
                "Fri",
                "Sat",
                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "See Trailer",
                "Late Shows",
                "Two Shows Only",
                "A Film By",
                "Trailer",
            ]
            if any(skip.lower() == title.lower() for skip in skip_titles):
                continue
            if any(
                skip.lower() in title.lower() and len(title) < 20
                for skip in skip_titles
            ):
                continue

            if len(title) < 3 or len(title) > 100:
                continue

            movies.append(
                {
                    "title": title,
                    "rating_duration": rating_duration,
                    "director": director,
                    "start": match.start(),
                    "end": match.end(),
                }
            )

        logger.info(f"Found {len(movies)} movies on Landmark page")

        # For each movie, find showtimes and create one event per showtime
        for i, movie in enumerate(movies):
            # Get text section for this movie (until next movie or Trailer marker)
            if i + 1 < len(movies):
                section = text[movie["end"] : movies[i + 1]["start"]]
            else:
                section = text[movie["end"] : movie["end"] + 500]  # Limit search area

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
                        logger.debug(
                            f"Skipping invalid time: {time_str} (hour={hour_val}, min={min_val})"
                        )
                        continue
                # Skip if this looks like part of duration (preceded by "hr" or "min")
                prefix = section[
                    max(0, st_match.start() - 15) : st_match.start()
                ].lower()
                if "hr" in prefix or "min" in prefix:
                    continue
                parsed = parse_time(time_str)
                if parsed:
                    showtimes.append(parsed)

            # Skip if no valid showtimes found
            if not showtimes:
                continue

            # Dedupe and sort showtimes
            showtimes = sorted(set(showtimes))

            # Image lookup (case-insensitive, same for all showtimes of this film)
            poster_url = (detail_image_map or {}).get(
                _normalize_movie_title_key(movie["title"])
            ) or next(
                (
                    url
                    for title, url in (image_map or {}).items()
                    if title.lower() == movie["title"].lower()
                ),
                None,
            )

            # Accumulate screening entries (1 per showtime)
            movie_detail_url = (movie_url_map or {}).get(
                _normalize_movie_title_key(movie["title"])
            )

            for start_time in showtimes:
                # In-process dedup guard: skip if this exact showtime was already
                # processed in this crawl run (catches silent date-nav failures
                # where the page stays on the same day's content).
                showtime_key = (movie["title"], date_str, start_time)
                if showtime_key in seen_showtimes:
                    continue
                seen_showtimes.add(showtime_key)

                entries.append({
                    "title": movie["title"],
                    "start_date": date_str,
                    "start_time": start_time,
                    "image_url": poster_url,
                    "source_url": movie_detail_url or SHOWTIMES_URL,
                    "ticket_url": movie_detail_url,
                    "description": _build_showtime_description(
                        movie["title"],
                        movie["rating_duration"],
                        movie["director"],
                    ),
                    "tags": ["film", "cinema", "arthouse", "showtime", "landmark"],
                    "source_id": source_id,
                    "place_id": venue_id,
                })

    except Exception as e:
        logger.error(f"Error extracting movies: {e}")

    return entries


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
    all_entries: list[dict] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)
            today = datetime.now().date()

            # Shared set tracks every (title, date, time) processed this run so that
            # silent date-navigation failures don't re-insert the same showtime.
            seen_showtimes: set = set()

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

            image_map: dict[str, str] = {}
            movie_url_map: dict[str, str] = {}
            detail_image_map: dict[str, str] = {}
            image_map, movie_url_map, detail_image_map = _merge_movie_maps(
                image_map=image_map,
                movie_url_map=movie_url_map,
                detail_image_map=detail_image_map,
                page=page,
            )
            logger.info(f"Extracted {len(image_map)} movie images")
            logger.info(f"Extracted {len(movie_url_map)} Landmark movie detail links from showtimes page")
            try:
                if not movie_url_map:
                    venue_page = context.new_page()
                    venue_page.goto(VENUE_PAGE_URL, wait_until="domcontentloaded", timeout=30000)
                    venue_page.wait_for_timeout(3000)
                    movie_url_map = extract_movie_detail_links(venue_page)
                    venue_page.close()
                    logger.info(f"Extracted {len(movie_url_map)} Landmark movie detail links from venue page fallback")
                detail_image_map = extract_movie_detail_images(movie_url_map)
                logger.info(f"Extracted {len(detail_image_map)} Landmark movie detail images")
            except Exception as exc:
                logger.warning(f"Could not extract Landmark movie detail links: {exc}")

            # Extract today's showtimes (already showing by default)
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            all_entries.extend(extract_movies_for_date(
                page,
                datetime.combine(today, datetime.min.time()),
                source_id,
                venue_id,
                image_map,
                movie_url_map,
                detail_image_map,
                seen_showtimes,
            ))

            # Click through dates for next 7 days
            for day_offset in range(1, 8):
                target_date = today + timedelta(days=day_offset)
                day_num = target_date.day
                date_str = target_date.strftime("%Y-%m-%d")

                clicked = False
                try:
                    date_btn = page.locator(f"text=/^{day_num}$/").first
                    if date_btn.is_visible(timeout=1500):
                        date_btn.click()
                        page.wait_for_timeout(2000)
                        clicked = True
                except Exception:
                    pass

                if clicked:
                    page.evaluate("window.scrollTo(0, 0)")
                    page.wait_for_timeout(500)
                    for _ in range(2):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(800)

                    image_map, movie_url_map, detail_image_map = _merge_movie_maps(
                        image_map=image_map,
                        movie_url_map=movie_url_map,
                        detail_image_map=detail_image_map,
                        page=page,
                    )

                    logger.info(f"Scraping {date_str}")
                    all_entries.extend(extract_movies_for_date(
                        page,
                        datetime.combine(target_date, datetime.min.time()),
                        source_id,
                        venue_id,
                        image_map,
                        movie_url_map,
                        detail_image_map,
                        seen_showtimes,
                    ))

            browser.close()

        # --- Screening-primary persistence ---
        total_found = len(all_entries)
        source_slug = source.get("slug", "landmark-midtown")

        # Build screening bundle from accumulated entries
        # Convert entries to event-like dicts for build_screening_bundle_from_event_rows
        event_like_rows = entries_to_event_like_rows(all_entries)

        bundle = build_screening_bundle_from_event_rows(
            source_id=source_id,
            source_slug=source_slug,
            events=event_like_rows,
        )
        screening_summary = persist_screening_bundle(bundle)
        logger.info(
            "Landmark screening sync: %s titles, %s runs, %s times",
            screening_summary.get("titles", 0),
            screening_summary.get("runs", 0),
            screening_summary.get("times", 0),
        )

        # Derive 1 event per run (for RSVP/save/social-proof backward compat)
        run_summary = sync_run_events_from_screenings(
            source_id=source_id,
            source_slug=source_slug,
        )
        total_new = run_summary.get("events_created", 0)
        total_updated = run_summary.get("events_updated", 0)
        logger.info(
            "Landmark run events: %s created, %s updated, %s times linked",
            total_new, total_updated, run_summary.get("times_linked", 0),
        )

        # Clean up old per-showtime events
        run_event_hashes = run_summary.get("run_event_hashes", set())
        if run_event_hashes:
            cleanup = remove_stale_showtime_events(
                source_id=source_id,
                run_event_hashes=run_event_hashes,
            )
            if cleanup.get("deactivated") or cleanup.get("deleted"):
                logger.info("Stale showtime cleanup: %s", cleanup)

        logger.info(
            f"Landmark Midtown crawl complete: {total_found} showtimes, {total_new} new run events, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Landmark Midtown: {e}")
        raise

    return total_found, total_new, total_updated
