"""
Crawler for Atlanta Film Society (atlantafilmsociety.org).
Year-round film screenings, events, and education programs.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import (
    get_or_create_place,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    build_screening_bundle_from_event_rows,
    entries_to_event_like_rows,
)
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantafilmsociety.org"
EVENTS_URL = f"{BASE_URL}/upcoming"

PLACE_DATA = {
    "name": "Atlanta Film Society",
    "slug": "atlanta-film-society",
    "address": "535 Means St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7730,
    "lng": -84.4052,
    "place_type": "cinema",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from 'Jan 12, 2026' or 'Feb 7, 2026 – Feb 28, 2026' format."""
    current_year = datetime.now().year

    # Range format: "Feb 7, 2026 – Feb 28, 2026"
    range_match = re.match(
        r"(\w+)\s+(\d+),?\s*(\d{4})\s*[–-]\s*(\w+)\s+(\d+),?\s*(\d{4})", date_str
    )
    if range_match:
        m1, d1, y1, m2, d2, y2 = range_match.groups()
        for fmt in ["%b %d, %Y", "%B %d, %Y"]:
            try:
                start = datetime.strptime(f"{m1} {d1}, {y1}", fmt)
                end = datetime.strptime(f"{m2} {d2}, {y2}", fmt)
                return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Single date: "Jan 12, 2026"
    single_match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})?", date_str)
    if single_match:
        month, day, year = single_match.groups()
        year = year or str(current_year)
        for fmt in ["%b %d, %Y", "%B %d, %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day}, {year}", fmt)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Film Society events."""
    source_id = source["id"]
    all_entries: list[dict] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Atlanta Film Society: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            venue_id = get_or_create_place(PLACE_DATA)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Pattern: Date line followed by event title
            # "Jan 12, 2026" then "MEMBER Exclusive Screening: 28 YEARS LATER"
            i = 0
            while i < len(lines):
                line = lines[i]

                # Look for date patterns
                date_match = re.match(
                    r"^(\w{3}\s+\d+,?\s*\d{4}(?:\s*[–-]\s*\w{3}\s+\d+,?\s*\d{4})?)",
                    line,
                )
                if date_match and i + 1 < len(lines):
                    date_str = date_match.group(1)
                    title = lines[i + 1]

                    # Skip navigation items
                    skip_words = [
                        "SKIP TO",
                        "ABOUT",
                        "SCREENINGS",
                        "EDUCATION",
                        "SUPPORT",
                        "DONATE",
                        "LOGIN",
                        "ACCOUNT",
                        "UPCOMING",
                    ]
                    if any(w.lower() in title.lower() for w in skip_words):
                        i += 1
                        continue

                    if len(title) < 5:
                        i += 1
                        continue

                    start_date, end_date = parse_date(date_str)
                    if not start_date:
                        i += 1
                        continue

                    # Get description if available
                    description = None
                    if i + 2 < len(lines):
                        desc_line = lines[i + 2]
                        if len(desc_line) > 20 and not re.match(
                            r"^\w{3}\s+\d+", desc_line
                        ):
                            description = desc_line[:300]

                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    all_entries.append({
                        "title": title,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": end_date,
                        "image_url": image_map.get(title),
                        "source_url": event_url,
                        "ticket_url": event_url if event_url != EVENTS_URL else None,
                        "description": description,
                        "tags": ["film", "screening", "atlanta-film-society"],
                        "source_id": source_id,
                        "place_id": venue_id,
                    })

                i += 1

            browser.close()

        # --- Screening-primary persistence ---
        total_found = len(all_entries)
        source_slug = source.get("slug", "atlanta-film-society")

        event_like_rows = entries_to_event_like_rows(all_entries)
        bundle = build_screening_bundle_from_event_rows(
            source_id=source_id,
            source_slug=source_slug,
            events=event_like_rows,
        )
        screening_summary = persist_screening_bundle(bundle)
        logger.info(
            "Atlanta Film Society screening sync: %s titles, %s runs, %s times",
            screening_summary.get("titles", 0),
            screening_summary.get("runs", 0),
            screening_summary.get("times", 0),
        )

        run_summary = sync_run_events_from_screenings(
            source_id=source_id,
            source_slug=source_slug,
        )
        total_new = run_summary.get("events_created", 0)
        total_updated = run_summary.get("events_updated", 0)
        logger.info(
            "Atlanta Film Society run events: %s created, %s updated, %s times linked",
            total_new, total_updated, run_summary.get("times_linked", 0),
        )

        run_event_hashes = run_summary.get("run_event_hashes", set())
        if run_event_hashes:
            cleanup = remove_stale_showtime_events(
                source_id=source_id,
                run_event_hashes=run_event_hashes,
            )
            if cleanup.get("deactivated") or cleanup.get("deleted"):
                logger.info("Stale showtime cleanup: %s", cleanup)

        logger.info(
            f"Atlanta Film Society crawl complete: {total_found} found, {total_new} new run events, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Film Society: {e}")
        raise

    return total_found, total_new, total_updated
