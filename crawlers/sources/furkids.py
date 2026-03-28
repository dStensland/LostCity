"""
Crawler for Furkids Animal Rescue & Shelters (furkids.org).
Georgia's largest no-kill animal rescue.

The Furkids events calendar uses a custom jQuery-Calendario widget backed by
a server-rendered JavaScript file at /js/event_data. That file exposes all
events for the current calendar window as a JS variable. Individual event
modals are served at /events/modal/{id} as plain HTML fragments — no JS
rendering required.

This makes Furkids fully scrapable with plain requests:
1. Fetch /js/event_data   → parse date-to-event-ID mapping
2. For multi-event "modal_day" dates, fetch /events/modal_day/{date} to get IDs
3. Fetch each /events/modal/{id} → extract title, date, time, description, image

Events are adoption events, fundraisers, and open house days spread across
PetSmart/Petco partner stores and Furkids' own shelter locations.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://furkids.org"
EVENT_DATA_URL = f"{BASE_URL}/js/event_data"
MODAL_URL = f"{BASE_URL}/events/modal/{{event_id}}"
MODAL_DAY_URL = f"{BASE_URL}/events/modal_day/{{day_key}}"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

# Primary venue — used as the organizing entity when events are at partner stores.
# Adoption events at PetSmart/Petco are Furkids-organized even if offsite.
PLACE_DATA = {
    "name": "Furkids Animal Rescue & Shelters",
    "slug": "furkids-animal-rescue",
    "address": "6065 Roswell Rd NE Suite 100",
    "neighborhood": "Sandy Springs",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30328",
    "lat": 33.9158,
    "lng": -84.3654,
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["family-friendly", "dog-friendly"],
}


def _fetch(url: str) -> Optional[str]:
    """Return response text or None on failure."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return None


def _parse_event_data_js(js_text: str) -> dict[str, list[str]]:
    """
    Parse the /js/event_data JavaScript blob.

    Returns a mapping of ISO date string (YYYY-MM-DD) -> list of event modal IDs.
    Modal-day entries are resolved separately; this returns their day-key strings
    prefixed with "day:" so the caller knows to hit the modal_day endpoint.

    The JS format is:
        '12-07-2025' : [
            '<a href="/events/modal/200756" ...>Title</a>',
            ...
        ],
        '12-06-2025' : [
            '<a href="/events/modal_day/06-12-2025" ...>4 events</a>',
        ],
    Dates in the keys are MM-DD-YYYY; modal_day hrefs are DD-MM-YYYY.
    """
    # Extract date blocks: key + everything inside the brackets
    pattern = r"'(\d{2}-\d{2}-\d{4})'\s*:\s*\[(.*?)\]"
    results: dict[str, list[str]] = {}

    for match in re.finditer(pattern, js_text, re.DOTALL):
        raw_date = match.group(1)  # MM-DD-YYYY
        block = match.group(2)

        # Convert to YYYY-MM-DD
        parts = raw_date.split("-")
        if len(parts) != 3:
            continue
        iso_date = f"{parts[2]}-{parts[0]}-{parts[1]}"

        modal_ids: list[str] = re.findall(r'/events/modal/(\d+)', block)
        modal_day_keys: list[str] = re.findall(r'/events/modal_day/([\d-]+)', block)

        entries: list[str] = [f"id:{mid}" for mid in modal_ids]
        entries += [f"day:{dk}" for dk in modal_day_keys]

        if entries:
            results[iso_date] = entries

    return results


def _resolve_modal_day(day_key: str) -> list[str]:
    """
    Fetch a modal_day page and return the list of modal event IDs within it.

    modal_day pages list multiple events for a single busy day.
    """
    url = MODAL_DAY_URL.format(day_key=day_key)
    text = _fetch(url)
    if not text:
        return []
    return re.findall(r'/events/modal/(\d+)', text)


