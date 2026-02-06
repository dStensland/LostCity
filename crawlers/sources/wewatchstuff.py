"""
Crawler for WeWatchStuff (linktr.ee/wewatchstuff).
Atlanta community film screening club - free monthly screenings of underrated films.
Parses Linktree page for event links with date patterns.
Fetches movie posters from TMDB for film events.
"""

from __future__ import annotations

import re
import logging
import requests
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

# TMDB API for movie posters (free tier, no key required for basic search)
TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0YjYyNTI2YjU4MTU3MjNjNGVhMjc2MWQ3NmZlMGJhYyIsInN1YiI6IjY1ZjJmMjZkMDdlMjgxMDE2M2IwZjJhYyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.PLACEHOLDER"


def fetch_movie_poster(title: str, year: Optional[str] = None) -> Optional[str]:
    """
    Fetch movie poster URL from TMDB.

    Args:
        title: Movie title
        year: Optional release year to improve search accuracy

    Returns:
        Poster URL or None if not found
    """
    try:
        # Use TMDB search API
        search_url = "https://api.themoviedb.org/3/search/movie"
        params = {
            "query": title,
            "include_adult": "false",
            "language": "en-US",
            "page": "1",
        }
        if year:
            params["year"] = year

        headers = {
            "accept": "application/json",
        }

        # Try without API key first (some endpoints work)
        response = requests.get(search_url, params=params, headers=headers, timeout=10)

        if response.status_code == 401:
            # Need API key - try OMDB instead (truly free)
            return fetch_movie_poster_omdb(title, year)

        if response.status_code == 200:
            data = response.json()
            if data.get("results") and len(data["results"]) > 0:
                poster_path = data["results"][0].get("poster_path")
                if poster_path:
                    return f"https://image.tmdb.org/t/p/w500{poster_path}"

        # Fallback to OMDB
        return fetch_movie_poster_omdb(title, year)

    except Exception as e:
        logger.debug(f"Error fetching poster from TMDB for '{title}': {e}")
        return fetch_movie_poster_omdb(title, year)


def fetch_movie_poster_omdb(title: str, year: Optional[str] = None) -> Optional[str]:
    """
    Fetch movie poster URL from OMDB (Open Movie Database).
    Uses free tier which doesn't require API key for poster URLs.

    Args:
        title: Movie title
        year: Optional release year

    Returns:
        Poster URL or None if not found
    """
    try:
        # OMDB API - free tier with limited requests
        # We'll use the poster redirect which doesn't need a key
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
                    return poster

        return None

    except Exception as e:
        logger.debug(f"Error fetching poster from OMDB for '{title}': {e}")
        return None

BASE_URL = "https://linktr.ee/wewatchstuff"

# WeWatchStuff organization venue
ORG_VENUE_DATA = {
    "name": "WeWatchStuff",
    "slug": "wewatchstuff",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
}

# Encyclomedia - where they typically host screenings
SCREENING_VENUE_DATA = {
    "name": "Encyclomedia",
    "slug": "encyclomedia",
    "address": "1526 DeKalb Ave NE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "neighborhood": "Candler Park",
    "venue_type": "studio",
    "spot_type": "arts",
    "website": "https://encyclomedia.net",
    "lat": 33.7550,
    "lng": -84.3380,
}


