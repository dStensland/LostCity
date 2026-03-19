"""
Crawler for Bailey Performance Center at Kennesaw State University (KSU).

KSU's Geer College of the Arts uses OvationTix (AudienceView Professional) as
their ticketing system at https://ci.ovationtix.com/35355. This is a JavaScript SPA
that requires Playwright to establish a session, after which the REST API at
https://web.ovationtix.com/trs/api/rest/Production?expandPerformances=summary
returns all productions as JSON with full metadata.

Covers ~40+ productions/semester including:
- Morgan Concert Hall: orchestras, jazz, choral, recitals, faculty concerts
- Stillwell Theater / Onyx Theater: theater productions
- Marietta Dance Theater: dance concerts
- Zuckerman Museum of Art: gallery events, lectures, workshops

We only crawl the music, theater, and dance events — not general admission
museum tickets or internal course tours.
"""

from __future__ import annotations

import html as html_lib
import logging
import re
from datetime import datetime, date
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

KSU_TICKETING_URL = "https://ci.ovationtix.com/35355"
PRODUCTION_API_URL = "https://web.ovationtix.com/trs/api/rest/Production?expandPerformances=summary"
IMAGE_BASE_URL = "https://web.ovationtix.com/trs/api/rest/ClientFile"

# Primary performance venue: Morgan Concert Hall
MORGAN_CONCERT_HALL = {
    "name": "Morgan Concert Hall",
    "slug": "morgan-concert-hall-ksu",
    "address": "488 Prillaman Way",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 34.0373,
    "lng": -84.5810,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": "https://arts.kennesaw.edu",
}

# Stillwell Theater — main theater productions
STILLWELL_THEATER = {
    "name": "Stillwell Theater at KSU",
    "slug": "stillwell-theater-ksu",
    "address": "590 Prillaman Way",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 34.0373,
    "lng": -84.5810,
    "venue_type": "theater",
    "website": "https://arts.kennesaw.edu",
}

# Onyx Theater — black box theater
ONYX_THEATER = {
    "name": "Onyx Theater at KSU",
    "slug": "onyx-theater-ksu",
    "address": "590 Prillaman Way",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 34.0373,
    "lng": -84.5810,
    "venue_type": "theater",
    "website": "https://arts.kennesaw.edu",
}

# Marietta Dance Theater
MARIETTA_DANCE = {
    "name": "Marietta Dance Theater at KSU",
    "slug": "marietta-dance-theater-ksu",
    "address": "1100 South Marietta Pkwy",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9526,
    "lng": -84.5499,
    "venue_type": "theater",
    "website": "https://arts.kennesaw.edu",
}

# Zuckerman Museum of Art
ZUCKERMAN_MUSEUM = {
    "name": "Zuckerman Museum of Art",
    "slug": "zuckerman-museum-of-art",
    "address": "490 Prillaman Way",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 34.0373,
    "lng": -84.5810,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": "https://arts.kennesaw.edu/zuckerman",
}

# Fine Arts Gallery
FINE_ARTS_GALLERY = {
    "name": "KSU Fine Arts Gallery",
    "slug": "ksu-fine-arts-gallery",
    "address": "488 Prillaman Way",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 34.0373,
    "lng": -84.5810,
    "venue_type": "gallery",
    "website": "https://arts.kennesaw.edu",
}

# Productions that are general admission (museum entry) or internal course tours
# — not crawlable as public events
SKIP_PATTERNS = [
    re.compile(r"\bgeneral admission\b", re.I),
    re.compile(r"\bart \d{4} tour\b", re.I),
    re.compile(r"\bcourse tour\b", re.I),
    re.compile(r"\bspringboard\b", re.I),
]

# Virtual-only events — skip unless there's no in-person alternative
VIRTUAL_PATTERNS = [
    re.compile(r"^VIRTUAL:", re.I),
    re.compile(r"\blivestream\b", re.I),
    re.compile(r"\bvirtual\b", re.I),
]

# Map OvationTix venue names to our venue slug keys
VENUE_NAME_MAP: dict[str, dict] = {
    "morgan concert hall": MORGAN_CONCERT_HALL,
    "stillwell theater": STILLWELL_THEATER,
    "onyx theater": ONYX_THEATER,
    "marietta dance theater": MARIETTA_DANCE,
    "zuckerman museum of art": ZUCKERMAN_MUSEUM,
    "fine arts gallery": FINE_ARTS_GALLERY,
}