def _parse_modal(event_id: str) -> Optional[dict]:
    """
    Fetch a single event modal and extract its details.

    Modal HTML structure:
    - <h4 class="modal-title">  — event title
    - <div class="modal-body"> — contains:
        - <li> with "Starts {weekday}, {month} {day}, {year}" and "at {time}"
        - Description paragraphs
        - Optional <img> for event photo
    """
    url = MODAL_URL.format(event_id=event_id)
    text = _fetch(url)
    if not text:
        return None

    soup = BeautifulSoup(text, "html.parser")

    # Title
    title_el = soup.select_one(".modal-title, h4, h3")
    if not title_el:
        return None
    title = title_el.get_text(strip=True)
    if not title:
        return None

    # Parse date and time from the entry-meta section
    # Format: "Starts Saturday, January 17, 2026\n at 12:00pm"
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    meta_block = soup.select_one(".entry-meta")
    if meta_block:
        meta_text = meta_block.get_text(" ", strip=True)

        # Date: "Starts Saturday, January 17, 2026" or "Starts January 17, 2026"
        date_match = re.search(
            r"Starts\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*"
            r"(January|February|March|April|May|June|July|August|September|October|November|December)"
            r"\s+(\d{1,2}),?\s+(\d{4})",
            meta_text,
            re.IGNORECASE,
        )
        if date_match:
            try:
                dt = datetime.strptime(
                    f"{date_match.group(1)} {date_match.group(2)} {date_match.group(3)}",
                    "%B %d %Y",
                )
                start_date = dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

        # Time: "at 12:00pm" or "at 11:00am"
        time_match = re.search(r"at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)", meta_text, re.IGNORECASE)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2) or "0")
            period = time_match.group(3).lower()
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0
            start_time = f"{hour:02d}:{minute:02d}"

    if not start_date:
        logger.debug("No date found in modal %s (%s)", event_id, title)
        return None

    # Description from entry-content paragraphs
    desc_parts: list[str] = []
    content_div = soup.select_one(".entry-content")
    if content_div:
        for p in content_div.find_all("p"):
            text = p.get_text(" ", strip=True)
            # Strip emoji-only lines and very short fragments
            cleaned = re.sub(r"[^\x00-\x7F]+", "", text).strip()
            if len(cleaned) > 15:
                desc_parts.append(text)

    # Look for time range in description body (e.g., "12- 2pm" or "11am–2pm")
    desc_text = " ".join(desc_parts)
    if desc_text and not end_time:
        range_match = re.search(
            r"(\d{1,2}(?::\d{2})?\s*[ap]m?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*[ap]m?)",
            desc_text,
            re.IGNORECASE,
        )
        if range_match:
            # Re-parse start from description if not found in meta
            if not start_time:
                t_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", range_match.group(1), re.IGNORECASE)
                if t_match:
                    h, m, p = int(t_match.group(1)), int(t_match.group(2) or "0"), t_match.group(3).lower()
                    if p == "pm" and h != 12:
                        h += 12
                    elif p == "am" and h == 12:
                        h = 0
                    start_time = f"{h:02d}:{m:02d}"
            # Parse end time
            t2 = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", range_match.group(2), re.IGNORECASE)
            if t2:
                h2, m2, p2 = int(t2.group(1)), int(t2.group(2) or "0"), t2.group(3).lower()
                if p2 == "pm" and h2 != 12:
                    h2 += 12
                elif p2 == "am" and h2 == 12:
                    h2 = 0
                end_time = f"{h2:02d}:{m2:02d}"

    description = " ".join(desc_parts[:4])
    if len(description) > 800:
        description = description[:797] + "..."
    if not description:
        description = f"{title} — Furkids Animal Rescue event"

    # Image
    image_url: Optional[str] = None
    img = soup.select_one(".modal-body img")
    if img:
        src = img.get("src") or img.get("data-src")
        if src:
            image_url = src if src.startswith("http") else BASE_URL + src

    return {
        "title": title,
        "start_date": start_date,
        "start_time": start_time,
        "end_time": end_time,
        "description": description,
        "image_url": image_url,
        "source_url": url,
    }


