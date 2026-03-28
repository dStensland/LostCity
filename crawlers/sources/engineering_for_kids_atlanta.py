"""
Crawler for Engineering For Kids of North Atlanta.

Engineering For Kids (EFK) is a STEM enrichment franchise serving kids ages 4-14
with hands-on engineering programs. The North Atlanta franchise (engineeringforkids.com/north-atlanta)
offers programs across multiple host venues in the Atlanta metro area.

REGISTRATION PLATFORM: Amilia (app.amilia.com)
  Store URL: https://app.amilia.com/store/en/engineering-for-kids-of-north-atlanta/shop/programs

CRAWL STRATEGY:
  1. Load the Amilia store listing page (requires Playwright — JavaScript SPA).
  2. For each program link found, load the detail page to extract:
     - Camp name, venue/location
     - Session date ranges (from description text)
     - Age range (from title: "Ages X - Y" or grade range)
     - Price
  3. Create one event per camp WEEK (not one per program) where dates are listed.
  4. Create one enrollment-call-to-action event per after-school class program.

We do NOT crawl birthday parties or birthday party programs.

VENUE NOTES:
  Programs run at partner host venues around North Atlanta. We look up or create
  a venue record for each unique host location. EFK itself does not have a
  physical storefront — the address 'Atlanta, GA 30326' in their listing is a
  franchise mailing address, not a visitor location.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

STORE_URL = "https://app.amilia.com/store/en/engineering-for-kids-of-north-atlanta/shop/programs"
EFK_WEBSITE = "https://www.engineeringforkids.com/north-atlanta/"

# Amilia base for building detail URLs
AMILIA_BASE = "https://app.amilia.com"

# Franchise venue (used as fallback when host venue can't be resolved)
EFK_VENUE_DATA = {
    "name": "Engineering For Kids of North Atlanta",
    "slug": "engineering-for-kids-north-atlanta",
    "address": "3500 Peachtree Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30326",
    "lat": 33.8481,
    "lng": -84.3638,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": EFK_WEBSITE,
    "vibes": ["stem", "educational", "kids", "family-friendly", "hands-on"],
    "description": (
        "Engineering For Kids of North Atlanta delivers Cognia STEM Certified and STEM.org "
        "Accredited programs for children ages 4-14 at school and community venues across "
        "North Atlanta. Programs include after-school classes, summer camps, and birthday parties "
        "covering engineering disciplines from robotics to aerospace to electrical engineering."
    ),
}

# Known host venues: (name_fragment.lower()) → place_data
# We match these against the program description to pick the right venue.
HOST_VENUES: dict[str, dict] = {
    "dinodash": {
        "name": "DinoDash",
        "slug": "dinodash-peachtree-corners",
        "address": "6315 Spalding Dr Suite C",
        "neighborhood": "Peachtree Corners",
        "city": "Peachtree Corners",
        "state": "GA",
        "zip": "30092",
        "lat": 33.9622,
        "lng": -84.2227,
        "venue_type": "attraction",
        "spot_type": "attraction",
        "website": "https://www.dinodashkids.com",
        "vibes": ["family-friendly", "kids", "indoor"],
    },
    "hippoh": {
        "name": "HippoHopp",
        "slug": "hippohopp-atlanta",
        "address": "4920 Roswell Rd NE Suite 24",
        "neighborhood": "Sandy Springs",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30342",
        "lat": 33.9029,
        "lng": -84.3712,
        "venue_type": "attraction",
        "spot_type": "attraction",
        "website": "https://www.hippohopp.com",
        "vibes": ["family-friendly", "kids", "indoor"],
    },
    "holy innocents": {
        "name": "Holy Innocents' Episcopal School",
        "slug": "holy-innocents-episcopal-school",
        "address": "805 Mount Vernon Hwy",
        "neighborhood": "Sandy Springs",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30327",
        "lat": 33.8960,
        "lng": -84.4095,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.hies.org",
        "vibes": ["educational"],
    },
    "lovett": {
        "name": "The Lovett School",
        "slug": "lovett-school-atlanta",
        "address": "4075 Paces Ferry Rd NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30327",
        "lat": 33.8611,
        "lng": -84.4471,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.lovett.org",
        "vibes": ["educational"],
    },
    "christ the king": {
        "name": "Christ the King School",
        "slug": "christ-the-king-school-atlanta",
        "address": "60 Peachtree Way NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8315,
        "lng": -84.3774,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://ctkschool.org",
        "vibes": ["educational"],
    },
    "hope-hill": {
        "name": "Hope-Hill Elementary School",
        "slug": "hope-hill-elementary-atlanta",
        "address": "1-99 Hope Hill Dr NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7619,
        "lng": -84.3585,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.atlanta.k12.ga.us",
        "vibes": ["educational"],
    },
    "bolton": {
        "name": "Bolton Academy",
        "slug": "bolton-academy-atlanta",
        "address": "3372 Howell Mill Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30327",
        "lat": 33.8105,
        "lng": -84.4231,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.atlanta.k12.ga.us",
        "vibes": ["educational"],
    },
}

# Regex for session date ranges in description text
# Matches patterns like: "June 1 - June 5, 9 AM - 3 PM" or "June 8 - June 12"
DATE_RANGE_PATTERN = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2})\s*[-–]\s*"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)?"
    r"\s*(\d{1,2})",
    re.IGNORECASE
)

MONTH_NUM = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}

# Session time pattern: "9 AM - 3 PM"
TIME_PATTERN = re.compile(r"(\d{1,2})\s*(AM|PM)\s*[-–]\s*(\d{1,2})\s*(AM|PM)", re.IGNORECASE)

# Age range from title: "Ages 5 - 10" or "Ages X-Y"
AGE_PATTERN = re.compile(r"Ages?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})", re.IGNORECASE)

# Camp week pattern: "Camp Week N: <name> (Dates)"
CAMP_WEEK_PATTERN = re.compile(
    r"Camp Week\s+\d+:\s*([^\(]+)\s*\(([^)]+)\)",
    re.IGNORECASE
)

# Skip birthday / party programs
SKIP_KEYWORDS = ["birthday", "party activities"]

_CURRENT_YEAR = datetime.now().year


def _parse_time_12h(hour: int, ampm: str) -> str:
    """Convert 12-hour time to HH:MM."""
    ampm = ampm.upper()
    if ampm == "PM" and hour != 12:
        hour += 12
    elif ampm == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:00"


def _parse_date(month_str: str, day: int, reference_month: Optional[int] = None) -> Optional[str]:
    """Parse a month name + day to YYYY-MM-DD string."""
    month_num = MONTH_NUM.get(month_str.lower())
    if not month_num:
        return None
    year = _CURRENT_YEAR
    try:
        d = date(year, month_num, day)
        if d < date.today() - timedelta(days=30):
            year += 1
            d = date(year, month_num, day)
        return d.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _extract_sessions_from_text(description: str) -> list[dict]:
    """
    Extract individual camp week sessions from description text.
    Returns list of dicts with: title, start_date, end_date, start_time, end_time.
    """
    sessions = []

    # Try structured "Camp Week N: <name> (Dates, Times)" pattern
    for m in CAMP_WEEK_PATTERN.finditer(description):
        week_name = m.group(1).strip()
        date_time_str = m.group(2).strip()

        # Extract dates from the parenthetical
        date_match = DATE_RANGE_PATTERN.search(date_time_str)
        if not date_match:
            continue

        start_month = date_match.group(1)
        start_day = int(date_match.group(2))
        end_month = date_match.group(3) or start_month
        end_day = int(date_match.group(4))

        start_date = _parse_date(start_month, start_day)
        end_date = _parse_date(end_month, end_day)

        if not start_date:
            continue

        # Extract times
        start_time = "09:00"
        end_time = "15:00"
        time_match = TIME_PATTERN.search(date_time_str)
        if time_match:
            start_time = _parse_time_12h(int(time_match.group(1)), time_match.group(2))
            end_time = _parse_time_12h(int(time_match.group(3)), time_match.group(4))

        sessions.append({
            "week_name": week_name,
            "start_date": start_date,
            "end_date": end_date,
            "start_time": start_time,
            "end_time": end_time,
        })

    return sessions


def _extract_price(description: str) -> Optional[float]:
    """Extract price per week from description."""
    price_match = re.search(r"\$(\d{2,4})\s*(?:per week|/week|each)", description, re.IGNORECASE)
    if price_match:
        return float(price_match.group(1))
    return None


def _resolve_venue(program_title: str, description: str) -> dict:
    """Resolve host venue from program title or description text."""
    combined = (program_title + " " + description).lower()
    for key, place_data in HOST_VENUES.items():
        if key.lower() in combined:
            return place_data
    return EFK_VENUE_DATA


def _extract_age_range(program_title: str) -> tuple[Optional[int], Optional[int]]:
    """Extract age range from program title like 'Summer Camps at DinoDash (Ages 5 - 10)'."""
    m = AGE_PATTERN.search(program_title)
    if m:
        return int(m.group(1)), int(m.group(2))
    # Grade ranges
    if "pre-k" in program_title.lower() or "pk" in program_title.lower():
        return 4, 6
    if "k - 5" in program_title.lower() or "k-5" in program_title.lower():
        return 5, 11
    if "k - 6" in program_title.lower() or "k-6" in program_title.lower():
        return 5, 12
    if "k - 3" in program_title.lower() or "k-3" in program_title.lower():
        return 5, 9
    return 4, 14  # EFK default: ages 4-14


def _crawl_program_detail(page: Page, program_url: str) -> Optional[dict]:
    """Load a single program detail page and extract structured data."""
    try:
        page.goto(program_url, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)
        text = page.inner_text("body")
        return {"url": program_url, "text": text}
    except Exception as exc:
        logger.warning("[efk-atlanta] Failed to load program detail %s: %s", program_url, exc)
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Engineering For Kids North Atlanta programs via Amilia store.
    """
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    try:
        efk_venue_id = get_or_create_place(EFK_VENUE_DATA)
    except Exception as exc:
        logger.error("[efk-atlanta] Failed to get/create EFK venue: %s", exc)
        return 0, 0, 0

    today = date.today()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            logger.info("[efk-atlanta] Loading Amilia store: %s", STORE_URL)
            page.goto(STORE_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Collect all program links
            html = page.content()
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")

            program_links: list[tuple[str, str]] = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                title = a.get_text(strip=True)
                # Program links follow pattern: /store/en/<org>/shop/programs/<id>
                if re.search(r"/shop/programs/\d+", href) and title:
                    full_url = href if href.startswith("http") else f"{AMILIA_BASE}{href}"
                    program_links.append((title, full_url))

            logger.info("[efk-atlanta] Found %d program links", len(program_links))

            for program_title, program_url in program_links:
                # Skip birthday/party programs
                if any(kw in program_title.lower() for kw in SKIP_KEYWORDS):
                    logger.debug("[efk-atlanta] Skipping: %s", program_title)
                    continue

                is_summer_camp = "summer camp" in program_title.lower()
                is_after_school = "after-school" in program_title.lower() or "winter after-school" in program_title.lower()

                detail = _crawl_program_detail(page, program_url)
                if not detail:
                    continue

                description_text = detail["text"]
                place_data = _resolve_venue(program_title, description_text)
                age_min, age_max = _extract_age_range(program_title)
                price_per_week = _extract_price(description_text)

                try:
                    venue_id = get_or_create_place(place_data)
                except Exception as exc:
                    logger.warning("[efk-atlanta] Venue create failed for '%s': %s", place_data["name"], exc)
                    venue_id = efk_venue_id

                # ----------------------------------------------------------------
                # SUMMER CAMPS: create one event per camp week
                # ----------------------------------------------------------------
                if is_summer_camp:
                    sessions = _extract_sessions_from_text(description_text)
                    if not sessions:
                        # Fallback: create a single event for the program with rough dates
                        logger.warning(
                            "[efk-atlanta] No week-by-week sessions found for '%s' — skipping",
                            program_title
                        )
                        continue

                    for session in sessions:
                        start_date = session["start_date"]
                        end_date = session["end_date"]

                        # Skip past sessions
                        try:
                            if end_date:
                                end_d = datetime.strptime(end_date, "%Y-%m-%d").date()
                                if end_d < today:
                                    continue
                            else:
                                start_d = datetime.strptime(start_date, "%Y-%m-%d").date()
                                if start_d < today:
                                    continue
                        except ValueError:
                            pass

                        week_name = session["week_name"]
                        # Clean up venue name for title
                        venue_short = place_data["name"].replace("The ", "")
                        title = f"Engineering For Kids: {week_name} Camp at {venue_short}"

                        description = (
                            f"Engineering For Kids of North Atlanta is offering a 5-day STEM "
                            f"summer camp at {place_data['name']}. "
                            f"Theme: {week_name}. "
                            f"Hands-on engineering projects, Cognia STEM Certified curriculum, "
                            f"designed for ages {age_min}–{age_max}. "
                            f"Daily schedule: {session['start_time']}–{session['end_time']}. "
                            f"{'Price: $' + str(int(price_per_week)) + '/week. ' if price_per_week else ''}"
                            f"Early bird discount available with early registration. "
                            f"Register at app.amilia.com/store/en/engineering-for-kids-of-north-atlanta."
                        )

                        tags = [
                            "stem", "engineering", "summer-camp", "kids",
                            "educational", "hands-on", "rsvp-required",
                            "family-friendly",
                        ]
                        if age_min and age_min <= 6:
                            tags.append("preschool")
                        if age_min and age_min <= 10:
                            tags.append("elementary")
                        if age_max and age_max >= 11:
                            tags.append("middle-school")

                        content_hash = generate_content_hash(title, place_data["name"], start_date)
                        total_found += 1

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": session["start_time"],
                            "end_date": end_date,
                            "end_time": session["end_time"],
                            "is_all_day": False,
                            "category": "education",
                            "subcategory": "stem",
                            "tags": tags,
                            "is_free": False,
                            "price_min": price_per_week,
                            "price_max": price_per_week,
                            "price_note": (
                                f"${int(price_per_week)}/week. Early bird 10% off if registered by May 31."
                                if price_per_week else "Registration required. Prices vary."
                            ),
                            "source_url": program_url,
                            "ticket_url": program_url,
                            "image_url": None,
                            "raw_text": f"{program_title} | {week_name} | {start_date}",
                            "extraction_confidence": 0.88,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                            "age_min": age_min,
                            "age_max": age_max,
                        }

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            total_updated += 1
                            logger.debug("[efk-atlanta] Updated: %s on %s", title, start_date)
                            continue

                        try:
                            insert_event(event_record)
                            total_new += 1
                            logger.info(
                                "[efk-atlanta] Added: %s (%s – %s)",
                                title, start_date, end_date or "N/A"
                            )
                        except Exception as exc:
                            logger.error("[efk-atlanta] Insert failed for '%s': %s", title, exc)

                # ----------------------------------------------------------------
                # AFTER-SCHOOL CLASSES: create one event for the program window
                # ----------------------------------------------------------------
                elif is_after_school:
                    # Skip programs that explicitly reference a past year (e.g. "2025")
                    if "2025" in description_text and "2026" not in description_text:
                        logger.debug("[efk-atlanta] Skipping past after-school program (2025): %s", program_title)
                        continue

                    # Extract date range from text
                    date_match = DATE_RANGE_PATTERN.search(description_text)
                    if not date_match:
                        logger.debug("[efk-atlanta] No dates found for after-school: %s", program_title)
                        continue

                    start_month = date_match.group(1)
                    start_day = int(date_match.group(2))
                    end_month = date_match.group(3) or start_month
                    end_day = int(date_match.group(4))

                    start_date = _parse_date(start_month, start_day)
                    end_date = _parse_date(end_month, end_day)

                    if not start_date:
                        continue

                    # Skip if parsed date is more than 270 days out (matches db.py validation
                    # threshold). After-school classes with Jan/Feb dates get bumped to next
                    # year by _parse_date, producing ~285-day-out dates for Spring 2026 classes
                    # whose sessions have already started — we skip rather than inserting a
                    # date that db.py would reject anyway.
                    try:
                        start_d = datetime.strptime(start_date, "%Y-%m-%d").date()
                        if (start_d - today).days > 270:
                            logger.debug(
                                "[efk-atlanta] Skipping after-school — date %s too far out: %s",
                                start_date, program_title
                            )
                            continue
                    except ValueError:
                        pass

                    venue_short = place_data["name"].replace("The ", "")
                    # Clean up title for display
                    clean_title = re.sub(r"\s*\(.*?\)", "", program_title).strip()
                    title = f"Engineering For Kids: {clean_title}"

                    description = (
                        f"Engineering For Kids of North Atlanta is offering an after-school "
                        f"engineering class at {place_data['name']} for students in grades "
                        f"ages {age_min}–{age_max}. "
                        f"Each session features hands-on STEM projects aligned with Georgia "
                        f"academic standards. Cognia STEM Certified and STEM.org Accredited. "
                        f"Register at app.amilia.com/store/en/engineering-for-kids-of-north-atlanta."
                    )

                    tags = [
                        "stem", "engineering", "after-school", "class",
                        "educational", "hands-on", "rsvp-required",
                        "family-friendly", "kids",
                    ]
                    if age_min and age_min <= 6:
                        tags.append("preschool")
                    if age_min and age_min <= 10:
                        tags.append("elementary")

                    content_hash = generate_content_hash(title, place_data["name"], start_date)
                    total_found += 1

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "education",
                        "subcategory": "stem",
                        "tags": tags,
                        "is_free": False,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Registration required. Prices vary by session.",
                        "source_url": program_url,
                        "ticket_url": program_url,
                        "image_url": None,
                        "raw_text": f"{program_title}",
                        "extraction_confidence": 0.82,
                        "is_recurring": True,
                        "recurrence_rule": "FREQ=WEEKLY",
                        "content_hash": content_hash,
                        "age_min": age_min,
                        "age_max": age_max,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        total_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        total_new += 1
                        logger.info("[efk-atlanta] Added after-school: %s (%s)", title, start_date)
                    except Exception as exc:
                        logger.error("[efk-atlanta] Insert failed for '%s': %s", title, exc)

            browser.close()

    except Exception as exc:
        logger.error("[efk-atlanta] Crawl failed: %s", exc)
        raise

    logger.info(
        "[efk-atlanta] Crawl complete: %d found, %d new, %d updated",
        total_found, total_new, total_updated
    )
    return total_found, total_new, total_updated
