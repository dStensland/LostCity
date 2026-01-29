"""
Artist info fetching utility for music events.
Automatically fetches artist images and genres from Deezer for music events.
"""

from __future__ import annotations

import re
import logging
import requests
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ArtistInfo:
    """Artist information from Deezer."""
    name: str
    image_url: Optional[str] = None
    genres: Optional[list[str]] = None
    deezer_id: Optional[int] = None


# Cache for artist info to avoid duplicate API calls
_artist_cache: dict[str, Optional[ArtistInfo]] = {}

# Legacy cache for backwards compatibility
_image_cache: dict[str, Optional[str]] = {}


def extract_artist_from_title(title: str) -> Optional[str]:
    """
    Extract artist name from an event title.

    Common patterns:
    - "Artist Name" (just the artist)
    - "Artist Name at Venue"
    - "Artist Name with Special Guest"
    - "Artist Name: Tour Name"
    - "Artist Name - Tour Name"
    - "Artist Name w/ Opening Act"
    - "Artist Name Live"
    - "An Evening with Artist Name"

    Returns:
        Artist name or None if can't extract
    """
    if not title:
        return None

    cleaned = title.strip()

    # Remove "An Evening with" prefix
    cleaned = re.sub(r'^An Evening [Ww]ith\s+', '', cleaned)

    # Remove "SOLD OUT" prefix/suffix
    cleaned = re.sub(r'\bSOLD OUT\b\s*[-:]*\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*[-:]*\s*\bSOLD OUT\b', '', cleaned, flags=re.IGNORECASE)

    # Remove "POSTPONED", "CANCELLED", "RESCHEDULED" markers
    cleaned = re.sub(r'\b(POSTPONED|CANCELLED|CANCELED|RESCHEDULED)\b\s*[-:]*\s*', '', cleaned, flags=re.IGNORECASE)

    # Remove "Live at/in [Venue]" suffix
    cleaned = re.sub(r'\s+[Ll]ive\s+(?:at|in)\s+.*$', '', cleaned)

    # Remove "at [Venue]" suffix (but be careful not to catch artist names with "at")
    cleaned = re.sub(r'\s+at\s+(?:The\s+)?[A-Z][^,]+$', '', cleaned)

    # Split on common delimiters and take the first part (usually the headliner)
    # Order matters - check more specific patterns first
    delimiters = [
        r'\s+w/\s+',           # "w/" for with
        r'\s+with\s+',         # "with"
        r'\s+featuring\s+',    # "featuring"
        r'\s+ft\.?\s+',        # "ft" or "ft."
        r'\s+feat\.?\s+',      # "feat" or "feat."
        r'\s*[,&]\s+',         # comma or ampersand (multiple artists)
        r'\s*[-–—]\s+',        # dash variants (tour name or support)
        r':\s+',               # colon (tour name)
        r'\s+\+\s+',           # plus sign
        r'\s*[|]\s*',          # pipe
    ]

    for delimiter in delimiters:
        parts = re.split(delimiter, cleaned, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) > 1:
            cleaned = parts[0].strip()
            break

    # Remove trailing "Live" or "Live!"
    cleaned = re.sub(r'\s+[Ll]ive!?$', '', cleaned)

    # Remove year in parentheses
    cleaned = re.sub(r'\s*\(\d{4}\)\s*$', '', cleaned)

    # Remove tour names in parentheses
    cleaned = re.sub(r'\s*\([^)]*[Tt]our[^)]*\)\s*$', '', cleaned)

    # Clean up whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Validate: should be at least 2 characters and not just numbers
    if len(cleaned) < 2 or cleaned.isdigit():
        return None

    return cleaned


