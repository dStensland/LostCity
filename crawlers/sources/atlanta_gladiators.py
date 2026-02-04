"""
Crawler for Atlanta Gladiators (ECHL Hockey).
Home games at Gas South Arena in Duluth.
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

BASE_URL = "https://atlantagladiators.com"
SCHEDULE_URL = f"{BASE_URL}/#schedule"

VENUE_DATA = {
    "name": "Gas South Arena",
    "slug": "gas-south-arena",
    "address": "6400 Sugarloaf Pkwy",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30097",
    "lat": 33.9822,
    "lng": -84.0723,
    "venue_type": "arena",
    "spot_type": "arena",
    "website": "https://www.gassouthenarena.com",
    "vibes": ["sports", "hockey", "family-friendly"],
}


def parse_game_date(date_text: str) -> Optional[str]:
    """Parse date from schedule listings.

    Handles formats like "Wednesday, February 4th, 2026" with ordinal suffixes.
    """
    if not date_text:
        return None
    date_text = date_text.strip()

    # Strip ordinal suffixes: 1st, 2nd, 3rd, 4th, etc.
    date_text = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_text)

    for fmt in ["%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%Y-%m-%d",
                "%A, %B %d, %Y", "%a, %b %d, %Y"]:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try extracting date from mixed text
    match = re.search(r"(\w+,?\s+\w+\s+\d+,?\s*\d{4})", date_text)
    if match:
        clean = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', match.group(1))
        for fmt in ["%A, %B %d, %Y", "%a, %b %d, %Y", "%B %d, %Y", "%b %d, %Y", "%B %d %Y"]:
            try:
                dt = datetime.strptime(clean, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Gladiators schedule for home games."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Atlanta Gladiators schedule: {SCHEDULE_URL}")
            # Navigate to base URL first (SPA)
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to schedule section to trigger SPA load
            for _ in range(5):
                page.keyboard.press("End")
                page.wait_for_timeout(1000)

            # Find home game cards with Tailwind classes
            # Look for elements with class containing "game-home" (specifically !bg-team-game-home-bac)
            home_games = page.query_selector_all('[class*="game-home"]')
            logger.info(f"Found {len(home_games)} home game cards")

            for game_card in home_games:
                try:
                    text = game_card.inner_text().strip()
                    if not text or len(text) < 10:
                        continue

                    # Parse date: "Wednesday, February 4th, 2026"
                    game_date = None
                    date_match = re.search(
                        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+\s+\d+(?:st|nd|rd|th)?,?\s*\d{4})",
                        text
                    )
                    if date_match:
                        game_date = parse_game_date(date_match.group(2))

                    if not game_date:
                        # Try simpler pattern
                        for line in text.split("\n"):
                            d = parse_game_date(line)
                            if d:
                                game_date = d
                                break

                    if not game_date:
                        continue

                    # Skip past events
                    if game_date < datetime.now().strftime("%Y-%m-%d"):
                        continue

                    # Parse time: "Puck Drops: 7:10 PM EST"
                    game_time = None
                    time_match = re.search(r"Puck Drops:\s*(\d{1,2}:\d{2}\s*[AaPp][Mm])", text)
                    if time_match:
                        try:
                            dt = datetime.strptime(time_match.group(1).strip(), "%I:%M %p")
                            game_time = dt.strftime("%H:%M")
                        except ValueError:
                            pass

                    # Parse opponent: "FLA Florida Everblades at ATL Atlanta Gladiators"
                    opponent = None
                    opponent_match = re.search(r"([A-Z]{3})\s+([A-Za-z\s]+)\s+at\s+ATL\s+Atlanta Gladiators", text)
                    if opponent_match:
                        opponent = opponent_match.group(2).strip()

                    # Parse event name/promo: "College Night #2"
                    event_name = None
                    # Look for text that's not date, time, opponent
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    for line in lines:
                        if ("Night" in line or "Promo" in line or "#" in line) and len(line) < 50:
                            event_name = line
                            break

                    # Find detail link
                    detail_link = game_card.query_selector('a[href*="/games/"]')
                    detail_url = SCHEDULE_URL
                    if detail_link:
                        href = detail_link.get_attribute("href")
                        if href:
                            detail_url = href if href.startswith("http") else f"{BASE_URL}{href}"

                    # Build title
                    if event_name and opponent:
                        title = f"{event_name}: Atlanta Gladiators vs {opponent}"
                    elif opponent:
                        title = f"Atlanta Gladiators vs {opponent}"
                    elif event_name:
                        title = f"{event_name} - Atlanta Gladiators"
                    else:
                        title = "Atlanta Gladiators Home Game"

                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], game_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"{title} at Gas South Arena. ECHL hockey action in Duluth, GA.",
                        "start_date": game_date,
                        "start_time": game_time or "19:10",
                        "end_date": game_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "sports",
                        "subcategory": "sports.hockey",
                        "tags": ["hockey", "sports", "family-friendly", "gladiators", "echl"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See atlantagladiators.com for tickets",
                        "is_free": False,
                        "source_url": detail_url,
                        "ticket_url": f"{BASE_URL}/tickets",
                        "image_url": None,
                        "raw_text": text[:500],
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {game_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing game card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Atlanta Gladiators crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Gladiators: {e}")
        raise

    return events_found, events_new, events_updated
