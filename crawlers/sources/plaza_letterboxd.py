"""
Letterboxd RSS enrichment for Plaza Theatre.

Fetches movie metadata from Plaza Theatre's Letterboxd RSS feed to enrich events:
- TMDB movie IDs for cross-referencing
- High-quality poster images
- Special event details (trivia nights, art shows, 35mm screenings)

Usage:
    from sources.plaza_letterboxd import get_letterboxd_movies, enrich_movie_data

    # Get all movies from RSS
    movies = get_letterboxd_movies()

    # Enrich a movie by title
    enriched = enrich_movie_data("Alien", movies)
    # Returns: {"tmdb_id": 348, "image_url": "...", "year": 1979, "special_event": "35mm"}
"""

from __future__ import annotations

import re
import logging
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError

logger = logging.getLogger(__name__)

LETTERBOXD_RSS_URL = "https://letterboxd.com/plazaatlanta/rss/"

# Namespaces used in Letterboxd RSS
NAMESPACES = {
    "letterboxd": "https://letterboxd.com",
    "tmdb": "https://themoviedb.org",
    "dc": "http://purl.org/dc/elements/1.1/",
}


def fetch_rss() -> Optional[str]:
    """Fetch the Letterboxd RSS feed."""
    try:
        req = Request(
            LETTERBOXD_RSS_URL,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"}
        )
        with urlopen(req, timeout=15) as response:
            return response.read().decode("utf-8")
    except URLError as e:
        logger.error(f"Failed to fetch Letterboxd RSS: {e}")
        return None
    except Exception as e:
        logger.error(f"RSS fetch error: {e}")
        return None


def parse_rss(xml_content: str) -> list[dict]:
    """Parse Letterboxd RSS into movie entries."""
    movies = []

    try:
        # Register namespaces
        for prefix, uri in NAMESPACES.items():
            ET.register_namespace(prefix, uri)

        root = ET.fromstring(xml_content)

        for item in root.findall(".//item"):
            movie = parse_item(item)
            if movie:
                movies.append(movie)

    except ET.ParseError as e:
        logger.error(f"RSS parse error: {e}")

    return movies


def parse_item(item: ET.Element) -> Optional[dict]:
    """Parse a single RSS item into movie data."""
    try:
        # Get film title and year from letterboxd namespace
        film_title_el = item.find("letterboxd:filmTitle", NAMESPACES)
        film_year_el = item.find("letterboxd:filmYear", NAMESPACES)
        tmdb_id_el = item.find("tmdb:movieId", NAMESPACES)

        if film_title_el is None:
            return None

        title = film_title_el.text.strip() if film_title_el.text else None
        if not title:
            return None

        movie = {
            "title": title,
            "year": int(film_year_el.text) if film_year_el is not None and film_year_el.text else None,
            "tmdb_id": int(tmdb_id_el.text) if tmdb_id_el is not None and tmdb_id_el.text else None,
            "image_url": None,
            "special_event": None,
            "event_dates": [],
            "ticket_url": None,
        }

        # Get description for event details
        desc_el = item.find("description")
        if desc_el is not None and desc_el.text:
            desc = desc_el.text

            # Extract dates from description
            # Format: "WED, FEB 4, 2026" or "Starts January 30, 2026"
            date_patterns = [
                r"(?:MON|TUE|WED|THU|FRI|SAT|SUN),?\s+([A-Z]{3})\s+(\d{1,2}),?\s+(\d{4})",
                r"Starts?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})",
            ]
            for pattern in date_patterns:
                for match in re.finditer(pattern, desc, re.IGNORECASE):
                    try:
                        month_str, day, year = match.groups()
                        # Parse month
                        month_map = {
                            "jan": 1, "feb": 2, "mar": 3, "apr": 4,
                            "may": 5, "jun": 6, "jul": 7, "aug": 8,
                            "sep": 9, "oct": 10, "nov": 11, "dec": 12,
                            "january": 1, "february": 2, "march": 3, "april": 4,
                            "june": 6, "july": 7, "august": 8,
                            "september": 9, "october": 10, "november": 11, "december": 12,
                        }
                        month = month_map.get(month_str.lower()[:3], 0)
                        if month:
                            date = datetime(int(year), month, int(day)).strftime("%Y-%m-%d")
                            if date not in movie["event_dates"]:
                                movie["event_dates"].append(date)
                    except (ValueError, KeyError):
                        continue

            # Detect special event types
            special_markers = [
                (r"35mm", "35mm"),
                (r"70mm", "70mm"),
                (r"trivia", "trivia"),
                (r"art show", "art_show"),
                (r"q\s*&\s*a", "qa"),
                (r"sing[- ]?along", "singalong"),
                (r"marathon", "marathon"),
                (r"double feature", "double_feature"),
            ]
            for pattern, event_type in special_markers:
                if re.search(pattern, desc, re.IGNORECASE):
                    movie["special_event"] = event_type
                    break

        # Get image from description (img tag) or enclosure
        if desc_el is not None and desc_el.text:
            img_match = re.search(r'<img[^>]+src="([^"]+)"', desc_el.text)
            if img_match:
                movie["image_url"] = img_match.group(1)

        # Fallback to enclosure
        if not movie["image_url"]:
            enclosure = item.find("enclosure")
            if enclosure is not None:
                movie["image_url"] = enclosure.get("url")

        # Get ticket URL from description links.
        # Plaza commonly uses /movie/* URLs that do not include "tickets" in the path.
        if desc_el is not None and desc_el.text:
            # Prefer anchors explicitly labeled as a ticket purchase action.
            purchase_match = re.search(
                r'(?:Purchase|Buy)\s+tickets[^<]*<a[^>]+href="(https?://[^"]+)"',
                desc_el.text,
                re.IGNORECASE
            )
            if purchase_match:
                movie["ticket_url"] = purchase_match.group(1)
            else:
                # Fallback for known ticketing providers and legacy patterns.
                ticket_match = re.search(
                    r'href="(https?://[^"]*(?:tickets|eventbrite|veeps|ticketmaster|axs|dice\.fm)[^"]*)"',
                    desc_el.text,
                    re.IGNORECASE
                )
                if ticket_match:
                    movie["ticket_url"] = ticket_match.group(1)

        return movie

    except Exception as e:
        logger.debug(f"Error parsing RSS item: {e}")
        return None


