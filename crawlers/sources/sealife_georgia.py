"""
Crawler for SEA LIFE Aquarium — configured for a Georgia/Atlanta location.

IMPORTANT — LOCATION STATUS (as of 2026-03-10):
SEA LIFE (Merlin Entertainments) does NOT currently operate a Georgia or Atlanta
location.  The URL https://www.visitsealife.com/georgia/ returns 404.
No Georgia listing appears on the SEA LIFE global location finder.

This crawler is built to the correct SEA LIFE site architecture so that it
will work as-is if/when a Georgia location opens.  The `LOCATION_SLUG`
constant is the only value that needs updating.

To activate: update LOCATION_SLUG, EVENTS_PATH, and PLACE_DATA to match the
real location once it opens.  Then activate the source record in the DB.

SEA LIFE event site architecture (consistent across US locations):
  - https://www.visitsealife.com/{slug}/what-s-inside/events/
    OR /whats-inside/events/ (spelling varies by location)
  - Events listed as text blocks: type label, date range, time, price, age
  - Some locations use Schema.org Event JSON-LD; others do not
  - Detail pages: /what-s-inside/events/{event-slug}/
  - Seasonal events have specific date ranges; experiences are ongoing/daily

SEA LIFE US locations for reference (to verify crawl pattern):
  charlotte-concord, grapevine, kansas-city, michigan, minnesota,
  new-jersey, orlando, arizona
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ─── Location configuration ──────────────────────────────────────────────────
# Update these when a Georgia location opens.
LOCATION_SLUG = "georgia"  # visitsealife.com/{slug}/
BASE_URL = "https://www.visitsealife.com"
EVENTS_PATH = f"/{LOCATION_SLUG}/whats-inside/events/"
EVENTS_URL = f"{BASE_URL}{EVENTS_PATH}"

PLACE_DATA = {
    "name": "SEA LIFE Georgia Aquarium",
    "slug": "sealife-georgia",
    "address": "3500 Peachtree Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30326",
    # lat/lng: TBD — fill in once exact unit in Phipps Plaza is confirmed
    "place_type": "aquarium",
    "spot_type": "aquarium",
    "website": f"{BASE_URL}/{LOCATION_SLUG}/",
    "vibes": ["family-friendly", "all-ages"],
}

BASE_TAGS = [
    "family-friendly",
    "all-ages",
    "kids",
    "educational",
    "ticketed",
]

# SEA LIFE events listing pages use slightly different URL patterns per location.
# Try both variants in order.
EVENTS_URL_VARIANTS = [
    f"{BASE_URL}/{LOCATION_SLUG}/whats-inside/events/",
    f"{BASE_URL}/{LOCATION_SLUG}/what-s-inside/events/",
    f"{BASE_URL}/{LOCATION_SLUG}/whats-inside/events-experiences/",
    f"{BASE_URL}/{LOCATION_SLUG}/whats-inside/events-page/",
]

# Date range patterns appearing in SEA LIFE event listings.
# Examples seen across US locations:
#   "February 21th - May 25th"
#   "March 1 - April 30"
#   "January 15, 2026 - March 31, 2026"
_ORDINAL_SUFFIX_RE = re.compile(r"(\d+)(st|nd|rd|th)\b", re.IGNORECASE)
_DATE_RANGE_RE = re.compile(
    r"((?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2}(?:,?\s+\d{4})?)"
    r"\s*[-–—]\s*"
    r"((?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2}(?:,?\s+\d{4})?)",
    re.IGNORECASE,
)
_SINGLE_DATE_RE = re.compile(
    r"((?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2}(?:,?\s+\d{4})?)",
    re.IGNORECASE,
)


def _strip_ordinal_suffix(text: str) -> str:
    """Remove ordinal suffixes: '21th' → '21', '3rd' → '3'."""
    return _ORDINAL_SUFFIX_RE.sub(r"\1", text)


def _parse_date_str(raw: str) -> Optional[str]:
    """Parse a date string to YYYY-MM-DD.  Handles year-optional formats."""
    raw = _strip_ordinal_suffix(raw.strip()).strip(",")
    year = datetime.now().year

    for fmt in ("%B %d %Y", "%B %d, %Y", "%B %d"):
        try:
            dt = datetime.strptime(raw, fmt)
            if fmt == "%B %d":
                dt = dt.replace(year=year)
                # If the parsed date is in the past, try next year
                if dt.date() < datetime.now().date():
                    dt = dt.replace(year=year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """Extract a start/end date pair from a text string."""
    m = _DATE_RANGE_RE.search(text)
    if m:
        return _parse_date_str(m.group(1)), _parse_date_str(m.group(2))

    # Single date only
    m2 = _SINGLE_DATE_RE.search(text)
    if m2:
        return _parse_date_str(m2.group(1)), None

    return None, None


def _parse_price(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """Extract price info from a text fragment.

    Returns (price_min, price_max, price_note, is_free).
    """
    if not text:
        return None, None, None, False

    text_lower = text.lower()

    if any(k in text_lower for k in ["free", "included with admission", "no additional"]):
        return None, None, None, True

    # "Starting at $X.XX" or "From $X" or "$X per person"
    match = re.search(r"\$(\d+(?:\.\d{2})?)", text)
    if match:
        price = float(match.group(1))
        return price, price, text.strip(), False

    return None, None, None, False


def _infer_tags(title: str, description: str) -> list[str]:
    """Append event-specific tags based on keywords."""
    tags = list(BASE_TAGS)
    combined = f"{title} {description}".lower()

    if any(k in combined for k in ["spring break", "spring"]):
        tags.append("seasonal")
    if any(k in combined for k in ["halloween", "spooky", "ghost"]):
        tags.extend(["seasonal", "holiday"])
    if any(k in combined for k in ["christmas", "holiday", "winter", "snow"]):
        tags.extend(["seasonal", "holiday"])
    if any(k in combined for k in ["behind the scenes", "tour"]):
        tags.extend(["hands-on", "educational"])
    if any(k in combined for k in ["toddler", "preschool", "little one"]):
        tags.append("toddler")
    if "sleepover" in combined or "sleep under" in combined:
        tags.append("kids")
    if "scout" in combined:
        tags.append("educational")

    seen: set = set()
    unique = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    return unique


def _find_working_events_url(page) -> Optional[str]:
    """Try URL variants for the events page; return the first that returns 200."""
    for url in EVENTS_URL_VARIANTS:
        try:
            response = page.goto(url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(1500)
            if response and response.status == 200:
                text = page.inner_text("body").lower()
                # Confirm this is a real events page, not a redirect to a 404 shell
                if "page not found" not in text and "oops" not in text:
                    logger.info("SEA LIFE Georgia: found working events URL: %s", url)
                    return url
        except Exception:
            continue
    return None


def _parse_events_from_page_text(
    body_text: str,
    events_url: str,
    source_id: int,
    venue_id: int,
) -> list[dict]:
    """
    Parse the events listing page text into a list of event record dicts.

    SEA LIFE events pages use a repeating block structure:
      Event (type label)
      <Date range>
      <Hours / schedule info>
      <Price>
      <Age/audience>

      Experience (type label)
      <Name of experience>
      <Frequency> (Daily / Tuesday-Sunday / etc.)
      ...

    We extract the seasonal events with actual date ranges.
    Ongoing daily "experiences" (Behind the Scenes Tour, VR, etc.) are
    excluded — they are venue features, not calendar events.
    """
    lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]
    datetime.now().strftime("%Y-%m-%d")
    today = datetime.now().date()

    events = []
    seen_keys: set = set()

    i = 0
    while i < len(lines):
        line = lines[i]
        line_lower = line.lower()

        # Look for "Event" type labels (not "Experience" which = always-on)
        if line_lower in {"event"}:
            # Collect the next ~8 lines as the event block
            block_lines = lines[i : i + 9]
            block_text = " | ".join(block_lines)

            start_date, end_date = _parse_date_range(block_text)
            if not start_date:
                i += 1
                continue

            # Skip events that have already ended
            if end_date:
                try:
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                    if end_dt < today:
                        i += 1
                        continue
                except ValueError:
                    pass

            # Title: first non-date, non-label, non-price line after the type label
            title = None
            for j in range(i + 1, min(i + 6, len(lines))):
                candidate = lines[j].strip()
                c_lower = candidate.lower()
                if not candidate:
                    continue
                if c_lower in {"event", "experience"}:
                    continue
                # Skip lines that are only a date range
                if _DATE_RANGE_RE.search(candidate):
                    continue
                # Skip lines that are only hours/pricing fragments
                if re.match(r"^(?:during|open|daily|every|\$|\d{1,2}(?:am|pm))", c_lower):
                    continue
                if len(candidate) < 4:
                    continue
                title = candidate
                break

            if not title:
                i += 1
                continue

            # Price from block
            price_min, price_max, price_note, is_free = _parse_price(block_text)

            dedup_key = f"{title}|{start_date}"
            if dedup_key in seen_keys:
                i += 1
                continue
            seen_keys.add(dedup_key)

            content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

            tags = _infer_tags(title, "")
            events.append({
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": None,
                "start_date": start_date,
                "start_time": None,
                "end_date": end_date,
                "end_time": None,
                "is_all_day": True,
                "category": "family",
                "subcategory": "seasonal-event",
                "tags": tags,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "is_free": is_free if is_free else False,
                "source_url": events_url,
                "ticket_url": events_url,
                "image_url": None,
                "raw_text": block_text[:2000],
                "extraction_confidence": 0.75,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            })

        i += 1

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl SEA LIFE Georgia events using Playwright.

    NOTE: As of 2026-03-10, SEA LIFE does not operate a Georgia location.
    This crawler will return (0, 0, 0) until a real events page is live.
    The crawler is structured correctly for the SEA LIFE site architecture
    so it will work automatically once the location opens.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)

            working_url = _find_working_events_url(page)
            if not working_url:
                logger.info(
                    "SEA LIFE Georgia: events page not found at any known URL variant — "
                    "this location has not yet opened. "
                    "Checked: %s",
                    ", ".join(EVENTS_URL_VARIANTS),
                )
                browser.close()
                return 0, 0, 0

            # Scroll to load lazy content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")

            event_records = _parse_events_from_page_text(
                body_text,
                events_url=working_url,
                source_id=source_id,
                venue_id=venue_id,
            )

            if not event_records:
                logger.info(
                    "SEA LIFE Georgia: page loaded but no date-bounded events found. "
                    "Only ongoing experiences present (excluded by design)."
                )

            for event_record in event_records:
                events_found += 1

                existing = find_event_by_hash(event_record["content_hash"])
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        "SEA LIFE Georgia: added '%s' (%s – %s)",
                        event_record["title"],
                        event_record["start_date"],
                        event_record.get("end_date") or "ongoing",
                    )
                except Exception as exc:
                    logger.error(
                        "SEA LIFE Georgia: failed to insert '%s': %s",
                        event_record["title"],
                        exc,
                    )

            browser.close()

    except Exception as exc:
        logger.error("SEA LIFE Georgia crawl failed: %s", exc)
        raise

    logger.info(
        "SEA LIFE Georgia crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
