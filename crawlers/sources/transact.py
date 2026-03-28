"""
Crawler for TRANSACT.

Official source:
- The official homepage exposes structured Event JSON-LD with the 2026 Atlanta
  dates, venue, registration URL, image, and daily schedule.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
from datetime import date, datetime
from typing import Any

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://www.transactshow.com/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"


def _fetch_html(url: str) -> str:
    headers = {"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.exceptions.SSLError as exc:
        logger.warning("requests TLS failed for %s, falling back to curl: %s", url, exc)

    curl_bin = shutil.which("curl")
    if not curl_bin:
        raise RuntimeError(f"curl is not available for TLS fallback: {url}")

    proc = subprocess.run(
        [
            curl_bin,
            "-L",
            "--silent",
            "--show-error",
            "--compressed",
            "--max-time",
            "30",
            "-A",
            USER_AGENT,
            url,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
        text=True,
    )
    return proc.stdout


def _parse_event_jsonld(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script", type="application/ld+json"):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and payload.get("@type") == "Event":
            return payload
    raise ValueError("TRANSACT homepage did not expose structured Event data")


def parse_homepage(html: str, today: date | None = None) -> dict:
    """Extract TRANSACT 2026 sessions from homepage JSON-LD."""
    today = today or datetime.now().date()
    event = _parse_event_jsonld(html)

    start_dt = datetime.fromisoformat(event["startDate"])
    end_dt = datetime.fromisoformat(event["endDate"])
    if end_dt.date() < today:
        raise ValueError("TRANSACT homepage only exposes a past-dated cycle")

    location = event.get("location") or {}
    address = location.get("address") or {}
    venue = {
        "name": location.get("name") or "Georgia World Congress Center",
        "slug": "georgia-world-congress-center",
        "address": address.get("streetAddress") or "285 Andrew Young International Blvd NW",
        "city": address.get("addressLocality") or "Atlanta",
        "state": address.get("addressRegion") or "GA",
        "zip": address.get("postalCode") or "30313",
        "place_type": "convention_center",
        "spot_type": "convention_center",
        "website": "https://www.gwcca.org/",
    }

    schedules = event.get("eventSchedule") or []
    sessions = []
    for schedule in schedules:
        if not isinstance(schedule, dict):
            continue
        day_start = str(schedule.get("startDate") or "").strip()
        start_time = str(schedule.get("startTime") or "").strip()
        end_time = str(schedule.get("endTime") or "").strip()
        if not day_start or not start_time or not end_time:
            continue
        sessions.append(
            {
                "title": "TRANSACT 2026",
                "start_date": day_start,
                "start_time": start_time[:5],
                "end_time": end_time[:5],
            }
        )
    if not sessions:
        raise ValueError("TRANSACT homepage did not expose daily session schedule data")

    offers = event.get("offers") or {}
    ticket_url = None
    if isinstance(offers, dict):
        ticket_url = offers.get("url")
    if not ticket_url:
        ticket_url = "https://www.transactshow.com/register/"

    image_value = event.get("image")
    image_url = None
    if isinstance(image_value, list) and image_value:
        image_url = str(image_value[0]).strip()
    elif isinstance(image_value, str):
        image_url = image_value.strip()

    description = re.sub(r"\s+", " ", str(event.get("description") or "").strip())
    if not description:
        description = (
            "TRANSACT is a destination payments conference for fintech, issuers, acquirers, "
            "merchants, and processors at Georgia World Congress Center."
        )

    return {
        "title": "TRANSACT 2026",
        "source_url": SOURCE_URL,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "description": description,
        "venue": venue,
        "sessions": sessions,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl TRANSACT from the official homepage."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    html = _fetch_html(SOURCE_URL)
    event = parse_homepage(html)
    venue_id = get_or_create_place(event["venue"])

    for session in event["sessions"]:
        content_hash = generate_content_hash(session["title"], event["venue"]["name"], session["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": session["title"],
            "description": event["description"],
            "start_date": session["start_date"],
            "start_time": session["start_time"],
            "end_date": None,
            "end_time": session["end_time"],
            "is_all_day": False,
            "category": "community",
            "subcategory": "conference",
            "tags": ["payments", "fintech", "conference", "technology", "trade-show"],
            "price_min": None,
            "price_max": None,
            "price_note": "See the official TRANSACT registration page for current pass pricing.",
            "is_free": False,
            "source_url": event["source_url"],
            "ticket_url": event["ticket_url"],
            "image_url": event["image_url"],
            "raw_text": (
                f"{session['title']} | {session['start_date']} | "
                f"{session['start_time']}-{session['end_time']} | {event['venue']['name']}"
            ),
            "extraction_confidence": 0.98,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            insert_event(event_record)
            events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale TRANSACT events after refresh", stale_removed)

    logger.info(
        "TRANSACT crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
