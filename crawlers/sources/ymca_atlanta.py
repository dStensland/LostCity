"""
Crawler for YMCA of Metro Atlanta (ymcaatlanta.org).

Coverage strategy
-----------------
The YMCA site has two distinct content layers:

  1. Community events — published as Drupal nodes at /events (typically a handful
     of entries: open-to-public events like Healthy Kids Day, Veterans Expos, etc.).
     Full structured data is server-rendered — no JS required. Each event page has:
       - Structured start/end datetime in an "Add to Calendar" <var> widget
       - Human-readable date string in <div class="date-start">
       - Location links to specific branches in wrapper-field-event-location
       - Description in field-event-description
       - Image in node__content
       - Registration CTA links (Jotform, Eventbrite, etc.)

  2. Program registrations (swim lessons, sports, camps, afterschool) — these live
     inside a Salesforce Experience Cloud (LWC) app at /activity-finder and
     ymcaatlanta.my.site.com. The app requires JavaScript execution to render;
     no public API or static endpoint is available without authentication.
     This layer is NOT crawled — program pages are too dynamic and event-sparse.

This crawler covers layer 1 only. The /events listing is small (typically < 10
items) with no pagination, so a single pass is sufficient.

Multi-branch handling
---------------------
Community events often take place simultaneously at many branches. For each event,
we:
  - Parse the location links in wrapper-field-event-location
  - Match branch slugs against our BRANCHES registry (Atlanta metro only)
  - Emit one record per matched branch, with the correct venue and coordinates

If no Atlanta-area branch is matched, we fall back to a generic metro-wide venue
record so the event isn't silently dropped.

Pagination / discovery
----------------------
The /events Drupal view has no pagination; all upcoming events appear on a single
page. The Drupal Views AJAX endpoint can be used for dynamic filtering, but since
the full listing fits on one page this is unnecessary.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ymcaatlanta.org"
EVENTS_URL = f"{BASE_URL}/events"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Polite delay between requests (seconds)
REQUEST_DELAY = 1.5

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

# ---------------------------------------------------------------------------
# Branch registry — Atlanta metro branches only.
#
# Keys are the /locations/<slug> path segments used by ymcaatlanta.org.
# Coordinates sourced from the site's Leaflet openyMap JS config (openyMap[]).
# Only includes branches in the Atlanta metro footprint; Augusta, Greensboro,
# and other remote branches are excluded intentionally.
# ---------------------------------------------------------------------------

BRANCHES: dict[str, dict] = {
    "andrew-and-walter-young-family-ymca": {
        "name": "Andrew and Walter Young Family YMCA",
        "slug": "ymca-andrew-young-atlanta",
        "address": "2220 Campbellton Road SW",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30311",
        "lat": 33.70485,
        "lng": -84.46168,
        "neighborhood": "Southwest Atlanta",
    },
    "arthur-m-blank-family-youth-ymca-program-facility-only": {
        "name": "Arthur M. Blank Family Youth YMCA",
        "slug": "ymca-blank-youth-atlanta",
        "address": "555 Luckie Street",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "lat": 33.77058,
        "lng": -84.39512,
        "neighborhood": "Downtown",
    },
    "carl-e-sanders-family-ymca-buckhead": {
        "name": "Carl E. Sanders Family YMCA at Buckhead",
        "slug": "ymca-sanders-buckhead",
        "address": "1160 Moores Mill Road",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30327",
        "lat": 33.83147,
        "lng": -84.42510,
        "neighborhood": "Buckhead",
    },
    "cowart-family-ymca": {
        "name": "Cowart Family YMCA",
        "slug": "ymca-cowart-dunwoody",
        "address": "3692 Ashford Dunwoody Rd",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30319",
        "lat": 33.89907,
        "lng": -84.33258,
        "neighborhood": "Dunwoody",
    },
    "decatur-family-ymca": {
        "name": "Decatur Family YMCA",
        "slug": "ymca-decatur",
        "address": "1100 Clairemont Ave.",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.78756,
        "lng": -84.30688,
        "neighborhood": "Decatur",
    },
    "east-lake-family-ymca": {
        "name": "East Lake Family YMCA",
        "slug": "ymca-east-lake",
        "address": "275 Eva Davis Way",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "lat": 33.74641,
        "lng": -84.31460,
        "neighborhood": "East Lake",
    },
    "villages-carver-family-ymca": {
        "name": "The Villages at Carver Family YMCA",
        "slug": "ymca-carver-atlanta",
        "address": "1600 Pryor Road",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "lat": 33.71071,
        "lng": -84.39233,
        "neighborhood": "Pittsburgh",
    },
    "ymca-good-sam": {
        "name": "YMCA at Good Sam",
        "slug": "ymca-good-sam-atlanta",
        "address": "999 Donald Lee Hollowell PKWY NW",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.77380,
        "lng": -84.41990,
        "neighborhood": "West Midtown",
    },
    "wade-walker-park-family-ymca": {
        "name": "Wade Walker Park Family YMCA",
        "slug": "ymca-wade-walker-stone-mountain",
        "address": "5605 Rockbridge Road",
        "city": "Stone Mountain",
        "state": "GA",
        "zip": "30088",
        "lat": 33.78693,
        "lng": -84.16505,
        "neighborhood": "Stone Mountain",
    },
    "ymca-morehouse-school-medicine": {
        "name": "YMCA at Morehouse School of Medicine",
        "slug": "ymca-morehouse-atlanta",
        "address": "455 Lee Street",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "lat": 33.74255,
        "lng": -84.41342,
        "neighborhood": "West End",
    },
    "ymca-youth-and-teen-development-center-program-site-only": {
        "name": "YMCA Youth and Teen Development Center",
        "slug": "ymca-youth-teen-dev-atlanta",
        "address": "1765 Memorial Dr SE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "lat": 33.74727,
        "lng": -84.32849,
        "neighborhood": "Reynoldstown",
    },
    "ed-isaksonalpharetta-family-ymca": {
        "name": "Ed Isakson/Alpharetta Family YMCA",
        "slug": "ymca-alpharetta",
        "address": "3655 Preston Ridge Road",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30005",
        "lat": 34.07042,
        "lng": -84.25106,
        "neighborhood": "Alpharetta",
    },
    "jm-tull-gwinnett-family-ymca": {
        "name": "J.M. Tull-Gwinnett Family YMCA",
        "slug": "ymca-gwinnett-lawrenceville",
        "address": "2985 Sugarloaf Parkway",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30045",
        "lat": 33.91999,
        "lng": -84.00336,
        "neighborhood": "Lawrenceville",
    },
    "mccleskey-east-cobb-family-ymca": {
        "name": "McCleskey-East Cobb Family YMCA",
        "slug": "ymca-mccleskey-east-cobb",
        "address": "1055 East Piedmont Rd",
        "city": "Marietta",
        "state": "GA",
        "zip": "30062",
        "lat": 33.97774,
        "lng": -84.48068,
        "neighborhood": "East Cobb",
    },
    "northeast-cobb-family-ymca": {
        "name": "Northeast Cobb Family YMCA",
        "slug": "ymca-northeast-cobb-marietta",
        "address": "3010 Johnson Ferry Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30062",
        "lat": 34.02208,
        "lng": -84.42326,
        "neighborhood": "Northeast Cobb",
    },
    "northwest-family-ymca": {
        "name": "Northwest Family YMCA",
        "slug": "ymca-northwest-kennesaw",
        "address": "1700 Dennis Kemp Lane",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30152",
        "lat": 33.99801,
        "lng": -84.70035,
        "neighborhood": "Kennesaw",
    },
    "robert-d-fowler-family-ymca": {
        "name": "Robert D. Fowler Family YMCA",
        "slug": "ymca-fowler-peachtree-corners",
        "address": "5600 W. Jones Bridge Rd.",
        "city": "Peachtree Corners",
        "state": "GA",
        "zip": "30092",
        "lat": 33.97880,
        "lng": -84.22650,
        "neighborhood": "Peachtree Corners",
    },
    # South metro (included — Summit/Newnan hosts the annual Veterans Expo)
    "summit-family-ymca": {
        "name": "Summit Family YMCA",
        "slug": "ymca-summit-newnan",
        "address": "1765 East Hwy 34",
        "city": "Newnan",
        "state": "GA",
        "zip": "30265",
        "lat": 33.40067,
        "lng": -84.72122,
        "neighborhood": "Newnan",
    },
    # Additional outer-metro branches that appear in multi-location events
    "covington-family-ymca": {
        "name": "Covington Family YMCA",
        "slug": "ymca-covington",
        "address": "2140 Newton Drive",
        "city": "Covington",
        "state": "GA",
        "zip": "30014",
        "lat": 33.59928,
        "lng": -83.85182,
        "neighborhood": "Covington",
    },
    "forsyth-county-family-ymca": {
        "name": "Forsyth County Family YMCA",
        "slug": "ymca-forsyth-cumming",
        "address": "6050 Y Street",
        "city": "Cumming",
        "state": "GA",
        "zip": "30040",
        "lat": 34.18287,
        "lng": -84.21961,
        "neighborhood": "Cumming",
    },
    "g-cecil-pruett-community-center-family-ymca": {
        "name": "G. Cecil Pruett Community Center Family YMCA",
        "slug": "ymca-pruett-canton",
        "address": "151 Waleska Street",
        "city": "Canton",
        "state": "GA",
        "zip": "30114",
        "lat": 34.24241,
        "lng": -84.49315,
        "neighborhood": "Canton",
    },
    "south-dekalb-ymca-program-site-only": {
        "name": "South DeKalb YMCA",
        "slug": "ymca-south-dekalb",
        "address": "2565 Snapfinger Road",
        "city": "Decatur",
        "state": "GA",
        "zip": "30034",
        "lat": 33.70491,
        "lng": -84.21714,
        "neighborhood": "South DeKalb",
    },
}

# Fallback venue used when an event has no location links, or when all
# linked locations are outside our BRANCHES registry.
_GENERIC_VENUE: dict = {
    "name": "YMCA of Metro Atlanta",
    "slug": "ymca-metro-atlanta",
    "address": "555 Luckie Street",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.77058,
    "lng": -84.39512,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["family-friendly", "all-ages"],
}


def _build_destination_envelope(venue_id: int, venue_data: dict) -> TypedEntityEnvelope:
    venue_name = str(venue_data.get("name") or "YMCA of Metro Atlanta").strip()
    city = str(venue_data.get("city") or "Atlanta").strip().lower()
    is_generic = venue_data.get("slug") == _GENERIC_VENUE["slug"]
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "community_center",
            "commitment_tier": "halfday",
            "primary_activity": "family YMCA branch visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "outdoor-indoor-mix", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "practical_notes": (
                f"{venue_name} works best when the family plan is built around a specific class, camp, swim block, or community program rather than treating the YMCA as a casual attraction stop."
            ),
            "accessibility_notes": (
                "YMCA branches tend to be lower-friction indoor/outdoor community campuses, but the value of the visit depends more on the scheduled activity mix than on broad destination wandering."
            ),
            "fee_note": "Many branch amenities and programs depend on membership, registration, or specific public event access.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "community_center",
                "city": city,
                "site_pattern": "ymca_branch" if not is_generic else "ymca_generic",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "family-community-program-campus",
            "title": "Family community program campus",
            "feature_type": "amenity",
            "description": f"{venue_name} is best understood as a family program campus for camps, classes, fitness, and community activities rather than a single-format destination.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "planned-ymca-day-not-drop-in-attraction",
            "title": "Planned YMCA day, not drop-in attraction",
            "feature_type": "amenity",
            "description": "YMCA family value is strongest when the visit is anchored by a known class, swim, camp, or community event instead of open-ended wandering.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    return envelope


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _get(url: str, session: requests.Session, *, retries: int = 3) -> Optional[str]:
    """Fetch URL with exponential backoff. Returns HTML text or None."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=REQUEST_HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.warning(
                    "Failed to fetch %s after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
    return None


