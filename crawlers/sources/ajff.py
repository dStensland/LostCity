"""
Crawler for Atlanta Jewish Film Festival (ajff.org).
One of the largest Jewish film festivals in the world.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ajff.org"

VENUE_DATA = {
    "name": "Atlanta Jewish Film Festival",
    "slug": "atlanta-jewish-film-festival",
    "address": "1440 Spring St NW",  # AJFF HQ
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "festival",
    "website": BASE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Jewish Film Festival schedule."""
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

            # Try the films page
            films_url = f"{BASE_URL}/films"
            logger.info(f"Fetching AJFF: {films_url}")

            try:
                page.goto(films_url, wait_until="domcontentloaded", timeout=30000)
            except Exception:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)

            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # AJFF has festival dates announced: February 18 - March 15, 2026
            # Look for film titles with "Read more" links
            seen_films = set()

            i = 0
            while i < len(lines):
                line = lines[i]

                # Look for film titles (typically followed by description and "Read more")
                # Film titles are usually in caps or title case, 3-50 chars
                if 3 < len(line) < 60 and not line.startswith("A "):
                    # Check if next lines have description and "Read more"
                    has_description = False
                    if i + 1 < len(lines):
                        next_line = lines[i + 1]
                        # Description is usually longer text
                        if len(next_line) > 40 or "Read more" in next_line:
                            has_description = True

                    if has_description:
                        title = line

                        # Skip navigation and UI
                        skip_words = [
                            "Browse All",
                            "Learn more",
                            "Film Highlights",
                            "Virtual Cinema",
                            "The Annual",
                            "Events",
                            "Volunteer",
                            "Support",
                            "My Account",
                            "Cart",
                            "DAYS",
                            "HOURS",
                            "MINS",
                            "SECS",
                        ]
                        if any(w.lower() in title.lower() for w in skip_words):
                            i += 1
                            continue

                        if title in seen_films:
                            i += 1
                            continue

                        seen_films.add(title)

                        # Use festival start date as default (Feb 18, 2026)
                        start_date = "2026-02-18"

                        events_found += 1

                        content_hash = generate_content_hash(
                            title, "Atlanta Jewish Film Festival", start_date
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                        else:
                            # Get description
                            description = None
                            if i + 1 < len(lines) and "Read more" not in lines[i + 1]:
                                description = (
                                    lines[i + 1][:200]
                                    if len(lines[i + 1]) > 10
                                    else None
                                )

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": f"AJFF: {title}",
                                "description": description,
                                "start_date": start_date,
                                "start_time": None,
                                "end_date": "2026-03-15",  # Festival end
                                "end_time": None,
                                "is_all_day": False,
                                "category": "film",
                                "subcategory": "festival",
                                "tags": ["film", "festival", "jewish", "ajff"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": "Festival passes and individual tickets available",
                                "is_free": False,
                                "source_url": films_url,
                                "ticket_url": None,
                                "image_url": image_map.get(title),
                                "raw_text": None,
                                "extraction_confidence": 0.80,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {title}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(f"AJFF crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl AJFF: {e}")
        raise

    return events_found, events_new, events_updated
