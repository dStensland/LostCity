"""
Crawler for Limelight Theater (formerly Village Theatre ATL).
Atlanta's home for comedy, improv, and independent performing arts.
Located at 349 Decatur St SE, Old Fourth Ward, Atlanta, GA.

Ticketing via tix.page platform at limelight.tix.page.
API: https://api.tix.page/event/v2/getListAllPublishedSite?domain=<org_id>
Limelight domain ID: 64a624cbadf2bb265f0ca4f5
  (resolved from subdomain "limelight" via
   https://api.tix.page/domain/getByAddress/limelight)

Shows include:
  - "Improvised Clue", "Very Harry PotterProv", "Improv A**hole"
  - "In the Limelight - Improv Jam" (free Thursdays)
  - Independent film screenings, theatre productions, gallery events

The venue operates Thu/Fri/Sat nights primarily.
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

# tix.page domain ID for Limelight Theater
# Resolved via: https://api.tix.page/domain/getByAddress/limelight
ORG_ID = "64a624cbadf2bb265f0ca4f5"
EVENTS_API_URL = (
    "https://api.tix.page/event/v2/getListAllPublishedSite"
    f"?domain={ORG_ID}&keyword=&search=&startDate=&endDate="
    "&projectType=&genre=&accessibility=&limit=100&offset=0"
)
BOX_OFFICE_URL = "https://limelight.tix.page"

PLACE_DATA = {
    "name": "Limelight Theater",
    "slug": "limelight-theater",
    "address": "349 Decatur St SE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7490,
    "lng": -84.3761,
    "place_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BOX_OFFICE_URL,
    "description": (
        "Limelight Theater is Atlanta's home for independent performing arts — "
        "improv comedy, theatre, indie film, and live music. Formerly Village "
        "Theatre ATL, rebranded as Limelight in 2023. Features a main stage, "
        "intimate blackbox theater, and gallery bar. Hosts improv jams (free "
        "Thursdays), original comedy productions, and works from Atlanta's "
        "independent creators."
    ),
    "vibes": ["comedy", "improv", "indie", "artsy", "casual", "old-fourth-ward"],
}

EASTERN = ZoneInfo("America/New_York")


def strip_html(html: str) -> str:
    """Strip HTML tags, converting <br> to newlines."""
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

    raw_dates = event.get("dates") or []
    if not raw_dates:
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
            logger.debug(f"Could not parse tix.page date: {date_str!r}")
            continue

    return results


def parse_price(event: dict) -> tuple[Optional[float], Optional[float], bool, Optional[str]]:
    """Extract price info from tix.page event. Returns (min, max, is_free, note)."""
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

    # Fall back to checking description and title for "free"
    desc = (event.get("description") or "").lower()
    title = (event.get("title") or event.get("name") or "").lower()
    if ("free" in desc or "free" in title) and "$" not in desc:
        return None, None, True, None

    return None, None, False, None


def infer_category(title: str, description: str) -> tuple[str, str]:
    """
    Infer (category, subcategory) from event title and description.
    Defaults to comedy/improv since that is this venue's primary programming.
    """
    combined = (title + " " + description).lower()

    if any(w in combined for w in ["improv", "improvised"]):
        return "comedy", "improv"
    if "sketch" in combined:
        return "comedy", "sketch"
    if any(w in combined for w in ["stand-up", "standup", "stand up", "open mic"]):
        return "comedy", "standup"
    if any(w in combined for w in ["comedy", "comedian", "funny"]):
        return "comedy", "comedy"
    if any(w in combined for w in ["film", "movie", "cinema", "screening", "short film"]):
        return "film", "screening"
    if any(w in combined for w in ["theatre", "theater", "play", "musical", "stage"]):
        return "theater", "theater"
    if any(w in combined for w in ["concert", "band", "live music", "jazz", "singer"]):
        return "music", "live"
    if any(w in combined for w in ["gallery", "art show", "exhibition", "opening"]):
        return "art", "exhibition"

    return "comedy", "improv"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Limelight Theater shows via tix.page API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        logger.info(f"Fetching Limelight Theater shows: {EVENTS_API_URL}")
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
            logger.info("Limelight Theater: no upcoming shows listed at this time")
            remove_stale_source_events(source_id, current_hashes)
            return 0, 0, 0

        for event in events:
            event_id = event.get("_id") or event.get("id", "")
            title = (event.get("title") or event.get("name") or "").strip()
            if not title:
                continue

            # Skip ongoing/class events without specific dates
            is_ongoing = (
                event.get("isOngoing")
                or event.get("dateInfo", "") == "Ongoing event/no specific date"
            )
            if is_ongoing:
                logger.debug(f"Skipping ongoing event: {title}")
                continue

            # Description
            desc_raw = event.get("description") or event.get("shortDescription") or ""
            description = strip_html(desc_raw) if desc_raw else f"{title} at Limelight Theater"

            # Image — tix.page image paths are relative; prepend API base if needed
            image_url = (
                event.get("promoImageUrl")
                or event.get("imageUrl")
                or event.get("image")
            )
            if image_url and isinstance(image_url, str) and not image_url.startswith("http"):
                image_url = f"https://api.tix.page/file{image_url}"

            # Ticket / source URL
            ticket_url = event.get("url") or event.get("ticketUrl")
            if not ticket_url and event_id:
                ticket_url = f"{BOX_OFFICE_URL}/event/{event_id}"
            source_url = ticket_url or BOX_OFFICE_URL

            # Price
            price_min, price_max, is_free, price_note = parse_price(event)

            # Category
            category, subcategory = infer_category(title, description)

            # Tags
            tags = ["comedy", "improv", "limelight", "old-fourth-ward"]
            if subcategory and subcategory not in tags:
                tags.append(subcategory)
            if is_free:
                tags.append("free")

            # Dates
            show_dates = parse_event_dates(event)
            if not show_dates:
                logger.debug(f"No future dates for: {title!r}")
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
                    title, "Limelight Theater", f"{start_date}|{event_id}"
                )
                current_hashes.add(content_hash)

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": description[:2000],
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
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
                    logger.info(f"Added: {title!r} on {start_date} at {start_time}")
                except Exception as e:
                    logger.error(f"Failed to insert {title!r} on {start_date}: {e}")

        remove_stale_source_events(source_id, current_hashes)

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Limelight Theater API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Limelight Theater: {e}")
        raise

    logger.info(
        f"Limelight Theater crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