# ---------------------------------------------------------------------------
# Listing page: collect event detail URLs
# ---------------------------------------------------------------------------


def _collect_event_urls(html: str) -> list[str]:
    """
    Parse the /events listing page and return unique event detail URLs.

    Event teasers are <article class="node--type-event"> elements, each
    containing an <a href="/events/<slug>"> link. Falls back to scanning all
    anchors for /events/<slug> patterns in case the markup structure changes.
    """
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    urls: list[str] = []

    for article in soup.find_all(
        "article", class_=lambda c: c and "node--type-event" in c
    ):
        link = article.find("a", href=re.compile(r"^/events/[^/?#]+/?$"))
        if link:
            full = urljoin(BASE_URL, link["href"])
            if full not in seen:
                seen.add(full)
                urls.append(full)

    # Fallback: any anchor pointing to /events/<slug>
    if not urls:
        for a in soup.find_all("a", href=re.compile(r"^/events/[^/?#]+/?$")):
            full = urljoin(BASE_URL, a["href"])
            if full not in seen:
                seen.add(full)
                urls.append(full)

    return urls


# ---------------------------------------------------------------------------
# Event detail page parsers
# ---------------------------------------------------------------------------


def _parse_atc_datetime(
    soup: BeautifulSoup,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Extract structured datetime from the "Add to Calendar" widget.

    The site embeds machine-readable datetimes in:
      <var class="atc_event">
        <var class="atc_date_start">2026-04-18 11:00:00</var>
        <var class="atc_date_end">2026-04-18 14:00:00</var>
      </var>

    Returns (start_date, start_time, end_date, end_time) as "YYYY-MM-DD"/"HH:MM",
    or None where unavailable.
    """
    atc = soup.find("var", class_="atc_event")
    if not atc:
        return None, None, None, None

    def _var(cls: str) -> Optional[str]:
        el = atc.find("var", class_=cls)
        return el.get_text(strip=True) if el else None

    def _split(raw: Optional[str]) -> tuple[Optional[str], Optional[str]]:
        if not raw:
            return None, None
        m = re.match(r"(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})", raw)
        if m:
            return m.group(1), m.group(2)
        m = re.match(r"(\d{4}-\d{2}-\d{2})", raw)
        if m:
            return m.group(1), None
        return None, None

    start_date, start_time = _split(_var("atc_date_start"))
    end_date, end_time = _split(_var("atc_date_end"))
    return start_date, start_time, end_date, end_time


def _parse_date_fallback(soup: BeautifulSoup) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date/time from the human-readable <div class="date-start"> element.

    Format: "Apr 18, 11:00 am - Apr 18, 2:00 pm"
    Returns (start_date, start_time) as ("YYYY-MM-DD", "HH:MM") or (None, None).
    """
    date_el = soup.find(class_="date-start")
    if not date_el:
        return None, None

    text = date_el.get_text(strip=True)
    m = re.match(
        r"([A-Za-z]+ \d{1,2}),\s*(\d{1,2}:\d{2}\s*(?:am|pm))",
        text,
        re.IGNORECASE,
    )
    if not m:
        return None, None

    date_part = m.group(1).strip()  # "Apr 18"
    time_part = m.group(2).strip()  # "11:00 am"

    now = datetime.now()
    for year in (now.year, now.year + 1):
        try:
            dt = datetime.strptime(f"{date_part} {year}", "%b %d %Y")
            start_date = dt.strftime("%Y-%m-%d")
            try:
                t = datetime.strptime(time_part.upper(), "%I:%M %p")
                start_time: Optional[str] = t.strftime("%H:%M")
            except ValueError:
                start_time = None
            return start_date, start_time
        except ValueError:
            continue

    return None, None


def _parse_location_slugs(soup: BeautifulSoup) -> list[str]:
    """
    Extract branch location slugs from the event's location section.

    The site renders:
      <div class="wrapper-field-event-location event-locations">
        <span><a href="/locations/decatur-family-ymca">Decatur Family YMCA</a></span>
        ...
      </div>

    Returns deduplicated list of path segments (e.g. ["decatur-family-ymca"]).
    """
    slugs: list[str] = []
    loc_div = soup.find(
        class_=re.compile(r"wrapper-field-event-location|event-locations")
    )
    if not loc_div:
        return slugs

    seen: set[str] = set()
    for a in loc_div.find_all("a", href=re.compile(r"^/locations/")):
        slug = a["href"].split("/locations/")[-1].rstrip("/")
        if slug and slug not in seen:
            seen.add(slug)
            slugs.append(slug)

    return slugs


def _parse_image_url(soup: BeautifulSoup) -> Optional[str]:
    """
    Extract event hero image.

    Priority: og:image > first <img> in node__content.
    """
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]

    node = soup.find(class_="node__content")
    if node:
        img = node.find("img", src=True)
        if img:
            src: str = img["src"]
            if src.startswith("http"):
                return src
            return urljoin(BASE_URL, src)

    return None


