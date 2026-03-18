"""
Crawler for Atlanta Fringe Festival (atlantafringe.org).

Annual multi-genre performing arts festival held in late May/early June
at venues throughout East Atlanta Village, Little Five Points, and Old
Fourth Ward. Features theatre, comedy, dance, storytelling, puppetry,
magic, improv, and cabaret from local GA artists and touring acts.

Data model:
  - Individual shows are WordPress custom post type /wp/v2/events
  - Each show may have multiple performances (date + time + venue per perf)
  - Taxonomies: genres, dates (YYYY-MM-DD slugs), venues (slug), seasons
  - The festival adds show pages incrementally before the festival; we
    crawl via the REST API and emit one event per performance.
  - When the current season has no show pages yet (early in the year)
    we fall back to parsing the homepage lineup so we can emit
    at-minimum one event per show without specific times.

Festival dates 2026: May 27 – June 7
Venues: 7 Stages, Limelight, Metropolitan Studios, Dynamic El Dorado,
        Monk's Meadery, The Supermarket (3 stages), East Atlanta Kids Club
"""

from __future__ import annotations

import html
import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantafringe.org"
WP_API = f"{BASE_URL}/wp-json/wp/v2"

# ---------------------------------------------------------------------------
# Venue records for the main festival venues (2025 addresses, stable year-over-year)
# ---------------------------------------------------------------------------

# Primary festival venue — used when a show has no specific venue mapped
VENUE_DATA_PRIMARY = {
    "name": "Atlanta Fringe Festival",
    "slug": "atlanta-fringe-festival",
    "address": "1105 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7537,
    "lng": -84.3549,
    "venue_type": "festival",
    "spot_type": "festival",
    "website": BASE_URL,
    "vibes": ["performing-arts", "indie", "experimental", "festival"],
}

# Individual venue records keyed by their WP slug so we can map taxonomy IDs
_VENUE_SLUG_TO_DATA: dict[str, dict] = {
    "7-stages-mainstage": {
        "name": "7 Stages Theatre",
        "slug": "7-stages-theatre",
        "address": "1105 Euclid Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7537,
        "lng": -84.3549,
        "venue_type": "theater",
        "spot_type": "theater",
        "website": "https://7stages.org",
        "vibes": ["experimental", "theater", "indie"],
    },
    "7-stages-back-stage": {
        "name": "7 Stages Theatre",
        "slug": "7-stages-theatre",
        "address": "1105 Euclid Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7537,
        "lng": -84.3549,
        "venue_type": "theater",
        "spot_type": "theater",
        "website": "https://7stages.org",
        "vibes": ["experimental", "theater", "indie"],
    },
    "limelight-mainstage": {
        "name": "Limelight",
        "slug": "limelight-atlanta",
        "address": "349 Decatur St SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7492,
        "lng": -84.3741,
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://limelightatlanta.com",
        "vibes": ["indie", "comedy", "performing-arts"],
    },
    "limelight-black-box": {
        "name": "Limelight",
        "slug": "limelight-atlanta",
        "address": "349 Decatur St SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7492,
        "lng": -84.3741,
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://limelightatlanta.com",
        "vibes": ["indie", "comedy", "performing-arts"],
    },
    "metropolitan-studios": {
        "name": "Metropolitan Studios",
        "slug": "metropolitan-studios-atlanta",
        "address": "1259 Metropolitan Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7321,
        "lng": -84.3436,
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://metropolitanstudios.com",
        "vibes": ["burlesque", "cabaret", "performing-arts", "intimate"],
    },
    "dynamic-el-dorado": {
        "name": "Dynamic El Dorado",
        "slug": "dynamic-el-dorado",
        "address": "572 Edgewood Ave SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7495,
        "lng": -84.3747,
        "venue_type": "comedy_club",
        "spot_type": "comedy_club",
        "website": "https://dynamiceldorado.com",
        "vibes": ["comedy", "intimate", "performing-arts"],
    },
    "monks-meadery": {
        "name": "Monk's Meadery",
        "slug": "monks-meadery",
        "address": "579 N Highland Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7666,
        "lng": -84.3588,
        "venue_type": "brewery",
        "spot_type": "brewery",
        "website": "https://monksmeadery.com",
        "vibes": ["craft-drinks", "performing-arts", "intimate"],
    },
    "the-supermarket-black-box": {
        "name": "The Supermarket",
        "slug": "the-supermarket-atlanta",
        "address": "638 N Highland Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7675,
        "lng": -84.3583,
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://thesupermarketatl.com",
        "vibes": ["creative-space", "performing-arts", "indie"],
    },
    "the-supermarket-blue-venue": {
        "name": "The Supermarket",
        "slug": "the-supermarket-atlanta",
        "address": "638 N Highland Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7675,
        "lng": -84.3583,
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://thesupermarketatl.com",
        "vibes": ["creative-space", "performing-arts", "indie"],
    },
    "the-supermarket-event-stage": {
        "name": "The Supermarket",
        "slug": "the-supermarket-atlanta",
        "address": "638 N Highland Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7675,
        "lng": -84.3583,
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://thesupermarketatl.com",
        "vibes": ["creative-space", "performing-arts", "indie"],
    },
    "east-atlanta-kids-club": {
        "name": "East Atlanta Kids Club",
        "slug": "east-atlanta-kids-club",
        "address": "602 Brownwood Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7292,
        "lng": -84.3400,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://eastatlantakidsclub.org",
        "vibes": ["family-friendly", "performing-arts"],
    },
}

