"""
Crawler for Brooklyn Bowl Nashville (brooklynbowl.com/nashville/shows/all).

Music venue and bowling alley in Germantown, part of Brooklyn Bowl chain.
Uses JavaScript rendering for event listings.

DOM structure:
- .eventItem containers
- .m-date__month / .m-date__day for date (e.g., "02" / "04")
- .m-date__weekday for day of week (e.g., "Wed")
- .doors for time text (e.g., "Doors: 9:00 PM / Show: 9:30 PM")
- .title h3 a for event title and link
- .tagline for supporting acts
- img for event image
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug, remove_stale_source_events
from dedupe import generate_content_hash

PORTAL_SLUG = "nashville"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.brooklynbowl.com"
CALENDAR_URL = f"{BASE_URL}/nashville/shows/all"

VENUE_DATA = {
    "name": "Brooklyn Bowl Nashville",
    "slug": "brooklyn-bowl-nashville",
    "address": "925 3rd Ave N",
    "neighborhood": "Germantown",
    "city": "Nashville",
    "state": "TN",
    "zip": "37201",
    "lat": 36.1730,
    "lng": -86.7784,
    "venue_type": "music_venue",
    "website": f"{BASE_URL}/nashville",
}


def _parse_time(time_text: str) -> Optional[str]:
    """Parse time text to HH:MM 24-hour format."""
    if not time_text:
        return None
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        period = match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Brooklyn Bowl Nashville events using Playwright DOM extraction."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

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

            logger.info(f"Fetching Brooklyn Bowl Nashville: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract events from rendered DOM
            raw_events = page.evaluate("""() => {
                const containers = document.querySelectorAll('.eventItem');
                const results = [];

                containers.forEach(c => {
                    // Extract title from h3
                    const titleEl = c.querySelector('h3 a, h3');
                    const title = titleEl ? titleEl.textContent.trim() : '';
                    if (!title) return;

                    // Skip CLOSED and TBA events
                    if (/^closed/i.test(title)) return;
                    if (/^(tba|tbd|tbc)$/i.test(title.replace(/[^a-zA-Z]/g, ''))) return;

                    // Extract event URL from the thumb link or title link
                    const linkEl = c.querySelector('a[href*="/events/detail/"]') || c.querySelector('h3 a');
                    let eventUrl = linkEl ? linkEl.href : '';

                    // Extract date from aria-label on .date.outside div
                    // Format: "February  7 2026"
                    const dateOutside = c.querySelector('.date.outside');
                    const ariaLabel = dateOutside ? dateOutside.getAttribute('aria-label') || '' : '';

                    // Extract time from .time element (contains both doors and show)
                    // Format: "Doors: 4:30 PM / Show: 5:30 PM"
                    const timeEl = c.querySelector('.time');
                    const timeText = timeEl ? timeEl.textContent.trim() : '';

                    // Extract tagline (supporting acts)
                    const taglineEl = c.querySelector('.tagline');
                    const tagline = taglineEl ? taglineEl.textContent.trim() : '';

                    // Extract image from thumb
                    const imgEl = c.querySelector('.thumb img');
                    const image = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

                    results.push({
                        title: title,
                        ariaDate: ariaLabel,
                        timeText: timeText,
                        tagline: tagline,
                        image: image,
                        eventUrl: eventUrl,
                    });
                });

                return results;
            }""")

            logger.info(f"Found {len(raw_events)} events in DOM")

            now = datetime.now()

            for event_data in raw_events:
                try:
                    title = event_data.get("title", "").strip()
                    if not title or len(title) < 2:
                        continue

                    # Parse date from aria-label: "February  7 2026"
                    aria_date = event_data.get("ariaDate", "")
                    if not aria_date:
                        continue

                    date_match = re.search(r"([A-Za-z]+)\s+(\d+)\s+(\d{4})", aria_date)
                    if not date_match:
                        logger.debug(f"Could not parse date from '{aria_date}' for '{title}'")
                        continue

                    month_name, day, year = date_match.groups()
                    try:
                        event_dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
                        date_str = event_dt.strftime("%Y-%m-%d")
                    except ValueError:
                        logger.debug(f"Invalid date '{month_name} {day} {year}' for '{title}'")
                        continue

                    # Parse time from time text
                    # Format: "Doors: 9:00 PM / Show: 9:30 PM"
                    start_time = None
                    combined_time = event_data.get("timeText", "")

                    # Prefer "Show:" time over "Doors:" time
                    show_match = re.search(r"Show:?\s*(\d{1,2}(?::\d{2})?\s*[AP]M)", combined_time, re.IGNORECASE)
                    doors_match = re.search(r"Doors:?\s*(\d{1,2}(?::\d{2})?\s*[AP]M)", combined_time, re.IGNORECASE)

                    if show_match:
                        start_time = _parse_time(show_match.group(1))
                    elif doors_match:
                        start_time = _parse_time(doors_match.group(1))
                    else:
                        # Fallback: any time pattern
                        any_time = re.search(r"(\d{1,2}(?::\d{2})?\s*[AP]M)", combined_time, re.IGNORECASE)
                        if any_time:
                            start_time = _parse_time(any_time.group(1))

                    # Default to 20:00 for music venue if no time found
                    if not start_time:
                        start_time = "20:00"

                    events_found += 1
                    content_hash = generate_content_hash(title, "Brooklyn Bowl Nashville", date_str)
                    seen_hashes.add(content_hash)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Build description from tagline
                    tagline = event_data.get("tagline", "")
                    description = tagline if tagline else None

                    image_url = event_data.get("image") or None
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + image_url

                    event_url = event_data.get("eventUrl") or CALENDAR_URL
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "portal_id": portal_id,
                        "title": title,
                        "description": description,
                        "start_date": date_str,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["brooklyn-bowl", "nashville", "live-music", "germantown"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": CALENDAR_URL,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_str} - {combined_time}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {date_str} at {start_time}")

                except Exception as e:
                    logger.error(f"Failed to parse event: {e}")
                    continue

            browser.close()

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info(f"Removed {stale_removed} stale events")

        logger.info(
            f"Brooklyn Bowl Nashville crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Brooklyn Bowl Nashville: {e}")
        raise

    return events_found, events_new, events_updated
