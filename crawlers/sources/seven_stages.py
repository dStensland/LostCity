"""
Crawler for 7 Stages Theatre (7stages.org).
Experimental theater in Little Five Points known for edgy, provocative productions.

Site structure: Shows at /shows with portfolio grid, links to individual show pages.
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

BASE_URL = "https://www.7stages.org"
SHOWS_URL = f"{BASE_URL}/shows"

VENUE_DATA = {
    "name": "7 Stages",
    "slug": "7-stages",
    "address": "1105 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7647,
    "lng": -84.3494,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|sign up|register|account)$",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|policy|copyright|\d{4})$",
    r"^(what's on|rental|archive|past)$",
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
    """Parse date range from various formats."""
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Pattern: Date range like "2.6-7.2026" (Month.Day-Day.Year) or "1.15-24.2026"
    range_embedded_match = re.search(r"(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{4})", date_text)
    if range_embedded_match:
        start_month, start_day, end_day, year = range_embedded_match.groups()
        try:
            start_dt = datetime(int(year), int(start_month), int(start_day))
            end_dt = datetime(int(year), int(start_month), int(end_day))
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Date range like "12.11-28.25" (month.day-day.year with shortened year)
    # or with full year "12.11-28.2025"
    range_embedded_match2 = re.search(r"(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{2,4})", date_text)
    if range_embedded_match2:
        start_month, start_day, end_day, year = range_embedded_match2.groups()
        try:
            # If year is 2 digits, assume 20xx
            if len(year) == 2:
                year = f"20{year}"
            start_dt = datetime(int(year), int(start_month), int(start_day))
            end_dt = datetime(int(year), int(start_month), int(end_day))
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Single embedded date like "2.14.2026"
    # 7 Stages sometimes uses format like "Game. Set. Match. 2.14.2026"
    embedded_match = re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", date_text)
    if embedded_match:
        month, day, year = embedded_match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Standard range pattern
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
    """Crawl 7 Stages shows using Playwright with DOM-based parsing."""
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

            logger.info(f"Fetching 7 Stages: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load lazy content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # 7 Stages uses portfolio items with h3 titles
            # Look for show cards/items
            show_items = page.query_selector_all("article, .portfolio-item, .show-item, .summary-item")

            if not show_items:
                # Fallback: look for h3 elements with links
                show_items = page.query_selector_all("h3 a, .show-title a")

            show_data = []

            for item in show_items:
                try:
                    # Try to get title from h3 or heading
                    title_el = item.query_selector("h3, h2, .title, .show-title")
                    if not title_el:
                        title_el = item

                    title = title_el.inner_text().strip()

                    # Clean up title - remove embedded dates for display
                    clean_title = re.sub(r"\s*\d{1,2}\.\d{1,2}\.\d{4}\s*", "", title).strip()
                    if clean_title:
                        title = clean_title

                    if not is_valid_title(title):
                        continue

                    # Get link
                    link_el = item.query_selector("a") if item.query_selector("a") else item
                    href = link_el.get_attribute("href") if link_el else None

                    show_url = None
                    if href:
                        show_url = href if href.startswith("http") else BASE_URL + href

                    # Get image
                    img_el = item.query_selector("img")
                    image_url = None
                    if img_el:
                        src = img_el.get_attribute("src") or img_el.get_attribute("data-src")
                        if src:
                            image_url = src if src.startswith("http") else BASE_URL + src

                    show_data.append({
                        "title": title,
                        "url": show_url,
                        "image_url": image_url,
                    })

                except Exception as e:
                    logger.debug(f"Error parsing show item: {e}")
                    continue

            logger.info(f"Found {len(show_data)} potential shows")

            # Visit each show page to get dates
            for show in show_data:
                try:
                    title = show["title"]
                    show_url = show["url"]

                    if not show_url:
                        continue

                    page.goto(show_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(3000)

                    # Get dates from show page
                    body_text = page.inner_text("body")

                    # Look for date patterns
                    start_date, end_date = parse_date_range(body_text)

                    if not start_date:
                        # Try to extract from title if it had embedded date
                        start_date, end_date = parse_date_range(show["title"])

                    if not start_date:
                        logger.debug(f"No dates found for {title}")
                        continue

                    # Skip past shows
                    if end_date:
                        try:
                            if datetime.strptime(end_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue
                        except ValueError:
                            pass

                    # Get description
                    description = None
                    for selector in [".show-description", ".entry-content p", "article p", ".synopsis"]:
                        el = page.query_selector(selector)
                        if el:
                            desc = el.inner_text().strip()
                            if desc and len(desc) > 20:
                                description = desc[:500]
                                break

                    events_found += 1

                    content_hash = generate_content_hash(title, "7 Stages", start_date)


                    # Build series hint for show runs
                    series_hint = None
                    if end_date and end_date != start_date:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                        }
                        if description:
                            series_hint["description"] = description
                        if show["image_url"]:
                            series_hint["image_url"] = show["image_url"]

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at 7 Stages",
                        "start_date": start_date,
                        "start_time": "20:00",
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": "play",
                        "tags": ["7-stages", "theater", "experimental", "little-five-points", "l5p"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": show_url,
                        "ticket_url": show_url,
                        "image_url": show["image_url"],
                        "raw_text": f"{title}",
                        "extraction_confidence": 0.85,
                        "is_recurring": True if end_date and end_date != start_date else False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

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
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process show {show.get('title', 'unknown')}: {e}")
                    continue

            browser.close()

        logger.info(
            f"7 Stages crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl 7 Stages: {e}")
        raise

    return events_found, events_new, events_updated
