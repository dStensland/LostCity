"""
Crawler for Children's Museum of Atlanta (childrensmuseumatlanta.org).
Interactive children's museum with family events and programs.

The site embeds a `_cma_calendar` JavaScript variable on the HOMEPAGE (not
/events/, which 404s).  We extract it via regex from the raw HTML so Playwright
is not normally required.  Playwright is used as a fallback if the variable is
absent from the static response (e.g. the site switches to server-side hydration).

JSON structure (inside `_cma_calendar.preload.special_programs`):
  id, start_date, end_date, date_string, post_title, permalink,
  thumbnail_url, post_content, exclusions, all_sessions
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Optional

import requests

from db import get_client, get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://childrensmuseumatlanta.org"
# The _cma_calendar JSON lives on the homepage, not /events/ (which 404s)
HOMEPAGE_URL = BASE_URL + "/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)

VENUE_DATA = {
    "name": "Children's Museum of Atlanta",
    "slug": "childrens-museum-atlanta",
    "address": "275 Centennial Olympic Park Dr NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7625,
    "lng": -84.3933,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # Admission: ~$24.75 per person (members free)
    # Hours verified 2026-03-11 against childrensmuseumatlanta.org
    "hours": {
        "sunday": "10:00-17:00",
        "monday": "closed",
        "tuesday": "10:00-16:00",
        "wednesday": "10:00-16:00",
        "thursday": "10:00-16:00",
        "friday": "10:00-16:00",
        "saturday": "10:00-17:00",
    },
    "vibes": [
        "family-friendly",
        "educational",
        "interactive",
        "kids",
        "downtown",
    ],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "childrens_museum",
            "commitment_tier": "halfday",
            "primary_activity": "family children's museum visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "garage",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Children's Museum of Atlanta works best as a timed indoor play-and-learning stop, especially for younger kids and downtown family days that need a weather-proof anchor. "
                "It is also one of the easiest places downtown for bathroom breaks and attention-span resets."
            ),
            "accessibility_notes": (
                "Its indoor, interactive format makes it one of the easier family destinations for strollers, shorter attention spans, and quick resets in the middle of a downtown day."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Admission pricing varies by date and membership status; special programs can carry separate scheduling windows.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "interactive-play-and-learning-floor",
            "title": "Interactive play and learning floor",
            "feature_type": "amenity",
            "description": "The museum's hands-on play format makes it a practical younger-kid anchor for energy-burning and learning in one indoor stop.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "downtown-younger-kid-weather-proof-anchor",
            "title": "Downtown younger-kid weather-proof anchor",
            "feature_type": "amenity",
            "description": "The museum is one of the strongest downtown family backups when weather shifts or a younger-kid plan needs an easier indoor anchor.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "bathroom-and-attention-span-reset-friendly",
            "title": "Bathroom and attention-span reset friendly",
            "feature_type": "amenity",
            "description": "The museum is easier than most downtown attractions when a younger-kid plan needs fast bathroom access, short play bursts, or a mid-day reset.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "venue_id": venue_id,
            "slug": "children-under-1-free-admission",
            "title": "Children under 1 free admission",
            "description": "Children under age 1 receive free admission, which makes the museum materially easier to justify for families with babies and mixed-age sibling outings.",
            "price_note": "Children under 1 are free.",
            "is_free": True,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    envelope.add(
        "venue_specials",
        {
            "venue_id": venue_id,
            "slug": "museums-for-all-discount-admission",
            "title": "Museums for All discount admission",
            "description": "The museum participates in Museums for All, which gives eligible families a lower-cost way to use it as a recurring downtown play-and-learning stop.",
            "price_note": "Discount admission available through Museums for All / SNAP access program.",
            "is_free": False,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    return envelope

# Titles that describe permanent/daily operations — not real events.
SKIP_TITLES = {
    "play at the museum",
    "black history month",
    "women's history month",
    "hispanic heritage month",
    "asian american pacific islander heritage month",
    "pride month",
    "museum open",
    "general admission",
}

# ------------------------------------------------------------------
# Age extraction helpers
# ------------------------------------------------------------------

# Map age bands to (min_age, max_age) inclusive ranges (in years).
# Fractions used for infant/toddler sub-year ranges.
_AGE_BANDS: list[tuple[str, int, int]] = [
    ("infant", 0, 1),
    ("toddler", 1, 3),
    ("preschool", 3, 5),
    ("elementary", 5, 12),
    ("tween", 10, 13),
    ("teen", 13, 18),
]


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Return age-band tags that overlap with the given [age_min, age_max] range."""
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [tag for tag, band_lo, band_hi in _AGE_BANDS if lo <= band_hi and hi >= band_lo]


