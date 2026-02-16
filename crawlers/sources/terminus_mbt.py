"""
Crawler for Terminus Modern Ballet Theatre (terminusmbt.com).
Professional modern ballet company + school.

Home base: Tula Arts Center in West Midtown.
Performances may be at different venues across Atlanta metro.

Site: Webflow CMS with /tickets listing and /events-features/[slug] detail pages.
Each show has individual performance dates with specific times and venues.
Creates one event per performance (not per show run).
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

BASE_URL = "https://www.terminusmbt.com"
TICKETS_URL = f"{BASE_URL}/tickets"

# Home base venue
VENUE_DATA = {
    "name": "Tula Arts Center",
    "slug": "tula-arts-center",
    "address": "75 Bennett St NW, Suite A-2",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.8337,
    "lng": -84.4064,
    "venue_type": "venue",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["dance", "ballet", "performing-arts", "west-midtown"],
}

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|tickets?|buy|login|sign|register)$",
    r"^(facebook|twitter|instagram|youtube|menu|cart)$",
    r"^(privacy|terms|policy)$",
    r"^\d+$",
]

# URLs to skip — non-event pages that show up in event listings
SKIP_URL_PATTERNS = [
    "audition",
    "class",
    "school",
    "portal",
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


def parse_performance_datetime(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse performance date/time from formats like:
    - "Friday, March 6, 2026 | 8:00 PM"
    - "Saturday, March 7, 2026 | 2:00 PM"
    Returns (start_date, start_time) as ("YYYY-MM-DD", "HH:MM")
    """
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Pattern: "DayOfWeek, Month Day, Year | Time AM/PM"
    # Handles both full ("Friday, March 6, 2026") and abbreviated ("Fri. March 6, 2026")
    match = re.search(
        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\.?,?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+"
        r"(\d{4})\s*[|·\-–—]\s*"
        r"(\d{1,2}):(\d{2})\s*(AM|PM)",
        date_text,
        re.IGNORECASE
    )

    if match:
        month, day, year, hour, minute, meridiem = match.groups()
        try:
            # Parse date
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            start_date = dt.strftime("%Y-%m-%d")

            # Parse time to 24-hour format
            hour_int = int(hour)
            if meridiem.upper() == "PM" and hour_int != 12:
                hour_int += 12
            elif meridiem.upper() == "AM" and hour_int == 12:
                hour_int = 0

            start_time = f"{hour_int:02d}:{minute}"

            return start_date, start_time
        except ValueError:
            pass

    return None, None


