"""
Crawler for Stage Door Theatre (stagedoortheatrega.org).
Community theater in Dunwoody at the Dunwoody Cultural Arts Center.

Site structure: Season schedule at /season-51-subscriptions/ with all 4 mainstage shows.
Individual show pages at /<show-slug>/ with OvationTix ticket links.
Domain moved from stagedoorplayers.net to stagedoortheatrega.org in 2024-25.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://stagedoortheatrega.org"
SEASON_URL = f"{BASE_URL}/season-51-subscriptions/"

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

SKIP_TITLES = {
    "become a season subscriber",
    "4 show package",
    "3 show package",
    "mainstage season",
    "quick links",
    "support",
    "contact us",
    "past productions",
    "spotlight series",
}

# Known OvationTix production IDs for each show (found on individual show pages)
# Keyed by normalized title fragment
TICKET_URL_MAP = {
    "steel magnolias": "https://ci.ovationtix.com/36385/production/1245923",
    "bad dates": "https://ci.ovationtix.com/36385/production/1245922",
    "christmas carol": "https://ci.ovationtix.com/36385/production/1245921",
    "cottage": "https://ci.ovationtix.com/36385/production/1245920",
}


def is_valid_show_title(title: str) -> bool:
    """Check if the heading text is an actual show title."""
    if not title or len(title) < 3 or len(title) > 200:
        return False
    if title.lower().strip() in SKIP_TITLES:
        return False
    # Skip lines that are just packaging/pricing
    if re.match(r"^\$\d+", title):
        return False
    if re.match(r"^\d+\s*(show|package)", title, re.IGNORECASE):
        return False
    return True


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date ranges like 'April 4-19, 2026' or 'February 7-22, 2026'."""
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Pattern: "Month Day - Month Day, Year"
    cross_month = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})\s*[-–—]\s*"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if cross_month:
        start_month, start_day, end_month, end_day, year = cross_month.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: "Month Day-Day, Year"
    same_month = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})\s*[-–—]\s*(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if same_month:
        month, start_day, end_day, year = same_month.groups()
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date
    single = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if single:
        month, day, year = single.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def find_ticket_url(title: str) -> str:
    """Look up a known OvationTix URL by title fragment."""
    title_lower = title.lower()
    for key, url in TICKET_URL_MAP.items():
        if key in title_lower:
            return url
    return f"{BASE_URL}/individual-tickets/"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Stage Door Theatre full season from subscription page."""
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

            logger.info(f"Fetching Stage Door Theatre season: {SEASON_URL}")
            page.goto(SEASON_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # The season page lists shows in <strong> or heading elements followed by paragraphs
            # Extract all paragraphs and headings to find show blocks
            body_text = page.inner_text("body")

            # Parse show blocks from the season text
            # Each show has: TITLE (bold/heading), By Author, Director, Date Range, Description
            # We'll use the structured headings approach
            show_headings = page.query_selector_all("strong, h3, h4, h5")

            processed_titles: set[str] = set()

            for heading in show_headings:
                try:
                    raw_title = heading.inner_text().strip()
                    if not raw_title or not is_valid_show_title(raw_title):
                        continue

                    # Normalize title (Stage Door uses ALL CAPS for show titles)
                    title = raw_title.title() if raw_title.isupper() else raw_title

                    # De-duplicate within this crawl run
                    title_key = title.lower().strip()
                    if title_key in processed_titles:
                        continue

                    # Get surrounding context for dates
                    parent_text = heading.evaluate(
                        "el => el.closest('div, section, article, p')?.innerText || ''"
                    )
                    if not parent_text:
                        # Walk up the DOM to get enclosing block context
                        parent_text = heading.evaluate(
                            "el => el.parentElement?.parentElement?.innerText || ''"
                        )

                    # Stage Door date format: "October 4-19, 2025"
                    start_date, end_date = parse_date_range(parent_text)

                    # If no date in parent, check body text near this title
                    if not start_date:
                        # Find the title in body text and look at next 200 chars
                        idx = body_text.find(raw_title)
                        if idx >= 0:
                            start_date, end_date = parse_date_range(body_text[idx : idx + 300])

                    if not start_date:
                        logger.debug(f"No dates found for: {title}")
                        continue

                    # Skip past shows
                    check_date = end_date or start_date
                    try:
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past show: {title}")
                            continue
                    except ValueError:
                        pass

                    # Extract description from context
                    description = None
                    # Find description in surrounding paragraphs
                    desc_text = heading.evaluate(
                        """el => {
                            let next = el.parentElement?.nextElementSibling;
                            for (let i = 0; i < 3 && next; i++) {
                                const text = next.innerText?.trim();
                                if (text && text.length > 50 && !text.match(/^\$|^[A-Z]\\s*[A-Z]/)) {
                                    return text;
                                }
                                next = next.nextElementSibling;
                            }
                            return null;
                        }"""
                    )
                    if desc_text and len(desc_text) > 50:
                        description = desc_text[:500]

                    # Determine show type
                    title_lower = title.lower()
                    subcategory = "play"
                    if any(w in title_lower for w in ["musical", "carol", "working"]):
                        subcategory = "musical"
                    elif "comedy" in title_lower or "dates" in title_lower:
                        subcategory = "comedy"

                    ticket_url = find_ticket_url(title)
                    content_hash = generate_content_hash(title, "Stage Door Theatre", start_date)

                    series_hint = None
                    if end_date and end_date != start_date:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                        }
                        if description:
                            series_hint["description"] = description

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at Stage Door Theatre",
                        "start_date": start_date,
                        "start_time": "19:30",  # Thu-Sat 7:30pm per site
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": subcategory,
                        "tags": ["stage-door-theatre", "theater", "dunwoody", "community-theater"],
                        "price_min": 20,  # $20 student minimum from site
                        "price_max": 32,  # $32 adult from site
                        "price_note": "Adult $32, Senior $28, Student $20, Child $15",
                        "is_free": False,
                        "source_url": SEASON_URL,
                        "ticket_url": ticket_url,
                        "image_url": None,
                        "raw_text": raw_title,
                        "extraction_confidence": 0.90,
                        "is_recurring": True if end_date and end_date != start_date else False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    events_found += 1
                    processed_titles.add(title_key)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} ({start_date} to {end_date})")
                    except Exception as e:
                        logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.warning(f"Error processing heading: {e}")
                    continue

            browser.close()

        logger.info(
            f"Stage Door Theatre crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Stage Door Theatre: {e}")
        raise

    return events_found, events_new, events_updated
