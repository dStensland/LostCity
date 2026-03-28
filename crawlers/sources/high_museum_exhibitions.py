"""
Exhibition crawler for High Museum of Art (high.org/exhibitions/).

High Museum uses WordPress with a custom 'exhibition' post type. The WP REST API
exposes all exhibitions at /wp-json/wp/v2/exhibition. Dates are NOT in the API
response — they live in each individual exhibition HTML page, inside the
.at-page-title header element (e.g., "Current Exhibition Title June 12 – September 6, 2026").

Strategy:
1. Fetch all published exhibitions via WP REST API (returns title, link, og:image).
2. For each exhibition, fetch its HTML page to extract opening/closing dates and
   the status prefix ("Current Exhibition", "Future Exhibition", etc.).
3. Skip exhibitions whose closing date is in the past.
4. Extract artist name when the title follows "Artist Name: Show Title" pattern.

This crawler is distinct from high_museum.py which crawls programmed events.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_exhibition

logger = logging.getLogger(__name__)

BASE_URL = "https://high.org"
API_URL = f"{BASE_URL}/wp-json/wp/v2/exhibition"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 20

PLACE_DATA = {
    "name": "High Museum of Art",
    "slug": "high-museum",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7901,
    "lng": -84.3856,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "description": (
        "The High Museum of Art is the leading art museum in the southeastern "
        "United States, with a collection of more than 18,000 works of art."
    ),
    "vibes": [
        "museum",
        "world-class-art",
        "family-friendly",
        "midtown",
        "major-institution",
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

# Matches "Month D – Month D, YYYY" or "Month D, YYYY – Month D, YYYY"
# Also handles same-month ranges: "Month D – D, YYYY"
DATE_RANGE_RE = re.compile(
    r"(?P<m1>[A-Za-z]+)\s+(?P<d1>\d{1,2})"
    r"(?:,\s*(?P<y1>\d{4}))?"
    r"\s*[–\-—]\s*"
    r"(?:(?P<m2>[A-Za-z]+)\s+)?(?P<d2>\d{1,2}),?\s*(?P<y2>\d{4})",
    re.IGNORECASE,
)

# Artist-solo title pattern: "Artist Name: Exhibition Subtitle"
# Reject if pre-colon part is a generic label
_GENERIC_PREFIXES = frozenset(
    {
        "new acquisitions",
        "selections",
        "highlights",
        "collection",
        "feature",
        "focus",
        "special",
        "gallery",
        "the",
        "an",
        "a",
        "new",
        "special exhibition",
        "permanent collection",
    }
)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def _parse_date_range(
    text: str,
    today: date,
) -> tuple[Optional[date], Optional[date]]:
    """Return (opening, closing) dates from a date range string, or (None, None)."""
    normalized = _clean(text)
    m = DATE_RANGE_RE.search(normalized)
    if not m:
        return None, None

    m1_name = m.group("m1").lower()
    m2_name = (m.group("m2") or m.group("m1")).lower()
    month1 = MONTHS.get(m1_name)
    month2 = MONTHS.get(m2_name)
    if not month1 or not month2:
        return None, None

    day1 = int(m.group("d1"))
    day2 = int(m.group("d2"))
    year2 = int(m.group("y2"))
    year1 = int(m.group("y1")) if m.group("y1") else year2

    # If the start month is later than end month with no explicit year, opening is previous year
    if not m.group("y1") and month1 > month2:
        year1 = year2 - 1

    try:
        opening = date(year1, month1, day1)
        closing = date(year2, month2, day2)
    except ValueError:
        return None, None

    return opening, closing


def _extract_artist_from_title(title: str) -> Optional[str]:
    """
    Extract artist name from "Artist Name: Exhibition Subtitle" pattern.
    Returns None for group shows or titles without a clear solo-artist prefix.
    """
    if ":" not in title:
        return None
    artist_part = title.split(":", 1)[0].strip()
    if artist_part.lower() in _GENERIC_PREFIXES:
        return None
    # Reject multi-word sequences that are clearly not a person's name
    words = artist_part.split()
    if len(words) > 4 or len(words) < 1:
        return None
    return artist_part


def _session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    return s


def _fetch_wp_exhibitions(session: requests.Session) -> list[dict]:
    """Fetch all published exhibitions from the WP REST API (handles pagination)."""
    exhibitions: list[dict] = []
    page = 1
    while True:
        try:
            resp = session.get(
                API_URL,
                params={
                    "per_page": 100,
                    "status": "publish",
                    "page": page,
                    "_fields": "id,title,link,slug,yoast_head_json",
                },
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
        except Exception as exc:
            logger.warning("High Museum WP API page %s error: %s", page, exc)
            break

        batch = resp.json()
        if not batch or not isinstance(batch, list):
            break

        exhibitions.extend(batch)

        total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
        if page >= total_pages:
            break
        page += 1

    return exhibitions


def _fetch_exhibition_detail(
    session: requests.Session,
    url: str,
    today: date,
) -> dict:
    """
    Fetch individual exhibition HTML page. Returns dict with:
    - opening_date (str YYYY-MM-DD or None)
    - closing_date (str YYYY-MM-DD or None)
    - is_ticketed (bool)
    - image_url (str or None)
    - description (str or None)
    """
    result: dict = {
        "opening_date": None,
        "closing_date": None,
        "is_ticketed": False,
        "image_url": None,
        "description": None,
    }
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        logger.debug("Could not fetch %s: %s", url, exc)
        return result

    soup = BeautifulSoup(resp.text, "html.parser")

    # .at-page-title header contains: "Current Exhibition Title Month D – Month D, YYYY"
    header = soup.find("header", class_="at-page-title")
    if header:
        header_text = _clean(header.get_text(" "))
        opening, closing = _parse_date_range(header_text, today)
        result["opening_date"] = opening.isoformat() if opening else None
        result["closing_date"] = closing.isoformat() if closing else None
        result["is_ticketed"] = "timed ticket" in header_text.lower()

    # og:image from the individual page (may be higher quality than yoast API response)
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        result["image_url"] = og_image["content"]

    # og:description for the exhibition
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        result["description"] = _clean(og_desc["content"])

    return result


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    today = date.today()
    found = new = updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    session = _session()

    raw_exhibitions = _fetch_wp_exhibitions(session)
    if not raw_exhibitions:
        logger.info("High Museum exhibitions: no results from WP API")
        return 0, 0, 0

    for ex in raw_exhibitions:
        title = _clean(ex.get("title", {}).get("rendered", ""))
        if not title:
            continue

        link = ex.get("link", "")

        # og:image from yoast (available without fetching detail page)
        yoast = ex.get("yoast_head_json", {})
        og_images = yoast.get("og_image", [])
        api_image = og_images[0].get("url") if og_images else None

        # Fetch individual page for dates + better image/description
        detail = _fetch_exhibition_detail(session, link, today)

        # Skip past exhibitions
        closing_str = detail.get("closing_date")
        if closing_str:
            try:
                if date.fromisoformat(closing_str) < today:
                    logger.debug(
                        "High Museum: skipping past exhibition %r (closed %s)",
                        title,
                        closing_str,
                    )
                    continue
            except ValueError:
                pass

        image_url = detail.get("image_url") or api_image
        description = detail.get("description")
        opening_str = detail.get("opening_date")
        is_ticketed = detail.get("is_ticketed", False)

        artist_name = _extract_artist_from_title(title)
        exhibition_type = "solo" if artist_name else "group"

        artists = []
        if artist_name:
            artists.append({"artist_name": artist_name, "role": "artist"})

        record = {
            "title": title,
            "place_id": venue_id,
            "source_id": source_id,
            "_venue_name": PLACE_DATA["name"],
            "opening_date": opening_str,
            "closing_date": closing_str,
            "description": description,
            "image_url": image_url,
            "source_url": link,
            "exhibition_type": exhibition_type,
            "admission_type": "ticketed" if is_ticketed else "free",
            "tags": ["major-institution", "museum", "atlanta-art"],
            "is_active": True,
        }

        found += 1
        result = insert_exhibition(record, artists=artists)
        if result:
            new += 1
        else:
            updated += 1

        logger.info(
            "High Museum exhibition: %r (open=%s close=%s type=%s)",
            title,
            opening_str or "TBD",
            closing_str or "TBD",
            exhibition_type,
        )

    logger.info(
        "High Museum exhibitions crawl complete: %s found, %s new, %s updated",
        found,
        new,
        updated,
    )
    return found, new, updated