# ---------------------------------------------------------------------------
# Genre-to-category mapping
# ---------------------------------------------------------------------------

_GENRE_TO_CATEGORY: dict[str, str] = {
    "theatre": "theater",
    "theater": "theater",
    "drama": "theater",
    "comedy": "comedy",
    "improv": "comedy",
    "stand-up": "comedy",
    "storytelling-spoken-word": "words",
    "storytelling & spoken word": "words",
    "storytelling/spoken word": "words",
    "dance-physical-theatre": "theater",
    "dance & physical theatre": "theater",
    "dance/contemporary": "theater",
    "musical-theatre": "theater",
    "musical theatre": "theater",
    "cabaret-variety": "theater",
    "cabaret & variety": "theater",
    "cabaret/variety": "theater",
    "puppetry": "theater",
    "magic-mentalism": "theater",
    "magic & mentalism": "theater",
    "magic/mentalism": "theater",
    "performance-art": "art",
    "performance art": "art",
    "circus/clowning": "theater",
    "other": "other",
}


def _genre_to_category(genre_slug: str, genre_name: str) -> str:
    """Map a genre slug or name to an event category."""
    slug_lower = genre_slug.lower().strip()
    name_lower = genre_name.lower().strip()
    return (
        _GENRE_TO_CATEGORY.get(slug_lower)
        or _GENRE_TO_CATEGORY.get(name_lower)
        or "theater"
    )


def _genre_to_subcategory(genre_name: str) -> str:
    """Map genre name to a subcategory tag."""
    mapping = {
        "theatre": "theater",
        "theater": "theater",
        "drama": "drama",
        "comedy": "comedy",
        "improv": "improv",
        "stand-up": "standup",
        "storytelling & spoken word": "spoken_word",
        "dance & physical theatre": "dance",
        "musical theatre": "musical_theater",
        "cabaret & variety": "cabaret",
        "puppetry": "puppetry",
        "magic & mentalism": "magic",
        "performance art": "performance_art",
    }
    return mapping.get(genre_name.lower().strip(), "festival")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _html_decode(text: str) -> str:
    """Unescape HTML entities."""
    return html.unescape(text) if text else text


