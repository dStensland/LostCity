"""
Crawler for Tew Galleries (tewgalleries.com).

Strategy: static HTTP only — no Playwright required.  The site is a custom
PHP CMS that renders exhibition content server-side, so a plain GET is
sufficient.

Parse flow:
1. GET https://tewgalleries.com/exhibitions
2. Find div#current-exhibitions and collect all div.exhibition-item nodes
3. For each item extract:
   - title       from span.caption-title
   - date range  from span.caption-desc  ("Apr 17 – May 23, 2026")
   - image_url   from img src (made absolute)
   - source_url  from the anchor href (made absolute)
4. Skip exhibitions whose closing_date is already in the past
5. Route each result as an exhibition via build_exhibition_record() +
   TypedEntityEnvelope / persist_typed_entity_envelope()

Date format observed on site: "Mon DD – Mon DD, YYYY" using HTML &ndash;
(en-dash).  The parser normalises en/em dashes to ASCII hyphens before
matching.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag

from db import get_or_create_place
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

BASE_URL = "https://tewgalleries.com"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

PLACE_DATA = {
    "name": "Tew Galleries",
    "slug": "tew-galleries",
    "address": "425 Peachtree Hills Ave NE, Suite 24",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8289,
    "lng": -84.3657,
    "place_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
    "vibes": ["fine-art", "gallery", "buckhead"],
}

EXHIBITION_TAGS = [
    "tew-galleries",
    "gallery",
    "fine-art",
    "buckhead",
    "art",
    "exhibition",
]

# Month name → number (full names + common abbreviations)
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

# Matches: "Apr 17 – May 23, 2026" (en-dash or plain hyphen after normalisation)
_DATE_RANGE_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|"
    r"October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|"
    r"Sept|Oct|Nov|Dec)\s+(\d{1,2})\s*-+\s*"
    r"(January|February|March|April|May|June|July|August|September|"
    r"October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|"
    r"Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
    re.IGNORECASE,
)


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch *url* and return the response HTML, or None on failure."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("Tew Galleries: request failed for %s: %s", url, exc)
        return None


def _parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a date range string like "Apr 17 – May 23, 2026".

    The site uses HTML en-dashes (&ndash;) which BeautifulSoup renders as
    the Unicode character U+2013.  These are normalised to plain hyphens
    before matching.

    Returns (opening_date, closing_date) as ISO strings, or (None, None).
    """
    # Normalise en-dash and em-dash to plain hyphen
    text = text.replace("\u2013", "-").replace("\u2014", "-")

    m = _DATE_RANGE_RE.search(text)
    if not m:
        return None, None

    start_month = _MONTH_MAP.get(m.group(1).lower())
    start_day = int(m.group(2))
    end_month = _MONTH_MAP.get(m.group(3).lower())
    end_day = int(m.group(4))
    year = int(m.group(5))

    if not start_month or not end_month:
        return None, None

    try:
        # If the opening month is later than the closing month the show spans
        # a year boundary (e.g. "Dec 5 – Jan 15, 2027").
        start_year = year - 1 if start_month > end_month else year
        opening = datetime(start_year, start_month, start_day).strftime("%Y-%m-%d")
        closing = datetime(year, end_month, end_day).strftime("%Y-%m-%d")
        return opening, closing
    except ValueError:
        return None, None


def _make_absolute(path: str) -> str:
    """Return an absolute URL given a path that may already be absolute."""
    if path.startswith("http"):
        return path
    if path.startswith("//"):
        return "https:" + path
    return BASE_URL + path