def _parse_description(soup: BeautifulSoup) -> Optional[str]:
    """
    Extract plain-text description from field-event-description.

    Falls back to og:description. Truncates at 1200 characters.
    """
    desc_el = soup.find(class_=re.compile(r"field-event-description"))
    if desc_el:
        text = desc_el.get_text(" ", strip=True)
        text = re.sub(r"\s{3,}", "  ", text)
        if len(text) > 40:
            return text[:1200]

    meta = soup.find("meta", property="og:description")
    if meta and meta.get("content"):
        content = meta["content"].strip()
        if len(content) > 40:
            return content[:1200]

    return None


def _parse_ticket_url(soup: BeautifulSoup) -> Optional[str]:
    """
    Find the primary registration/ticket URL in the event description area.

    Looks for explicit registration CTAs (Register, Ticket, Jotform, Eventbrite).
    Returns None if no match — callers should fall back to the event's canonical URL.
    """
    desc_el = soup.find(class_=re.compile(r"field-event-description"))
    if not desc_el:
        return None

    for a in desc_el.find_all("a", href=True):
        href: str = a["href"]
        text = a.get_text(strip=True).lower()
        if any(
            kw in href.lower() or kw in text
            for kw in [
                "register",
                "ticket",
                "signup",
                "sign up",
                "jotform",
                "eventbrite",
            ]
        ):
            return href

    return None


