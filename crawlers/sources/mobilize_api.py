"""
Mobilize.us public API crawler for Atlanta civic/advocacy events.

API: https://api.mobilize.us/v1/events (no auth required)
Coverage: geo query returns ~15 in-person Atlanta events; org-specific pass adds
~40+ more from Atlanta-area civic orgs whose events lack geocoordinates or fall
just outside the 30-mile radius.

Design decisions (see prds/research/1a-mobilize-api-audit.md):
- Geographic filter: zipcode=30303 + radius=30 miles (correct approach per API audit;
  state=GA returns all 302 GA events and city param does NOT actually filter).
- Org-specific pass: supplement geo query with direct fetches from known
  Atlanta-area civic org IDs (CIVIC_ORG_IDS). Events are accepted if within
  ORG_PASS_RADIUS_MILES OR have a GA zipcode with no coordinates (private-address
  or missing geocoding). Deduplicates against geo query results by event ID.
- Electoral filter: org_type-based gate (CAMPAIGN/PARTY_COMMITTEE excluded). For
  GRASSROOTS_GROUP orgs, event_type determines include/exclude. sponsor.is_nonelectoral
  is used as a secondary signal.
- One event record per Mobilize event (not per timeslot). Average 4.6 timeslots/event
  means per-timeslot expansion would flood the feed. We use the earliest upcoming
  timeslot as start_date, and the last timeslot's end_date as end_date.
- No virtual events: HelpATL is an in-person discovery product.
- Cause tags inferred from title/description keyword matching.
- Engagement tags derived from Mobilize event_type field.
"""

from __future__ import annotations

import logging
import math
import re
import time
from datetime import datetime, timezone
from typing import Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API configuration
# ---------------------------------------------------------------------------

API_BASE = "https://api.mobilize.us/v1/events"
ORG_EVENTS_BASE = "https://api.mobilize.us/v1/organizations/{org_id}/events"
# Zipcode-based geo filter is the correct approach (city param does not actually filter)
ATLANTA_ZIP = "30303"
SEARCH_RADIUS_MILES = 30
# Wider radius for org-specific pass: captures Cobb/Cherokee/Forsyth suburbs
ORG_PASS_RADIUS_MILES = 40
EVENTS_PER_PAGE = 25  # API default; keep low to respect rate limit
REQUEST_DELAY = 1.0   # seconds between page fetches (org pass makes more requests)
RATE_LIMIT_BACKOFF = 30  # seconds on 429

# Atlanta center for fallback distance check
ATLANTA_LAT = 33.749
ATLANTA_LNG = -84.388

# ---------------------------------------------------------------------------
# Atlanta-area civic org IDs for org-specific supplemental pass.
#
# These orgs are confirmed Atlanta-metro-based and post events that the geo
# query misses (private addresses, missing geocoordinates, or slightly outside
# the 30-mile radius). Only include genuinely nonpartisan civic orgs — no
# campaign/electoral orgs. IDs verified against the Mobilize API on 2026-03-21.
# ---------------------------------------------------------------------------

# Maps numeric Mobilize org ID → slug (for logging only; slug is not used in API calls)
CIVIC_ORG_IDS: dict[int, str] = {
    # Indivisible / grassroots organizing (Atlanta metro chapters)
    42534: "indivisibleatl",               # Indivisible ATL
    42539: "intownwomensresistance",        # Intown Women's Resistance
    42562: "indivisiblecobb",              # Indivisible Cobb
    40568: "indivisiblenorthmetroatlantaga",  # Indivisible North Metro Atlanta GA
    46219: "indivisiblecherokeeunited",    # Indivisible Cherokee United
    40450: "indivisibleboldlyblue",        # Indivisible Boldly Blue (Walton/Barrow county line)
    34214: "indivisiblegeorgiadistrict10", # Indivisible GA District 10
    # Civic advocacy orgs with Atlanta-area events
    36066: "georgiayouthjustice",          # Georgia Youth Justice Coalition (school board meetings)
    5766: "blackvotersmatter",             # Black Voters Matter
    6600: "commoncause",                   # Common Cause (GA chapter events)
    27586: "hrcga",                        # HRC in Georgia
    36233: "equityineducation",            # Equity in Education
    37218: "surj",                         # Showing Up for Racial Justice
    39198: "aflcio",                       # AFL-CIO (GA labor events)
    41324: "50501georgia",                 # 50501 Georgia
    42198: "nokings",                      # No Kings (national, ATL events)
    44708: "necessarytrouble",             # Necessary Trouble
    46673: "50501northga",                 # 50501 North GA (C3)
    46827: "committeetoprotect",           # Committee to Protect Health Care
    2835: "gae",                           # Georgia Association of Educators
}

