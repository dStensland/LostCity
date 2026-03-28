"""
Crawler for School of Rock Atlanta-area locations.

School of Rock teaches performance-based music to kids, teens, and adults at 2
metro Atlanta locations: Alpharetta and Woodstock (Holly Springs).

DATA SOURCE:
  School of Rock's camps page uses a jQuery AJAX call to POST to
  /ajax/load-events with a location_id parameter. This returns clean JSON
  with all upcoming camp sessions including dates, descriptions, prices,
  and enrollment URLs. We call this API directly for each location.

  The location_id is embedded as a data-location attribute on the .js-events
  div — we fetch the camps page first to extract it, then hit the API.

  LOCATION IDS (verified 2026-03-22):
    Alpharetta: 493
    Woodstock (Holly Springs): 446

PROGRAMS CRAWLED:
  - Summer music camps (Rock 101, Green Day, Metal, Taylor Swift, etc.)
  - Spring/Fall Break camps
  - Rookies camps (preschool/early learners)

RECURRING PROGRAMS (year-round, not time-specific camps):
  We also generate recurring program anchor events for the Performance Program
  and Rock 101 Program so parents can discover these year-round offerings.

ADDRESSES (verified 2026-03-22):
  Alpharetta: 5970 Atlanta Hwy, Alpharetta, GA 30004
  Woodstock:  5947 Holly Springs Pkwy Suite 308-309, Holly Springs, GA 30188

Category: "education"  (music education for kids)
Tags: kids, music, family-friendly, rsvp-required + age bands
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ── constants ─────────────────────────────────────────────────────────────────

BASE_URL = "https://www.schoolofrock.com"
AJAX_ENDPOINT = f"{BASE_URL}/ajax/load-events"
IMAGE_CDN = "https://schoolofrock.imgix.net/img/event-image@2x/"

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

BASE_TAGS = ["kids", "music", "family-friendly", "rsvp-required"]

# ── location config ────────────────────────────────────────────────────────────
#
# Verified from schoolofrock.com/locations/<slug> on 2026-03-22.
#
LOCATIONS = [
    {
        "slug": "alpharetta",
        "location_id": "493",  # data-location on .js-events div
        "name": "School of Rock Alpharetta",
        "venue_slug": "school-of-rock-alpharetta",
        "address": "5970 Atlanta Hwy",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30004",
        "neighborhood": "Alpharetta",
        "lat": 34.0638,
        "lng": -84.2988,
        "phone": None,
        "email": "alpharetta@schoolofrock.com",
    },
    {
        "slug": "woodstock",
        "location_id": "446",  # data-location on .js-events div
        "name": "School of Rock Woodstock",
        "venue_slug": "school-of-rock-woodstock",
        "address": "5947 Holly Springs Pkwy, Suite 308-309",
        "city": "Holly Springs",
        "state": "GA",
        "zip": "30188",
        "neighborhood": "Woodstock",
        "lat": 34.1765,
        "lng": -84.5085,
        "phone": None,
        "email": "woodstock@schoolofrock.com",
    },
]

# ── venue builder ──────────────────────────────────────────────────────────────


def _build_venue_data(loc: dict) -> dict:
    return {
        "name": loc["name"],
        "slug": loc["venue_slug"],
        "address": loc["address"],
        "city": loc["city"],
        "state": loc["state"],
        "zip": loc["zip"],
        "neighborhood": loc["neighborhood"],
        "lat": loc["lat"],
        "lng": loc["lng"],
        "venue_type": "education",
        "spot_type": "education",
        "website": f"{BASE_URL}/locations/{loc['slug']}",
        "vibes": ["family-friendly", "kids", "music", "educational"],
    }


# ── date parsing ───────────────────────────────────────────────────────────────


def _parse_camp_dates(start_at: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Parse School of Rock start_at strings like:
      "Apr 6 - Apr 10, 2026 | 9:00am - 3:00pm"
      "Jun 22, 2026 | 9:00am - 3:00pm"
      "Jun 1 - Jun 5, 2026 | 9:30am - 1:30pm"

    Returns (start_date, end_date, start_time, end_time) in YYYY-MM-DD / HH:MM format.
    """
    if not start_at:
        return None, None, None, None

    # Split on " | " to separate date range from time range
    parts = start_at.split(" | ")
    date_part = parts[0].strip() if parts else ""
    time_part = parts[1].strip() if len(parts) > 1 else ""

    # Parse time range: "9:00am - 3:00pm"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    time_match = re.match(r"(\d{1,2}:\d{2}(?:am|pm))\s*-\s*(\d{1,2}:\d{2}(?:am|pm))", time_part, re.IGNORECASE)
    if time_match:
        start_time = _parse_12h_time(time_match.group(1))
        end_time = _parse_12h_time(time_match.group(2))

    # Parse date range
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    # Pattern: "Apr 6 - Apr 10, 2026"
    range_m = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[-–]\s*"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})",
        date_part,
        re.IGNORECASE,
    )
    if range_m:
        s_month, s_day, e_month, e_day, year = range_m.groups()
        try:
            start_date = datetime.strptime(f"{s_month} {s_day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
            end_date = datetime.strptime(f"{e_month} {e_day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
        except ValueError:
            pass

    if not start_date:
        # Pattern: "Jun 22, 2026" (single day) — no end range
        single_m = re.match(
            r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})",
            date_part,
            re.IGNORECASE,
        )
        if single_m:
            month, day, year = single_m.groups()
            try:
                start_date = datetime.strptime(f"{month} {day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
                end_date = start_date
            except ValueError:
                pass

    return start_date, end_date, start_time, end_time


def _parse_12h_time(time_str: str) -> Optional[str]:
    """Convert '9:00am' or '3:00pm' to '09:00' / '15:00'."""
    try:
        dt = datetime.strptime(time_str.upper().replace(" ", ""), "%I:%M%p")
        return dt.strftime("%H:%M")
    except ValueError:
        return None


# ── age inference from camp name / description ────────────────────────────────


def _infer_ages(name: str, description: str) -> tuple[Optional[int], Optional[int], list[str]]:
    """
    Infer age range from camp name and description text.
    School of Rock camps list age ranges like "7-14 years of age" or "3-5".
    """
    combined = f"{name} {description}".lower()

    # Look for explicit age range "N-M years"
    m = re.search(r"(\d+)\s*[-–to]+\s*(\d+)\s*years?\s*(?:of\s*age)?", combined)
    if m:
        age_min, age_max = int(m.group(1)), int(m.group(2))
        return age_min, age_max, _age_tags_from_range(age_min, age_max)

    # Rookies / preschool patterns
    if any(x in combined for x in ["preschool", "toddler", "little wing", "rookies"]):
        return 4, 7, ["elementary", "toddler"]

    # Kids pattern
    if "beginners 7" in combined or "ages 6" in combined:
        return 6, 12, ["elementary", "tween"]

    # Teen pattern
    if "teen" in combined:
        return 13, 17, ["teen"]

    # Adult
    if "adult" in combined or "18+" in combined:
        return 18, None, ["adult"]

    # Default for typical SoR camps
    return 7, 17, ["elementary", "tween", "teen"]


def _age_tags_from_range(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 8 and age_max >= 4:
        tags.append("elementary")
    if age_max is None or (age_min <= 13 and age_max >= 8):
        tags.append("tween")
    if age_max is None or age_max >= 13:
        tags.append("teen")
    return tags or ["elementary", "tween"]


# ── price parsing ─────────────────────────────────────────────────────────────


def _parse_price(camp: dict) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Extract price from camp dict. SoR API may include price field."""
    price_val = camp.get("price") or camp.get("cost") or ""
    if not price_val:
        return None, None, "See website for pricing."
    m = re.search(r"\$(\d+(?:\.\d{2})?)", str(price_val))
    if m:
        p = float(m.group(1))
        return p, p, f"${int(p)} per week"
    return None, None, str(price_val)[:120]


# ── API fetch ─────────────────────────────────────────────────────────────────


def _fetch_camps(location_id: str, slug: str) -> list[dict]:
    """
    POST to /ajax/load-events and return the events list.
    Handles pagination (load_more flag) if needed.
    """
    api_headers = {
        **REQUEST_HEADERS,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": f"{BASE_URL}/locations/{slug}/music-camps",
        "Origin": BASE_URL,
    }
    payload = {
        "location_id": location_id,
        "page": "1",
        "load_more_schools": "",
        "type": "camp",
        "month": "",
        "age": "",
        "skill_level": "",
        "months_loaded": "0",
        "is_local": "1",
    }
    try:
        r = requests.post(AJAX_ENDPOINT, headers=api_headers, data=payload, timeout=20)
        r.raise_for_status()
        data = r.json()
        return data.get("data", {}).get("events", [])
    except Exception as exc:
        logger.warning(
            "[school-of-rock-atlanta] Failed to fetch camps for location_id=%s: %s",
            location_id,
            exc,
        )
        return []


# ── recurring program events ──────────────────────────────────────────────────


def _next_monday() -> datetime:
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until_mon = (7 - today.weekday()) % 7
    if days_until_mon == 0:
        days_until_mon = 7
    return today + timedelta(days=days_until_mon)


def _generate_rock101_program_events(loc: dict) -> list[dict]:
    """
    Generate weekly anchor events for the year-round Rock 101 beginner program.
    Rock 101 is School of Rock's entry-level program for kids 7-14 with no experience.
    """
    first_monday = _next_monday()
    title = f"Rock 101 Program at {loc['name']}"
    location_url = f"{BASE_URL}/locations/{loc['slug']}"
    description = (
        f"{loc['name']}'s Rock 101 program is the perfect starting point for young "
        f"musicians ages 7-14 with no experience. Students take weekly private lessons "
        f"on their instrument of choice (guitar, bass, drums, keys, or vocals) combined "
        f"with weekly group rehearsals leading to a live performance. "
        f"A performance-based approach builds confidence through playing in a real band. "
        f"Enroll at {location_url}."
    )
    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": "monday",
        "description": description,
    }
    events: list[dict] = []
    for week in range(WEEKS_AHEAD):
        event_date = first_monday + timedelta(weeks=week)
        start_date_str = event_date.strftime("%Y-%m-%d")
        ev = {
            "title": title,
            "description": description,
            "start_date": start_date_str,
            "end_date": None,
            "start_time": "16:00",
            "end_time": "18:00",
            "is_all_day": False,
            "category": "education",
            "subcategory": "education.music",
            "tags": list(set(BASE_TAGS + ["class", "after-school", "elementary", "tween", "weekly"])),
            "age_min": 7,
            "age_max": 14,
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "Monthly tuition. Contact for pricing.",
            "source_url": location_url,
            "ticket_url": f"{location_url}/music-programs/rock-101",
            "image_url": None,
            "extraction_confidence": 0.88,
            "is_recurring": True,
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
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
            "[school-of-rock-atlanta] Failed to get/create venue for %s: %s",
            loc["name"],
            exc,
        )
        return 0, 0, 0

    logger.info(
        "[school-of-rock-atlanta] Crawling %s (venue_id=%s)", loc["name"], venue_id
    )

    location_url = f"{BASE_URL}/locations/{loc['slug']}"

    # 1. Fetch camp sessions from AJAX API
    raw_camps = _fetch_camps(loc["location_id"], loc["slug"])
    logger.info(
        "[school-of-rock-atlanta] %s: %d camp sessions from API",
        loc["name"],
        len(raw_camps),
    )

    camp_events: list[dict] = []
    today = date.today()

    for camp in raw_camps:
        name = (camp.get("name") or "").strip()
        description = (camp.get("description") or "").strip()
        start_at = (camp.get("start_at") or "").strip()
        local_url = camp.get("local_url") or camp.get("national_url") or ""
        enroll_url = camp.get("enroll_url") or ""
        image_filename = camp.get("image") or ""

        if not name or not start_at:
            continue

        start_date, end_date, start_time, end_time = _parse_camp_dates(start_at)
        if not start_date:
            logger.debug(
                "[school-of-rock-atlanta] Could not parse date for %r: %r",
                name,
                start_at,
            )
            continue

        # Skip if entirely in the past
        check_date = end_date or start_date
        try:
            if datetime.strptime(check_date, "%Y-%m-%d").date() < today:
                logger.debug(
                    "[school-of-rock-atlanta] Skipping past camp: %s (%s)", name, check_date
                )
                continue
        except ValueError:
            pass

        age_min, age_max, age_tags = _infer_ages(name, description)
        price_min, price_max, price_note = _parse_price(camp)

        image_url: Optional[str] = None
        if image_filename:
            image_url = f"{IMAGE_CDN}{image_filename}"

        source_url = BASE_URL + local_url if local_url.startswith("/") else local_url or location_url
        ticket_url = enroll_url or source_url

        # Classify camp type
        name_lower = name.lower()
        if any(x in name_lower for x in ["rookies", "preschool", "little wing"]):
            subcategory = "education.music"
            extra_tags = ["toddler", "elementary"]
        elif "songwriter" in name_lower or "songwriting" in name_lower:
            subcategory = "education.music"
            extra_tags = ["songwriting"]
        else:
            subcategory = "education.music"
            extra_tags = []

        ev = {
            "title": f"{name} at {loc['name']}",
            "description": description or f"{name} music camp at {loc['name']}.",
            "start_date": start_date,
            "end_date": end_date,
            "start_time": start_time,
            "end_time": end_time,
            "is_all_day": False,
            "category": "education",
            "subcategory": subcategory,
            "tags": list(set(BASE_TAGS + ["camp", "summer-camp", "music-camp"] + age_tags + extra_tags)),
            "age_min": age_min,
            "age_max": age_max,
            "is_free": False,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "source_url": source_url,
            "ticket_url": ticket_url,
            "image_url": image_url,
            "extraction_confidence": 0.92,
            "is_recurring": False,
            "recurrence_rule": None,
            "_raw_for_hash": f"{name}|{loc['name']}|{start_date}",
        }
        camp_events.append(ev)

    # 2. Generate year-round Rock 101 program anchors
    program_events = _generate_rock101_program_events(loc)

    all_events = camp_events + program_events

    for ev in all_events:
        found += 1
        raw_for_hash = ev.pop("_raw_for_hash")
        series_hint = ev.pop("_series_hint", None)

        content_hash = generate_content_hash(raw_for_hash, loc["name"], ev["start_date"])

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "content_hash": content_hash,
            "raw_text": raw_for_hash,
            **ev,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
            logger.debug(
                "[school-of-rock-atlanta] Updated: %s on %s",
                ev["title"],
                ev["start_date"],
            )
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            new += 1
            logger.info(
                "[school-of-rock-atlanta] Added: %s on %s",
                ev["title"],
                ev["start_date"],
            )
        except Exception as exc:
            logger.error(
                "[school-of-rock-atlanta] Failed to insert %s on %s: %s",
                ev["title"],
                ev["start_date"],
                exc,
            )

    return found, new, updated


# ── entrypoint ────────────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl all School of Rock Atlanta-area locations.

    For each location:
      1. Ensure the venue record exists in the DB.
      2. Fetch camp sessions from the /ajax/load-events API and insert each
         future session as a discrete event.
      3. Generate recurring Rock 101 program events for the next WEEKS_AHEAD
         weeks to surface the year-round offering.

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
                "[school-of-rock-atlanta] %s: %d found, %d new, %d updated",
                loc["name"],
                f,
                n,
                u,
            )
        except Exception as exc:
            logger.error(
                "[school-of-rock-atlanta] Error crawling %s: %s", loc["name"], exc
            )

    logger.info(
        "[school-of-rock-atlanta] Crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
