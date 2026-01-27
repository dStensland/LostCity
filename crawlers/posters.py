"""
Movie poster fetching utility for film events.
Automatically fetches posters from OMDB for any film event missing an image.
"""

from __future__ import annotations

import re
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

# Cache to avoid duplicate API calls in the same session
_poster_cache: dict[str, Optional[str]] = {}


def extract_film_info(title: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract film title and year from an event title.

    Examples:
        "WeWatchStuff: Paper Moon (1973)" -> ("Paper Moon", "1973")
        "Plaza Theatre: Blade Runner (1982) - Director's Cut" -> ("Blade Runner", "1982")
        "The Godfather (1972)" -> ("The Godfather", "1972")
        "Movie Night: Jaws" -> ("Jaws", None)
        "Casablanca" -> ("Casablanca", None)

    Returns:
        Tuple of (film_title, year) - year may be None
    """
    # Remove common prefixes
    prefixes_to_remove = [
        r'^WeWatchStuff:\s*',
        r'^Plaza Theatre:\s*',
        r'^Tara Theatre:\s*',
        r'^Landmark[^:]*:\s*',
        r'^Movie Night:\s*',
        r'^Film Screening:\s*',
        r'^[A-Z][a-z]+ Film Festival[^:]*:\s*',
        r'^Atlanta Film Festival[^:]*:\s*',
        r'^Classic Film:\s*',
        r'^Special Screening:\s*',
    ]

    cleaned = title
    for prefix in prefixes_to_remove:
        cleaned = re.sub(prefix, '', cleaned, flags=re.IGNORECASE)

    # Remove format indicators in parentheses: (2K), (4K), (35MM), (70MM), (Digital), etc.
    cleaned = re.sub(r'\s*\((?:2K|4K|35MM|70MM|Digital|DCP|Restored|New Restoration)\)\s*', ' ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*\((?:\d+)(?:mm|k)\s*(?:\+\s*Digital)?\)\s*', ' ', cleaned, flags=re.IGNORECASE)

    # Extract year in parentheses
    year_match = re.search(r'\((\d{4})\)', cleaned)
    year = year_match.group(1) if year_match else None

    # Remove year and anything after it (like "- Director's Cut")
    if year_match:
        film_title = cleaned[:year_match.start()].strip()
    else:
        # Remove common suffixes
        film_title = re.sub(r'\s*[-–—]\s*(Director\'s Cut|Extended|Remastered|Anniversary|Special).*$', '', cleaned, flags=re.IGNORECASE)
        film_title = film_title.strip()

    # Clean up any remaining artifacts
    film_title = re.sub(r'\s+', ' ', film_title).strip()

    if not film_title or len(film_title) < 2:
        return None, None

    return film_title, year


def fetch_movie_poster(title: str, year: Optional[str] = None) -> Optional[str]:
    """
    Fetch movie poster URL from OMDB (Open Movie Database).

    Args:
        title: Movie title
        year: Optional release year to improve search accuracy

    Returns:
        Poster URL or None if not found
    """
    # Check cache first
    cache_key = f"{title}|{year or ''}"
    if cache_key in _poster_cache:
        return _poster_cache[cache_key]

    poster_url = None

    try:
        # OMDB API with free "trilogy" API key
        search_query = title.replace(" ", "+")
        if year:
            omdb_url = f"https://www.omdbapi.com/?t={search_query}&y={year}&apikey=trilogy"
        else:
            omdb_url = f"https://www.omdbapi.com/?t={search_query}&apikey=trilogy"

        response = requests.get(omdb_url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get("Response") == "True":
                poster = data.get("Poster")
                if poster and poster != "N/A":
                    poster_url = poster
                    logger.debug(f"Found poster for '{title}': {poster_url}")

    except Exception as e:
        logger.debug(f"Error fetching poster for '{title}': {e}")

    # Cache the result (even if None, to avoid repeated failed lookups)
    _poster_cache[cache_key] = poster_url

    return poster_url


def get_poster_for_film_event(title: str, existing_image: Optional[str] = None) -> Optional[str]:
    """
    Get a poster for a film event if one isn't already provided.

    Args:
        title: The event title (will be parsed to extract film info)
        existing_image: Existing image URL, if any

    Returns:
        Poster URL (existing or fetched) or None
    """
    # If already has an image, use it
    if existing_image:
        return existing_image

    # Try to extract film info and fetch poster
    film_title, year = extract_film_info(title)

    if film_title:
        return fetch_movie_poster(film_title, year)

    return None


def clear_cache():
    """Clear the poster cache (useful for testing)."""
    global _poster_cache
    _poster_cache = {}