# ---------------------------------------------------------------------------
# Distance calculation
# ---------------------------------------------------------------------------

def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in miles between two lat/lng points."""
    R = 3958.8  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def _is_in_atlanta_metro(
    lat: Optional[float],
    lng: Optional[float],
    postal_code: str,
    *,
    radius_miles: float = ORG_PASS_RADIUS_MILES,
) -> bool:
    """
    Return True if the event is within the Atlanta metro area.

    Accepts if:
    - lat/lng within radius_miles of downtown Atlanta, OR
    - No lat/lng but postal_code starts with '30' (GA zip prefix for metro area).
      Private-address events from Atlanta-area orgs use this path.
    """
    if lat and lng:
        dist = _haversine_miles(ATLANTA_LAT, ATLANTA_LNG, lat, lng)
        return dist <= radius_miles
    # No coordinates — use zipcode as proxy for Atlanta metro
    return bool(postal_code) and postal_code.startswith("30")


# ---------------------------------------------------------------------------
# Electoral content filtering
# ---------------------------------------------------------------------------

# Org types that are always included (nonpartisan civic orgs)
ALWAYS_INCLUDE_ORG_TYPES = frozenset({"C3", "C4", "GOVERNMENT", "UNION", "OTHER", "INDEPENDENT"})

# Org types that are always excluded (partisan/electoral campaign infrastructure)
ALWAYS_EXCLUDE_ORG_TYPES = frozenset({"CAMPAIGN", "PARTY_COMMITTEE", "PAC", "COORDINATED"})

# For GRASSROOTS_GROUP orgs: include only these community-facing event types
GRASSROOTS_INCLUDE_EVENT_TYPES = frozenset({
    "COMMUNITY",
    "RALLY",
    "MARCH",
    "SOLIDARITY_EVENT",
    "VISIBILITY_EVENT",
    "TOWN_HALL",
    "WORKSHOP",
    "TRAINING",
    "VOTER_REG",
    "MEETING",
    "FUNDRAISER",
    "MEET_GREET",
    "DEBATE_WATCH_PARTY",
    "HOUSE_PARTY",
    "TABLING",
    "OFFICE_OPENING",
    "BARNSTORM",
    "CARPOOL",
    "VOLUNTEER_SHIFT",
    "ADVOCACY",
    "VOTER_PROTECTION",
    "OTHER",
    "GROUP",
})

# For GRASSROOTS_GROUP orgs: skip these pure campaign-ops event types
GRASSROOTS_EXCLUDE_EVENT_TYPES = frozenset({
    "CANVASS",
    "PHONE_BANK",
    "TEXT_BANK",
    "AUTOMATED_PHONE_BANK",
    "RELATIONAL",
    "FRIEND_TO_FRIEND_OUTREACH",
    "LETTER_WRITING",
    "POSTCARD_WRITING",
    "PETITION",
    "PLEDGE",
    "INTEREST_FORM",
    "DONATION_CAMPAIGN",
    "SOCIAL_MEDIA_CAMPAIGN",
    "DATA_ENTRY",
    "POLL_MONITORING",
    "HOTLINE",
    "SIGNATURE_GATHERING",
    "ADVOCACY_CALL",
    "COMMUNITY_CANVASS",
    "LITERATURE_DROP_OFF",
})

# ---------------------------------------------------------------------------
# Event type → engagement tag mapping
# ---------------------------------------------------------------------------

MOBILIZE_TYPE_ENGAGEMENT_MAP: dict[str, list[str]] = {
    "RALLY": ["rally"],
    "MARCH": ["rally"],
    "SOLIDARITY_EVENT": ["rally"],
    "VISIBILITY_EVENT": ["rally"],
    "BARNSTORM": ["rally"],
    "COMMUNITY": ["attend"],
    "HOUSE_PARTY": ["attend"],
    "DEBATE_WATCH_PARTY": ["attend"],
    "MEET_GREET": ["attend"],
    "OFFICE_OPENING": ["attend"],
    "CARPOOL": ["attend"],
    "VOLUNTEER_SHIFT": ["attend"],
    "ADVOCACY": ["attend"],
    "VOTER_PROTECTION": ["attend"],
    "OTHER": ["attend"],
    "GROUP": ["attend"],
    "MEETING": ["organize"],
    "TABLING": ["organize"],
    "TOWN_HALL": ["public-comment", "attend"],
    "WORKSHOP": ["attend"],
    "TRAINING": ["attend"],
    "VOTER_REG": ["canvass"],
    "FUNDRAISER": ["donate"],
}

# ---------------------------------------------------------------------------
# Cause tag inference
# ---------------------------------------------------------------------------

# Each tuple: (cause_tag, title_keywords, description_keywords)
# Match rule: >=1 hit in title OR >=2 hits in description
CAUSE_PATTERNS: list[tuple[str, list[str], list[str]]] = [
    (
        "housing",
        ["housing", "zoning", "affordable housing", "eviction", "tenant", "rent"],
        ["housing", "zoning", "affordable", "eviction", "tenant", "rent", "landlord"],
    ),
    (
        "environment",
        ["climate", "environment", "clean energy", "conservation", "solar", "green new deal"],
        ["climate", "environment", "clean energy", "conservation", "solar", "emissions", "renewable"],
    ),
    (
        "education",
        ["education", "school board", "student", "teacher", "literacy", "college"],
        ["education", "school", "student", "teacher", "literacy", "curriculum", "classroom"],
    ),
    (
        "transit",
        ["transit", "marta", "transportation", "bike lane", "brt", "rail"],
        ["transit", "marta", "transportation", "bike", "brt", "rail", "commute", "bus"],
    ),
    (
        "health",
        ["health", "healthcare", "medicaid", "mental health", "clinic", "hospital"],
        ["health", "healthcare", "medicaid", "mental health", "wellness", "clinic", "hospital"],
    ),
    (
        "immigration",
        ["immigration", "immigrant", "asylum", "deportation", "daca", "refugee"],
        ["immigration", "immigrant", "asylum", "deportation", "daca", "undocumented", "refugee"],
    ),
    (
        "racial-justice",
        ["racial justice", "civil rights", "equity", "reparations", "police reform", "anti-racism"],
        ["racial justice", "civil rights", "equity", "reparations", "police reform", "racism"],
    ),
    (
        "voting-rights",
        ["voting rights", "voter suppression", "ballot access", "election integrity"],
        ["voting rights", "voter suppression", "ballot", "election integrity", "gerrymander"],
    ),
    (
        "labor",
        ["labor rights", "union", "workers rights", "living wage", "strike", "collective bargaining"],
        ["labor", "union", "worker", "wage", "strike", "workers rights", "collective bargaining"],
    ),
]


def infer_cause_tags(title: str, description: str) -> list[str]:
    """
    Infer cause tags from title and description using keyword matching.
    Rule: 1+ keyword in title OR 2+ keywords in description triggers the tag.
    """
    title_lower = title.lower()
    desc_lower = description.lower() if description else ""
    cause_tags: list[str] = []

    for cause_tag, title_keywords, desc_keywords in CAUSE_PATTERNS:
        title_hits = sum(1 for kw in title_keywords if kw in title_lower)
        if title_hits >= 1:
            cause_tags.append(cause_tag)
            continue
        desc_hits = sum(1 for kw in desc_keywords if kw in desc_lower)
        if desc_hits >= 2:
            cause_tags.append(cause_tag)

    return cause_tags


def infer_civic_process_tags(title: str, description: str) -> list[str]:
    text = f"{title} {description}".lower()
    tags: list[str] = []

    if any(
        token in text
        for token in (
            "board of registrations",
            "board of elections",
            "board of commissioners",
            "city council",
            "state election board",
            "public hearing",
            "public comment",
        )
    ):
        tags.extend(["government", "public-meeting"])

    if any(
        token in text
        for token in (
            "board of registrations",
            "board of elections",
            "state election board",
            "election board",
            "election worker",
            "poll worker",
        )
    ):
        tags.append("election")

    if any(
        token in text
        for token in (
            "school board",
            "school district",
            "board of education",
        )
    ):
        tags.extend(["school-board", "government", "public-meeting"])

    if "fulton county" in text:
        tags.append("fulton")

    if "dekalb county" in text or "dekalb board of education" in text:
        tags.append("dekalb")

    if any(
        token in text
        for token in (
            "atlanta public schools",
            "aps board meeting",
            "aps audit committee",
            "aps budget commission",
            "aps accountability commission",
        )
    ):
        tags.append("atlanta-public-schools")

    if any(
        token in text
        for token in (
            "fulton county schools",
            "fulton county schools board of education",
        )
    ):
        tags.append("fulton-county-schools")

    if any(
        token in text
        for token in (
            "dekalb county schools",
            "dekalb board of education",
            "dekalb county school district",
        )
    ):
        tags.append("dekalb-schools")

    if any(
        token in text
        for token in (
            "capitol",
            "legislator",
            "legislature",
            "city hall",
            "commission meeting",
            "commissioners meeting",
        )
    ):
        tags.append("government")

    return list(dict.fromkeys(tags))


# ---------------------------------------------------------------------------
# Electoral content gate
# ---------------------------------------------------------------------------

def should_include_event(event: dict) -> tuple[bool, str]:
    """
    Apply electoral content filtering.
    Returns (include: bool, reason: str) for logging.

    Primary signal: org_type.
    Secondary signal: sponsor.is_nonelectoral (supplement, not override).
    For GRASSROOTS_GROUP: event_type determines include/exclude.
    """
    sponsor = event.get("sponsor") or {}
    org_type = (sponsor.get("org_type") or "").upper()
    event_type = (event.get("event_type") or "OTHER").upper()
    is_nonelectoral = sponsor.get("is_nonelectoral")

    # Hard excludes
    if org_type in ALWAYS_EXCLUDE_ORG_TYPES:
        return False, f"excluded org_type={org_type}"

    # Hard includes (nonpartisan civic orgs)
    if org_type in ALWAYS_INCLUDE_ORG_TYPES:
        # But still gate on is_nonelectoral if explicitly False for C4s
        if org_type == "C4" and is_nonelectoral is False:
            return False, "C4 with is_nonelectoral=False"
        return True, f"allowed org_type={org_type}"

    # GRASSROOTS_GROUP: gate on event_type
    if org_type == "GRASSROOTS_GROUP":
        # Use is_nonelectoral as secondary signal if event_type is ambiguous
        if is_nonelectoral is True and event_type not in GRASSROOTS_EXCLUDE_EVENT_TYPES:
            return True, f"grassroots + is_nonelectoral=True + event_type={event_type}"
        if event_type in GRASSROOTS_INCLUDE_EVENT_TYPES:
            return True, f"grassroots + event_type={event_type} (include list)"
        if event_type in GRASSROOTS_EXCLUDE_EVENT_TYPES:
            return False, f"grassroots + event_type={event_type} (exclude list)"
        # Unknown event type for grassroots — include by default
        return True, f"grassroots + unknown event_type={event_type} (default include)"

    # Unknown org type — include by default (permissive for future org types)
    return True, f"unknown org_type={org_type!r} (default include)"


# ---------------------------------------------------------------------------
# Venue helpers
# ---------------------------------------------------------------------------

_PLACEHOLDER_VENUE_RE = re.compile(
    r"(meet\s+us\s+in\s+the\s+parking\s+lot|located\s+at\s*$|^parking\s+lot$|^tbd?$|^tba$|^virtual$|^online$"
    r"|this\s+event.{0,10}address\s+is\s+private|sign\s+up\s+for\s+more\s+details)",
    re.I,
)


def _normalize_venue_name(
    raw: str,
    *,
    title: str = "",
    address: Optional[str] = None,
) -> str:
    """
    Normalize a Mobilize venue name.

    - Placeholder values (TBD, TBA, parking lot language, etc.) are replaced.
    - Replacement priority: "NEAR X" clause in title → address → generic fallback.
    """
    cleaned = re.sub(r"\s+", " ", (raw or "").strip())

    if not cleaned or _PLACEHOLDER_VENUE_RE.search(cleaned):
        # Try to infer from "NEAR X" in the event title
        if title:
            near_match = re.search(r"\bnear\s+(.+)$", title.strip(), re.I)
            if near_match:
                inferred = re.sub(r"\s+", " ", near_match.group(1)).strip(" .,-")
                if inferred:
                    return inferred
        return address.strip() if address else "Community Location"

    return cleaned


# Backward-compatible alias used by tests/test_source_venue_normalization.py
_normalize_mobilize_venue_name = _normalize_venue_name


def build_venue_data(location: dict, *, event_title: str = "") -> Optional[dict]:
    """Convert a Mobilize location dict to venue_data for get_or_create_venue."""
    if not location:
        return None

    address_lines = location.get("address_lines") or []
    raw_address = address_lines[0].strip() if address_lines and address_lines[0] else None
    # Private-address events have "This event's address is private..." in address_lines;
    # treat these as no address so the venue falls back to city-level.
    address = raw_address if raw_address and not _PLACEHOLDER_VENUE_RE.search(raw_address) else None

    venue_name = _normalize_venue_name(
        location.get("venue") or "",
        title=event_title,
        address=address,
    )

    city = (location.get("locality") or "").strip() or None
    state = (location.get("region") or "GA").strip()
    zip_code = (location.get("postal_code") or "").strip()

    geo = location.get("location") or {}
    try:
        lat = float(geo.get("latitude") or 0) or None
        lng = float(geo.get("longitude") or 0) or None
    except (TypeError, ValueError):
        lat, lng = None, None

    slug = re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-")[:50]

    return {
        "name": venue_name,
        "slug": slug,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "lat": lat,
        "lng": lng,
        "venue_type": "venue",
    }


# ---------------------------------------------------------------------------
# Timestamp parsing
# ---------------------------------------------------------------------------

def parse_unix_timestamp(ts: Optional[int]) -> tuple[Optional[str], Optional[str]]:
    """Convert a Unix timestamp to (YYYY-MM-DD, HH:MM:SS) strings in local time."""
    if not ts:
        return None, None
    try:
        dt = datetime.fromtimestamp(int(ts))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    except (ValueError, OSError, OverflowError):
        return None, None


# ---------------------------------------------------------------------------
# Timeslot selection: earliest upcoming → start, last → end
# ---------------------------------------------------------------------------

def select_timeslots(
    timeslots: list[dict],
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    From a list of timeslots, pick:
    - start_date/start_time: earliest upcoming timeslot
    - end_date/end_time: corresponding end of that earliest timeslot

    We use one event record per Mobilize event (not per timeslot) to avoid
    flooding the feed — the API audit observed average 4.6 timeslots per event.
    """
    if not timeslots:
        return None, None, None, None

    now_ts = int(datetime.now(tz=timezone.utc).timestamp())
    upcoming = [
        ts for ts in timeslots
        if ts.get("start_date") and ts["start_date"] >= now_ts
    ]

    if not upcoming:
        # All timeslots are past; skip
        return None, None, None, None

    # Sort by start_date ascending; pick earliest
    upcoming.sort(key=lambda ts: ts["start_date"])
    earliest = upcoming[0]

    start_date, start_time = parse_unix_timestamp(earliest.get("start_date"))
    end_date, end_time = parse_unix_timestamp(earliest.get("end_date"))

    return start_date, start_time, end_date, end_time


