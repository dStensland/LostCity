"""
Movie poster and metadata fetching utility for film events.
Automatically fetches posters and metadata from OMDB for film events.
"""

from __future__ import annotations

import re
import logging
import requests
from typing import Optional
from dataclasses import dataclass

from config import get_config

logger = logging.getLogger(__name__)

# Cache to avoid duplicate API calls in the same session
_poster_cache: dict[str, Optional[str]] = {}


@dataclass
class FilmMetadata:
    """Film metadata from OMDB."""
    title: str
    poster_url: str | None = None
    director: str | None = None
    runtime_minutes: int | None = None
    year: int | None = None
    rating: str | None = None          # "PG-13", "R"
    imdb_id: str | None = None
    genres: list[str] | None = None    # ["drama", "thriller"]
    plot: str | None = None            # -> series.description


_metadata_cache: dict[str, Optional[FilmMetadata]] = {}


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


def _parse_runtime(runtime_str: str | None) -> int | None:
    """Parse OMDB runtime string like '148 min' to integer minutes."""
    if not runtime_str or runtime_str == "N/A":
        return None
    match = re.match(r'(\d+)', runtime_str)
    return int(match.group(1)) if match else None


def _parse_genres(genre_str: str | None) -> list[str] | None:
    """Parse OMDB genre string like 'Drama, Sci-Fi' to lowercase list."""
    if not genre_str or genre_str == "N/A":
        return None
    return [g.strip().lower() for g in genre_str.split(",") if g.strip()]


def _clean_na(value: str | None) -> str | None:
    """Return None if OMDB value is 'N/A'."""
    if not value or value == "N/A":
        return None
    return value


def fetch_film_metadata(title: str, year: Optional[str] = None) -> Optional[FilmMetadata]:
    """
    Fetch full film metadata from OMDB (Open Movie Database).

    Args:
        title: Movie title
        year: Optional release year to improve search accuracy

    Returns:
        FilmMetadata or None if not found
    """
    cache_key = f"{title}|{year or ''}"
    if cache_key in _metadata_cache:
        return _metadata_cache[cache_key]

    metadata = None

    try:
        api_key = get_config().api.omdb_api_key
        search_query = title.replace(" ", "+")
        if year:
            omdb_url = f"https://www.omdbapi.com/?t={search_query}&y={year}&apikey={api_key}"
        else:
            omdb_url = f"https://www.omdbapi.com/?t={search_query}&apikey={api_key}"

        response = requests.get(omdb_url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get("Response") == "True":
                poster_url = _clean_na(data.get("Poster"))
                year_val = None
                if _clean_na(data.get("Year")):
                    # Year can be "2024" or "2024–2025" for series
                    year_match = re.match(r'(\d{4})', data["Year"])
                    if year_match:
                        year_val = int(year_match.group(1))

                metadata = FilmMetadata(
                    title=data.get("Title", title),
                    poster_url=poster_url,
                    director=_clean_na(data.get("Director")),
                    runtime_minutes=_parse_runtime(data.get("Runtime")),
                    year=year_val,
                    rating=_clean_na(data.get("Rated")),
                    imdb_id=_clean_na(data.get("imdbID")),
                    genres=_parse_genres(data.get("Genre")),
                    plot=_clean_na(data.get("Plot")),
                )
                logger.debug(f"Found OMDB metadata for '{title}': director={metadata.director}, year={metadata.year}")

                # Also populate poster cache for backward compat
                _poster_cache[cache_key] = poster_url

    except Exception as e:
        logger.debug(f"Error fetching metadata for '{title}': {e}")

    # Cache the result (even if None)
    _metadata_cache[cache_key] = metadata
    return metadata


def fetch_movie_poster(title: str, year: Optional[str] = None) -> Optional[str]:
    """
    Fetch movie poster URL from OMDB (Open Movie Database).
    Delegates to fetch_film_metadata() and returns just the poster URL.

    Args:
        title: Movie title
        year: Optional release year to improve search accuracy

    Returns:
        Poster URL or None if not found
    """
    # Check poster cache first (may have been populated by fetch_film_metadata)
    cache_key = f"{title}|{year or ''}"
    if cache_key in _poster_cache:
        return _poster_cache[cache_key]

    metadata = fetch_film_metadata(title, year)
    if metadata:
        return metadata.poster_url

    # Cache None in poster cache too
    _poster_cache[cache_key] = None
    return None


def get_metadata_for_film_event(title: str, existing_image: Optional[str] = None) -> Optional[FilmMetadata]:
    """
    Get full metadata for a film event.

    Args:
        title: The event title (will be parsed to extract film info)
        existing_image: Existing image URL, if any

    Returns:
        FilmMetadata with poster preserved from existing_image if provided, or None
    """
    film_title, year = extract_film_info(title)

    if not film_title:
        return None

    metadata = fetch_film_metadata(film_title, year)

    if metadata and existing_image:
        # Preserve existing image — don't overwrite with OMDB poster
        metadata.poster_url = existing_image

    return metadata


def get_poster_for_film_event(title: str, existing_image: Optional[str] = None) -> Optional[str]:
    """
    Get a poster for a film event if one isn't already provided.
    Legacy wrapper — callers that only need poster URL.

    Args:
        title: The event title (will be parsed to extract film info)
        existing_image: Existing image URL, if any

    Returns:
        Poster URL (existing or fetched) or None
    """
    if existing_image:
        return existing_image

    film_title, year = extract_film_info(title)

    if film_title:
        return fetch_movie_poster(film_title, year)

    return None


def clear_cache():
    """Clear all caches (useful for testing)."""
    global _poster_cache, _metadata_cache
    _poster_cache = {}
    _metadata_cache = {}