def _parse_is_free(soup: BeautifulSoup) -> bool:
    """Return True when the event page indicates free admission."""
    text = soup.get_text(" ").lower()
    return bool(
        re.search(
            r"\bfree\b(?:\s+(?:and|open|to\s+the\s+public|admission|event))?", text
        )
    )


def _infer_category(title: str, description: Optional[str]) -> str:
    """Infer the LostCity event category from title and description."""
    combined = (title + " " + (description or "")).lower()
    if any(
        kw in combined
        for kw in [
            "basketball",
            "soccer",
            "volleyball",
            "swim league",
            "sport",
            "triathlon",
        ]
    ):
        return "sports"
    if any(
        kw in combined
        for kw in [
            "kids day",
            "family",
            "children",
            "youth",
            "camp",
            "preschool",
            "afterschool",
            "teen",
            "young",
        ]
    ):
        return "family"
    return "community"


def _build_tags(title: str, description: Optional[str], is_free: bool) -> list[str]:
    """Construct a tag list for a YMCA community event."""
    combined = (title + " " + (description or "")).lower()
    tags: list[str] = ["ymca", "family-friendly", "community", "all-ages"]

    if is_free:
        tags.append("free")
    if any(kw in combined for kw in ["swim", "pool", "aquatic"]):
        tags.append("swimming")
    if any(kw in combined for kw in ["basketball", "soccer", "volleyball", "sport"]):
        tags.append("sports")
    if any(kw in combined for kw in ["veteran", "military", "service member"]):
        tags.append("veterans")
    if any(kw in combined for kw in ["health", "wellness", "nutrition", "fitness"]):
        tags.append("health")
    if any(kw in combined for kw in ["stem", "steam", "education", "learning"]):
        tags.append("educational")
    if any(kw in combined for kw in ["kids", "children", "youth", "camp", "camper"]):
        tags.extend(["kids", "elementary"])
    if any(kw in combined for kw in ["teen", "teenage"]):
        tags.append("teens")

    # Deduplicate preserving insertion order
    seen: set[str] = set()
    out: list[str] = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _venue_data_for_branch(branch_slug: str) -> Optional[dict]:
    """
    Build a venue_data dict for a branch slug, or None if not in registry.
    """
    branch = BRANCHES.get(branch_slug)
    if not branch:
        return None
    return {
        "name": branch["name"],
        "slug": branch["slug"],
        "address": branch["address"],
        "neighborhood": branch["neighborhood"],
        "city": branch["city"],
        "state": branch["state"],
        "zip": branch["zip"],
        "lat": branch["lat"],
        "lng": branch["lng"],
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": BASE_URL,
        "vibes": ["family-friendly", "all-ages"],
    }


