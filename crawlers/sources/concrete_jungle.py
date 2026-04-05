"""
Crawler for Concrete Jungle (concrete-jungle.org).

Fruit gleaning nonprofit that picks fruit from trees around Atlanta and
donates to food banks. Very Atlanta-specific, beloved local org.

Uses the Airtable embed CSV download. The site embeds an Airtable shared view
(shrLr48ircCprxRSF) for their volunteer calendar. Playwright loads the embed
and clicks "Download CSV" to get structured event data with titles, dates,
times, descriptions, locations, and capacity.
"""

from __future__ import annotations

import csv
import os
import re
import logging
import tempfile
from datetime import datetime, date
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
    update_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.concrete-jungle.org"
VOLUNTEER_URL = f"{BASE_URL}/volunteer/atlanta"
AIRTABLE_EMBED_URL = "https://airtable.com/embed/shrLr48ircCprxRSF"

PLACE_DATA = {
    "name": "Concrete Jungle",
    "slug": "concrete-jungle",
    "address": "1080 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7630,
    "lng": -84.3480,
    "place_type": "nonprofit_hq",
    "spot_type": "nonprofit_hq",
    "website": BASE_URL,
    "vibes": ["outdoor-seating", "casual"],
}


def parse_date_from_title(title: str) -> Optional[str]:
    """Extract date from title format 'Event Name - MM/DD/YYYY'."""
    match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', title)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def parse_time_range(time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse time range string to 24-hour start/end times.
    Examples: '10:00AM - 1:00PM', '2PM - 3PM', '10:00 AM - 2:00 PM'
    """
    if not time_str:
        return None, None

    def parse_single_time(t: str) -> Optional[str]:
        t = t.strip().upper()
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', t)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)
            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None

    parts = re.split(r'\s*-\s*', time_str)
    start_time = parse_single_time(parts[0]) if len(parts) >= 1 else None
    end_time = parse_single_time(parts[1]) if len(parts) >= 2 else None
    return start_time, end_time


def clean_title(title: str) -> str:
    """Remove the date suffix from the title (e.g. ' - 02/15/2026')."""
    return re.sub(r'\s*-\s*\d{1,2}/\d{1,2}/\d{4}\s*$', '', title).strip()


def is_full_event(title: str, spots: str = "") -> bool:
    """Skip sold-out rows that are no longer actionable for users."""
    title_lower = (title or "").strip().lower()
    spots_lower = (spots or "").strip().lower()
    return (
        title_lower.startswith("full:")
        or spots_lower in {"0", "full", "sold out", "waitlist"}
    )


def _sync_existing_event(existing: dict, incoming: dict) -> None:
    """Remove stale volunteer/free metadata when the source record changes shape."""
    direct_updates = {}

    field_pairs = (
        ("category_id", incoming.get("category")),
        ("tags", incoming.get("tags")),
        ("price_min", incoming.get("price_min")),
        ("price_max", incoming.get("price_max")),
        ("price_note", incoming.get("price_note")),
        ("is_free", incoming.get("is_free")),
        ("ticket_url", incoming.get("ticket_url")),
        ("source_url", incoming.get("source_url")),
    )

    for existing_field, incoming_value in field_pairs:
        if existing.get(existing_field) != incoming_value:
            direct_updates[existing_field] = incoming_value

    if direct_updates:
        update_event(existing["id"], direct_updates)
        existing = {**existing, **direct_updates}

    smart_update_existing_event(existing, incoming)


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["pick", "glean", "harvest", "fruit", "tree", "orchard", "muscadine"]):
        tags = ["concrete-jungle", "food", "volunteer", "outdoors", "gleaning"]
        return "community", "volunteer", tags

    if any(word in text for word in ["workshop", "class", "training", "learn", "education",
                                      "compost", "gardening", "sewing", "seed swap"]):
        tags = ["concrete-jungle", "food", "education"]
        if any(word in text for word in ["farm", "doghead"]):
            tags.append("outdoors")
        return "learning", "workshop", tags

    if any(word in text for word in ["farm volunteer", "farm day"]):
        tags = ["concrete-jungle", "food", "volunteer", "outdoors"]
        return "community", "volunteer", tags

    return "community", "volunteer", ["concrete-jungle", "food", "volunteer"]


def download_airtable_csv() -> list[dict]:
    """Download CSV from Airtable embed using Playwright."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        try:
            logger.info(f"Loading Airtable embed: {AIRTABLE_EMBED_URL}")
            page.goto(AIRTABLE_EMBED_URL, wait_until='load', timeout=45000)
            page.wait_for_timeout(15000)

            csv_link = page.locator('text=Download CSV')
            if csv_link.count() == 0:
                logger.warning("No 'Download CSV' link found on Airtable embed")
                return []

            with page.expect_download(timeout=30000) as download_info:
                csv_link.first.click()

            download = download_info.value
            dest_path = os.path.join(tempfile.gettempdir(), 'concrete_jungle_events.csv')
            download.save_as(dest_path)
            logger.info(f"Downloaded CSV: {os.path.getsize(dest_path)} bytes")

            with open(dest_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            os.unlink(dest_path)
            return rows

        finally:
            browser.close()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Concrete Jungle events via Airtable CSV download."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        today = date.today()
        current_hashes: set[str] = set()

        rows = download_airtable_csv()
        if not rows:
            logger.warning("No rows returned from Airtable CSV")
            return 0, 0, 0

        logger.info(f"Got {len(rows)} events from Airtable CSV")

        for row in rows:
            try:
                raw_title = row.get("Name", "").strip()
                if not raw_title:
                    continue

                # Extract date from title (format: "Event Type - Event Name - MM/DD/YYYY")
                start_date = parse_date_from_title(raw_title)
                if not start_date:
                    logger.debug(f"No date in title: {raw_title}")
                    continue

                # Skip past events
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                if event_date < today:
                    continue

                # Clean title (remove date suffix)
                title = clean_title(raw_title)

                # Parse time range
                time_str = row.get("Event Time", "")
                start_time, end_time = parse_time_range(time_str)

                # Description
                description = row.get("Description", "").strip()
                if not description or len(description) < 10:
                    description = f"Volunteer opportunity with Concrete Jungle: {title}"

                # Location data
                row.get("Location Name", "").strip()
                row.get("Location Address", "").strip()

                # Sign-up URL from the row
                signup_url = row.get("Sign Up", "").strip()
                source_url = signup_url if signup_url.startswith("http") else VOLUNTEER_URL

                # Capacity info
                spots = row.get("Number of Spots Remaining", "")

                if is_full_event(raw_title, spots):
                    logger.debug("Skipping full Concrete Jungle event: %s", raw_title)
                    continue

                events_found += 1

                category, subcategory, event_tags = determine_category(title, description)
                is_free = subcategory == "volunteer"

                content_hash = generate_content_hash(title, "Concrete Jungle", start_date)
                current_hashes.add(content_hash)

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": description[:1000],
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": start_date,
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": event_tags,
                    "price_min": 0 if is_free else None,
                    "price_max": 0 if is_free else None,
                    "price_note": "Free volunteer event" if is_free else None,
                    "is_free": is_free,
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "image_url": None,
                    "raw_text": f"{title} - {description[:200]}",
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    _sync_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            except Exception as e:
                logger.warning(f"Error processing CSV row: {e}")
                continue

        stale_deleted = remove_stale_source_events(source_id, current_hashes)
        if stale_deleted:
            logger.info(
                "Removed %s stale Concrete Jungle events after calendar refresh",
                stale_deleted,
            )

        logger.info(
            f"Concrete Jungle crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout loading Airtable embed: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Concrete Jungle: {e}")
        raise

    return events_found, events_new, events_updated
