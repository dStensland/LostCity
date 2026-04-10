"""
Crawler for National Park Service sites in the Atlanta metro area.

Covers three NPS units:
  - MLK National Historical Park (malu)
  - Kennesaw Mountain National Battlefield Park (kemo)
  - Chattahoochee River National Recreation Area (chat)

Uses the NPS public API (https://developer.nps.gov/api/v1/) to fetch park
info and scheduled events (ranger programs, guided tours, seasonal activities).

API key: NPS_API_KEY env var, falls back to rate-limited DEMO_KEY.
Source slug: nps-atlanta-parks
Source type: api
Crawl frequency: weekly
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

import requests

from config import get_config
from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
    upsert_venue_feature,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

_NPS_BASE = "https://developer.nps.gov/api/v1"
_REQUEST_TIMEOUT = 20
_INTER_REQUEST_DELAY_S = 0.5  # NPS DEMO_KEY is rate-limited at 4 req/min

# ---------------------------------------------------------------------------
# Park definitions
# ---------------------------------------------------------------------------

PARKS: list[dict] = [
    {
        "park_code": "malu",
        "place_data": {
            "name": "Martin Luther King Jr. National Historical Park",
            "slug": "mlk-national-historical-park",
            "address": "450 Auburn Ave NE",
            "neighborhood": "Sweet Auburn",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30312",
            "lat": 33.7550,
            "lng": -84.3733,
            "place_type": "museum",
            "spot_type": "museum",
            "website": "https://www.nps.gov/malu/index.htm",
            "vibes": [
                "historic",
                "family-friendly",
                "all-ages",
                "wheelchair-accessible",
            ],
            "description": (
                "Martin Luther King Jr. National Historical Park preserves the childhood home, "
                "church, and crypt of Dr. Martin Luther King Jr. in Atlanta's Sweet Auburn district. "
                "The park encompasses Ebenezer Baptist Church Heritage Sanctuary, the Birth Home, "
                "the International Civil Rights Walk of Fame, Freedom Hall, and related sites "
                "along Auburn Avenue — the heart of Atlanta's historic Black business community. "
                "Free admission; ranger-led programs offered year-round."
            ),
        },
        "features": [
            {
                "slug": "mlk-birth-home",
                "title": "Birth Home of Dr. Martin Luther King Jr.",
                "feature_type": "attraction",
                "description": (
                    "The Birth Home at 501 Auburn Ave NE is where Dr. Martin Luther King Jr. was "
                    "born on January 15, 1929, and spent the first twelve years of his life. "
                    "The Victorian-style house has been restored to its 1930s appearance and is "
                    "accessible by free ranger-led tours (timed-entry tickets required). "
                    "Tours depart from the visitor center and provide a deeply personal look at "
                    "King's formative years in the Sweet Auburn neighborhood."
                ),
                "source_url": "https://www.nps.gov/malu/planyourvisit/birth-home-tour.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 10,
                "tags": ["historic", "tour", "civil-rights", "family-friendly"],
            },
            {
                "slug": "ebenezer-baptist-heritage-sanctuary",
                "title": "Ebenezer Baptist Church Heritage Sanctuary",
                "feature_type": "attraction",
                "description": (
                    "The original Ebenezer Baptist Church sanctuary, where Dr. King, his father "
                    "Daddy King, and his grandfather A.D. Williams all served as pastors, is now "
                    "part of the National Historical Park. Dr. King preached his first sermon here "
                    "at age 17. The sanctuary is open for self-guided visits and serves as the site "
                    "of commemorative services. The congregation relocated to the new sanctuary "
                    "across the street in 1999."
                ),
                "source_url": "https://www.nps.gov/malu/planyourvisit/ebenezer-baptist-church.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 20,
                "tags": ["historic", "church", "civil-rights", "self-guided"],
            },
            {
                "slug": "international-civil-rights-walk-of-fame",
                "title": "International Civil Rights Walk of Fame",
                "feature_type": "attraction",
                "description": (
                    "The International Civil Rights Walk of Fame is an outdoor plaza at the Martin "
                    "Luther King Jr. National Historical Park featuring footprint castings of civil "
                    "rights leaders and human rights champions, including Rosa Parks, John Lewis, "
                    "President Jimmy Carter, Archbishop Desmond Tutu, and Nelson Mandela. Located "
                    "next to the King Center, the walk honors those who sacrificed to advance civil "
                    "rights and social justice around the world."
                ),
                "source_url": "https://www.nps.gov/malu/planyourvisit/civil-rights-walk-of-fame.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 30,
                "tags": [
                    "outdoor",
                    "civil-rights",
                    "landmark",
                    "historic",
                    "self-guided",
                ],
            },
            {
                "slug": "freedom-hall",
                "title": "Freedom Hall",
                "feature_type": "attraction",
                "description": (
                    "Freedom Hall, part of The King Center complex adjacent to the National "
                    "Historical Park, displays personal artifacts and documents related to Dr. "
                    "King's life and the civil rights movement. The site includes the King Center's "
                    "reflecting pool and the crypt of Dr. King and Coretta Scott King, situated on "
                    "a marble platform over a long, rectangular pool symbolic of the reflecting "
                    "pool at the Lincoln Memorial in Washington, D.C."
                ),
                "source_url": "https://thekingcenter.org/visit/",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 40,
                "tags": ["museum", "civil-rights", "historic", "landmark"],
            },
        ],
    },
    {
        "park_code": "kemo",
        "place_data": {
            "name": "Kennesaw Mountain National Battlefield Park",
            "slug": "kennesaw-mountain-national-battlefield-park",
            "address": "900 Kennesaw Mountain Dr",
            "neighborhood": "Kennesaw",
            "city": "Kennesaw",
            "state": "GA",
            "zip": "30152",
            "lat": 33.9830,
            "lng": -84.5785,
            "place_type": "park",
            "spot_type": "park",
            "website": "https://www.nps.gov/kemo/index.htm",
            "vibes": [
                "outdoor-seating",
                "family-friendly",
                "dog-friendly",
                "historic",
                "all-ages",
            ],
            "description": (
                "Kennesaw Mountain National Battlefield Park preserves the site of a pivotal "
                "1864 Civil War battle in the Atlanta Campaign. The park offers over 20 miles "
                "of trails including the 2.2-mile Summit Trail to the mountain top, a visitor "
                "center with Civil War exhibits, and preserved earthworks at Cheatham Hill. "
                "One of the most-visited parks in the National Park System, it serves as a major "
                "outdoor recreation destination for Atlanta-area hikers, runners, and history enthusiasts."
            ),
        },
        "features": [
            {
                "slug": "kennesaw-mountain-summit-trail",
                "title": "Summit Trail",
                "feature_type": "attraction",
                "description": (
                    "The Summit Trail is a 2.2-mile round-trip hike from the Kennesaw Mountain "
                    "Visitor Center to the top of Kennesaw Mountain at 1,808 feet elevation. "
                    "The trail is moderately strenuous with a 700-foot elevation gain and rewards "
                    "hikers with panoramic views of Atlanta and the surrounding region. The paved "
                    "road to the summit is closed to private vehicles on weekends and holidays, "
                    "with a free shuttle available. This is one of the most popular hikes in "
                    "the Atlanta metro area."
                ),
                "source_url": "https://www.nps.gov/kemo/planyourvisit/hiking.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 10,
                "tags": ["hiking", "outdoor", "views", "trail"],
            },
            {
                "slug": "kennesaw-mountain-visitor-center",
                "title": "Kennesaw Mountain Visitor Center",
                "feature_type": "experience",
                "description": (
                    "The Kennesaw Mountain Visitor Center features a museum with Civil War "
                    "artifacts, interpretive exhibits on the 1864 Atlanta Campaign, a 22-minute "
                    "orientation film, and a bookstore. Rangers offer programs and can orient "
                    "visitors to the 2,965-acre park and its 20 miles of trails. The center "
                    "serves as the trailhead for the Summit Trail and the main hub for ranger-led "
                    "tours and programs."
                ),
                "source_url": "https://www.nps.gov/kemo/planyourvisit/visitorcenters.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 20,
                "tags": ["museum", "civil-war", "historic", "rangers"],
            },
            {
                "slug": "cheatham-hill",
                "title": "Cheatham Hill Battlefield",
                "feature_type": "attraction",
                "description": (
                    "Cheatham Hill preserves the site of the June 27, 1864 Battle of Kennesaw "
                    "Mountain's most intense fighting, where Union forces under Gen. William T. "
                    "Sherman launched a frontal assault on Confederate positions. The site features "
                    "preserved earthworks, an Illinois monument to the dead, and interpretive signs "
                    "explaining the battle. The Dead Angle — where Union soldiers fought at "
                    "point-blank range against Confederate entrenchments — is accessible via a "
                    "short walk from the Cheatham Hill parking area."
                ),
                "source_url": "https://www.nps.gov/kemo/planyourvisit/cheathamhill.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 30,
                "tags": ["civil-war", "historic", "outdoor", "battlefield"],
            },
            {
                "slug": "kennesaw-mountain-civil-war-earthworks",
                "title": "Civil War Earthworks and Artillery Positions",
                "feature_type": "attraction",
                "description": (
                    "Kennesaw Mountain National Battlefield Park contains some of the best-preserved "
                    "Civil War earthworks in the Southeast, including Confederate artillery positions "
                    "on Kennesaw Mountain's summit and along Little Kennesaw Mountain. These "
                    "earthworks — hastily constructed trenches, rifle pits, and cannon emplacements "
                    "in June 1864 — remain largely intact and are visible throughout the park, "
                    "providing a tangible connection to the soldiers who defended and assaulted "
                    "the mountain 160 years ago."
                ),
                "source_url": "https://www.nps.gov/kemo/learn/historyculture/index.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 40,
                "tags": [
                    "civil-war",
                    "historic",
                    "outdoor",
                    "battlefield",
                    "self-guided",
                ],
            },
        ],
    },
    {
        "park_code": "chat",
        "place_data": {
            "name": "Chattahoochee River National Recreation Area",
            "slug": "chattahoochee-river-national-recreation-area",
            "address": "1978 Island Ford Pkwy",
            "neighborhood": "Sandy Springs",
            "city": "Sandy Springs",
            "state": "GA",
            "zip": "30350",
            "lat": 33.9920,
            "lng": -84.3400,
            "place_type": "park",
            "spot_type": "park",
            "website": "https://www.nps.gov/chat/index.htm",
            "vibes": ["outdoor-seating", "family-friendly", "dog-friendly", "all-ages"],
            "description": (
                "Chattahoochee River National Recreation Area protects 48 miles of the "
                "Chattahoochee River corridor through metropolitan Atlanta, providing world-class "
                "trout fishing, whitewater rafting, hiking, and paddling within 15 miles of "
                "downtown Atlanta. The park's 15 units stretch from Buford Dam to Peachtree Creek "
                "and include popular destinations such as Island Ford, Cochran Shoals, Paces Mill, "
                "and Vickery Creek. It is one of the most urban national park units in the country."
            ),
        },
        "features": [
            {
                "slug": "chat-island-ford",
                "title": "Island Ford Unit — Island Ford Trail",
                "feature_type": "attraction",
                "description": (
                    "The Island Ford unit, site of the park headquarters, offers a popular 2.5-mile "
                    "loop trail along the Chattahoochee River with excellent trout fishing access "
                    "and a historic ford that General Sherman's Union Army crossed during the "
                    "Atlanta Campaign in 1864. The trailhead begins at the Island Ford Visitor "
                    "Center. Amenities include picnic areas, a boat ramp, and seasonal ranger "
                    "programs. The river here is designated a Blue Ribbon trout fishery."
                ),
                "source_url": "https://www.nps.gov/chat/planyourvisit/island-ford.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 10,
                "tags": ["hiking", "fishing", "outdoor", "trail", "river"],
            },
            {
                "slug": "chat-cochran-shoals",
                "title": "Cochran Shoals Unit",
                "feature_type": "attraction",
                "description": (
                    "Cochran Shoals is one of the most-visited units of the Chattahoochee River "
                    "NRA, featuring a 3.1-mile multi-use trail popular with runners, cyclists, and "
                    "walkers, plus river access at a series of shallow shoals. The unit draws "
                    "hundreds of thousands of visitors annually and includes picnic areas, a "
                    "fitness trail, and wetland habitat. The Cochran Shoals trail connects to the "
                    "nearby Sope Creek unit via a river crossing."
                ),
                "source_url": "https://www.nps.gov/chat/planyourvisit/cochran-shoals.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 20,
                "tags": ["hiking", "trail", "outdoor", "river", "fitness"],
            },
            {
                "slug": "chat-paces-mill",
                "title": "Paces Mill Unit",
                "feature_type": "attraction",
                "description": (
                    "Paces Mill is the most accessible Chattahoochee River NRA unit for downtown "
                    "Atlanta visitors, located within Cobb County just off I-285. The unit features "
                    "a sandy riverbank popular for wading and picnicking, a put-in point for "
                    "tubing and paddling, river trail access, and strong summer weekend crowds. "
                    "Paces Mill is the traditional southern end of popular tubing runs from "
                    "Morgan Falls Dam or Powers Ferry."
                ),
                "source_url": "https://www.nps.gov/chat/planyourvisit/paces-mill.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 30,
                "tags": ["river", "outdoor", "swimming", "picnic", "tubing"],
            },
            {
                "slug": "chat-vickery-creek",
                "title": "Vickery Creek Unit — Vickery Creek Falls",
                "feature_type": "attraction",
                "description": (
                    "The Vickery Creek unit in Roswell features a scenic 3.5-mile trail system "
                    "along Vickery Creek culminating at an impressive 30-foot waterfall and the "
                    "ruins of a 19th-century mill dam. The trail passes through old-growth forest "
                    "and includes a 100-foot suspension bridge over the creek gorge. The ruins of "
                    "Allenbrook and the Ivy Mill are accessible along the route. This is one of "
                    "the most scenic and underutilized units of the Chattahoochee River NRA."
                ),
                "source_url": "https://www.nps.gov/chat/planyourvisit/vickery-creek.htm",
                "admission_type": "free",
                "is_free": True,
                "sort_order": 40,
                "tags": [
                    "hiking",
                    "waterfall",
                    "outdoor",
                    "trail",
                    "historic",
                    "bridge",
                ],
            },
        ],
    },
]

# ---------------------------------------------------------------------------
# NPS API category → our event category mapping
# ---------------------------------------------------------------------------

_NPS_TYPE_TO_CATEGORY: dict[str, str] = {
    "ranger programs": "education",
    "ranger program": "education",
    "guided tour": "education",
    "guided tours": "education",
    "junior ranger": "family",
    "evening program": "education",
    "stargazing": "education",
    "talk": "education",
    "walk": "outdoors",
    "hike": "outdoors",
    "recreation": "outdoors",
    "outdoor program": "outdoors",
    "living history": "education",
    "demonstration": "education",
    "film screening": "film",
    "special event": "community",
    "festival": "community",
    "concert": "music",
    "exhibit": "art",
    "exhibition": "art",
    "volunteer": "volunteer",
    "webinar": "education",
    "virtual program": "education",
}

_DEFAULT_CATEGORY = "education"


def _infer_category(event_types: list[str], title: str) -> str:
    """Map NPS event types to our canonical category."""
    combined = " ".join(event_types).lower()
    title_lower = title.lower()

    for nps_type, category in _NPS_TYPE_TO_CATEGORY.items():
        if nps_type in combined or nps_type in title_lower:
            return category

    return _DEFAULT_CATEGORY


# ---------------------------------------------------------------------------
# NPS API helpers
# ---------------------------------------------------------------------------


def _get_api_key() -> str:
    """Return the NPS API key from config, falling back to DEMO_KEY."""
    cfg = get_config()
    return cfg.api.nps_api_key or "DEMO_KEY"


def _fetch_park_info(session: requests.Session, park_code: str) -> Optional[dict]:
    """Fetch park metadata from the NPS parks endpoint."""
    url = f"{_NPS_BASE}/parks"
    params = {"parkCode": park_code, "api_key": _get_api_key()}
    try:
        resp = session.get(url, params=params, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        parks = data.get("data", [])
        return parks[0] if parks else None
    except Exception as exc:
        logger.warning(
            "NPS parks: failed to fetch park info for %s: %s", park_code, exc
        )
        return None


def _fetch_park_events(session: requests.Session, park_code: str) -> list[dict]:
    """
    Fetch all upcoming events for a park from the NPS events endpoint.

    NPS API returns up to 50 events per page. We paginate until exhausted
    or until we've collected 200 events (practical cap — NPS rarely has more).
    """
    url = f"{_NPS_BASE}/events"
    api_key = _get_api_key()
    all_events: list[dict] = []
    start = 0
    page_size = 50
    max_events = 200

    while len(all_events) < max_events:
        params = {
            "parkCode": park_code,
            "api_key": api_key,
            "start": start,
            "limit": page_size,
        }
        try:
            resp = session.get(url, params=params, timeout=_REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.warning(
                "NPS events: failed to fetch events for %s (start=%d): %s",
                park_code,
                start,
                exc,
            )
            break

        page_events = data.get("data", [])
        if not page_events:
            break

        all_events.extend(page_events)

        total = int(data.get("total", 0))
        if start + page_size >= total:
            break

        start += page_size
        time.sleep(_INTER_REQUEST_DELAY_S)

    return all_events


def _parse_nps_date(date_str: str) -> Optional[str]:
    """
    Parse NPS date strings to YYYY-MM-DD.

    NPS API returns dates in several formats:
      - "2026-05-15" (already ISO)
      - "20260515"   (compact)
      - "05/15/2026" (US format)
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    # ISO format YYYY-MM-DD
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Compact YYYYMMDD
    try:
        dt = datetime.strptime(date_str, "%Y%m%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # US format MM/DD/YYYY
    try:
        dt = datetime.strptime(date_str, "%m/%d/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    logger.debug("NPS events: could not parse date string %r", date_str)
    return None


def _parse_nps_time(time_str: str) -> Optional[str]:
    """
    Parse NPS time strings to HH:MM (24-hour).

    NPS API returns times like:
      - "08:00:00"  (HH:MM:SS, 24-hour)
      - "08:00 AM"  (12-hour with meridiem)
      - "8:00AM"
    """
    if not time_str:
        return None

    time_str = time_str.strip()

    # HH:MM:SS or HH:MM (24-hour)
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            dt = datetime.strptime(time_str, fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            pass

    # 12-hour formats
    for fmt in ("%I:%M %p", "%I:%M%p", "%I:%M:%S %p"):
        try:
            dt = datetime.strptime(time_str.upper(), fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            pass

    logger.debug("NPS events: could not parse time string %r", time_str)
    return None


def _parse_nps_event(
    raw: dict,
    place_id: int,
    place_name: str,
    source_id: int,
    park_url: str,
) -> Optional[dict]:
    """
    Parse a single NPS API event dict into an event record for insert_event().

    NPS API event fields:
      title, description, location
      date         — "YYYY-MM-DD" string for the next occurrence (or current page date)
      dates        — list of "YYYY-MM-DD" strings for all upcoming occurrences
      times        — list of {timestart, timeend} dicts (12-hour strings, e.g. "10:00 AM")
      types        — list of category strings
      isfree       — "true"/"false" string
      regresurl    — registration URL (may be empty)
      infourl      — info URL (may be empty)
      isrecurring  — "true"/"false" string
      recurrencerule — RRULE string
      images       — list of {url, altText, credit} dicts
    """
    title = (raw.get("title") or "").strip()
    if not title:
        return None

    # Filter out permanent daily operations — these aren't scheduled events
    title_lower = title.lower()
    permanent_signals = [
        "visitor center is open",
        "general admission",
        "park is open",
        "daily operations",
        "regular hours",
    ]
    if any(sig in title_lower for sig in permanent_signals):
        logger.debug("NPS events: skipping permanent attraction title: %r", title)
        return None

    description = (raw.get("description") or "").strip()
    # Strip HTML tags from NPS descriptions (they sometimes contain <p>, <ul>, <li>)
    description = re.sub(r"<[^>]+>", " ", description)
    description = re.sub(r"\s+", " ", description).strip()
    # Truncate at a sensible limit
    if len(description) > 2000:
        description = description[:2000].rstrip() + "..."

    # Date: NPS returns a top-level `date` field ("YYYY-MM-DD") for the next
    # occurrence, and a `dates` list of "YYYY-MM-DD" strings for all upcoming
    # occurrences. Use `date` as the canonical next occurrence.
    start_date = _parse_nps_date(raw.get("date") or "")

    # Fall back to the first entry in the dates list
    if not start_date:
        dates_list = raw.get("dates") or []
        if isinstance(dates_list, list):
            for d in dates_list:
                if isinstance(d, str):
                    candidate = _parse_nps_date(d)
                    if candidate:
                        start_date = candidate
                        break

    if not start_date:
        logger.debug("NPS events: no valid date for event %r, skipping", title)
        return None

    # Skip past events
    try:
        event_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(
            tzinfo=timezone.utc
        )
        if event_dt.date() < datetime.now(timezone.utc).date():
            return None
    except ValueError:
        pass

    # Time: NPS returns a `times` list with {timestart, timeend} dicts.
    # Times are 12-hour strings like "10:00 AM". Use the first time slot.
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    times_list = raw.get("times") or []
    if times_list and isinstance(times_list, list):
        first_time = times_list[0] if isinstance(times_list[0], dict) else {}
        start_time = _parse_nps_time((first_time or {}).get("timestart") or "")
        end_time = _parse_nps_time((first_time or {}).get("timeend") or "")

    # Category
    event_types = [t for t in (raw.get("types") or []) if isinstance(t, str)]
    category = _infer_category(event_types, title)

    # Image: NPS provides a list of image dicts with {url, altText, credit}
    image_url: Optional[str] = None
    images_list = raw.get("images") or []
    if images_list and isinstance(images_list, list):
        for img in images_list:
            if isinstance(img, dict) and img.get("url"):
                image_url = img["url"].strip()
                break

    # URLs
    reg_url = (raw.get("regresurl") or "").strip() or None
    info_url = (raw.get("infourl") or "").strip() or None
    source_url = info_url or reg_url or park_url

    # Free check — NPS API provides an "isfree" string field
    is_free_raw = str(raw.get("isfree") or "").strip().lower()
    fee_info = (raw.get("feeinfo") or "").strip().lower()
    is_free = is_free_raw == "true" or "free" in fee_info or not fee_info

    # Recurring check
    is_recurring = str(raw.get("isrecurring") or "").strip().lower() == "true"
    recurrence_rule = (raw.get("recurrencerule") or "").strip() or None

    # Content hash for dedup — uses title + park name + next occurrence date
    content_hash = generate_content_hash(title, place_name, start_date)

    return {
        "source_id": source_id,
        "place_id": place_id,
        "title": title,
        "description": description or None,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": None,
        "end_time": end_time,
        "is_all_day": False,
        "category": category,
        "tags": ["ranger-program", "national-park"],
        "price_min": 0.0 if is_free else None,
        "price_max": 0.0 if is_free else None,
        "price_note": raw.get("feeinfo") or None,
        "is_free": is_free,
        "source_url": source_url,
        "ticket_url": reg_url,
        "image_url": image_url,
        "raw_text": None,
        "extraction_confidence": 0.90,
        "is_recurring": is_recurring,
        "recurrence_rule": recurrence_rule,
        "content_hash": content_hash,
    }


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl NPS Atlanta parks: MLK, Kennesaw Mountain, Chattahoochee River NRA.

    For each park:
      1. Resolve/create the place record.
      2. Upsert curated venue features.
      3. Fetch and insert NPS API events (ranger programs, guided tours, etc.).

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    api_key = _get_api_key()
    if api_key == "DEMO_KEY":
        logger.warning(
            "NPS: using DEMO_KEY — rate-limited to 4 requests/min. "
            "Set NPS_API_KEY env var to a real key for production use."
        )

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (compatible; LostCity-Crawler/1.0; "
                "+https://lostcity.app)"
            )
        }
    )

    for park in PARKS:
        park_code = park["park_code"]
        place_data = park["place_data"]
        features = park["features"]
        park_name = place_data["name"]
        park_url = place_data["website"]

        logger.info("NPS: processing park %s (%s)", park_name, park_code)

        # ------------------------------------------------------------------
        # 1. Resolve place record
        # ------------------------------------------------------------------
        try:
            place_id = get_or_create_place(dict(place_data))
        except Exception as exc:
            logger.error("NPS: failed to resolve place for %s: %s", park_name, exc)
            continue

        if place_id is None:
            logger.warning("NPS: place validation rejected %s, skipping", park_name)
            continue

        # ------------------------------------------------------------------
        # 2. Upsert venue features
        # ------------------------------------------------------------------
        logger.info("NPS: upserting %d features for %s", len(features), park_name)
        for feature in features:
            feature_data = dict(feature)
            feature_data["source_id"] = source_id
            desc = feature_data.get("description", "")
            if len(desc) < 100:
                logger.warning(
                    "NPS: feature %r description too short (%d chars), skipping",
                    feature_data["title"],
                    len(desc),
                )
                continue
            try:
                upsert_venue_feature(place_id, feature_data)
                logger.debug(
                    "NPS: upserted feature %r for %s", feature_data["title"], park_name
                )
            except Exception as exc:
                logger.error(
                    "NPS: failed to upsert feature %r for %s: %s",
                    feature_data["title"],
                    park_name,
                    exc,
                )

        time.sleep(_INTER_REQUEST_DELAY_S)

        # ------------------------------------------------------------------
        # 3. Fetch and insert events
        # ------------------------------------------------------------------
        logger.info("NPS: fetching events for %s (park_code=%s)", park_name, park_code)
        raw_events = _fetch_park_events(session, park_code)
        logger.info("NPS: got %d raw events for %s", len(raw_events), park_name)

        for raw in raw_events:
            parsed = _parse_nps_event(
                raw,
                place_id=place_id,
                place_name=park_name,
                source_id=source_id,
                park_url=park_url,
            )
            if not parsed:
                continue

            events_found += 1

            # Build series_hint for recurring ranger programs so they group
            # correctly in the feed instead of appearing as dozens of individual
            # event cards.
            series_hint: Optional[dict] = None
            if parsed.get("is_recurring"):
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": parsed["title"],
                    "frequency": "irregular",
                }

            existing = find_event_by_hash(parsed["content_hash"])
            if existing:
                try:
                    smart_update_existing_event(existing, parsed)
                    events_updated += 1
                except Exception as exc:
                    logger.error(
                        "NPS: failed to update event %r for %s: %s",
                        parsed["title"],
                        park_name,
                        exc,
                    )
                continue

            try:
                insert_event(parsed, series_hint=series_hint)
                events_new += 1
                logger.debug(
                    "NPS: inserted event %r on %s for %s",
                    parsed["title"],
                    parsed["start_date"],
                    park_name,
                )
            except Exception as exc:
                logger.error(
                    "NPS: failed to insert event %r for %s: %s",
                    parsed["title"],
                    park_name,
                    exc,
                )

        time.sleep(_INTER_REQUEST_DELAY_S)

    logger.info(
        "NPS Atlanta parks crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
