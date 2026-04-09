"""
Crawler for Starlight Drive-In Theatre (starlightdrivein.com).
Iconic 6-screen drive-in cinema in East Atlanta showing double features nightly.

The site embeds a JavaScript `var movies = [...]` array on each day route
(`/nowplaying/<weekday>`) containing movie objects with title/times/image.
Drive-in times are nighttime "H:MM" strings without AM/PM markers.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

from db import (
    get_or_create_place,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    build_screening_bundle_from_event_rows,
    entries_to_event_like_rows,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://starlightdrivein.com"
EVENTS_URL = BASE_URL

PLACE_DATA = {
    "name": "Starlight Drive-In Theatre",
    "slug": "starlight-drive-in",
    "address": "2000 Moreland Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "place_type": "cinema",
    "website": BASE_URL,
    "lat": 33.7072,
    "lng": -84.3492,
    "_destination_details": {
        "commitment_tier": "halfday",
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "family_suitability": "yes",
        "practical_notes": "Park your car at the screen. Tune to the posted FM station for sound. Gates open at dusk; first feature starts at dark. Cash and card accepted at the box office.",
    },
    "_venue_features": [
        {
            "slug": "six-outdoor-screens",
            "title": "6 Outdoor Screens with Double Features",
            "feature_type": "experience",
            "description": "Six individual drive-in screens, each running a double feature every night. One of the largest drive-in complexes still operating in metro Atlanta.",
            "is_free": False,
            "sort_order": 1,
        },
        {
            "slug": "fm-radio-sound",
            "title": "FM Radio In-Car Sound",
            "feature_type": "experience",
            "description": "Audio broadcast over a dedicated FM frequency for each screen — tune in from your car stereo for the full drive-in experience.",
            "is_free": True,
            "sort_order": 2,
        },
        {
            "slug": "retro-concession-stand",
            "title": "Retro Concession Stand",
            "feature_type": "amenity",
            "description": "Classic drive-in snack bar with hot dogs, nachos, popcorn, candy, and soft drinks. Cash and card accepted.",
            "is_free": False,
            "sort_order": 3,
        },
    ],
    "_venue_specials": [
        {
            "title": "Double Feature Included",
            "type": "admission",
            "description": "Every ticket covers both films on the double feature bill — no separate charge for the second movie.",
            "days_of_week": [1, 2, 3, 4, 5, 6, 7],
            "price_note": "$10 per adult; kids under 9 free",
        },
    ],
}

# Crawl one week of daily routes
DAYS_AHEAD = 7


def _extract_movies_for_current_page(page) -> list[dict]:
    """Read window `movies` from the current page and keep only scheduled titles."""
    try:
        movies_data = page.evaluate("""
            () => {
                if (typeof movies !== 'undefined' && Array.isArray(movies)) {
                    return movies
                        .filter(m => m && m.title && m.title !== 'SCREEN CLOSED' && m.scheduled !== false)
                        .map(m => ({
                            title: m.title,
                            times: Array.isArray(m.times) ? m.times : [],
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
        return []

    # Keep only rows with usable title and at least one time.
    cleaned: list[dict] = []
    for movie in movies_data or []:
        title = str(movie.get("title") or "").strip()
        times = movie.get("times") or []
        if not title or not isinstance(times, list) or not times:
            continue
        cleaned.append(movie)
    return cleaned


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Starlight Drive-In Theatre showtimes."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0
    all_entries: list[dict] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)
            today = datetime.now().date()

            # Crawl each day's dedicated nowplaying route
            for day_offset in range(DAYS_AHEAD):
                target_date = today + timedelta(days=day_offset)
                date_str = target_date.strftime("%Y-%m-%d")
                weekday_slug = target_date.strftime("%A").lower()
                day_url = f"{BASE_URL}/nowplaying/{weekday_slug}"

                logger.info(f"Fetching {weekday_slug}: {day_url}")
                page.goto(day_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(1500)
                movies_data = _extract_movies_for_current_page(page)

                if not movies_data:
                    logger.info(f"No scheduled movies posted for {weekday_slug} ({date_str})")
                    continue

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

                    # Drive-in times are like "7:30", "9:35" without AM/PM.
                    # Treat 1-11 as PM; treat 12 as just-after-midnight (00:xx).
                    for t in raw_times:
                        t = str(t).strip()
                        if not t:
                            continue

                        match = re.match(r'^(\d{1,2}):(\d{2})$', t)
                        if match:
                            hour = int(match.group(1))
                            minute = match.group(2)
                            if 1 <= hour <= 11:
                                hour += 12
                            elif hour == 12:
                                hour = 0
                            start_time = f"{hour:02d}:{minute}"
                        else:
                            continue

                        total_found += 1
                        ticket_url = f"{BASE_URL}{movie_url}" if movie_url else None
                        event_url = ticket_url or EVENTS_URL

                        all_entries.append({
                            "title": title,
                            "start_date": date_str,
                            "start_time": start_time,
                            "image_url": image_url,
                            "source_url": event_url,
                            "ticket_url": ticket_url,
                            "description": None,
                            "tags": ["film", "cinema", "drive-in", "outdoor", "showtime", "starlight-drive-in", "independent"],
                            "source_id": source_id,
                            "place_id": venue_id,
                        })
                        logger.info(f"  Queued: {title} on {date_str} at {start_time}")

            browser.close()

        # --- Screening-primary persistence ---
        source_slug = source.get("slug", "starlight-drive-in")

        event_like_rows = entries_to_event_like_rows(all_entries)

        bundle = build_screening_bundle_from_event_rows(
            source_id=source_id, source_slug=source_slug, events=event_like_rows,
        )
        screening_summary = persist_screening_bundle(bundle)
        logger.info(
            "Starlight screening sync: %s titles, %s runs, %s times",
            screening_summary.get("titles", 0),
            screening_summary.get("runs", 0),
            screening_summary.get("times", 0),
        )

        run_summary = sync_run_events_from_screenings(source_id=source_id, source_slug=source_slug)
        total_new = run_summary.get("events_created", 0)
        total_updated = run_summary.get("events_updated", 0)

        run_event_hashes = run_summary.get("run_event_hashes", set())
        if run_event_hashes:
            remove_stale_showtime_events(source_id=source_id, run_event_hashes=run_event_hashes)

        logger.info(
            f"Starlight Drive-In crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Starlight Drive-In: {e}")
        raise

    return total_found, total_new, total_updated
