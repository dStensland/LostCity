"""
Crawler for Day & Night Projects (daynightprojects.art).

Strategy: static HTTP only — no Playwright required. Squarespace renders
exhibition content server-side, so plain GETs are sufficient.

Parse flow:
1. GET https://www.daynightprojects.art/current-projects
2. Find all .summary-item containers — extract title, image, and detail URL
3. For each item, fetch the detail page (/past-projects/<slug>)
4. Parse date information from the detail page body text
5. Extract artist name from title ("Artist: Title" or "...by Artist Name")
6. Route each result as an exhibition via build_exhibition_record() +
   TypedEntityEnvelope / persist_typed_entity_envelope()

Only /current-projects is processed — past projects are skipped.

Gallery is located in Atlanta's West End neighborhood at
1029 Ralph David Abernathy Blvd SW.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.daynightprojects.art"
CURRENT_PROJECTS_URL = f"{BASE_URL}/current-projects"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

PLACE_DATA = {
    "name": "Day & Night Projects",
    "slug": "day-night-projects",
    "address": "1029 Ralph David Abernathy Blvd SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7380,
    "lng": -84.4155,
    "venue_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
    "vibes": ["contemporary", "gallery", "west-end", "art", "independent"],
}

EXHIBITION_TAGS = [
    "day-night-projects",
    "gallery",
    "contemporary",
    "west-end",
    "art",
    "exhibition",
]

# Full + abbreviated month name → number
_MONTH_MAP: dict[str, int] = {
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

# Month token: full names and common abbreviations, with optional trailing period
# e.g. "January", "Jan", "Jan.", "Sept", "Sept."
_MONTH_TOKEN = (
    r"(?:January|February|March|April|May|June|July|August|September|"
    r"October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|"
    r"Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)"
)

# Pattern A: "Month DD – Month DD, YYYY"  (single year, shared)
# Handles abbreviated months with/without trailing period, and tight dashes (no spaces)
_DATE_RANGE_RE = re.compile(
    rf"({_MONTH_TOKEN})\s+(\d{{1,2}})\s*[–—\-]+\s*({_MONTH_TOKEN})\s+(\d{{1,2}}),?\s+(\d{{4}})",
    re.IGNORECASE,
)

# Pattern B: "Month DD, YYYY – Month DD, YYYY"  (year on both sides)
# Seen on Day & Night Projects: "Dec. 4, 2025 – Feb. 21, 2026"
_DATE_RANGE_DUAL_YEAR_RE = re.compile(
    rf"({_MONTH_TOKEN})\s+(\d{{1,2}}),?\s+(\d{{4}})\s*[–—\-]+\s*({_MONTH_TOKEN})\s+(\d{{1,2}}),?\s+(\d{{4}})",
    re.IGNORECASE,
)

# Pattern C: "Month DD-DD, YYYY" (same-month range, e.g. "October 3-6, 2024")
_DATE_SAME_MONTH_RE = re.compile(
    rf"({_MONTH_TOKEN})\s+(\d{{1,2}})\s*[–—\-]+\s*(\d{{1,2}}),?\s+(\d{{4}})",
    re.IGNORECASE,
)

# Pattern D: bare single date "Month DD, YYYY" (used as closing when no range found)
_DATE_SINGLE_RE = re.compile(
    rf"({_MONTH_TOKEN})\s+(\d{{1,2}}),?\s+(\d{{4}})",
    re.IGNORECASE,
)

# Pattern: "through Month DD, YYYY" / "until Month DD, YYYY" / "closes Month DD, YYYY"
_CLOSING_ONLY_RE = re.compile(
    rf"(?:through|until|closes?|closing)\s+({_MONTH_TOKEN})\s+(\d{{1,2}}),?\s+(\d{{4}})",
    re.IGNORECASE,
)

# Pattern: "opening Month DD" / "opens Month DD, YYYY"
_OPENING_ONLY_RE = re.compile(
    rf"(?:opening|opens?)\s+({_MONTH_TOKEN})\s+(\d{{1,2}}),?\s*(\d{{4}})?",
    re.IGNORECASE,
)


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("Day & Night Projects: request failed for %s: %s", url, exc)
        return None


def _month_num(raw: str) -> Optional[int]:
    """Look up a month number from a raw matched token, stripping any trailing period."""
    return _MONTH_MAP.get(raw.rstrip(".").lower())


def _parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Attempt to parse exhibition dates from arbitrary page text.

    Tries three patterns in order of specificity:
    1. Full range: "Month DD – Month DD, YYYY"
    2. Closing only: "through/until/closes Month DD, YYYY"
    3. Opening only: "opening/opens Month DD[, YYYY]"

    Returns (opening_date, closing_date) as ISO strings. Either may be None.
    Handles abbreviated month names with or without trailing period (Dec., Feb., etc.)
    """
    # --- Pattern 1a: dual-year range "Month DD, YYYY – Month DD, YYYY" ---
    m = _DATE_RANGE_DUAL_YEAR_RE.search(text)
    if m:
        start_month = _month_num(m.group(1))
        start_day = int(m.group(2))
        start_year = int(m.group(3))
        end_month = _month_num(m.group(4))
        end_day = int(m.group(5))
        end_year = int(m.group(6))
        if start_month and end_month:
            try:
                opening = datetime(start_year, start_month, start_day).strftime(
                    "%Y-%m-%d"
                )
                closing = datetime(end_year, end_month, end_day).strftime("%Y-%m-%d")
                return opening, closing
            except ValueError:
                pass

    # --- Pattern 1b: single-year range "Month DD – Month DD, YYYY" ---
    m = _DATE_RANGE_RE.search(text)
    if m:
        start_month = _month_num(m.group(1))
        start_day = int(m.group(2))
        end_month = _month_num(m.group(3))
        end_day = int(m.group(4))
        year = int(m.group(5))
        if start_month and end_month:
            try:
                start_year = year - 1 if start_month > end_month else year
                opening = datetime(start_year, start_month, start_day).strftime(
                    "%Y-%m-%d"
                )
                closing = datetime(year, end_month, end_day).strftime("%Y-%m-%d")
                return opening, closing
            except ValueError:
                pass

    # --- Pattern 2: same-month range "Month DD-DD, YYYY" ---
    m = _DATE_SAME_MONTH_RE.search(text)
    if m:
        month = _month_num(m.group(1))
        start_day = int(m.group(2))
        end_day = int(m.group(3))
        year = int(m.group(4))
        if month:
            try:
                opening = datetime(year, month, start_day).strftime("%Y-%m-%d")
                closing = datetime(year, month, end_day).strftime("%Y-%m-%d")
                return opening, closing
            except ValueError:
                pass

    # --- Pattern 3: closing-keyword date ---
    m = _CLOSING_ONLY_RE.search(text)
    if m:
        end_month = _month_num(m.group(1))
        end_day = int(m.group(2))
        year = int(m.group(3))
        if end_month:
            try:
                closing = datetime(year, end_month, end_day).strftime("%Y-%m-%d")
                return None, closing
            except ValueError:
                pass

    # --- Pattern 4: opening-keyword date ---
    m = _OPENING_ONLY_RE.search(text)
    if m:
        start_month = _month_num(m.group(1))
        start_day = int(m.group(2))
        year_str = m.group(3)
        year = int(year_str) if year_str else datetime.now().year
        if start_month:
            try:
                opening = datetime(year, start_month, start_day).strftime("%Y-%m-%d")
                return opening, None
            except ValueError:
                pass

    # --- Pattern 5: bare single date — treat as both opening and closing ---
    # This catches "Oct. 5, 2024" style content pages without a range.
    # If the date is in the past, it will be filtered as closed by the caller.
    m = _DATE_SINGLE_RE.search(text)
    if m:
        month = _month_num(m.group(1))
        day = int(m.group(2))
        year = int(m.group(3))
        if month:
            try:
                date_str = datetime(year, month, day).strftime("%Y-%m-%d")
                return date_str, date_str
            except ValueError:
                pass

    return None, None


