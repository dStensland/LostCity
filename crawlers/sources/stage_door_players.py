"""
Crawler for Stage Door Theatre (stagedoortheatrega.org).
Community theater in Dunwoody.

Note: Domain changed from stagedoorplayers.net to stagedoortheatrega.org
Site structure: Shows at /individual-tickets/ with OvationTix links.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://stagedoortheatrega.org"
TICKETS_URL = f"{BASE_URL}/individual-tickets/"

VENUE_DATA = {
    "name": "Stage Door Theatre",
    "slug": "stage-door-players",
    "address": "5339 Chamblee Dunwoody Rd",
    "neighborhood": "Dunwoody",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30338",
    "lat": 33.9298,
    "lng": -84.3184,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|register|account)$",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|policy|copyright)$",
    r"^(season|subscription|calendar|past)$",
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
    """Parse date range like 'December 6-21, 2025'."""
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Pattern: "Month Day-Day, Year"
    same_month_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–—]\s*(\d{1,2}),?\s*(\d{4})",
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

    # Pattern: "Month Day - Month Day, Year"
    range_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–—]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if range_match:
        start_month, start_day, end_month, end_day, year = range_match.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date
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
    """Crawl Stage Door Theatre shows."""
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

            # Try tickets page first, then main page
            for url in [TICKETS_URL, BASE_URL]:
                logger.info(f"Fetching Stage Door Theatre: {url}")
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(4000)
                    break
                except Exception:
                    continue

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Get page content
            body_text = page.inner_text("body")

            # Find OvationTix links which indicate show pages
            ticket_links = page.query_selector_all('a[href*="ovationtix.com"]')

            for link in ticket_links:
                try:
                    # Get the surrounding context for title
                    parent = link.evaluate_handle("el => el.closest('article, section, div')")
                    if parent:
                        parent_text = parent.as_element().inner_text()

                        # Look for title (usually in heading)
                        title = None
                        heading = link.evaluate_handle("el => el.closest('article, section, div')?.querySelector('h1, h2, h3, h4')")
                        if heading:
                            title_el = heading.as_element()
                            if title_el:
                                title = title_el.inner_text().strip()

                        if not title or not is_valid_title(title):
                            # Try to extract from link text or nearby text
                            link_text = link.inner_text().strip()
                            if link_text and is_valid_title(link_text):
                                title = link_text

                        if not title:
                            continue

                        # Get dates from parent context
                        start_date, end_date = parse_date_range(parent_text)

                        if not start_date:
                            continue

                        # Skip past shows
                        check_date = end_date or start_date
                        try:
                            if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue
                        except ValueError:
                            pass

                        ticket_url = link.get_attribute("href")

                        events_found += 1

                        content_hash = generate_content_hash(title, "Stage Door Theatre", start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"{title} at Stage Door Theatre",
                            "start_date": start_date,
                            "start_time": "20:00",
                            "end_date": end_date,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "theater",
                            "subcategory": "play",
                            "tags": ["stage-door", "theater", "dunwoody", "community-theater"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": ticket_url,
                            "image_url": None,
                            "raw_text": f"{title}",
                            "extraction_confidence": 0.82,
                            "is_recurring": True if end_date and end_date != start_date else False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} ({start_date} to {end_date})")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing link: {e}")
                    continue

            browser.close()

        logger.info(
            f"Stage Door Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Stage Door Theatre: {e}")
        raise

    return events_found, events_new, events_updated
