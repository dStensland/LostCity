"""
Crawler for Geeks Who Drink pub quiz nights in the Atlanta metro area.

Geeks Who Drink runs weekly pub quiz nights at bars and restaurants across
the US. Schedule data is loaded dynamically via JavaScript on their website,
so this crawler uses Playwright to fetch a live nonce, then hits the
admin-ajax.php endpoint to retrieve rendered venue HTML for the Atlanta area.

Falls back to a curated static list of known Atlanta-area GWD venues if the
dynamic fetch fails or returns no results.

WEEKS_AHEAD = 6
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import (
    get_or_create_place,
    insert_event,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# How many weeks ahead to generate recurring events
WEEKS_AHEAD = 6

# Day-of-week codes for recurrence rules (0=Monday)
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Atlanta metro bounding box passed to the GWD map search
# Covers Atlanta, Decatur, Sandy Springs, Brookhaven, Dunwoody, Smyrna,
# Marietta, Roswell, Alpharetta, Kennesaw, Woodstock, Norcross, etc.
ATLANTA_SEARCH = {
    "search": "Atlanta, GA",
    "startLat": "33.749",
    "startLong": "-84.388",
    # Top-left / bottom-right map coords (wide enough to cover metro)
    "tlCoord": "34.15,-84.90",
    "brCoord": "33.45,-83.95",
    "tlMapCoord": "34.15,-84.90",
    "brMapCoord": "33.45,-83.95",
    "searchInit": "1",
    "days": "",
    "brands": "gwd",
    "hasAll": "false",
}

# Atlanta metro cities to keep (case-insensitive match against parsed city field)
ATLANTA_CITIES = {
    "atlanta",
    "decatur",
    "marietta",
    "roswell",
    "alpharetta",
    "sandy springs",
    "brookhaven",
    "dunwoody",
    "smyrna",
    "kennesaw",
    "woodstock",
    "norcross",
    "peachtree city",
    "lawrenceville",
    "johns creek",
    "milton",
    "cumming",
    "tucker",
    "stone mountain",
    "clarkston",
    "avondale estates",
    "mableton",
    "austell",
    "powder springs",
    "acworth",
    "east point",
    "college park",
    "forest park",
    "union city",
    "fayetteville",
    "peachtree corners",
    "duluth",
    "suwanee",
    "buford",
    "gainesville",
    "conyers",
    "mcdonough",
    "stockbridge",
    "canton",
}

# ============================================================================
# STATIC FALLBACK: Known Atlanta-area GWD venues
# Verified from geekswhodrink.com/venues as of 2026-02.
# Used when the live scrape returns no results.
# Keep this list updated as venues are added/removed.
# ============================================================================

STATIC_VENUES = [
    {
        "name": "Manuel's Tavern",
        "slug": "manuels-tavern",
        "address": "602 N Highland Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        "website": "https://manuelstavern.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 1,  # Tuesday
        "start_time": "20:00",
    },
    {
        "name": "Wrecking Bar Brewpub",
        "slug": "wrecking-bar-brewpub",
        "address": "292 Moreland Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "brewery",
        "website": "https://wreckingbarbrewpub.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 2,  # Wednesday
        "start_time": "20:00",
    },
    {
        "name": "Brick Store Pub",
        "slug": "brick-store-pub",
        "address": "125 E Court Square",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "bar",
        "website": "https://brickstorepub.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 0,  # Monday
        "start_time": "20:00",
    },
    {
        "name": "Twain's Billiards & Tap",
        "slug": "twains-billiards-tap",
        "address": "211 E Trinity Pl",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "bar",
        "website": "https://twains.net",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 1,  # Tuesday
        "start_time": "20:00",
    },
    {
        "name": "Thinking Man Tavern",
        "slug": "thinking-man-tavern",
        "address": "537 W Howard Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "bar",
        "website": "https://thinkingmantavern.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 3,  # Thursday
        "start_time": "19:00",
    },
    {
        "name": "Righteous Room",
        "slug": "righteous-room",
        "address": "1051 Ponce De Leon Ave NE",
        "neighborhood": "Virginia Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        "website": "https://righteousroom.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 2,  # Wednesday
        "start_time": "20:00",
    },
    {
        "name": "The Porter Beer Bar",
        "slug": "the-porter-beer-bar",
        "address": "1156 Euclid Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bar",
        "website": "https://theporterbeerbar.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 0,  # Monday
        "start_time": "20:00",
    },
    {
        "name": "Max Lager's American Grill & Brewery",
        "slug": "max-lagers",
        "address": "320 Peachtree St NE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "brewery",
        "website": "https://maxlagers.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 1,  # Tuesday
        "start_time": "20:00",
    },
    {
        "name": "Argosy",
        "slug": "argosy-east-atlanta",
        "address": "470 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://argosybar.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 3,  # Thursday
        "start_time": "20:00",
    },
    {
        "name": "Mary's Bar",
        "slug": "marys-bar-atlanta",
        "address": "1287 Glenwood Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://facebook.com/marysatl",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 2,  # Wednesday
        "start_time": "20:00",
    },
    {
        "name": "Monday Night Garage",
        "slug": "monday-night-garage",
        "address": "933 Lee St SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "venue_type": "brewery",
        "website": "https://mondaynightbrewing.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 1,  # Tuesday
        "start_time": "19:00",
    },
    {
        "name": "Ormsby's",
        "slug": "ormsbys",
        "address": "1170 Howell Mill Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "bar",
        "website": "https://ormsbysatl.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 3,  # Thursday
        "start_time": "20:00",
    },
    {
        "name": "The Local",
        "slug": "the-local-ponce-city-market",
        "address": "675 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "bar",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 2,  # Wednesday
        "start_time": "20:00",
    },
    {
        "name": "Mellow Mushroom - Ponce de Leon",
        "slug": "mellow-mushroom-ponce",
        "address": "931 Monroe Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "restaurant",
        "website": "https://mellowmushroom.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 2,  # Wednesday
        "start_time": "19:30",
    },
    {
        "name": "Gordon Biersch Brewery Restaurant",
        "slug": "gordon-biersch-atlanta",
        "address": "848 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "brewery",
        "website": "https://gordonbiersch.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 0,  # Monday
        "start_time": "19:30",
    },
    {
        "name": "Taco Mac - Buckhead",
        "slug": "taco-mac-buckhead",
        "address": "3125 Piedmont Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "restaurant",
        "website": "https://tacomac.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 3,  # Thursday
        "start_time": "19:30",
    },
    {
        "name": "Der Biergarten",
        "slug": "der-biergarten-atlanta",
        "address": "300 Marietta St NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "bar",
        "website": "https://derbiergarten.com",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 1,  # Tuesday
        "start_time": "20:00",
    },
    {
        "name": "Arm & Hammer Pub",
        "slug": "arm-hammer-pub",
        "address": "5370 Peachtree Rd",
        "neighborhood": "Chamblee",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30341",
        "venue_type": "bar",
        "gwd_url": "https://www.geekswhodrink.com/venues/",
        "day": 2,  # Wednesday
        "start_time": "20:00",
    },
]

# ============================================================================
# GWD SCHEDULE PAGE URL
# ============================================================================

GWD_VENUES_URL = "https://www.geekswhodrink.com/venues/"
GWD_AJAX_URL = "https://www.geekswhodrink.com/wp-admin/admin-ajax.php"

# ============================================================================
# DAY PARSING
# ============================================================================

DAY_ABBR_MAP: dict[str, int] = {
    "mon": 0, "monday": 0,
    "tue": 1, "tues": 1, "tuesday": 1,
    "wed": 2, "wednesday": 2,
    "thu": 3, "thur": 3, "thurs": 3, "thursday": 3,
    "fri": 4, "friday": 4,
    "sat": 5, "saturday": 5,
    "sun": 6, "sunday": 6,
}

# Maps abbreviated GWD day params (from URL ?days= filter) to int
GWD_DAY_PARAM_MAP: dict[str, int] = {
    "0": 6,  # GWD Sunday = 0 in their UI
    "1": 0,  # Monday
    "2": 1,
    "3": 2,
    "4": 3,
    "5": 4,
    "6": 5,  # Saturday
}


def parse_day_of_week(text: str) -> Optional[int]:
    """Parse day-of-week from freeform text. Returns 0=Monday ... 6=Sunday."""
    text = text.strip().lower()
    # Try full/abbreviated day name
    for token, day_int in DAY_ABBR_MAP.items():
        if re.search(rf"\b{token}\b", text):
            return day_int
    return None


def parse_time_str(text: str) -> Optional[str]:
    """
    Parse a time string like '8:00 PM', '8PM', '8:30pm' → '20:00' / '20:30'.
    Returns HH:MM 24-hour string or None.
    """
    if not text:
        return None
    text = text.strip()
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", text, re.IGNORECASE)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = match.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def parse_address_parts(address_text: str) -> dict:
    """
    Parse a freeform address string into components.
    Returns dict with keys: address, city, state, zip.
    """
    result = {"address": "", "city": "", "state": "GA", "zip": ""}
    if not address_text:
        return result

    address_text = address_text.strip()

    # Pattern: "123 Main St, Atlanta, GA 30301"
    # or "123 Main St\nAtlanta, GA 30301"
    m = re.match(
        r"^(.+?),?\s*([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?$",
        address_text.replace("\n", ", "),
    )
    if m:
        result["address"] = m.group(1).strip()
        result["city"] = m.group(2).strip()
        result["state"] = m.group(3).strip()
        result["zip"] = (m.group(4) or "").strip()
        return result

    # Fallback: split on comma
    parts = [p.strip() for p in address_text.replace("\n", ",").split(",")]
    if len(parts) >= 3:
        result["address"] = parts[0]
        result["city"] = parts[1]
        state_zip = parts[2].strip()
        state_zip_m = re.match(r"([A-Z]{2})\s*(\d{5})?", state_zip)
        if state_zip_m:
            result["state"] = state_zip_m.group(1)
            result["zip"] = (state_zip_m.group(2) or "").strip()
    elif len(parts) == 2:
        result["address"] = parts[0]
        result["city"] = parts[1]
    else:
        result["address"] = address_text

    return result


# ============================================================================
# VENUE NORMALIZATION
# ============================================================================

# Order matters: longer/more-specific matches must come before shorter/generic ones
# (e.g., "brewpub" before "pub", "brewery" before "brew" then "bar")
VENUE_TYPE_HINTS: list[tuple[str, str]] = [
    # Brewery variants — check before generic "bar" / "pub"
    ("brewery", "brewery"),
    ("brewpub", "brewery"),
    ("brewing", "brewery"),
    ("brew house", "brewery"),
    ("biersch", "brewery"),
    # Specific compound keywords — check before single-word variants
    ("sports bar", "sports_bar"),
    ("biergarten", "bar"),
    # Pubs and bars
    ("pub", "bar"),
    ("tavern", "bar"),
    ("lounge", "bar"),
    ("bar", "bar"),
    # Restaurants
    ("restaurant", "restaurant"),
    ("grill", "restaurant"),
    ("kitchen", "restaurant"),
    ("diner", "restaurant"),
    ("bistro", "restaurant"),
    ("pizza", "restaurant"),
    ("mushroom", "restaurant"),
    ("taco", "restaurant"),
    # Cafes
    ("café", "cafe"),
    ("cafe", "cafe"),
    ("coffee", "cafe"),
    # Nightlife
    ("club", "nightclub"),
]


def infer_venue_type(name: str) -> str:
    """Infer venue_type from venue name. More-specific keywords are checked first."""
    name_lower = name.lower()
    for keyword, vtype in VENUE_TYPE_HINTS:
        if keyword in name_lower:
            return vtype
    return "bar"  # Default: GWD venues are almost always bars/restaurants


def slugify(text: str) -> str:
    """Create a URL-safe slug from text."""
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    return slug


# ============================================================================
# PLAYWRIGHT SCRAPING
# ============================================================================

def fetch_nonce_and_ajax(page) -> Optional[str]:
    """
    Load the GWD venues page, extract the gwdNonce from the page JS globals,
    and make the AJAX call to get rendered venue HTML for Atlanta.
    Returns the HTML string of the venue listing, or None on failure.
    """
    try:
        logger.info("Loading Geeks Who Drink venues page to extract nonce")
        page.goto(GWD_VENUES_URL, wait_until="domcontentloaded", timeout=30_000)

        # Extract the gwdNonce from the WP_URL global
        nonce = page.evaluate(
            "() => { try { return WP_URL.gwdNonce; } catch(e) { return null; } }"
        )

        if not nonce:
            logger.warning("Could not extract gwdNonce from GWD page")
            return None

        logger.info(f"Got GWD nonce: {nonce[:8]}...")

        # Build the POST body
        post_data = {
            "action": "mb_display_mapped_events",
            "nonce": nonce,
            **ATLANTA_SEARCH,
        }

        # Make the AJAX request via fetch() inside the browser context
        # so the session cookies and origin are correct
        result = page.evaluate(
            """
            async (url, data) => {
                const params = new URLSearchParams(data);
                const resp = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: params.toString(),
                    credentials: "include",
                });
                if (!resp.ok) return null;
                return await resp.text();
            }
            """,
            GWD_AJAX_URL,
            post_data,
        )

        if not result or len(result.strip()) < 50:
            logger.warning(f"AJAX response too short ({len(result or '')} bytes)")
            return None

        logger.info(f"Got AJAX response: {len(result)} bytes")
        return result

    except PlaywrightTimeout:
        logger.warning("Playwright timeout loading GWD venues page")
        return None
    except Exception as exc:
        logger.warning(f"Error fetching GWD via Playwright: {exc}")
        return None


def parse_venues_from_html(html: str) -> list[dict]:
    """
    Parse venue and schedule data from the GWD AJAX HTML response.

    The rendered HTML contains venue cards with:
      - Venue name (.find__infowindow-title or h2/h3)
      - Address (.find__infowindow-address or similar)
      - Quiz day/time in the card body text

    Returns list of dicts: {name, address, city, state, zip, day, start_time, gwd_url}
    """
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    venues = []

    # GWD renders venue cards — try multiple selector patterns
    # The rendered markup uses classes like .find__result, .venue-card, etc.
    venue_cards = (
        soup.select(".find__result")
        or soup.select(".venue-card")
        or soup.select("[data-venue]")
        or soup.select(".find__infowindow")
    )

    if not venue_cards:
        # Fallback: try to find any block that has address-like content
        logger.debug("No standard venue card selectors matched; trying generic parse")
        # Look for any element with a street address pattern
        all_text = soup.get_text(separator="\n")
        logger.debug(f"HTML sample (first 500 chars): {html[:500]}")
        return []

    logger.info(f"Found {len(venue_cards)} venue cards in AJAX response")

    for card in venue_cards:
        try:
            venue = _parse_single_card(card)
            if venue:
                venues.append(venue)
        except Exception as exc:
            logger.debug(f"Error parsing venue card: {exc}")
            continue

    return venues


def _parse_single_card(card) -> Optional[dict]:
    """Parse a single venue card element into a venue dict."""
    # Venue name
    name_el = (
        card.select_one(".find__infowindow-title")
        or card.select_one("h2")
        or card.select_one("h3")
        or card.select_one(".venue-name")
        or card.select_one("[data-venue]")
    )
    if not name_el:
        return None

    name = name_el.get_text(strip=True)
    if not name:
        return None

    # Address
    addr_el = (
        card.select_one(".find__infowindow-address")
        or card.select_one(".venue-address")
        or card.select_one(".address")
    )
    raw_address = addr_el.get_text(strip=True) if addr_el else ""
    addr_parts = parse_address_parts(raw_address)

    # Filter to Atlanta metro
    city_lower = addr_parts.get("city", "").lower().strip()
    if city_lower and city_lower not in ATLANTA_CITIES:
        logger.debug(f"Skipping non-Atlanta venue: {name} in {addr_parts.get('city')}")
        return None

    # Day and time from card text
    card_text = card.get_text(separator=" ", strip=True)
    day_int = parse_day_of_week(card_text)
    start_time = parse_time_str(card_text)

    # Venue page URL
    link_el = card.select_one("a[href*='geekswhodrink']") or card.select_one("a")
    gwd_url = link_el["href"] if link_el and link_el.get("href") else GWD_VENUES_URL

    return {
        "name": name,
        "address": addr_parts.get("address", ""),
        "city": addr_parts.get("city", ""),
        "state": addr_parts.get("state", "GA"),
        "zip": addr_parts.get("zip", ""),
        "day": day_int,
        "start_time": start_time,
        "gwd_url": gwd_url,
    }


# ============================================================================
# EVENT GENERATION
# ============================================================================

def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday (0=Monday, 6=Sunday)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def venue_dict_to_db(v: dict) -> dict:
    """Convert a scraped venue dict to a db.get_or_create_place-compatible dict."""
    venue_type = infer_venue_type(v.get("name", ""))
    slug = v.get("slug") or slugify(v["name"])
    return {
        "name": v["name"],
        "slug": slug,
        "address": v.get("address", ""),
        "city": v.get("city", "Atlanta"),
        "state": v.get("state", "GA"),
        "zip": v.get("zip", ""),
        "neighborhood": v.get("neighborhood", ""),
        "venue_type": venue_type,
        "spot_type": venue_type,
        "website": v.get("website", ""),
    }


def generate_events_for_venue(
    place_data: dict,
    source_id: int,
    today: datetime,
) -> tuple[int, int, int]:
    """
    Generate up to WEEKS_AHEAD events for a single venue/day combo.
    Returns (found, new, updated).
    """
    day_int = place_data.get("day")
    if day_int is None:
        logger.debug(f"No day-of-week for venue {place_data['name']}, skipping")
        return 0, 0, 0

    start_time = place_data.get("start_time") or "20:00"
    gwd_url = place_data.get("gwd_url") or GWD_VENUES_URL

    venue_name = place_data["name"]
    day_name = DAY_NAMES[day_int]
    day_code = DAY_CODES[day_int]

    venue_db = venue_dict_to_db(place_data)
    venue_id = get_or_create_place(venue_db)

    next_date = get_next_weekday(today, day_int)

    found = new = updated = 0

    series_hint = {
        "series_type": "recurring_show",
        "series_title": "Geeks Who Drink Pub Quiz",
        "frequency": "weekly",
        "day_of_week": day_name,
        "description": (
            f"Weekly Geeks Who Drink pub quiz night at {venue_name}. "
            f"Free to play — show up with a team of up to 6 and test your knowledge. "
            f"Quiz starts at {start_time.replace(':', '') if start_time else '8PM'}."
        ),
    }

    for week in range(WEEKS_AHEAD):
        event_date = next_date + timedelta(weeks=week)
        start_date = event_date.strftime("%Y-%m-%d")

        found += 1

        content_hash = generate_content_hash(
            "Geeks Who Drink Pub Quiz",
            venue_name,
            start_date,
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": "Geeks Who Drink Pub Quiz",
            "description": (
                f"Weekly Geeks Who Drink pub quiz night at {venue_name}. "
                f"Free to play — bring a team of up to 6 people and compete across "
                f"8 rounds of trivia covering pop culture, history, science, sports, "
                f"music, and more. Hosted by a live quizmaster. No registration required."
            ),
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "nightlife",
            "subcategory": "nightlife.trivia",
            "tags": ["trivia", "games", "nightlife", "weekly", "geeks-who-drink"],
            "is_free": True,
            "price_min": None,
            "price_max": None,
            "price_note": "Free to play",
            "source_url": gwd_url,
            "ticket_url": None,
            "image_url": None,
            "raw_text": f"Geeks Who Drink Pub Quiz at {venue_name} - {start_date}",
            "extraction_confidence": 0.92,
            "is_recurring": True,
            "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
            continue

        try:
            insert_event(event_record, series_hint=series_hint, genres=["trivia"])
            new += 1
            logger.debug(
                f"Added: Geeks Who Drink Pub Quiz at {venue_name} on {start_date}"
            )
        except Exception as exc:
            logger.error(
                f"Failed to insert GWD event at {venue_name} on {start_date}: {exc}"
            )

    return found, new, updated


# ============================================================================
# MAIN CRAWL FUNCTION
# ============================================================================

def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Geeks Who Drink pub quiz schedule for the Atlanta metro area.

    Strategy:
    1. Use Playwright to load the GWD venues page and extract a live session nonce.
    2. Make the AJAX call (mb_display_mapped_events) with Atlanta bounding box.
    3. Parse venue name, address, day, time from the rendered HTML.
    4. Fall back to STATIC_VENUES if live scrape returns 0 venues.
    5. Generate 6 weeks of recurring events per venue.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    logger.info("Starting Geeks Who Drink crawler for Atlanta metro")

    # ------------------------------------------------------------------
    # Step 1: Try live scrape via Playwright
    # ------------------------------------------------------------------
    live_venues: list[dict] = []

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

            ajax_html = fetch_nonce_and_ajax(page)

            browser.close()

        if ajax_html:
            parsed = parse_venues_from_html(ajax_html)
            # Only keep venues with a parseable day
            live_venues = [v for v in parsed if v.get("day") is not None]
            logger.info(
                f"Live scrape returned {len(parsed)} venues, "
                f"{len(live_venues)} with parseable schedule"
            )

    except Exception as exc:
        logger.warning(f"Playwright scrape failed entirely: {exc}")

    # ------------------------------------------------------------------
    # Step 2: Decide which venue list to use
    # ------------------------------------------------------------------
    if live_venues:
        venues_to_process = live_venues
        logger.info(f"Using {len(venues_to_process)} live-scraped GWD venues")
    else:
        venues_to_process = STATIC_VENUES
        logger.info(
            f"Live scrape yielded 0 usable venues; "
            f"falling back to {len(venues_to_process)} static venues"
        )

    # ------------------------------------------------------------------
    # Step 3: Generate events
    # ------------------------------------------------------------------
    for place_data in venues_to_process:
        try:
            f, n, u = generate_events_for_venue(place_data, source_id, today)
            events_found += f
            events_new += n
            events_updated += u
        except Exception as exc:
            logger.error(
                f"Unhandled error generating events for {place_data.get('name', '?')}: {exc}"
            )

    logger.info(
        f"Geeks Who Drink crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
