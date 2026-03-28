"""
Crawler for MudFire Clayworks & Gallery (mudfire.com).
Pottery studio in Decatur offering wheel-throwing, hand-building, and kids camps.

Data sources:
  1. Acuity Scheduling — public class bookings (one-time pottery classes, date nights)
     URL: https://app.acuityscheduling.com/schedule.php?owner=25826043&appointmentType=<id>
     Each appointment-type page renders upcoming sessions in a flat list.

  2. mudfire.com sitemap + camp-for-kids page — summer camp products.
     Camp product slugs embed the date range (e.g. "camp-july-13th-to-17th-ages-8-13").
     We parse the start date from the slug and read the price from the rendered page.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ─── Venue ────────────────────────────────────────────────────────────────────

PLACE_DATA = {
    "name": "MudFire Clayworks & Gallery",
    "slug": "mudfire-clayworks-gallery",
    "address": "175 Laredo Dr",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7714,
    "lng": -84.2969,
    "place_type": "studio",
    "spot_type": "studio",
    "website": "https://www.mudfire.com",
    "vibes": ["artsy", "all-ages", "family-friendly", "casual"],
}

# ─── Source URLs ──────────────────────────────────────────────────────────────

MUDFIRE_HOME = "https://www.mudfire.com"
ACUITY_OWNER = "25826043"

# Known Acuity appointment type IDs discovered from mudfire.com/date-nights
# The pages show upcoming class sessions in a flat list without auth.
# Class title, duration, price, description, and session dates/times are all present.
ACUITY_APPOINTMENT_TYPES = [
    {
        "id": "78472074",
        "name": "Beginner's Wheel / One-Time Classes",
        "category": "learning",
        "tags": [
            "class",
            "hands-on",
            "pottery",
            "wheel-throwing",
            "date-night",
            "all-ages",
        ],
        "age_group": "adult",
    },
    {
        "id": "87172352",
        "name": "Advanced Wheel Classes",
        "category": "learning",
        "tags": ["class", "hands-on", "pottery", "wheel-throwing", "adults"],
        "age_group": "adult",
    },
    {
        "id": "87172204",
        "name": "Hand-Building Classes",
        "category": "learning",
        "tags": [
            "class",
            "hands-on",
            "pottery",
            "hand-building",
            "date-night",
            "all-ages",
        ],
        "age_group": "adult",
    },
    {
        "id": "78471303",
        "name": "Specialty / Multi-Part Classes",
        "category": "learning",
        "tags": ["class", "hands-on", "pottery", "ceramics", "adults"],
        "age_group": "adult",
    },
]

CAMP_PAGE_URL = f"{MUDFIRE_HOME}/camp-for-kids"

# ─── Date parsing helpers ─────────────────────────────────────────────────────

MONTH_ABBREVS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def parse_acuity_date(text: str) -> Optional[str]:
    """Parse Acuity date strings like 'Friday, March 13th, 2026' or 'Friday, April 3rd, 2026'.

    Returns ISO 'YYYY-MM-DD' or None.
    """
    # "Weekday, Month Nth, YYYY" or "Weekday, Month Nth"
    m = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?",
        text,
        re.IGNORECASE,
    )
    if m:
        month_name = m.group(1).lower()
        day = int(m.group(2))
        year_str = m.group(3)
        year = int(year_str) if year_str else datetime.now().year
        month = MONTH_ABBREVS.get(month_name)
        if month:
            try:
                return datetime(year, month, day).strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None


def parse_acuity_time(text: str) -> Optional[str]:
    """Parse '6:00 PM' or '11:00 AM' → 'HH:MM'."""
    m = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", text, re.IGNORECASE)
    if m:
        hour = int(m.group(1))
        minute = m.group(2)
        period = m.group(3).upper()
        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_acuity_price(text: str) -> tuple[bool, Optional[float], Optional[float]]:
    """Parse '2 hours @ $65.00' → (is_free, price_min, price_max)."""
    m = re.search(r"\$(\d+(?:\.\d{2})?)", text)
    if m:
        price = float(m.group(1))
        return False, price, price
    return False, None, None


def parse_camp_date_from_slug(slug: str) -> Optional[str]:
    """Extract start date from a camp product slug.

    Examples:
      'camp-july-13th-to-17th-ages-8-13'  → '2026-07-13'
      'camp-june-1st-to-5th-ages-4-to-9'  → '2026-06-01'
      'camp-july-6th-to-10th-ages-4-to-9' → '2026-07-06'
    """
    # Pattern: camp-<month>-<day>(st|nd|rd|th)-to-...
    m = re.search(
        r"camp-([a-z]+)-(\d+)(?:st|nd|rd|th)?-to",
        slug.lower(),
    )
    if m:
        month_name = m.group(1)
        day = int(m.group(2))
        month = MONTH_ABBREVS.get(month_name)
        if month:
            year = datetime.now().year
            # If the month is in the past, bump to next year
            try:
                d = datetime(year, month, day)
                if d.date() < datetime.now().date():
                    d = datetime(year + 1, month, day)
                return d.strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None


def parse_camp_age_from_slug(slug: str) -> Optional[str]:
    """Extract age range string from camp slug.

    'camp-july-13th-to-17th-ages-8-13' → 'Ages 8-13'
    'camp-june-1st-to-5th-ages-4-to-9' → 'Ages 4-9'
    'camp-july-27th-to-31st-ages-12-up' → 'Ages 12+'
    """
    # Range pattern: ages-4-to-9 or ages-8-13
    m = re.search(r"ages?-(\d+)[-–](?:to-)?(\d+)", slug.lower())
    if m:
        return f"Ages {m.group(1)}-{m.group(2)}"
    # Open-ended "12 and up": ages-12-up or ages-12-plus
    m = re.search(r"ages?-(\d+)[-–]?(up|plus|\+)", slug.lower())
    if m:
        return f"Ages {m.group(1)}+"
    return None


def parse_camp_end_date(slug: str, start_date: str) -> Optional[str]:
    """Camps run Monday–Friday (5 days).

    Returns Friday of the same week as start_date.
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        # Monday = 0 in Python; if start is Monday, Friday is +4
        days_to_friday = 4 - start.weekday()
        if days_to_friday < 0:
            days_to_friday += 7
        from datetime import timedelta

        end = start + timedelta(days=days_to_friday)
        return end.strftime("%Y-%m-%d")
    except ValueError:
        return None


