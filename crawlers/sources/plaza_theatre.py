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
import fnmatch

from playwright.sync_api import sync_playwright, Page

from db import (
    get_or_create_place,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    build_screening_bundle_from_event_rows,
    entries_to_event_like_rows,
)
from sources.plaza_letterboxd import get_letterboxd_movies, enrich_movie_data
from entity_lanes import TypedEntityEnvelope, SourceEntityCapabilities
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.plazaatlanta.com"

PLACE_DATA = {
    "name": "Plaza Theatre",
    "slug": "plaza-theatre",
    "address": "1049 Ponce De Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7758,
    "lng": -84.3534,
    "place_type": "cinema",
    "spot_type": "cinema",
    "website": BASE_URL,
    "vibes": ["independent", "cult-cinema", "repertory", "historic", "date-night", "late-night"],
    "description": (
        "Atlanta's last independent movie theater, operating since 1939. "
        "The Plaza screens cult classics, independent films, repertory favorites, "
        "and special events you won't find at chain theaters."
    ),
    "_destination_details": {
        "commitment_tier": "hour",
        "parking_type": "street",
        "best_time_of_day": "evening",
        "family_suitability": "caution",
        "practical_notes": (
            "Street parking on Ponce de Leon Ave and surrounding blocks. "
            "Single-screen theater — check the schedule in advance, especially for "
            "midnight and special programming which may have age restrictions or mature content."
        ),
        "primary_activity": "Independent, cult, and repertory cinema at Atlanta's oldest surviving movie house",
        "destination_type": "cinema",
    },
    "_venue_features": [
        {
            "title": "Historic single-screen cinema",
            "feature_type": "attraction",
            "description": "Operating since 1939, the Plaza is Atlanta's oldest and last remaining independent movie theater, preserving the classic single-screen experience.",
            "is_free": False,
            "sort_order": 10,
        },
        {
            "title": "Cult and repertory programming",
            "feature_type": "experience",
            "description": "Curated calendar of midnight movies, sing-alongs, themed screenings, and repertory classics not shown at chain theaters.",
            "is_free": False,
            "sort_order": 20,
        },
        {
            "title": "Beer and wine bar",
            "feature_type": "amenity",
            "description": "Full lobby bar serving beer and wine alongside traditional movie concessions.",
            "is_free": False,
            "sort_order": 30,
        },
    ],
    "_venue_specials": [
        {
            "title": "Bargain matinee pricing",
            "type": "admission",
            "description": "Discounted ticket pricing for matinee screenings earlier in the day.",
            "price_note": "Check current pricing at plazaatlanta.com",
        },
        {
            "title": "Midnight movie series",
            "type": "event_night",
            "description": "Recurring late-night screenings of cult classics and themed films, typically on weekend nights.",
            "days_of_week": "{6,7}",
        },
    ],
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "place_id": venue_id,
        "destination_type": "cinema",
        "commitment_tier": "hour",
        "primary_activity": "Atlanta's last independent cinema — cult, indie, and repertory programming",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day", "date-night"],
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "practical_notes": "Free parking lot. Located on Ponce de Leon Ave near the Ponce City Market / Beltline corridor. Single-screen theater with a curated programming calendar — check schedule in advance.",
        "accessibility_notes": "ADA accessible.",
        "family_suitability": "caution",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Standard movie ticket pricing. Special events and screenings may have different pricing.",
        "source_url": "https://plazaatlanta.com",
        "metadata": {"source_type": "venue_enrichment", "place_type": "cinema", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "atlantas-last-independent-cinema",
        "title": "Atlanta's last independent cinema",
        "feature_type": "attraction",
        "description": "The last remaining independent movie theater in Atlanta, operating since 1939 with a focus on non-mainstream programming.",
        "url": "https://plazaatlanta.com",
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "cult-indie-repertory",
        "title": "Cult, indie, and repertory programming",
        "feature_type": "experience",
        "description": "Curated calendar of cult classics, independent films, repertory screenings, and special events not shown at chain theaters.",
        "url": "https://plazaatlanta.com",
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "beer-wine-concessions",
        "title": "Beer, wine, and concessions",
        "feature_type": "amenity",
        "description": "Full concession stand with beer and wine alongside traditional movie snacks.",
        "url": "https://plazaatlanta.com",
        "is_free": False,
        "sort_order": 30,
    })
    return envelope


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


