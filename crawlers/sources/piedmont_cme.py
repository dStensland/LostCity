"""
Crawler for Piedmont Healthcare CME/CE Portal (piedmont.cloud-cme.com).

Professional education and clinical conferences for healthcare professionals.
Events include CME-accredited courses, conferences, and certification programs.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page

# Portal ID for Piedmont-exclusive events
PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://piedmont.cloud-cme.com"
# Main conference page and general CME listing
URLS_TO_CRAWL = [
    f"{BASE_URL}/APCC2025",  # Annual Primary Care Conference
    f"{BASE_URL}/default.aspx",  # Main CME listing
]

VENUE_DATA = {
    "name": "Piedmont Healthcare CME",
    "slug": "piedmont-healthcare-cme",
    "address": "1968 Peachtree Road NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "hospital",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    date_text = date_text.strip()

    patterns = [
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        r"(\d{1,2})/(\d{1,2})/(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            groups = match.groups()
            if len(groups) == 3:
                if groups[0].isdigit():
                    # MM/DD/YYYY
                    try:
                        dt = datetime(int(groups[2]), int(groups[0]), int(groups[1]))
                        return dt.strftime("%Y-%m-%d")
                    except ValueError:
                        continue
                else:
                    # Month DD, YYYY
                    try:
                        dt = datetime.strptime(f"{groups[0]} {groups[1]} {groups[2]}", "%B %d %Y")
                        return dt.strftime("%Y-%m-%d")
                    except ValueError:
                        continue

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont CME portal using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)
            seen_events = set()

            for url in URLS_TO_CRAWL:
                try:
                    logger.info(f"Fetching Piedmont CME: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Extract images from page
                    image_map = extract_images_from_page(page)

                    # Scroll to load content
                    for _ in range(3):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    body_text = page.inner_text("body")
                    lines = [line.strip() for line in body_text.split("\n") if line.strip()]

                    skip_items = [
                        "home", "login", "register", "contact", "support", "search",
                        "menu", "piedmont", "cloud-cme", "my cme", "transcript",
                    ]

                    i = 0
                    while i < len(lines):
                        line = lines[i]
                        line_lower = line.lower()

                        if line_lower in skip_items or len(line) < 5:
                            i += 1
                            continue

                        # Look for date patterns
                        date_match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:-\d{1,2})?,?\s+\d{4}",
                            line,
                            re.IGNORECASE
                        )

                        if date_match:
                            date_text = date_match.group(0)
                            date_text = re.sub(r"-\d{1,2}", "", date_text)
                            start_date = parse_date(date_text)

                            if not start_date:
                                i += 1
                                continue

                            try:
                                event_date = datetime.strptime(start_date, "%Y-%m-%d")
                                if event_date.date() < datetime.now().date():
                                    i += 1
                                    continue
                            except ValueError:
                                i += 1
                                continue

                            # Look for title in surrounding lines
                            title = None
                            description = None

                            for offset in range(-5, 0):
                                idx = i + offset
                                if 0 <= idx < len(lines):
                                    check_line = lines[idx].strip()
                                    if check_line.lower() in skip_items:
                                        continue
                                    if 10 < len(check_line) < 150:
                                        if not re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d", check_line, re.IGNORECASE):
                                            title = check_line
                                            break

                            for offset in range(1, 6):
                                idx = i + offset
                                if idx < len(lines):
                                    check_line = lines[idx].strip()
                                    if len(check_line) > 50 and not description:
                                        description = check_line[:500]
                                        break

                            if not title:
                                i += 1
                                continue

                            event_key = f"{title}|{start_date}"
                            if event_key in seen_events:
                                i += 1
                                continue
                            seen_events.add(event_key)

                            events_found += 1

                            content_hash = generate_content_hash(
                                title, VENUE_DATA["name"], start_date
                            )


                            tags = ["piedmont", "healthcare", "cme", "medical-education", "professional"]

                            if "primary care" in title.lower():
                                tags.extend(["primary-care", "conference"])
                            if "arrhythmia" in title.lower() or "cardiac" in title.lower():
                                tags.extend(["cardiology", "heart"])

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "portal_id": portal_id,
                                "title": title,
                                "description": description,
                                "start_date": start_date,
                                "start_time": None,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": True,
                                "category": "learning",
                                "subcategory": "medical-education",
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": "CME registration required - see website for pricing",
                                "is_free": False,
                                "source_url": url,
                                "ticket_url": url,
                                "image_url": image_map.get(title),
                                "raw_text": f"{title} - {start_date}",
                                "extraction_confidence": 0.85,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                smart_update_existing_event(existing, event_record)
                                events_updated += 1
                                i += 1
                                continue

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {title} on {start_date}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                        i += 1

                except Exception as e:
                    logger.error(f"Error crawling {url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Piedmont CME crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont CME: {e}")
        raise

    return events_found, events_new, events_updated
