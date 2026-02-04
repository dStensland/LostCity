"""
Crawler for Exit/In (exitin.com/calendar).

Historic Nashville music venue since 1971, located in Midtown.
Uses TicketWeb "Event Discovery" WordPress plugin.
The calendar listing page shows event names, dates, and images but NOT times.
Times (doors/starts) are only on individual event detail pages.

Strategy:
1. Load /calendar/ with Playwright, wait for TicketWeb widget (#tw-responsive)
2. Extract event list from .tw-section elements (title, date, image, detail URL)
3. Visit each detail page to get doors/starts time
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, remove_stale_source_events
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://exitin.com"
CALENDAR_URL = f"{BASE_URL}/calendar/"

VENUE_DATA = {
    "name": "Exit/In",
    "slug": "exit-in",
    "address": "2208 Elliston Pl",
    "neighborhood": "Midtown",
    "city": "Nashville",
    "state": "TN",
    "zip": "37203",
    "lat": 36.1519,
    "lng": -86.7985,
    "venue_type": "music_venue",
    "website": BASE_URL,
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


def _parse_listing_date(date_text: str) -> Optional[str]:
    """Parse date from listing like 'Feb 5' or 'Saturday February 07' to YYYY-MM-DD."""
    if not date_text:
        return None
    date_text = date_text.strip()
    # Remove day-of-week prefix if present
    date_text = re.sub(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+", "", date_text, flags=re.IGNORECASE)
    for fmt in ("%b %d", "%B %d", "%b %d, %Y", "%B %d, %Y"):
        try:
            dt = datetime.strptime(date_text.strip(), fmt)
            if "%Y" not in fmt:
                now = datetime.now()
                dt = dt.replace(year=now.year)
                if dt.date() < now.date():
                    dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Exit/In events from TicketWeb widget + detail pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            # Step 1: Load calendar listing
            logger.info(f"Fetching Exit/In: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            try:
                page.wait_for_selector("#tw-responsive .tw-section", timeout=15000)
            except Exception:
                logger.warning("TicketWeb widget did not render")
                browser.close()
                return 0, 0, 0
            page.wait_for_timeout(3000)

            # Step 2: Extract event list from .tw-section elements
            listing_events = page.evaluate("""() => {
                const sections = document.querySelectorAll("#tw-responsive .tw-section");
                const results = [];
                sections.forEach(section => {
                    const nameEl = section.querySelector(".tw-name a, .tw-name");
                    const dateEl = section.querySelector(".tw-date-time");
                    const imgEl = section.querySelector("img.event-img, .tw-image img, img");
                    const detailLink = section.querySelector(".tw-name a, a.tw-more-info-btn");
                    const ticketLink = section.querySelector("a.tw-buy-tix-btn, a[href*='ticketweb']");

                    results.push({
                        title: nameEl ? nameEl.textContent.trim() : "",
                        date: dateEl ? dateEl.textContent.trim() : "",
                        image: imgEl ? imgEl.src : null,
                        detailUrl: detailLink ? detailLink.href : null,
                        ticketUrl: ticketLink ? ticketLink.href : null,
                    });
                });
                return results;
            }""")

            logger.info(f"Found {len(listing_events)} events in listing")

            # Step 3: Visit each detail page to get times
            for event_data in listing_events:
                try:
                    title = event_data.get("title", "").strip()
                    # Clean up title - remove SOLD OUT prefix
                    title = re.sub(r"^\*?\s*SOLD\s+OUT\s*\*?\s*", "", title, flags=re.IGNORECASE).strip()
                    if not title or len(title) < 2:
                        continue

                    start_date = _parse_listing_date(event_data.get("date", ""))
                    if not start_date:
                        logger.debug(f"Could not parse date '{event_data.get('date')}' for '{title}'")
                        continue

                    events_found += 1
                    content_hash = generate_content_hash(title, "Exit/In", start_date)
                    seen_hashes.add(content_hash)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Visit detail page for times
                    start_time = None
                    detail_url = event_data.get("detailUrl")
                    if detail_url:
                        try:
                            page.goto(detail_url, wait_until="domcontentloaded", timeout=15000)
                            try:
                                page.wait_for_selector("#tw-responsive", timeout=8000)
                            except Exception:
                                pass
                            page.wait_for_timeout(2000)

                            detail_text = page.evaluate("""() => {
                                const tw = document.querySelector("#tw-responsive");
                                return tw ? tw.textContent : document.body.textContent;
                            }""")

                            # Look for "STARTS X:XX pm" first (show time), then "DOORS X:XX pm"
                            starts_match = re.search(
                                r"STARTS?\s+(\d{1,2}(?::\d{2})?\s*[ap]m)", detail_text, re.IGNORECASE
                            )
                            doors_match = re.search(
                                r"DOORS?\s+(\d{1,2}(?::\d{2})?\s*[ap]m)", detail_text, re.IGNORECASE
                            )

                            if starts_match:
                                start_time = _parse_time(starts_match.group(1))
                            elif doors_match:
                                start_time = _parse_time(doors_match.group(1))
                            else:
                                # Fallback: any time on the page
                                any_time = re.search(
                                    r"(\d{1,2}(?::\d{2})?\s*[ap]m)", detail_text, re.IGNORECASE
                                )
                                if any_time:
                                    start_time = _parse_time(any_time.group(1))

                        except Exception as e:
                            logger.debug(f"Could not load detail page for '{title}': {e}")

                    # Default to 20:00 for a music venue if no time found
                    if not start_time:
                        start_time = "20:00"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["exit-in", "nashville", "live-music", "midtown"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": CALENDAR_URL,
                        "ticket_url": event_data.get("ticketUrl") or detail_url,
                        "image_url": event_data.get("image"),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time}")

                except Exception as e:
                    logger.error(f"Failed to parse event: {e}")
                    continue

            browser.close()

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info(f"Removed {stale_removed} stale events")

        logger.info(
            f"Exit/In crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Exit/In: {e}")
        raise

    return events_found, events_new, events_updated