def resolve_showtime_ticket_url(
    page: Page,
    button_locator,
    *,
    expected_pattern: str = "**/checkout/showing/**",
) -> Optional[str]:
    """Click a showtime button and capture the checkout URL, then return to listings."""
    original_url = page.url
    checkout_url = None

    try:
        button_locator.click(timeout=5000)
        page.wait_for_url(expected_pattern, timeout=10000)
        if fnmatch.fnmatch(page.url, expected_pattern.replace("**", "*")):
            checkout_url = page.url
    except Exception:
        checkout_url = None
    finally:
        if page.url != original_url:
            try:
                page.go_back(wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(1500)
            except Exception:
                pass

    return checkout_url


def extract_movies_for_date(
    page: Page,
    target_date: datetime,
    source_id: int,
    venue_id: int,
    letterboxd_movies: list[dict],
    image_map: dict[str, str],
    seen_hashes: set,
) -> list[dict]:
    """Extract movies and showtimes for the currently displayed date.

    Plaza's Quasar SPA renders the correct title/time cards for the selected
    day, but the showtime button click handlers can resolve to the wrong
    checkout record. Read title/time directly from the visible cards and avoid
    resolving ticket URLs from button clicks.

    Returns a list of screening entry dicts for later bulk persistence.
    """
    entries: list[dict] = []

    date_str = target_date.strftime("%Y-%m-%d")
    card_locator = None
    card_selector = None
    container_count = 0
    for selector in (
        ".movie-container",
        ".q-card.col.movie",
        ".col-sm-6 .q-card.col.movie",
    ):
        try:
            locator = page.locator(selector)
            count = locator.count()
        except Exception:
            continue
        if count:
            card_locator = locator
            card_selector = selector
            container_count = count
            break

    if container_count == 0:
        logger.warning(
            f"No movie cards found for {date_str} - site structure may have changed, "
            "falling back to text extraction"
        )
        entries = _extract_movies_from_text(
            page, date_str, source_id, venue_id, letterboxd_movies, image_map, seen_hashes
        )
    else:
        logger.debug(
            f"Found {container_count} movie cards via {card_selector} for {date_str}; "
            "extracting visible showtimes without clicking checkout buttons"
        )
        for container_idx in range(container_count):
            try:
                container = card_locator.nth(container_idx)

                title_el = container.locator(".text-h5").first
                if title_el.count() == 0:
                    continue
                movie_title = title_el.inner_text().strip()
                if not movie_title or len(movie_title) < 2:
                    continue

                movie_title = " ".join(movie_title.split())
                movie_title = re.sub(r'\s*\((?:4K|2K|35mm|70mm)\)\s*$', '', movie_title, flags=re.IGNORECASE)
                movie_title = re.sub(r'\s*(?:Not Rated|Rated\s*[RPGNC](?:-\d+)?)\s*$', '', movie_title, flags=re.IGNORECASE)
                movie_title = movie_title.strip()

                if not movie_title or len(movie_title) < 2:
                    continue

                buttons = container.locator("button")
                showtime_rows = []
                for button_idx in range(buttons.count()):
                    try:
                        btn_text = buttons.nth(button_idx).inner_text().strip()
                        first_line = btn_text.split("\n")[0].strip()
                        parsed_time = parse_time(first_line)
                        if parsed_time and parsed_time not in [row["start_time"] for row in showtime_rows]:
                            showtime_rows.append({"start_time": parsed_time, "ticket_url": None})
                    except Exception:
                        continue

                if not showtime_rows:
                    logger.warning(f"  Movie '{movie_title}' found but has no showtimes on {date_str} - skipping")
                    continue

                logger.debug(
                    f"  Processing '{movie_title}' with {len(showtime_rows)} showtime(s): "
                    f"{', '.join(row['start_time'] for row in showtime_rows)}"
                )

                img_el = container.locator("img.q-img__image").first
                container_image = None
                if img_el.count() > 0:
                    container_image = img_el.get_attribute("src")

                enrichment = enrich_movie_data(movie_title, letterboxd_movies) or {}

                tags = ["film", "cinema", "independent", "showtime", "plaza-theatre"]
                if enrichment.get("special_event"):
                    tags.append(enrichment["special_event"])

                image_url = (
                    enrichment.get("image_url")
                    or container_image
                    or find_image_for_movie(movie_title, image_map)
                )

                for showtime_row in showtime_rows:
                    start_time = showtime_row["start_time"]
                    # In-process dedup guard
                    showtime_key = (movie_title, date_str, start_time)
                    if showtime_key in seen_hashes:
                        continue
                    seen_hashes.add(showtime_key)

                    entries.append({
                        "title": movie_title,
                        "start_date": date_str,
                        "start_time": start_time,
                        "image_url": image_url,
                        "source_url": f"{BASE_URL}/now-showing",
                        # Plaza's now-showing listings currently mis-route ticket
                        # links across days/titles, so keep schedule rows but drop
                        # per-show checkout URLs until the source exposes a stable
                        # show-specific link.
                        "ticket_url": None,
                        "description": None,
                        "tags": tags,
                        "source_id": source_id,
                        "place_id": venue_id,
                    })
                    logger.info(f"  Queued: {movie_title} on {date_str} at {start_time}")

            except Exception as e:
                logger.debug(f"Error processing movie container: {e}")
                continue

    logger.info(f"  {date_str}: {len(entries)} showtimes queued")
    return entries


def _extract_movies_from_text(
    page: Page,
    date_str: str,
    source_id: int,
    venue_id: int,
    letterboxd_movies: list[dict],
    image_map: dict[str, str],
    seen_hashes: set,
) -> list[dict]:
    """Fallback text-based extraction if DOM selectors don't work.

    Returns a list of screening entry dicts for later bulk persistence.
    """
    entries: list[dict] = []

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    duration_pattern = re.compile(r'^(\d+)\s*hr(?:\s*(\d+)\s*min)?', re.IGNORECASE)
    time_pattern = re.compile(r'^(\d{1,2}:\d{2})\s*(AM|PM)$', re.IGNORECASE)
    rating_pattern = re.compile(r'^(Not Rated|Rated\s*[A-Z0-9\-]+)$', re.IGNORECASE)
    ends_at_pattern = re.compile(r'^ENDS AT\b', re.IGNORECASE)

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
        "Discount Days", "DISCOUNT DAYS", "Captioned", "SUBTITLED", "Subtitled",
        "accessible", "headphones", "closed_caption", "calendar_today", "Date",
        "local_movies", "play_arrow", "search", "add_shopping_cart",
        "The Lefont", "The Rej", "The Mike",
        "Digital", "35MM", "70MM",
    ]
    skip_titles_lower = {skip.lower() for skip in skip_titles}

    def _has_nearby_duration(start_idx: int) -> bool:
        for lookahead_idx in range(start_idx + 1, min(len(lines), start_idx + 7)):
            candidate = lines[lookahead_idx]
            if duration_pattern.match(candidate):
                return True
            if time_pattern.match(candidate) or ends_at_pattern.match(candidate):
                return False
        return False

    def _looks_like_movie_title(line: str, idx: int) -> bool:
        normalized = line.strip()
        if len(normalized) < 3:
            return False
        if normalized.lower() in skip_titles_lower:
            return False
        if normalized.startswith("·"):
            return False
        if re.match(r'^\d+$', normalized):
            return False
        if duration_pattern.match(normalized) or time_pattern.match(normalized):
            return False
        if rating_pattern.match(normalized) or ends_at_pattern.match(normalized):
            return False
        return _has_nearby_duration(idx)

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

        if _looks_like_movie_title(line, i):
            if current_movie and current_times:
                matches.append((current_movie, current_times))

            current_movie = line
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
            # In-process dedup guard
            showtime_key = (title, date_str, start_time)
            if showtime_key in seen_hashes:
                continue
            seen_hashes.add(showtime_key)

            entries.append({
                "title": title,
                "start_date": date_str,
                "start_time": start_time,
                "image_url": image_url,
                "source_url": f"{BASE_URL}/now-showing",
                # Text fallback reads the same unstable now-showing listing, so
                # do not persist enrichment-provided ticket URLs here either.
                "ticket_url": None,
                "description": None,
                "tags": tags,
                "source_id": source_id,
                "place_id": venue_id,
            })
            logger.info(f"  Queued: {title} on {date_str} at {start_time}")

    return entries


