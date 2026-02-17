"""
Crawler for Aurora Cineplex (auroracineplex.com).
Independent discount/second-run cinema in Roswell.

Uses Playwright to render the showtime schedule page.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, remove_stale_source_events
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.auroracineplex.com"

VENUE_DATA = {
    "name": "Aurora Cineplex",
    "slug": "aurora-cineplex",
    "address": "5100 Commerce Pkwy",
    "neighborhood": "Roswell",
    "city": "Roswell",
    "state": "GA",
    "zip": "30076",
    "venue_type": "cinema",
    "website": BASE_URL,
    "lat": 34.0003,
    "lng": -84.3242,
}

DAYS_AHEAD = 7


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7:00PM' format to HH:MM."""
    try:
        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text.strip(), re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def extract_movies(
    page: Page,
    date_str: str,
    source_id: int,
    venue_id: int,
    seen_hashes: set,
) -> tuple[int, int, int]:
    """Extract movies and showtimes from the Aurora Cineplex page."""
    events_found = 0
    events_new = 0
    events_updated = 0

    containers = page.query_selector_all(
        ".movie-card, .film-card, .showtime-card, "
        "[class*='movie'], [class*='film'], "
        ".show-item, .now-showing-item"
    )

    if containers:
        for container in containers:
            try:
                title_el = container.query_selector("h2, h3, h4, .movie-title, .film-title, .title")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                if not title or len(title) < 2:
                    continue
                title = " ".join(title.split())

                skip_words = ["Aurora", "Cineplex", "Menu", "Concession", "Gift", "Party"]
                if any(title.startswith(w) for w in skip_words):
                    continue

                time_els = container.query_selector_all("button, .showtime, .time, a[class*='time']")
                times = []
                for el in time_els:
                    try:
                        text = el.inner_text().strip()
                        parsed = parse_time(text)
                        if parsed and parsed not in times:
                            times.append(parsed)
                    except Exception:
                        continue

                if not times:
                    container_text = container.inner_text()
                    time_matches = re.findall(r'(\d{1,2}:\d{2}\s*(?:AM|PM))', container_text, re.IGNORECASE)
                    for tm in time_matches:
                        parsed = parse_time(tm)
                        if parsed and parsed not in times:
                            times.append(parsed)

                if not times:
                    continue

                img_el = container.query_selector("img")
                image_url = None
                if img_el:
                    image_url = img_el.get_attribute("src") or img_el.get_attribute("data-src")

                for start_time in times:
                    events_found += 1
                    content_hash = generate_content_hash(
                        title, "Aurora Cineplex", f"{date_str}|{start_time}"
                    )
                    seen_hashes.add(content_hash)


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
                        "subcategory": "cinema",
                        "tags": ["film", "cinema", "independent", "discount", "aurora-cineplex"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    series_hint = {"series_type": "film", "series_title": title}

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"  Added: {title} on {date_str} at {start_time}")
                    except Exception as e:
                        logger.error(f"  Failed to insert: {e}")

            except Exception as e:
                logger.debug(f"Error processing movie container: {e}")
                continue
    else:
        events_found, events_new, events_updated = _extract_from_text(
            page, date_str, source_id, venue_id, seen_hashes
        )

    return events_found, events_new, events_updated


def _extract_from_text(
    page: Page,
    date_str: str,
    source_id: int,
    venue_id: int,
    seen_hashes: set,
) -> tuple[int, int, int]:
    """Fallback text-based extraction."""
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        body_text = page.inner_text("body")
        lines = [l.strip() for l in body_text.split("\n") if l.strip()]

        time_pattern = re.compile(r'^(\d{1,2}:\d{2})\s*(AM|PM)$', re.IGNORECASE)
        current_movie = None
        current_times: list[str] = []

        for line in lines:
            time_match = time_pattern.match(line)
            if time_match:
                parsed = parse_time(line)
                if parsed and current_movie and parsed not in current_times:
                    current_times.append(parsed)
            elif len(line) > 3 and len(line) < 100:
                if current_movie and current_times:
                    for start_time in current_times:
                        events_found += 1
                        content_hash = generate_content_hash(
                            current_movie, "Aurora Cineplex", f"{date_str}|{start_time}"
                        )
                        seen_hashes.add(content_hash)
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                        else:
                            # Get specific event URL

                            event_url = find_event_url(title, event_links, EVENTS_URL)


                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": current_movie,
                                "description": None,
                                "start_date": date_str,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "film",
                                "subcategory": "cinema",
                                "tags": ["film", "cinema", "independent", "discount", "aurora-cineplex"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": event_url,
                                "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                                "image_url": None,
                                "raw_text": None,
                                "extraction_confidence": 0.80,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }
                            series_hint = {"series_type": "film", "series_title": current_movie}
                            try:
                                insert_event(event_record, series_hint=series_hint)
                                events_new += 1
                            except Exception as e:
                                logger.error(f"  Failed to insert: {e}")

                skip_words = ["Aurora", "Cineplex", "Menu", "Concession", "Gift", "Party"]
                if not any(line.startswith(w) for w in skip_words):
                    current_movie = " ".join(line.split())
                    current_times = []
                else:
                    current_movie = None
                    current_times = []

    except Exception as e:
        logger.warning(f"Aurora Cineplex text extraction failed: {e}")

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Aurora Cineplex showtimes."""
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

            # Try showtimes page
            for path in ["/showtimes", "/now-showing", "/movies", ""]:
                url = f"{BASE_URL}{path}" if path else BASE_URL
                logger.info(f"Fetching: {url}")
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(4000)

                    has_movies = page.query_selector(
                        ".movie-card, .film-card, [class*='movie'], [class*='film'], .showtime"
                    )
                    if has_movies:
                        break
                except Exception as e:
                    logger.debug(f"Failed to load {url}: {e}")
                    continue

            for day_offset in range(DAYS_AHEAD):
                target_date = today + timedelta(days=day_offset)
                date_str = target_date.strftime("%Y-%m-%d")

                logger.info(f"Extracting showtimes for {date_str}")
                found, new, updated = extract_movies(
                    page, date_str, source_id, venue_id, seen_hashes
                )
                total_found += found
                total_new += new
                total_updated += updated

                # Try date navigation
                if day_offset < DAYS_AHEAD - 1:
                    next_date = today + timedelta(days=day_offset + 1)
                    day_num = next_date.day
                    try:
                        date_btn = page.locator(f"text=/^{day_num}$/").first
                        if date_btn.is_visible(timeout=1000):
                            date_btn.click()
                            page.wait_for_timeout(2000)
                        else:
                            break
                    except Exception:
                        break

            browser.close()

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info(f"Removed {stale_removed} stale showtimes")

        logger.info(
            f"Aurora Cineplex crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Aurora Cineplex: {e}")
        raise

    return total_found, total_new, total_updated
