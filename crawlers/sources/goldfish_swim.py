"""
Crawler for Goldfish Swim School Atlanta metro locations.

Goldfish Swim School is a major swim school chain with 4 Atlanta-area locations:
  - Decatur (gssdecatur)
  - Sandy Springs (gsssandysprings)
  - Johns Creek (gssjohnscreek)
  - Roswell Village (gssroswellvillage)

SCHEDULING PLATFORM: iClassPro (app.iclasspro.com/api/open/v1/)
The open API (no auth required) exposes:
  - /sessions   → Jump Start Clinic sessions (specific date-range events)
  - /classes    → Perpetual swim lesson slots (ongoing programs, not discrete events)
  - /locations  → Venue address and contact info

CRAWL STRATEGY:
  1. Jump Start Clinics — These are the true time-limited events: week-long intensive
     swim clinics held during school breaks (spring, summer, etc.). One event is created
     per session per location. These map to the "programs" category.

  2. Swim Lessons Program — Year-round perpetual lessons are NOT crawled as individual
     events (315+ slots per location would flood the feed). Instead we create ONE
     recurring program event per location that describes the year-round enrollment
     offering and links to the iClassPro enrollment portal.

  3. Family Swim — Not available via API; no date data to surface.

Category: "programs" (structured programs: camps, enrichment, classes)
Tags: swimming, kids, family-friendly, lessons, class
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import requests

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# iClassPro open API base
ICLASSPRO_API = "https://app.iclasspro.com/api/open/v1"

# How many weeks ahead to generate recurring swim lesson program events
WEEKS_AHEAD = 8

# Atlanta-area Goldfish Swim School locations
LOCATIONS = [
    {
        "org_code": "gssdecatur",
        "name": "Goldfish Swim School - Decatur",
        "slug": "goldfish-swim-school-decatur",
        "address": "2846 Lavista Rd #4",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "neighborhood": "Decatur",
        "lat": 33.8057,
        "lng": -84.2716,
        "phone": "(470) 536-8814",
        "website": "https://goldfishswimschool.com/decatur/",
        "portal_url": "https://portal.iclasspro.com/gssdecatur/classes",
        "events_url": "https://goldfishswimschool.com/decatur/events/",
    },
    {
        "org_code": "gsssandysprings",
        "name": "Goldfish Swim School - Sandy Springs",
        "slug": "goldfish-swim-school-sandy-springs",
        "address": "6335 Roswell Road",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "neighborhood": "Sandy Springs",
        "lat": 33.9315,
        "lng": -84.3724,
        "phone": "(770) 766-0237",
        "website": "https://goldfishswimschool.com/sandy-springs/",
        "portal_url": "https://portal.iclasspro.com/gsssandysprings/classes",
        "events_url": "https://goldfishswimschool.com/sandy-springs/events/",
    },
    {
        "org_code": "gssjohnscreek",
        "name": "Goldfish Swim School - Johns Creek",
        "slug": "goldfish-swim-school-johns-creek",
        "address": "6000 Medlock Bridge Rd",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30022",
        "neighborhood": "Johns Creek",
        "lat": 34.0290,
        "lng": -84.1985,
        "phone": "(770) 637-0707",
        "website": "https://goldfishswimschool.com/johns-creek/",
        "portal_url": "https://portal.iclasspro.com/gssjohnscreek/classes",
        "events_url": "https://goldfishswimschool.com/johns-creek/events/",
    },
    {
        "org_code": "gssroswellvillage",
        "name": "Goldfish Swim School - Roswell Village",
        "slug": "goldfish-swim-school-roswell-village",
        "address": "633 Holcomb Bridge Rd",
        "city": "Roswell",
        "state": "GA",
        "zip": "30076",
        "neighborhood": "Roswell",
        "lat": 34.0232,
        "lng": -84.3523,
        "phone": "(770) 691-1776",
        "website": "https://goldfishswimschool.com/roswell-village/",
        "portal_url": "https://portal.iclasspro.com/gssroswellvillage/classes",
        "events_url": "https://goldfishswimschool.com/roswell-village/events/",
    },
]

# Age band tag mapping: (min_age_months_total, max_age_months_total) -> tags
# Goldfish levels by age: Mini (4mo–3yr), Junior (3–4yr), Glider (4–12yr), Pro (4–12yr)
AGE_TAGS_BY_LEVEL = {
    "mini": ["infant", "toddler", "family-friendly"],
    "junior": ["toddler", "preschool", "family-friendly"],
    "glider": ["preschool", "elementary", "family-friendly"],
    "pro": ["elementary", "family-friendly"],
    "swim force": ["elementary", "tween", "family-friendly"],
    "private": ["family-friendly"],
    "semi-private": ["family-friendly"],
}

BASE_TAGS = [
    "water-sports",
    "kids",
    "family-friendly",
    "class",
    "rsvp-required",
]


def _build_venue_data(loc: dict) -> dict:
    """Build venue data dict from location config."""
    return {
        "name": loc["name"],
        "slug": loc["slug"],
        "address": loc["address"],
        "city": loc["city"],
        "state": loc["state"],
        "zip": loc["zip"],
        "neighborhood": loc["neighborhood"],
        "lat": loc["lat"],
        "lng": loc["lng"],
        "place_type": "fitness_center",
        "spot_type": "fitness",
        "website": loc["website"],
        "vibes": ["family-friendly", "all-ages"],
    }


def _fetch_sessions(org_code: str) -> list[dict]:
    """Fetch upcoming Jump Start Clinic sessions from iClassPro API."""
    url = f"{ICLASSPRO_API}/{org_code}/sessions"
    try:
        resp = requests.get(
            url,
            headers={"Accept": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])
    except Exception as exc:
        logger.warning(
            f"[goldfish-swim] Failed to fetch sessions for {org_code}: {exc}"
        )
        return []


def _parse_session_end_date(session_name: str, start_date: str) -> Optional[str]:
    """
    Parse the end date from session name like 'JSC 04/06/26 - 04/10/26'
    or 'JSC (4/7/26 - 4/10/26)'.
    Falls back to start_date + 4 days (a typical 5-day Mon-Fri clinic).
    """
    import re

    # Match date range patterns like "04/06/26 - 04/10/26" or "4/7/26 - 4/10/26"
    match = re.search(
        r"(\d{1,2})/(\d{1,2})/(\d{2,4})\s*[-–]\s*(\d{1,2})/(\d{1,2})/(\d{2,4})",
        session_name,
    )
    if match:
        end_month, end_day, end_year = match.group(4), match.group(5), match.group(6)
        # Handle 2-digit year
        if len(end_year) == 2:
            end_year = "20" + end_year
        try:
            end_dt = datetime.strptime(f"{end_month}/{end_day}/{end_year}", "%m/%d/%Y")
            return end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Fallback: start + 4 days (Mon to Fri)
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        return (start_dt + timedelta(days=4)).strftime("%Y-%m-%d")
    except ValueError:
        return None


def _crawl_jump_start_clinics(
    loc: dict, venue_id: int, source_id: int
) -> tuple[int, int, int]:
    """Crawl Jump Start Clinic sessions for a location."""
    events_found = 0
    events_new = 0
    events_updated = 0

    sessions = _fetch_sessions(loc["org_code"])
    if not sessions:
        logger.info(
            f"[goldfish-swim] No Jump Start Clinic sessions found for {loc['name']}"
        )
        return 0, 0, 0

    today = datetime.now().date()

    for session in sessions:
        session_name = session.get("name", "")
        start_date_str = session.get("startDate", "")

        if not start_date_str:
            continue

        # Skip sessions in the past
        try:
            start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            logger.debug(f"[goldfish-swim] Could not parse date: {start_date_str!r}")
            continue

        if start_dt < today:
            continue

        end_date_str = _parse_session_end_date(session_name, start_date_str)

        # Build a clean title
        location_short = loc["city"]
        title = f"Jump Start Swim Clinic at Goldfish Swim School ({location_short})"

        description = (
            f"Goldfish Swim School {location_short} is offering an intensive Jump Start Clinic "
            f"— four or five consecutive days of 30-minute swim lessons for kids ages 4 months "
            f"to 12 years. Perfect for spring break, school breaks, or getting ready for summer. "
            f"Lessons focus on water safety, stroke development, and confidence. "
            f"Multiple levels available from Mini (baby/toddler) through Pro (advanced). "
            f"Register at {loc['portal_url']}."
        )

        events_found += 1
        event_record = _build_jump_start_event_record(
            loc,
            venue_id,
            source_id,
            session_name,
            start_date_str,
            end_date_str,
        )

        existing = find_event_by_hash(event_record["content_hash"])
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            logger.debug(f"[goldfish-swim] Updated: {title} on {start_date_str}")
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"[goldfish-swim] Added JSC: {title} starting {start_date_str}")
        except Exception as exc:
            logger.error(f"[goldfish-swim] Failed to insert {title}: {exc}")

    return events_found, events_new, events_updated


def _crawl_swim_lessons_program(
    loc: dict, venue_id: int, source_id: int
) -> tuple[int, int, int]:
    """
    Create a single recurring program event representing year-round swim lessons.

    Rather than creating 315+ individual class slot events (which would flood the feed
    with noise), we create ONE recurring "program available" event per week pointing
    to the enrollment portal. This surfaces the offering on the Discover feed without
    duplicating every class time slot.

    We generate events for the next WEEKS_AHEAD Sundays (enrollment typically happens
    on weekends or open pool days), which gives us presence in the feed.
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    # Find next Saturday (day 5 in Python's weekday())
    days_until_sat = (5 - today.weekday()) % 7
    if days_until_sat == 0:
        days_until_sat = 7  # Don't use today even if it's Saturday
    first_saturday = today + timedelta(days=days_until_sat)

    location_short = loc["city"]
    title = f"Swim Lessons for Kids at Goldfish Swim School ({location_short})"
    description = (
        f"Goldfish Swim School {location_short} offers year-round indoor swim lessons "
        f"for kids ages 4 months to 12 years. The heated 90° pool and low 4:1 "
        f"student-to-teacher ratio make it ideal for beginners through advanced swimmers. "
        f"Levels include Mini (baby/toddler), Junior (3–4 years), Glider and Pro "
        f"(4–12 years), and competitive Swim Force. Flexible scheduling with "
        f"perpetual enrollment. Family Swim open swim sessions also available. "
        f"Enroll at {loc['portal_url']}."
    )

    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": "saturday",
        "description": description,
    }

    for week in range(WEEKS_AHEAD):
        event_date = first_saturday + timedelta(weeks=week)
        start_date_str = event_date.strftime("%Y-%m-%d")
        events_found += 1

        event_record = _build_swim_lessons_event_record(
            loc,
            venue_id,
            source_id,
            start_date_str,
        )

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.debug(
                f"[goldfish-swim] Added swim lessons event for {location_short} on {start_date_str}"
            )
        except Exception as exc:
            logger.error(
                f"[goldfish-swim] Failed to insert swim lessons for {location_short} "
                f"on {start_date_str}: {exc}"
            )

    return events_found, events_new, events_updated