def extract_special_events(
    page: Page,
    source_id: int,
    venue_id: int,
    letterboxd_movies: list[dict],
    image_map: dict[str, str],
    seen_hashes: set,
) -> list[dict]:
    """Extract special events from /special-events/ page.

    Special events are listed as text blocks with format:
    "Feb 4" (date line)
    "Event Title"
    "Description text..."

    Returns a list of screening entry dicts for later bulk persistence.
    """
    entries: list[dict] = []

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
                    # Launch gate expects Plaza showtimes to carry an explicit time.
                    # Skip special events with no parsed time rather than inserting
                    # all-day placeholders that dilute time coverage quality.
                    if not time_str:
                        logger.debug(f"  Skipping special event without time: {title} on {event_date}")
                        i = j if j > i + 1 else i + 1
                        continue

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

                    # In-process dedup guard
                    showtime_key = (title, event_date, time_str or "00:00")
                    if showtime_key not in seen_hashes:
                        seen_hashes.add(showtime_key)
                        entries.append({
                            "title": title,
                            "start_date": event_date,
                            "start_time": time_str,
                            "image_url": image_url,
                            "source_url": f"{BASE_URL}/special-events/",
                            "ticket_url": enrichment.get("ticket_url"),
                            "description": description,
                            "tags": tags,
                            "source_id": source_id,
                            "place_id": venue_id,
                        })
                        logger.info(f"  Queued special event: {title} on {event_date}")

            i = j if j > i + 1 else i + 1
        else:
            i += 1

    return entries