def _parse_show_time(time_str: str) -> Optional[str]:
    """
    Parse time strings like '8.45pm', '10.30pm', '11.00am' into 'HH:MM'.
    The site uses periods instead of colons in times.
    """
    if not time_str:
        return None
    # Normalise '.' separator to ':'
    normalised = time_str.strip().lower().replace(".", ":")
    for fmt in ["%I:%M%p", "%I:%M %p"]:
        try:
            dt = datetime.strptime(normalised, fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            pass
    # Try without minutes e.g. '8pm'
    try:
        dt = datetime.strptime(normalised, "%I%p")
        return dt.strftime("%H:%M")
    except ValueError:
        pass
    return None


def _parse_perf_date(date_str: str) -> Optional[str]:
    """
    Parse performance date strings like 'June 7, 2025' or 'May 27, 2026'.
    """
    date_str = date_str.strip()
    for fmt in ["%B %d, %Y", "%B %d %Y"]:
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _parse_price(price_str: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Returns (price_min, price_max, is_free).
    Handles 'FREE', '$18', 'Pay What You Can', '$12-$18'.
    """
    if not price_str:
        return None, None, None  # type: ignore[return-value]
    s = price_str.strip().lower()
    if s in ("free", "", "0", "$0"):
        return 0.0, 0.0, True
    if "pay what you can" in s or "pwyc" in s or "pay what" in s:
        return 0.0, 0.0, True
    # Range like '$12-$18'
    range_match = re.search(r"\$(\d+(?:\.\d+)?)\s*[-–]\s*\$(\d+(?:\.\d+)?)", price_str)
    if range_match:
        lo, hi = float(range_match.group(1)), float(range_match.group(2))
        return lo, hi, False
    single_match = re.search(r"\$(\d+(?:\.\d+)?)", price_str)
    if single_match:
        val = float(single_match.group(1))
        return val, val, False
    return None, None, None  # type: ignore[return-value]


def _infer_genre_from_text(genre_text: str) -> tuple[str, str]:
    """
    Given free-form genre text like 'comedy/theater' or 'stand-up/storytelling',
    return (category, subcategory).
    """
    text_lower = genre_text.lower()
    if "dance" in text_lower:
        return "theater", "dance"
    if "musical" in text_lower:
        return "theater", "musical_theater"
    if "theatre" in text_lower or "theater" in text_lower or "drama" in text_lower:
        return "theater", "theater"
    if (
        "comedy" in text_lower
        or "standup" in text_lower
        or "stand-up" in text_lower
        or "clown" in text_lower
    ):
        return "comedy", "comedy"
    if "improv" in text_lower:
        return "comedy", "improv"
    if "storytelling" in text_lower or "spoken word" in text_lower:
        return "words", "spoken_word"
    if "cabaret" in text_lower or "variety" in text_lower or "burlesque" in text_lower:
        return "theater", "cabaret"
    if "puppet" in text_lower:
        return "theater", "puppetry"
    if "magic" in text_lower or "mentalism" in text_lower:
        return "theater", "magic"
    if "circus" in text_lower or "aerial" in text_lower:
        return "theater", "circus"
    if "music" in text_lower:
        return "music", "festival"
    return "theater", "festival"


# ---------------------------------------------------------------------------
# WP REST API fetching
# ---------------------------------------------------------------------------


def _fetch_json(
    url: str, params: dict = None, timeout: int = 20
) -> Optional[dict | list]:
    """GET JSON from a URL; returns None on failure."""
    try:
        resp = requests.get(
            url,
            params=params,
            timeout=timeout,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning(f"Failed to fetch {url}: {exc}")
        return None


def _get_all_events_for_season(season_id: int) -> list[dict]:
    """Fetch all WP event posts for a given season taxonomy term."""
    events = []
    page = 1
    while True:
        data = _fetch_json(
            f"{WP_API}/events",
            params={
                "seasons": season_id,
                "per_page": 100,
                "page": page,
                "_embed": 1,
                "status": "publish",
            },
        )
        if not data or not isinstance(data, list):
            break
        events.extend(data)
        if len(data) < 100:
            break
        page += 1
    return events


def _get_venue_taxonomy_map() -> dict[int, str]:
    """
    Build a map of venues taxonomy term_id -> venue_slug.
    We need this to look up which WP venue post corresponds to the
    term IDs stored on each event.
    """
    data = _fetch_json(
        f"{WP_API}/venues", params={"per_page": 100, "hide_empty": "false"}
    )
    if not data or not isinstance(data, list):
        return {}
    return {item["id"]: item["slug"] for item in data}


def _get_seasons() -> list[dict]:
    """Return all season taxonomy terms."""
    data = _fetch_json(f"{WP_API}/seasons", params={"per_page": 50})
    return data if isinstance(data, list) else []


def _get_dates_taxonomy() -> dict[int, str]:
    """Return map of dates term_id -> date string (YYYY-MM-DD)."""
    data = _fetch_json(f"{WP_API}/dates", params={"per_page": 100})
    if not data or not isinstance(data, list):
        return {}
    result = {}
    for item in data:
        term_id = item.get("id")
        slug = item.get("slug", "")  # slug IS the date string
        if term_id and slug and re.match(r"^\d{4}-\d{2}-\d{2}$", slug):
            result[term_id] = slug
    return result


def _get_genres_taxonomy() -> dict[int, tuple[str, str]]:
    """Return map of genres term_id -> (slug, name)."""
    data = _fetch_json(f"{WP_API}/genres", params={"per_page": 100})
    if not data or not isinstance(data, list):
        return {}
    return {item["id"]: (item.get("slug", ""), item.get("name", "")) for item in data}


# ---------------------------------------------------------------------------
# Show page scraping for performance times
# ---------------------------------------------------------------------------


def _scrape_performances_from_page(show_url: str) -> list[dict]:
    """
    Scrape individual show page to extract all performances.
    Returns list of dicts with keys: date, time, venue_name, price, cancelled.

    Page structure (rendered server-side by Divi):
      ...
      <date> <time>
      <venue name>
      Price: <$XX / FREE>
      [CANCELLED]
      <next performance>
      ...

    We identify blocks where a line matches a date pattern.
    """
    try:
        resp = requests.get(
            show_url,
            timeout=20,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning(f"Failed to fetch show page {show_url}: {exc}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    body = soup.find("body")
    if not body:
        return []

    text = body.get_text(separator="\n", strip=True)
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # Find the block between "Event Details" and "The Buzz Intro Interview" or "Related Events"
    start_idx = None
    end_idx = None
    for i, line in enumerate(lines):
        if line == "Event Details":
            start_idx = i
        if start_idx and line in (
            "The Buzz Intro Interview",
            "Related Events",
            "Support",
        ):
            end_idx = i
            break

    if start_idx is None:
        return []
    section = lines[start_idx:end_idx] if end_idx else lines[start_idx:]

    # Pattern: "June 7, 2025 8.45pm" or "June 7, 2025 11.00am"
    DATE_TIME_RE = re.compile(
        r"^(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+\d{1,2},\s+\d{4}"
        r"\s+\d{1,2}\.\d{2}[ap]m$",
        re.IGNORECASE,
    )
    # Just a date (all-day or TBA time)
    DATE_ONLY_RE = re.compile(
        r"^(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+\d{1,2},\s+\d{4}$",
        re.IGNORECASE,
    )

    performances = []
    i = 0
    while i < len(section):
        line = section[i]
        dt_match = DATE_TIME_RE.match(line)
        date_only_match = DATE_ONLY_RE.match(line)

        if dt_match or date_only_match:
            # Parse date and time
            parts = line.rsplit(None, 1)  # split off time from end
            if dt_match and len(parts) == 2:
                date_part = parts[0].strip()
                time_part = parts[1].strip()
                parsed_date = _parse_perf_date(date_part)
                parsed_time = _parse_show_time(time_part)
            else:
                parsed_date = _parse_perf_date(line)
                parsed_time = None

            if not parsed_date:
                i += 1
                continue

            # Next line is venue name
            venue_name = section[i + 1].strip() if i + 1 < len(section) else None
            if venue_name and venue_name.startswith("Price:"):
                venue_name = None
                price_line = venue_name
                next_offset = 1
            else:
                # Skip "Price:" label
                price_line = None
                next_offset = 2
                if i + next_offset < len(section) and section[
                    i + next_offset
                ].startswith("Price:"):
                    price_line = section[i + next_offset]
                    next_offset += 1

            # Extract price
            price_str = ""
            if price_line:
                price_str = price_line.replace("Price:", "").strip()
            elif i + 2 < len(section) and section[i + 2].startswith("Price:"):
                price_str = section[i + 2].replace("Price:", "").strip()
                next_offset = 3

            # Check for CANCELLED
            cancelled = False
            for j in range(i + 1, min(i + 5, len(section))):
                if section[j].upper() == "CANCELLED":
                    cancelled = True
                    break

            performances.append(
                {
                    "date": parsed_date,
                    "time": parsed_time,
                    "venue_name": venue_name or "",
                    "price": price_str,
                    "cancelled": cancelled,
                }
            )

            i += next_offset
            continue

        i += 1

    return performances


# ---------------------------------------------------------------------------
# Homepage fallback: parse show listings when no WP event pages exist yet
# ---------------------------------------------------------------------------


def _parse_homepage_shows() -> list[dict]:
    """
    Parse the homepage to extract show listings (title, performer, genre, origin).
    Used as fallback when the WP events endpoint returns no shows for the
    current season.

    Returns list of dicts with keys: title, performer, genre, origin, is_ga.
    """
    try:
        resp = requests.get(
            BASE_URL,
            timeout=20,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning(f"Failed to fetch homepage: {exc}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")

    shows = []

    # Find the GA Artists section
    for section_marker, is_ga in [("GA Artists", True), ("Touring Artists", False)]:
        h2 = soup.find(
            "h2", string=re.compile(re.escape(section_marker), re.IGNORECASE)
        )
        if not h2:
            # Try span inside h2
            for h2_elem in soup.find_all("h2"):
                if section_marker in h2_elem.get_text():
                    h2 = h2_elem
                    break

        if not h2:
            continue

        # Collect <p> siblings until next section
        node = h2.find_next_sibling()
        while node:
            if node.name in ("h1", "h2", "h3", "h4"):
                break
            if node.name == "p":
                # Each <p> is one show: <b><i>Title</i></b>, Performer, genre (Origin)
                p_text = node.get_text(separator=" ", strip=True)
                # Also get raw HTML to extract bold-italic title
                p_html = str(node)
                # Title is in <b><i>...</i></b>
                bi_match = re.search(r"<b[^>]*><i[^>]*>(.*?)</i>", p_html, re.DOTALL)
                if bi_match:
                    raw_title = bi_match.group(1)
                    title = _html_decode(
                        BeautifulSoup(raw_title, "lxml").get_text(strip=True)
                    )
                else:
                    # Fall back to first comma-separated chunk
                    title = p_text.split(",")[0].strip()

                if not title or title.lower() in ("tbd", "tba"):
                    node = node.find_next_sibling()
                    continue

                # Rest of line: performer, genre (origin)
                remainder = p_text[len(title) :].lstrip(", ").strip()
                # Parse "Performer Name, genre (City, ST)"
                origin_match = re.search(r"\(([^)]+)\)\s*$", remainder)
                origin = origin_match.group(1).strip() if origin_match else ""
                without_origin = (
                    remainder[: origin_match.start()].strip().rstrip(",")
                    if origin_match
                    else remainder
                )
                # Split performer from genre at last comma
                parts = without_origin.rsplit(",", 1)
                if len(parts) == 2:
                    performer = parts[0].strip()
                    genre_text = parts[1].strip()
                else:
                    performer = without_origin.strip()
                    genre_text = ""

                shows.append(
                    {
                        "title": title,
                        "performer": performer,
                        "genre": genre_text,
                        "origin": origin,
                        "is_ga": is_ga,
                    }
                )

            node = node.find_next_sibling()

    return shows


# ---------------------------------------------------------------------------
# Festival date detection
# ---------------------------------------------------------------------------


def _detect_festival_year_and_dates(
    seasons: list[dict],
) -> tuple[int, Optional[str], Optional[str]]:
    """
    Return (festival_year, start_date_str, end_date_str).
    Tries to detect from homepage copy first, then falls back to known pattern.
    """
    current_year = datetime.now().year

    # Check homepage for date announcement
    try:
        resp = requests.get(
            BASE_URL,
            timeout=15,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
        )
        body_text = resp.text
        # Pattern: "May 27-June 7, 2026" or "May 28-June 8, 2025"
        date_range_match = re.search(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)"
            r"\s+(\d{1,2})\s*[-–]\s*"
            r"(January|February|March|April|May|June|July|August|September|October|November|December)"
            r"\s+(\d{1,2}),?\s*(\d{4})",
            body_text,
        )
        if date_range_match:
            sm, sd, em, ed, yr = date_range_match.groups()
            year = int(yr)
            try:
                start_dt = datetime.strptime(f"{sm} {sd} {year}", "%B %d %Y")
                end_dt = datetime.strptime(f"{em} {ed} {year}", "%B %d %Y")
                return year, start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
    except Exception:
        pass

    # Fallback: use most recent season from the seasons taxonomy
    # or default to late May / early June of current year
    for season in sorted(seasons, key=lambda s: s.get("name", ""), reverse=True):
        name = season.get("name", "")
        yr_match = re.search(r"(\d{4})", name)
        if yr_match:
            year = int(yr_match.group(1))
            return year, None, None

    # Last resort: current year with known May/June schedule
    return current_year, None, None


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Fringe Festival for individual show events.

    Strategy:
    1. Fetch current seasons from WP API.
    2. For the most recent season, fetch all show posts via WP REST.
    3. For each show post, visit the show detail page to scrape individual
       performance times, venue, and price.
    4. Emit one event per performance.
    5. If no show posts exist yet (pre-season), fall back to parsing the
       homepage lineup and emit one event per show using the announced
       festival date range (start_date = festival open, no specific time).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # -- Ensure primary festival venue exists
    primary_venue_id = get_or_create_venue(VENUE_DATA_PRIMARY)

    # -- Build venue slug -> db venue_id cache
    venue_id_cache: dict[str, int] = {}

    def _get_venue_id(slug: str) -> int:
        if slug in venue_id_cache:
            return venue_id_cache[slug]
        vdata = _VENUE_SLUG_TO_DATA.get(slug)
        if vdata:
            vid = get_or_create_venue(vdata)
        else:
            vid = primary_venue_id
        venue_id_cache[slug] = vid
        return vid

    def _get_venue_id_by_name(venue_name: str) -> int:
        """Look up venue_id by display name (fallback for page-scraped venue names)."""
        name_to_slug = {
            "7 stages mainstage": "7-stages-mainstage",
            "7 stages back stage": "7-stages-back-stage",
            "7 stages backstage": "7-stages-back-stage",
            "limelight mainstage": "limelight-mainstage",
            "limelight black box": "limelight-black-box",
            "metropolitan studios": "metropolitan-studios",
            "dynamic el dorado": "dynamic-el-dorado",
            "monk's meadery": "monks-meadery",
            "monks meadery": "monks-meadery",
            "the supermarket black box": "the-supermarket-black-box",
            "the supermarket blue venue": "the-supermarket-blue-venue",
            "the supermarket event stage": "the-supermarket-event-stage",
            "east atlanta kids club": "east-atlanta-kids-club",
        }
        slug = name_to_slug.get(venue_name.lower().strip())
        return _get_venue_id(slug) if slug else primary_venue_id

    # -- Fetch taxonomy lookups
    seasons = _get_seasons()
    venue_tax_map = _get_venue_taxonomy_map()  # term_id -> slug
    genres_tax_map = _get_genres_taxonomy()  # term_id -> (slug, name)

    # -- Detect festival year and dates
    festival_year, festival_start, festival_end = _detect_festival_year_and_dates(
        seasons
    )
    logger.info(
        f"Atlanta Fringe Festival: year={festival_year} "
        f"start={festival_start} end={festival_end}"
    )

    series_hint_base = {
        "series_type": "festival_program",
        "series_title": f"Atlanta Fringe Festival {festival_year}",
        "frequency": "irregular",
    }

    # -- Find the current season ID
    current_season_id = None
    for season in seasons:
        name = season.get("name", "")
        if str(festival_year) in name:
            current_season_id = season.get("id")
            break

    # -- Try WP REST events endpoint
    wp_events = []
    if current_season_id:
        wp_events = _get_all_events_for_season(current_season_id)
        logger.info(f"WP events for season {current_season_id}: {len(wp_events)}")

    # -- BRANCH A: WP show pages exist — scrape per-performance data
    if wp_events:
        for show in wp_events:
            show_title = _html_decode(show.get("title", {}).get("rendered", "")).strip()
            if not show_title:
                continue

            show_url = show.get("link", "")
            if not show_url:
                continue

            # Get featured image
            embedded = show.get("_embedded", {})
            image_url = None
            media_list = embedded.get("wp:featuredmedia", [])
            if media_list:
                image_url = media_list[0].get("source_url")

            # Resolve genre from taxonomy
            genre_ids = show.get("genres", [])
            category = "theater"
            subcategory = "festival"
            if genre_ids:
                slug, name = genres_tax_map.get(genre_ids[0], ("", ""))
                if slug or name:
                    category = _genre_to_category(slug, name)
                    subcategory = _genre_to_subcategory(name)

            # Resolve venue term slugs
            venue_term_ids = show.get("venues", [])
            venue_slug = None
            for vid in venue_term_ids:
                candidate = venue_tax_map.get(vid, "")
                if (
                    candidate
                    and not candidate.endswith("busking-plot")
                    and "busking" not in candidate
                ):
                    venue_slug = candidate
                    break
            db_venue_id = _get_venue_id(venue_slug) if venue_slug else primary_venue_id

            # Description from content
            content_html = show.get("content", {}).get("rendered", "")
            description_raw = BeautifulSoup(content_html, "lxml").get_text(
                separator=" ", strip=True
            )
            description = description_raw[:500] if description_raw else None

            # Scrape the individual show page for performance times
            performances = _scrape_performances_from_page(show_url)

            if not performances:
                # No specific times available — emit one event using festival dates
                start_date = festival_start or f"{festival_year}-05-27"
                content_hash = generate_content_hash(
                    show_title, "Atlanta Fringe Festival", start_date
                )

                events_found += 1
                event_record = _build_event_record(
                    source_id=source_id,
                    venue_id=db_venue_id,
                    title=show_title,
                    description=description,
                    start_date=start_date,
                    start_time=None,
                    end_date=festival_end,
                    price_str="",
                    is_free=None,
                    source_url=show_url,
                    image_url=image_url,
                    category=category,
                    subcategory=subcategory,
                    content_hash=content_hash,
                    festival_year=festival_year,
                )
                events_new, events_updated = _upsert_event(
                    content_hash,
                    event_record,
                    series_hint_base,
                    events_new,
                    events_updated,
                )
                continue

            # Emit one event per performance
            for perf in performances:
                if perf.get("cancelled"):
                    continue

                perf_date = perf["date"]
                perf_time = perf.get("time")
                venue_name = perf.get("venue_name", "")
                price_str = perf.get("price", "")

                # Determine per-performance venue
                if venue_name:
                    perf_venue_id = _get_venue_id_by_name(venue_name)
                else:
                    perf_venue_id = db_venue_id

                price_min, price_max, is_free = _parse_price(price_str)

                # Hash includes time so multiple performances of same show get separate events
                hash_key = f"{perf_date} {perf_time or ''}"
                content_hash = generate_content_hash(
                    show_title, "Atlanta Fringe Festival", hash_key
                )

                events_found += 1
                event_record = _build_event_record(
                    source_id=source_id,
                    venue_id=perf_venue_id,
                    title=show_title,
                    description=description,
                    start_date=perf_date,
                    start_time=perf_time,
                    end_date=None,
                    price_str=price_str,
                    is_free=is_free,
                    source_url=show_url,
                    image_url=image_url,
                    category=category,
                    subcategory=subcategory,
                    content_hash=content_hash,
                    festival_year=festival_year,
                    price_min=price_min,
                    price_max=price_max,
                )
                events_new, events_updated = _upsert_event(
                    content_hash,
                    event_record,
                    series_hint_base,
                    events_new,
                    events_updated,
                )

    # -- BRANCH B: No WP show pages yet — parse homepage lineup
    else:
        logger.info("No WP show pages found — falling back to homepage lineup parsing")
        shows = _parse_homepage_shows()
        logger.info(f"Homepage shows found: {len(shows)}")

        if not shows:
            # No data at all — festival schedule not published yet
            logger.info("No festival schedule published yet — 0 events emitted")
            return 0, 0, 0

        start_date = festival_start or f"{festival_year}-05-27"
        end_date = festival_end or f"{festival_year}-06-07"

        for show in shows:
            title = show["title"]
            if not title:
                continue

            genre_text = show.get("genre", "")
            category, subcategory = (
                _infer_genre_from_text(genre_text)
                if genre_text
                else ("theater", "festival")
            )

            performer = show.get("performer", "")
            origin = show.get("origin", "")
            description_parts = [p for p in [performer, genre_text, origin] if p]
            description = ", ".join(description_parts) if description_parts else None

            content_hash = generate_content_hash(
                title, "Atlanta Fringe Festival", start_date
            )
            events_found += 1

            event_record = _build_event_record(
                source_id=source_id,
                venue_id=primary_venue_id,
                title=title,
                description=description,
                start_date=start_date,
                start_time=None,
                end_date=end_date,
                price_str="",
                is_free=None,
                source_url=f"{BASE_URL}/events/",
                image_url=None,
                category=category,
                subcategory=subcategory,
                content_hash=content_hash,
                festival_year=festival_year,
            )
            events_new, events_updated = _upsert_event(
                content_hash, event_record, series_hint_base, events_new, events_updated
            )

    logger.info(
        f"Atlanta Fringe Festival crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated


# ---------------------------------------------------------------------------
# Shared helpers for event building and upserting
# ---------------------------------------------------------------------------


def _build_event_record(
    *,
    source_id: int,
    venue_id: int,
    title: str,
    description: Optional[str],
    start_date: str,
    start_time: Optional[str],
    end_date: Optional[str],
    price_str: str,
    is_free: Optional[bool],
    source_url: str,
    image_url: Optional[str],
    category: str,
    subcategory: str,
    content_hash: str,
    festival_year: int,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
) -> dict:
    """Assemble a complete event record dict."""
    if is_free is None and price_str:
        price_min, price_max, is_free = _parse_price(price_str)

    tags = [
        "atlanta-fringe",
        "fringe-festival",
        "performing-arts",
        "festival",
        f"fringe-{festival_year}",
    ]
    if subcategory and subcategory not in ("festival", "other"):
        tags.append(subcategory.replace("_", "-"))

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": None,
        "is_all_day": False,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": (
            f"${price_min:.0f}"
            if price_min and not is_free
            else ("Free" if is_free else None)
        ),
        "is_free": is_free,
        "source_url": source_url,
        "ticket_url": source_url,
        "image_url": image_url,
        "raw_text": None,
        "extraction_confidence": 0.90,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def _upsert_event(
    content_hash: str,
    event_record: dict,
    series_hint: dict,
    events_new: int,
    events_updated: int,
) -> tuple[int, int]:
    """Insert or update an event; return updated counters."""
    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        return events_new, events_updated + 1

    try:
        insert_event(event_record, series_hint=series_hint)
        logger.info(f"Added: {event_record['title']} on {event_record['start_date']}")
        return events_new + 1, events_updated
    except Exception as exc:
        logger.error(f"Failed to insert {event_record['title']}: {exc}")
        return events_new, events_updated
