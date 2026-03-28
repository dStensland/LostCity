"""
Crawler for Open Hand Atlanta volunteer shifts.

Uses the Giveffect JSON API directly (no browser required).
Endpoint: /volunteer_calendar/3546/ajax_volunteer.json?start=YYYY-MM-DD&end=YYYY-MM-DD

Returns structured data with job descriptions, age requirements, and per-shift
instances with start/end timestamps and remaining spots. Each shift type is
grouped into a series to prevent feed spam.

Volume: ~285 shift instances per 30-day window across 14 job types and 18 shifts.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta

import requests

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.openhandatlanta.org"
CALENDAR_API = "https://donate.openhandatlanta.org/volunteer_calendar/3546/ajax_volunteer.json"
SHIFT_JOIN_BASE = "https://donate.openhandatlanta.org/volunteer_shifts"

OPEN_HAND_HQ = {
    "name": "Open Hand Atlanta",
    "slug": "open-hand-atlanta",
    "address": "1380 West Marietta St NW",
    "neighborhood": "Underwood Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.8077,
    "lng": -84.4272,
    "place_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "food"],
}


def _determine_category(title: str, description: str = "") -> str:
    text = f"{title} {description}".lower()
    if any(word in text for word in ["training", "tour", "orientation"]):
        return "learning"
    return "community"


def _extract_tags(title: str, description: str = "") -> list[str]:
    text = f"{title} {description}".lower()
    tags = {"volunteer", "volunteer-opportunity", "food", "charity", "open-hand-atlanta"}
    if any(word in text for word in ["meal", "packing", "kitchen", "culinary", "bagging"]):
        tags.add("food")
    if any(word in text for word in ["delivery", "driver"]):
        tags.add("delivery")
    if any(word in text for word in ["front desk", "greeter"]):
        tags.add("community")
    if any(word in text for word in ["tour", "orientation", "training"]):
        tags.add("education")
    if any(word in text for word in ["garden", "planting"]):
        tags.add("outdoors")
    return sorted(tags)


def _clean_description(raw: str) -> str:
    """Clean up Giveffect description HTML/whitespace."""
    text = re.sub(r"\r\n", "\n", raw)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _format_time(ts: int) -> str:
    """Unix timestamp to HH:MM."""
    return datetime.fromtimestamp(ts).strftime("%H:%M")


def _format_time_label(ts: int) -> str:
    """Unix timestamp to human-readable time like '7:00 AM'."""
    return datetime.fromtimestamp(ts).strftime("%-I:%M %p").lstrip("0")


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Open Hand volunteer shifts from the Giveffect JSON API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_place(OPEN_HAND_HQ)

    today = date.today()
    end_date = today + timedelta(days=45)

    logger.info("Fetching Open Hand Atlanta shifts: %s to %s", today, end_date)
    resp = requests.get(
        CALENDAR_API,
        params={"start": today.isoformat(), "end": end_date.isoformat()},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    jobs = data.get("jobs", {})
    shifts = data.get("shifts", {})

    if not jobs or not shifts:
        logger.warning("Open Hand API returned empty jobs or shifts")
        return 0, 0, 0

    logger.info("Open Hand API: %d jobs, %d shifts", len(jobs), len(shifts))

    for shift_id, shift in shifts.items():
        job_id = str(shift["j"])
        job = jobs.get(job_id)
        if not job:
            logger.debug("Shift %s references unknown job %s, skipping", shift_id, job_id)
            continue

        job_name = job["name"].strip()
        job_desc = _clean_description(job.get("desc", ""))
        age_req = job.get("r", "")
        instances = shift.get("i", [])

        if not instances:
            continue

        # Build series hint — group all instances of same shift into one series
        # Include shift_id to differentiate same job at different time slots
        first_start = _format_time_label(instances[0][0])
        series_title = f"{job_name} · {first_start}"
        series_hint = {
            "series_type": "recurring_show",
            "series_title": series_title,
            "frequency": "daily" if len(instances) > 10 else "weekly",
        }

        for instance in instances:
            start_ts, end_ts, spots_remaining, _location = (
                instance[0], instance[1], instance[2], instance[3]
            )

            start_dt = datetime.fromtimestamp(start_ts)
            start_date_str = start_dt.strftime("%Y-%m-%d")
            start_time = _format_time(start_ts)
            end_time = _format_time(end_ts)
            time_label = _format_time_label(start_ts)

            # Title includes time slot to differentiate shifts
            title = f"{job_name} · {time_label}"

            events_found += 1
            content_hash = generate_content_hash(
                f"{job_name} {start_time}",
                "Open Hand Atlanta",
                start_date_str,
            )
            current_hashes.add(content_hash)

            # Build per-instance registration URL
            ticket_url = f"{SHIFT_JOIN_BASE}/{shift_id}/join?start_time={start_ts}&end_time={end_ts}"

            # Add spots info to description
            description = job_desc
            if age_req:
                description += f"\n\nAge requirement: {age_req}"
            if spots_remaining is not None and spots_remaining == 0:
                description += "\n\nThis shift is currently full — sign up for the waitlist."

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title[:200],
                "description": description,
                "start_date": start_date_str,
                "start_time": start_time,
                "end_date": None,
                "end_time": end_time,
                "is_all_day": False,
                "category": _determine_category(job_name, job_desc),
                "subcategory": None,
                "tags": _extract_tags(job_name, job_desc),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": f"https://donate.openhandatlanta.org/volunteer_calendar",
                "ticket_url": ticket_url,
                "image_url": None,
                "raw_text": f"{job_name} | {start_date_str} | {start_time}-{end_time} | spots: {spots_remaining}",
                "extraction_confidence": 0.95,
                "is_recurring": True,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1

    stale_deleted = remove_stale_source_events(source_id, current_hashes)
    if stale_deleted:
        logger.info("Removed %d stale Open Hand Atlanta events", stale_deleted)

    logger.info(
        "Open Hand Atlanta crawl complete: %d found, %d new, %d updated",
        events_found, events_new, events_updated,
    )
    return events_found, events_new, events_updated
