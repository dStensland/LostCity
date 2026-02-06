"""
Crawler for Starlight Drive-In Theatre (starlightdrivein.com).
Iconic 6-screen drive-in cinema in East Atlanta showing double features nightly.

The site embeds a JavaScript `var movies = [...]` array on the homepage
containing movie objects with title, times, image, genre, and screen_id.
Drive-in times are evening hours in "H:MM" format (always PM).
The schedule is the same all week — no date navigation needed.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, remove_stale_source_events
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://starlightdrivein.com"

VENUE_DATA = {
    "name": "Starlight Drive-In Theatre",
    "slug": "starlight-drive-in",
    "address": "2000 Moreland Ave SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "cinema",
    "website": BASE_URL,
    "lat": 33.7072,
    "lng": -84.3492,
}

# Drive-in schedule is typically the same all week
DAYS_AHEAD = 7


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Starlight Drive-In Theatre showtimes."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0
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
            today = datetime.now().date()

            # Homepage has the movies JS array
            logger.info(f"Fetching: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract movies from the JavaScript var movies array
            try:
                movies_data = page.evaluate("""
                    () => {
                        if (typeof movies !== 'undefined' && Array.isArray(movies)) {
                            return movies.filter(m => m.title && m.title !== 'SCREEN CLOSED').map(m => ({
                                title: m.title,
                                times: m.times || [],
                                image: m.image || null,
                                screen_id: m.screen_id || null,
                                url: m.url || null,
                            }));
                        }
                        return [];
                    }
                """)
            except Exception as e:
                logger.error(f"Failed to extract JS movies array: {e}")
                movies_data = []

            if not movies_data:
                logger.warning("No movies found in JavaScript array")
                browser.close()
                return 0, 0, 0

            logger.info(f"Found {len(movies_data)} movies in JS array")

            # Drive-in schedule is the same every night, create events for each day
            for day_offset in range(DAYS_AHEAD):
                target_date = today + timedelta(days=day_offset)
                date_str = target_date.strftime("%Y-%m-%d")

                for movie in movies_data:
                    title = movie.get("title", "").strip()
                    if not title or len(title) < 2:
                        continue

                    # Title case: "ANACONDA" -> "Anaconda"
                    if title == title.upper() and len(title) > 3:
                        title = title.title()

                    raw_times = movie.get("times", [])
                    image_url = movie.get("image")
                    movie_url = movie.get("url")

                    # Drive-in times are like "7:30", "9:35" — always PM
                    for t in raw_times:
                        t = str(t).strip()
                        if not t:
                            continue

                        match = re.match(r'^(\d{1,2}):(\d{2})$', t)
                        if match:
                            hour = int(match.group(1))
                            minute = match.group(2)
                            # Drive-in shows are always evening
                            if hour < 12:
                                hour += 12
                            start_time = f"{hour:02d}:{minute}"
                        else:
                            continue

                        total_found += 1
                        content_hash = generate_content_hash(
                            title, "Starlight Drive-In Theatre", f"{date_str}|{start_time}"
                        )
                        seen_hashes.add(content_hash)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            total_updated += 1
                            continue

                        ticket_url = f"{BASE_URL}{movie_url}" if movie_url else None

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": None,
                            "start_date": date_str,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "film",
                            "subcategory": "drive_in",
                            "tags": ["film", "cinema", "drive-in", "outdoor", "starlight-drive-in", "independent"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": ticket_url,
                            "image_url": image_url,
                            "raw_text": None,
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        series_hint = {
                            "series_type": "film",
                            "series_title": title,
                        }

                        try:
                            insert_event(event_record, series_hint=series_hint)
                            total_new += 1
                            logger.info(f"  Added: {title} on {date_str} at {start_time}")
                        except Exception as e:
                            logger.error(f"  Failed to insert: {e}")

            browser.close()

        # Remove stale showtimes
        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info(f"Removed {stale_removed} stale showtimes no longer on schedule")

        logger.info(
            f"Starlight Drive-In crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Starlight Drive-In: {e}")
        raise

    return total_found, total_new, total_updated
