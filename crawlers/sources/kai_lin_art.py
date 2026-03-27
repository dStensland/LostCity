"""
Crawler for Kai Lin Art.
Contemporary art gallery in Inman Park.

Site uses Squarespace with JavaScript rendering — must use Playwright.
The exhibition list is rendered client-side; the static HTML contains grid
item containers with no text or links (verified 2026-03-25 via curl).

Improvements made 2026-03-25:
- Added retry logic with exponential backoff on page.goto()
- Added request interception to block images/fonts/tracking (faster load)
- Added random delay between scrolls (rate limiting)
- Improved error handling
"""

from __future__ import annotations

import logging
import random
import re
import time
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from db import get_or_create_venue
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import extract_images_from_page, extract_event_links, find_event_url, parse_date_range

logger = logging.getLogger(__name__)

BASE_URL = "https://www.kailinart.com"
EVENTS_URL = f"{BASE_URL}/exhibitions"

# Domains to block via request interception (speeds up load, reduces bot signals)
_BLOCKED_DOMAINS = {
    "google-analytics.com",
    "googletagmanager.com",
    "facebook.com",
    "doubleclick.net",
    "squarespace-cdn.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
}

_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 2.0  # seconds

VENUE_DATA = {
    "name": "Kai Lin Art",
    "slug": "kai-lin-art",
    "address": "999 Brady Ave NW #7",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7817,
    "lng": -84.4130,
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


def _should_block_request(url: str) -> bool:
    """Return True if this request should be blocked to speed up page load."""
    for domain in _BLOCKED_DOMAINS:
        if domain in url:
            return True
    return False


def _navigate_with_retry(page, url: str) -> bool:
    """
    Navigate to a URL with exponential backoff retry on timeout/error.
    Returns True on success, False after all retries exhausted.
    """
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            return True
        except PlaywrightTimeoutError:
            delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1)) + random.uniform(0.5, 1.5)
            logger.warning(
                "Kai Lin Art: timeout on attempt %d/%d for %s — retrying in %.1fs",
                attempt,
                _MAX_RETRIES,
                url,
                delay,
            )
            if attempt < _MAX_RETRIES:
                time.sleep(delay)
        except Exception as exc:
            delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1)) + random.uniform(0.5, 1.5)
            logger.warning(
                "Kai Lin Art: navigation error on attempt %d/%d: %s — retrying in %.1fs",
                attempt,
                _MAX_RETRIES,
                exc,
                delay,
            )
            if attempt < _MAX_RETRIES:
                time.sleep(delay)

    logger.error("Kai Lin Art: all %d navigation attempts failed for %s", _MAX_RETRIES, url)
    return False


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
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Block images, fonts, and tracking to reduce load time and bot signals
            def handle_route(route):
                if _should_block_request(route.request.url):
                    route.abort()
                elif route.request.resource_type in ("image", "font", "media"):
                    route.abort()
                else:
                    route.continue_()

            page.route("**/*", handle_route)

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info("Kai Lin Art: fetching %s", EVENTS_URL)
            if not _navigate_with_retry(page, EVENTS_URL):
                browser.close()
                return 0, 0, 0

            # Wait for JS to render
            page.wait_for_timeout(3000)

            # Extract images and event links before scrolling
            image_map = extract_images_from_page(page)
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to trigger lazy-loaded content
            for scroll_num in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                # Random delay 2-5s to appear more human
                delay_ms = random.randint(2000, 5000)
                page.wait_for_timeout(delay_ms)
                logger.debug("Kai Lin Art: scroll %d/5 (waited %dms)", scroll_num + 1, delay_ms)

            body_text = page.inner_text("body")
            lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]

            i = 0
            while i < len(lines):
                line = lines[i]

                if len(line) < 3:
                    i += 1
                    continue

                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*"
                    r"(January|February|March|April|May|June|July|August|September|October|November|December|"
                    r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE,
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
                                    if not re.match(
                                        r"(free|tickets|register|\$|more info)",
                                        check_line.lower(),
                                    ):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        # If no explicit year in text, roll forward if date has passed
                        if not date_match.group(3) and dt.date() < datetime.now().date():
                            dt = datetime.strptime(
                                f"{month_str} {day} {int(year) + 1}", "%b %d %Y"
                            )
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Skip exhibitions that closed more than 6 months ago
                    if dt.date() < (datetime.now() - timedelta(days=180)).date():
                        i += 1
                        continue

                    events_found += 1

                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    # Scan surrounding lines for date range / closing date
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
                        tags=["art", "gallery", "contemporary", "west-midtown", "exhibition"],
                    )
                    if artists:
                        record["artists"] = artists
                    exhibition_envelope.add("exhibitions", record)
                    events_new += 1
                    logger.info("Kai Lin Art queued exhibition: %r on %s", title, start_date)

                i += 1

            browser.close()

        if exhibition_envelope.has_records():
            persist_typed_entity_envelope(exhibition_envelope)
            ex_count = len(exhibition_envelope.exhibitions)
            logger.info("Kai Lin Art: persisted %d exhibition(s) to exhibitions table", ex_count)

        logger.info(
            "Kai Lin Art crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Kai Lin Art: %s", exc)
        raise

    return events_found, events_new, events_updated