# ─── Playwright helpers ────────────────────────────────────────────────────────


def goto_with_retry(
    page: Page, url: str, *, attempts: int = 3, timeout_ms: int = 30000
) -> None:
    """Navigate with retry/back-off for transient failures."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            return
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt >= attempts:
                raise
            page.wait_for_timeout(1500 * attempt)
    if last_exc:
        raise last_exc


# ─── Acuity class crawling ─────────────────────────────────────────────────────


def _parse_acuity_sessions(
    lines: list[str],
    appt_type: dict,
    venue_id: int,
    source_id: int,
    booking_url: str,
) -> list[dict]:
    """Parse the flat text output from an Acuity appointment-type page.

    The page shows sessions as repeating blocks:
        <date line>        e.g. "Friday, March 13th, 2026"
        <time line>        e.g. "6:00 PM"
        <class name> with <booking label>  — sometimes present
        <duration @ price> e.g. "2 hours @ $65.00"
        <description>      multi-line description
        "BOOK"
        <availability>     e.g. "No spots left" | "2 spots left"

    The class name and description appear before the first date block (in the
    page header) and are reused for all sessions.  We capture them once.
    """
    events: list[dict] = []

    # ── 1. Extract the class name and description from the header lines ──────
    class_name: Optional[str] = None
    description_lines: list[str] = []
    duration_price: Optional[str] = None

    # Skip nav/boilerplate until we find the class name (follows "Select Class")
    # The class name is the first line that ends with the booking label pattern
    # "X with Book Now - Y" or just appears before "2 hours @ $XX.00"
    NAV_SKIP = {
        "SIGN UP",
        "LOGIN",
        "Select Class",
        "Quantity:",
        "TIME ZONE:",
        "EASTERN TIME (GMT-04:00)",
        "MORE TIMES",
    }
    boilerplate_done = False
    for i, line in enumerate(lines):
        # Skip everything up to "Select Class"
        if not boilerplate_done:
            if line == "Select Class":
                boilerplate_done = True
            continue

        if line in NAV_SKIP or re.match(r"^MudFire", line):
            continue

        # Duration/price line signals the end of the name/description header
        if re.match(r"\d+\s+hours?\s+@\s+\$", line, re.IGNORECASE):
            duration_price = line
            # Everything before this (after Select Class, after name) is description
            if class_name is None and description_lines:
                class_name = description_lines.pop(0)
            break

        if class_name is None and len(line) > 5:
            class_name = line
        elif class_name and len(line) > 10 and not re.match(r"^\d", line):
            description_lines.append(line)

    description = " ".join(description_lines).strip() if description_lines else None

    # Strip the " with Book Now - Pottery Date / Pottery Wheel Class" suffix from class_name
    if class_name:
        class_name = re.sub(
            r"\s+with\s+Book Now.*$", "", class_name, flags=re.IGNORECASE
        ).strip()

    if not class_name:
        class_name = appt_type.get("name", "Pottery Class")

    # ── 2. Parse price from duration_price ──────────────────────────────────
    is_free, price_min, price_max = parse_acuity_price(duration_price or "")

    # ── 3. Walk lines looking for date → time → BOOK blocks ─────────────────
    date_re = re.compile(
        r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+\d{1,2}",
        re.IGNORECASE,
    )
    time_re = re.compile(r"^\d{1,2}:\d{2}\s+[AP]M$", re.IGNORECASE)

    # After the header, sessions appear in repeating date blocks.
    i = 0
    while i < len(lines):
        line = lines[i]

        if date_re.match(line):
            # This is a date header for one or more time slots
            current_date = parse_acuity_date(line)
            i += 1

            # Skip relative labels like "NEXT WEEK", "IN 3 WEEKS"
            while i < len(lines) and re.match(
                r"^(NEXT WEEK|IN \d+ WEEKS?|TODAY)$", lines[i], re.IGNORECASE
            ):
                i += 1

            # Collect time slots under this date
            while i < len(lines) and not date_re.match(lines[i]):
                tline = lines[i]

                if time_re.match(tline) and current_date:
                    start_time = parse_acuity_time(tline)
                    i += 1

                    # Optionally a class name variant (with booking label)
                    if i < len(lines) and "with Book Now" in lines[i]:
                        # Extract any updated class name and price from this line
                        variant_name = re.sub(
                            r"\s+with\s+Book Now.*$", "", lines[i], flags=re.IGNORECASE
                        ).strip()
                        if variant_name and len(variant_name) > 3:
                            session_class_name = variant_name
                        else:
                            session_class_name = class_name
                        i += 1
                    else:
                        session_class_name = class_name

                    # Duration/price line (may differ per session for multi-part classes)
                    session_price_min, session_price_max = price_min, price_max
                    if i < len(lines) and re.match(
                        r"\d+\s+hours?", lines[i], re.IGNORECASE
                    ):
                        _, session_price_min, session_price_max = parse_acuity_price(
                            lines[i]
                        )
                        i += 1

                    # Description (if present for this session)
                    session_desc = description

                    # Skip "BOOK" marker and availability note
                    while i < len(lines) and lines[i] in ("BOOK", "MORE TIMES"):
                        i += 1
                    # Availability line: "No spots left" | "N spots left" — skip
                    if i < len(lines) and re.match(
                        r"^(\d+|No)\s+spots?\s+", lines[i], re.IGNORECASE
                    ):
                        i += 1

                    # Skip past dates
                    try:
                        if (
                            datetime.strptime(current_date, "%Y-%m-%d").date()
                            < datetime.now().date()
                        ):
                            continue
                    except ValueError:
                        continue

                    content_hash = generate_content_hash(
                        session_class_name or "Pottery Class",
                        "MudFire Clayworks & Gallery",
                        current_date,
                    )

                    events.append(
                        {
                            "source_id": source_id,
                            "place_id": venue_id,
                            "title": session_class_name or "Pottery Class at MudFire",
                            "description": session_desc,
                            "start_date": current_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": appt_type["category"],
                            "tags": list(appt_type["tags"]),
                            "price_min": session_price_min,
                            "price_max": session_price_max,
                            "price_note": "Per person. $10 deposit required at booking.",
                            "is_free": False,
                            "source_url": MUDFIRE_HOME + "/date-nights",
                            "ticket_url": booking_url,
                            "image_url": None,
                            "raw_text": f"{session_class_name} on {current_date}",
                            "extraction_confidence": 0.92,
                            "is_recurring": False,
                            "content_hash": content_hash,
                            "is_class": True,
                        }
                    )
                else:
                    i += 1

        else:
            i += 1

    return events


def crawl_acuity_classes(
    page: Page, venue_id: int, source_id: int
) -> tuple[int, int, int]:
    """Crawl one-time pottery classes from Acuity Scheduling."""
    found = 0
    new = 0
    updated = 0

    for appt_type in ACUITY_APPOINTMENT_TYPES:
        type_id = appt_type["id"]
        booking_url = (
            f"https://app.acuityscheduling.com/schedule.php"
            f"?owner={ACUITY_OWNER}&appointmentType={type_id}"
        )

        logger.info(f"Fetching Acuity type {type_id}: {appt_type['name']}")
        try:
            goto_with_retry(page, booking_url, attempts=2, timeout_ms=30000)
            page.wait_for_timeout(3000)
        except Exception as exc:
            logger.warning(f"Skipping Acuity type {type_id}: {exc}")
            continue

        body_text = page.inner_text("body")
        lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]

        sessions = _parse_acuity_sessions(
            lines, appt_type, venue_id, source_id, booking_url
        )

        for event_record in sessions:
            found += 1
            content_hash = event_record["content_hash"]
            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                updated += 1
            else:
                try:
                    insert_event(event_record)
                    new += 1
                    logger.info(
                        f"  Added class: {event_record['title']} on {event_record['start_date']}"
                    )
                except Exception as exc:
                    logger.error(f"  Failed to insert {event_record['title']}: {exc}")

        logger.info(f"  Type {type_id}: {len(sessions)} sessions found")

    return found, new, updated


# ─── Camp crawling ─────────────────────────────────────────────────────────────


def crawl_camps(page: Page, venue_id: int, source_id: int) -> tuple[int, int, int]:
    """Crawl summer camp products from mudfire.com/camp-for-kids."""
    found = 0
    new = 0
    updated = 0

    logger.info(f"Fetching camp page: {CAMP_PAGE_URL}")
    try:
        goto_with_retry(page, CAMP_PAGE_URL, attempts=2, timeout_ms=30000)
        page.wait_for_timeout(4000)
    except Exception as exc:
        logger.warning(f"Could not load camp page: {exc}")
        return 0, 0, 0

    # Collect product links (Square Online camp product URLs)
    links = page.query_selector_all("a[href*='/product/camp']")
    product_urls: list[str] = []
    seen_slugs: set[str] = set()
    for link in links:
        href = link.get_attribute("href") or ""
        if href and href not in seen_slugs:
            seen_slugs.add(href)
            # Normalise relative → absolute
            if not href.startswith("http"):
                href = MUDFIRE_HOME + href
            product_urls.append(href)

    # Also extract price from page text (all camp products are the same price)
    body_text = page.inner_text("body")
    price_m = re.search(r"\$(\d+(?:\.\d{2})?)", body_text)
    camp_price = float(price_m.group(1)) if price_m else 180.0

    logger.info(f"  Found {len(product_urls)} camp product URLs")

    # Derive camp description from camp page body text
    camp_desc_lines: list[str] = []
    lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]
    for line in lines:
        if len(line) > 40 and not re.match(r"^\$", line) and "Camp" not in line[:5]:
            if any(
                kw in line.lower()
                for kw in ["wheel", "hand build", "camp", "project", "monday", "9am"]
            ):
                camp_desc_lines.append(line)
        if len(camp_desc_lines) >= 2:
            break
    camp_description = (
        " ".join(camp_desc_lines)
        if camp_desc_lines
        else (
            "Weekly pottery summer camp at MudFire Clayworks & Gallery in Decatur. "
            "Monday through Friday, 9am–noon. Combines wheel work and hand-building. "
            "Campers complete 3–6 ceramic projects."
        )
    )

    for product_url in product_urls:
        # Extract slug from URL for date parsing
        # e.g. /product/camp-july-13th-to-17th-ages-8-13/W4N2PLY2FW4P7OCYH7HC5ENV
        slug_m = re.search(r"/product/([^/?#]+)", product_url)
        if not slug_m:
            continue
        slug = slug_m.group(1)

        start_date = parse_camp_date_from_slug(slug)
        if not start_date:
            logger.debug(f"  Could not parse date from slug: {slug}")
            continue

        # Skip past camps
        try:
            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                continue
        except ValueError:
            continue

        end_date = parse_camp_end_date(slug, start_date)
        age_range = parse_camp_age_from_slug(slug)

        # Build a readable title from the slug
        # "camp-july-13th-to-17th-ages-8-13" → "Summer Camp: July 13–17 (Ages 8-13)"
        month_m = re.search(
            r"camp-([a-z]+)-(\d+)(?:st|nd|rd|th)?-to-(\d+)", slug.lower()
        )
        if month_m:
            month_cap = month_m.group(1).capitalize()
            start_day = month_m.group(2)
            end_day = month_m.group(3)
            title_date = f"{month_cap} {start_day}–{end_day}"
        else:
            title_date = start_date

        age_suffix = f" ({age_range})" if age_range else ""
        title = f"Summer Camp at MudFire: {title_date}{age_suffix}"

        # Tags based on age group
        base_tags = [
            "kids",
            "family-friendly",
            "pottery",
            "ceramics",
            "class",
            "hands-on",
        ]
        if age_range:
            ages_m = re.search(r"(\d+)-(\d+)", age_range)
            if ages_m:
                min_age = int(ages_m.group(1))
                if min_age <= 5:
                    base_tags.append("preschool")
                elif min_age <= 9:
                    base_tags.append("elementary")
                elif min_age <= 13:
                    base_tags.extend(["elementary", "tween"])
                else:
                    base_tags.append("teen")

        # Clean up the URL (remove query string params)
        clean_url = re.sub(r"\?.*$", "", product_url)

        content_hash = generate_content_hash(
            title, "MudFire Clayworks & Gallery", start_date
        )

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": camp_description
            + (f" {age_range} welcome." if age_range else ""),
            "start_date": start_date,
            "start_time": "09:00",
            "end_date": end_date,
            "end_time": "12:00",
            "is_all_day": False,
            "category": "family",
            "tags": base_tags,
            "price_min": camp_price,
            "price_max": camp_price,
            "price_note": "Per camper for the full week.",
            "is_free": False,
            "source_url": clean_url,
            "ticket_url": clean_url,
            "image_url": None,
            "raw_text": f"{title} — {start_date}",
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "content_hash": content_hash,
            "is_class": True,
        }

        found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
        else:
            try:
                insert_event(event_record)
                new += 1
                logger.info(f"  Added camp: {title} ({start_date})")
            except Exception as exc:
                logger.error(f"  Failed to insert camp {title}: {exc}")

    return found, new, updated


# ─── Members-only class schedule (mf-classes page) ──────────────────────────

MF_CLASSES_URL = f"{MUDFIRE_HOME}/mf-classes"
# The /mf-classes page lists a text schedule of member-only Thursday classes.
# Format: "THURSDAY - MARCH 5TH - 7pm\n<class title>"
_MEMBER_DATE_RE = re.compile(
    r"THURSDAY\s*[-–]\s*(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST"
    r"|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2})(?:ST|ND|RD|TH)?(?:\s*[-–]\s*7[pP][mM])?",
    re.IGNORECASE,
)


def crawl_member_classes(
    page: Page, venue_id: int, source_id: int
) -> tuple[int, int, int]:
    """Crawl the Thursday members-only class schedule from /mf-classes."""
    found = 0
    new = 0
    updated = 0

    logger.info(f"Fetching member class schedule: {MF_CLASSES_URL}")
    try:
        goto_with_retry(page, MF_CLASSES_URL, attempts=2, timeout_ms=30000)
        page.wait_for_timeout(4000)
    except Exception as exc:
        logger.warning(f"Could not load mf-classes page: {exc}")
        return 0, 0, 0

    body_text = page.inner_text("body")
    lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]

    # Find "Upcoming Classes!" marker — everything before is nav
    start_idx = 0
    for i, line in enumerate(lines):
        if "upcoming classes" in line.lower():
            start_idx = i + 1
            break

    current_year = datetime.now().year
    i = start_idx
    while i < len(lines):
        line = lines[i]

        m = _MEMBER_DATE_RE.search(line)
        if m:
            month_name = m.group(1).lower()
            day = int(m.group(2))
            month = MONTH_ABBREVS.get(month_name)

            if month:
                try:
                    dt = datetime(current_year, month, day)
                    # If the date is in the past try next year
                    if dt.date() < datetime.now().date():
                        dt = datetime(current_year + 1, month, day)
                    start_date = dt.strftime("%Y-%m-%d")
                except ValueError:
                    i += 1
                    continue

                # The class title is the next non-empty, non-nav line
                class_title = None
                description = None
                j = i + 1
                while j < len(lines) and class_title is None:
                    candidate = lines[j]
                    # Skip relative time markers and nav
                    if len(candidate) > 10 and not _MEMBER_DATE_RE.search(candidate):
                        class_title = candidate
                        # Description is the line after
                        if j + 1 < len(lines) and len(lines[j + 1]) > 10:
                            description = lines[j + 1]
                    j += 1

                if class_title:
                    # Note: these are members-only classes — flag accordingly
                    title = f"MudFire Members Class: {class_title}"
                    tags = ["class", "pottery", "ceramics", "members-only", "hands-on"]

                    content_hash = generate_content_hash(
                        title, "MudFire Clayworks & Gallery", start_date
                    )
                    found += 1

                    # Skip past dates
                    try:
                        if (
                            datetime.strptime(start_date, "%Y-%m-%d").date()
                            < datetime.now().date()
                        ):
                            i += 1
                            continue
                    except ValueError:
                        i += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": description
                        or (
                            "Thursday evening members-only class at MudFire Clayworks & Gallery. "
                            "Open to current MudFire members only."
                        ),
                        "start_date": start_date,
                        "start_time": "19:00",
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "learning",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Members only. Included with MudFire membership.",
                        "is_free": True,
                        "source_url": MF_CLASSES_URL,
                        "ticket_url": MF_CLASSES_URL,
                        "image_url": None,
                        "raw_text": f"{title} — {start_date}",
                        "extraction_confidence": 0.85,
                        "is_recurring": True,
                        "content_hash": content_hash,
                        "is_class": True,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        updated += 1
                    else:
                        try:
                            insert_event(event_record)
                            new += 1
                            logger.info(f"  Added member class: {title} ({start_date})")
                        except Exception as exc:
                            logger.error(
                                f"  Failed to insert member class: {title}: {exc}"
                            )

        i += 1

    return found, new, updated


# ─── Main entry point ──────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MudFire Clayworks & Gallery: Acuity classes, summer camps, member classes."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            # Ensure venue record exists
            venue_id = get_or_create_place(PLACE_DATA)
            logger.info(f"MudFire venue ID: {venue_id}")

            # 1. One-time pottery classes via Acuity Scheduling
            af, an, au = crawl_acuity_classes(page, venue_id, source_id)
            total_found += af
            total_new += an
            total_updated += au
            logger.info(f"Acuity classes: {af} found, {an} new, {au} updated")

            # 2. Summer camps from mudfire.com/camp-for-kids
            cf, cn, cu = crawl_camps(page, venue_id, source_id)
            total_found += cf
            total_new += cn
            total_updated += cu
            logger.info(f"Summer camps: {cf} found, {cn} new, {cu} updated")

            # 3. Thursday members-only classes from /mf-classes
            mf, mn, mu = crawl_member_classes(page, venue_id, source_id)
            total_found += mf
            total_new += mn
            total_updated += mu
            logger.info(f"Member classes: {mf} found, {mn} new, {mu} updated")

            browser.close()

        logger.info(
            f"MudFire crawl complete: {total_found} found, "
            f"{total_new} new, {total_updated} updated"
        )

    except Exception as exc:
        logger.error(f"MudFire crawl failed: {exc}")
        raise

    return total_found, total_new, total_updated