def _categorize(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags from event content."""
    text = f"{title} {description}".lower()
    base_tags = ["animals", "furkids"]

    if any(w in text for w in ["adopt", "adoption", "open house", "meet the pets"]):
        return "community", "adoption-event", base_tags + ["adoption", "family-friendly"]

    if any(w in text for w in ["volunteer", "orientation"]):
        return "community", "volunteer", base_tags + ["volunteer"]

    if "foster" in text:
        return "community", "foster", base_tags + ["volunteer", "foster"]

    if any(w in text for w in ["fundraiser", "gala", "benefit", "auction", "festival", "fashion", "kissing booth", "bbq"]):
        return "community", "fundraiser", base_tags + ["fundraiser"]

    if any(w in text for w in ["thrift", "shop", "sale", "deals"]):
        return "community", "community-event", base_tags + ["shopping"]

    if any(w in text for w in ["clinic", "vaccine", "spay", "neuter", "wellness"]):
        return "community", "pet-clinic", base_tags + ["health", "family-friendly"]

    return "community", "community-event", base_tags + ["family-friendly"]


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Furkids Animal Rescue events.

    Uses the /js/event_data JavaScript endpoint to enumerate all event IDs,
    then fetches each event modal via plain HTTP — no browser required.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    today = datetime.now().date()

    # Step 1: Get all event IDs from the calendar JS
    logger.info("Fetching Furkids event data from %s", EVENT_DATA_URL)
    js_text = _fetch(EVENT_DATA_URL)
    if not js_text:
        logger.error("Could not fetch Furkids event data")
        return 0, 0, 0

    date_to_entries = _parse_event_data_js(js_text)
    logger.info("Found %d calendar dates with events", len(date_to_entries))

    # Step 2: Collect all modal event IDs, filtering past dates
    modal_ids_to_fetch: list[str] = []
    seen_ids: set[str] = set()

    for iso_date, entries in sorted(date_to_entries.items()):
        # Quick date filter — skip obviously past dates
        try:
            cal_date = datetime.strptime(iso_date, "%Y-%m-%d").date()
            if cal_date < today:
                continue
        except ValueError:
            continue

        for entry in entries:
            if entry.startswith("id:"):
                mid = entry[3:]
                if mid not in seen_ids:
                    seen_ids.add(mid)
                    modal_ids_to_fetch.append(mid)
            elif entry.startswith("day:"):
                day_key = entry[4:]
                resolved = _resolve_modal_day(day_key)
                for mid in resolved:
                    if mid not in seen_ids:
                        seen_ids.add(mid)
                        modal_ids_to_fetch.append(mid)

    logger.info("Fetching %d individual event modals", len(modal_ids_to_fetch))

    # Step 3: Fetch and process each event modal
    for event_id in modal_ids_to_fetch:
        event_data = _parse_modal(event_id)
        if not event_data:
            continue

        # Skip past events (modal may contain a past date)
        try:
            event_date = datetime.strptime(event_data["start_date"], "%Y-%m-%d").date()
            if event_date < today:
                logger.debug("Skipping past event: %s on %s", event_data["title"], event_data["start_date"])
                continue
        except (ValueError, TypeError):
            continue

        events_found += 1
        title = event_data["title"]
        start_date = event_data["start_date"]

        category, subcategory, tags = _categorize(title, event_data.get("description") or "")

        is_free = any(
            w in (f"{title} {event_data.get('description') or ''}").lower()
            for w in ["free", "no cost", "no charge", "no adoption fee"]
        )
        # Adoption events typically have reduced (not zero) fees; don't mark as free
        # unless explicitly stated
        if subcategory == "adoption-event" and not is_free:
            is_free = False

        content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": event_data.get("description"),
            "start_date": start_date,
            "start_time": event_data.get("start_time"),
            "end_date": None,
            "end_time": event_data.get("end_time"),
            "is_all_day": False,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "price_min": 0 if is_free else None,
            "price_max": 0 if is_free else None,
            "price_note": "Free" if is_free else None,
            "is_free": is_free,
            "source_url": event_data["source_url"],
            "ticket_url": event_data["source_url"],
            "image_url": event_data.get("image_url"),
            "raw_text": f"{title} {event_data.get('description') or ''}",
            "extraction_confidence": 0.88,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            logger.debug("Updated: %s on %s", title, start_date)
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info("Added: [%s] %s on %s", category, title, start_date)
        except Exception as exc:
            logger.error("Failed to insert '%s': %s", title, exc)

    logger.info(
        "Furkids crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