# ---------------------------------------------------------------------------
# API pagination — follow the 'next' cursor URL
# ---------------------------------------------------------------------------

def fetch_all_events() -> list[dict]:
    """
    Fetch all public future events from Mobilize API for Atlanta metro area.
    Uses zipcode+radius geo filter (correct per API audit; city param does not filter).
    Follows 'next' cursor URL until exhausted.
    """
    url: Optional[str] = API_BASE
    first_page = True
    params = {
        "timeslot_start": "gte_now",
        "visibility": "PUBLIC",
        "is_virtual": "false",   # In-person only at API level
        "zipcode": ATLANTA_ZIP,
        "radius": SEARCH_RADIUS_MILES,
        "per_page": EVENTS_PER_PAGE,
    }
    all_events: list[dict] = []
    page_num = 0

    while url:
        page_num += 1
        try:
            if first_page:
                response = requests.get(url, params=params, timeout=30)
                first_page = False
            else:
                # Subsequent pages: use full 'next' URL (cursor already embedded)
                response = requests.get(url, timeout=30)

            if response.status_code == 429:
                logger.warning(
                    f"Mobilize API rate-limited on page {page_num}, backing off {RATE_LIMIT_BACKOFF}s"
                )
                time.sleep(RATE_LIMIT_BACKOFF)
                continue  # Retry same URL

            response.raise_for_status()
            data = response.json()

        except requests.RequestException as e:
            logger.error(f"Mobilize API fetch error on page {page_num}: {e}")
            break

        events = data.get("data") or []
        all_events.extend(events)
        logger.info(
            f"Mobilize API page {page_num}: {len(events)} events "
            f"(total so far: {len(all_events)})"
        )

        url = data.get("next")  # None when last page
        if url:
            time.sleep(REQUEST_DELAY)

    logger.info(f"Mobilize API: {len(all_events)} events fetched across {page_num} pages")
    return all_events


