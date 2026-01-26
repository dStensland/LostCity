"""
Crawler for Horizon Theatre Company (horizontheatre.com).
Intimate theater in Little Five Points known for contemporary plays and world premieres.

Site structure: Shows listed at /plays/ with individual show pages at /plays/[slug]/
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.horizontheatre.com"
PLAYS_URL = f"{BASE_URL}/plays/"

VENUE_DATA = {
    "name": "Horizon Theatre",
    "slug": "horizon-theatre",
    "address": "1083 Austin Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7645,
    "lng": -84.3485,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

# Words that indicate this is not a real show title
SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|sign up|register|account|my account)$",
    r"^(facebook|twitter|instagram|youtube|social)$",
    r"^(privacy|terms|policy|copyright|\d{4})$",
    r"^(season \d|our season|this season)$",
    r"^\d+$",  # Just numbers
    r"^[a-z]{1,3}$",  # Very short strings
]


def is_valid_title(title: str) -> bool:
    """Check if a string looks like a valid show title."""
    if not title or len(title) < 3 or len(title) > 200:
        return False

    title_lower = title.lower().strip()

    for pattern in SKIP_PATTERNS:
        if re.match(pattern, title_lower, re.IGNORECASE):
            return False

    return True


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range from formats like:
    - "January 15 - February 28, 2026"
    - "March 5-29, 2026"
    - "December 2025"

    Returns (start_date, end_date) in YYYY-MM-DD format.
    """
    if not date_text:
        return None, None

    # Clean up the text
    date_text = date_text.strip()

    # Pattern: "Month Day - Month Day, Year" or "Month Day-Day, Year"
    range_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–—]\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )

    if range_match:
        start_month = range_match.group(1)
        start_day = range_match.group(2)
        end_month = range_match.group(3) or start_month
        end_day = range_match.group(4)
        year = range_match.group(5)

        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Single date "Month Day, Year"
    single_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )

    if single_match:
        month, day, year = single_match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Horizon Theatre shows using Playwright with DOM-based parsing."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Horizon Theatre: {PLAYS_URL}")
            page.goto(PLAYS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)  # Wait for JS instead of networkidle

            # Find all show links in the navigation/plays section
            # Horizon uses menu structure with links to /plays/[show-slug]/
            show_links = page.query_selector_all('a[href*="/plays/"]')

            show_urls = set()
            for link in show_links:
                href = link.get_attribute("href")
                if href and "/plays/" in href:
                    # Skip category pages and navigation
                    if any(skip in href for skip in ["/plays/#", "/plays/?", "season", "family-series", "past-seasons"]):
                        continue
                    # Must be a show page (has another segment after /plays/)
                    parts = href.rstrip("/").split("/plays/")
                    if len(parts) > 1 and parts[1] and "/" not in parts[1]:
                        full_url = href if href.startswith("http") else BASE_URL + href
                        show_urls.add(full_url)

            logger.info(f"Found {len(show_urls)} potential show pages")

            # Visit each show page to get details
            for show_url in show_urls:
                try:
                    page.goto(show_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(2000)

                    # Get show title - usually in h1 or prominent heading
                    title = None
                    for selector in ["h1", ".show-title", ".entry-title", ".page-title"]:
                        el = page.query_selector(selector)
                        if el:
                            title = el.inner_text().strip()
                            if is_valid_title(title):
                                break
                            title = None

                    if not title:
                        logger.debug(f"No valid title found at {show_url}")
                        continue

                    # Get dates - look for date information
                    date_text = ""
                    for selector in [".show-dates", ".dates", ".performance-dates", "time", ".entry-meta"]:
                        el = page.query_selector(selector)
                        if el:
                            date_text = el.inner_text().strip()
                            if date_text:
                                break

                    # Also check page content for date patterns
                    if not date_text:
                        body_text = page.inner_text("body")
                        date_match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}.*?\d{4}",
                            body_text,
                            re.IGNORECASE
                        )
                        if date_match:
                            date_text = date_match.group(0)

                    start_date, end_date = parse_date_range(date_text)

                    # Skip if no dates found or dates are in the past
                    if not start_date:
                        logger.debug(f"No dates found for {title}")
                        continue

                    # Skip past shows
                    if end_date and datetime.strptime(end_date, "%Y-%m-%d").date() < datetime.now().date():
                        logger.debug(f"Skipping past show: {title}")
                        continue

                    # Get description
                    description = None
                    for selector in [".show-description", ".entry-content p", ".synopsis", "article p"]:
                        el = page.query_selector(selector)
                        if el:
                            desc = el.inner_text().strip()
                            if desc and len(desc) > 20:
                                description = desc[:500]
                                break

                    # Get image
                    image_url = None
                    for selector in [".show-image img", ".featured-image img", "article img", ".entry-content img"]:
                        el = page.query_selector(selector)
                        if el:
                            src = el.get_attribute("src") or el.get_attribute("data-src")
                            if src:
                                image_url = src if src.startswith("http") else BASE_URL + src
                                break

                    events_found += 1

                    content_hash = generate_content_hash(title, "Horizon Theatre", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Create series hint for the show run
                    series_hint = {
                        "name": title,
                        "venue_id": venue_id,
                    }

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at Horizon Theatre",
                        "start_date": start_date,
                        "start_time": "20:00",  # Default evening showtime
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": "play",
                        "tags": ["horizon-theatre", "theater", "little-five-points", "l5p", "contemporary"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": show_url,
                        "ticket_url": show_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_text}",
                        "extraction_confidence": 0.90,
                        "is_recurring": True if end_date and end_date != start_date else False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} ({start_date} to {end_date})")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process show page {show_url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Horizon Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Horizon Theatre: {e}")
        raise

    return events_found, events_new, events_updated
