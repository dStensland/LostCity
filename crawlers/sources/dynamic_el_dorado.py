"""
Crawler for Dynamic El Dorado (dynamiceldorado.com).
Atlanta's comedy incubator in Old Fourth Ward — improv, stand-up, open mics.

Uses Crowdwork/FourthWall ticketing platform.
Clean JSON API — no Playwright required.
API: https://crowdwork.com/api/v2/dynamiceldorado/shows

Shows include both one-off performances and weekly recurring series.
Recurring shows (Weekly, Multiple dates) are grouped into series.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import requests

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

API_URL = "https://crowdwork.com/api/v2/dynamiceldorado/shows"
BASE_URL = "https://dynamiceldorado.com"

VENUE_DATA = {
    "name": "Dynamic El Dorado",
    "slug": "dynamic-el-dorado",
    "address": "684 John Wesley Dobbs Ave NE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7571,
    "lng": -84.3721,
    "venue_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BASE_URL,
    "description": (
        "Atlanta's comedy incubator in Old Fourth Ward, offering improv, stand-up, "
        "and sketch comedy shows every weekend alongside classes and open mics. "
        "Shows every weekend with Atlanta's best, classes every weekday."
    ),
    "vibes": ["comedy", "improv", "standup", "open-mic", "live-shows", "late-night"],
}

EASTERN = ZoneInfo("America/New_York")

# Recurring show frequencies from Crowdwork API
RECURRING_VALUES = {"Weekly", "Biweekly", "Monthly", "Multiple dates"}


def strip_html(html: str) -> str:
    """Strip HTML tags from description body."""
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_cost(show: dict) -> tuple[Optional[float], Optional[float], bool, Optional[str]]:
    """
    Extract price info from Crowdwork show.
    Returns (price_min, price_max, is_free, price_note).
    """
    cost_obj = show.get("cost", {})
    formatted = cost_obj.get("formatted", "") if cost_obj else ""
    cost_tiers = show.get("cost_tiers", [])

    # "Pay What You Want" = free entry
    if "pay what you want" in formatted.lower() or "pwyw" in formatted.lower():
        return None, None, True, "Pay what you want"

    if "free" in formatted.lower():
        return None, None, True, None

    # Extract price from tiers
    prices = []
    for tier in cost_tiers:
        cost_cents = tier.get("cost", 0)
        if cost_cents and cost_cents > 0:
            prices.append(cost_cents / 100.0)

    if prices:
        price_min = min(prices)
        price_max = max(prices) if max(prices) != price_min else None
        return price_min, price_max, False, None

    # Try to parse from formatted string: "$12.00 (includes fees)"
    dollar_match = re.search(r"\$(\d+(?:\.\d{2})?)", formatted)
    if dollar_match:
        price = float(dollar_match.group(1))
        return price, None, False, None

    return None, None, False, None


def infer_subcategory(title: str, description: str) -> str:
    """Infer comedy subcategory from show title and description."""
    combined = (title + " " + description).lower()

    if "improv" in combined or "improvisation" in combined:
        return "improv"
    if "stand-up" in combined or "standup" in combined or "stand up" in combined:
        return "standup"
    if "sketch" in combined:
        return "sketch"
    if "open mic" in combined:
        return "open_mic"
    if "musical" in combined:
        return "comedy"
    return "comedy"


def parse_show_dates(show: dict) -> list[tuple[str, str]]:
    """
    Parse all future show dates from Crowdwork show.
    Returns list of (YYYY-MM-DD, HH:MM) tuples in Eastern time.
    Filters to future dates only.
    """
    now = datetime.now(timezone.utc)
    results = []

    for date_str in show.get("dates", []):
        try:
            # Format: "2026-03-18T20:00:00.000-04:00"
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            if dt < now:
                continue
            dt_eastern = dt.astimezone(EASTERN)
            start_date = dt_eastern.strftime("%Y-%m-%d")
            start_time = dt_eastern.strftime("%H:%M")
            results.append((start_date, start_time))
        except (ValueError, TypeError):
            logger.debug(f"Could not parse date: {date_str}")
            continue

    return results


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Dynamic El Dorado shows via Crowdwork API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Dynamic El Dorado shows: {API_URL}")
        resp = requests.get(
            API_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
                "Referer": BASE_URL,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        shows = data.get("data", [])
        logger.info(f"API returned {len(shows)} shows")

        for show in shows:
            if show.get("status") != "active":
                continue

            show_id = show.get("id")
            title = show.get("name", "").strip()
            if not title:
                continue

            recurring = show.get("recurring", "Once")
            is_recurring = recurring in RECURRING_VALUES

            # Get description
            desc_obj = show.get("description", {})
            desc_html = desc_obj.get("body", "") if isinstance(desc_obj, dict) else ""
            description = strip_html(desc_html) or show.get("description_short", "")

            # Get image
            img_obj = show.get("img", {})
            image_url = img_obj.get("url") if isinstance(img_obj, dict) else None

            # Get ticket URL
            ticket_url = show.get("url") or f"{BASE_URL}/shows"
            source_url = ticket_url or f"{BASE_URL}/shows"

            # Get price info
            price_min, price_max, is_free, price_note = parse_cost(show)

            # Infer subcategory
            subcategory = infer_subcategory(title, description)

            # Build tags
            tags = ["comedy", "dynamic-el-dorado", "old-fourth-ward"]
            if subcategory != "comedy":
                tags.append(subcategory)
            if is_recurring:
                tags.append("recurring")

            # Parse all future dates
            show_dates = parse_show_dates(show)

            if not show_dates:
                logger.debug(f"No future dates for show: {title}")
                continue

            # Build series hint for recurring shows
            series_hint = None
            frequency = None
            if recurring == "Weekly":
                frequency = "weekly"
            elif recurring == "Biweekly":
                frequency = "biweekly"
            elif recurring == "Monthly":
                frequency = "monthly"
            elif recurring == "Multiple dates":
                frequency = "irregular"

            if is_recurring and frequency:
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": frequency,
                }

            # Create one event per date
            for start_date, start_time in show_dates:
                events_found += 1

                # Hash on show_id + date to handle title changes
                content_hash = generate_content_hash(
                    title, "Dynamic El Dorado", f"{start_date}|{show_id}"
                )
                current_hashes.add(content_hash)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description[:2000] if description else f"{title} at Dynamic El Dorado",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "comedy",
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": price_note,
                    "is_free": is_free,
                    "source_url": source_url,
                    "ticket_url": ticket_url,
                    "image_url": image_url,
                    "raw_text": f"{title} | {recurring} | {start_date} {start_time}",
                    "extraction_confidence": 0.95,
                    "is_recurring": is_recurring,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record, series_hint=series_hint if is_recurring else None)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time}")
                except Exception as e:
                    logger.error(f"Failed to insert {title} on {start_date}: {e}")

        # Remove stale events (shows no longer on API)
        remove_stale_source_events(source_id, current_hashes)

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Dynamic El Dorado API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Dynamic El Dorado: {e}")
        raise

    logger.info(
        f"Dynamic El Dorado crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
