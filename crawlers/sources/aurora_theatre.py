"""
Crawler for Aurora Theatre (auroratheatre.com).
Professional theater in Lawrenceville with mainstage productions and family shows.

Site structure: Shows at /productions-and-programs/ with /view/[slug]/ pattern.
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

BASE_URL = "https://www.auroratheatre.com"
PRODUCTIONS_URL = f"{BASE_URL}/productions-and-programs/"

VENUE_DATA = {
    "name": "Aurora Theatre",
    "slug": "aurora-theatre",
    "address": "128 E Pike St",
    "neighborhood": "Downtown Lawrenceville",
    "city": "Lawrenceville",
    "state": "GA",
    "zip": "30046",
    "lat": 33.9562,
    "lng": -83.9880,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|register|account)$",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|policy|copyright)$",
    r"^(season \d+|subscription|flex pass|star pass)$",
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
    - "Jan 22, 2026-Feb 15, 2026" (with comma before dash)
    - "Jan 22 - Feb 15, 2026"
    - "February 7, 2026" (single day)
    - "Mar 26, 2026-Apr 19, 2026"
    """
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Pattern: "Mon Day, Year-Mon Day, Year" (e.g., "Jan 22, 2026-Feb 15, 2026")
    full_range_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})\s*[-–—]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if full_range_match:
        start_month, start_day, start_year, end_month, end_day, end_year = full_range_match.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {start_year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {end_year}", "%b %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: "Mon Day - Mon Day, Year" (different months, same year)
    range_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–—]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if range_match:
        start_month, start_day, end_month, end_day, year = range_match.groups()
        try:
            # Handle abbreviated months
            fmt = "%b %d %Y" if len(start_month) <= 3 else "%B %d %Y"
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", fmt)
            fmt = "%b %d %Y" if len(end_month) <= 3 else "%B %d %Y"
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Same month range "Jan 12 - 15, 2026"
    same_month_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–—]\s*(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if same_month_match:
        month, start_day, end_day, year = same_month_match.groups()
        try:
            fmt = "%b %d %Y" if len(month) <= 3 else "%B %d %Y"
            start_dt = datetime.strptime(f"{month} {start_day} {year}", fmt)
            end_dt = datetime.strptime(f"{month} {end_day} {year}", fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date
    single_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if single_match:
        month, day, year = single_match.groups()
        try:
            fmt = "%b %d %Y" if len(month) <= 3 else "%B %d %Y"
            dt = datetime.strptime(f"{month} {day} {year}", fmt)
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Aurora Theatre productions."""
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

            logger.info(f"Fetching Aurora Theatre: {PRODUCTIONS_URL}")
            page.goto(PRODUCTIONS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Aurora uses /productions-and-programs/view/[slug]/ URLs
            show_links = page.query_selector_all('a[href*="/view/"]')

            show_urls = set()
            for link in show_links:
                href = link.get_attribute("href")
                if href and "/view/" in href:
                    # Skip archive pages
                    if "archive" in href.lower():
                        continue
                    full_url = href if href.startswith("http") else BASE_URL + href
                    show_urls.add(full_url)

            logger.info(f"Found {len(show_urls)} show pages")

            # Process each show page
            for show_url in show_urls:
                try:
                    page.goto(show_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(3000)

                    # Get title from H1
                    title = None
                    h1 = page.query_selector("h1")
                    if h1:
                        title = h1.inner_text().strip()

                    if not title:
                        # Extract from URL
                        match = re.search(r"/view/([^/]+)/?", show_url)
                        if match:
                            title = match.group(1).replace("-", " ").title()

                    if not title or not is_valid_title(title):
                        logger.debug(f"Skipping invalid title: {title}")
                        continue

                    # Get dates from H2 tag (dates are consistently in the first H2)
                    start_date, end_date = None, None
                    h2 = page.query_selector("h2")
                    if h2:
                        date_text = h2.inner_text().strip()
                        start_date, end_date = parse_date_range(date_text)

                    if not start_date:
                        logger.debug(f"No dates found for {title}")
                        continue

                    # Skip past shows
                    check_date = end_date or start_date
                    try:
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past show: {title} ({check_date})")
                            continue
                    except ValueError:
                        pass

                    # Get description - it's typically in the ABOUT section
                    description = None
                    body_text = page.inner_text("body")

                    # Look for text after "ABOUT" section
                    about_match = re.search(r'ABOUT\s+(.*?)(?:Buy Tickets|MEDIA|January|February|March|April|May|June|July|August|September|October|November|December|\n\n\n)', body_text, re.DOTALL)
                    if about_match:
                        desc = about_match.group(1).strip()
                        # Remove program/runtime details
                        desc = re.sub(r'(Metro Waterproofing Main Stage|Runtime:.*|Content Advisory:.*)', '', desc, flags=re.DOTALL)
                        desc = desc.strip()
                        if len(desc) > 30:
                            description = desc[:800]

                    # Get image - look for production images, not the program button
                    image_url = None
                    imgs = page.query_selector_all("img")
                    for img in imgs:
                        src = img.get_attribute("src") or img.get_attribute("data-src")
                        if src and "logo" not in src.lower() and "Program_WebButton" not in src:
                            # Prefer scaled.jpeg or large production images
                            if "scaled" in src or any(word in src for word in ["/PTGW-", "/Flat", "/Heights", "/Initiative"]):
                                image_url = src if src.startswith("http") else BASE_URL + src
                                break

                    # Fallback: get any non-logo image
                    if not image_url:
                        for img in imgs:
                            src = img.get_attribute("src") or img.get_attribute("data-src")
                            if src and "logo" not in src.lower() and "Program_WebButton" not in src and "wp-content/uploads" in src:
                                image_url = src if src.startswith("http") else BASE_URL + src
                                break

                    # Determine category based on title/content
                    category = "theater"
                    subcategory = "play"
                    tags = ["aurora-theatre", "theater", "lawrenceville", "gwinnett"]

                    if any(word in title.lower() for word in ["musical", "heights", "chorus"]):
                        subcategory = "musical"
                        tags.append("musical")
                    elif any(word in body_text.lower() for word in ["children", "kids", "family", "playhouse"]):
                        tags.append("family")
                        tags.append("kids")

                    events_found += 1

                    content_hash = generate_content_hash(title, "Aurora Theatre", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at Aurora Theatre",
                        "start_date": start_date,
                        "start_time": "19:30",  # Aurora typically starts at 7:30
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
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
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} ({start_date} to {end_date})")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process {show_url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Aurora Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Aurora Theatre: {e}")
        raise

    return events_found, events_new, events_updated
