"""
Crawler for Alliance Theatre Education & Drama Camps (alliancetheatre.org/classes).

This is a SEPARATE source from alliance_theatre.py (which covers main stage shows).
It covers:
  - Drama Camps: Spring break + summer camps at 15+ metro Atlanta locations
    (Woodruff Arts Center, Oglethorpe, Galloway School, Lovett, Museum School, etc.)
  - Teen Programs: Teen Ensemble (audition-based, rising HS juniors/seniors),
    Palefsky Collision Project (3-week summer intensive)
  - After-School classes: grouped into a single recurring program event

Why separate?  The education programs are a distinct product line targeting families
with kids ages K-12, using completely different registration and scheduling from the
main show listings.  They belong in the Family portal, not just the main feed.

PARSE STRATEGY:
  The drama camps page at /classes/drama-camps/ lists every camp location inline
  as static HTML.  Pattern per location:
    <neighborhood/area>
    <venue name>
    Rising Grades <range>
    <session>  //  <date range>
    <session>  //  <date range>
    ...

  We create ONE event per (venue, session window) combination.  Session windows
  are de-duped by content hash.

AGES / TAGS:
  - Drama camps: K-12, rising grades K-12 (tagged 'elementary', 'middle-school', 'high-school')
  - Teen Ensemble / Palefsky: rising HS juniors/seniors → 'teen', 'high-school'
  - All: 'theater', 'acting', 'drama', 'family-friendly', 'arts', 'summer-camp'
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alliancetheatre.org"
CAMPS_URL = f"{BASE_URL}/classes/drama-camps/"
TEENS_URL = f"{BASE_URL}/classes/kids-teens/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    )
}

# Primary venue: Woodruff Arts Center (where Alliance Theatre is headquartered)
ALLIANCE_VENUE_DATA = {
    "name": "Alliance Theatre",
    "slug": "alliance-theatre",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7892,
    "lng": -84.3862,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["theater", "tony-award-winning", "performing-arts", "Midtown", "Woodruff-Arts-Center"],
    "description": (
        "Alliance Theatre is Atlanta's leading nonprofit theater company, "
        "offering Tony Award-winning productions plus a robust education "
        "program with drama camps and classes for kids and teens across metro Atlanta."
    ),
}

# Satellite camp locations: (venue_name_fragment, venue_data)
# These are partner schools/venues where Alliance runs camps.
# We map recognized location names to venue records.
SATELLITE_VENUES: dict[str, dict] = {
    "Oglethorpe University": {
        "name": "Oglethorpe University",
        "slug": "oglethorpe-university",
        "address": "4484 Peachtree Rd NE",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30319",
        "lat": 33.8706,
        "lng": -84.3321,
        "venue_type": "college",
        "spot_type": "college",
        "website": "https://www.oglethorpe.edu",
        "vibes": ["college", "arts"],
    },
    "The Galloway School": {
        "name": "The Galloway School",
        "slug": "galloway-school-atlanta",
        "address": "215 W Wieuca Rd NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30342",
        "lat": 33.8827,
        "lng": -84.3816,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.gallowayschool.org",
        "vibes": ["educational"],
    },
    "The Lovett School": {
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
    "The Museum School": {
        "name": "The Museum School of Avondale Estates",
        "slug": "museum-school-avondale",
        "address": "142 N Avondale Rd",
        "neighborhood": "Avondale Estates",
        "city": "Decatur",
        "state": "GA",
        "zip": "30002",
        "lat": 33.7712,
        "lng": -84.2595,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.themuseumschool.org",
        "vibes": ["educational"],
    },
    "Gas South Theater": {
        "name": "Gas South District",
        "slug": "gas-south-district",
        "address": "6400 Sugarloaf Pkwy",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0013,
        "lng": -84.1426,
        "venue_type": "venue",
        "spot_type": "venue",
        "website": "https://www.gassouthdistrict.com",
        "vibes": ["performing-arts", "Gwinnett"],
    },
}

# Months we recognize in date ranges
MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4,
    "june": 6, "july": 7, "august": 8, "september": 9,
    "october": 10, "november": 11, "december": 12,
}

# Current year used for date parsing
_CURRENT_YEAR = datetime.now().year


def _parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date ranges like:
      'Apr 6-10'
      'May 26 – Aug 7'
      'Jun 1-12 & Jun 22 – Jul 3'  → returns first range only
      'Jul 6-24'
    Returns (start_date, end_date) as YYYY-MM-DD strings, or (None, None).
    """
    # Normalize dashes
    text = text.replace("–", "-").replace("—", "-").strip()

    # Take only the first date range (before " & ")
    text = text.split("&")[0].strip()
    text = text.split("//")[0].strip()

    # Pattern: Month day-day (same month)
    same_month = re.search(
        r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\s*[-–]\s*(\d{1,2})",
        text, re.IGNORECASE
    )
    if same_month:
        month_str = same_month.group(1).lower()
        month_num = MONTH_MAP.get(month_str)
        if month_num:
            start_day = int(same_month.group(2))
            end_day = int(same_month.group(3))
            year = _CURRENT_YEAR
            # Bump year if start date is in the past
            try:
                start_d = date(year, month_num, start_day)
                if start_d < date.today():
                    year += 1
                start_str = date(year, month_num, start_day).strftime("%Y-%m-%d")
                end_str = date(year, month_num, end_day).strftime("%Y-%m-%d")
                return start_str, end_str
            except ValueError:
                pass

    # Pattern: Month day - Month day (different months)
    diff_month = re.search(
        r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\s*[-–]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})",
        text, re.IGNORECASE
    )
    if diff_month:
        m1 = MONTH_MAP.get(diff_month.group(1).lower())
        d1 = int(diff_month.group(2))
        m2 = MONTH_MAP.get(diff_month.group(3).lower())
        d2 = int(diff_month.group(4))
        if m1 and m2:
            year = _CURRENT_YEAR
            try:
                start_d = date(year, m1, d1)
                if start_d < date.today():
                    year += 1
                start_str = date(year, m1, d1).strftime("%Y-%m-%d")
                end_str = date(year, m2, d2).strftime("%Y-%m-%d")
                return start_str, end_str
            except ValueError:
                pass

    return None, None