def parse_venue_from_text(text: str) -> Optional[dict]:
    """
    Extract venue information from text like:
    "KSU Dance Theatre, 860 Rossbacher Way, Marietta, GA 30060"
    or "Tula Arts Center, 75 Bennett Street NW Suite A-2, Atlanta, GA 30309"

    Returns venue data dict or None.
    """
    if not text:
        return None

    # Pattern: "Venue Name, Street Address, City, State Zip"
    # Allow multi-line by removing newlines
    text = " ".join(text.split("\n")).strip()

    # Look for address patterns
    match = re.search(
        r"([^,]+),\s*"  # Venue name
        r"([^,]+),\s*"  # Street address
        r"([^,]+),\s*"  # City
        r"([A-Z]{2})\s*"  # State
        r"(\d{5})",  # Zip
        text,
        re.IGNORECASE
    )

    if match:
        venue_name = match.group(1).strip()
        address = match.group(2).strip()
        city = match.group(3).strip()
        state = match.group(4).strip().upper()
        zip_code = match.group(5).strip()

        # Create slug from venue name
        slug = (
            venue_name.lower()
            .replace(" ", "-")
            .replace("'", "")
            .replace(".", "")
            .replace(",", "")
        )
        slug = re.sub(r"-+", "-", slug).strip("-")

        # Determine venue type
        venue_type = "venue"
        spot_type = "theater"
        if "theater" in venue_name.lower() or "theatre" in venue_name.lower():
            venue_type = "theater"
        elif "center" in venue_name.lower() or "centre" in venue_name.lower():
            venue_type = "performing_arts"

        return {
            "name": venue_name,
            "slug": slug,
            "address": address,
            "city": city,
            "state": state,
            "zip": zip_code,
            "venue_type": venue_type,
            "spot_type": spot_type,
            "neighborhood": None,  # Will be geocoded later
        }

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Terminus Modern Ballet Theatre performances."""
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

            # Create home venue
            home_venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Terminus MBT tickets page: {TICKETS_URL}")
            page.goto(TICKETS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load Webflow CMS content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Find event detail links - Webflow CMS pattern: /events-features/[slug]
            event_links = page.query_selector_all('a[href*="/events-features/"]')

            event_urls = set()
            for link in event_links:
                href = link.get_attribute("href")
                if href and "/events-features/" in href:
                    # Skip the main events-features page itself
                    if href.rstrip("/").endswith("/events-features"):
                        continue
                    full_url = href if href.startswith("http") else BASE_URL + href
                    event_urls.add(full_url)

            logger.info(f"Found {len(event_urls)} event detail pages")

            for event_url in event_urls:
                try:
                    # Skip non-event pages
                    url_lower = event_url.lower()
                    if any(pat in url_lower for pat in SKIP_URL_PATTERNS):
                        logger.debug(f"Skipping non-event page: {event_url}")
                        continue

                    logger.debug(f"Processing: {event_url}")
                    page.goto(event_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(3000)

                    # Scroll to load full content
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                    # Get title
                    title = None
                    for selector in ["h1", ".event-title", ".page-title", ".show-title"]:
                        el = page.query_selector(selector)
                        if el:
                            title = el.inner_text().strip()
                            if is_valid_title(title):
                                break
                            title = None

                    if not title:
                        # Extract from URL
                        match = re.search(r"/events-features/([^/]+)/?", event_url)
                        if match:
                            title = match.group(1).replace("-", " ").title()

                    if not title or not is_valid_title(title):
                        logger.debug(f"Invalid or missing title for {event_url}")
                        continue

                    # Get body text for parsing
                    body_text = page.inner_text("body")

                    # Get description
                    description = None
                    for selector in [".event-description", ".description", "article p", ".rich-text p"]:
                        el = page.query_selector(selector)
                        if el:
                            desc = el.inner_text().strip()
                            if desc and len(desc) > 30 and "buy ticket" not in desc.lower():
                                description = desc[:500]
                                break

                    # Get image
                    image_url = None
                    for selector in [".event-image img", ".hero-image img", ".featured-image img", "article img"]:
                        el = page.query_selector(selector)
                        if el:
                            src = el.get_attribute("src") or el.get_attribute("data-src")
                            if src and "logo" not in src.lower():
                                image_url = src if src.startswith("http") else BASE_URL + src
                                break

                    # Find ticket URL
                    ticket_url = event_url
                    ticket_links = page.query_selector_all('a[href*="ovationtix"], a[href*="ticket"]')
                    for link in ticket_links:
                        href = link.get_attribute("href")
                        if href and ("ovationtix" in href or "ticket" in href):
                            ticket_url = href if href.startswith("http") else BASE_URL + href
                            break

                    # Parse individual performance dates/times from the page
                    # Look for patterns like "Fri. March 6, 2026 | 8:00 PM"
                    performance_pattern = re.compile(
                        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\.?,?\s+"
                        r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+"
                        r"\d{1,2},?\s+"
                        r"\d{4}\s*[|·\-–—]\s*"
                        r"\d{1,2}:\d{2}\s*(?:AM|PM)",
                        re.IGNORECASE
                    )

                    performance_texts = performance_pattern.findall(body_text)

                    # Also look for venue information in the body text
                    # It's usually near the performance times
                    venue_data = parse_venue_from_text(body_text)

                    # If no specific performances found, skip this event
                    if not performance_texts:
                        logger.debug(f"No performance dates/times found for {title}")
                        continue

                    # Create one event per performance date/time
                    for perf_text in performance_texts:
                        start_date, start_time = parse_performance_datetime(perf_text)

                        if not start_date:
                            logger.debug(f"Could not parse date from: {perf_text}")
                            continue

                        # Skip past performances
                        try:
                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                logger.debug(f"Skipping past performance: {start_date}")
                                continue
                        except ValueError:
                            pass

                        # Determine venue for this performance
                        # If venue data was extracted, use it; otherwise use home venue
                        if venue_data:
                            venue_id = get_or_create_venue(venue_data)
                            venue_name = venue_data["name"]
                        else:
                            venue_id = home_venue_id
                            venue_name = "Tula Arts Center"

                        events_found += 1

                        content_hash = generate_content_hash(title, venue_name, start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Build tags
                        tags = ["terminus-mbt", "ballet", "dance", "contemporary-dance", "modern-ballet"]
                        if venue_name == "Tula Arts Center":
                            tags.append("west-midtown")

                        # Build description if none found
                        if not description:
                            description = f"{title} by Terminus Modern Ballet Theatre"

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "theater",
                            "subcategory": "dance",
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": ticket_url,
                            "image_url": image_url,
                            "raw_text": f"{title} - {perf_text}",
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date} at {start_time} ({venue_name})")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title} on {start_date}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process {event_url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Terminus MBT crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Terminus Modern Ballet Theatre: {e}")
        raise

    return events_found, events_new, events_updated