# ---------------------------------------------------------------------------
# Single event page processor
# ---------------------------------------------------------------------------


def _process_event_page(
    html: str,
    event_url: str,
    source_id: int,
    today: "datetime.date",
) -> tuple[int, int, int]:
    """
    Parse one /events/<slug> page and upsert records.

    Multi-branch events produce one record per matched Atlanta-area branch.
    Falls back to generic YMCA metro venue if no branches match.

    Returns (events_found, events_new, events_updated).
    """
    soup = BeautifulSoup(html, "html.parser")
    found = new = updated = 0

    # Title
    h1 = soup.find("h1")
    if not h1:
        logger.warning("No <h1> on event page: %s", event_url)
        return 0, 0, 0
    title = h1.get_text(strip=True)
    if not title:
        logger.warning("Empty title on: %s", event_url)
        return 0, 0, 0

    # Datetime — structured ATC widget first, human-readable fallback
    start_date, start_time, end_date, end_time = _parse_atc_datetime(soup)
    if not start_date:
        start_date, start_time = _parse_date_fallback(soup)
        end_date = end_time = None

    if not start_date:
        logger.warning("Cannot parse date for '%s' at %s", title, event_url)
        return 0, 0, 0

    try:
        event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    except ValueError:
        logger.warning("Invalid date '%s' for '%s'", start_date, title)
        return 0, 0, 0

    if event_date < today:
        logger.debug("Skipping past event '%s' (%s)", title, start_date)
        return 0, 0, 0

    # Location branches
    location_slugs = _parse_location_slugs(soup)
    matched_slugs = [s for s in location_slugs if s in BRANCHES]

    # Fallback: generic metro YMCA venue
    venues_to_emit: list[dict] = []
    if matched_slugs:
        for slug in matched_slugs:
            vd = _venue_data_for_branch(slug)
            if vd:
                venues_to_emit.append(vd)
    if not venues_to_emit:
        venues_to_emit = [dict(_GENERIC_VENUE)]

    description = _parse_description(soup)
    image_url = _parse_image_url(soup)
    ticket_url = _parse_ticket_url(soup) or event_url
    is_free = _parse_is_free(soup)
    category = _infer_category(title, description)
    tags = _build_tags(title, description, is_free)

    for venue_data in venues_to_emit:
        try:
            venue_id = get_or_create_venue(venue_data)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id, venue_data))
        except Exception as exc:
            logger.error(
                "Failed to get/create venue '%s' for '%s': %s",
                venue_data.get("name"),
                title,
                exc,
            )
            continue

        # Include branch slug in hash so multi-branch events produce distinct records
        branch_discriminant = venue_data.get("slug", "")
        hash_key = f"{start_date}|{start_time or ''}|{branch_discriminant}"
        content_hash = generate_content_hash(title, venue_data["name"], hash_key)

        event_record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "is_all_day": False,
            "category": category,
            "tags": tags,
            "price_min": 0.0 if is_free else None,
            "price_max": 0.0 if is_free else None,
            "price_note": "Free" if is_free else None,
            "is_free": is_free,
            "source_url": event_url,
            "ticket_url": ticket_url,
            "image_url": image_url,
            "age_min": None,
            "age_max": None,
            "raw_text": (
                f"{title} | {start_date} {start_time or ''} | {venue_data['name']}"
            ),
            "extraction_confidence": 0.92,
            "is_recurring": False,
            "content_hash": content_hash,
        }

        found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
        else:
            try:
                insert_event(event_record)
                new += 1
                logger.info(
                    "Inserted: '%s' on %s at %s",
                    title,
                    start_date,
                    venue_data["name"],
                )
            except Exception as exc:
                logger.error(
                    "Failed to insert '%s' at %s on %s: %s",
                    title,
                    venue_data["name"],
                    start_date,
                    exc,
                )

    return found, new, updated


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl YMCA of Metro Atlanta community events.

    Steps:
      1. Fetch /events listing; collect event detail URLs from article teasers.
      2. For each detail page, extract structured datetime, branch locations,
         description, image, and registration URL.
      3. Emit one record per Atlanta-area branch listed on the event; fall back
         to a generic metro YMCA venue when no branches match.
      4. Upsert against content hash (insert new, smart-update existing).

    The /events listing has no pagination — all upcoming events appear on a single
    page (typically < 10 items at any given time).

    Returns (events_found, events_new, events_updated).
    """
    source_id: int = source["id"]
    total_found = total_new = total_updated = 0
    session = requests.Session()
    today = datetime.now().date()

    try:
        # Step 1: Discover event URLs
        logger.info("YMCA Atlanta: fetching events listing: %s", EVENTS_URL)
        listing_html = _get(EVENTS_URL, session)
        if not listing_html:
            logger.warning("YMCA Atlanta: failed to fetch /events listing page")
            return 0, 0, 0

        event_urls = _collect_event_urls(listing_html)
        logger.info("YMCA Atlanta: discovered %d event URL(s)", len(event_urls))

        if not event_urls:
            # This is expected between campaign periods — not an error
            logger.info(
                "YMCA Atlanta: no events on listing page. "
                "Normal outside major campaign periods (Healthy Kids Day, etc.)."
            )
            return 0, 0, 0

        # Step 2: Process each event detail page
        for event_url in event_urls:
            logger.info("YMCA Atlanta: processing %s", event_url)
            try:
                event_html = _get(event_url, session)
                if not event_html:
                    logger.warning("YMCA Atlanta: fetch failed for %s", event_url)
                    time.sleep(REQUEST_DELAY)
                    continue

                found, new, upd = _process_event_page(
                    event_html, event_url, source_id, today
                )
                total_found += found
                total_new += new
                total_updated += upd

            except Exception as exc:
                logger.error("YMCA Atlanta: error processing %s: %s", event_url, exc)

            time.sleep(REQUEST_DELAY)

    except Exception as exc:
        logger.error("YMCA Atlanta: crawl failed: %s", exc)
        raise

    logger.info(
        "YMCA Atlanta crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
