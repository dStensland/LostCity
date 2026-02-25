"""
Crawler for The Home Depot Backyard at Mercedes-Benz Stadium.

SOURCE: mercedesbenzstadium.com/hdby/events-calendar
PURPOSE: Free community fitness/wellness programs, markets, festivals at HDBY outdoor event space.

The venue hosts 100+ weekly fitness classes (yoga, bootcamp, dance, HIIT, etc.),
community events, Truist Night Market, festivals, and more.

SEPARATE from Mercedes-Benz Stadium itself (which hosts Falcons/United games).
This crawler focuses on HDBY-specific community programming.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, date, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://www.mercedesbenzstadium.com/hdby/events-calendar"
STALE_EVENT_GRACE_DAYS = 3

VENUE_DATA = {
    "name": "The Home Depot Backyard",
    "slug": "home-depot-backyard",
    "address": "1 AMB Dr NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7553,
    "lng": -84.4006,
    "venue_type": "event_space",
    "spot_type": "event_space",
    "website": "https://www.mercedesbenzstadium.com/hdby",
    "vibes": ["outdoor", "fitness", "community", "free", "family-friendly"],
}

# Fitness class category mappings
FITNESS_KEYWORDS = {
    "yoga": {"subcategory": "yoga", "tags": ["yoga", "stretching", "mindfulness"]},
    "pilates": {"subcategory": "pilates", "tags": ["pilates", "core", "strength"]},
    "bootcamp": {"subcategory": "bootcamp", "tags": ["bootcamp", "strength", "cardio"]},
    "boot camp": {"subcategory": "bootcamp", "tags": ["bootcamp", "strength", "cardio"]},
    "hiit": {"subcategory": "hiit", "tags": ["hiit", "cardio", "strength"]},
    "dance": {"subcategory": "dance", "tags": ["dance", "cardio"]},
    "zumba": {"subcategory": "dance", "tags": ["zumba", "dance", "cardio"]},
    "bachata": {"subcategory": "dance", "tags": ["bachata", "dance", "social"]},
    "hip-hop": {"subcategory": "dance", "tags": ["hip-hop", "dance", "cardio"]},
    "run": {"subcategory": "running", "tags": ["running", "cardio"]},
    "running": {"subcategory": "running", "tags": ["running", "cardio"]},
    "boxing": {"subcategory": "boxing", "tags": ["boxing", "cardio", "strength"]},
    "tai chi": {"subcategory": "martial-arts", "tags": ["tai-chi", "mindfulness", "stretching"]},
    "barre": {"subcategory": "barre", "tags": ["barre", "ballet", "strength"]},
    "strength": {"subcategory": "strength", "tags": ["strength", "weights"]},
    "functional": {"subcategory": "strength", "tags": ["functional", "strength"]},
    "self defense": {"subcategory": "martial-arts", "tags": ["self-defense", "safety", "empowerment"]},
    "senior fitness": {"subcategory": "class", "tags": ["seniors", "low-impact", "wellness"]},
}

# Event categories to skip (stadium events, not HDBY-specific)
SKIP_KEYWORDS = [
    "falcons tailgate",
    "atlanta falcons",
    "atlutd vs",  # United games are at the stadium, not HDBY
    "united tailgate",
    "atlanta vs",  # Falcons games (e.g. "Atlanta vs Tampa Bay Tailgate")
    "tailgate",  # Generic tailgates are stadium events
]


def should_skip_event(title: str) -> tuple[bool, Optional[str]]:
    """
    Determine if an event should be skipped (stadium-only, not HDBY public programming).

    Returns:
        (should_skip, reason)
    """
    title_lower = title.lower()

    # Skip stadium game tailgates (these are not at HDBY)
    # Check for "tailgate" first to catch generic tailgate events
    if "tailgate" in title_lower:
        # Allow Backyard-specific tailgates if they exist
        if "backyard" not in title_lower and "hdby" not in title_lower:
            return True, "Stadium tailgate event"

    # Check other stadium event keywords
    for keyword in SKIP_KEYWORDS:
        if keyword in title_lower:
            return True, f"Stadium event: {keyword}"

    return False, None


def categorize_event(title: str, url: str) -> dict:
    """
    Determine category, subcategory, and tags based on event title/URL.

    Returns:
        Dict with category, subcategory, tags
    """
    title_lower = title.lower()
    url_lower = url.lower() if url else ""

    # Market events
    if "market" in title_lower:
        return {
            "category": "food",
            "subcategory": "market",
            "tags": ["market", "food", "shopping", "vendors", "outdoor"],
        }

    # Food & wine festivals
    if "food" in title_lower and "wine" in title_lower:
        return {
            "category": "food",
            "subcategory": "festival",
            "tags": ["festival", "food", "wine", "tasting", "outdoor"],
        }

    # Movie nights
    if "movie" in title_lower:
        return {
            "category": "film",
            "subcategory": "screening",
            "tags": ["outdoor-movie", "film", "family-friendly", "free"],
        }

    # Self-defense classes
    if "self defense" in title_lower or "s.a.f.e" in title_lower:
        return {
            "category": "fitness",
            "subcategory": "martial-arts",
            "tags": ["self-defense", "safety", "empowerment", "women"],
        }

    # Fitness/wellness classes (check specific types)
    for keyword, cat_info in FITNESS_KEYWORDS.items():
        if keyword in title_lower:
            base_tags = ["outdoor", "free", "community", "all-ages"]
            return {
                "category": "fitness",
                "subcategory": cat_info["subcategory"],
                "tags": list(set(base_tags + cat_info["tags"])),
            }

    # Check if it's a fitness event by generic keywords
    fitness_indicators = ["fitness", "workout", "class", "training"]
    if any(indicator in title_lower for indicator in fitness_indicators):
        return {
            "category": "fitness",
            "subcategory": "class",
            "tags": ["fitness", "outdoor", "free", "community", "all-ages"],
        }

    # Marathon/race events
    if "marathon" in title_lower or "5k" in title_lower or "run" in title_lower and "hunger walk" in title_lower:
        return {
            "category": "sports",
            "subcategory": "running",
            "tags": ["running", "race", "marathon", "outdoor", "charity"],
        }

    # Arts/improv
    if "improv" in title_lower or "art" in title_lower:
        return {
            "category": "arts",
            "subcategory": "performance",
            "tags": ["improv", "comedy", "performance", "21+"],
        }

    # Workshop/education events
    if "workshop" in title_lower or "skills" in title_lower or "technology" in title_lower:
        return {
            "category": "community",
            "subcategory": "workshop",
            "tags": ["workshop", "education", "skills", "free"],
        }

    # Community programming (generic/seasonal events)
    if "community" in title_lower or "programming" in title_lower:
        return {
            "category": "community",
            "subcategory": "event",
            "tags": ["community", "outdoor", "free", "family-friendly"],
        }

    # Seasonal/holiday events
    if any(word in title_lower for word in ["halloween", "dia de los muertos", "day of the girl"]):
        return {
            "category": "community",
            "subcategory": "festival",
            "tags": ["festival", "seasonal", "family-friendly", "outdoor", "free"],
        }

    # Default: community event
    return {
        "category": "community",
        "subcategory": "event",
        "tags": ["community", "outdoor", "free"],
    }


def _extract_year_from_title(title: str) -> Optional[int]:
    match = re.search(r"\b(20\d{2})\b", title or "")
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def parse_date(date_str: str, title: str = "") -> Optional[str]:
    """
    Parse date string to YYYY-MM-DD format.

    Expected format: "March 1, 2025" or "February 28, 2025"
    """
    parsed: Optional[datetime] = None
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            parsed = datetime.strptime(date_str.strip(), fmt)
            break
        except ValueError:
            continue

    if not parsed:
        logger.warning(f"Could not parse date: {date_str}")
        return None

    today = date.today()
    # Source occasionally labels annual events with an outdated year while title carries the current year.
    title_year = _extract_year_from_title(title)
    if title_year and title_year == parsed.year + 1:
        candidate = parsed.replace(year=title_year)
        if candidate.date() >= today - timedelta(days=STALE_EVENT_GRACE_DAYS):
            parsed = candidate

    # Ignore stale events to avoid keeping archived calendar rows active.
    if parsed.date() < today - timedelta(days=STALE_EVENT_GRACE_DAYS):
        return None

    if parsed.year > today.year + 2:
        return None

    return parsed.strftime("%Y-%m-%d")


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Home Depot Backyard events calendar.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching HDBY calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(5000)  # Wait for FullCalendar to render

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Get venue ID
            venue_id = get_or_create_venue(VENUE_DATA)

            # Extract all event items from FullCalendar
            event_items = page.query_selector_all(".ec-col-item")
            logger.info(f"Found {len(event_items)} event items on calendar")

            for item in event_items:
                try:
                    # Extract event details from DOM elements
                    title_elem = item.query_selector(".title")
                    start_date_elem = item.query_selector(".start-date")
                    end_date_elem = item.query_selector(".end-date")
                    allday_elem = item.query_selector(".allday")
                    url_elem = item.query_selector("a")

                    if not title_elem or not start_date_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    start_date_str = start_date_elem.inner_text().strip()
                    end_date_str = end_date_elem.inner_text().strip() if end_date_elem else start_date_str
                    is_all_day = allday_elem.inner_text().strip().lower() == "true" if allday_elem else True
                    source_url = url_elem.get_attribute("href") if url_elem else CALENDAR_URL

                    # Skip if title is empty or just whitespace
                    if not title or len(title) < 3:
                        continue

                    # Check if event should be skipped (stadium events)
                    should_skip, skip_reason = should_skip_event(title)
                    if should_skip:
                        logger.debug(f"Skipping event: {title} - {skip_reason}")
                        continue

                    # Parse dates
                    start_date = parse_date(start_date_str, title=title)
                    end_date = (
                        parse_date(end_date_str, title=title)
                        if end_date_str != start_date_str
                        else None
                    )

                    if not start_date:
                        logger.debug(
                            "Skipping stale/unparseable HDBY event date for '%s': %s",
                            title,
                            start_date_str,
                        )
                        continue

                    # Categorize event
                    cat_info = categorize_event(title, source_url)

                    # Determine pricing - default to unknown
                    is_free = False
                    price_min = None
                    price_max = None
                    price_note = None

                    # Build description
                    description_parts = [
                        f"Community event at The Home Depot Backyard at Mercedes-Benz Stadium."
                    ]

                    if cat_info["category"] == "fitness":
                        description_parts.append("All fitness levels welcome.")
                    if cat_info["category"] == "food":
                        description_parts.append("Featuring local vendors and artisans.")

                    description = " ".join(description_parts)

                    # Check for image
                    image_url = image_map.get(title)

                    # Create content hash for deduplication
                    content_hash = generate_content_hash(
                        title, "The Home Depot Backyard", start_date
                    )

                    source_url_lower = (source_url or "").lower()
                    has_ticket_signal = source_url and any(
                        token in source_url_lower
                        for token in (
                            "eventbrite",
                            "ticket",
                            "ticketmaster",
                            "axs",
                            "dice.fm",
                            "seetickets",
                            "showclix",
                            "tix",
                        )
                    )

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": None,  # Calendar doesn't provide specific times
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": is_all_day,
                        "category": cat_info["category"],
                        "subcategory": cat_info["subcategory"],
                        "tags": cat_info["tags"],
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": source_url,
                        "ticket_url": source_url if has_ticket_signal else None,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date_str}",
                        "extraction_confidence": 0.9,
                        "content_hash": content_hash,
                    }

                    events_found += 1

                    # Check for existing event
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error parsing event item: {e}")
                    continue

            browser.close()

        logger.info(
            f"HDBY crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching HDBY calendar: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl HDBY: {e}")
        raise

    return events_found, events_new, events_updated
