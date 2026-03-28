"""
Exhibition crawler for Sandler Hudson Gallery (sandlerhudson.com).

Sandler Hudson is a leading contemporary gallery in West Midtown, established 1989.
Their site runs on Squarespace. The home page IS the current exhibition — each
exhibition gets its own full-page Squarespace layout with title, artist, dates,
and description. Navigation pages like /atl-airport represent offsite exhibitions.

The archive at /archive lists past exhibitions with links — we use this to discover
all current pages, then filter by date.

Strategy:
1. Fetch / (home page) as ?format=json to get the current exhibition title + content.
2. Fetch /archive?format=json to discover all exhibition page slugs with titles.
3. For each slug that appears to be a current or upcoming exhibition, fetch its JSON.
4. Parse title, artist name, date range, description, and image from content.
5. Skip past exhibitions (closing date < today).

The Squarespace ?format=json API returns:
  collection.title — page title (often the exhibition title)
  mainContent — HTML body of the page

Date format in content: "Exhibition Dates: February 13 - March 28, 2026"
or plain date ranges like "February 13 - March 28, 2026"
"""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_exhibition

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sandlerhudson.com"
EXHIBITIONS_URL = BASE_URL
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 20

PLACE_DATA = {
    "name": "Sandler Hudson Gallery",
    "slug": "sandler-hudson-gallery",
    "address": "1009 Marietta St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7738,
    "lng": -84.4064,
    "venue_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
    "description": (
        "Sandler Hudson Gallery is one of Atlanta's foremost contemporary art galleries, "
        "established in 1989 with a commitment to emerging and established artists. "
        "Located in West Midtown at the heart of Atlanta's gallery district."
    ),
    "vibes": [
        "contemporary-art",
        "west-midtown",
        "gallery",
        "established",
        "emerging-artists",
        "painting",
        "sculpture",
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

# Matches "Month D - Month D, YYYY" or "Month D, YYYY - Month D, YYYY"
# Squarespace galleries often use "February 13 - March 28, 2026"
DATE_RANGE_RE = re.compile(
    r"(?P<m1>[A-Za-z]+)\s+(?P<d1>\d{1,2}),?\s*(?P<y1>\d{4})?"
    r"\s*[-–—]\s*"
    r"(?:(?P<m2>[A-Za-z]+)\s+)?(?P<d2>\d{1,2}),?\s*(?P<y2>\d{4})",
    re.IGNORECASE,
)

# Pages that are not exhibitions (navigation, contact, archive, etc.)
_NON_EXHIBITION_SLUGS = frozenset(
    {
        "archive",
        "artists",
        "contact-us",
        "news-events",
        "about-1",
        "cart",
        "atl-airport",  # offsite exhibition, include separately
    }
)

# Typical patterns for "curator by" line in Squarespace content
_CURATOR_RE = re.compile(r"[Cc]urated\s+by\s+([A-Z][A-Za-z\s.]+)", re.IGNORECASE)
_EXHIBITION_DATES_RE = re.compile(
    r"[Ee]xhibition\s+[Dd]ates?:\s*(.+?)(?:\n|$|[A-Z]{2,})", re.DOTALL
)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def _parse_date_range(text: str) -> tuple[Optional[date], Optional[date]]:
    """Parse a date range string, returning (opening, closing) or (None, None)."""
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


def _fetch_squarespace_page(session: requests.Session, url: str) -> Optional[dict]:
    """
    Fetch a Squarespace page via the ?format=json API.
    Returns the parsed JSON dict or None on failure.
    """
    json_url = url if "?format=json" in url else f"{url}?format=json"
    try:
        resp = session.get(json_url, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.debug("Could not fetch %s: %s", json_url, exc)
        return None


def _parse_exhibition_from_squarespace(
    page_json: dict,
    page_url: str,
    today: date,
) -> Optional[dict]:
    """
    Parse exhibition data from a Squarespace page JSON response.

    Returns an exhibition dict or None if the page is not a valid current exhibition.
    """
    collection = page_json.get("collection", {})
    title = _clean(collection.get("title", ""))
    if not title:
        return None

    main_content = page_json.get("mainContent", "")
    if not isinstance(main_content, str):
        return None

    soup = BeautifulSoup(main_content, "html.parser")
    content_text = _clean(soup.get_text(" "))

    # Extract image — first <img> in the content
    img = soup.find("img")
    image_url = None
    if img:
        image_url = img.get("src") or img.get("data-src")
        # Remove Squarespace size format params to get the largest available
        if image_url:
            image_url = re.sub(r"\?format=\d+w$", "", image_url)

    # Parse date range
    # Try "Exhibition Dates: ..." pattern first
    opening: Optional[date] = None
    closing: Optional[date] = None

    dates_match = _EXHIBITION_DATES_RE.search(content_text)
    if dates_match:
        opening, closing = _parse_date_range(dates_match.group(1))

    if not closing:
        # Fallback: scan full content for any date range
        opening, closing = _parse_date_range(content_text)

    # Skip past exhibitions
    if closing and closing < today:
        return None

    # Extract description: skip title and dates, take first substantial paragraph
    description = None
    paragraphs = soup.find_all("p")
    desc_parts = []
    for p in paragraphs:
        text = _clean(p.get_text(" "))
        # Skip date lines, title lines, short fragments, and "OPENING:" lines
        if not text or len(text) < 40:
            continue
        if re.match(
            r"^(?:OPENING|Artist\s+talk|Curator|Exhibition\s+Dates?)",
            text,
            re.IGNORECASE,
        ):
            continue
        if DATE_RANGE_RE.search(text):
            continue
        desc_parts.append(text)
        if len(" ".join(desc_parts)) > 400:
            break

    if desc_parts:
        description = " ".join(desc_parts)[:800]

    # Extract artist name from title or "Curated by" line
    # Pattern: "Artist Name | Exhibition Title" or "Artist Name: Exhibition Title"
    # Also check the "Curated by" line
    artist_name: Optional[str] = None
    artists: list[dict] = []

    # Try "Artist Name | Title" or "Artist Name: Title" patterns
    title_split = re.split(r"\s*[|:]\s*", title, maxsplit=1)
    if len(title_split) == 2:
        artist_candidate = title_split[0].strip()
        # Validate: should be 1-4 words, look like a name
        if 1 <= len(artist_candidate.split()) <= 4:
            # Check if it's not a generic word
            generic = {"group", "summer", "selections", "special", "show", "exhibition"}
            if artist_candidate.lower() not in generic:
                artist_name = artist_candidate

    # Also look for "Curated by" in content for curator credits
    curator_match = _CURATOR_RE.search(content_text)
    curator_name: Optional[str] = None
    if curator_match:
        curator_name = _clean(curator_match.group(1)).rstrip(".")

    # Build artists list
    if artist_name:
        artists.append({"artist_name": artist_name, "role": "artist"})
    if curator_name and curator_name != artist_name:
        artists.append({"artist_name": curator_name, "role": "curator"})

    # Infer type
    if len(artists) == 1 and artists[0]["role"] == "artist":
        exhibition_type = "solo"
    elif not artists:
        # Check if content mentions group show indicators
        if any(
            w in content_text.lower()
            for w in ("ten artists", "group", "selections", "group show")
        ):
            exhibition_type = "group"
        else:
            exhibition_type = "solo"
    else:
        exhibition_type = "group"

    return {
        "title": title,
        "artist_name": artist_name,
        "opening_date": opening.isoformat() if opening else None,
        "closing_date": closing.isoformat() if closing else None,
        "description": description,
        "image_url": image_url,
        "source_url": page_url,
        "exhibition_type": exhibition_type,
        "artists": artists,
    }


def _get_exhibition_slugs(session: requests.Session) -> list[str]:
    """
    Fetch the nav pages from the home page JSON to discover exhibition slugs.
    Returns a list of relative URL paths to fetch.
    """
    home_json = _fetch_squarespace_page(session, BASE_URL)
    if not home_json:
        return []

    # Home page itself is always the current exhibition
    slugs = ["/"]

    # Check the archive page for additional active exhibition slugs
    archive_json = _fetch_squarespace_page(session, f"{BASE_URL}/archive")
    if archive_json:
        main = archive_json.get("mainContent", "")
        if isinstance(main, str):
            soup = BeautifulSoup(main, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a.get("href", "")
                # Only include gallery exhibition pages (not the archive itself)
                slug = href.strip("/")
                if (
                    slug
                    and slug not in _NON_EXHIBITION_SLUGS
                    and not slug.startswith("http")
                ):
                    slugs.append(f"/{slug}")

    # Also include known offsite exhibition pages from nav
    main_content = home_json.get("mainContent", "")
    if isinstance(main_content, str):
        soup = BeautifulSoup(main_content, "html.parser")

    return slugs


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    today = date.today()
    found = new = updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    session = _session()

    # Always fetch the home page — it IS the current exhibition
    slugs = ["/"]

    # Also try the atl-airport offsite exhibition page
    slugs.append("/atl-airport")

    # Fetch archive to discover additional exhibition pages
    archive_json = _fetch_squarespace_page(session, f"{BASE_URL}/archive")
    if archive_json:
        main = archive_json.get("mainContent", "")
        if isinstance(main, str):
            soup = BeautifulSoup(main, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a.get("href", "").strip()
                if not href or href.startswith("http"):
                    continue
                slug = href.strip("/")
                if slug and slug not in _NON_EXHIBITION_SLUGS:
                    page_path = f"/{slug}"
                    if page_path not in slugs:
                        slugs.append(page_path)

    seen_titles: set[str] = set()

    for slug in slugs:
        page_url = urljoin(BASE_URL, slug)
        page_json = _fetch_squarespace_page(session, page_url)
        if not page_json:
            continue

        exhibition = _parse_exhibition_from_squarespace(page_json, page_url, today)
        if not exhibition:
            continue

        title = exhibition["title"]
        if title.lower() in seen_titles:
            continue
        seen_titles.add(title.lower())

        record = {
            "title": title,
            "venue_id": venue_id,
            "source_id": source_id,
            "_venue_name": PLACE_DATA["name"],
            "opening_date": exhibition["opening_date"],
            "closing_date": exhibition["closing_date"],
            "description": exhibition.get("description"),
            "image_url": exhibition.get("image_url"),
            "source_url": exhibition["source_url"],
            "exhibition_type": exhibition["exhibition_type"],
            "admission_type": "free",
            "tags": ["west-midtown", "contemporary-art", "gallery", "painting"],
            "is_active": True,
        }

        found += 1
        result = insert_exhibition(record, artists=exhibition.get("artists") or [])
        if result:
            new += 1
        else:
            updated += 1

        logger.info(
            "Sandler Hudson exhibition: %r (open=%s close=%s type=%s artists=%s)",
            title,
            exhibition["opening_date"] or "unknown",
            exhibition["closing_date"] or "unknown",
            exhibition["exhibition_type"],
            [a["artist_name"] for a in (exhibition.get("artists") or [])],
        )

    logger.info(
        "Sandler Hudson crawl complete: %s found, %s new, %s updated",
        found,
        new,
        updated,
    )
    return found, new, updated
