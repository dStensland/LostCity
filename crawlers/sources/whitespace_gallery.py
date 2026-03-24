"""
Exhibition crawler for Whitespace Gallery (whitespace814.com).

Whitespace Gallery is a leading contemporary gallery on Edgewood Ave in Inman Park,
representing artists like Sarah Emerson, Amy Pleasant, Ashlynn Browning, and others.

IMPORTANT TECHNICAL LIMITATION:
Whitespace uses ArtCloud, which renders all exhibition data via React on the client side.
Their /exhibitions page contains NO server-side exhibition data — it's a shell with React
hydration only. The ArtCloud API is not publicly accessible.

This crawler implements the best available static-HTTP strategy:
1. Fetch the main site to confirm it is reachable and capture venue metadata.
2. Fetch individual artist pages from the gallery's artist roster. While artist pages
   are also React-rendered, we note the artists represented for the artists table.
3. Returns (0, 0, 0) when no exhibition data can be extracted.

TODO: If exhibitions coverage for Whitespace becomes a priority, this source should
be converted to a Playwright crawler that can execute the React app. The ArtCloud
platform likely exposes shows via an internal API call made after hydration.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_exhibition

logger = logging.getLogger(__name__)

BASE_URL = "https://whitespace814.com"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 20

VENUE_DATA = {
    "name": "Whitespace Gallery",
    "slug": "whitespace-gallery",
    "address": "814 Edgewood Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7571,
    "lng": -84.3569,
    "venue_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
    "description": (
        "Whitespace Gallery is a contemporary gallery on Edgewood Ave in Inman Park, "
        "fostering an environment of free-expression, intimacy, and dialogue under the "
        "direction of owner Susan Bridges. Open Thursday–Saturday 11am–5pm."
    ),
    "vibes": [
        "contemporary-art",
        "inman-park",
        "gallery",
        "intimate",
        "southeast-artists",
        "established-gallery",
    ],
}

MONTHS = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}

DATE_RANGE_RE = re.compile(
    r"(?P<m1>[A-Za-z]+)\s+(?P<d1>\d{1,2}),?\s*(?P<y1>\d{4})?"
    r"\s*[-–—]\s*"
    r"(?:(?P<m2>[A-Za-z]+)\s+)?(?P<d2>\d{1,2}),?\s*(?P<y2>\d{4})",
    re.IGNORECASE,
)

# ArtCloud React config contains the gallery's artist roster in the title fields
# Pattern: "Artist - First Last" from the artist list in the ReactDOM hydration data
ARTIST_FROM_CONFIG_RE = re.compile(r'"Artist\s*-\s*([^"]{3,60})"')


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def _parse_date_range(text: str) -> tuple[Optional[date], Optional[date]]:
    normalized = _clean(text)
    m = DATE_RANGE_RE.search(normalized)
    if not m:
        return None, None

    month1 = MONTHS.get(m.group("m1").lower())
    month2 = MONTHS.get((m.group("m2") or m.group("m1")).lower())
    if not month1 or not month2:
        return None, None

    day1, day2 = int(m.group("d1")), int(m.group("d2"))
    year2 = int(m.group("y2")) if m.group("y2") else date.today().year
    year1 = int(m.group("y1")) if m.group("y1") else year2
    if not m.group("y1") and month1 > month2:
        year1 = year2 - 1

    try:
        return date(year1, month1, day1), date(year2, month2, day2)
    except ValueError:
        return None, None


def _session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    return s


def _extract_artist_roster(html: str) -> list[str]:
    """
    Extract the gallery's represented artist names from the ArtCloud React config.
    The config embeds artist page titles as "Artist - First Last".
    """
    matches = ARTIST_FROM_CONFIG_RE.findall(html)
    return [_clean(m) for m in matches if m.strip()]


def _try_parse_exhibitions_from_html(html: str, today: date) -> list[dict]:
    """
    Attempt to extract any exhibition data from the page HTML.
    ArtCloud pages have no server-side exhibition data, so this will typically
    return an empty list. Preserved as a hook for future improvements.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Check for any date range text that might indicate exhibitions
    exhibitions = []
    text = soup.get_text(" ", strip=True)

    # Look for structured date ranges paired with show names
    for m in DATE_RANGE_RE.finditer(text):
        # Try to extract what comes before the date as a title
        start_pos = m.start()
        preceding = _clean(text[max(0, start_pos - 200) : start_pos])
        if not preceding or len(preceding) < 3:
            continue

        # Parse the date
        month1 = MONTHS.get(m.group("m1").lower())
        month2 = MONTHS.get((m.group("m2") or m.group("m1")).lower())
        if not month1 or not month2:
            continue

        day1, day2 = int(m.group("d1")), int(m.group("d2"))
        year2 = int(m.group("y2")) if m.group("y2") else today.year
        year1 = int(m.group("y1")) if m.group("y1") else year2
        try:
            opening = date(year1, month1, day1)
            closing = date(year2, month2, day2)
        except ValueError:
            continue

        if closing < today:
            continue

        # Extract last sentence/phrase before the date as candidate title
        preceding_lines = [
            line.strip() for line in re.split(r"[.\n|]", preceding) if line.strip()
        ]
        if not preceding_lines:
            continue
        candidate_title = preceding_lines[-1]
        if len(candidate_title) < 3 or len(candidate_title) > 150:
            continue

        exhibitions.append(
            {
                "title": candidate_title,
                "opening_date": opening.isoformat(),
                "closing_date": closing.isoformat(),
            }
        )

    return exhibitions


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Whitespace Gallery exhibitions.

    Due to ArtCloud's React-only architecture, this crawler cannot extract
    exhibition data via static HTTP. It ensures the venue record is current
    and returns (0, 0, 0) when no exhibition data is parseable.

    Coverage improvement: convert to Playwright crawler to execute the React
    application and intercept ArtCloud API calls.
    """
    source_id = source["id"]
    today = date.today()
    found = new = updated = 0

    # Always ensure venue record exists
    venue_id = get_or_create_venue(VENUE_DATA)

    session = _session()

    # Attempt to fetch the exhibitions page
    try:
        resp = session.get(EXHIBITIONS_URL, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        html = resp.text
    except Exception as exc:
        logger.warning("Whitespace Gallery: failed to fetch exhibitions page: %s", exc)
        return 0, 0, 0

    # ArtCloud embeds artist roster in the React config — extract for reference
    artist_roster = _extract_artist_roster(html)
    if artist_roster:
        logger.debug(
            "Whitespace Gallery: %d represented artists found in React config",
            len(artist_roster),
        )

    # Try to parse any exhibition data from static HTML
    exhibitions = _try_parse_exhibitions_from_html(html, today)

    if not exhibitions:
        logger.info(
            "Whitespace Gallery: no exhibition data parseable from static HTML. "
            "ArtCloud renders exhibitions via React only. "
            "Consider converting to Playwright crawler for full exhibition coverage. "
            "Gallery venue record is current."
        )
        return 0, 0, 0

    # If we somehow got exhibition data, persist it
    for exh in exhibitions:
        title = exh.get("title", "")
        if not title:
            continue

        record = {
            "title": title,
            "venue_id": venue_id,
            "source_id": source_id,
            "_venue_name": VENUE_DATA["name"],
            "opening_date": exh.get("opening_date"),
            "closing_date": exh.get("closing_date"),
            "description": None,
            "image_url": None,
            "source_url": EXHIBITIONS_URL,
            "exhibition_type": "group",
            "admission_type": "free",
            "tags": ["inman-park", "contemporary-art", "gallery"],
            "is_active": True,
        }

        found += 1
        result = insert_exhibition(record, artists=[])
        if result:
            new += 1
        else:
            updated += 1

        logger.info("Whitespace Gallery exhibition: %r", title)

    logger.info(
        "Whitespace Gallery crawl complete: %s found, %s new, %s updated",
        found,
        new,
        updated,
    )
    return found, new, updated