def fetch_org_events(
    org_id: int,
    org_slug: str,
    *,
    exclude_ids: set[int],
) -> list[dict]:
    """
    Fetch in-person future events for a specific org by numeric ID.

    Uses /v1/organizations/{id}/events (numeric ID only — slug path returns 404).

    Filters:
    - is_virtual=false (in-person only)
    - timeslot_start=gte_now (future only)
    - Skips events already seen in exclude_ids (from geo query)
    - Skips events outside ORG_PASS_RADIUS_MILES unless they have a GA zipcode
      (private-address or missing-geocoordinate local events)

    Returns a list of raw API event dicts that pass the geo relevance check.
    """
    url: Optional[str] = ORG_EVENTS_BASE.format(org_id=org_id)
    first_page = True
    params = {
        "timeslot_start": "gte_now",
        "is_virtual": "false",
        "per_page": EVENTS_PER_PAGE,
    }
    org_events: list[dict] = []
    page_num = 0

    while url:
        page_num += 1
        try:
            if first_page:
                response = requests.get(url, params=params, timeout=30)
                first_page = False
            else:
                response = requests.get(url, timeout=30)

            if response.status_code == 429:
                logger.warning(
                    f"Mobilize org {org_slug} ({org_id}) rate-limited on page {page_num}, "
                    f"backing off {RATE_LIMIT_BACKOFF}s"
                )
                time.sleep(RATE_LIMIT_BACKOFF)
                continue

            if response.status_code == 404:
                logger.warning(f"Mobilize org {org_slug} ({org_id}): 404 not found, skipping")
                break

            response.raise_for_status()
            data = response.json()

        except requests.RequestException as e:
            logger.error(f"Mobilize org {org_slug} ({org_id}) fetch error on page {page_num}: {e}")
            break

        for event in data.get("data") or []:
            event_id = event.get("id")
            if event_id in exclude_ids:
                continue  # Already captured by geo query

            # Geographic relevance check
            location = event.get("location") or {}
            geo = location.get("location") or {}
            try:
                lat = float(geo.get("latitude") or 0) or None
                lng = float(geo.get("longitude") or 0) or None
            except (TypeError, ValueError):
                lat, lng = None, None
            postal_code = (location.get("postal_code") or "").strip()

            if not _is_in_atlanta_metro(lat, lng, postal_code):
                logger.debug(
                    f"Mobilize org {org_slug}: skipping out-of-metro event "
                    f"{(event.get('title') or '')[:50]!r} (postal={postal_code!r})"
                )
                continue

            org_events.append(event)

        url = data.get("next")
        if url:
            time.sleep(REQUEST_DELAY)

    logger.info(
        f"Mobilize org {org_slug} ({org_id}): {len(org_events)} new metro events "
        f"across {page_num} page(s)"
    )
    return org_events


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------

