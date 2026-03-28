"""
Crawler for Sketchworks Comedy (sketchworkscomedy.com).
Atlanta's premier sketch comedy troupe, founded 2001.
Located in Midtown Atlanta.

Uses tix.page platform for show ticketing.
API: https://api.tix.page/event/v2/getListAllPublishedSite?domain=<org_id>
Org ID: 64b0b087b2e323289d140ab4

Shows may be sparse — Sketchworks does a few marquee productions per year
plus their ongoing "VAPE the Musical" style multi-week runs.
The crawler handles the 0-events case gracefully.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import requests

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# tix.page org ID for Sketchworks Comedy
ORG_ID = "64b0b087b2e323289d140ab4"
EVENTS_API_URL = (
    f"https://api.tix.page/event/v2/getListAllPublishedSite"
    f"?domain={ORG_ID}&keyword=&search=&startDate=&endDate="
    f"&projectType=&genre=&accessibility=&limit=100&offset=0"
)
BOX_OFFICE_URL = "https://sketchworkscomedy.tix.page"
BASE_URL = "https://sketchworkscomedy.com"

PLACE_DATA = {
    "name": "Sketchworks Comedy",
    "slug": "sketchworks-comedy",
    # Sketchworks is a troupe, not a fixed venue — they perform at rented spaces.
    # Using their studio/class location in Midtown as the base address.
    "address": "887 W Marietta St NW",
    "neighborhood": "Westside",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7837,
    "lng": -84.4082,
    "venue_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BASE_URL,
    "description": (
        "Atlanta's premier sketch comedy troupe since 2001, featuring top working "
        "professional comedians. Produces original scripted sketch comedy shows, "
        "original musicals, classes, and corporate events."
    ),
    "vibes": ["comedy", "sketch", "live-shows"],
}

EASTERN = ZoneInfo("America/New_York")


def strip_html(html: str) -> str:
    """Strip HTML tags from description."""
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_event_dates(event: dict) -> list[tuple[str, str]]:
    """
    Parse future event dates from a tix.page event dict.
    Returns list of (YYYY-MM-DD, HH:MM) tuples in Eastern time.
    """
    now = datetime.now(timezone.utc)
    results = []

    # tix.page events have a 'dates' list or 'startDate'/'endDate' fields
    raw_dates = event.get("dates") or []
    if not raw_dates:
        # Try single date fields
        start = event.get("startDate") or event.get("startTime") or event.get("date")
        if start:
            raw_dates = [start]

    for date_entry in raw_dates:
        date_str = None
        if isinstance(date_entry, str):
            date_str = date_entry
        elif isinstance(date_entry, dict):
            date_str = date_entry.get("startDate") or date_entry.get("date")

        if not date_str:
            continue

        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            if dt < now:
                continue
            dt_eastern = dt.astimezone(EASTERN)
            results.append((
                dt_eastern.strftime("%Y-%m-%d"),
                dt_eastern.strftime("%H:%M"),
            ))
        except (ValueError, TypeError):
            logger.debug(f"Could not parse tix.page date: {date_str}")
            continue

    return results


def parse_price(event: dict) -> tuple[Optional[float], Optional[float], bool, Optional[str]]:
    """Extract price info from tix.page event. Returns (min, max, is_free, note)."""
    # Try 'lowestPrice', 'price', 'ticketPrice'
    for field in ["lowestPrice", "price", "ticketPrice", "cost", "minPrice"]:
        val = event.get(field)
        if val is not None:
            if isinstance(val, (int, float)) and val == 0:
                return None, None, True, None
            if isinstance(val, (int, float)) and val > 0:
                return float(val), None, False, None
            if isinstance(val, str):
                if "free" in val.lower():
                    return None, None, True, None
                m = re.search(r"\$?(\d+(?:\.\d{2})?)", val)
                if m:
                    return float(m.group(1)), None, False, None

    # Check description for pricing hints
    desc = event.get("description", "") or ""
    desc_lower = desc.lower() if isinstance(desc, str) else ""
    if "free" in desc_lower and "$" not in desc_lower:
        return None, None, True, None

    return None, None, False, None


def infer_subcategory(title: str, description: str) -> str:
    """Infer comedy subcategory from title and description text."""
    combined = (title + " " + description).lower()
    if "sketch" in combined:
        return "sketch"
    if "improv" in combined:
        return "improv"
    if "musical" in combined:
        return "comedy"
    if "stand-up" in combined or "standup" in combined or "stand up" in combined:
        return "standup"
    if "open mic" in combined:
        return "open_mic"
    return "sketch"  # Sketchworks default


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Sketchworks Comedy shows via tix.page API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        logger.info(f"Fetching Sketchworks Comedy shows: {EVENTS_API_URL}")
        resp = requests.get(
            EVENTS_API_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
                "Referer": BOX_OFFICE_URL,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        events = data.get("data", [])
        total = data.get("total", 0)
        logger.info(f"tix.page API returned {total} events ({len(events)} in page)")

        if not events:
            logger.info("Sketchworks Comedy: no upcoming shows listed at this time")
            remove_stale_source_events(source_id, current_hashes)
            return 0, 0, 0

        for event in events:
            event_id = event.get("_id") or event.get("id", "")
            title = (event.get("title") or event.get("name") or "").strip()
            if not title:
                continue

            # Skip class-only events (recurring ongoing classes without dates)
            is_ongoing = event.get("isOngoing") or event.get("dateInfo", "") == "Ongoing event/no specific date"
            if is_ongoing:
                logger.debug(f"Skipping ongoing/class event: {title}")
                continue

            # Parse description
            desc_raw = event.get("description") or event.get("shortDescription") or ""
            description = strip_html(desc_raw) if desc_raw else f"{title} at Sketchworks Comedy"

            # Get image
            image_url = (
                event.get("promoImageUrl")
                or event.get("imageUrl")
                or event.get("image")
            )

            # Get ticket URL
            ticket_url = event.get("url") or event.get("ticketUrl") or f"{BOX_OFFICE_URL}"
            source_url = ticket_url or BOX_OFFICE_URL

            # Price info
            price_min, price_max, is_free, price_note = parse_price(event)

            # Subcategory
            subcategory = infer_subcategory(title, description)

            # Tags
            tags = ["comedy", "sketchworks", "sketch-comedy", "midtown"]
            if subcategory != "comedy":
                tags.append(subcategory)

            # Parse dates
            show_dates = parse_event_dates(event)
            if not show_dates:
                logger.debug(f"No future dates for event: {title}")
                continue

            # Series hint for multi-date shows
            series_hint = None
            if len(show_dates) > 1:
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "irregular",
                }

            for start_date, start_time in show_dates:
                events_found += 1

                content_hash = generate_content_hash(
                    title, "Sketchworks Comedy", f"{start_date}|{event_id}"
                )
                current_hashes.add(content_hash)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description[:2000],
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
                    "raw_text": f"{title} | {start_date} {start_time}",
                    "extraction_confidence": 0.90,
                    "is_recurring": len(show_dates) > 1,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(
                        event_record,
                        series_hint=series_hint if len(show_dates) > 1 else None,
                    )
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time}")
                except Exception as e:
                    logger.error(f"Failed to insert {title} on {start_date}: {e}")

        remove_stale_source_events(source_id, current_hashes)

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Sketchworks Comedy API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Sketchworks Comedy: {e}")
        raise

    logger.info(
        f"Sketchworks Comedy crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
