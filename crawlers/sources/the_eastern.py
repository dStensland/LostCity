"""
Crawler for The Eastern (easternatl.com).

Major 2,500-capacity music venue in Grant Park. Opened 2021.
Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timezone
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from description_fetcher import fetch_detail_html_playwright
from pipeline.detail_enrich import enrich_from_detail
from pipeline.models import DetailConfig
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://easternatl.com"
EVENTS_URL = BASE_URL

PLACE_DATA = {
    "name": "The Eastern",
    "slug": "the-eastern",
    "address": "777 Memorial Dr SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7401,
    "lng": -84.3511,
    "place_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
}


def goto_with_retry(
    page,
    url: str,
    *,
    attempts: int = 3,
    timeout_ms: int = 45000,
    wait_until: str = "domcontentloaded",
) -> None:
    """Navigate with retry/backoff for transient timeout/network failures."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            page.goto(url, wait_until=wait_until, timeout=timeout_ms)
            return
        except Exception as exc:  # noqa: BLE001 - crawler retry guard
            last_exc = exc
            if attempt >= attempts:
                raise
            page.wait_for_timeout(1500 * attempt)
    if last_exc:
        raise last_exc


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
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
    """Crawl The Eastern events using Playwright."""
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

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching The Eastern: {EVENTS_URL}")
            goto_with_retry(
                page,
                EVENTS_URL,
                attempts=3,
                timeout_ms=45000,
                wait_until="domcontentloaded",
            )
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # The Eastern format: "FRI, FEB 6, 2026 7:30 PM" with artist name on previous lines
            # Pattern: DAY, MON DD, YYYY H:MM PM
            date_pattern = re.compile(
                r"^(?:MON|TUE|WED|THU|FRI|SAT|SUN),?\s+"
                r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+"
                r"(\d{1,2}),?\s+"
                r"(\d{4})\s+"
                r"(\d{1,2}):(\d{2})\s*(AM|PM)",
                re.IGNORECASE
            )

            i = 0
            new_events: list[dict] = []
            while i < len(lines):
                line = lines[i]

                # Look for date pattern like "FRI, FEB 6, 2026 7:30 PM"
                date_match = date_pattern.match(line)

                if date_match:
                    month_str = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3)
                    hour = int(date_match.group(4))
                    minute = date_match.group(5)
                    period = date_match.group(6).upper()

                    # Convert to 24-hour time
                    if period == "PM" and hour != 12:
                        hour += 12
                    elif period == "AM" and hour == 12:
                        hour = 0
                    start_time = f"{hour:02d}:{minute}"

                    # Parse date
                    try:
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Look for title in previous lines (artist name comes before date)
                    title = None
                    for offset in range(-1, -5, -1):
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            # Skip navigation, times, tickets, short lines
                            if len(check_line) < 3:
                                continue
                            if date_pattern.match(check_line):
                                continue
                            skip_words = ["tickets", "calendar", "venue", "getting", "dining",
                                         "rental", "upgrades", "doors", "show", "upcoming"]
                            if any(w in check_line.lower() for w in skip_words):
                                continue
                            if re.match(r"^\d+:\d+\s*(am|pm)", check_line, re.IGNORECASE):
                                continue
                            # Found title
                            title = check_line
                            break

                    if not title or len(title) < 3:
                        i += 1
                        continue

                    events_found += 1

                    hash_key = f"{start_date}|{start_time}" if start_time else start_date
                    content_hash = generate_content_hash(title, "The Eastern", hash_key)

                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["live-music", "concert", "grant-park"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
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

                    new_events.append(event_record)

                i += 1

            # Fetch detail pages for new events (capped at 20) to extract
            # ticket_status, price_min/max from AXS JSON-LD.
            detail_page = context.new_page()
            detail_fetches = 0
            detail_config = DetailConfig()
            for evt in new_events:
                title = evt["title"]
                detail_url = evt.get("source_url")
                if detail_url and detail_url != EVENTS_URL and detail_fetches < 20:
                    html = fetch_detail_html_playwright(detail_page, detail_url)
                    if html:
                        fields = enrich_from_detail(html, detail_url, "The Eastern", detail_config)
                        if fields.get("ticket_status") and not evt.get("ticket_status"):
                            evt["ticket_status"] = fields["ticket_status"]
                            evt["ticket_status_checked_at"] = datetime.now(timezone.utc).isoformat()
                        if fields.get("price_min") is not None and evt.get("price_min") is None:
                            evt["price_min"] = fields["price_min"]
                        if fields.get("price_max") is not None and evt.get("price_max") is None:
                            evt["price_max"] = fields["price_max"]
                        if fields.get("description") and not evt.get("description"):
                            evt["description"] = fields["description"]
                        if fields.get("doors_time") and not evt.get("doors_time"):
                            evt["doors_time"] = fields["doors_time"]
                        if fields.get("image_url") and not evt.get("image_url"):
                            evt["image_url"] = fields["image_url"]
                    detail_fetches += 1
                    page.wait_for_timeout(1000)

                try:
                    enrich_event_record(evt, "The Eastern")
                    insert_event(evt)
                    events_new += 1
                    logger.info(f"Added: {title} on {evt['start_date']}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            detail_page.close()
            browser.close()

        logger.info(
            f"The Eastern crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Eastern: {e}")
        raise

    return events_found, events_new, events_updated