def _parse_current_exhibitions(soup: BeautifulSoup) -> list[dict]:
    """
    Extract current exhibition records from the /exhibitions page.

    The relevant HTML looks like:

        <div id="current-exhibitions">
          <div class="exhibition-item list-item" data-exhibition-id="92">
            <a href="/exhibition/92/">
              <span class="img-container">
                <img src="/images/25972_h800w800crop.5.jpg" .../>
              </span>
              <span class="thumb-caption">
                <span class="caption-title truncate">EXHIBITION TITLE</span>
                <span class="caption-desc truncate">Apr 17 – May 23, 2026</span>
              </span>
            </a>
          </div>
          ...
        </div>

    Returns a list of dicts with keys: title, opening_date, closing_date,
    image_url, source_url.
    """
    container = soup.find(id="current-exhibitions")
    if not container:
        logger.warning("Tew Galleries: #current-exhibitions not found on page")
        return []

    results: list[dict] = []
    items = container.find_all("div", class_="exhibition-item")
    if not items:
        logger.warning("Tew Galleries: no div.exhibition-item found in #current-exhibitions")
        return []

    for item in items:
        # --- title ---
        title_el = item.find(class_="caption-title")
        if not title_el:
            logger.debug("Tew Galleries: skipping item with no caption-title")
            continue
        title = title_el.get_text(" ", strip=True)
        if not title:
            continue

        # --- date range ---
        desc_el = item.find(class_="caption-desc")
        date_text = desc_el.get_text(" ", strip=True) if desc_el else ""
        opening_date, closing_date = _parse_date_range(date_text)
        if not opening_date:
            logger.warning(
                "Tew Galleries: could not parse date range %r for exhibition %r",
                date_text,
                title,
            )
            # Record the exhibition anyway with today as the fallback opening date.
            opening_date = datetime.now().strftime("%Y-%m-%d")

        # --- image ---
        img_el = item.find("img")
        image_url: Optional[str] = None
        if img_el:
            src = img_el.get("src") or img_el.get("data-src") or ""
            if src:
                image_url = _make_absolute(src)

        # --- source URL ---
        anchor: Optional[Tag] = item.find("a", href=True)
        source_url = _make_absolute(anchor["href"]) if anchor else EXHIBITIONS_URL

        results.append(
            {
                "title": title,
                "opening_date": opening_date,
                "closing_date": closing_date,
                "image_url": image_url,
                "source_url": source_url,
            }
        )

    return results


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Tew Galleries exhibitions via static HTTP (no Playwright)."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0

    envelope = TypedEntityEnvelope()
    session = requests.Session()

    venue_id = get_or_create_place(PLACE_DATA)

    logger.info("Tew Galleries: fetching exhibitions page %s", EXHIBITIONS_URL)
    html = _fetch(EXHIBITIONS_URL, session)
    if not html:
        logger.error("Tew Galleries: failed to fetch exhibitions page")
        return 0, 0, 0

    soup = BeautifulSoup(html, "html.parser")
    exhibitions = _parse_current_exhibitions(soup)

    if not exhibitions:
        logger.warning("Tew Galleries: no current exhibitions found")
        return 0, 0, 0

    today = datetime.now().strftime("%Y-%m-%d")

    for parsed in exhibitions:
        # Skip exhibitions that have already closed
        if parsed["closing_date"] and parsed["closing_date"] < today:
            logger.info(
                "Tew Galleries: exhibition %r closed %s — skipping",
                parsed["title"],
                parsed["closing_date"],
            )
            continue

        events_found += 1

        ex_record, ex_artists = build_exhibition_record(
            title=parsed["title"],
            venue_id=venue_id,
            source_id=source_id,
            opening_date=parsed["opening_date"],
            closing_date=parsed["closing_date"],
            venue_name=PLACE_DATA["name"],
            description=None,
            image_url=parsed["image_url"],
            source_url=parsed["source_url"],
            portal_id=portal_id,
            admission_type="free",
            tags=EXHIBITION_TAGS,
            exhibition_type="solo",
        )
        envelope.add("exhibitions", ex_record)

        logger.info(
            "Tew Galleries: queued exhibition %r (%s – %s)",
            parsed["title"],
            parsed["opening_date"],
            parsed.get("closing_date", "?"),
        )

    if envelope.exhibitions:
        persist_result = persist_typed_entity_envelope(envelope)
        events_new = persist_result.persisted.get("exhibitions", 0)
        skipped = persist_result.skipped.get("exhibitions", 0)
        if skipped:
            events_updated = skipped
            logger.info(
                "Tew Galleries: %d exhibition(s) already current (skipped)", skipped
            )

    logger.info(
        "Tew Galleries crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