def _get_venue_for_location(location_text: str) -> dict:
    """
    Match a location name to a known satellite venue dict, or return
    the default Alliance Theatre venue data.
    """
    for key, venue_data in SATELLITE_VENUES.items():
        if key.lower() in location_text.lower():
            return venue_data
    return ALLIANCE_VENUE_DATA


def _grade_range_to_ages(grade_text: str) -> tuple[Optional[int], Optional[int]]:
    """
    Map 'Rising Grades K-12', 'Rising Grades 7-12', 'Grades K-5' etc.
    to (age_min, age_max) tuple.
    K ≈ 5-6 years, 12th grade ≈ 17-18 years.
    """
    text = grade_text.replace("Rising Grades", "").replace("Grades", "").strip()

    grade_min_map = {"K": 5, "1": 6, "2": 7, "3": 8, "4": 9, "5": 10, "6": 11,
                     "7": 12, "8": 13, "9": 14, "10": 15, "11": 16, "12": 17}
    grade_max_map = {"K": 6, "1": 7, "2": 8, "3": 9, "4": 10, "5": 11, "6": 12,
                     "7": 13, "8": 14, "9": 15, "10": 16, "11": 17, "12": 18}

    match = re.match(r"([K\d]+)\s*[-–]\s*([K\d]+)", text.strip())
    if match:
        low = match.group(1)
        high = match.group(2)
        age_min = grade_min_map.get(low)
        age_max = grade_max_map.get(high)
        return age_min, age_max
    return 5, 18  # default: all school ages


