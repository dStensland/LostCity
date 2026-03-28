"""
Crawler for High Museum of Art (high.org/events + high.org/exhibitions).
Atlanta's premier art museum in Midtown.

Site uses JavaScript rendering - must use Playwright.
Events page format: Date (January 18), Event Type, Title, Time (12:30-2:30 p.m.),
Description. Also handles: Daily, Weekly, and Ongoing programs.
Exhibitions page: current/upcoming exhibitions with date ranges.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record, parse_date_range

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    exhibitions=True,
    venue_features=True,
    venue_specials=True,
)


BASE_URL = "https://high.org"
EVENTS_URL = f"{BASE_URL}/events/"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions/"

PLACE_DATA = {
    "name": "High Museum of Art",
    "slug": "high-museum",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.8334,
    "lng": -84.3835,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # Description populated dynamically from og:description on first Playwright visit.
    # Fallback for offline/test runs:
    "description": (
        "The High Museum of Art is the leading art museum in the southeastern United States, "
        "with a collection of more than 19,000 works of art in Midtown Atlanta."
    ),
    # Hours verified 2026-03-11 from high.org/visit
    "hours": {
        "monday": "closed",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-21:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    # Admission: $17.50 adults, $12 students/seniors/youth, free under 5,
    # free second Sunday of each month.
    "vibes": ["world-class", "cultural", "art", "family-friendly", "midtown"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "art_museum",
            "commitment_tier": "halfday",
            "primary_activity": "family art museum visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "garage",
            "best_time_of_day": "morning",
            "practical_notes": (
                "The High works especially well as a weather-proof Midtown family outing when timed around "
                "kid-focused programming or free Second Sunday admission. It is also one of the easier museum outings "
                "for bathroom breaks and mid-visit resets without losing the shape of the day."
            ),
            "accessibility_notes": (
                "Indoor galleries, elevators, and structured museum circulation make the High one of the "
                "lower-friction culture stops for strollers and multigenerational visits, with less walking burden "
                "than a larger campus destination."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "General admission applies most days; free Second Sundays and family programming windows make it one of the strongest in-city museum options for kids.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "family-art-making-and-kids-programs",
            "title": "Family art-making and kids programs",
            "feature_type": "amenity",
            "description": "The High runs family art-making, youth programs, and kid-friendly gallery activities alongside its major exhibitions.",
            "url": EVENTS_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "weather-proof-midtown-family-culture-stop",
            "title": "Weather-proof Midtown family culture stop",
            "feature_type": "amenity",
            "description": "The High is one of the city's strongest indoor family culture anchors when weather, heat, or energy levels make an outdoor plan harder to sustain.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "easy-museum-breaks-and-resets",
            "title": "Easy museum breaks and resets",
            "feature_type": "amenity",
            "description": "The High is one of the easier culture outings for families who need bathroom breaks, elevator access, and short reset moments without abandoning the plan.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "place_id": venue_id,
            "slug": "free-second-sunday-admission",
            "title": "Free Second Sunday admission",
            "description": "General admission is free on the second Sunday of each month, making the High one of the strongest recurring free-family museum options in the city.",
            "price_note": "Free second Sunday each month.",
            "is_free": True,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    envelope.add(
        "venue_specials",
        {
            "place_id": venue_id,
            "slug": "children-5-and-under-free",
            "title": "Children 5 and under free",
            "description": "Children age 5 and under receive free admission, which lowers the cost of treating the High as a family museum day even outside the free monthly window.",
            "price_note": "Children 5 and under are free.",
            "is_free": True,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    return envelope

# Known event type categories — matched as exact lines only, not substrings
EVENT_TYPES = {
    "tour",
    "art making",
    "studio classes",
    "young children",
    "teens",
    "culture collective",
    "friday nights",
    "art conversations",
    "wine & dine",
    "member exclusive",
    "family programs",
    "special event",
}

# Recurring-marker labels that should never be treated as event titles
RECURRING_MARKERS = {"daily", "weekly", "ongoing"}

# Day-of-week phrases that signal a recurring schedule header, not a title
_DAY_PATTERN = re.compile(
    r"^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$",
    re.IGNORECASE,
)

# Date-line pattern (e.g. "January 18")
_DATE_LINE_PATTERN = re.compile(
    r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}$",
    re.IGNORECASE,
)


def _is_recurring_marker(text: str) -> bool:
    """Return True if text is a recurring/schedule header, not an event title."""
    lower = text.strip().lower()
    if lower in RECURRING_MARKERS:
        return True
    if _DAY_PATTERN.match(lower):
        return True
    return False


def _is_date_label(text: str) -> bool:
    """Return True if text looks like a date heading."""
    return bool(_DATE_LINE_PATTERN.match(text.strip()))


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like 'January 18', 'Daily', 'Weekly', 'Ongoing'.
    Returns YYYY-MM-DD or None for recurring events.
    """
    date_text = date_text.strip()
    now = datetime.now()
    year = now.year

    # Handle recurring markers
    if date_text.lower() in RECURRING_MARKERS:
        return None

    # Try "January 18" format
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=year)
        if dt < now:
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "Jan 18" format
    try:
        dt = datetime.strptime(date_text, "%b %d")
        dt = dt.replace(year=year)
        if dt < now:
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '12:30–2:30 p.m.', '7–8 p.m.', or single '7 p.m.' to HH:MM."""
    if not time_text:
        return None

    time_text = time_text.strip().lower()

    # Handles both ranges and single times:
    #   "1–2 p.m.", "12:30–2:30 p.m.", "10 a.m.–3 p.m.", "7 p.m.", "11 a.m."
    # The range part (dash + end time) is made optional by the outer group with ?.
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?"
        r"(?:\s*(?:–|-|—)\s*\d{1,2}(?::\d{2})?\s*)?"
        r"\s*(a\.?m\.?|p\.?m\.?)",
        time_text,
    )
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).replace(".", "")

        if "p" in period and hour != 12:
            hour += 12
        elif "a" in period and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(
    title: str, event_type: str
) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and type."""
    title_lower = title.lower()
    type_lower = event_type.lower() if event_type else ""
    tags = ["art", "museum", "high-museum", "midtown"]

    if "toddler" in title_lower or "young children" in type_lower:
        return "family", "kids", tags + ["family", "kids", "toddler"]
    if any(w in title_lower for w in ["teens", "teen"]) or "teens" in type_lower:
        return "community", "teens", tags + ["teens"]
    if "friday night" in type_lower or "friday night" in title_lower:
        return "nightlife", "museum", tags + ["adults", "nightlife"]
    if "tour" in type_lower or "tour" in title_lower:
        return "museums", "tour", tags + ["tour"]
    if any(w in type_lower for w in ["studio", "art making", "workshop"]):
        return "museums", "workshop", tags + ["workshop", "class"]
    if "wine" in type_lower or "wine" in title_lower:
        return "food_drink", "wine", tags + ["wine", "adults"]
    if any(w in title_lower for w in ["jazz", "music", "concert"]):
        return "music", None, tags + ["music"]
    if "film" in title_lower or "screening" in title_lower:
        return "film", None, tags + ["film"]

    return "museums", "museum", tags


