"""
Crawler for Sandler Hudson Gallery (sandlerhudson.com).

Strategy: static HTTP only — no Playwright required.  Squarespace renders
exhibition content server-side, so a plain GET is sufficient.

Parse flow:
1. GET https://www.sandlerhudson.com/
2. Find the first .sqs-html-content block that contains "Exhibition Dates:"
3. Extract the exhibition title from the <h2> in that block
4. Parse the date range ("Month DD – Month DD, YYYY" / "Month DD - Month DD, YYYY")
5. Grab the first non-logo artwork <img> on the page as image_url
6. Route the result as an exhibition via build_exhibition_record() +
   TypedEntityEnvelope / persist_typed_entity_envelope()

Gallery moved in 2024 to 739 Trabert Ave NW, Suite B (confirmed via site footer).
All content from this gallery is classified as exhibitions.
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

BASE_URL = "https://www.sandlerhudson.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

PLACE_DATA = {
    "name": "Sandler Hudson Gallery",
    "slug": "sandler-hudson-gallery",
    "address": "739 Trabert Ave NW, Suite B",
    "neighborhood": "Westside",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7891,
    "lng": -84.4207,
    "venue_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
    "vibes": ["contemporary", "gallery", "westside", "fine-art"],
}

EXHIBITION_TAGS = [
    "sandler-hudson",
    "gallery",
    "contemporary",
    "westside",
    "art",
    "exhibition",
]

# Month name → number mapping (full + abbreviated)
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
    """Fetch URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("Sandler Hudson Gallery: request failed for %s: %s", url, exc)
        return None