def extract_age_range(html: str) -> tuple[Optional[int], Optional[int]]:
    """
    Extract age_min / age_max from post_content HTML.

    Recognises patterns like:
      - "Ages 2–5"  / "Ages 2-5"  / "ages 2 to 5"
      - "Ages 3 and up" / "3+ years" / "ages 3+"
      - "0–12 months" / "12-24 months"
      - "For ages 6 and older"
      - "Birth to 5" / "birth–5"

    Returns (age_min, age_max) as integers in years.
    Returns (None, None) if no age information is found.
    """
    if not html:
        return None, None

    # Strip HTML tags for plain text matching
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).lower()

    # ---- months range (e.g. "0-12 months", "12 to 24 months") ----
    m = re.search(r"(\d+)\s*(?:-|–|to)\s*(\d+)\s*months?", text)
    if m:
        lo_mo, hi_mo = int(m.group(1)), int(m.group(2))
        # Convert months to years, rounding down; clamp to 0
        return max(0, lo_mo // 12), max(0, hi_mo // 12)

    # ---- "birth to N" / "newborn to N" ----
    m = re.search(r"(?:birth|newborn)\s*(?:to|-|–)\s*(\d+)", text)
    if m:
        return 0, int(m.group(1))

    # ---- "ages N-M" / "ages N to M" / "ages N–M" ----
    m = re.search(r"ages?\s+(\d+)\s*(?:-|–|to)\s*(\d+)", text)
    if m:
        return int(m.group(1)), int(m.group(2))

    # ---- "ages N and up" / "ages N+" / "N+ years" / "for ages N and older" ----
    m = re.search(r"ages?\s+(\d+)\s*(?:\+|and\s+(?:up|older)|or\s+older)", text)
    if m:
        return int(m.group(1)), None
    m = re.search(r"(\d+)\+\s*years?", text)
    if m:
        return int(m.group(1)), None

    # ---- "for ages N" (lone age mention) ----
    m = re.search(r"(?:for\s+)?ages?\s+(\d+)", text)
    if m:
        age = int(m.group(1))
        return age, age

    return None, None


# ------------------------------------------------------------------
# Category / tag helpers
# ------------------------------------------------------------------

def determine_category_and_tags(
    title: str,
    description: str,
    age_min: Optional[int],
    age_max: Optional[int],
) -> tuple[str, Optional[str], list[str]]:
    """Return (category, subcategory, tags) for a CMA special program."""
    title_lower = title.lower()
    desc_lower = description.lower() if description else ""
    combined = f"{title_lower} {desc_lower}"

    # Base tags always present for this venue
    tags: list[str] = ["family-friendly", "kids", "educational"]

    # Add age band tags
    tags.extend(_age_band_tags(age_min, age_max))

    # Workshops / classes
    if any(w in combined for w in ["workshop", "class", "learn", "stem", "science", "craft", "art"]):
        tags.append("hands-on")
        return "family", "education", tags

    # Holiday / festival events
    if any(w in combined for w in ["celebrate", "festival", "holiday", "birthday", "party"]):
        tags.append("holiday")
        return "family", "celebration", tags

    # Performances
    if any(w in combined for w in ["performance", "show", "theater", "theatre", "puppet", "concert"]):
        return "family", "performance", tags

    # Story time / reading
    if any(w in combined for w in ["story", "storytime", "read", "book"]):
        tags.append("hands-on")
        return "family", "storytime", tags

    # Default
    return "family", "kids", tags


# ------------------------------------------------------------------
# JSON extraction
# ------------------------------------------------------------------

_CMA_CALENDAR_RE = re.compile(
    r"var\s+_cma_calendar\s*=\s*(\{.*?\});\s*\n",
    re.DOTALL,
)

# Broader fallback that handles multi-line without a trailing newline guard
_CMA_CALENDAR_RE_LOOSE = re.compile(
    r"var\s+_cma_calendar\s*=\s*(\{.+)",
    re.DOTALL,
)


def _extract_cma_json_from_html(html: str) -> Optional[dict]:
    """
    Extract the `_cma_calendar` object from raw page HTML.

    The variable is assigned as:
        var _cma_calendar = {...};

    We try a tight regex first (ends at semicolon + newline), then a looser one
    that walks the string character by character to find the matching closing brace.
    """
    # Tight match — works when the JSON is followed immediately by ;\n
    m = _CMA_CALENDAR_RE.search(html)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # Loose match — manually balance braces to find the end of the object
    m = _CMA_CALENDAR_RE_LOOSE.search(html)
    if not m:
        return None

    raw = m.group(1)
    depth = 0
    end = 0
    in_string = False
    escape_next = False

    for i, ch in enumerate(raw):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    if end == 0:
        return None

    candidate = raw[:end]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as exc:
        logger.debug("CMA JSON parse failed: %s", exc)
        return None


_CMA_HOMEPAGE_HTML: Optional[str] = None  # cached for og: extraction


def _fetch_calendar_data_static() -> Optional[dict]:
    """Fetch the homepage with requests and extract _cma_calendar."""
    global _CMA_HOMEPAGE_HTML
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        resp = requests.get(HOMEPAGE_URL, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("Static fetch of CMA homepage failed: %s", exc)
        return None

    _CMA_HOMEPAGE_HTML = resp.text
    return _extract_cma_json_from_html(resp.text)


def _extract_og_meta_from_homepage() -> tuple[Optional[str], Optional[str]]:
    """
    Extract og:image and og:description from the cached homepage HTML.
    Returns (image_url, description).
    """
    if not _CMA_HOMEPAGE_HTML:
        return None, None

    from bs4 import BeautifulSoup as _BS

    soup = _BS(_CMA_HOMEPAGE_HTML, "html.parser")

    og_image: Optional[str] = None
    og_tag = soup.find("meta", property="og:image")
    if og_tag and og_tag.get("content"):  # type: ignore[union-attr]
        og_image = og_tag["content"]  # type: ignore[index]

    og_desc: Optional[str] = None
    for attr_dict in (
        {"property": "og:description"},
        {"name": "description"},
    ):
        tag = soup.find("meta", attrs=attr_dict)
        if tag and tag.get("content"):  # type: ignore[union-attr]
            og_desc = str(tag["content"])[:500]  # type: ignore[index]
            break

    return og_image, og_desc


def _fetch_calendar_data_playwright() -> Optional[dict]:
    """Playwright fallback — evaluates _cma_calendar from the live DOM."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.error("Playwright not installed — cannot use browser fallback")
        return None

    logger.info("Falling back to Playwright for CMA calendar extraction")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()
            page.goto(HOMEPAGE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            calendar_data = page.evaluate(
                "() => (typeof _cma_calendar !== 'undefined' ? _cma_calendar : null)"
            )
            browser.close()
            return calendar_data
    except Exception as exc:
        logger.error("Playwright CMA fallback failed: %s", exc)
        return None


# ------------------------------------------------------------------
# Time helpers
# ------------------------------------------------------------------

def parse_time(time_str: str) -> Optional[str]:
    """Parse time from formats like '9:30am', '11:30 AM', '16:30'."""
    if not time_str:
        return None

    # 24-hour format
    if re.match(r"^\d{2}:\d{2}$", time_str):
        return time_str

    # 12-hour format
    m = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str, re.IGNORECASE)
    if m:
        hour, minute, period = m.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    return None


# ------------------------------------------------------------------
# Main crawl function
# ------------------------------------------------------------------

def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Children's Museum of Atlanta events from homepage _cma_calendar JSON."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Step 1: get calendar data — static HTML first, Playwright fallback
    logger.info("Fetching CMA calendar data from %s", HOMEPAGE_URL)
    calendar_data = _fetch_calendar_data_static()

    if not calendar_data:
        logger.warning("Static extraction failed — trying Playwright fallback")
        calendar_data = _fetch_calendar_data_playwright()

    if not calendar_data:
        logger.error("Could not find _cma_calendar data on CMA homepage")
        return 0, 0, 0

    special_programs = calendar_data.get("preload", {}).get("special_programs", [])
    logger.info("Found %d special programs in CMA calendar", len(special_programs))

    venue_id = get_or_create_venue(VENUE_DATA)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    # Enrich venue with og:image and og:description extracted from the homepage we already fetched
    try:
        og_image, og_desc = _extract_og_meta_from_homepage()
        venue_update: dict = {}
        if og_image:
            venue_update["image_url"] = og_image
        if og_desc:
            venue_update["description"] = og_desc
        if venue_update:
            get_client().table("venues").update(venue_update).eq("id", venue_id).execute()
            logger.info("Children's Museum: enriched venue from homepage og: metadata")
    except Exception as enrich_exc:
        logger.warning("Children's Museum: og: enrichment failed: %s", enrich_exc)

    for program in special_programs:
        try:
            title = program.get("post_title", "").strip()
            if not title:
                continue

            # Skip generic exhibit/operations titles
            if title.lower() in SKIP_TITLES:
                continue

            start_date_str = program.get("start_date")
            end_date_str = program.get("end_date")
            permalink = program.get("permalink") or HOMEPAGE_URL
            post_content = program.get("post_content", "") or ""
            image_url = program.get("thumbnail_url")

            if not start_date_str:
                continue

            # Parse dates
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                end_date = (
                    datetime.strptime(end_date_str, "%Y-%m-%d").date()
                    if end_date_str
                    else start_date
                )
            except ValueError:
                logger.warning("Could not parse dates for %r: %s - %s", title, start_date_str, end_date_str)
                continue

            # Skip fully past programs
            if end_date < datetime.now().date():
                continue

            # Build plain-text description from post_content HTML
            description: Optional[str] = None
            if post_content:
                description = re.sub(r"<[^>]+>", " ", post_content)
                description = re.sub(r"\s+", " ", description).strip()
                if len(description) > 500:
                    description = description[:497] + "..."
            if not description:
                description = f"{title} at Children's Museum of Atlanta"

            # Extract age range from raw HTML content
            age_min, age_max = extract_age_range(post_content)

            # Session times (use first session)
            sessions = program.get("all_sessions") or []
            start_time: Optional[str] = None
            end_time: Optional[str] = None
            if sessions:
                first = sessions[0]
                start_time = parse_time(first.get("start", ""))
                end_time = parse_time(first.get("end", ""))

            exclusions: list[str] = program.get("exclusions") or []

            # Determine category / tags (shared across all date instances)
            category, subcategory, tags = determine_category_and_tags(
                title, description, age_min, age_max
            )

            # Detect exhibits to set content_kind
            exhibit_kw = ["exhibit", "exhibition", "on view", "collection", "installation"]
            is_exhibit = any(kw in f"{title} {description}".lower() for kw in exhibit_kw)

            # Expand multi-day programs into individual event records
            current_date = start_date
            while current_date <= end_date:
                # Museum is closed Wednesdays
                if current_date.weekday() == 2:
                    current_date += timedelta(days=1)
                    continue

                # Skip excluded dates
                if current_date.strftime("%Y-%m-%d") in exclusions:
                    current_date += timedelta(days=1)
                    continue

                events_found += 1

                content_hash = generate_content_hash(
                    title, "Children's Museum of Atlanta", current_date.strftime("%Y-%m-%d")
                )

                event_record: dict = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": current_date.strftime("%Y-%m-%d"),
                    "start_time": None if is_exhibit else start_time,
                    "end_date": current_date.strftime("%Y-%m-%d"),
                    "end_time": None if is_exhibit else end_time,
                    "is_all_day": is_exhibit,
                    "content_kind": "exhibit" if is_exhibit else None,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Included with museum admission (members free)",
                    "is_free": False,
                    "source_url": permalink,
                    "ticket_url": permalink,
                    "image_url": image_url,
                    "raw_text": f"{title} - {description[:200]}",
                    "extraction_confidence": 0.90,
                    "is_recurring": (end_date - start_date).days > 1,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # age_min / age_max — only set when extracted
                if age_min is not None:
                    event_record["age_min"] = age_min
                if age_max is not None:
                    event_record["age_max"] = age_max

                # Free event detection from description
                combined_lower = f"{title} {description}".lower()
                if any(kw in combined_lower for kw in ["free", "no cost", "no charge", "complimentary"]):
                    event_record["is_free"] = True
                    event_record["price_min"] = 0
                    event_record["price_max"] = 0
                    event_record["price_note"] = None

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    current_date += timedelta(days=1)
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info("Added: %s on %s", title, current_date.strftime("%Y-%m-%d"))
                except Exception as exc:
                    logger.error("Failed to insert %r on %s: %s", title, current_date, exc)

                current_date += timedelta(days=1)

        except Exception as exc:
            logger.error("Error processing CMA program: %s", exc)
            continue

    logger.info(
        "Children's Museum crawl complete: %d found, %d new, %d updated",
        events_found, events_new, events_updated,
    )
    return events_found, events_new, events_updated