def _build_jump_start_event_record(
    loc: dict,
    venue_id: int,
    source_id: int,
    session_name: str,
    start_date_str: str,
    end_date_str: Optional[str],
) -> dict:
    location_short = loc["city"]
    title = f"Jump Start Swim Clinic at Goldfish Swim School ({location_short})"
    description = (
        f"Goldfish Swim School {location_short} is offering an intensive Jump Start Clinic "
        f"— four or five consecutive days of 30-minute swim lessons for kids ages 4 months "
        f"to 12 years. Perfect for spring break, school breaks, or getting ready for summer. "
        f"Lessons focus on water safety, stroke development, and confidence. "
        f"Multiple levels available from Mini (baby/toddler) through Pro (advanced). "
        f"Register at {loc['portal_url']}."
    )
    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date_str,
        "start_time": "09:00",
        "end_date": end_date_str,
        "end_time": None,
        "is_all_day": False,
        "category": "fitness",
        "subcategory": "fitness.swim",
        "tags": BASE_TAGS + ["drop-in", "seasonal", "morning"],
        "is_free": False,
        "price_min": None,
        "price_max": None,
        "price_note": "Registration required. Prices vary by level.",
        "source_url": loc["events_url"],
        "ticket_url": loc["portal_url"],
        "image_url": None,
        "raw_text": f"{title} - {session_name}",
        "extraction_confidence": 0.92,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(title, loc["name"], start_date_str),
        "is_class": True,
        "class_category": "fitness",
    }


