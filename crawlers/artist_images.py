"""
Artist image fetching utility for music events.
Automatically fetches artist images from Last.fm for music events missing an image.
"""

from __future__ import annotations

import re
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

# Cache for artist images to avoid duplicate API calls
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


def fetch_artist_image(artist_name: str) -> Optional[str]:
    """
    Fetch artist image URL from Deezer (no API key required).

    Args:
        artist_name: Artist name to search for

    Returns:
        Image URL or None if not found
    """
    # Check cache first
    cache_key = artist_name.lower()
    if cache_key in _image_cache:
        return _image_cache[cache_key]

    image_url = None

    try:
        # Search for artist on Deezer (no auth required)
        response = requests.get(
            "https://api.deezer.com/search/artist",
            params={
                "q": artist_name,
                "limit": 1
            },
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            artists = data.get("data", [])

            if artists:
                # Deezer provides multiple image sizes:
                # picture_small (56x56), picture (126x126),
                # picture_medium (250x250), picture_big (500x500),
                # picture_xl (1000x1000)
                artist = artists[0]

                # Prefer big or xl size
                image_url = artist.get("picture_xl") or artist.get("picture_big") or artist.get("picture_medium")

                if image_url:
                    logger.debug(f"Found Deezer image for '{artist_name}'")

    except Exception as e:
        logger.debug(f"Error fetching Deezer image for '{artist_name}': {e}")

    # Cache the result (even if None)
    _image_cache[cache_key] = image_url
    return image_url


def get_image_for_music_event(title: str, existing_image: Optional[str] = None) -> Optional[str]:
    """
    Get an artist image for a music event if one isn't already provided.

    Args:
        title: The event title (will be parsed to extract artist name)
        existing_image: Existing image URL, if any

    Returns:
        Image URL (existing or fetched) or None
    """
    # If already has an image, use it
    if existing_image:
        return existing_image

    # Try to extract artist and fetch image
    artist_name = extract_artist_from_title(title)

    if artist_name:
        return fetch_artist_image(artist_name)

    return None


def clear_cache():
    """Clear the image cache (useful for testing)."""
    global _image_cache
    _image_cache = {}
