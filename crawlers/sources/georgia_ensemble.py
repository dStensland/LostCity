"""
Crawler for Georgia Ensemble Theatre (get.org).
Professional theater company in Roswell/Sandy Springs with mainstage productions.

Site structure: Season schedule at /25-26-season/ with embedded show information.
Currently at Act3 Playhouse in Sandy Springs, historically at Roswell Cultural Arts Center.
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

BASE_URL = "https://get.org"
SEASON_URL = f"{BASE_URL}/25-26-season/"

# Current venue (as of 2024-2025 season)
VENUE_DATA = {
    "name": "Georgia Ensemble Theatre @ Act3 Playhouse",
    "slug": "georgia-ensemble-theatre",
    "address": "5975 Roswell Rd",
    "neighborhood": "Sandy Springs",
    "city": "Sandy Springs",
    "state": "GA",
    "zip": "30328",
    "lat": 33.9426,
    "lng": -84.3516,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

# Historic venue data (for reference)
# Roswell Cultural Arts Center: 950 Forrest St, Roswell, GA 30075

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart)$",
    r"^(login|sign in|register|account)$",
    r"^(no drama comedy show)$",  # TBA dates
    r"^(plus)$",
    r"^\d+$",
    r"^[a-z]{1,3}$",
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
    - "November 22 - December 13, 2025"
    - "December 4-7, 2025"
    - "January 23 - February 8, 2026"
    - "March 8, 2026" (single day)
    - "February 22, 2026" (single day)
    """
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Pattern: "Month Day - Month Day, Year" (cross-month range)
    # Note: \s* to handle concatenated text without spaces
    cross_month_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{1,2})\s*[-–—]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if cross_month_match:
        start_month, start_day, end_month, end_day, year = cross_month_match.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: "Month Day-Day, Year" (same month range)
    # Note: \s* to handle concatenated text without spaces
    same_month_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{1,2})\s*[-–—]\s*(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if same_month_match:
        month, start_day, end_day, year = same_month_match.groups()
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Single date "Month Day, Year"
    # Note: \s* to handle concatenated text without spaces
    single_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{1,2}),?\s*(\d{4})",
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