def _extract_artist_from_title(title: str) -> Optional[str]:
    """
    Attempt to extract an artist name from an exhibition title.

    Handles two common formats:
    - "Artist Name: Exhibition Title"
    - "...Artworks by Artist Name"

    Returns the artist name string, or None if not parseable.
    """
    # "Artworks by Artist Name" (case-insensitive)
    by_match = re.search(r"\bartworks?\s+by\s+([A-Z][^,\n–—]+)", title, re.IGNORECASE)
    if by_match:
        return by_match.group(1).strip()

    # "Artist Name: Exhibition Title" — only treat as artist:title when the
    # part before the colon is short (≤4 words) to avoid false positives on
    # venue-prefixed titles like "Kei Museum and Day & Night Projects present—..."
    colon_idx = title.find(":")
    if colon_idx != -1:
        candidate = title[:colon_idx].strip()
        if len(candidate.split()) <= 4:
            return candidate

    return None


def _extract_image_from_soup(soup: BeautifulSoup) -> Optional[str]:
    """Return the best image URL from a parsed page."""
    # Prefer og:image meta tag
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]

    # Fall back to first Squarespace-hosted img
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-image")
        if src and ("squarespace" in src or "sqspcdn" in src):
            if src.startswith("//"):
                src = "https:" + src
            return src

    return None


