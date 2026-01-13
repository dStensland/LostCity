"""
Crawler for Landmark Midtown Art Cinema (landmarktheatres.com).
Art house cinema chain location in Atlanta.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.landmarktheatres.com/atlanta/midtown-art-cinema"

VENUE_DATA = {
    "name": "Landmark Midtown Art Cinema",
    "slug": "landmark-midtown-art-cinema",
    "address": "931 Monroe Drive NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "venue_type": "cinema",
    "website": BASE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Landmark Midtown Art Cinema films."""
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

            logger.info(f"Fetching Landmark Midtown: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load content
            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(VENUE_DATA)

            today = datetime.now().date()

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse films from "NOW PLAYING" section
            # Pattern: "See trailer of the movie - TITLE" followed by "TRAILER" and "TITLE"
            # then "A FILM BY DIRECTOR"
            seen_movies = set()
            in_now_playing = False

            i = 0
            while i < len(lines):
                line = lines[i]

                if "NOW PLAYING" in line:
                    in_now_playing = True
                    i += 1
                    continue
                elif "COMING SOON" in line:
                    in_now_playing = False

                # Movie title line (after "TRAILER")
                if in_now_playing and line == "TRAILER" and i + 1 < len(lines):
                    movie_title = lines[i + 1]

                    # Skip if it's navigation/UI text
                    skip_words = ["See trailer", "SEE DETAILS", "CLICK HERE", "LANDMARK"]
                    if any(w.lower() in movie_title.lower() for w in skip_words):
                        i += 1
                        continue

                    # Get director if available
                    director = None
                    if i + 2 < len(lines) and lines[i + 2].startswith("A FILM BY"):
                        director = lines[i + 2].replace("A FILM BY ", "")

                    # Create event for this film (playing today)
                    start_date = today.strftime("%Y-%m-%d")

                    if movie_title not in seen_movies:
                        seen_movies.add(movie_title)
                        events_found += 1

                        content_hash = generate_content_hash(movie_title, "Landmark Midtown Art Cinema", start_date)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                        else:
                            description = f"Directed by {director}" if director else None

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": movie_title,
                                "description": description,
                                "start_date": start_date,
                                "start_time": None,  # Showtimes not easily available
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "film",
                                "subcategory": "cinema",
                                "tags": ["film", "cinema", "arthouse", "landmark"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": BASE_URL,
                                "ticket_url": None,
                                "image_url": None,
                                "raw_text": None,
                                "extraction_confidence": 0.75,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {movie_title}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {movie_title}: {e}")

                i += 1

            browser.close()

        logger.info(f"Landmark Midtown crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Landmark Midtown: {e}")
        raise

    return events_found, events_new, events_updated
