"""
Crawler for Kai Lin Art.
Contemporary art gallery in Inman Park.

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import extract_images_from_page, extract_event_links, find_event_url, parse_date_range

logger = logging.getLogger(__name__)

BASE_URL = "https://www.kailinart.com"
EVENTS_URL = f"{BASE_URL}/exhibitions"

VENUE_DATA = {
    "name": "Kai Lin Art",
    "slug": "kai-lin-art",
    "address": "404 Bishop St NW",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "venue_type": "gallery",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0
    exhibition_envelope = TypedEntityEnvelope()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Kai Lin Art: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            i = 0
            while i < len(lines):
                line = lines[i]

                if len(line) < 3:
                    i += 1
                    continue

                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    title = None
                    start_time = None

                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            if re.match(r"(January|February|March)", check_line, re.IGNORECASE):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|\$|more info)", check_line.lower()):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        # If no explicit year was in the text, assume current/next year
                        if not date_match.group(3) and dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Skip past exhibitions (more than 6 months ago)
                    if dt.date() < (datetime.now() - timedelta(days=180)).date():
                        i += 1
                        continue

                    events_found += 1

                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    # Date range extraction: scan surrounding lines for end dates
                    context_start = max(0, i - 3)
                    context_end = min(len(lines), i + 5)
                    range_text = " ".join(lines[context_start:context_end])
                    _, closing_date = parse_date_range(range_text)

                    record, artists = build_exhibition_record(
                        title=title,
                        venue_id=venue_id,
                        source_id=source_id,
                        opening_date=start_date,
                        closing_date=closing_date,
                        venue_name=VENUE_DATA["name"],
                        description="Exhibition at Kai Lin Art",
                        image_url=image_map.get(title),
                        source_url=event_url,
                        portal_id=portal_id,
                        admission_type="free",
                        tags=["art", "gallery", "contemporary", "inman-park", "exhibition"],
                    )
                    if artists:
                        record["artists"] = artists
                    exhibition_envelope.add("exhibitions", record)
                    events_new += 1
                    logger.info(f"Queued exhibition: {title} on {start_date}")

                i += 1

            browser.close()

        if exhibition_envelope.has_records():
            persist_typed_entity_envelope(exhibition_envelope)
            ex_count = len(exhibition_envelope.exhibitions)
            logger.info(f"Kai Lin Art: persisted {ex_count} exhibition(s) to exhibitions table")

        logger.info(f"Kai Lin Art crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Kai Lin Art: {e}")
        raise

    return events_found, events_new, events_updated
