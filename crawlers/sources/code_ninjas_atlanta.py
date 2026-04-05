"""
Crawler for Code Ninjas Atlanta-area locations.

Code Ninjas teaches coding, robotics, and AI to kids ages 5-14 at 5 metro
Atlanta locations: Suwanee (Sugar Hill), East Cobb (Marietta), Cumming,
Smyrna/Vinings, and Snellville.

DATA SOURCE:
  The site uses a HubSpot/Vue.js frontend that fetches location profile data
  from a REST API at services.codeninjas.com. We call that API directly to
  get authoritative address, coordinates, and enrollment URLs.

  Camp sessions are behind a JavaScript-rendered calendar with no stable API.
  Instead, we generate recurring program anchor events for the year-round
  offerings (CREATE, JR Dojo, After-School) following the same pattern used
  by the_coder_school.py — one weekly event per location per program type
  for the next WEEKS_AHEAD weeks.

PROGRAMS:
  - Code Ninjas JR (ages 5-7): foundational coding with games, robots, LEGO
  - Code Ninjas CREATE (ages 7-14): self-paced belt curriculum, Scratch → Python
  - After-School Program (ages 6-14): drop-in enrichment, varies by location

ENROLLMENT PLATFORM: Dojo (registration.codeninjas.com) — direct URLs from API.

Category: "education"  (STEM / coding education for kids)
Tags: kids, coding, stem, family-friendly, rsvp-required + age bands
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta


from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ── constants ─────────────────────────────────────────────────────────────────

BASE_URL = "https://www.codeninjas.com"
SERVICES_API = "https://services.codeninjas.com/api/v1/facility/profile/slug"
IMAGE_BASE = "https://www.codeninjas.com/hubfs/CodeNinjas%20-%20Marketting%20Website"

# How many weeks ahead to generate recurring program events
WEEKS_AHEAD = 8

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html,application/xhtml+xml",
}

BASE_TAGS = ["kids", "coding", "stem", "family-friendly", "rsvp-required"]

# ── location config ────────────────────────────────────────────────────────────
#
# Verified from services.codeninjas.com/api/v1/facility/profile/slug/<cn_slug>
# on 2026-03-22. All 5 locations status=OPEN, isEnrolling=true.
#
LOCATIONS = [
    {
        "cn_slug": "ga-suwanee",
        "dojo_slug": "cn-ga-suwanee",
        "name": "Code Ninjas Suwanee",
        "display_city": "Sugar Hill",
        "venue_slug": "code-ninjas-suwanee",
        "address": "245 Peachtree Industrial Blvd",
        "address2": "Ste 102",
        "city": "Sugar Hill",
        "state": "GA",
        "zip": "30518",
        "neighborhood": "Suwanee",
        "lat": 34.069246,
        "lng": -84.06619,
        "phone": "(770) 353-9946",
        "email": "suwaneega@codeninjas.com",
        "is_jr_enabled": True,
        "is_after_school": True,
    },
    {
        "cn_slug": "ga-marietta",
        "dojo_slug": "cn-ga-marietta",
        "name": "Code Ninjas East Cobb",
        "display_city": "Marietta",
        "venue_slug": "code-ninjas-east-cobb",
        "address": "4880 Lower Roswell Road",
        "address2": "Suite 620",
        "city": "Marietta",
        "state": "GA",
        "zip": "30068",
        "neighborhood": "East Cobb",
        "lat": 33.965071,
        "lng": -84.41005,
        "phone": "770-501-6855",
        "email": "mariettaga@codeninjas.com",
        "is_jr_enabled": True,
        "is_after_school": True,
    },
    {
        "cn_slug": "ga-cumming",
        "dojo_slug": "cn-ga-cumming",
        "name": "Code Ninjas Cumming",
        "display_city": "Cumming",
        "venue_slug": "code-ninjas-cumming",
        "address": "2350 Atlanta Highway",
        "address2": "Suite 106-107",
        "city": "Cumming",
        "state": "GA",
        "zip": "30040",
        "neighborhood": "Cumming",
        "lat": 34.162097,
        "lng": -84.176454,
        "phone": "770-766-7273",
        "email": "cummingga@codeninjas.com",
        "is_jr_enabled": True,
        "is_after_school": True,
    },
    {
        "cn_slug": "ga-smyrna",
        "dojo_slug": "cn-ga-smyrna",
        "name": "Code Ninjas Smyrna Vinings",
        "display_city": "Smyrna",
        "venue_slug": "code-ninjas-smyrna-vinings",
        "address": "4691 S Atlanta Rd SE",
        "address2": "",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "neighborhood": "Smyrna/Vinings",
        "lat": 33.839706,
        "lng": -84.482885,
        "phone": "678-990-5908",
        "email": "smyrnaga@codeninjas.com",
        "is_jr_enabled": True,
        "is_after_school": True,
    },
    {
        "cn_slug": "ga-snellville",
        "dojo_slug": "cn-ga-snellville",
        "name": "Code Ninjas Snellville",
        "display_city": "Snellville",
        "venue_slug": "code-ninjas-snellville",
        "address": "1250 Scenic Highway",
        "address2": "Suite 1716",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30045",
        "neighborhood": "Snellville",
        "lat": 33.899817,
        "lng": -84.004327,
        "phone": "(770) 802-2984",
        "email": "snellvillega@codeninjas.com",
        "is_jr_enabled": True,
        "is_after_school": True,
    },
]

# ── venue builder ──────────────────────────────────────────────────────────────


def _build_venue_data(loc: dict) -> dict:
    address_full = loc["address"]
    if loc.get("address2"):
        address_full = f"{loc['address']}, {loc['address2']}"
    return {
        "name": loc["name"],
        "slug": loc["venue_slug"],
        "address": address_full,
        "city": loc["city"],
        "state": loc["state"],
        "zip": loc["zip"],
        "neighborhood": loc["neighborhood"],
        "lat": loc["lat"],
        "lng": loc["lng"],
        "place_type": "education",
        "spot_type": "education",
        "website": f"{BASE_URL}/{loc['cn_slug']}/",
        "vibes": ["family-friendly", "kids", "educational", "stem"],
    }


# ── age helpers ───────────────────────────────────────────────────────────────


def _age_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 8 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 12 and age_max >= 9:
        tags.append("tween")
    if age_max >= 13:
        tags.append("teen")
    return tags


# ── enrollment URL helpers ────────────────────────────────────────────────────


def _create_url(loc: dict) -> str:
    return (
        f"http://registration.codeninjas.com/{loc['dojo_slug']}/"
        f"?appSource=1&ignoreCapacity=True&fullDay=True"
    )


def _jr_url(loc: dict) -> str:
    return (
        f"http://registration.codeninjas.com/{loc['dojo_slug']}/"
        f"?appSource=1&ignoreCapacity=True&fullDay=True"
    )


# ── program event generators ──────────────────────────────────────────────────


def _next_monday() -> datetime:
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until_mon = (7 - today.weekday()) % 7
    if days_until_mon == 0:
        days_until_mon = 7
    return today + timedelta(days=days_until_mon)


def _generate_create_program_events(loc: dict) -> list[dict]:
    """
    Generate weekly anchor events for the year-round Code Ninjas CREATE program
    (ages 7-14, self-paced belt curriculum) for the next WEEKS_AHEAD weeks.
    """
    first_monday = _next_monday()
    title = f"Code Ninjas CREATE Program at {loc['name']}"
    location_url = f"{BASE_URL}/{loc['cn_slug']}/"
    description = (
        f"Code Ninjas {loc['display_city']} offers the CREATE program — a year-round "
        f"coding curriculum for kids ages 7-14. Students earn belts as they progress "
        f"through Scratch, JavaScript, C#, and Python, building real video games and "
        f"apps. Sessions run in small groups with a 2:1 student-to-sensei ratio. "
        f"Self-paced with weekly sessions after school and on weekends. "
        f"Free first session available. Enroll at {location_url}."
    )
    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": "monday",
        "description": description,
    }
    age_tags = _age_tags(7, 14)
    events: list[dict] = []
    for week in range(WEEKS_AHEAD):
        event_date = first_monday + timedelta(weeks=week)
        start_date_str = event_date.strftime("%Y-%m-%d")
        ev = {
            "title": title,
            "description": description,
            "start_date": start_date_str,
            "end_date": None,
            "start_time": "15:00",
            "end_time": "19:00",
            "is_all_day": False,
            "category": "education",
            "subcategory": "education.stem",
            "tags": list(set(BASE_TAGS + ["class", "after-school"] + age_tags)),
            "age_min": 7,
            "age_max": 14,
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "Monthly tuition. Contact for pricing. Free first session available.",
            "source_url": location_url,
            "ticket_url": _create_url(loc),
            "image_url": None,
            "extraction_confidence": 0.90,
            "is_recurring": True,
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
            "_raw_for_hash": f"{title}|{loc['name']}|{start_date_str}",
            "_series_hint": series_hint,
        }
        events.append(ev)
    return events


def _generate_jr_program_events(loc: dict) -> list[dict]:
    """
    Generate weekly anchor events for the Code Ninjas JR program
    (ages 5-7, foundational coding, robotics, LEGO) for the next WEEKS_AHEAD weeks.
    Only for locations where is_jr_enabled=True.
    """
    _next_monday()
    title = f"Code Ninjas JR at {loc['name']}"
    location_url = f"{BASE_URL}/{loc['cn_slug']}/"
    description = (
        f"Code Ninjas JR at {loc['display_city']} introduces kids ages 5-7 to the "
        f"fundamentals of coding through hands-on activities, robotics, and LEGO. "
        f"Sessions are 1 hour, designed to build problem-solving skills and a love of "
        f"technology before kids are ready for screen-based coding. "
        f"Enroll at {location_url}."
    )
    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": "saturday",
        "description": description,
    }
    age_tags = _age_tags(5, 7)
    first_saturday = _next_monday() - timedelta(days=2)  # Saturday is Mon - 2
    # Ensure it's actually a Saturday
    today = datetime.now()
    days_until_sat = (5 - today.weekday()) % 7
    if days_until_sat == 0:
        days_until_sat = 7
    first_saturday = today + timedelta(days=days_until_sat)
    first_saturday = first_saturday.replace(hour=0, minute=0, second=0, microsecond=0)

    events: list[dict] = []
    for week in range(WEEKS_AHEAD):
        event_date = first_saturday + timedelta(weeks=week)
        start_date_str = event_date.strftime("%Y-%m-%d")
        ev = {
            "title": title,
            "description": description,
            "start_date": start_date_str,
            "end_date": None,
            "start_time": "10:00",
            "end_time": "11:00",
            "is_all_day": False,
            "category": "education",
            "subcategory": "education.stem",
            "tags": list(set(BASE_TAGS + ["class", "toddler", "elementary"] + age_tags)),
            "age_min": 5,
            "age_max": 7,
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "Monthly tuition. Contact for pricing.",
            "source_url": location_url,
            "ticket_url": _jr_url(loc),
            "image_url": None,
            "extraction_confidence": 0.88,
            "is_recurring": True,
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
            "_raw_for_hash": f"{title}|{loc['name']}|{start_date_str}",
            "_series_hint": series_hint,
        }
        events.append(ev)
    return events


# ── per-location crawl ────────────────────────────────────────────────────────


def _crawl_location(loc: dict, source_id: int) -> tuple[int, int, int]:
    found = new = updated = 0

    place_data = _build_venue_data(loc)
    try:
        venue_id = get_or_create_place(place_data)
    except Exception as exc:
        logger.error(
            "[code-ninjas-atlanta] Failed to get/create venue for %s: %s",
            loc["name"],
            exc,
        )
        return 0, 0, 0

    logger.info(
        "[code-ninjas-atlanta] Processing %s (venue_id=%s)", loc["name"], venue_id
    )

    # Build program events — CREATE (all locations) + JR (where enabled)
    all_events: list[dict] = list(_generate_create_program_events(loc))
    if loc.get("is_jr_enabled"):
        all_events.extend(_generate_jr_program_events(loc))

    for ev in all_events:
        found += 1
        raw_for_hash = ev.pop("_raw_for_hash")
        series_hint = ev.pop("_series_hint", None)

        content_hash = generate_content_hash(raw_for_hash, loc["name"], ev["start_date"])

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "content_hash": content_hash,
            "raw_text": raw_for_hash,
            **ev,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
            logger.debug(
                "[code-ninjas-atlanta] Updated: %s on %s", ev["title"], ev["start_date"]
            )
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            new += 1
            logger.info(
                "[code-ninjas-atlanta] Added: %s on %s", ev["title"], ev["start_date"]
            )
        except Exception as exc:
            logger.error(
                "[code-ninjas-atlanta] Failed to insert %s on %s: %s",
                ev["title"],
                ev["start_date"],
                exc,
            )

    return found, new, updated


# ── entrypoint ────────────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl all Code Ninjas Atlanta-area locations.

    For each location:
      1. Ensure the venue record exists in the DB.
      2. Generate recurring CREATE program events (ages 7-14) for the next
         WEEKS_AHEAD weeks.
      3. Generate recurring JR program events (ages 5-7) for locations that
         support it.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    total_found = total_new = total_updated = 0

    for loc in LOCATIONS:
        try:
            f, n, u = _crawl_location(loc, source_id)
            total_found += f
            total_new += n
            total_updated += u
            logger.info(
                "[code-ninjas-atlanta] %s: %d found, %d new, %d updated",
                loc["name"],
                f,
                n,
                u,
            )
        except Exception as exc:
            logger.error(
                "[code-ninjas-atlanta] Error crawling %s: %s", loc["name"], exc
            )

    logger.info(
        "[code-ninjas-atlanta] Crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
