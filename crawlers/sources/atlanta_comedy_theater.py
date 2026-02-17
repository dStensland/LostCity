"""
Crawler for Atlanta Comedy Theater (atlcomedytheater.com).
Stand-up comedy club in Norcross.

Site structure: Shows on homepage, tickets through ShowClix.
Note: Domain redirects from atlantacomedytheater.com to atlcomedytheater.com
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url, extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "http://atlcomedytheater.com"

VENUE_DATA = {
    "name": "Atlanta Comedy Theater",
    "slug": "atlanta-comedy-theater",
    "address": "5385 Peachtree Industrial Blvd",
    "neighborhood": "Norcross",
    "city": "Norcross",
    "state": "GA",
    "zip": "30092",
    "lat": 33.9168,
    "lng": -84.2592,
    "venue_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BASE_URL,
}

SKIP_PATTERNS = [
    r"^(home|about|contact|menu|reservations?|private events?)$",
    r"^(login|sign in|register|account)$",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|policy|copyright)$",
    r"^(buy tickets?|get tickets?|on sale)$",
    r"^\d+$",
    r"^[a-z]{1,3}$",
]


def is_valid_title(title: str) -> bool:
    """Check if a string looks like a valid show/comedian name."""
    if not title or len(title) < 3 or len(title) > 200:
        return False
    title_lower = title.lower().strip()
    for pattern in SKIP_PATTERNS:
        if re.match(pattern, title_lower, re.IGNORECASE):
            return False
    return True


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date range like 'February 13-15' or 'February 13-15, 2026'."""
    if not date_text:
        return None, None

    date_text = date_text.strip()
    current_year = datetime.now().year

    # Pattern: "Month Day-Day" or "Month Day-Day, Year"
    same_month_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–—]\s*(\d{1,2})(?:,?\s*(\d{4}))?",
        date_text,
        re.IGNORECASE
    )
    if same_month_match:
        month, start_day, end_day, year = same_month_match.groups()
        year = year or str(current_year)
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
            # If dates are in past, assume next year
            if end_dt.date() < datetime.now().date():
                start_dt = datetime(start_dt.year + 1, start_dt.month, start_dt.day)
                end_dt = datetime(end_dt.year + 1, end_dt.month, end_dt.day)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date
    single_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s*(\d{4}))?",
        date_text,
        re.IGNORECASE
    )
    if single_match:
        month, day, year = single_match.groups()
        year = year or str(current_year)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date():
                dt = datetime(dt.year + 1, dt.month, dt.day)
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Comedy Theater shows."""
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

            logger.info(f"Fetching Atlanta Comedy Theater: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract image map for event images
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Find ShowClix ticket links
            showclix_links = page.query_selector_all('a[href*="showclix.com"]')

            processed_events = set()

            for link in showclix_links:
                try:
                    href = link.get_attribute("href")
                    link_text = link.inner_text().strip()

                    # Try to get comedian name from link or surrounding context
                    title = None

                    # Check if link text is a name
                    if link_text and is_valid_title(link_text) and not link_text.lower().startswith("buy"):
                        title = link_text

                    # Look for heading nearby
                    if not title:
                        parent = link.evaluate_handle("el => el.closest('article, section, div')")
                        if parent:
                            heading = parent.as_element().query_selector("h1, h2, h3, h4")
                            if heading:
                                heading_text = heading.inner_text().strip()
                                if is_valid_title(heading_text):
                                    title = heading_text

                    if not title:
                        # Extract from ShowClix URL
                        match = re.search(r"showclix\.com/event/([^/?\s]+)", href)
                        if match:
                            title = match.group(1).replace("-", " ").title()

                    if not title or not is_valid_title(title):
                        continue

                    # Skip duplicates
                    if title.lower() in processed_events:
                        continue
                    processed_events.add(title.lower())

                    # Get date context
                    parent = link.evaluate_handle("el => el.closest('article, section, div')")
                    parent_text = ""
                    if parent:
                        parent_text = parent.as_element().inner_text()

                    start_date, end_date = parse_date_range(parent_text)

                    if not start_date:
                        # Try to find date in broader page context
                        body_text = page.inner_text("body")
                        # Look for date near the title
                        title_pattern = re.escape(title)
                        context_match = re.search(
                            rf"{title_pattern}.*?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{{1,2}}(?:\s*[-–—]\s*\d{{1,2}})?(?:,?\s*\d{{4}})?)",
                            body_text,
                            re.IGNORECASE | re.DOTALL
                        )
                        if context_match:
                            start_date, end_date = parse_date_range(context_match.group(1))

                    if not start_date:
                        logger.debug(f"No dates found for {title}")
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "Atlanta Comedy Theater", start_date)


                    # Determine tags
                    tags = ["atlanta-comedy-theater", "comedy", "standup", "norcross"]
                    if "special engagement" in parent_text.lower():
                        tags.append("special-engagement")
                    if "drag" in parent_text.lower():
                        tags.append("drag")
                        tags.append("brunch")

                    # Get specific event URL
                    event_url = find_event_url(title, event_links, BASE_URL)

                    # Find image by title match
                    event_image = None
                    title_lower = title.lower()
                    for img_alt, img_url in image_map.items():
                        if img_alt.lower() == title_lower or title_lower in img_alt.lower() or img_alt.lower() in title_lower:
                            event_image = img_url
                            break

                    # Build series hint for show runs
                    description = f"{title} at Atlanta Comedy Theater"
                    series_hint = None
                    if end_date and end_date != start_date:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                            "description": description,
                        }

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": "20:00",  # Most shows at 8pm
                        "end_date": end_date if end_date != start_date else None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "comedy",
                        "subcategory": "standup",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": href,
                        "image_url": event_image,
                        "raw_text": f"{title}",
                        "extraction_confidence": 0.82,
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
                    logger.debug(f"Error processing link: {e}")
                    continue

            browser.close()

        logger.info(
            f"Atlanta Comedy Theater crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Comedy Theater: {e}")
        raise

    return events_found, events_new, events_updated