def _parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a date range from text like:
      "February 13 - March 28, 2026"
      "February 13 – March 28, 2026"
      "Feb 13 – Mar 28, 2026"

    Returns (opening_date, closing_date) as ISO strings, or (None, None).
    """
    # Normalise unicode en-dash/em-dash to plain hyphen
    text = text.replace("\u2013", "-").replace("\u2014", "-")

    # Pattern: Month DD – Month DD, YYYY
    pattern = (
        r"(January|February|March|April|May|June|July|August|September|"
        r"October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|"
        r"Sept|Oct|Nov|Dec)\s+(\d{1,2})\s*[-]+\s*"
        r"(January|February|March|April|May|June|July|August|September|"
        r"October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|"
        r"Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})"
    )
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return None, None

    start_month_name = m.group(1).lower()
    start_day = int(m.group(2))
    end_month_name = m.group(3).lower()
    end_day = int(m.group(4))
    year = int(m.group(5))

    start_month = _MONTH_MAP.get(start_month_name)
    end_month = _MONTH_MAP.get(end_month_name)
    if not start_month or not end_month:
        return None, None

    try:
        # If the start month is later than the end month, the opening year is
        # one year earlier than the closing year (e.g. Dec – Jan, 2026).
        start_year = year - 1 if start_month > end_month else year
        opening = datetime(start_year, start_month, start_day).strftime("%Y-%m-%d")
        closing = datetime(year, end_month, end_day).strftime("%Y-%m-%d")
        return opening, closing
    except ValueError:
        return None, None


def _extract_exhibition(soup: BeautifulSoup) -> Optional[dict]:
    """
    Parse the homepage for the current exhibition.

    Squarespace server-renders the exhibition block as:
      <div class="sqs-html-content">
        <h2><strong>Exhibition Title</strong></h2>
        <h1>Curated by ...</h1>
        <h1>Exhibition Dates: Month DD – Month DD, YYYY<br/>...</h1>
      </div>

    Returns a dict with keys: title, opening_date, closing_date, image_url,
    source_url, description.  Returns None if the block cannot be parsed.
    """
    blocks = soup.find_all(class_="sqs-html-content")

    target_block: Optional[Tag] = None
    for block in blocks:
        if "Exhibition Dates:" in block.get_text():
            target_block = block
            break

    if target_block is None:
        logger.warning(
            "Sandler Hudson Gallery: no .sqs-html-content block with 'Exhibition Dates:' found"
        )
        return None

    # Title — first <h2> (or <h1> if no h2) in the block
    h2 = target_block.find("h2")
    h1_tags = target_block.find_all("h1")

    title: Optional[str] = None
    if h2:
        title = h2.get_text(" ", strip=True)
    elif h1_tags:
        title = h1_tags[0].get_text(" ", strip=True)

    if not title:
        logger.warning("Sandler Hudson Gallery: could not extract exhibition title")
        return None

    # Dates — look inside all <h1> tags for "Exhibition Dates:"
    opening_date: Optional[str] = None
    closing_date: Optional[str] = None
    for h1 in h1_tags:
        text = h1.get_text(" ", strip=True)
        if "Exhibition Dates:" in text:
            date_text = text.split("Exhibition Dates:", 1)[1]
            opening_date, closing_date = _parse_date_range(date_text)
            break

    if not opening_date:
        logger.warning(
            "Sandler Hudson Gallery: could not parse exhibition dates for %r", title
        )
        # Still record the exhibition — a missing date is better than no record.
        opening_date = datetime.now().strftime("%Y-%m-%d")

    # Image — first non-logo artwork img on the page.
    # The logo images have alt="SANDLER HUDSON GALLERY"; artwork images have
    # a blank alt or an artwork description.
    image_url: Optional[str] = None
    for img in soup.find_all("img"):
        alt = (img.get("alt") or "").strip().upper()
        if alt == "SANDLER HUDSON GALLERY":
            continue
        src = img.get("src") or img.get("data-src") or img.get("data-image")
        if src and "squarespace" in src:
            # Ensure absolute URL
            if src.startswith("//"):
                src = "https:" + src
            image_url = src
            break

    # Build a description from the block's full text
    full_text = target_block.get_text(" ", strip=True)
    description = full_text if len(full_text) < 600 else full_text[:597] + "..."

    return {
        "title": title,
        "opening_date": opening_date,
        "closing_date": closing_date,
        "image_url": image_url,
        "source_url": BASE_URL,
        "description": description,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Sandler Hudson Gallery exhibitions via static HTTP (no Playwright)."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0

    envelope = TypedEntityEnvelope()

    session = requests.Session()
    venue_id = get_or_create_place(PLACE_DATA)

    logger.info("Sandler Hudson Gallery: fetching homepage %s", BASE_URL)
    html = _fetch(BASE_URL, session)
    if not html:
        logger.error("Sandler Hudson Gallery: failed to fetch homepage")
        return 0, 0, 0

    soup = BeautifulSoup(html, "html.parser")
    parsed = _extract_exhibition(soup)

    if not parsed:
        logger.error("Sandler Hudson Gallery: no exhibition data found on homepage")
        return 0, 0, 0

    today = datetime.now().strftime("%Y-%m-%d")

    # Skip if the exhibition has already closed
    if parsed["closing_date"] and parsed["closing_date"] < today:
        logger.info(
            "Sandler Hudson Gallery: current exhibition %r closed %s — nothing to record",
            parsed["title"],
            parsed["closing_date"],
        )
        return 0, 0, 0

    events_found = 1

    ex_record, ex_artists = build_exhibition_record(
        title=parsed["title"],
        venue_id=venue_id,
        source_id=source_id,
        opening_date=parsed["opening_date"],
        closing_date=parsed["closing_date"],
        venue_name=PLACE_DATA["name"],
        description=parsed["description"],
        image_url=parsed["image_url"],
        source_url=parsed["source_url"],
        portal_id=portal_id,
        admission_type="free",
        tags=EXHIBITION_TAGS,
        exhibition_type="solo",
    )
    envelope.add("exhibitions", ex_record)

    logger.info(
        "Sandler Hudson Gallery: queued exhibition %r (%s – %s)",
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
                "Sandler Hudson Gallery: %d exhibition(s) already current (skipped)", skipped
            )

    logger.info(
        "Sandler Hudson Gallery crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
