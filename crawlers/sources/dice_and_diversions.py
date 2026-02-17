"""
Crawler for Dice + Diversions (diceanddiversions.com).

Atlanta's largest tabletop gaming convention. Board games, RPGs, miniature
painting, playtesting, social deduction, tournaments. Held at the Atlanta
Marriott Northwest at Galleria.

Imports from a Tabletop.Events CSV export. The CSV has columns:
  Event Name, Event Number, Event Type, Host Names, Description, Price,
  Age Range, Max Tickets, Sold Count, Wait Count, Starts, Start Date (UTC),
  Duration (minutes), More Info, Room, Space, Date Created, Date Updated, View URI
"""

from __future__ import annotations

import csv
import logging
import os
from datetime import datetime, timezone, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "dice-diversions-2026-schedule.csv")
BASE_URL = "https://tabletop.events/conventions/dice-diversions-2026"
SITE_URL = "https://diceanddiversions.com"

VENUE_DATA = {
    "name": "Atlanta Marriott Northwest at Galleria",
    "slug": "atlanta-marriott-northwest-at-galleria",
    "address": "200 Interstate N Pkwy E SE",
    "neighborhood": "Galleria",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8985,
    "lng": -84.4670,
    "venue_type": "hotel",
    "spot_type": "hotel",
    "website": SITE_URL,
    "vibes": ["gaming", "family-friendly", "convention"],
}

# Map CSV Event Type to our category taxonomy
EVENT_TYPE_MAP = {
    "Board Game": "gaming",
    "RPG": "gaming",
    "Playtesting (Unreleased Game)": "gaming",
    "Social Deduction": "gaming",
    "Tournaments": "gaming",
    "Miniature Painting": "community",
    "Special Event": "community",
    "Eat, Play, Win!": "gaming",
}


def parse_utc_datetime(utc_str: str) -> tuple[str, str]:
    """Parse UTC datetime string to local date and time (EST = UTC-5)."""
    dt = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Convert to EST
    est = dt.astimezone(timezone(timedelta(hours=-5)))
    return est.strftime("%Y-%m-%d"), est.strftime("%H:%M")


def build_description(row: dict) -> str:
    """Build a clean description from CSV fields."""
    parts = []

    desc = (row.get("Description") or "").strip()
    if desc:
        parts.append(desc)

    event_type = row.get("Event Type", "")
    age = row.get("Age Range", "")
    room = row.get("Room", "")
    space = row.get("Space", "")
    max_tickets = row.get("Max Tickets", "")

    details = []
    if event_type:
        details.append(f"Type: {event_type}")
    if age:
        details.append(f"Ages: {age}")
    if room:
        loc = room
        if space:
            loc += f" / {space}"
        details.append(f"Location: {loc}")
    if max_tickets:
        details.append(f"Max players: {max_tickets}")

    if details:
        parts.append("\n".join(details))

    return "\n\n".join(parts)


def crawl(source: dict) -> tuple[int, int, int]:
    """Import Dice + Diversions events from CSV export."""
    venue_id = get_or_create_venue(VENUE_DATA)
    source_id = source.get("id")

    if not os.path.exists(CSV_PATH):
        logger.error(f"CSV not found at {CSV_PATH}")
        return (0, 0, 0)

    events_found = 0
    events_new = 0
    events_updated = 0

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get("Event Name") or "").strip()
            if not title:
                continue

            utc_str = row.get("Start Date (UTC)", "")
            if not utc_str:
                continue

            events_found += 1

            start_date, start_time = parse_utc_datetime(utc_str)

            # Calculate end time from duration
            duration_min = int(row.get("Duration (minutes)", 0) or 0)
            end_time = None
            if duration_min > 0:
                dt = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                end_dt = dt + timedelta(minutes=duration_min)
                est_end = end_dt.astimezone(timezone(timedelta(hours=-5)))
                end_time = est_end.strftime("%H:%M")

            # Build source URL
            view_uri = row.get("View URI", "")
            source_url = f"https://tabletop.events{view_uri}" if view_uri else f"{BASE_URL}/schedule"

            # Price
            price_str = row.get("Price", "0")
            try:
                price = float(price_str)
            except (ValueError, TypeError):
                price = 0.0

            description = build_description(row)
            event_type = row.get("Event Type", "")
            category = EVENT_TYPE_MAP.get(event_type, "gaming")

            # More info link (BoardGameGeek, etc.)
            more_info = row.get("More Info", "")

            # Dedup
            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

            event_data = {
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "end_time": end_time,
                "venue_id": venue_id,
                "source_id": source_id,
                "source_url": source_url,
                "category": category,
                "description": description,
                "is_free": price == 0,
                "price_min": price if price > 0 else None,
                "price_max": price if price > 0 else None,
                "content_hash": content_hash,
                "tags": [event_type.lower().replace(" ", "-")] if event_type else [],
            }

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_data)
                events_updated += 1
                continue

            try:
                insert_event(event_data)
                events_new += 1
            except (ValueError, Exception) as e:
                logger.warning(f"Failed to insert '{title}': {e}")

    logger.info(
        f"Dice + Diversions: found={events_found} new={events_new} updated={events_updated}"
    )
    return (events_found, events_new, events_updated)
