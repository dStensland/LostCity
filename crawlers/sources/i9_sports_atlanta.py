"""
Crawler for i9 Sports Atlanta-area youth leagues and camps.

i9 Sports is a national youth sports franchise with 10+ Atlanta-area franchises
covering flag football, soccer, basketball, baseball, volleyball, and more.
Programs serve ages 3-14 across the metro.

Data source:
  Sitemap: https://www.i9sports.com/sitemap.xml
  Program pages: https://www.i9sports.com/programs/{slug}/{id}
  Metro index: https://www.i9sports.com/atlanta-youth-sports-leagues

Strategy:
  1. Fetch the metro index page (atlanta-youth-sports-leagues) which embeds
     all Atlanta-area venue/field data as Next.js __NEXT_DATA__.
  2. Extract all field/venue records — each has address, coordinates, franchise.
  3. For each field, fetch the field's active program pages (via sitemap URLs).
  4. Parse program __NEXT_DATA__ for structured data: dates, sport, age groups,
     schedule, fees, location, franchise.

Atlanta-metro franchise IDs:
  119  Forsyth/N. Fulton (Alpharetta, Roswell, Johns Creek, Cumming)
  130  North & Central Gwinnett (Lawrenceville, Duluth, Suwanee, Buford)
  141  Cherokee/North Cobb (Canton, Woodstock, Kennesaw, Acworth)
  239  Dunwoody/N. DeKalb/S. Gwinnett (Dunwoody, Chamblee, Brookhaven, Peachtree Corners)
  284  Coweta/Douglas/Fayette (Douglasville, Peachtree City)
  285  West Fulton/South Cobb/Paulding (Marietta, Smyrna, Buckhead, Powder Springs)
  376  Stone Mountain/Lithonia/Decatur
  394  Grayson/Rockdale/Walton (Snellville, Conyers)
  429  McDonough/Stockbridge/Covington
  533  SW Atlanta (Forest Park, Jonesboro, Fairburn)
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_place, insert_event, infer_program_type, infer_season
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    programs=True,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
_JSON_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "application/json, text/plain, */*",
}

_REQUEST_DELAY = 0.6  # polite delay between requests
_MAX_PROGRAMS_PER_RUN = 500  # safety cap

_METRO_URL = "https://www.i9sports.com/atlanta-youth-sports-leagues"
_SITEMAP_URL = "https://www.i9sports.com/sitemap.xml"

# Atlanta metro franchise IDs — limits crawl to relevant franchises
_ATLANTA_FRANCHISE_IDS = {119, 130, 141, 239, 284, 285, 376, 394, 429, 533}


# ---------------------------------------------------------------------------
# Sitemap helpers
# ---------------------------------------------------------------------------


def _fetch_sitemap_program_urls() -> list[str]:
    """
    Fetch i9 sitemap and return all program page URLs for Atlanta metro area.

    Atlanta metro identified by any of the known area/venue name keywords
    embedded in the URL slug. This is faster than fetching the full metro page
    and parsing venue IDs.
    """
    _ATLANTA_KEYWORDS = [
        "atlanta", "alpharetta", "roswell", "johns-creek", "marietta",
        "smyrna", "kennesaw", "acworth", "woodstock", "canton",
        "dunwoody", "brookhaven", "chamblee", "decatur", "stone-mountain",
        "lithonia", "buckhead", "lawrenceville", "duluth", "buford",
        "suwanee", "cumming", "peachtree", "mcdonough", "stockbridge",
        "powder-springs", "douglasville", "snellville", "grayson",
        "conyers", "silverbacks", "forest-park", "jonesboro", "fairburn",
        "peachtree-corners",
    ]
    try:
        resp = requests.get(_SITEMAP_URL, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("i9 Sports: failed to fetch sitemap: %s", exc)
        return []

    urls = re.findall(r"<loc>(https://www\.i9sports\.com/programs/[^<]+)</loc>", resp.text)
    atlanta_urls = [
        u for u in urls
        if any(kw in u.lower() for kw in _ATLANTA_KEYWORDS)
    ]
    logger.info("i9 Sports: found %d Atlanta program URLs in sitemap", len(atlanta_urls))
    return atlanta_urls


# ---------------------------------------------------------------------------
# Program page parsing
# ---------------------------------------------------------------------------


def _fetch_program_data(url: str) -> Optional[dict]:
    """
    Fetch a program page and extract its __NEXT_DATA__ JSON.

    Returns the pageProps dict or None on failure.
    """
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=20)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.debug("i9 Sports: failed to fetch %s: %s", url, exc)
        return None

    matches = re.findall(
        r'<script[^>]*id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        resp.text,
        re.DOTALL,
    )
    if not matches:
        logger.debug("i9 Sports: no __NEXT_DATA__ found on %s", url)
        return None

    try:
        data = json.loads(matches[0])
        return data.get("props", {}).get("pageProps", {})
    except (json.JSONDecodeError, KeyError) as exc:
        logger.debug("i9 Sports: JSON parse error on %s: %s", url, exc)
        return None


def _extract_program_id_from_url(url: str) -> Optional[int]:
    """Extract numeric program ID from URL like /programs/slug-name/12345."""
    m = re.search(r"/programs/[^/]+/(\d+)$", url)
    return int(m.group(1)) if m else None


def _parse_price(fees_new: list[dict]) -> tuple[Optional[float], Optional[float], bool]:
    """
    Parse the feesNew array into (price_min, price_max, is_free).

    i9 fees are tier-based (early bird, regular, late). We use the earliest
    active fee as price_min and the highest as price_max.
    """
    if not fees_new:
        return None, None, False
    amounts = [f.get("fee", 0) for f in fees_new if isinstance(f.get("fee"), (int, float))]
    if not amounts:
        return None, None, False
    price_min = min(amounts)
    price_max = max(amounts)
    is_free = price_min == 0 and price_max == 0
    return (
        price_min if not is_free else None,
        price_max if not is_free else None,
        is_free,
    )


def _parse_age_range(program: dict) -> tuple[Optional[int], Optional[int]]:
    """
    Extract age_min / age_max from a program's ageGroups or whoPlays text.

    ageGroups is structured: [{"startAgeOrGradeName": "5", "endAgeOrGradeName": "7", ...}]
    whoPlays is text like "Ages 5-12".
    """
    age_groups = program.get("ageGroups", [])
    if age_groups:
        mins, maxes = [], []
        for ag in age_groups:
            try:
                mins.append(int(ag.get("startAgeOrGradeName", "") or 0))
                maxes.append(int(ag.get("endAgeOrGradeName", "") or 0))
            except (ValueError, TypeError):
                pass
        if mins and maxes:
            return min(mins), max(maxes)

    who_plays = (program.get("whoPlays") or "").strip()
    if who_plays:
        m = re.search(r"(\d+)\s*[-–to]+\s*(\d+)", who_plays)
        if m:
            return int(m.group(1)), int(m.group(2))
        m = re.search(r"(\d+)\+", who_plays)
        if m:
            return int(m.group(1)), None

    return None, None


def _get_start_time(program: dict) -> Optional[str]:
    """
    Return earliest timeStart across ageGroups in HH:MM format.

    Age groups have timeStart like "6:00 PM" or "9:00 AM".
    """
    age_groups = program.get("ageGroups", [])
    times = []
    for ag in age_groups:
        ts = (ag.get("timeStart") or "").strip()
        if ts:
            times.append(ts)
    if not times:
        return None
    # Parse and return the earliest time
    parsed = []
    for t in times:
        m = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", t, re.IGNORECASE)
        if m:
            hour, minute, period = int(m.group(1)), int(m.group(2)), m.group(3).upper()
            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0
            parsed.append((hour, minute))
    if not parsed:
        return None
    h, m_ = min(parsed)
    return f"{h:02d}:{m_:02d}"


def _build_venue_data(program: dict) -> dict:
    """Build place_data dict from program location fields."""
    field_name = (program.get("fieldName") or "").strip()
    city = (program.get("city") or "").strip()
    zip_code = (program.get("zipCode") or "").strip()
    address = (program.get("address") or "").strip().rstrip(",")
    lat = program.get("latitude")
    lng = program.get("longitude")

    # Determine neighborhood from areaPlayName
    area_play = (program.get("areaPlayName") or city or "").strip()

    # Build a readable venue name
    if field_name:
        venue_name = field_name
    elif city:
        venue_name = f"i9 Sports — {city}"
    else:
        venue_name = "i9 Sports"

    # Slug from venue name + city to ensure uniqueness
    slug_base = re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-")
    if city and city.lower() not in slug_base:
        slug_base = f"{slug_base}-{re.sub(r'[^a-z0-9]+', '-', city.lower()).strip('-')}"
    venue_slug = f"i9-sports-{slug_base}"[:80]

    return {
        "name": venue_name,
        "slug": venue_slug,
        "address": address or None,
        "neighborhood": area_play or city or None,
        "city": city or "Atlanta",
        "state": "GA",
        "zip": zip_code or None,
        "lat": lat if lat and lat != 0 else None,
        "lng": lng if lng and lng != 0 else None,
        "place_type": "sports_facility",
        "website": "https://www.i9sports.com",
        "vibes": ["youth-sports", "family-friendly"],
    }


def _classify_sport(sport_name: str, program_type: str) -> tuple[str, list[str]]:
    """Map i9 sport/program type to LostCity category and tags."""
    sport_lower = sport_name.lower()
    prog_lower = program_type.lower()

    tags = ["youth-sports", "family-friendly", "kids"]
    if "camp" in prog_lower or "camp" in sport_lower:
        tags.append("summer-camp")
    if "flag" in sport_lower and "football" in sport_lower:
        tags.extend(["flag-football", "football"])
    elif "soccer" in sport_lower:
        tags.append("soccer")
    elif "basketball" in sport_lower:
        tags.append("basketball")
    elif "baseball" in sport_lower:
        tags.append("baseball")
    elif "volleyball" in sport_lower:
        tags.append("volleyball")
    elif "lacrosse" in sport_lower:
        tags.append("lacrosse")

    if "training" in prog_lower or "instructional" in prog_lower or "clinic" in prog_lower:
        tags.append("skills-development")
    if "league" in prog_lower:
        tags.append("rec-league")

    return "sports", tags


# ---------------------------------------------------------------------------
# Main crawl
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl i9 Sports Atlanta-area youth programs from sitemap program pages."""
    source_id = source["id"]
    today = date.today()
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_cache: dict[str, int] = {}
    program_envelope = TypedEntityEnvelope()

    # 1. Get all Atlanta program URLs from sitemap
    program_urls = _fetch_sitemap_program_urls()
    if not program_urls:
        logger.error("i9 Sports: no program URLs found — aborting")
        return 0, 0, 0

    # Cap to avoid timeout on large runs
    if len(program_urls) > _MAX_PROGRAMS_PER_RUN:
        logger.warning(
            "i9 Sports: capping %d URLs to %d", len(program_urls), _MAX_PROGRAMS_PER_RUN
        )
        program_urls = program_urls[:_MAX_PROGRAMS_PER_RUN]

    logger.info("i9 Sports: processing %d program pages", len(program_urls))

    for url in program_urls:
        time.sleep(_REQUEST_DELAY)

        page_props = _fetch_program_data(url)
        if not page_props:
            continue

        # Skip error pages
        if page_props.get("error") and page_props["error"].get("name") == "Error":
            continue

        program = page_props.get("program")
        if not program:
            continue

        # Validate required fields
        from_date_str = program.get("fromDate")
        thru_date_str = program.get("thruDate")
        if not from_date_str:
            continue

        # Parse dates
        try:
            start_dt = datetime.fromisoformat(from_date_str.replace("Z", "")).date()
        except (ValueError, AttributeError):
            continue

        end_dt: Optional[date] = None
        if thru_date_str:
            try:
                end_dt = datetime.fromisoformat(thru_date_str.replace("Z", "")).date()
            except (ValueError, AttributeError):
                pass

        # Skip programs that have already ended
        cutoff = end_dt or start_dt
        if cutoff < today:
            continue

        # Check franchise is in Atlanta metro
        franchise_id = program.get("franchiseId")
        if franchise_id and franchise_id not in _ATLANTA_FRANCHISE_IDS:
            logger.debug("i9 Sports: skipping non-Atlanta franchise %s", franchise_id)
            continue

        # Skip cancelled programs
        if program.get("cancelled"):
            continue

        # Build venue
        place_data = _build_venue_data(program)
        venue_slug = place_data["slug"]
        if venue_slug not in venue_cache:
            venue_cache[venue_slug] = get_or_create_place(place_data)
        venue_id = venue_cache[venue_slug]

        # Extract fields
        sport_name = (program.get("sportName") or "").strip()
        program_type = (program.get("programType") or "").strip()
        title_raw = (program.get("title") or "").strip()

        # Build a clean title
        if title_raw:
            title = title_raw
        else:
            season = (program.get("seasonName") or "").strip()
            year = (program.get("programYear") or "").strip()
            title = f"{season} {year} {sport_name} {program_type}".strip()

        if not title:
            continue

        # Parse registration notes for description
        reg_notes_html = program.get("registrationNotes") or program.get("programNotes") or ""
        description: Optional[str] = None
        if reg_notes_html:
            desc_text = BeautifulSoup(reg_notes_html, "html.parser").get_text(" ", strip=True)
            description = desc_text[:1500] if desc_text else None

        # Pricing
        fees_new = program.get("feesNew") or []
        try:
            fees_parsed = json.loads(program.get("fees") or "[]") if not fees_new else fees_new
        except (json.JSONDecodeError, TypeError):
            fees_parsed = fees_new
        price_min, price_max, is_free = _parse_price(fees_parsed)

        # Age range
        age_min, age_max = _parse_age_range(program)

        # Schedule
        days_of_week = (program.get("daysOfWeek") or "").strip()
        start_time = _get_start_time(program)

        # Category and tags
        category, tags = _classify_sport(sport_name, program_type)

        # Age band tags
        if age_min is not None or age_max is not None:
            lo = age_min or 0
            hi = age_max or 99
            for band_tag, band_lo, band_hi in [
                ("preschool", 3, 5), ("elementary", 5, 12),
                ("tween", 10, 13), ("teen", 13, 18),
            ]:
                if lo <= band_hi and hi >= band_lo:
                    tags.append(band_tag)

        # Program ID for dedup
        program_id = program.get("id") or _extract_program_id_from_url(url)
        content_hash = generate_content_hash(
            title,
            place_data["name"],
            start_dt.strftime("%Y-%m-%d"),
        )

        event_record: dict = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "start_time": start_time,
            "end_date": end_dt.strftime("%Y-%m-%d") if end_dt else None,
            "end_time": None,
            "is_all_day": False,
            "category": category,
            "subcategory": sport_name.lower() if sport_name else None,
            "tags": list(set(tags)),
            "price_min": price_min,
            "price_max": price_max,
            "price_note": "Registration fee; multiple tiers available" if price_min else None,
            "is_free": is_free,
            "source_url": url,
            "ticket_url": url,
            "image_url": program.get("largeTopImage") or None,
            "raw_text": (
                f"{title} | {sport_name} | {program_type} | "
                f"{place_data.get('city', '')} | Ages {age_min}-{age_max} | "
                f"{days_of_week}"
            ),
            "extraction_confidence": 0.95,
            "is_recurring": bool(
                end_dt and start_dt and end_dt != start_dt and days_of_week
            ),
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        if age_min is not None:
            event_record["age_min"] = age_min
        if age_max is not None:
            event_record["age_max"] = age_max

        events_found += 1

        existing = find_event_by_hash(content_hash)
        if existing:
            from db import smart_update_existing_event
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            insert_event(event_record)
            events_new += 1

        # Program record for family portal
        prog_type = infer_program_type(title)
        if prog_type:
            season_val = infer_season(title, start_dt)
            program_data: dict = {
                "source_id": source_id,
                "place_id": venue_id,
                "name": title,
                "description": description,
                "program_type": prog_type,
                "provider_name": f"i9 Sports — {program.get('franchiseLocation', 'Atlanta')}",
                "age_min": age_min,
                "age_max": age_max,
                "season": season_val,
                "session_start": start_dt.strftime("%Y-%m-%d"),
                "session_end": end_dt.strftime("%Y-%m-%d") if end_dt else None,
                "schedule_days": [days_of_week] if days_of_week else None,
                "schedule_start_time": start_time,
                "schedule_end_time": None,
                "cost_amount": price_min,
                "cost_period": "season" if price_min else None,
                "registration_status": "open",
                "registration_url": url,
                "tags": list(set(tags)),
                "metadata": {
                    "program_id": program_id,
                    "franchise_id": franchise_id,
                    "franchise_location": program.get("franchiseLocation"),
                    "sport": sport_name,
                    "program_type": program_type,
                    "weeks_of_play": program.get("weeksOfPlay"),
                    "indoors": program.get("indoors"),
                    "genders": program.get("gendersPlaying"),
                    "area_play_name": program.get("areaPlayName"),
                },
                "_venue_name": place_data["name"],
            }
            program_envelope.add("programs", program_data)

        # Flush programs batch periodically
        if len(program_envelope.programs) >= 50:
            persist_typed_entity_envelope(program_envelope)
            program_envelope = TypedEntityEnvelope()

    # Final flush
    if program_envelope.programs:
        persist_typed_entity_envelope(program_envelope)

    logger.info(
        "i9 Sports Atlanta crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
