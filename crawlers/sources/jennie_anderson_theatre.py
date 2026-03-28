"""
Crawler for Jennie T. Anderson Theatre (Cobb Civic Center).

606-seat performing arts venue operated by Cobb County Parks.
Home to Georgia Players Guild performances.

Site is Next.js + Drupal headless CMS.  Event data is embedded in
__NEXT_DATA__ JSON on the location page — no Playwright needed.
"""

from __future__ import annotations

import json
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
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

LOCATION_URL = "https://www.cobbcounty.gov/jennie-t-anderson-theatre"
REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"}

PLACE_DATA = {
    "name": "Jennie T. Anderson Theatre",
    "slug": "jennie-anderson-theatre",
    "address": "548 S Marietta Pkwy SE",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9433,
    "lng": -84.5360,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": LOCATION_URL,
    "description": (
        "606-seat performing arts theater at the Cobb Civic Center complex, "
        "operated by Cobb County Parks. Home to Georgia Players Guild and "
        "touring performances."
    ),
    "vibes": ["theater", "performing-arts", "family-friendly"],
}


def _extract_next_data(html: str) -> Optional[dict]:
    """Extract __NEXT_DATA__ JSON from the page."""
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    if not script:
        return None
    try:
        return json.loads(script.string or "")
    except (json.JSONDecodeError, TypeError):
        return None


def _parse_iso_timestamp(value: str | dict | None) -> tuple[Optional[str], Optional[str]]:
    """Parse ISO timestamp or event date object into (date, time)."""
    if not value:
        return None, None

    # Handle dict with 'time' and/or 'timestamp' keys
    if isinstance(value, dict):
        iso_str = value.get("time") or ""
    else:
        iso_str = str(value)

    iso_str = iso_str.strip()
    if not iso_str:
        return None, None

    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        pass

    # Fallback: date-only
    if re.match(r"^\d{4}-\d{2}-\d{2}$", iso_str):
        return iso_str, None

    return None, None


def _clean_html(text: str) -> str:
    """Strip HTML tags and collapse whitespace."""
    cleaned = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", cleaned).strip()


def _fetch_event_detail(event_path: str, build_id: str) -> Optional[dict]:
    """Fetch individual event detail for description and image."""
    # Strip leading slash and .html
    path = event_path.strip("/")
    detail_url = f"https://www.cobbcounty.gov/_next/data/{build_id}/{path}.json"
    try:
        resp = requests.get(detail_url, timeout=15, headers=REQUEST_HEADERS)
        if resp.ok:
            data = resp.json()
            return data.get("pageProps", {}).get("nodeResource", {})
    except Exception as e:
        logger.debug("Failed to fetch event detail %s: %s", event_path, e)
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Jennie T. Anderson Theatre events from Cobb County website."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()
    today = datetime.now().date()

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        logger.info("Fetching Jennie T. Anderson Theatre: %s", LOCATION_URL)
        resp = requests.get(LOCATION_URL, timeout=30, headers=REQUEST_HEADERS)
        resp.raise_for_status()

        next_data = _extract_next_data(resp.text)
        if not next_data:
            logger.error("Could not extract __NEXT_DATA__ from page")
            return 0, 0, 0

        # Extract buildId for detail page fetches
        build_id = next_data.get("buildId", "")

        # Navigate to event data
        page_props = next_data.get("props", {}).get("pageProps", {})
        node = page_props.get("nodeResource", {})
        events_data = node.get("events", {})
        event_list = events_data.get("results", [])

        if not event_list:
            logger.warning("No events found in __NEXT_DATA__ for JTA")
            return 0, 0, 0

        logger.info("Found %d events on JTA location page", len(event_list))

        for event in event_list:
            title = (event.get("title") or "").strip()
            if not title or len(title) < 3:
                continue

            start_date, start_time = _parse_iso_timestamp(event.get("startDate"))
            end_date, end_time = _parse_iso_timestamp(event.get("endDate"))

            if not start_date:
                continue

            # Skip past events
            try:
                if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
                    continue
            except ValueError:
                continue

            # Build source URL
            event_path = event.get("path", "")
            source_url = f"https://www.cobbcounty.gov{event_path}" if event_path else LOCATION_URL

            # Fetch detail page for description and image
            description = None
            image_url = None
            ticket_url = None

            if event_path and build_id:
                detail = _fetch_event_detail(event_path, build_id)
                if detail:
                    raw_desc = detail.get("description", "")
                    if raw_desc:
                        description = _clean_html(raw_desc)[:500]

                    img_data = detail.get("image")
                    if isinstance(img_data, dict):
                        image_url = img_data.get("url")
                    elif isinstance(img_data, str):
                        image_url = img_data

                    reg = detail.get("registration")
                    if isinstance(reg, dict):
                        ticket_url = reg.get("url")
                    elif isinstance(reg, str) and reg.startswith("http"):
                        ticket_url = reg

            # Determine category from event categories
            event_cats = event.get("eventCategories", [])
            cat_names = [c.get("name", "").lower() for c in event_cats if isinstance(c, dict)]

            tags = ["jennie-anderson-theatre", "cobb-county", "marietta", "performing-arts"]
            subcategory = None

            if any("music" in c or "concert" in c for c in cat_names):
                category = "music"
                subcategory = "live"
                tags.append("live-music")
            elif any("comedy" in c for c in cat_names):
                category = "comedy"
                tags.append("comedy")
            elif any("dance" in c for c in cat_names):
                category = "theater"
                subcategory = "dance"
                tags.append("dance")
            else:
                category = "theater"
                tags.append("theater")

            # Check for family-friendly signals
            if any(kw in title.lower() for kw in ("family", "kids", "children", "youth")):
                tags.append("family")

            # Georgia Players Guild is common presenter
            if "georgia players guild" in (description or "").lower() or "players guild" in title.lower():
                tags.append("georgia-players-guild")

            events_found += 1

            hash_key = f"{start_date}|{start_time}" if start_time else start_date
            content_hash = generate_content_hash(
                title, "Jennie T. Anderson Theatre", hash_key
            )
            seen_hashes.add(content_hash)

            # Multi-date shows get series hint
            series_hint = None
            if end_date and end_date != start_date:
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                }
                if description:
                    series_hint["description"] = description
                if image_url:
                    series_hint["image_url"] = image_url

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description or f"{title} at Jennie T. Anderson Theatre",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": sorted(set(tags)),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": source_url,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.92,
                "is_recurring": bool(end_date and end_date != start_date),
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info("Added: %s (%s)", title, start_date)
            except Exception as e:
                logger.error("Failed to insert: %s: %s", title, e)

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info("Removed %d stale JTA events", stale_removed)

        logger.info(
            "Jennie T. Anderson Theatre crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Jennie T. Anderson Theatre: %s", exc)
        raise

    return events_found, events_new, events_updated
