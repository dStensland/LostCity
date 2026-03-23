"""
Crawler for Junior Achievement of Georgia — Homeschool Days.

Junior Achievement of Georgia operates JA Discovery Centers across the state
with immersive economic simulations:
  - JA BizTown: 6th-grade-level business/economy simulation (ages ~10-12)
  - JA Finance Park: 7th-8th-grade-level personal finance simulation (ages ~12-15)

The Homeschool Days program opens these simulations to homeschool families on
specific dates throughout the year. Dates are listed on the public homeschool
page at: https://www.georgia.ja.org/homeschool

ATLANTA LOCATION (primary):
  JA Chick-fil-A Discovery Center
  275 Northside Drive NW, Building C, 3rd Floor
  Atlanta, GA 30314

Other locations:
  - Cumming (Forsyth): Mike & Lynn Cottrell JA Discovery Center
  - Lawrenceville (Gwinnett): JA Discovery Center of Gwinnett
  - Morrow (Clayton County): JA Delta Discovery Center
  (Dalton, Evans, Savannah are out of Atlanta metro scope)

CRAWL STRATEGY:
  Fetch the homeschool page (static HTML), parse the accordion blocks
  that list dates per location. Each date gets one event per program type
  (BizTown or Finance Park, or both if combined).

TARGET: Family portal — teen-gap content (ages 10-15, middle school focus).
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

HOMESCHOOL_URL = "https://www.georgia.ja.org/homeschool"
JA_BASE_URL = "https://www.georgia.ja.org"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    )
}

# Atlanta-metro JA Discovery Centers
# Only include locations within a reasonable drive of Atlanta
LOCATIONS: dict[str, dict] = {
    "Atlanta": {
        "venue_data": {
            "name": "JA Chick-fil-A Discovery Center Atlanta",
            "slug": "ja-discovery-center-atlanta",
            "address": "275 Northside Dr NW Building C 3rd Floor",
            "neighborhood": "Vine City",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30314",
            "lat": 33.7667,
            "lng": -84.4004,
            "venue_type": "organization",
            "spot_type": "organization",
            "website": JA_BASE_URL,
            "vibes": ["educational", "stem", "financial-literacy", "civic", "family-friendly"],
            "description": (
                "The JA Chick-fil-A Discovery Center in Atlanta houses both JA BizTown "
                "and JA Finance Park — immersive learning environments where students "
                "run simulated businesses and manage household budgets. The Atlanta center "
                "serves over 40% of Georgia middle school students each year."
            ),
        },
        "register_url": f"{JA_BASE_URL}/homeschool",
        "in_metro": True,
    },
    "Cumming": {
        "venue_data": {
            "name": "Mike & Lynn Cottrell JA Discovery Center of North Georgia",
            "slug": "ja-discovery-center-north-georgia-cumming",
            "address": "1150 Lanier 400 Pkwy",
            "neighborhood": "Cumming",
            "city": "Cumming",
            "state": "GA",
            "zip": "30040",
            "lat": 34.1875,
            "lng": -84.1421,
            "venue_type": "organization",
            "spot_type": "organization",
            "website": JA_BASE_URL,
            "vibes": ["educational", "stem", "financial-literacy", "family-friendly"],
        },
        "register_url": f"{JA_BASE_URL}/homeschool",
        "in_metro": True,
    },
    "Lawrenceville": {
        "venue_data": {
            "name": "JA Discovery Center of Gwinnett",
            "slug": "ja-discovery-center-gwinnett",
            "address": "1333 Old Norcross Rd",
            "neighborhood": "Lawrenceville",
            "city": "Lawrenceville",
            "state": "GA",
            "zip": "30046",
            "lat": 33.9360,
            "lng": -83.9890,
            "venue_type": "organization",
            "spot_type": "organization",
            "website": JA_BASE_URL,
            "vibes": ["educational", "stem", "financial-literacy", "family-friendly"],
        },
        "register_url": f"{JA_BASE_URL}/homeschool",
        "in_metro": True,
    },
    "Morrow": {
        "venue_data": {
            "name": "JA Delta Discovery Center of Clayton County",
            "slug": "ja-discovery-center-clayton-county",
            "address": "7000 Lake Harbor Dr",
            "neighborhood": "Morrow",
            "city": "Morrow",
            "state": "GA",
            "zip": "30260",
            "lat": 33.5831,
            "lng": -84.3415,
            "venue_type": "organization",
            "spot_type": "organization",
            "website": JA_BASE_URL,
            "vibes": ["educational", "stem", "financial-literacy", "family-friendly"],
        },
        "register_url": f"{JA_BASE_URL}/homeschool",
        "in_metro": True,
    },
}

# Locations outside Atlanta metro — skip these
OUT_OF_METRO = {"Dalton", "Evans", "Savannah"}

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

_CURRENT_YEAR = datetime.now().year


def _parse_date_str(date_str: str) -> Optional[str]:
    """
    Parse date strings like:
      'October 14, 2025'
      'April 27, 2026'
      'April 27, 2026: JA BizTown'  (inline program type — strip after colon)
    Returns YYYY-MM-DD or None.
    """
    date_str = date_str.strip()
    # Strip trailing colon or anything after colon (e.g. ': JA BizTown')
    # Use regex to extract just the 'Month DD, YYYY' portion
    m = re.match(
        r"(January|February|March|April|May|June|July|August|September|"
        r"October|November|December)\s+(\d{1,2})[,\s]+(\d{4})",
        date_str, re.IGNORECASE
    )
    if m:
        clean = f"{m.group(1)} {m.group(2)}, {m.group(3)}"
        try:
            return datetime.strptime(clean, "%B %d, %Y").strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _build_event_record(
    source_id: int,
    venue_id: int,
    event_date: str,
    program_type: str,  # "biztown", "financepark", or "both"
    location_name: str,
    register_url: str,
) -> dict:
    """Build an event record for a JA Homeschool Day."""
    if program_type == "both":
        title = f"JA Homeschool Day: BizTown & Finance Park — {location_name}"
        description = (
            f"Junior Achievement of Georgia is hosting a combined JA BizTown and "
            f"JA Finance Park Homeschool Day at the {location_name} Discovery Center. "
            f"JA BizTown immerses students ages 10-12 in a simulated economy where "
            f"they run businesses, earn paychecks, and experience civic life. "
            f"JA Finance Park assigns students ages 12-15 a life situation and household "
            f"budget to manage across realistic storefronts. "
            f"Sessions run 10:00 AM – 2:00 PM. Register at georgia.ja.org/homeschool."
        )
        age_min, age_max = 10, 15
        tags = [
            "educational", "stem", "financial-literacy", "homeschool",
            "middle-school", "teen", "civic", "family-friendly", "rsvp-required",
        ]
    elif program_type == "biztown":
        title = f"JA BizTown Homeschool Day — {location_name}"
        description = (
            f"Junior Achievement of Georgia is hosting a JA BizTown Homeschool Day "
            f"at the {location_name} Discovery Center. "
            f"Students ages 10-12 interact within a simulated economy — running a business, "
            f"earning a paycheck, paying taxes, and voting for elected officials. "
            f"After classroom curriculum on the circular flow of the economy, students spend "
            f"the day as workers and citizens in JA BizTown's immersive storefronts. "
            f"Sessions run 10:00 AM – 2:00 PM. Register at georgia.ja.org/homeschool."
        )
        age_min, age_max = 10, 12
        tags = [
            "educational", "stem", "business", "economics", "homeschool",
            "middle-school", "civic", "family-friendly", "rsvp-required",
        ]
    else:  # financepark
        title = f"JA Finance Park Homeschool Day — {location_name}"
        description = (
            f"Junior Achievement of Georgia is hosting a JA Finance Park Homeschool Day "
            f"at the {location_name} Discovery Center. "
            f"Students ages 12-15 are assigned a 'life situation' with an education level, "
            f"salary, and family scenario, then visit storefronts representing housing, "
            f"utilities, food, and other budget line items to practice real-world financial decisions. "
            f"Sessions run 10:00 AM – 2:00 PM. Register at georgia.ja.org/homeschool."
        )
        age_min, age_max = 12, 15
        tags = [
            "educational", "stem", "financial-literacy", "homeschool",
            "middle-school", "teen", "civic", "family-friendly", "rsvp-required",
        ]

    content_hash = generate_content_hash(title, location_name, event_date)

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": event_date,
        "start_time": "10:00",
        "end_date": event_date,
        "end_time": "14:00",
        "is_all_day": False,
        "category": "education",
        "subcategory": "stem",
        "tags": tags,
        "is_free": False,
        "price_min": None,
        "price_max": None,
        "price_note": "Registration required. Contact homeschool@georgia.ja.org for pricing.",
        "source_url": HOMESCHOOL_URL,
        "ticket_url": register_url,
        "image_url": None,
        "raw_text": f"{title} | {event_date}",
        "extraction_confidence": 0.90,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
        "age_min": age_min,
        "age_max": age_max,
    }


def _parse_location_block(block_text: str, location_name: str) -> list[dict]:
    """
    Parse the content of a location block to extract (date, program_type) pairs.
    Block text looks like:
      'October 14, 2025:\nJA BizTown & JA Finance Park\nRegister'
      'April 27, 2026: JA BizTown\nRegister\nApril 28, 2026: JA Finance Park\nRegister'
    """
    results = []
    today = date.today()

    # Split into lines and look for date + program type pairs
    lines = [ln.strip() for ln in block_text.split("\n") if ln.strip()]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for a line that starts with a month name (date line)
        date_match = re.match(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)"
            r"\s+\d{1,2}[,\s]+20\d\d",
            line, re.IGNORECASE
        )
        if not date_match:
            i += 1
            continue

        # Extract the date part (before the colon)
        date_part = re.sub(r":\s*$", "", line).strip()
        event_date = _parse_date_str(date_part)
        if not event_date:
            i += 1
            continue

        # Skip past events (allow 1 day grace for same-day events)
        try:
            event_d = datetime.strptime(event_date, "%Y-%m-%d").date()
            if event_d < today:
                i += 1
                continue
        except ValueError:
            i += 1
            continue

        # Determine program type from this line or next line.
        # The program type may appear:
        #   - After a colon on the same line: 'April 27, 2026: JA BizTown'
        #   - On the next line:               'October 14, 2025:\nJA BizTown & JA Finance Park'
        combined = line
        if i + 1 < len(lines):
            combined += " " + lines[i + 1]
        combined = combined.lower()

        has_biztown = "biztown" in combined
        has_finance = "finance park" in combined

        if has_biztown and has_finance:
            program_type = "both"
        elif has_biztown:
            program_type = "biztown"
        elif has_finance:
            program_type = "financepark"
        else:
            program_type = "both"  # fallback: show as combined

        results.append((event_date, program_type))
        i += 1

    return results


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Junior Achievement of Georgia homeschool days.
    """
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    # Fetch the homeschool page
    try:
        resp = requests.get(HOMESCHOOL_URL, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        logger.error("[ja-georgia] Failed to fetch homeschool page: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    full_text = soup.get_text(separator="\n", strip=True)
    lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]

    # ----------------------------------------------------------------
    # Parse location blocks from the page text.
    # The structure is:
    #   <Location Name>
    #   <Address>
    #   <Date>: <Program Type>
    #   Register
    #   ...
    # ----------------------------------------------------------------
    today = date.today()

    # Find the section with "Multiple locations are available" or similar
    # Then parse each location block
    location_blocks: dict[str, list[str]] = {}  # location_name -> relevant lines

    current_location: Optional[str] = None
    for line in lines:
        # Detect location headers
        for loc_name in LOCATIONS:
            if loc_name in line and current_location != loc_name:
                # Check it's a location header (short line or address-like)
                if len(line) < 80:
                    current_location = loc_name
                    if loc_name not in location_blocks:
                        location_blocks[loc_name] = []
                    break

        # Skip out-of-metro
        skip = False
        for oom in OUT_OF_METRO:
            if oom in line and len(line) < 80:
                current_location = None
                skip = True
                break

        if skip:
            continue

        if current_location and current_location in location_blocks:
            location_blocks[current_location].append(line)

    logger.info("[ja-georgia] Found location blocks: %s", list(location_blocks.keys()))

    for location_name, block_lines in location_blocks.items():
        if location_name in OUT_OF_METRO:
            continue

        loc_config = LOCATIONS.get(location_name)
        if not loc_config:
            logger.warning("[ja-georgia] No config for location '%s'", location_name)
            continue

        # Ensure venue exists
        try:
            venue_id = get_or_create_venue(loc_config["venue_data"])
        except Exception as exc:
            logger.error("[ja-georgia] Failed to create venue for '%s': %s", location_name, exc)
            continue

        block_text = "\n".join(block_lines)
        event_pairs = _parse_location_block(block_text, location_name)

        if not event_pairs:
            logger.warning("[ja-georgia] No future events found for '%s'", location_name)
            continue

        for event_date, program_type in event_pairs:
            event_record = _build_event_record(
                source_id=source_id,
                venue_id=venue_id,
                event_date=event_date,
                program_type=program_type,
                location_name=location_name,
                register_url=loc_config["register_url"],
            )
            total_found += 1

            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                smart_update_existing_event(existing, event_record)
                total_updated += 1
                logger.debug(
                    "[ja-georgia] Updated: %s on %s", event_record["title"], event_date
                )
                continue

            try:
                insert_event(event_record)
                total_new += 1
                logger.info(
                    "[ja-georgia] Added: %s (%s)", event_record["title"], event_date
                )
            except Exception as exc:
                logger.error(
                    "[ja-georgia] Failed to insert '%s': %s", event_record["title"], exc
                )

    logger.info(
        "[ja-georgia] Crawl complete: %d found, %d new, %d updated",
        total_found, total_new, total_updated
    )
    return total_found, total_new, total_updated