def fetch_artist_info(artist_name: str) -> Optional[ArtistInfo]:
    """
    Fetch artist info (image and genres) from Deezer (no API key required).

    Args:
        artist_name: Artist name to search for

    Returns:
        ArtistInfo with image URL and genres, or None if not found
    """
    # Check cache first
    cache_key = artist_name.lower()
    if cache_key in _artist_cache:
        return _artist_cache[cache_key]

    artist_info = None

    try:
        # Step 1: Search for artist on Deezer
        response = requests.get(
            "https://api.deezer.com/search/artist",
            params={"q": artist_name, "limit": 1},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            artists = data.get("data", [])

            if artists:
                artist = artists[0]
                deezer_id = artist.get("id")

                # Get image (prefer big or xl size)
                image_url = (
                    artist.get("picture_xl") or
                    artist.get("picture_big") or
                    artist.get("picture_medium")
                )

                artist_info = ArtistInfo(
                    name=artist.get("name", artist_name),
                    image_url=image_url,
                    deezer_id=deezer_id,
                    genres=None
                )

                # Step 2: Try to get genres from top track's album
                if deezer_id:
                    try:
                        top_response = requests.get(
                            f"https://api.deezer.com/artist/{deezer_id}/top",
                            params={"limit": 1},
                            timeout=10
                        )

                        if top_response.status_code == 200:
                            top_data = top_response.json()
                            tracks = top_data.get("data", [])

                            if tracks and tracks[0].get("album"):
                                album_id = tracks[0]["album"].get("id")

                                if album_id:
                                    # Step 3: Get album details for genre
                                    album_response = requests.get(
                                        f"https://api.deezer.com/album/{album_id}",
                                        timeout=10
                                    )

                                    if album_response.status_code == 200:
                                        album_data = album_response.json()
                                        genres_data = album_data.get("genres", {}).get("data", [])

                                        if genres_data:
                                            artist_info.genres = [
                                                g.get("name") for g in genres_data
                                                if g.get("name")
                                            ]
                                            logger.debug(
                                                f"Found genres for '{artist_name}': {artist_info.genres}"
                                            )

                    except Exception as e:
                        logger.debug(f"Error fetching genres for '{artist_name}': {e}")

                if image_url:
                    logger.debug(f"Found Deezer image for '{artist_name}'")

    except Exception as e:
        logger.debug(f"Error fetching Deezer info for '{artist_name}': {e}")

    # Cache the result (even if None)
    _artist_cache[cache_key] = artist_info

    # Also update legacy image cache for backwards compatibility
    if artist_info:
        _image_cache[cache_key] = artist_info.image_url

    return artist_info


def fetch_artist_image(artist_name: str) -> Optional[str]:
    """
    Fetch artist image URL from Deezer (no API key required).
    This is a convenience wrapper around fetch_artist_info for backwards compatibility.

    Args:
        artist_name: Artist name to search for

    Returns:
        Image URL or None if not found
    """
    # Check legacy cache first
    cache_key = artist_name.lower()
    if cache_key in _image_cache:
        return _image_cache[cache_key]

    info = fetch_artist_info(artist_name)
    return info.image_url if info else None


@dataclass
class MusicEventInfo:
    """Enhanced info for a music event."""
    image_url: Optional[str] = None
    genres: Optional[list[str]] = None
    artist_name: Optional[str] = None


def get_info_for_music_event(
    title: str,
    existing_image: Optional[str] = None,
    existing_genres: Optional[list[str]] = None
) -> MusicEventInfo:
    """
    Get artist image and genres for a music event.

    Args:
        title: The event title (will be parsed to extract artist name)
        existing_image: Existing image URL, if any
        existing_genres: Existing genres, if any

    Returns:
        MusicEventInfo with image URL and genres
    """
    result = MusicEventInfo(
        image_url=existing_image,
        genres=existing_genres
    )

    # If we already have both, return early
    if existing_image and existing_genres:
        return result

    # Try to extract artist and fetch info
    artist_name = extract_artist_from_title(title)
    result.artist_name = artist_name

    if artist_name:
        info = fetch_artist_info(artist_name)

        if info:
            # Only update what's missing
            if not result.image_url:
                result.image_url = info.image_url
            if not result.genres and info.genres:
                result.genres = info.genres

    return result


def get_image_for_music_event(title: str, existing_image: Optional[str] = None) -> Optional[str]:
    """
    Get an artist image for a music event if one isn't already provided.
    This is a convenience wrapper for backwards compatibility.

    Args:
        title: The event title (will be parsed to extract artist name)
        existing_image: Existing image URL, if any

    Returns:
        Image URL (existing or fetched) or None
    """
    info = get_info_for_music_event(title, existing_image)
    return info.image_url


def clear_cache():
    """Clear the caches (useful for testing)."""
    global _image_cache, _artist_cache
    _image_cache = {}
    _artist_cache = {}
