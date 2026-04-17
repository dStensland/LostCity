"""
Crawler for North Georgia State Fair (northgeorgiastatefair.com).

Annual fair in Marietta featuring demolition derby, monster trucks, rides, and concerts.
Site uses Wix platform — requires Playwright for JavaScript rendering.

Shape D (fairgrounds): one seasonal exhibition carries the 11-day fair window;
dated programming events (concerts, derbies, monster trucks, etc.) link back via
`events.exhibition_id`. No season-window pseudo-event is emitted.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from db.exhibitions import insert_exhibition
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.northgeorgiastatefair.com"
BIGTICKETS_URL = "https://www.bigtickets.com/e/northgeorgiastatefair/"

# The North Georgia State Fair "place" is the seasonal fair brand located at
# Jim R. Miller Park in Marietta. Jim R. Miller Park is a separate, year-round
# place record (see sources/all_star_monster_trucks.py) that hosts other
# programming (monster truck shows, gun shows). This record covers only the
# annual 11-day fair and only exists during the season window.
PLACE_DATA = {
    "name": "North Georgia State Fair",
    "slug": "north-georgia-state-fair",
    "address": "2245 Callaway Rd SW",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30008",
    "lat": 33.9271,
    "lng": -84.5868,
    "place_type": "event_space",
    "spot_type": "event_space",
    "is_seasonal_only": True,
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '7:00 PM', '7 PM', '7pm'."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) if match.group(2) else "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def categorize_event(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """
    Determine category, subcategory, and tags based on event title and description.

    Returns:
        (category, subcategory, tags)
    """
    title_lower = title.lower()
    desc_lower = description.lower()
    combined = f"{title_lower} {desc_lower}"

    # Demolition Derby
    if any(term in combined for term in ["demo derby", "demolition derby", "demo-derby"]):
        return "sports", "demolition_derby", [
            "north-georgia-state-fair", "fair", "marietta", "demo-derby",
            "demolition-derby", "motorsports"
        ]

    # Monster Trucks
    if any(term in combined for term in ["monster truck", "truckfest", "truck show"]):
        return "sports", "monster_trucks", [
            "north-georgia-state-fair", "fair", "marietta", "monster-trucks",
            "motorsports"
        ]

    # Concert/Music
    if any(term in combined for term in ["concert", "live music", "band", "performance"]):
        return "music", "concert", [
            "north-georgia-state-fair", "fair", "marietta", "concert", "live-music"
        ]

    # Default to family fair event
    return "family", "fair", [
        "north-georgia-state-fair", "fair", "marietta", "family", "rides"
    ]


# ── Fair-window parsing ───────────────────────────────────────────────────────


_MONTH_TO_NUM: dict[str, int] = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def _parse_fair_window(body_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract the fair's opening/closing dates from the main site body text.
    Returns (start_date, end_date) as YYYY-MM-DD strings or (None, None) on miss.

    North Georgia State Fair runs late-September into early October — site
    advertises patterns like "September 24-October 4, 2026" (cross-month) or
    "September 18-28, 2025" (same-month). Both must match.
    """
    # Cross-month range first: "September 24-October4, 2026" /
    # "September 24th - October 4th, 2026"
    # (Accept optional whitespace inside the second-month segment because the
    # site occasionally renders "October4" without a space.)
    cross_month = re.search(
        r"(September|Sept)\s+(\d{1,2})(?:st|nd|rd|th)?"
        r"\s*[-–—]\s*"
        r"(September|Sept|October|Oct)\s*(\d{1,2})(?:st|nd|rd|th)?"
        r"(?:,?\s+(\d{4}))?",
        body_text,
        re.IGNORECASE,
    )
    if cross_month:
        start_month = _MONTH_TO_NUM[cross_month.group(1).lower()]
        start_day = int(cross_month.group(2))
        end_month = _MONTH_TO_NUM[cross_month.group(3).lower()]
        end_day = int(cross_month.group(4))
        year = int(cross_month.group(5)) if cross_month.group(5) else datetime.now().year
    else:
        # Same-month fallback: "September 18-28, 2025"
        same_month = re.search(
            r"(September|Sept)\s+(\d{1,2})(?:st|nd|rd|th)?"
            r"\s*[-–—]\s*"
            r"(\d{1,2})(?:st|nd|rd|th)?"
            r"(?:,?\s+(\d{4}))?",
            body_text,
            re.IGNORECASE,
        )
        if not same_month:
            return None, None
        start_month = end_month = 9
        start_day = int(same_month.group(2))
        end_day = int(same_month.group(3))
        year = int(same_month.group(4)) if same_month.group(4) else datetime.now().year

    try:
        start_dt = datetime(year, start_month, start_day)
        end_dt = datetime(year, end_month, end_day)
    except ValueError:
        return None, None

    # If both dates are already in the past, project to next year.
    today = datetime.now().date()
    if end_dt.date() < today:
        try:
            start_dt = datetime(year + 1, start_month, start_day)
            end_dt = datetime(year + 1, end_month, end_day)
        except ValueError:
            return None, None

    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def create_fair_exhibition(
    source_id: int,
    venue_id: int,
    fair_start: str,
    fair_end: str,
    year: str,
) -> Optional[str]:
    """
    Upsert the seasonal exhibition for a given fair year. Returns the
    exhibition UUID (or None on dry-run / failure).

    The exhibition carries the 11-day fair window (opening_date/closing_date)
    and the fair's daily operating schedule. Dated programming events link
    back via events.exhibition_id.
    """
    slug = f"north-georgia-state-fair-{year}"
    exhibition_data = {
        "slug": slug,
        "place_id": venue_id,
        "source_id": source_id,
        "title": f"North Georgia State Fair {year}",
        "description": (
            "Annual 11-day state fair at Jim R. Miller Park in Marietta. "
            "Features a midway with rides and games, livestock and agricultural "
            "exhibits, fair food, nightly concerts, demolition derby, monster "
            "trucks, and motor drome shows. Hosted by the North Georgia State "
            "Fair Association."
        ),
        "opening_date": fair_start,
        "closing_date": fair_end,
        "exhibition_type": "seasonal",
        "admission_type": "ticketed",
        "admission_url": BIGTICKETS_URL,
        "source_url": BASE_URL,
        # Ground-truthed from the fair's published calendar: weeknights gates
        # open 4pm (close 11pm), Fri extended to midnight, Sat opens early at
        # 10am (close midnight), Sun opens 10am (close 11pm). Per-date
        # overrides (e.g. mid-fair special hours) can be layered on if the
        # site publishes them; we keep the default day-of-week pattern here.
        "operating_schedule": {
            "default_hours": {"open": "16:00", "close": "23:00"},
            "days": {
                "monday": {"open": "16:00", "close": "23:00"},
                "tuesday": {"open": "16:00", "close": "23:00"},
                "wednesday": {"open": "16:00", "close": "23:00"},
                "thursday": {"open": "16:00", "close": "23:00"},
                "friday": {"open": "16:00", "close": "00:00"},
                "saturday": {"open": "10:00", "close": "00:00"},
                "sunday": {"open": "10:00", "close": "23:00"},
            },
            "overrides": {},
        },
        "tags": [
            "seasonal",
            "fairgrounds",
            "family-friendly",
            "ticketed",
            "north-georgia-state-fair",
            "fair",
            "marietta",
        ],
    }

    exhibition_id = insert_exhibition(exhibition_data)
    if exhibition_id:
        logger.info(
            f"North Georgia State Fair: upserted {year} exhibition "
            f"({fair_start} to {fair_end}, id={exhibition_id})"
        )
    return exhibition_id