def get_letterboxd_movies() -> list[dict]:
    """Fetch and parse all movies from Letterboxd RSS."""
    xml_content = fetch_rss()
    if not xml_content:
        return []

    movies = parse_rss(xml_content)
    logger.info(f"Fetched {len(movies)} movies from Letterboxd RSS")
    return movies


def normalize_title(title: str) -> str:
    """Normalize a movie title for matching."""
    # Remove year suffix like "(2025)"
    title = re.sub(r'\s*\(\d{4}\)\s*$', '', title)
    # Remove format indicators
    title = re.sub(r'\s*\((?:2K|35mm|70mm)\)\s*$', '', title, flags=re.IGNORECASE)
    # Lowercase and strip
    return title.lower().strip()


def enrich_movie_data(movie_title: str, letterboxd_movies: list[dict]) -> Optional[dict]:
    """
    Find and return enrichment data for a movie title.

    Returns dict with: tmdb_id, image_url, year, special_event, ticket_url
    """
    if not letterboxd_movies:
        return None

    normalized_query = normalize_title(movie_title)

    for movie in letterboxd_movies:
        normalized_lb = normalize_title(movie["title"])

        # Exact match
        if normalized_query == normalized_lb:
            return {
                "tmdb_id": movie.get("tmdb_id"),
                "image_url": movie.get("image_url"),
                "year": movie.get("year"),
                "special_event": movie.get("special_event"),
                "ticket_url": movie.get("ticket_url"),
            }

        # Partial match (one contains the other)
        if normalized_query in normalized_lb or normalized_lb in normalized_query:
            return {
                "tmdb_id": movie.get("tmdb_id"),
                "image_url": movie.get("image_url"),
                "year": movie.get("year"),
                "special_event": movie.get("special_event"),
                "ticket_url": movie.get("ticket_url"),
            }

    return None


def get_special_events(letterboxd_movies: list[dict]) -> list[dict]:
    """Get movies marked as special events (trivia, 35mm, etc.)."""
    return [m for m in letterboxd_movies if m.get("special_event")]


if __name__ == "__main__":
    # Test the module
    logging.basicConfig(level=logging.INFO)

    movies = get_letterboxd_movies()
    print(f"\nFound {len(movies)} movies:\n")

    for movie in movies[:10]:
        print(f"  {movie['title']} ({movie.get('year', '?')})")
        if movie.get("tmdb_id"):
            print(f"    TMDB: {movie['tmdb_id']}")
        if movie.get("special_event"):
            print(f"    Special: {movie['special_event']}")
        if movie.get("event_dates"):
            print(f"    Dates: {', '.join(movie['event_dates'])}")
        print()

    # Test enrichment
    print("\nEnrichment test:")
    test_titles = ["Alien", "Arco", "Dracula", "Two Sleepy People"]
    for title in test_titles:
        enriched = enrich_movie_data(title, movies)
        if enriched:
            print(f"  {title}: TMDB={enriched.get('tmdb_id')}, special={enriched.get('special_event')}")
        else:
            print(f"  {title}: No match")
