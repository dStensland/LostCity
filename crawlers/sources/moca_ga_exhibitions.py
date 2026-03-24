"""
Exhibition crawler for MOCA GA — Museum of Contemporary Art of Georgia.
URL: https://mocaga.org/exhibitions-events/

MOCA GA uses WordPress with The Events Calendar plugin. Their exhibitions are
structured as calendar events with an 'exhibition' category (id=7), but the
TEC REST API (/wp-json/tribe/events/v1/events) returns 0 results due to site
configuration.

Working strategy:
1. Scrape the year-based exhibition archive pages (/YYYY-exhibitions/).
   These contain exhibition titles with date ranges and links to detail pages
   at /calendar/[slug]/.
2. Fetch each detail page to extract the full date range, description, og:image,
   and artist credits from the body content.
3. Only persist exhibitions whose closing date is today or in the future.

The archive page format:
  "Exhibition Title Month D, YYYY - Month D, YYYY  Read More"
  Link: https://mocaga.org/calendar/exhibition-slug/

The detail page uses TEC's standard event template with:
  .tribe-events-schedule — "Aug 30, 2025 - Oct 25, 2025 12am - 5pm"
  .tribe-events-content  — full exhibition description
  og:image               — exhibition image
"""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_exhibition

logger = logging.getLogger(__name__)

BASE_URL = "https://mocaga.org"
EXHIBITIONS_PAGE = f"{BASE_URL}/exhibitions-events/"
CALENDAR_BASE = f"{BASE_URL}/calendar/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 20

