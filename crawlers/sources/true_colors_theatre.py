"""
Crawler for True Colors Theatre Company (truecolorstheatre.org).
African American theater company focused on amplifying Black voices.

Site structure: Shows at /shows/ with individual show pages at /event/[slug]/
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

BASE_URL = "https://truecolorstheatre.org"
SHOWS_URL = f"{BASE_URL}/shows/"

VENUE_DATA = {
    "name": "True Colors Theatre Company",
    "slug": "true-colors-theatre",
    "address": "1280 Peachtree St NE",  # At the Alliance Theatre
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7878,
    "lng": -84.3853,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|register|account)$",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|policy|copyright)$",
    r"^(season|monologue|education|drinking gourd)$",
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
    """Parse date range from formats like 'February 11th – March 9th, 2025'."""
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Pattern: "Month Day(th/st/nd/rd) – Month Day(th/st/nd/rd), Year"
    range_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–—]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})",
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

    # Same month range
    same_month_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–—]\s*(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})",
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

    # Single date
    single_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})",
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
    """Crawl True Colors Theatre shows."""
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

            logger.info(f"Fetching True Colors Theatre: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Find show links - True Colors uses /event/[slug]/ pattern
            show_links = page.query_selector_all('a[href*="/event/"]')

            show_urls = set()
            for link in show_links:
                href = link.get_attribute("href")
                if href and "/event/" in href:
                    full_url = href if href.startswith("http") else BASE_URL + href
                    show_urls.add(full_url)

            logger.info(f"Found {len(show_urls)} show pages")

            for show_url in show_urls:
                try:
                    page.goto(show_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(3000)

                    # Get title
                    title = None
                    for selector in ["h1", ".show-title", ".entry-title", ".event-title"]:
                        el = page.query_selector(selector)
                        if el:
                            title = el.inner_text().strip()
                            if is_valid_title(title):
                                break
                            title = None

                    if not title:
                        # Extract from URL
                        match = re.search(r"/event/([^/]+)/?", show_url)
                        if match:
                            title = match.group(1).replace("-", " ").title()

                    if not title or not is_valid_title(title):
                        continue

                    # Get dates
                    body_text = page.inner_text("body")
                    start_date, end_date = parse_date_range(body_text)

                    if not start_date:
                        logger.debug(f"No dates found for {title}")
                        continue

                    # Skip past shows
                    check_date = end_date or start_date
                    try:
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue
                    except ValueError:
                        pass

                    # Get description
                    description = None
                    for selector in [".show-description", ".entry-content p", "article p", ".event-description"]:
                        el = page.query_selector(selector)
                        if el:
                            desc = el.inner_text().strip()
                            if desc and len(desc) > 30:
                                description = desc[:500]
                                break

                    # Get image
                    image_url = None
                    for selector in [".show-image img", ".event-image img", "article img", ".featured-image img"]:
                        el = page.query_selector(selector)
                        if el:
                            src = el.get_attribute("src") or el.get_attribute("data-src")
                            if src and "logo" not in src.lower():
                                image_url = src if src.startswith("http") else BASE_URL + src
                                break

                    events_found += 1

                    content_hash = generate_content_hash(title, "True Colors Theatre", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Build series hint for show runs
                    series_hint = None
                    if end_date and end_date != start_date:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                        }
                        if description:
                            series_hint["description"] = description
                        if image_url:
                            series_hint["image_url"] = image_url

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at True Colors Theatre",
                        "start_date": start_date,
                        "start_time": "19:30",
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": "play",
                        "tags": ["true-colors", "theater", "midtown", "black-theater", "african-american"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": show_url,
                        "ticket_url": show_url,
                        "image_url": image_url,
                        "raw_text": f"{title}",
                        "extraction_confidence": 0.88,
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
                    logger.warning(f"Failed to process {show_url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"True Colors Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl True Colors Theatre: {e}")
        raise

    return events_found, events_new, events_updated
