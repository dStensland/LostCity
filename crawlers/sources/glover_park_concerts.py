"""
Crawler for Glover Park Concert Series in Marietta (mariettaga.gov).

Free outdoor concert series held on the last Friday of each month, April through
September, at Glover Park on the Marietta Square. Features local and national acts.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mariettaga.gov"
EVENTS_URL = f"{BASE_URL}/192/Glover-Park-Concert-Series"

# Glover Park venue
VENUE_DATA = {
    "name": "Glover Park",
    "slug": "glover-park-marietta",
    "address": "50 N Park Square",
    "neighborhood": "Marietta Square",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "venue_type": "park",
    "website": BASE_URL,
}


def parse_concert_date(date_text: str) -> Optional[str]:
    """
    Parse concert date from various formats.

    Examples:
    - "April 24, 2026"
    - "May 29, 2026"
    - "Sept 25, 2026"

    Returns:
        Date in YYYY-MM-DD format, or None if unparseable
    """
    if not date_text:
        return None

    date_text = date_text.strip()

    # Try "Month DD, YYYY" format
    match = re.search(
        r'(January|February|March|April|May|June|July|August|September|October|November|December|'
        r'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})',
        date_text,
        re.IGNORECASE
    )

    if match:
        month_str, day, year = match.groups()
        try:
            # Try full month name first
            dt = datetime.strptime(f"{month_str} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                # Try abbreviated month name
                dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    return None


def extract_performer_name(cell_html: str) -> Optional[str]:
    """
    Extract performer name from HTML cell content.
    The performer info is often in links or headings.

    Args:
        cell_html: HTML content of the performer cell

    Returns:
        Performer name or None
    """
    if not cell_html:
        return None

    # Try to extract text from links
    link_match = re.search(r'<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)</a>', cell_html)
    if link_match:
        url, text = link_match.groups()
        if text and text.strip():
            return text.strip()

    # Try to extract from headings
    heading_match = re.search(r'<h\d[^>]*>([^<]+)</h\d>', cell_html)
    if heading_match:
        text = heading_match.group(1)
        if text and text.strip():
            return text.strip()

    # Remove HTML tags and get remaining text
    clean_text = re.sub(r'<[^>]+>', '', cell_html)
    clean_text = clean_text.strip()

    if clean_text and len(clean_text) > 3:
        return clean_text

    return None


def determine_subcategory(title: str, description: str = "") -> Optional[str]:
    """Determine music subcategory based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["rock", "classic rock"]):
        return "rock"
    if any(word in text for word in ["country"]):
        return "country"
    if any(word in text for word in ["blues"]):
        return "blues"
    if any(word in text for word in ["jazz"]):
        return "jazz"
    if any(word in text for word in ["soul", "r&b", "motown"]):
        return "soul"

    # Default to general live music
    return "live"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["outdoor", "concert-series", "free", "marietta", "family-friendly"]

    if any(word in text for word in ["rock", "classic rock"]):
        tags.append("rock")
    if any(word in text for word in ["country"]):
        tags.append("country")
    if any(word in text for word in ["blues"]):
        tags.append("blues")
    if any(word in text for word in ["jazz"]):
        tags.append("jazz")
    if any(word in text for word in ["soul", "motown"]):
        tags.append("soul")
    if any(word in text for word in ["cover band", "tribute"]):
        tags.append("cover-band")

    return list(set(tags))


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Glover Park Concert Series events using Playwright.

    The site uses a table to display the concert schedule with dates and performers.
    """
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

            # Get venue ID for Glover Park
            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Glover Park Concert Series: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Look for the concert schedule table
            # The table has Concert Date, Tables Go on Sale, and Performers/Genre columns
            table_rows = page.query_selector_all("table tbody tr")

            if not table_rows:
                logger.warning("No table rows found on Glover Park Concert Series page")
                browser.close()
                return 0, 0, 0

            logger.info(f"Found {len(table_rows)} rows in concert schedule table")

            for row in table_rows:
                try:
                    # Get all cells in the row
                    cells = row.query_selector_all("td")

                    if len(cells) < 3:
                        continue

                    # Extract date from first column
                    date_text = cells[0].inner_text().strip()
                    concert_date = parse_concert_date(date_text)

                    if not concert_date:
                        logger.debug(f"Could not parse concert date: {date_text}")
                        continue

                    # Extract performer info from third column
                    performer_html = cells[2].inner_html()
                    performer_text = cells[2].inner_text().strip()

                    performer_name = extract_performer_name(performer_html)

                    # If no performer name found, skip (may be TBA)
                    if not performer_name or performer_name.lower() in ["tba", "to be announced"]:
                        logger.debug(f"No performer announced yet for {concert_date}")
                        continue

                    events_found += 1

                    # Build event title
                    title = f"{performer_name} at Glover Park Concert Series"

                    # Build description
                    description = (
                        f"Free outdoor concert featuring {performer_name} at the Glover Park Concert Series. "
                        f"This popular concert series takes place on the last Friday of each month, April through September, "
                        f"on the Marietta Square. Concerts start at 8:00 PM. Bring blankets and lawn chairs!"
                    )

                    # All concerts start at 8:00 PM
                    start_time = "20:00"

                    # Determine subcategory and tags
                    subcategory = determine_subcategory(performer_name, performer_text)
                    tags = extract_tags(performer_name, performer_text)

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Glover Park", concert_date
                    )

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Try to find performer image in image map
                    image_url = image_map.get(performer_name)

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": concert_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": 0,
                        "price_max": 0,
                        "price_note": "Free",
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                        "image_url": image_url,
                        "raw_text": f"{date_text} | {performer_name} | {performer_text[:200]}"[:500],
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {concert_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing table row: {e}")
                    continue

            browser.close()

        logger.info(
            f"Glover Park Concert Series crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Glover Park Concert Series: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Glover Park Concert Series: {e}")
        raise

    return events_found, events_new, events_updated