def _clean_html(value: Optional[str]) -> str:
    """Strip HTML tags and unescape entities."""
    if not value:
        return ""
    text = html_lib.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_datetime(value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Parse '2026-04-21 19:30' to ('2026-04-21', '19:30')."""
    if not value:
        return None, None
    value = str(value).strip()
    # ISO date-only
    if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return value, None
    # Datetime with space
    match = re.match(r"^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})", value)
    if match:
        return match.group(1), match.group(2)
    return None, None


def _categorize(title: str, description: str, venue_name: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags."""
    combined = f"{title} {description} {venue_name}".lower()
    base_tags = ["ksu", "kennesaw-state", "bailey-performance-center", "performing-arts"]

    # Dance
    if "dance" in combined or "ballet" in combined or venue_name.lower() == "marietta dance theater":
        base_tags.extend(["dance"])
        return "arts", "dance", sorted(set(base_tags))

    # Theater
    if any(w in combined for w in ["theater", "theatre", "play", "drama", "lear", "musical"]):
        base_tags.extend(["theater", "live-theater"])
        return "arts", "theater", sorted(set(base_tags))

    # Opera
    if "opera" in combined:
        base_tags.extend(["opera", "classical", "music"])
        return "music", "opera", sorted(set(base_tags))

    # Jazz
    if "jazz" in combined or "marsalis" in combined:
        base_tags.extend(["jazz", "live-music"])
        return "music", "jazz", sorted(set(base_tags))

    # Classical music / concerts / recitals
    if any(w in combined for w in [
        "recital", "concert", "orchestra", "symphon", "ensemble", "choir",
        "choral", "band", "brass", "percussion", "chamber", "piano", "violin",
        "wind", "string", "quartet", "trio", "vocal",
    ]):
        base_tags.extend(["classical", "live-music"])
        return "music", "concert", sorted(set(base_tags))

    # Film
    if "film festival" in combined or "film" in combined:
        base_tags.extend(["film"])
        return "arts", "film", sorted(set(base_tags))

    # Art openings / receptions
    if any(w in combined for w in ["exhibition", "opening reception", "capstone", "gallery"]):
        base_tags.extend(["art-opening", "gallery"])
        return "arts", "opening", sorted(set(base_tags))

    # Lectures / talks
    if any(w in combined for w in ["lecture", "talk", "discussion", "forum", "panel"]):
        base_tags.extend(["lecture"])
        return "community", "lecture", sorted(set(base_tags))

    # Workshops
    if "workshop" in combined:
        base_tags.extend(["workshop"])
        return "community", "workshop", sorted(set(base_tags))

    return "arts", "performance", sorted(set(base_tags))


def _get_venue_for_production(ovation_venue_name: str, venue_cache: dict[str, int]) -> Optional[int]:
    """Map OvationTix venue name to our DB venue ID."""
    key = ovation_venue_name.lower().strip()
    if key in venue_cache:
        return venue_cache[key]

    # Match against known venues
    for pattern, venue_data in VENUE_NAME_MAP.items():
        if pattern in key or key in pattern:
            vid = get_or_create_venue(venue_data)
            venue_cache[key] = vid
            return vid

    # Fallback: Morgan Concert Hall
    fallback_id = get_or_create_venue(MORGAN_CONCERT_HALL)
    venue_cache[key] = fallback_id
    return fallback_id


def _fetch_productions_via_playwright() -> list[dict]:
    """
    Use Playwright to establish an OvationTix session for KSU, then extract
    all production data from the intercepted REST API response.
    """
    productions = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page = context.new_page()

        def handle_response(response):
            url = response.url
            if "Production?" in url and "expandPerformances" in url:
                try:
                    import json
                    data = json.loads(response.body().decode("utf-8"))
                    if isinstance(data, list):
                        productions.extend(data)
                        logger.debug(
                            "Captured %s productions from OvationTix API", len(data)
                        )
                except Exception as exc:
                    logger.warning("Failed to parse production API response: %s", exc)

        page.on("response", handle_response)

        logger.info("Loading KSU OvationTix: %s", KSU_TICKETING_URL)
        page.goto(KSU_TICKETING_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)

        browser.close()

    return productions


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Bailey Performance Center / KSU Geer College of the Arts events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        # Pre-create all venue records
        venue_cache: dict[str, int] = {}
        for venue_data in VENUE_NAME_MAP.values():
            vid = get_or_create_venue(venue_data)
            key = venue_data["name"].lower()
            venue_cache[key] = vid

        productions = _fetch_productions_via_playwright()
        if not productions:
            logger.warning("No productions returned from OvationTix for KSU")
            return 0, 0, 0

        logger.info("Processing %s KSU productions", len(productions))
        today = date.today()

        for prod in productions:
            name = (prod.get("productionName") or "").strip()
            if not name:
                continue

            # Skip unwanted production types
            if any(p.search(name) for p in SKIP_PATTERNS):
                logger.debug("Skipping (filtered): %s", name)
                continue

            # Skip virtual-only events
            if any(p.search(name) for p in VIRTUAL_PATTERNS):
                logger.debug("Skipping virtual: %s", name)
                continue

            # Skip general museum admission (high volume, not events)
            if "admission" in name.lower():
                logger.debug("Skipping admission: %s", name)
                continue

            # Get performance date from summary
            perf_summary = prod.get("performanceSummary") or {}
            next_perf = perf_summary.get("nextPerformance") or {}
            start_raw = next_perf.get("startDate") or next_perf.get("startDateTime")
            end_raw = next_perf.get("endDate") or next_perf.get("endDateTime")
            count = perf_summary.get("count", 0)

            start_date, start_time = _parse_datetime(start_raw)
            end_date, end_time = _parse_datetime(end_raw)

            if not start_date:
                logger.debug("No date for production: %s", name)
                continue

            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            # Skip past events (more than 2 months ago)
            if (today - event_date).days > 60:
                continue

            # Venue
            venue_data = prod.get("venue") or {}
            ovation_venue_name = (
                venue_data.get("name") if isinstance(venue_data, dict) else ""
            ) or (prod.get("subtitle") or "")
            venue_id = _get_venue_for_production(
                ovation_venue_name or "Morgan Concert Hall", venue_cache
            )

            # Description
            raw_desc = _clean_html(prod.get("description"))
            description = raw_desc[:600].strip() if raw_desc else None

            # Image URL
            logo_url = prod.get("logoUrl") or ""
            image_url: Optional[str] = None
            if logo_url:
                # logoUrl format: /ClientFile(NNNNNN)
                file_match = re.search(r"\((\d+)\)", logo_url)
                if file_match:
                    file_id = file_match.group(1)
                    image_url = f"{IMAGE_BASE_URL}({file_id})"

            # Production ID for ticket URL
            prod_id = prod.get("id")
            ticket_url = f"{KSU_TICKETING_URL}/store/productions/{prod_id}" if prod_id else KSU_TICKETING_URL

            # Category / tags
            category, subcategory, tags = _categorize(name, raw_desc or "", ovation_venue_name or "")

            # Price — OvationTix doesn't expose price in the production summary API.
            # Determine free status from name + description heuristics:
            #   - "free" / "no charge" / "no cost" / "complimentary" anywhere in name or description
            #   - Student recitals, ensemble concerts, and departmental lectures at KSU are free
            #   - Gallery receptions, capstone exhibitions, and lectures are free
            #   - Named ArtsKSU Presents productions are ticketed (sold events)
            name_lower = name.lower()
            desc_lower = (raw_desc or "").lower()
            combined_lower = f"{name_lower} {desc_lower}"

            FREE_KEYWORDS = ["free", "no charge", "no cost", "complimentary", "open to the public"]
            # Patterns in the production name that indicate a ticketed (paid) event
            TICKETED_NAME_PATTERNS = [
                "artsksu presents",
                "she loves me",          # mainstage musical = ticketed
                "king lear",              # mainstage theater = ticketed
                "ex nihilo",             # mainstage dance = ticketed
                "opera theater",         # mainstage opera production = ticketed
            ]
            FREE_NAME_PATTERNS = [
                "recital",
                "collage concert",
                "faculty recital",
                "faculty chamber",
                "faculty presents",      # e.g. "Voice Faculty Presents"
                "honors voice",
                "student composition",
                "student dance concert",
                "cooke scholarship",
                "ensemble",
                "university band",
                "university choir",
                "jazz combo",
                "jazz vocal",
                "percussion ensemble",
                "chamber ensemble",
                "wind ensemble",
                "philharmonic",
                "opening reception",
                "capstone exhibition",
                "faculty research",
                "lecture",
                "panel discussion",
                "artist in residence",
                "film festival",
                "owl film",
                "tellers",               # KSU storytelling — free
                "process & collaboration",
                "paper weaving workshop",
                "eastern hand papermaking",
            ]

            is_ticketed = any(pat in name_lower for pat in TICKETED_NAME_PATTERNS)
            is_free_by_name = any(pat in name_lower for pat in FREE_NAME_PATTERNS)
            is_free_by_keyword = any(kw in combined_lower for kw in FREE_KEYWORDS)
            is_free = (is_free_by_name or is_free_by_keyword) and not is_ticketed

            if is_free:
                price_note = None
            elif is_ticketed:
                price_note = "Check website for pricing"
            else:
                price_note = "Check website for pricing"

            content_hash = generate_content_hash(
                name,
                ovation_venue_name or MORGAN_CONCERT_HALL["name"],
                start_date,
            )
            seen_hashes.add(content_hash)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": name,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": 0.0 if is_free else None,
                "price_max": 0.0 if is_free else None,
                "price_note": price_note,
                "is_free": is_free,
                "source_url": KSU_TICKETING_URL,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.88,
                "is_recurring": count > 1,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
            else:
                insert_event(event_record)
                events_new += 1
                logger.debug("Added KSU: %s on %s", name, start_date)

        if seen_hashes:
            stale = remove_stale_source_events(source_id, seen_hashes)
            if stale:
                logger.info("Removed %s stale KSU events", stale)

        logger.info(
            "Bailey Performance Center (KSU): %s found, %s new, %s updated",
            events_found, events_new, events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Bailey Performance Center: %s", exc)
        raise

    return events_found, events_new, events_updated
