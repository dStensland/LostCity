"""
Crawler for DeKalb History Center (dekalbhistory.org).

Data sources:
- Programs (events): WordPress REST API /wp-json/wp/v2/programs
  Filtered to program_category=17 (current-programs).
  Dates are NOT in the API payload — extracted from the detail page HTML
  where consecutive <p> tags hold the date and time.
- Exhibitions: WordPress REST API /wp-json/wp/v2/exhibits
  Filtered to class_list containing 'exhibit_category-current-exhibits'.
  Routed via build_exhibition_record() + TypedEntityEnvelope.

No Tribe Events plugin — static HTTP only, no Playwright needed.

Date formats seen on program detail pages:
  "May 20, 2026"        — full date with year
  "Thursday, March 26"  — weekday + month/day, no year (infer current or next year)
  "April 8"             — month/day only, no year
  "April 11, 2026"      — standard full date
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.dekalbhistory.org"
PROGRAMS_API = f"{BASE_URL}/wp-json/wp/v2/programs"
EXHIBITS_API = f"{BASE_URL}/wp-json/wp/v2/exhibits"

# program_category ID 17 = "Current Programs"
CURRENT_PROGRAMS_CAT_ID = 17

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

PLACE_DATA = {
    "name": "DeKalb History Center",
    "slug": "dekalb-history-center",
    "address": "101 E Court Square",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7748,
    "lng": -84.2963,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "vibes": ["history", "museum", "decatur", "educational"],
}

EVENT_TAGS = ["dekalb-history-center", "museum", "history", "decatur", "educational"]
EXHIBITION_TAGS = ["dekalb-history-center", "museum", "history", "decatur", "educational", "exhibition"]

_MONTH_MAP: dict[str, int] = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}


def _parse_date_text(text: str) -> Optional[str]:
    """
    Parse a date string from the program detail page into YYYY-MM-DD.

    Handles:
      "May 20, 2026"         -> "2026-05-20"
      "April 8"              -> current/next year inferred
      "Thursday, March 26"   -> day-of-week stripped, current/next year inferred
    """
    # Strip leading weekday names ("Thursday, ...")
    text = re.sub(r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*", "", text, flags=re.IGNORECASE)
    text = text.strip()

    # Try "Month DD, YYYY" or "Month DD YYYY"
    m = re.match(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        text, re.IGNORECASE,
    )
    if m:
        month = _MONTH_MAP.get(m.group(1).lower())
        if month:
            try:
                return datetime(int(m.group(3)), month, int(m.group(2))).strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Try "Month DD" — no year, infer from current date
    m2 = re.match(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})",
        text, re.IGNORECASE,
    )
    if m2:
        month = _MONTH_MAP.get(m2.group(1).lower())
        day = int(m2.group(2))
        if month:
            today = date.today()
            # Try this year first; if that date has already passed, use next year
            try:
                candidate = date(today.year, month, day)
                if candidate >= today:
                    return candidate.strftime("%Y-%m-%d")
                return date(today.year + 1, month, day).strftime("%Y-%m-%d")
            except ValueError:
                pass

    return None


def _parse_time_text(text: str) -> Optional[str]:
    """
    Parse a time string from a program detail page into HH:MM (24-hour).

    Handles:
      "6:00 PM"       -> "18:00"
      "12:00 PM"      -> "12:00"
      "6:30 PM"       -> "18:30"
      "10-12PM"       -> "10:00"   (start of range)
      "6:30 – 8:00 pm" -> "18:30"  (start of range)
      "6:00 PM EST"   -> "18:00"   (timezone suffix stripped)
    """
    # Normalise en-dash/em-dash to hyphen before matching
    text = text.replace("\u2013", "-").replace("\u2014", "-")

    # Capture: start_hour, optional start_minute, optional end_hour, optional meridiem
    # e.g. "10-12PM"  -> start=10, end=12, meridiem=PM
    # e.g. "6:30-8:00 pm" -> start=6:30, end=8:00, meridiem=pm
    m = re.match(
        r"(\d{1,2})(?::(\d{2}))?"
        r"(?:\s*-\s*(\d{1,2})(?::(\d{2}))?\s*)?"
        r"(AM|PM|am|pm)?",
        text.strip(),
    )
    if not m:
        return None

    hour = int(m.group(1))
    minute = int(m.group(2)) if m.group(2) else 0
    end_hour = int(m.group(3)) if m.group(3) else None
    meridiem = (m.group(5) or "").upper()

    # When meridiem is attached to a time range (e.g. "10-12PM"):
    # the meridiem applies to the end of the range. If start hour >= end hour
    # (with PM applied) or start hour is >= 10, the start is likely AM.
    if meridiem == "PM":
        if end_hour is not None and hour >= end_hour:
            # Start is in AM (e.g. 10-12PM: 10 AM to 12 PM)
            if hour == 12:
                hour = 0
        elif end_hour is None:
            # No range — PM applies directly to start
            if hour != 12:
                hour += 12
        # If start < end and PM is explicit: both are PM
        elif hour != 12:
            hour += 12
    elif meridiem == "AM":
        if hour == 12:
            hour = 0

    try:
        return datetime(2000, 1, 1, hour, minute).strftime("%H:%M")
    except ValueError:
        return None


_DATE_PATTERN = re.compile(
    r"^(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*)?"
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}",
    re.IGNORECASE,
)

_TIME_PATTERN = re.compile(
    r"^\d{1,2}(?::\d{2})?\s*(?:[-\u2013\u2014]\s*\d{1,2}(?::\d{2})?\s*)?(?:AM|PM|am|pm)",
    re.IGNORECASE,
)


def _fetch_program_detail(url: str, session: requests.Session) -> dict:
    """
    Fetch a program detail page and extract date, time, description, and price info.

    Returns a dict with keys: start_date, start_time, description, is_free, price_note.
    All values may be None if not found.
    """
    result: dict = {
        "start_date": None,
        "start_time": None,
        "description": None,
        "is_free": None,
        "price_note": None,
    }
    try:
        resp = session.get(url, headers=_HEADERS, timeout=20)
        if resp.status_code != 200:
            logger.debug("DeKalb History Center: detail page %s returned %s", url, resp.status_code)
            return result

        soup = BeautifulSoup(resp.text, "html.parser")
        paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p") if p.get_text(strip=True)]

        # Walk paragraphs looking for a date, then scan ahead for the time.
        # Some pages insert a location paragraph between the date and time, so
        # we look at the next 3 paragraphs rather than just the immediate next one.
        for i, p_text in enumerate(paragraphs):
            if _DATE_PATTERN.match(p_text):
                result["start_date"] = _parse_date_text(p_text)
                for j in range(i + 1, min(i + 4, len(paragraphs))):
                    if _TIME_PATTERN.match(paragraphs[j]):
                        result["start_time"] = _parse_time_text(paragraphs[j])
                        break
                break

        # Price info — look for FREE or price patterns
        full_text = " ".join(paragraphs)
        if re.search(r"\bFREE\b", full_text, re.IGNORECASE):
            result["is_free"] = True
            result["price_note"] = "Free"
        else:
            price_m = re.search(r"\$(\d+(?:\.\d{2})?)", full_text)
            if price_m:
                result["is_free"] = False
                result["price_note"] = f"${price_m.group(1)}"

        # Description: first substantive paragraph (>40 chars) that isn't the title
        for p_text in paragraphs:
            if len(p_text) > 40 and not _DATE_PATTERN.match(p_text) and not _TIME_PATTERN.match(p_text):
                result["description"] = p_text[:800]
                break

    except requests.RequestException as exc:
        logger.warning("DeKalb History Center: detail fetch failed for %s: %s", url, exc)

    return result


def _fetch_current_programs(session: requests.Session) -> list[dict]:
    """Fetch programs in the 'current-programs' category via WP REST API."""
    try:
        resp = session.get(
            PROGRAMS_API,
            params={
                "per_page": 100,
                "program_category": CURRENT_PROGRAMS_CAT_ID,
                "_embed": "1",
            },
            headers=_HEADERS,
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.error("DeKalb History Center: programs API fetch failed: %s", exc)
        return []


def _fetch_current_exhibits(session: requests.Session) -> list[dict]:
    """Fetch exhibits marked as current via WP REST API."""
    try:
        resp = session.get(
            EXHIBITS_API,
            params={"per_page": 50, "_embed": "1"},
            headers=_HEADERS,
            timeout=20,
        )
        resp.raise_for_status()
        all_exhibits = resp.json()
        # Filter to current-exhibits only (skip past-exhibits)
        return [
            ex for ex in all_exhibits
            if "exhibit_category-current-exhibits" in ex.get("class_list", [])
        ]
    except Exception as exc:
        logger.error("DeKalb History Center: exhibits API fetch failed: %s", exc)
        return []


def _category_for_program(title: str, program_category_slugs: list[str]) -> tuple[str, Optional[str], list[str]]:
    """Map program category slugs + title to LostCity category/subcategory/tags."""
    tags = list(EVENT_TAGS)
    title_lower = title.lower()

    if "hops-at-the-history" in program_category_slugs or "hops" in title_lower:
        tags.extend(["lecture", "book-club"])
        return "learning", "lecture", tags
    if "lunch-and-learn" in program_category_slugs or "lunch and learn" in title_lower:
        tags.append("lecture")
        return "learning", "lecture", tags
    if "walking-tours" in program_category_slugs or "tour" in title_lower:
        tags.append("tour")
        return "museums", "tour", tags
    if "workshop" in title_lower:
        tags.append("workshop")
        return "learning", "workshop", tags
    if "virtual" in title_lower:
        tags.append("virtual")
        return "learning", "lecture", tags

    # Default for general programs
    return "learning", "lecture", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl DeKalb History Center for events and exhibitions.

    Events come from the WP REST API programs CPT (current-programs category).
    Dates are extracted from individual program detail pages.
    Exhibitions come from the WP REST API exhibits CPT (current-exhibits only).
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0

    today = date.today()

    session = requests.Session()
    venue_id = get_or_create_place(PLACE_DATA)

    # ------------------------------------------------------------------ #
    # EVENTS — programs CPT via WP REST API                                #
    # ------------------------------------------------------------------ #
    raw_programs = _fetch_current_programs(session)
    logger.info(
        "DeKalb History Center: fetched %d current programs from WP REST API",
        len(raw_programs),
    )

    for raw in raw_programs:
        # Decode HTML entities in title
        title_html = raw.get("title", {}).get("rendered", "")
        title = BeautifulSoup(title_html, "html.parser").get_text(strip=True)
        if not title:
            continue

        url = raw.get("link", "") or BASE_URL

        # Category slugs from class_list
        class_list = raw.get("class_list", [])
        prog_cat_slugs = [
            c.replace("program_category-", "")
            for c in class_list
            if c.startswith("program_category-")
        ]

        # Featured image from _embed
        embedded = raw.get("_embedded", {})
        media_list = embedded.get("wp:featuredmedia", [])
        image_url: Optional[str] = None
        if media_list and isinstance(media_list[0], dict):
            image_url = media_list[0].get("source_url")

        # Excerpt for fallback description
        excerpt_html = raw.get("excerpt", {}).get("rendered", "")
        excerpt = BeautifulSoup(excerpt_html, "html.parser").get_text(strip=True) if excerpt_html else None

        # Fetch detail page for date/time/description/price
        detail = _fetch_program_detail(url, session)

        start_date = detail["start_date"]
        if not start_date:
            logger.debug(
                "DeKalb History Center: skipping program %r — could not parse date from %s",
                title, url,
            )
            continue

        # Skip events that have already passed
        try:
            event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            if event_date < today:
                logger.debug(
                    "DeKalb History Center: skipping past program %r (%s)", title, start_date
                )
                continue
        except ValueError:
            pass

        description = detail["description"] or excerpt
        is_free = detail["is_free"]
        price_note = detail["price_note"]
        category, subcategory, tags = _category_for_program(title, prog_cat_slugs)

        content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

        event_record: dict = {
            "source_id": source_id,
            "place_id": venue_id,
            "portal_id": portal_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": detail["start_time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": price_note,
            "is_free": is_free if is_free is not None else False,
            "source_url": url,
            "ticket_url": url,
            "image_url": image_url,
            "raw_text": f"{title} - {start_date}",
            "extraction_confidence": 0.88,
            "is_recurring": False,
            "content_hash": content_hash,
        }

        events_found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            try:
                insert_event(event_record)
                events_new += 1
                logger.info(
                    "DeKalb History Center: added program %r on %s", title, start_date
                )
            except Exception as exc:
                logger.error(
                    "DeKalb History Center: failed to insert program %r: %s", title, exc
                )

    # ------------------------------------------------------------------ #
    # EXHIBITIONS — exhibits CPT via WP REST API                           #
    # ------------------------------------------------------------------ #
    current_exhibits = _fetch_current_exhibits(session)
    logger.info(
        "DeKalb History Center: found %d current exhibits", len(current_exhibits)
    )

    exhibition_envelope = TypedEntityEnvelope()

    for raw_ex in current_exhibits:
        title_html = raw_ex.get("title", {}).get("rendered", "")
        ex_title = BeautifulSoup(title_html, "html.parser").get_text(strip=True)
        if not ex_title:
            continue

        ex_url = raw_ex.get("link", "") or f"{BASE_URL}/exhibits-dekalb-history-center-museum/"

        excerpt_html = raw_ex.get("excerpt", {}).get("rendered", "")
        description = BeautifulSoup(excerpt_html, "html.parser").get_text(strip=True) if excerpt_html else None

        # Featured image from _embed
        embedded = raw_ex.get("_embedded", {})
        media_list = embedded.get("wp:featuredmedia", [])
        image_url = None
        if media_list and isinstance(media_list[0], dict):
            image_url = media_list[0].get("source_url")

        # Exhibits don't have structured open/close dates in the API payload.
        # Use the WP post date as a proxy opening date; closing date is unknown.
        post_date_str = raw_ex.get("date", "")
        opening_date: Optional[str] = None
        if post_date_str:
            try:
                opening_date = datetime.fromisoformat(post_date_str).strftime("%Y-%m-%d")
            except ValueError:
                pass

        ex_record, _ex_artists = build_exhibition_record(
            title=ex_title,
            venue_id=venue_id,
            source_id=source_id,
            opening_date=opening_date,
            closing_date=None,
            venue_name=PLACE_DATA["name"],
            description=description,
            image_url=image_url,
            source_url=ex_url,
            portal_id=portal_id,
            admission_type="ticketed",
            tags=EXHIBITION_TAGS,
        )
        exhibition_envelope.add("exhibitions", ex_record)
        logger.info(
            "DeKalb History Center: queued exhibition %r (opened ~%s)",
            ex_title, opening_date or "unknown",
        )

    if exhibition_envelope.exhibitions:
        persist_result = persist_typed_entity_envelope(exhibition_envelope)
        persisted = persist_result.persisted.get("exhibitions", 0)
        skipped = persist_result.skipped.get("exhibitions", 0)
        logger.info(
            "DeKalb History Center: persisted %d exhibitions, skipped %d",
            persisted, skipped,
        )

    logger.info(
        "DeKalb History Center crawl complete: %d events found, %d new, %d updated; "
        "%d exhibitions queued",
        events_found, events_new, events_updated,
        len(exhibition_envelope.exhibitions),
    )
    return events_found, events_new, events_updated