def parse_linktree_date(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date from Linktree link title.

    Patterns:
    - "01/31 Paper Moon (1973)" -> date is 01/31
    - "1/31 Movie Title" -> date is 1/31
    - "Jan 31 Movie Title" -> date is Jan 31
    """
    current_year = datetime.now().year

    # Pattern: MM/DD at start of string
    match = re.match(r'^(\d{1,2})/(\d{1,2})\s+', text)
    if match:
        month = int(match.group(1))
        day = int(match.group(2))
        try:
            # Assume current year, but if date is in the past, use next year
            dt = datetime(current_year, month, day)
            if dt.date() < datetime.now().date():
                dt = datetime(current_year + 1, month, day)
            return dt.strftime("%Y-%m-%d"), match.group(0).strip()
        except ValueError:
            pass

    # Pattern: Month DD at start
    match = re.match(r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})', text, re.IGNORECASE)
    if match:
        month_str = match.group(1)
        day = int(match.group(2))
        try:
            dt = datetime.strptime(f"{month_str} {day} {current_year}", "%b %d %Y")
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d"), match.group(0).strip()
        except ValueError:
            pass

    return None, None


def parse_film_title(text: str, date_prefix: Optional[str]) -> tuple[str, Optional[str]]:
    """
    Extract film title and year from link text.

    Example: "01/31 Paper Moon (1973)" -> ("Paper Moon", "1973")
    """
    # Remove date prefix if present
    if date_prefix:
        text = text.replace(date_prefix, "").strip()

    # Extract year in parentheses at the end
    year_match = re.search(r'\((\d{4})\)\s*$', text)
    year = None
    if year_match:
        year = year_match.group(1)
        text = text[:year_match.start()].strip()

    return text, year


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl WeWatchStuff Linktree for film screening events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get or create venues
            org_venue_id = get_or_create_venue(ORG_VENUE_DATA)
            screening_venue_id = get_or_create_venue(SCREENING_VENUE_DATA)

            logger.info(f"Fetching WeWatchStuff Linktree: {BASE_URL}")

            # Navigate to Linktree page
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)

            # Wait for links to load
            try:
                page.wait_for_selector('a[data-testid="LinkButton"]', timeout=10000)
            except Exception:
                # Try alternative selectors
                try:
                    page.wait_for_selector('a[href]', timeout=5000)
                except Exception:
                    logger.warning("Could not find link selectors, continuing anyway")

            # Extract all links from Linktree
            links = page.query_selector_all('a[data-testid="LinkButton"], a[href*="forms.gle"], a[href*="google.com/forms"]')

            # Also try to get links by looking at the page structure
            if not links:
                links = page.query_selector_all('a')

            logger.info(f"Found {len(links)} links on Linktree")

            for link in links:
                try:
                    href = link.get_attribute('href') or ''
                    text = link.inner_text().strip()

                    # Skip empty, navigation, or social links
                    if not text or len(text) < 3:
                        continue
                    if 'instagram.com' in href or 'twitter.com' in href:
                        continue
                    if text.lower() in ['about us', 'stuff we watched', 'instagram', 'email']:
                        continue

                    # Try to parse date from link text
                    start_date, date_prefix = parse_linktree_date(text)

                    if not start_date:
                        # Not an event link, skip
                        logger.debug(f"Skipping non-event link: {text}")
                        continue

                    events_found += 1

                    # Parse film title and year
                    film_title, film_year = parse_film_title(text, date_prefix)

                    if not film_title:
                        film_title = text

                    # Build event title
                    if film_year:
                        title = f"WeWatchStuff: {film_title} ({film_year})"
                    else:
                        title = f"WeWatchStuff: {film_title}"

                    # Build description
                    description = f"Free community film screening of {film_title}"
                    if film_year:
                        description += f" ({film_year})"
                    description += ". WeWatchStuff is a community-driven micro-cinema social club showcasing underrated and overlooked films. All screenings are free."

                    # Generate content hash
                    content_hash = generate_content_hash(title, SCREENING_VENUE_DATA["name"], start_date)

                    # Check if exists
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        logger.debug(f"Event already exists: {title}")
                        continue

                    # Fetch movie poster
                    poster_url = fetch_movie_poster(film_title, film_year)
                    if poster_url:
                        logger.info(f"Found poster for '{film_title}': {poster_url}")

                    # Build event record
                    # Use Encyclomedia as the screening venue
                    # Get specific event URL

                    event_url = find_event_url(title, event_links, EVENTS_URL)


                    event_record = {
                        "source_id": source_id,
                        "venue_id": screening_venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": None,  # Time usually announced closer to event
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "film",
                        "subcategory": "screening",
                        "tags": ["film", "free", "community", "screening", "wewatchstuff", "candler-park"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free",
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": href if 'forms' in href else None,
                        "image_url": poster_url,
                        "raw_text": text,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.debug(f"Error processing link: {e}")
                    continue

            browser.close()

        logger.info(
            f"WeWatchStuff crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl WeWatchStuff: {e}")
        raise

    return events_found, events_new, events_updated