VENUE_DATA = {
    "name": "MOCA GA",
    "slug": "moca-ga",
    "address": "75 Bennett St NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.8059,
    "lng": -84.3988,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "description": (
        "The Museum of Contemporary Art of Georgia (MOCA GA) is the state's only "
        "dedicated contemporary art museum, championing Georgian artists through "
        "exhibitions, a permanent collection, and the Working Artist Project."
    ),
    "vibes": [
        "contemporary-art",
        "georgia-artists",
        "museum",
        "buckhead",
        "permanent-collection",
        "arts-nonprofit",
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

# Matches "Month D, YYYY - Month D, YYYY" or "Month D - Month D, YYYY"
DATE_RANGE_RE = re.compile(
    r"(?P<m1>[A-Za-z]+)\s+(?P<d1>\d{1,2}),?\s*(?P<y1>\d{4})?"
    r"\s*[-–—]\s*"
    r"(?:(?P<m2>[A-Za-z]+)\s+)?(?P<d2>\d{1,2}),?\s*(?P<y2>\d{4})",
    re.IGNORECASE,
)

# TEC schedule element: "Aug 30, 2025 - Oct 25, 2025"
TEC_SCHEDULE_RE = re.compile(
    r"(?P<m1>[A-Za-z]+)\s+(?P<d1>\d{1,2}),?\s*(?P<y1>\d{4})"
    r"\s*[-–—]\s*"
    r"(?P<m2>[A-Za-z]+)\s+(?P<d2>\d{1,2}),?\s*(?P<y2>\d{4})",
    re.IGNORECASE,
)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def _parse_date_range(
    text: str,
    regex: re.Pattern = DATE_RANGE_RE,
) -> tuple[Optional[date], Optional[date]]:
    """Parse a date range string into (opening, closing) dates."""
    normalized = _clean(text)
    m = regex.search(normalized)
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


def _fetch_archive_links(session: requests.Session, year: int) -> list[tuple[str, str]]:
    """
    Fetch the year-based exhibition archive page and return a list of
    (exhibition_title_text, calendar_url) tuples.

    Archive URL format: https://mocaga.org/YYYY-exhibitions/
    Archive page format (from each "Read More" block):
      "Exhibition Title Month D, YYYY - Month D, YYYY  Read More"
      Link href: /calendar/exhibition-slug/
    """
    url = f"{BASE_URL}/{year}-exhibitions/"
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 404:
            logger.debug("MOCA GA: %s archive page not found (404)", year)
            return []
        resp.raise_for_status()
    except Exception as exc:
        logger.debug("MOCA GA: could not fetch %s archive: %s", year, exc)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    main = soup.find("div", id="main") or soup.find("main") or soup

    results: list[tuple[str, str]] = []

    # Each entry: the link's text is the exhibition title + date range,
    # and each link points to /calendar/slug/
    # But the "Read More" links are separate from the title text.
    # Parse by walking the text nodes in the main div.
    # The structure is typically:
    #   <a href="/calendar/slug/">...</a>  <- wraps an image
    #   Then plain text: "Title Date - Date Read More"
    #   Then <a href="/calendar/slug/">Read More</a>

    # More reliable: find all <a href="/calendar/..."> links (excluding images)
    seen_slugs: set[str] = set()
    for a in main.find_all("a", href=True):
        href = a.get("href", "")
        if "/calendar/" not in href:
            continue
        # Normalize to full URL
        full_url = urljoin(BASE_URL, href)
        # Deduplicate by slug
        slug = href.rstrip("/").split("/")[-1]
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        # Find title text near this link — look at the parent/sibling context
        parent = a.parent
        if parent:
            parent_text = _clean(parent.get_text(" "))
            # Strip the "Read More" suffix
            parent_text = re.sub(
                r"\s*Read More\s*$", "", parent_text, flags=re.IGNORECASE
            )
            if len(parent_text) > 5:
                results.append((parent_text, full_url))
            else:
                # Just record the URL, we'll get the title from the detail page
                results.append(("", full_url))

    return results


def _fetch_exhibition_detail(session: requests.Session, url: str) -> dict:
    """
    Fetch a TEC event detail page at /calendar/slug/.
    Returns dict with: title, opening_date, closing_date, description,
                        image_url, artist_name.
    """
    result: dict = {
        "title": None,
        "opening_date": None,
        "closing_date": None,
        "description": None,
        "image_url": None,
    }
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        logger.debug("Could not fetch %s: %s", url, exc)
        return result

    soup = BeautifulSoup(resp.text, "html.parser")

    # Title from <h1> inside tribe-events-single
    tribe = soup.find(class_="tribe-events-single")
    if tribe:
        h1 = tribe.find("h1")
        if h1:
            result["title"] = _clean(h1.get_text(" "))

    # Fallback title from og:title
    if not result["title"]:
        og_title = soup.find("meta", property="og:title")
        if og_title:
            raw = _clean(og_title.get("content", ""))
            # Strip site name suffix like " - MOCA GA"
            result["title"] = re.sub(
                r"\s*[-|]\s*MOCA GA\s*$", "", raw, flags=re.IGNORECASE
            )

    # Dates from .tribe-events-schedule: "Aug 30, 2025 - Oct 25, 2025 12am - 5pm"
    schedule = soup.find(class_=re.compile(r"tribe-events-schedule"))
    if schedule:
        schedule_text = _clean(schedule.get_text(" "))
        opening, closing = _parse_date_range(schedule_text, TEC_SCHEDULE_RE)
        result["opening_date"] = opening.isoformat() if opening else None
        result["closing_date"] = closing.isoformat() if closing else None

    # Description from .tribe-events-content
    content_div = soup.find(class_="tribe-events-content")
    if content_div:
        # Use first paragraph or two as description
        paragraphs = content_div.find_all("p")
        if paragraphs:
            desc_parts = [
                _clean(p.get_text(" "))
                for p in paragraphs[:3]
                if p.get_text(strip=True)
            ]
            if desc_parts:
                result["description"] = " ".join(desc_parts)[:800]

    # og:image
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        result["image_url"] = og_image["content"]

    return result


def _extract_artist_from_title(title: str) -> list[dict]:
    """
    Extract artist name(s) from exhibition titles like:
    - "Ayana Ross: Saving Our Sacred Selves" → artist = Ayana Ross
    - "SPARK" → no clear artist (skip)
    - "Studio Apprentices: From the 2023/2024 Working Artist Project" → group

    Returns a list of artist dicts with artist_name and role.
    """
    if not title or ":" not in title:
        return []

    artist_part = title.split(":", 1)[0].strip()

    # Reject if it looks institutional/generic
    generic_words = {
        "studio",
        "permanent",
        "collection",
        "selections",
        "celebration",
        "spark",
        "gallery",
        "special",
        "working",
        "artist",
        "project",
        "exhibition",
        "group",
    }
    if artist_part.lower() in generic_words:
        return []
    # Reject overly long "artist" parts (probably not a personal name)
    if len(artist_part.split()) > 5:
        return []
    # Reject if it contains program/institutional words
    if any(
        w in artist_part.lower() for w in ("project", "program", "studio", "apprentice")
    ):
        return []

    # Handle "Artist1 and Artist2" or "Artist1 & Artist2"
    parts = re.split(r"\s+(?:and|&)\s+", artist_part, flags=re.IGNORECASE)
    return [{"artist_name": p.strip(), "role": "artist"} for p in parts if p.strip()]


def _infer_exhibition_type(title: str, artists: list[dict]) -> str:
    """Infer solo/group/installation from title and artist list."""
    if not artists:
        return "group"
    if len(artists) == 1:
        # Check for title patterns that suggest it's really a group show
        title_lower = title.lower()
        if any(
            w in title_lower for w in ("collective", "group", "selections", "selected")
        ):
            return "group"
        return "solo"
    return "group"


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    today = date.today()
    found = new = updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    session = _session()

    # Check current year and previous year archives (exhibitions that opened last year
    # may still be running)
    current_year = today.year
    years_to_check = [current_year, current_year - 1]

    seen_urls: set[str] = set()
    candidate_urls: list[str] = []

    for year in years_to_check:
        entries = _fetch_archive_links(session, year)
        for _title_text, url in entries:
            if url not in seen_urls:
                seen_urls.add(url)
                candidate_urls.append(url)

    if not candidate_urls:
        logger.info("MOCA GA: no exhibition URLs found in year archives")
        return 0, 0, 0

    for url in candidate_urls:
        detail = _fetch_exhibition_detail(session, url)

        title = detail.get("title")
        if not title:
            logger.debug("MOCA GA: no title found for %s, skipping", url)
            continue

        closing_str = detail.get("closing_date")
        if closing_str:
            try:
                if date.fromisoformat(closing_str) < today:
                    logger.debug(
                        "MOCA GA: skipping past exhibition %r (closed %s)",
                        title,
                        closing_str,
                    )
                    continue
            except ValueError:
                pass

        opening_str = detail.get("opening_date")
        artists = _extract_artist_from_title(title)
        exhibition_type = _infer_exhibition_type(title, artists)

        record = {
            "title": title,
            "venue_id": venue_id,
            "source_id": source_id,
            "_venue_name": VENUE_DATA["name"],
            "opening_date": opening_str,
            "closing_date": closing_str,
            "description": detail.get("description"),
            "image_url": detail.get("image_url"),
            "source_url": url,
            "exhibition_type": exhibition_type,
            "admission_type": "free",
            "tags": ["georgia-artists", "contemporary-art", "museum", "buckhead"],
            "is_active": True,
        }

        found += 1
        result = insert_exhibition(record, artists=artists)
        if result:
            new += 1
        else:
            updated += 1

        logger.info(
            "MOCA GA exhibition: %r (open=%s close=%s type=%s artists=%s)",
            title,
            opening_str or "unknown",
            closing_str or "unknown",
            exhibition_type,
            [a["artist_name"] for a in artists],
        )

    logger.info(
        "MOCA GA exhibitions crawl complete: %s found, %s new, %s updated",
        found,
        new,
        updated,
    )
    return found, new, updated
