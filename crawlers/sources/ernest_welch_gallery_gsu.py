"""
Crawler for Ernest G. Welch School Galleries (Georgia State University).

The source was previously mis-registered against art.gsu.edu/gallery/ (404).
Correct URL: https://calendar.gsu.edu/welch-galleries

Platform: Localist/25Live — static HTML with embedded JSON-LD structured data.
No JavaScript rendering required.

Parse flow:
1. GET https://calendar.gsu.edu/welch-galleries
2. Find all <script type="application/ld+json"> tags
3. Each tag contains a JSON array with one schema.org Event object
4. Extract name, description, startDate, endDate, image, url
5. Route every entry as an exhibition via build_exhibition_record() +
   TypedEntityEnvelope / persist_typed_entity_envelope()
6. Attempt to extract artist name from titles matching the pattern:
   "MFA Thesis Exhibition: Artist Name \"Title\""
7. Skip exhibitions whose closing_date is already in the past

Date quirk:
  The JSON-LD startDate/endDate on this Localist calendar reflect the opening
  reception time slot (e.g. same-day open/close), NOT the full exhibition run.
  The actual run dates are embedded in the description text:
    "Exhibition: March 23-27"
    "Exhibition from March 30 - April 3"
  We parse closing_date from the description; startDate is used as opening_date.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://calendar.gsu.edu/welch-galleries"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

VENUE_DATA = {
    "name": "Ernest G. Welch School Galleries",
    "slug": "ernest-welch-gallery-gsu",
    "address": "10 Peachtree Center Ave SE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7537,
    "lng": -84.3863,
    "venue_type": "gallery",
    "spot_type": "gallery",
    "website": "https://artdesign.gsu.edu/galleries/",
    "vibes": ["artsy", "all-ages", "casual"],
}

EXHIBITION_TAGS = [
    "ernest-welch",
    "gsu",
    "gallery",
    "university",
    "contemporary",
    "art",
    "exhibition",
]

# Matches "MFA Thesis Exhibition: Artist Name "Optional Title""
# or      "BFA Exhibition: Artist Name "Optional Title""
# Capture group 1 = artist name (everything after ": " up to a quote or end)
_THESIS_RE = re.compile(
    r'(?:MFA Thesis|BFA)\s+Exhibition:\s+([^"\u201c\u201d]+?)(?:\s+["\u201c\u201d]|$)',
    re.IGNORECASE,
)

# Matches the exhibition run in description text.
# Handles:
#   "Exhibition: March 23-27"
#   "Exhibition from March 30 - April 3"
#   "Exhibition: March 23 - 27"
#   "Exhibition April 15-19"
# Group 1 = start month name
# Group 2 = start day
# Group 3 = end month name (optional -- absent when same month)
# Group 4 = end day
_MONTH_NAMES = (
    "January|February|March|April|May|June|"
    "July|August|September|October|November|December|"
    "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec"
)
_EXHIBIT_RUN_RE = re.compile(
    rf"Exhibition[:\s]+(?:from\s+)?({_MONTH_NAMES})\s+(\d{{1,2}})"
    rf"\s*[-\u2013\u2014]\s*(?:({_MONTH_NAMES})\s+)?(\d{{1,2}})",
    re.IGNORECASE,
)

_MONTH_MAP: dict[str, int] = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch URL and return HTML, or None on failure."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("Ernest Welch Gallery (GSU): request failed for %s: %s", url, exc)
        return None


def _parse_iso_date(dt_str: str) -> Optional[str]:
    """
    Parse an ISO 8601 datetime string (possibly with UTC offset) to YYYY-MM-DD.

    Handles "2026-03-23T10:00:00-04:00" and "2026-03-23T10:00:00Z".
    """
    if not dt_str:
        return None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except (ValueError, AttributeError):
        m = re.match(r"(\d{4}-\d{2}-\d{2})", dt_str)
        return m.group(1) if m else None


def _closing_date_from_description(
    description: str, opening_date: str
) -> Optional[str]:
    """
    Extract the exhibition closing date from description text.

    The Localist JSON-LD puts only the opening reception time slot in
    startDate/endDate. The real exhibition run is in the description, e.g.:
      "Exhibition: March 23-27"
      "Exhibition from March 30 - April 3"

    Uses opening_date to infer the year. Handles cross-year runs where the
    closing month is earlier than the opening month (e.g. Dec -> Jan).

    Returns ISO date string or None if unparseable.
    """
    if not description:
        return None

    m = _EXHIBIT_RUN_RE.search(description)
    if not m:
        return None

    start_month_str = m.group(1).lower()
    end_month_str = (m.group(3) or "").lower().strip()
    end_day = int(m.group(4))

    start_month = _MONTH_MAP.get(start_month_str)
    if not start_month:
        return None

    # No explicit end month means same month as start
    end_month = _MONTH_MAP.get(end_month_str) if end_month_str else start_month

    try:
        open_year = datetime.fromisoformat(opening_date).year
        # If closing month is before opening month, the run crosses a year boundary
        close_year = open_year + 1 if (end_month and end_month < start_month) else open_year
        return datetime(close_year, end_month, end_day).strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return None


def _extract_artist_from_title(title: str) -> Optional[str]:
    """
    Extract the exhibiting artist's name from thesis/BFA exhibition titles.

    Examples:
      'MFA Thesis Exhibition: Jingjie Chen "Chronomark"'  -> "Jingjie Chen"
      'BFA Exhibition: Jane Doe "Works on Paper"'         -> "Jane Doe"
      'BFA Photo, Textiles and Ceramics Exhibition'       -> None
    """
    m = _THESIS_RE.search(title)
    return m.group(1).strip() if m else None


def _parse_jsonld_events(html: str) -> list[dict]:
    """
    Extract schema.org Event objects from all JSON-LD script tags on the page.

    The Localist/25Live platform embeds one JSON array per <script> block;
    each array contains exactly one Event object.
    """
    soup = BeautifulSoup(html, "html.parser")
    script_tags = soup.find_all("script", type="application/ld+json")

    raw_events: list[dict] = []
    for tag in script_tags:
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "Event":
                raw_events.append(item)

    logger.info(
        "Ernest Welch Gallery (GSU): found %d JSON-LD Event block(s)", len(raw_events)
    )
    return raw_events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ernest G. Welch School Galleries via static HTTP (no Playwright)."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0

    today = date.today().isoformat()

    session = requests.Session()
    venue_id = get_or_create_venue(VENUE_DATA)

    logger.info("Ernest Welch Gallery (GSU): fetching %s", CALENDAR_URL)
    html = _fetch(CALENDAR_URL, session)
    if not html:
        logger.error("Ernest Welch Gallery (GSU): failed to fetch calendar page")
        return 0, 0, 0

    raw_events = _parse_jsonld_events(html)
    if not raw_events:
        logger.warning("Ernest Welch Gallery (GSU): no JSON-LD Event blocks found")
        return 0, 0, 0

    envelope = TypedEntityEnvelope()

    for item in raw_events:
        title: str = (item.get("name") or "").strip()
        if not title:
            logger.warning("Ernest Welch Gallery (GSU): skipping item with no title")
            continue

        # JSON-LD startDate = opening reception start (reliable opening date)
        # JSON-LD endDate   = opening reception end (NOT exhibition close -- ignored)
        opening_date = _parse_iso_date(item.get("startDate", ""))
        if not opening_date:
            logger.warning(
                "Ernest Welch Gallery (GSU): no startDate for %r -- using today", title
            )
            opening_date = today

        description: Optional[str] = (item.get("description") or "").strip() or None

        # Resolve the real closing date from description run text (primary source)
        closing_date = _closing_date_from_description(description or "", opening_date)
        if not closing_date:
            # Last resort: use JSON-LD endDate (will equal opening_date for receptions)
            closing_date = _parse_iso_date(item.get("endDate", ""))
            if closing_date == opening_date:
                logger.debug(
                    "Ernest Welch Gallery (GSU): %r -- run end not found in description, "
                    "closing_date same as opening",
                    title,
                )

        # Skip exhibitions that have already closed
        if closing_date and closing_date < today:
            logger.debug(
                "Ernest Welch Gallery (GSU): skipping closed exhibition %r (closed %s)",
                title,
                closing_date,
            )
            continue

        image_url: Optional[str] = item.get("image") or None
        source_url: Optional[str] = item.get("url") or CALENDAR_URL

        # Extract artist name from MFA/BFA thesis title patterns
        artist_name = _extract_artist_from_title(title)
        artists: Optional[list[dict]] = None
        if artist_name:
            artists = [{"artist_name": artist_name, "role": "exhibiting artist"}]

        # Solo for single-artist thesis shows; group for multi-artist BFA shows
        exhibition_type = "solo" if artist_name else "group"

        events_found += 1

        ex_record, ex_artists = build_exhibition_record(
            title=title,
            venue_id=venue_id,
            source_id=source_id,
            opening_date=opening_date,
            closing_date=closing_date,
            venue_name=VENUE_DATA["name"],
            description=description,
            image_url=image_url,
            source_url=source_url,
            portal_id=portal_id,
            admission_type="free",
            tags=EXHIBITION_TAGS,
            artists=artists,
            exhibition_type=exhibition_type,
        )
        envelope.add("exhibitions", ex_record)

        logger.info(
            "Ernest Welch Gallery (GSU): queued %r (%s -- %s)",
            title,
            opening_date,
            closing_date or "?",
        )

    if envelope.exhibitions:
        persist_result = persist_typed_entity_envelope(envelope)
        events_new = persist_result.persisted.get("exhibitions", 0)
        skipped = persist_result.skipped.get("exhibitions", 0)
        if skipped:
            events_updated = skipped
            logger.info(
                "Ernest Welch Gallery (GSU): %d exhibition(s) already current (skipped)",
                skipped,
            )

    logger.info(
        "Ernest Welch Gallery (GSU) crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