def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Mobilize.us public API for Atlanta metro civic/advocacy events.

    Filters:
    - In-person only (is_virtual=false at API level)
    - Zipcode 30303 within 30-mile radius
    - Excludes electoral/campaign orgs (CAMPAIGN, PARTY_COMMITTEE, PAC, COORDINATED)
    - Excludes campaign-ops event types from GRASSROOTS_GROUP orgs

    One event record per Mobilize event, using earliest upcoming timeslot as start_date.

    Returns: (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    producer_id = source.get("producer_id")

    events_found = 0
    events_new = 0
    events_updated = 0
    skipped_electoral = 0
    skipped_no_location = 0
    skipped_no_timeslot = 0

    try:
        # --- Pass 1: geo query (zipcode + radius) ---
        geo_events = fetch_all_events()
        geo_event_ids: set[int] = {e["id"] for e in geo_events if e.get("id")}
        logger.info(
            f"Mobilize geo pass: {len(geo_events)} events. "
            f"Starting org-specific pass for {len(CIVIC_ORG_IDS)} Atlanta-area orgs..."
        )

        # --- Pass 2: org-specific supplemental fetch ---
        org_events: list[dict] = []
        for org_id, org_slug in CIVIC_ORG_IDS.items():
            events = fetch_org_events(org_id, org_slug, exclude_ids=geo_event_ids)
            org_events.extend(events)
            # Add newly seen IDs so later orgs don't duplicate (e.g., same event
            # cross-posted by two orgs won't produce duplicate records)
            for e in events:
                if e.get("id"):
                    geo_event_ids.add(e["id"])
            time.sleep(REQUEST_DELAY)

        raw_events = geo_events + org_events
        logger.info(
            f"Mobilize combined: {len(geo_events)} geo events + "
            f"{len(org_events)} org-specific events = {len(raw_events)} total to process"
        )
        logger.info(f"Processing {len(raw_events)} raw Mobilize events from API...")

        for api_event in raw_events:
            try:
                title = (api_event.get("title") or "").strip()
                if not title:
                    continue

                # ----- Electoral content gate -----
                include, reason = should_include_event(api_event)
                if not include:
                    skipped_electoral += 1
                    logger.debug(f"Skipped (electoral): {title[:60]} — {reason}")
                    continue

                # ----- Location / venue -----
                location = api_event.get("location") or {}
                venue_data = build_venue_data(location, event_title=title)
                if not venue_data:
                    skipped_no_location += 1
                    logger.debug(f"Skipped (no location): {title[:60]}")
                    continue

                venue_id = get_or_create_venue(venue_data)
                venue_name_for_hash = venue_data["name"]

                # ----- Timeslot selection -----
                timeslots = api_event.get("timeslots") or []
                start_date, start_time, end_date, end_time = select_timeslots(timeslots)

                if not start_date:
                    skipped_no_timeslot += 1
                    logger.debug(f"Skipped (no upcoming timeslot): {title[:60]}")
                    continue

                events_found += 1

                # ----- Description -----
                description = (api_event.get("description") or "").strip()
                if not description:
                    description = (api_event.get("summary") or "").strip()
                if description and len(description) > 2000:
                    description = description[:2000]

                # ----- Tag construction -----
                event_type = (api_event.get("event_type") or "OTHER").upper()
                engagement_tags = MOBILIZE_TYPE_ENGAGEMENT_MAP.get(event_type, ["attend"])
                cause_tags = infer_cause_tags(title, description)

                sponsor = api_event.get("sponsor") or {}
                org_type = (sponsor.get("org_type") or "").upper()
                org_tags: list[str] = []
                if org_type == "GOVERNMENT":
                    org_tags.append("government")
                elif org_type in ("C3", "C4"):
                    org_tags.append("nonprofit")
                elif org_type == "UNION":
                    org_tags.append("labor")

                civic_process_tags = infer_civic_process_tags(title, description)

                raw_tags = ["activism"] + engagement_tags + cause_tags + civic_process_tags + org_tags
                # Deduplicate, preserving insertion order
                seen_tags: set[str] = set()
                tags: list[str] = []
                for t in raw_tags:
                    if t not in seen_tags:
                        seen_tags.add(t)
                        tags.append(t)

                # ----- Series hint for events with 3+ upcoming timeslots -----
                upcoming_count = sum(
                    1 for ts in timeslots
                    if ts.get("start_date") and ts["start_date"] >= int(datetime.now(tz=timezone.utc).timestamp())
                )
                is_recurring = upcoming_count >= 3
                series_hint = None
                if is_recurring:
                    series_hint = {
                        "series_type": "recurring_show",
                        "series_title": title,
                        "frequency": "irregular",
                    }

                # ----- Dedup hash -----
                content_hash = generate_content_hash(title, venue_name_for_hash, start_date)

                browser_url = api_event.get("browser_url") or ""
                image_url = api_event.get("featured_image_url")

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "producer_id": producer_id,
                    "title": title[:500],
                    "description": description or None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": "civic",
                    "subcategory": "activism",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,  # Mobilize civic events are free to attend
                    "source_url": browser_url,
                    "ticket_url": browser_url,
                    "image_url": image_url,
                    "raw_text": None,
                    "extraction_confidence": 0.9,
                    "is_recurring": is_recurring,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.debug(f"Added: {title[:60]} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{title[:60]}': {e}")

            except Exception as e:
                logger.error(f"Error processing Mobilize event: {e}")
                continue

        logger.info(
            f"Mobilize API crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated | "
            f"skipped: {skipped_electoral} electoral, "
            f"{skipped_no_location} no-location, "
            f"{skipped_no_timeslot} no-upcoming-timeslot"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Mobilize API: {e}")
        raise

    return events_found, events_new, events_updated