def _emit_bigtickets_events(
    page,
    source_id: int,
    venue_id: int,
    exhibition_id: Optional[str],
) -> tuple[int, int, int]:
    """
    Navigate to BigTickets and emit dated child events (concerts, derbies,
    monster trucks, etc.). Each event is linked to the parent fair
    exhibition via events.exhibition_id.

    Returns (found, new, updated). Failures are logged and treated as 0s.
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    logger.info(f"Checking BigTickets: {BIGTICKETS_URL}")

    try:
        page.goto(BIGTICKETS_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        event_links = soup.find_all("a", href=re.compile(r"/events/"))

        for link in event_links:
            title = link.get_text(strip=True)

            # Skip navigation/header items
            if not title or len(title) < 5:
                continue
            if any(skip in title.lower() for skip in ["buy tickets", "view all", "more events"]):
                continue

            event_url = link.get("href")
            if event_url and not event_url.startswith("http"):
                event_url = f"https://www.bigtickets.com{event_url}"

            # Try to find date information near the link
            parent = link.find_parent()
            date_text = parent.get_text() if parent else ""

            date_match = re.search(
                r"(January|February|March|April|May|June|July|August|September|"
                r"October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|"
                r"Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                date_text,
                re.IGNORECASE,
            )
            if not date_match:
                continue

            month = date_match.group(1)
            day = date_match.group(2)
            year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

            try:
                month_map = {
                    "jan": 1, "january": 1,
                    "feb": 2, "february": 2,
                    "mar": 3, "march": 3,
                    "apr": 4, "april": 4,
                    "may": 5,
                    "jun": 6, "june": 6,
                    "jul": 7, "july": 7,
                    "aug": 8, "august": 8,
                    "sep": 9, "september": 9,
                    "oct": 10, "october": 10,
                    "nov": 11, "november": 11,
                    "dec": 12, "december": 12,
                }
                month_num = month_map.get(month.lower()[:3])
                dt = datetime(int(year), month_num, int(day))

                # If date is in the past, assume next year
                if dt.date() < datetime.now().date():
                    dt = datetime(int(year) + 1, month_num, int(day))

                start_date = dt.strftime("%Y-%m-%d")

            except (ValueError, KeyError):
                logger.debug(f"Could not parse date: {month} {day} {year}")
                continue

            start_time = parse_time(date_text)

            events_found += 1

            content_hash = generate_content_hash(title, "North Georgia State Fair", start_date)
            category, subcategory, tags = categorize_event(title, "")

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "exhibition_id": exhibition_id,
                "title": title,
                "description": f"Event at North Georgia State Fair - {title}",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_url if event_url else BIGTICKETS_URL,
                "ticket_url": event_url if event_url else BIGTICKETS_URL,
                "image_url": None,
                "raw_text": f"{title} - {date_text[:200]}",
                "extraction_confidence": 0.75,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(
                    f"North Georgia State Fair: added '{title}' on {start_date} "
                    f"(exhibition_id={exhibition_id})"
                )
            except Exception as e:
                logger.error(f"Failed to insert: {title}: {e}")

    except Exception as e:
        logger.warning(f"BigTickets fetch failed: {e}")

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl North Georgia State Fair as Shape D.

    Strategy:
      1. Upsert the place (is_seasonal_only=True).
      2. Parse the fair's 11-day window from the main site body text.
      3. Upsert one seasonal exhibition carrying that window + operating
         schedule. The exhibition — not a pseudo-event — represents the
         season.
      4. Emit dated child events from BigTickets (concerts, derbies,
         monster trucks), each linked to the exhibition via
         events.exhibition_id.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)

            # ── 1. Always hit the main site first to parse the fair window ──
            # This runs even if BigTickets succeeds — the exhibition row
            # needs fair_start / fair_end regardless of child-event sourcing.
            fair_start: Optional[str] = None
            fair_end: Optional[str] = None
            try:
                logger.info(f"Fetching main site for fair window: {BASE_URL}")
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load all content (Wix lazy-loads)
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                body_text = page.inner_text("body")
                fair_start, fair_end = _parse_fair_window(body_text)
            except Exception as e:
                logger.warning(f"Failed to parse fair window from main site: {e}")

            # ── 2. Create seasonal exhibition (carries the fair window) ──
            exhibition_id: Optional[str] = None
            exhibition_attempted = False
            if fair_start and fair_end:
                exhibition_attempted = True
                year = fair_start[:4]
                try:
                    exhibition_id = create_fair_exhibition(
                        source_id, venue_id, fair_start, fair_end, year
                    )
                except Exception as e:
                    logger.error(
                        f"North Georgia State Fair: error creating exhibition: {e}"
                    )
            else:
                logger.warning(
                    "North Georgia State Fair: could not derive fair window from "
                    "main site; child events will be emitted without exhibition linkage"
                )

            # ── 3. Dated child events from BigTickets ──
            try:
                f, n, u = _emit_bigtickets_events(
                    page, source_id, venue_id, exhibition_id
                )
                events_found += f
                events_new += n
                events_updated += u
            except Exception as e:
                logger.error(f"North Georgia State Fair: BigTickets emit failed: {e}")

            browser.close()

        exhibition_status = (
            "upserted" if exhibition_id
            else ("dry-run/skipped" if exhibition_attempted else "not-attempted")
        )
        logger.info(
            f"North Georgia State Fair crawl complete: "
            f"exhibition={exhibition_status}, "
            f"{events_found} child events found, {events_new} new, "
            f"{events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl North Georgia State Fair: {e}")
        raise

    return events_found, events_new, events_updated
