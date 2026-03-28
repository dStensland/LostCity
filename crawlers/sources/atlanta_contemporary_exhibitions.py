"""
Exhibition crawler for Atlanta Contemporary (atlantacontemporary.org/exhibitions).

Atlanta Contemporary is a free contemporary art center in West Midtown that presents
over 100 artists per year. Their exhibitions page renders server-side HTML with a
clean masonry grid of <article> elements inside .exhibitions__featured.

Each article contains:
- A <p> with the date range: "February 1, 2026 - May 17, 2026"
- An <h2> with the artist/collector name
- An <h3> with the exhibition subtitle
- An <a href> linking to the detail page

The detail page at /exhibits/[slug] has the full description in page body text
and an og:image for the exhibition.

Artist name extraction: the <h2> is always the artist name; <h3> is the title.
When the <h2> is a collection/archive name (e.g. "Johnson Publishing Company Archives"),
it's treated as a group exhibition and both h2+h3 form the full title.
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

BASE_URL = "https://atlantacontemporary.org"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 20

PLACE_DATA = {
    "name": "Atlanta Contemporary",
    "slug": "atlanta-contemporary",
    "address": "535 Means St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7617,
    "lng": -84.4103,
    "place_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
    "description": (
        "Atlanta Contemporary plays a vital role in Atlanta's cultural landscape "
        "by presenting over 100 consequential artists from the local and international "
        "art community each year. Admission is always free."
    ),
    "vibes": [
        "contemporary-art",
        "free-admission",
        "west-midtown",
        "gallery",
        "community",
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

# Names that indicate a group/archive exhibition rather than a single artist
_ARCHIVE_INDICATORS = frozenset(
    {
        "archives",
        "archive",
        "collection",
        "collective",
        "company",
        "institute",
        "program",
        "programme",
        "museum",
        "gallery",
        "foundation",
        "center",
        "centre",
    }
)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def _parse_date_range(text: str) -> tuple[Optional[date], Optional[date]]:
    """Parse 'Month D, YYYY - Month D, YYYY' style ranges."""
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
    year2 = int(m.group("y2")) if m.group("y2") else date.today().year
    year1 = int(m.group("y1")) if m.group("y1") else year2

    if not m.group("y1") and month1 > month2:
        year1 = year2 - 1

    try:
        return date(year1, month1, day1), date(year2, month2, day2)
    except ValueError:
        return None, None


def _is_archive_or_collective(name: str) -> bool:
    """True if name looks like an institutional source rather than a person."""
    words = name.lower().split()
    return any(w in _ARCHIVE_INDICATORS for w in words)


def _session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    return s


def _fetch_detail(session: requests.Session, url: str) -> dict:
    """Fetch exhibition detail page. Returns dict with image_url and description."""
    result: dict = {"image_url": None, "description": None}
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        logger.debug("Could not fetch %s: %s", url, exc)
        return result

    soup = BeautifulSoup(resp.text, "html.parser")

    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        result["image_url"] = og_image["content"]

    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        result["description"] = _clean(og_desc["content"])

    return result


def _parse_exhibitions(
    soup: BeautifulSoup, today: date, session: requests.Session
) -> list[dict]:
    """
    Parse exhibition articles from .exhibitions__featured masonry grid.

    Each article structure:
      <article>
        <p>February 1, 2026 - May 17, 2026</p>
        <figure><a href="/exhibits/slug"><img /></a></figure>
        <div>
          <a href="/exhibits/slug"><h2>Artist Name</h2></a>
          <h3>Exhibition Title</h3>
        </div>
      </article>
    """
    featured = soup.find(class_="exhibitions__featured")
    if not featured:
        # Fallback: search all articles on page
        featured = soup

    articles = featured.find_all("article")
    if not articles:
        logger.warning(
            "Atlanta Contemporary: no <article> elements found on exhibitions page"
        )
        return []

    exhibitions = []

    for article in articles:
        # Date range
        date_p = article.find("p")
        date_text = _clean(date_p.get_text(" ")) if date_p else ""
        opening, closing = _parse_date_range(date_text)

        # Skip past exhibitions
        if closing and closing < today:
            logger.debug("Atlanta Contemporary: skipping past exhibition %s", date_text)
            continue

        # Artist name is in <h2>, exhibition title in <h3>
        h2 = article.find("h2")
        h3 = article.find("h3")
        artist_raw = _clean(h2.get_text(" ")) if h2 else ""
        subtitle = _clean(h3.get_text(" ")) if h3 else ""

        if not artist_raw and not subtitle:
            continue

        # Build title: "Artist Name: Exhibition Subtitle" or just artist_raw if no subtitle
        if subtitle:
            title = f"{artist_raw}: {subtitle}" if artist_raw else subtitle
        else:
            title = artist_raw

        # Source URL from first <a> in the div or figure
        detail_url = None
        for a in article.find_all("a", href=True):
            href = a.get("href", "")
            if "/exhibit" in href:
                detail_url = urljoin(BASE_URL, href)
                break

        if not detail_url:
            detail_url = EXHIBITIONS_URL

        # Image: prefer the <img> src in the figure
        img = article.find("img")
        image_url = None
        if img:
            image_url = img.get("src") or img.get("data-src")

        # Determine exhibition type based on artist field
        if not artist_raw or _is_archive_or_collective(artist_raw):
            exhibition_type = "group"
            artists = []
        else:
            # Could be solo (1 artist) or group if multiple names separated by commas/&
            artist_names = re.split(
                r"\s*[,&]\s*|\s+and\s+", artist_raw, flags=re.IGNORECASE
            )
            artist_names = [
                n.strip() for n in artist_names if n.strip() and len(n.strip()) > 2
            ]
            exhibition_type = "solo" if len(artist_names) == 1 else "group"
            artists = [{"artist_name": n, "role": "artist"} for n in artist_names]

        # Fetch detail page for better image and description
        if detail_url != EXHIBITIONS_URL:
            detail = _fetch_detail(session, detail_url)
            if detail.get("image_url") and not image_url:
                image_url = detail["image_url"]
            description = detail.get("description")
        else:
            description = None

        exhibitions.append(
            {
                "title": title,
                "artist_raw": artist_raw,
                "opening_date": opening.isoformat() if opening else None,
                "closing_date": closing.isoformat() if closing else None,
                "source_url": detail_url,
                "image_url": image_url,
                "description": description,
                "exhibition_type": exhibition_type,
                "artists": artists,
            }
        )

    return exhibitions


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    today = date.today()
    found = new = updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    session = _session()

    try:
        resp = session.get(EXHIBITIONS_URL, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        logger.error("Atlanta Contemporary exhibitions: fetch failed: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    exhibitions = _parse_exhibitions(soup, today, session)

    if not exhibitions:
        logger.info("Atlanta Contemporary: no current or upcoming exhibitions found")
        return 0, 0, 0

    for exh in exhibitions:
        record = {
            "title": exh["title"],
            "place_id": venue_id,
            "source_id": source_id,
            "_venue_name": PLACE_DATA["name"],
            "opening_date": exh["opening_date"],
            "closing_date": exh["closing_date"],
            "description": exh.get("description"),
            "image_url": exh.get("image_url"),
            "source_url": exh["source_url"],
            "exhibition_type": exh["exhibition_type"],
            "admission_type": "free",
            "tags": ["free", "contemporary-art", "west-midtown", "nonprofit"],
            "is_active": True,
        }

        found += 1
        result = insert_exhibition(record, artists=exh.get("artists") or [])
        if result:
            new += 1
        else:
            updated += 1

        logger.info(
            "Atlanta Contemporary exhibition: %r (open=%s close=%s type=%s artists=%s)",
            exh["title"],
            exh["opening_date"] or "unknown",
            exh["closing_date"] or "unknown",
            exh["exhibition_type"],
            [a["artist_name"] for a in (exh.get("artists") or [])],
        )

    logger.info(
        "Atlanta Contemporary exhibitions crawl complete: %s found, %s new, %s updated",
        found,
        new,
        updated,
    )
    return found, new, updated