def _scrape_page_events(
    page,
    source_id: int,
    venue_id: int,
    image_map: dict,
    event_links: dict,
    seen_events: set,
    exhibition_envelope: TypedEntityEnvelope,
    portal_id: Optional[str] = None,
) -> tuple[int, int, int]:
    """Parse events from the current Playwright page state and insert/update them.

    Returns (events_found, events_new, events_updated) for this page.
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    skip_items = {
        "skip to main",
        "skip to footer",
        "visit",
        "visit us",
        "plan your visit",
        "buy tickets",
        "become a member",
        "what to do",
        "events",
        "events calendar",
        "art",
        "give",
        "login",
        "order history",
        "all events",
        "our events",
        "select date",
        "filter events",
        "apply filters",
        "for adults",
        "for educators",
        "for families and kids",
        "for teens",
        "motivation",
        "free admission",
        "member exclusive",
        "clear filters",
        "view",
        "sold out",
    }

    body_text = page.inner_text("body")
    lines = [line.strip() for line in body_text.split("\n") if line.strip()]

    i = 0
    current_date = None
    current_type = None
    is_recurring = False

    while i < len(lines):
        line = lines[i]
        line_lower = line.lower()

        # Skip nav/UI items
        if line_lower in skip_items or len(line) < 3:
            i += 1
            continue

        # Check for date heading (January 18, Daily, Weekly, Ongoing)
        if _DATE_LINE_PATTERN.match(line) or line_lower in RECURRING_MARKERS:
            current_date = parse_date(line)
            is_recurring = line_lower in RECURRING_MARKERS
            if is_recurring:
                # For recurring events, use today as the start date
                current_date = datetime.now().strftime("%Y-%m-%d")
            i += 1
            continue

        # Check for "every thursday" style recurring markers
        if _DAY_PATTERN.match(line_lower):
            is_recurring = True
            current_date = current_date or datetime.now().strftime("%Y-%m-%d")
            i += 1
            continue

        # Check for event type — EXACT line match only to avoid false positives
        # (e.g. a description containing the word "tour" would previously be consumed)
        if line_lower in EVENT_TYPES:
            current_type = line
            i += 1
            continue

        # Detect a time line — matches both ranges ("7–8 p.m.") and single times ("7 p.m.")
        # Only treat short lines as time lines to avoid matching times embedded in descriptions
        # (e.g. "Tours begin at 1 p.m. in the Taylor Lobby" should NOT be a time line)
        time_match = None
        if len(line) < 30:
            time_match = re.search(
                r"\d{1,2}(?::\d{2})?"
                r"(?:\s*(?:–|-|—)\s*\d{1,2}(?::\d{2})?\s*)?"
                r"\s*(?:a\.?m\.?|p\.?m\.?)",
                line,
                re.IGNORECASE,
            )
        if time_match and current_date:
            # Walk back up to 3 lines to find a valid title.
            # Skip markers, type labels, date labels, skip_items, and "SOLD OUT".
            title = None
            for offset in range(1, min(4, i + 1)):
                candidate = lines[i - offset].strip()
                candidate_lower = candidate.lower()

                if candidate_lower in skip_items:
                    continue
                if _is_recurring_marker(candidate):
                    continue
                if _is_date_label(candidate):
                    continue
                if candidate_lower in EVENT_TYPES:
                    continue
                if candidate.upper() == "SOLD OUT":
                    continue
                # Skip short fragments that aren't plausible titles
                if len(candidate) < 3:
                    continue
                # Skip lines that look like time strings (e.g. "1–2 p.m.")
                if re.match(
                    r"^\d{1,2}(?::\d{2})?\s*(?:(?:–|-|—)\s*\d{1,2}(?::\d{2})?\s*)?(?:a\.?m\.?|p\.?m\.?)$",
                    candidate,
                    re.IGNORECASE,
                ):
                    continue

                title = candidate
                break

            if not title:
                i += 1
                continue

            # Parse time
            start_time = parse_time(line)

            # Look ahead for description
            description = None
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line.lower() not in skip_items and len(next_line) > 30:
                    description = next_line[:500]

            # Check for duplicates
            event_key = f"{title}|{current_date}|{start_time}"
            if event_key in seen_events:
                i += 1
                continue
            seen_events.add(event_key)

            events_found += 1

            content_hash = generate_content_hash(title, "High Museum of Art", current_date)

            category, subcategory, tags = determine_category(title, current_type or "")

            event_url = find_event_url(title, event_links, EVENTS_URL)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description,
                "start_date": current_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": "Included with museum admission ($17.50 adults, $12 youth/seniors; free second Sunday)",
                "is_free": None,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": image_map.get(title),
                "raw_text": (
                    f"{current_type}: {title}" if current_type else title
                ),
                "extraction_confidence": 0.85,
                "is_recurring": is_recurring,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            # Enrich from detail page
            enrich_event_record(event_record, source_name="High Museum of Art")

            # High Museum charges admission ($17.50+). Only mark free if explicitly
            # free to the public with no admission required.
            if event_record.get("is_free") is None:
                event_record["is_free"] = False
                event_record.setdefault(
                    "price_note",
                    "Included with museum admission ($17.50 adults, $12 youth/seniors; free second Sunday)",
                )

            # Date range extraction: scan for end dates in text
            raw_text = event_record.get("raw_text") or ""
            range_text = f"{title} {description or ''} {raw_text}"
            _, range_end = parse_date_range(range_text)
            if range_end:
                event_record["end_date"] = range_end

            # Exhibit detection: route to exhibitions lane instead of events
            exhibit_keywords = [
                "exhibit", "exhibition", "on view", "collection", "installation",
            ]
            combined_exhibit = f"{title.lower()} {(description or '').lower()}"
            if any(kw in combined_exhibit for kw in exhibit_keywords):
                ex_record, ex_artists = build_exhibition_record(
                    title=title,
                    venue_id=venue_id,
                    source_id=source_id,
                    opening_date=current_date,
                    closing_date=event_record.get("end_date"),
                    venue_name=PLACE_DATA["name"],
                    description=description,
                    image_url=image_map.get(title),
                    source_url=event_record.get("source_url"),
                    portal_id=portal_id,
                    admission_type="ticketed",
                    tags=["museum", "high-museum", "midtown", "exhibition"],
                )
                if ex_artists:
                    ex_record["artists"] = ex_artists
                exhibition_envelope.add("exhibitions", ex_record)
                events_new += 1
                logger.info(f"Queued exhibition: {title} on {current_date}")
                i += 1
                continue

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                i += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {current_date}")
            except Exception as e:
                logger.error(f"Failed to insert: {title}: {e}")

        i += 1

    return events_found, events_new, events_updated


def _crawl_exhibitions(
    page,
    source_id: int,
    venue_id: int,
    seen_events: set,
    exhibition_envelope: TypedEntityEnvelope,
    portal_id: Optional[str] = None,
) -> tuple[int, int, int]:
    """Crawl the exhibitions page for current and upcoming shows.

    Exhibitions are written to the exhibitions lane via the envelope.
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    logger.info(f"Fetching High Museum exhibitions: {EXHIBITIONS_URL}")
    try:
        page.goto(EXHIBITIONS_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(4000)

        # Scroll to load lazy content
        for _ in range(3):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1200)

        # Extract image map and event links for the exhibitions page
        exhibit_image_map = extract_images_from_page(page)
        exhibit_links = extract_event_links(page, BASE_URL)

        body_text = page.inner_text("body")
        lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]

        # Parse exhibition blocks.  A block looks roughly like:
        #   <Title>
        #   <"Month DD, YYYY – Month DD, YYYY" or "On View Through Month DD, YYYY">
        #   [optional description text]
        #
        # We look for lines that contain a date range using parse_date_range and
        # treat the preceding non-empty line as the exhibition title.

        skip_nav = {
            "exhibitions", "current exhibitions", "upcoming exhibitions",
            "past exhibitions", "on view", "visit", "buy tickets",
            "become a member", "skip to main", "skip to footer",
            "menu", "search", "filter", "all exhibitions",
        }

        today_str = datetime.now().strftime("%Y-%m-%d")

        for idx, line in enumerate(lines):
            # A date-range line contains a month name and a year, usually with a dash
            # between two dates.  Use parse_date_range to confirm.
            start_date, end_date = parse_date_range(line)

            # Also handle "Through Month DD, YYYY" / "On View Through ..." style
            if not end_date:
                _, end_date = parse_date_range(line)

            if not end_date and not start_date:
                continue

            # Skip exhibitions that have already closed
            if end_date and end_date < today_str:
                continue

            # Walk back to find the exhibition title (up to 3 lines)
            title = None
            for offset in range(1, min(4, idx + 1)):
                candidate = lines[idx - offset].strip()
                if not candidate or candidate.lower() in skip_nav or len(candidate) < 4:
                    continue
                # Reject lines that are themselves date ranges
                cstart, cend = parse_date_range(candidate)
                if cstart or cend:
                    continue
                title = candidate
                break

            if not title:
                continue

            # Use start_date from the range, or today if only an end_date was found
            exhibit_start = start_date or today_str

            # Dedup
            event_key = f"exhibit|{title}|{exhibit_start}"
            if event_key in seen_events:
                continue
            seen_events.add(event_key)

            # Look ahead for description
            description = None
            for fwd in range(1, 4):
                if idx + fwd >= len(lines):
                    break
                next_line = lines[idx + fwd].strip()
                if next_line.lower() in skip_nav:
                    continue
                if len(next_line) > 30:
                    description = next_line[:500]
                    break

            events_found += 1

            event_url = find_event_url(title, exhibit_links, EXHIBITIONS_URL)

            ex_record, ex_artists = build_exhibition_record(
                title=title,
                venue_id=venue_id,
                source_id=source_id,
                opening_date=start_date or exhibit_start,
                closing_date=end_date,
                venue_name=PLACE_DATA["name"],
                description=description,
                image_url=exhibit_image_map.get(title),
                source_url=event_url,
                portal_id=portal_id,
                admission_type="ticketed",
                tags=["museum", "high-museum", "midtown", "exhibition"],
            )
            if ex_artists:
                ex_record["artists"] = ex_artists
            exhibition_envelope.add("exhibitions", ex_record)
            events_new += 1
            logger.info(f"Queued exhibition: {title} ({exhibit_start} – {end_date})")

    except Exception as e:
        logger.warning(f"Failed to crawl exhibitions page: {e}")

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl High Museum events and exhibitions using Playwright."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0
    exhibition_envelope = TypedEntityEnvelope()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # ----------------------------------------------------------------
            # 0. Homepage — extract og:image / og:description for venue record
            # ----------------------------------------------------------------
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                og_image = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:image\"]'); return m ? m.content : null; }"
                )
                og_desc = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:description\"]') "
                    "|| document.querySelector('meta[name=\"description\"]'); return m ? m.content : null; }"
                )
                if og_image:
                    PLACE_DATA["image_url"] = og_image
                    logger.debug("High Museum: og:image = %s", og_image)
                if og_desc:
                    PLACE_DATA["description"] = og_desc
                    logger.debug("High Museum: og:description captured")
            except Exception as _meta_exc:
                logger.debug("High Museum: could not extract og meta from homepage: %s", _meta_exc)

            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            # ----------------------------------------------------------------
            # 1. Events page — crawl all paginated pages
            # ----------------------------------------------------------------
            logger.info(f"Fetching High Museum events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to fully render the first page
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Collect images and links from the first page load
            image_map = extract_images_from_page(page)
            event_links = extract_event_links(page, BASE_URL)

            seen_events: set = set()
            page_num = 1

            while True:
                logger.info(f"Scraping High Museum events page {page_num}")
                f, n, u = _scrape_page_events(
                    page, source_id, venue_id, image_map, event_links, seen_events,
                    exhibition_envelope, portal_id,
                )
                events_found += f
                events_new += n
                events_updated += u

                # Try to advance to the next page.
                # The High Museum uses client-side JS pagination.
                # Try several common selectors for the "next page" control.
                next_clicked = False
                next_selectors = [
                    "a[aria-label='Next page']",
                    "button[aria-label='Next page']",
                    "a[aria-label='next page']",
                    "button[aria-label='next page']",
                    ".pagination__next",
                    "a.pagination__next",
                    "li.pagination__next a",
                    # Numbered page link: look for current + 1
                    f"a[aria-label='Page {page_num + 1}']",
                    f"button[aria-label='Page {page_num + 1}']",
                ]
                for selector in next_selectors:
                    try:
                        el = page.query_selector(selector)
                        if el and el.is_visible() and el.is_enabled():
                            el.click()
                            page.wait_for_timeout(3000)
                            # Scroll to ensure all new content is rendered
                            for _ in range(3):
                                page.evaluate(
                                    "window.scrollTo(0, document.body.scrollHeight)"
                                )
                                page.wait_for_timeout(1000)
                            # Refresh image/link maps for new page content
                            image_map.update(extract_images_from_page(page))
                            event_links.update(extract_event_links(page, BASE_URL))
                            next_clicked = True
                            page_num += 1
                            break
                    except Exception:
                        continue

                if not next_clicked:
                    logger.info(
                        f"No next-page button found after page {page_num}; "
                        "pagination complete"
                    )
                    break

                # Safety cap — High Museum has ~6-8 pages; stop at 15
                if page_num > 15:
                    logger.warning("Hit pagination safety cap at page 15")
                    break

            # ----------------------------------------------------------------
            # 2. Exhibitions page
            # ----------------------------------------------------------------
            ex_found, ex_new, ex_updated = _crawl_exhibitions(
                page, source_id, venue_id, seen_events,
                exhibition_envelope, portal_id,
            )
            events_found += ex_found
            events_new += ex_new
            events_updated += ex_updated

            browser.close()

        # Persist exhibitions collected during this crawl
        if exhibition_envelope.exhibitions:
            persist_result = persist_typed_entity_envelope(exhibition_envelope)
            skipped = persist_result.skipped.get("exhibitions", 0)
            if skipped:
                logger.warning("High Museum: skipped %d exhibition rows", skipped)

        # Minimum-event validation: the High Museum always has many concurrent programs
        if events_found < 15:
            logger.warning(
                f"High Museum: only {events_found} events found — expected 15+. "
                "Site structure may have changed or pagination is broken."
            )

        logger.info(
            f"High Museum crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl High Museum: {e}")
        raise

    return events_found, events_new, events_updated