def _parse_list_page(html: str) -> list[dict]:
    """
    Parse /current-projects and return a list of stubs:
      [{"title": str, "url": str, "image_url": str | None}, ...]
    """
    soup = BeautifulSoup(html, "html.parser")
    items = []

    for item in soup.find_all(class_="summary-item"):
        # Title
        title_tag = item.find(class_=re.compile(r"summary-title|entry-title"))
        if not title_tag:
            title_tag = item.find(["h1", "h2", "h3"])
        if not title_tag:
            continue
        # Strip control characters that can appear in Squarespace-rendered text
        title = re.sub(
            r"[\x00-\x08\x0b-\x1f\x7f]", " ", title_tag.get_text(" ", strip=True)
        )
        title = re.sub(r"\s{2,}", " ", title).strip()
        if not title:
            continue

        # Link to detail page
        link_tag = item.find("a", href=True)
        if not link_tag:
            continue
        href = link_tag["href"]
        if not href.startswith("http"):
            href = BASE_URL + href

        # Thumbnail image (best-effort from the list page)
        img_url: Optional[str] = None
        img_tag = item.find("img")
        if img_tag:
            src = (
                img_tag.get("data-src")
                or img_tag.get("src")
                or img_tag.get("data-image")
            )
            if src:
                if src.startswith("//"):
                    src = "https:" + src
                img_url = src

        items.append({"title": title, "url": href, "image_url": img_url})

    return items


def _parse_detail_page(html: str, detail_url: str) -> dict:
    """
    Parse a project detail page and return enrichment data:
      opening_date, closing_date, description, image_url
    """
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(" ", strip=True)

    opening_date, closing_date = _parse_date_range(page_text)

    # Description — prefer meta description, fall back to first paragraph
    meta_desc = soup.find("meta", attrs={"name": "description"})
    description: Optional[str] = None
    if meta_desc and meta_desc.get("content"):
        description = meta_desc["content"].strip()
    else:
        # Look for the main content block
        content_block = soup.find(
            class_=re.compile(r"sqs-html-content|entry-content|project-desc")
        )
        if content_block:
            raw = content_block.get_text(" ", strip=True)
            description = raw if len(raw) < 600 else raw[:597] + "..."

    image_url = _extract_image_from_soup(soup)

    return {
        "opening_date": opening_date,
        "closing_date": closing_date,
        "description": description,
        "image_url": image_url,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Day & Night Projects exhibitions via static HTTP (no Playwright)."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    venue_id = get_or_create_place(PLACE_DATA)
    envelope = TypedEntityEnvelope()

    # Step 1: fetch the current-projects list page
    logger.info("Day & Night Projects: fetching list page %s", CURRENT_PROJECTS_URL)
    list_html = _fetch(CURRENT_PROJECTS_URL, session)
    if not list_html:
        logger.error("Day & Night Projects: failed to fetch list page")
        return 0, 0, 0

    stubs = _parse_list_page(list_html)
    if not stubs:
        logger.warning(
            "Day & Night Projects: no .summary-item entries found on list page"
        )
        return 0, 0, 0

    logger.info(
        "Day & Night Projects: found %d items on current-projects page", len(stubs)
    )
    today = datetime.now().strftime("%Y-%m-%d")

    # Step 2: fetch each detail page
    for stub in stubs:
        detail_url = stub["url"]
        title = stub["title"]

        logger.debug("Day & Night Projects: fetching detail page %s", detail_url)
        detail_html = _fetch(detail_url, session)

        if detail_html:
            detail = _parse_detail_page(detail_html, detail_url)
        else:
            logger.warning(
                "Day & Night Projects: could not fetch detail for %r, using stub data",
                title,
            )
            detail = {
                "opening_date": None,
                "closing_date": None,
                "description": None,
                "image_url": None,
            }

        # Fall back to today when no opening date found
        opening_date = detail["opening_date"] or today
        closing_date = detail["closing_date"]

        # Skip if already closed
        if closing_date and closing_date < today:
            logger.debug(
                "Day & Night Projects: skipping closed exhibition %r (closed %s)",
                title,
                closing_date,
            )
            continue

        # Prefer detail page image; fall back to list-page thumbnail
        image_url = detail["image_url"] or stub.get("image_url")

        # Extract artist from title if possible
        artist_name = _extract_artist_from_title(title)
        artists: Optional[list[dict]] = None
        if artist_name:
            artists = [{"artist_name": artist_name, "role": "artist"}]

        events_found += 1

        ex_record, ex_artists = build_exhibition_record(
            title=title,
            venue_id=venue_id,
            source_id=source_id,
            opening_date=opening_date,
            closing_date=closing_date,
            venue_name=PLACE_DATA["name"],
            description=detail["description"],
            image_url=image_url,
            source_url=detail_url,
            portal_id=portal_id,
            admission_type="free",
            tags=EXHIBITION_TAGS,
            artists=artists,
        )
        envelope.add("exhibitions", ex_record)

        logger.info(
            "Day & Night Projects: queued %r (%s – %s)",
            title,
            opening_date,
            closing_date or "ongoing",
        )

        # Polite inter-request delay
        time.sleep(0.5)

    # Step 3: persist
    if envelope.exhibitions:
        persist_result = persist_typed_entity_envelope(envelope)
        events_new = persist_result.persisted.get("exhibitions", 0)
        skipped = persist_result.skipped.get("exhibitions", 0)
        if skipped:
            events_updated = skipped
            logger.info(
                "Day & Night Projects: %d exhibition(s) already current (skipped)",
                skipped,
            )

    logger.info(
        "Day & Night Projects crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