def _build_swim_lessons_event_record(
    loc: dict,
    venue_id: int,
    source_id: int,
    start_date_str: str,
) -> dict:
    location_short = loc["city"]
    title = f"Swim Lessons for Kids at Goldfish Swim School ({location_short})"
    description = (
        f"Goldfish Swim School {location_short} offers year-round indoor swim lessons "
        f"for kids ages 4 months to 12 years. The heated 90° pool and low 4:1 "
        f"student-to-teacher ratio make it ideal for beginners through advanced swimmers. "
        f"Levels include Mini (baby/toddler), Junior (3–4 years), Glider and Pro "
        f"(4–12 years), and competitive Swim Force. Flexible scheduling with "
        f"perpetual enrollment. Family Swim open swim sessions also available. "
        f"Enroll at {loc['portal_url']}."
    )
    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date_str,
        "start_time": "09:00",
        "end_date": None,
        "end_time": "12:00",
        "is_all_day": False,
        "category": "fitness",
        "subcategory": "fitness.swim",
        "tags": BASE_TAGS
        + [
            "infant",
            "toddler",
            "preschool",
            "elementary",
            "weekly",
            "morning",
            "drop-in",
            "water-sports",
        ],
        "is_free": False,
        "price_min": 32.50,
        "price_max": None,
        "price_note": "Starting at $32.50/lesson. Packages available.",
        "source_url": loc["website"],
        "ticket_url": loc["portal_url"],
        "image_url": None,
        "raw_text": f"{title} - {start_date_str}",
        "extraction_confidence": 0.88,
        "is_recurring": True,
        "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
        "content_hash": generate_content_hash(title, loc["name"], start_date_str),
        "is_class": True,
        "class_category": "fitness",
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Goldfish Swim School Atlanta-area locations via iClassPro API.

    For each location:
      1. Ensure the venue record exists in the DB.
      2. Fetch and insert Jump Start Clinic sessions (time-limited intensive events).
      3. Generate recurring swim lesson program events for the next WEEKS_AHEAD weeks.
    """
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    for loc in LOCATIONS:
        place_data = _build_venue_data(loc)
        try:
            venue_id = get_or_create_place(place_data)
        except Exception as exc:
            logger.error(
                f"[goldfish-swim] Failed to get/create venue for {loc['name']}: {exc}"
            )
            continue

        logger.info(f"[goldfish-swim] Crawling {loc['name']} (venue_id={venue_id})")

        # 1. Jump Start Clinics
        try:
            f, n, u = _crawl_jump_start_clinics(loc, venue_id, source_id)
            total_found += f
            total_new += n
            total_updated += u
            logger.info(
                f"[goldfish-swim] {loc['name']} JSC: {f} found, {n} new, {u} updated"
            )
        except Exception as exc:
            logger.error(f"[goldfish-swim] Error crawling JSC for {loc['name']}: {exc}")

        # 2. Swim Lessons program (recurring)
        try:
            f, n, u = _crawl_swim_lessons_program(loc, venue_id, source_id)
            total_found += f
            total_new += n
            total_updated += u
        except Exception as exc:
            logger.error(
                f"[goldfish-swim] Error generating swim lessons for {loc['name']}: {exc}"
            )

    logger.info(
        f"[goldfish-swim] Crawl complete: {total_found} found, "
        f"{total_new} new, {total_updated} updated"
    )
    return total_found, total_new, total_updated