def extract_title_from_heading(heading_text: str) -> Optional[str]:
    """
    Extract clean title from h5 headings like:
    'DRAGONS LOVE TACOS, adapted by Ernie Nolan... November 22 - December 13, 2025'
    Returns just 'Dragons Love Tacos'

    Note: Site may concatenate text without spaces, so we handle both cases.
    """
    if not heading_text:
        return None

    # Remove content after the first date pattern or director credit
    # Use \s* to handle both spaced and non-spaced text
    heading_text = re.sub(r'\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{1,2}.*', '', heading_text, flags=re.IGNORECASE)
    heading_text = re.sub(r'\s*Directed by.*', '', heading_text, flags=re.IGNORECASE)
    heading_text = re.sub(r'\s*by\s+\w+.*', '', heading_text, flags=re.IGNORECASE)
    heading_text = re.sub(r',\s*(adapted|created|written|based on).*', '', heading_text, flags=re.IGNORECASE)

    # Extract title (usually between <em> tags or at start)
    em_match = re.search(r'<em[^>]*>(.*?)</em>', heading_text)
    if em_match:
        title = em_match.group(1)
    else:
        # Take first part before comma or attribution
        title = heading_text.split(',')[0]

    # Clean up HTML tags and extra formatting
    title = re.sub(r'<[^>]+>', '', title)
    title = re.sub(r'\s+', ' ', title).strip()
    title = title.rstrip(',').strip()  # Remove trailing commas

    # Handle ALLCAPSCONCATENATED titles by inserting spaces
    # Look for lowercase followed by uppercase, or letter followed by number
    if title.isupper() and ' ' not in title:
        # Insert spaces before capital letters that follow lowercase
        # This handles cases like "DRAGONSLOVETACOS" -> still all caps, need different approach
        # Try to match known titles or use word boundaries
        known_titles = {
            'DRAGONSLOVETACOS': 'Dragons Love Tacos',
            'THEGIVER': 'The Giver',
            'FORBIDDENBROADWAY': 'Forbidden Broadway',
            'AWRINKLEINTIME': 'A Wrinkle In Time',
            'RINGOFFIRE': 'Ring of Fire',
        }
        # Check if title starts with any known pattern
        for concat, proper in known_titles.items():
            if title.upper().startswith(concat):
                title = proper
                break
        else:
            # Fallback: title case for all caps without spaces
            title = title.title()

    return title if is_valid_title(title) else None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Ensemble Theatre season schedule."""
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

            logger.info(f"Fetching Georgia Ensemble Theatre: {SEASON_URL}")
            page.goto(SEASON_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Georgia Ensemble Theatre lists shows in h5 headings on the season page
            show_headings = page.query_selector_all('h5.wp-block-heading')

            logger.info(f"Found {len(show_headings)} show headings")

            for heading in show_headings:
                try:
                    heading_html = heading.inner_html()
                    heading_text = heading.inner_text()

                    # Extract title
                    title = extract_title_from_heading(heading_html)
                    if not title:
                        continue

                    # Extract dates from the heading text
                    start_date, end_date = parse_date_range(heading_text)

                    if not start_date:
                        logger.debug(f"No dates found for {title}")
                        continue

                    # Skip past shows
                    check_date = end_date or start_date
                    try:
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past show: {title}")
                            continue
                    except ValueError:
                        pass

                    # Get description from the paragraph following the heading
                    description = None
                    next_p = heading.evaluate("el => el.nextElementSibling?.tagName === 'P' ? el.nextElementSibling.innerText : null")
                    if next_p:
                        desc = next_p.strip()
                        # Skip "Also a Travel Team performance" notes
                        if desc and len(desc) > 30 and not desc.startswith("Also a Travel Team"):
                            description = desc[:500]

                    # Try to find a link to the individual show page
                    ticket_url = SEASON_URL
                    try:
                        # Look for show-specific page link
                        show_slug = title.lower().replace(" ", "-").replace("'", "").replace(":", "")
                        show_slug = re.sub(r'[^a-z0-9-]', '', show_slug)
                        show_page_url = f"{BASE_URL}/{show_slug}/"

                        # Check if there's a link in the content
                        show_link = heading.query_selector('a')
                        if show_link:
                            href = show_link.get_attribute('href')
                            if href:
                                ticket_url = href if href.startswith('http') else BASE_URL + href
                    except:
                        pass

                    # Determine category
                    category = "theater"
                    subcategory = "play"
                    tags = ["georgia-ensemble-theatre", "get", "theater", "sandy-springs"]

                    # Classify by title/content
                    title_lower = title.lower()
                    if any(word in title_lower for word in ["musical", "surf party", "ring of fire"]):
                        subcategory = "musical"
                        tags.append("musical")
                    elif any(word in title_lower for word in ["dragons", "wrinkle in time", "giver"]):
                        tags.append("family")
                    elif "comedy" in title_lower:
                        subcategory = "comedy"
                        tags.append("comedy")

                    events_found += 1

                    content_hash = generate_content_hash(title, "Georgia Ensemble Theatre", start_date)

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
                        "description": description or f"{title} at Georgia Ensemble Theatre",
                        "start_date": start_date,
                        "start_time": "19:30",  # Default evening showtime (7:30 PM)
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": 34,  # From website: "Tickets start at $34"
                        "price_max": None,
                        "price_note": "Tickets start at $34 for adults, $31 for seniors, $19 for students",
                        "is_free": False,
                        "source_url": SEASON_URL,
                        "ticket_url": ticket_url,
                        "image_url": None,  # Could be enhanced to scrape images
                        "raw_text": heading_text,
                        "extraction_confidence": 0.92,
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
                    logger.warning(f"Failed to process show heading: {e}")
                    continue

            browser.close()

        logger.info(
            f"Georgia Ensemble Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Ensemble Theatre: {e}")
        raise

    return events_found, events_new, events_updated