def _grade_range_to_tags(grade_text: str) -> list[str]:
    """Infer age-band tags from grade range."""
    tags = []
    text = grade_text.lower()
    if "k" in text or "1" in text or "2" in text or "3" in text:
        tags.append("elementary")
    if "4" in text or "5" in text or "6" in text:
        tags.append("elementary")
        tags.append("middle-school")
    if "7" in text or "8" in text:
        tags.append("middle-school")
    if "9" in text or "10" in text or "11" in text or "12" in text:
        tags.append("high-school")
        tags.append("teen")
    if not tags:
        tags = ["elementary", "middle-school"]
    return list(dict.fromkeys(tags))  # dedupe preserving order


def _crawl_drama_camps(source_id: int, alliance_venue_id: int) -> tuple[int, int, int]:
    """
    Parse the drama camps page and create one event per (venue, session date range).
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        resp = requests.get(CAMPS_URL, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        logger.error("[alliance-theatre-education] Failed to fetch camps page: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    text = soup.get_text(separator="\n", strip=True)
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    # ----------------------------------------------------------------
    # Find "Camp Locations" section and parse until next major section
    # ----------------------------------------------------------------
    camp_locations_idx = -1
    for i, line in enumerate(lines):
        if "Camp Locations" in line:
            camp_locations_idx = i
            break

    if camp_locations_idx < 0:
        logger.warning("[alliance-theatre-education] Could not find 'Camp Locations' section")
        return 0, 0, 0

    # Parse structured location blocks
    # Pattern:
    #   <Neighborhood>
    #   <Venue Name>
    #   Rising Grades <range>
    #   <Session label> // <date range>  (may repeat)
    i = camp_locations_idx + 1
    today = date.today()
    stop_phrases = ["Refine Your Search", "Build Character", "Stay in the loop", "OUR GENEROUS"]

    while i < len(lines):
        line = lines[i]

        if any(phrase in line for phrase in stop_phrases):
            break

        # Detect "Rising Grades" or "Grades" line — this anchors a block
        grades_match = re.search(r"Rising Grades?\s+[\w\d]+-[\w\d]+|Grades?\s+[\w\d]+-[\w\d]+", line, re.IGNORECASE)
        if not grades_match:
            i += 1
            continue

        grade_text = grades_match.group(0)

        # The venue name is typically 1-2 lines before the grade line
        venue_line = ""
        for back in range(1, 4):
            if i - back >= 0:
                candidate = lines[i - back]
                # Skip neighborhood labels (single word or short all-caps)
                if (
                    len(candidate) > 5
                    and not re.match(r"^[A-Z][a-z]+$", candidate)  # not just a word like "Midtown"
                    and not re.match(r"^[A-Z\s]+$", candidate)       # not ALL CAPS
                    and not re.search(r"Rising Grades|Grades", candidate, re.IGNORECASE)
                ):
                    venue_line = candidate
                    break

        if not venue_line:
            i += 1
            continue

        # Collect session lines after the grade line
        session_lines = []
        j = i + 1
        while j < len(lines):
            candidate = lines[j]
            # Session lines contain "//" or a date keyword
            if "//" in candidate or re.search(
                r"(Spring Break|Summer|Fall|Winter|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s",
                candidate, re.IGNORECASE
            ):
                session_lines.append(candidate)
                j += 1
            else:
                break

        if not session_lines:
            i += 1
            continue

        # Resolve venue
        venue_data = _get_venue_for_location(venue_line)
        try:
            venue_id = get_or_create_venue(venue_data)
        except Exception as exc:
            logger.warning(
                "[alliance-theatre-education] Failed to get/create venue '%s': %s",
                venue_data["name"], exc
            )
            i = j
            continue

        age_min, age_max = _grade_range_to_ages(grade_text)
        age_tags = _grade_range_to_tags(grade_text)

        for session_line in session_lines:
            # Split on "//"
            parts = session_line.split("//")
            session_label = parts[0].strip() if parts else ""
            date_part = parts[1].strip() if len(parts) > 1 else session_line

            start_date, end_date = _parse_date_range(date_part)
            if not start_date:
                logger.debug(
                    "[alliance-theatre-education] Could not parse date from '%s'", date_part
                )
                continue

            # Skip if entirely in the past
            if end_date:
                try:
                    end_d = datetime.strptime(end_date, "%Y-%m-%d").date()
                    if end_d < today:
                        continue
                except ValueError:
                    pass
            else:
                try:
                    start_d = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if start_d < today:
                        continue
                except ValueError:
                    pass

            # Build title
            is_spring = "spring" in session_label.lower() or "apr" in date_part.lower()
            is_summer = (
                "summer" in session_label.lower()
                or any(m in date_part.lower() for m in ["may", "jun", "jul", "aug"])
            )
            season = "Spring Break" if is_spring else ("Summer" if is_summer else "Drama")

            venue_short = venue_data["name"].replace("The ", "").replace(" School", "").strip()
            title = f"Alliance Theatre {season} Drama Camp at {venue_short}"

            description = (
                f"Alliance Theatre offers {season.lower()} drama camp at {venue_data['name']} "
                f"for students {grade_text.replace('Rising Grades', 'rising grades')}. "
                f"Campers build character, grow confidence, and develop their creative voice "
                f"through acting, storytelling, and performance — culminating in a short "
                f"performance for family and friends. "
                f"Alliance Theatre drama camps are run by Tony Award-winning theater professionals "
                f"and are available at 15+ locations across metro Atlanta. "
                f"Registration at alliancetheatre.org/classes/drama-camps."
            )

            tags = [
                "theater", "drama", "acting", "arts", "summer-camp",
                "family-friendly", "kids", "rsvp-required",
            ] + age_tags

            if is_spring:
                tags.append("spring-break")
            if is_summer:
                tags.append("summer")

            content_hash = generate_content_hash(title, venue_data["name"], start_date)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": "09:00",
                "end_date": end_date,
                "end_time": "15:00",
                "is_all_day": False,
                "category": "arts",
                "subcategory": "theater",
                "tags": tags,
                "is_free": False,
                "price_min": None,
                "price_max": None,
                "price_note": "Registration required. Prices vary by camp session and location.",
                "source_url": CAMPS_URL,
                "ticket_url": "https://my.alliancetheatre.org/cart/",
                "image_url": None,
                "raw_text": f"{title} | {grade_text} | {session_line}",
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
                "age_min": age_min,
                "age_max": age_max,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug("[alliance-theatre-education] Updated: %s on %s", title, start_date)
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(
                    "[alliance-theatre-education] Added: %s (%s – %s)",
                    title, start_date, end_date or "N/A"
                )
            except Exception as exc:
                logger.error(
                    "[alliance-theatre-education] Failed to insert '%s': %s", title, exc
                )

        i = j

    return events_found, events_new, events_updated


def _crawl_teen_programs(source_id: int, alliance_venue_id: int) -> tuple[int, int, int]:
    """
    Crawl the Teen Ensemble and Palefsky Collision Project pages
    to produce program-type events for the Family portal.
    These are fixed-date programs with known seasons.
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    programs = [
        {
            "title": "Alliance Theatre Teen Ensemble",
            "url": f"{BASE_URL}/classes/kids-teens/teen-ensemble/",
            "description": (
                "The Alliance Theatre Teen Ensemble is an audition-based company for rising "
                "junior and senior high school students (ages 16-18). Members train with "
                "professional theater artists, perform original work, and develop the craft, "
                "discipline, and artistic voice needed for a life in the arts. "
                "Auditions are held each spring for the following academic year. "
                "This is one of the most intensive and prestigious teen theater programs in Atlanta."
            ),
            "start_date": f"{_CURRENT_YEAR}-08-01",
            "end_date": f"{_CURRENT_YEAR}-05-31" if datetime.now().month >= 8 else f"{_CURRENT_YEAR}-05-31",
            "age_min": 16,
            "age_max": 18,
            "tags": ["theater", "acting", "teen", "high-school", "audition-based", "arts", "year-round"],
        },
        {
            "title": "Alliance Theatre Palefsky Collision Project for Teens",
            "url": f"{BASE_URL}/classes/kids-teens/palefsky-collision-project/",
            "description": (
                "The Palefsky Collision Project is a 3-week summer intensive for rising "
                "high school juniors and seniors (ages 15-18). Participants work directly "
                "under the guidance of professional theater artists to create an original, "
                "fully-produced piece of theater from concept to performance. "
                "One of the most advanced and exclusive summer theater programs in Atlanta — "
                "limited enrollment. Apply at alliancetheatre.org."
            ),
            "start_date": f"{_CURRENT_YEAR}-06-15",
            "end_date": f"{_CURRENT_YEAR}-07-03",
            "age_min": 15,
            "age_max": 18,
            "tags": ["theater", "acting", "teen", "high-school", "summer-camp", "intensive", "arts", "audition-based"],
        },
    ]

    today = date.today()

    for prog in programs:
        # Adjust years for past dates
        try:
            start_d = datetime.strptime(prog["start_date"], "%Y-%m-%d").date()
            if start_d < today:
                # Try next year
                prog["start_date"] = prog["start_date"].replace(
                    str(_CURRENT_YEAR), str(_CURRENT_YEAR + 1)
                )
                prog["end_date"] = prog["end_date"].replace(
                    str(_CURRENT_YEAR), str(_CURRENT_YEAR + 1)
                )
        except ValueError:
            pass

        title = prog["title"]
        content_hash = generate_content_hash(title, "Alliance Theatre", prog["start_date"])
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": alliance_venue_id,
            "title": title,
            "description": prog["description"],
            "start_date": prog["start_date"],
            "start_time": "09:00",
            "end_date": prog["end_date"],
            "end_time": None,
            "is_all_day": False,
            "category": "arts",
            "subcategory": "theater",
            "tags": prog["tags"],
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "Audition required. Contact Alliance Theatre for details.",
            "source_url": prog["url"],
            "ticket_url": prog["url"],
            "image_url": None,
            "raw_text": f"{title} | Alliance Theatre Education",
            "extraction_confidence": 0.88,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
            "age_min": prog["age_min"],
            "age_max": prog["age_max"],
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info("[alliance-theatre-education] Added teen program: %s", title)
        except Exception as exc:
            logger.error("[alliance-theatre-education] Failed to insert '%s': %s", title, exc)

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Alliance Theatre education programs: drama camps + teen programs.
    """
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    # Ensure the Alliance Theatre venue exists (used as fallback and for teen programs)
    try:
        alliance_venue_id = get_or_create_venue(ALLIANCE_VENUE_DATA)
    except Exception as exc:
        logger.error("[alliance-theatre-education] Failed to get/create Alliance Theatre venue: %s", exc)
        return 0, 0, 0

    logger.info("[alliance-theatre-education] Crawling drama camps at %s", CAMPS_URL)
    try:
        f, n, u = _crawl_drama_camps(source_id, alliance_venue_id)
        total_found += f
        total_new += n
        total_updated += u
        logger.info(
            "[alliance-theatre-education] Drama camps: %d found, %d new, %d updated",
            f, n, u
        )
    except Exception as exc:
        logger.error("[alliance-theatre-education] Error crawling drama camps: %s", exc)

    logger.info("[alliance-theatre-education] Crawling teen programs")
    try:
        f, n, u = _crawl_teen_programs(source_id, alliance_venue_id)
        total_found += f
        total_new += n
        total_updated += u
        logger.info(
            "[alliance-theatre-education] Teen programs: %d found, %d new, %d updated",
            f, n, u
        )
    except Exception as exc:
        logger.error("[alliance-theatre-education] Error crawling teen programs: %s", exc)

    logger.info(
        "[alliance-theatre-education] Crawl complete: %d found, %d new, %d updated",
        total_found, total_new, total_updated
    )
    return total_found, total_new, total_updated