def _wait_for_movies(page: Page, timeout: int = 12000) -> bool:
    """Wait for movie cards to appear after SPA renders.

    Returns True if at least one container was found, False on timeout.
    """
    try:
        page.wait_for_function(
            "() => !!document.querySelector('.movie-container, .q-card.col.movie, .col-sm-6 .q-card.col.movie')",
            timeout=timeout,
        )
        return True
    except Exception:
        return False


def _click_plaza_tab(page: Page) -> None:
    """Click the 'Plaza Theatre Atlanta' tab if visible, then wait for re-render."""
    try:
        plaza_tab = page.locator("text=Plaza Theatre Atlanta").first
        if plaza_tab.is_visible(timeout=2000):
            plaza_tab.click()
            _wait_for_movies(page, timeout=8000)
    except Exception:
        pass


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Plaza Theatre showtimes from now-showing and special-events pages."""
    source_id = source["id"]
    total_found = 0
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

            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))
            today = datetime.now().date()

            # Fetch Letterboxd RSS for enrichment
            letterboxd_movies = get_letterboxd_movies()
            logger.info(f"Fetched {len(letterboxd_movies)} movies from Letterboxd RSS")

            # --- Now Showing page ---
            now_showing_url = f"{BASE_URL}/now-showing"
            logger.info(f"Fetching: {now_showing_url}")
            page.goto(now_showing_url, wait_until="domcontentloaded", timeout=30000)

            # Wait for Vue/Quasar SPA to render movie containers.
            # Fixed timeouts are unreliable — the SPA render time varies.
            # Retry with a full page reload if the first attempt fails.
            if not _wait_for_movies(page, timeout=15000):
                logger.warning("No .movie-container on first load, retrying with reload")
                page.reload(wait_until="domcontentloaded", timeout=30000)
                if not _wait_for_movies(page, timeout=15000):
                    logger.warning("No .movie-container after reload — will try text fallback")

            # Click "Plaza Theatre Atlanta" tab (site shows both Plaza and Tara)
            _click_plaza_tab(page)

            # Extract movie images
            image_map = extract_movie_images(page)

            # Extract today's showtimes (default view)
            logger.info(f"Scraping Today ({today.strftime('%Y-%m-%d')})")
            day_entries = extract_movies_for_date(
                page, datetime.combine(today, datetime.min.time()),
                source_id, venue_id, letterboxd_movies, image_map, seen_hashes
            )
            all_entries.extend(day_entries)

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

                # Wait for SPA to re-render with new date's movies
                _wait_for_movies(page, timeout=10000)

                # Re-select Plaza Theatre tab (may reset after date change)
                _click_plaza_tab(page)

                logger.info(f"Scraping {date_str}")
                day_entries = extract_movies_for_date(
                    page, datetime.combine(target_date, datetime.min.time()),
                    source_id, venue_id, letterboxd_movies, image_map, seen_hashes
                )
                all_entries.extend(day_entries)

                if not day_entries:
                    logger.info(f"  {date_str}: No showtimes found")
                    break

            # --- Special Events page ---
            special_url = f"{BASE_URL}/special-events/"
            logger.info(f"Fetching: {special_url}")
            try:
                page.goto(special_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                special_entries = extract_special_events(
                    page, source_id, venue_id, letterboxd_movies, image_map, seen_hashes
                )
                all_entries.extend(special_entries)
            except Exception as e:
                logger.error(f"Error crawling special events: {e}")

            browser.close()

        # --- Screening-primary persistence ---
        total_found = len(all_entries)
        source_slug = source.get("slug", "plaza-theatre")

        event_like_rows = entries_to_event_like_rows(all_entries)

        bundle = build_screening_bundle_from_event_rows(
            source_id=source_id, source_slug=source_slug, events=event_like_rows,
        )
        screening_summary = persist_screening_bundle(bundle)
        logger.info(
            "Plaza screening sync: %s titles, %s runs, %s times",
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
            f"Plaza Theatre crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Plaza Theatre: {e}")
        raise

    return total_found, total_new, total_updated
