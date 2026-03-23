"""
Crawler for Emory Visual Arts Gallery (filmandmedia.emory.edu).

Strategy: static HTTP only — no Playwright required. Emory's CMS renders
exhibition content server-side, so a plain GET is sufficient.

Parse flow:
1. GET https://filmandmedia.emory.edu/news/vizartsgallery.html
2. Find all exhibition row blocks (div.row containing div.col-md-8 with
   "On view:" text)
3. For each block, extract:
   - Title: from <h1 class="display-4"> or styled <span> fallback
   - Date range: from <p class="text-muted"> containing "On view:"
   - Description: from <p class="lead"> and following paragraphs
   - Image: from sibling div.col-md-4 (relative URL, resolved to absolute)
4. Route each result as an exhibition via build_exhibition_record() +
   TypedEntityEnvelope / persist_typed_entity_envelope()

The page lists the current exhibition plus any upcoming exhibitions. Both are
crawled — closed exhibitions are skipped via the closing_date guard.

Gallery address: 700 Peavine Creek Dr, Atlanta, GA 30322 (confirmed on page).
Admission: free (university gallery, no ticket required).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

from db import get_or_create_venue
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

BASE_URL = "https://filmandmedia.emory.edu/news/vizartsgallery.html"
# Base for resolving relative image paths (../images/... lives one level up)
IMAGE_BASE = "https://filmandmedia.emory.edu/news/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

VENUE_DATA = {
    "name": "Emory Visual Arts Gallery",
    "slug": "emory-visual-arts-gallery",
    "address": "700 Peavine Creek Dr",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "lat": 33.7923,
    "lng": -84.3251,
    "venue_type": "gallery",
    "spot_type": "gallery",
    "website": "https://filmandmedia.emory.edu/news/vizartsgallery.html",
    "vibes": ["university", "gallery", "contemporary", "free"],
}

EXHIBITION_TAGS = [
    "emory",
    "gallery",
    "university",
    "contemporary",
    "art",
    "exhibition",
    "free",
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


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("Emory Visual Arts Gallery: request failed for %s: %s", url, exc)
        return None


def _parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a date range from text like:
      "February 23 - March 13, 2026"
      "March 19 - April 15, 2026"
      "Feb 23 – Mar 13, 2026"

    Returns (opening_date, closing_date) as ISO strings, or (None, None).
    """
    # Normalise unicode en-dash / em-dash to plain hyphen
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
        # If start month is later than end month the show spans a year boundary
        # (e.g. "December 1 – January 15, 2027")
        start_year = year - 1 if start_month > end_month else year
        opening = datetime(start_year, start_month, start_day).strftime("%Y-%m-%d")
        closing = datetime(year, end_month, end_day).strftime("%Y-%m-%d")
        return opening, closing
    except ValueError:
        return None, None


def _extract_title_from_block(block: Tag) -> Optional[str]:
    """
    Extract the exhibition title from a col-md-8 content block.

    Emory uses two different markup patterns across exhibitions:
      Pattern A: <h1 class="display-4">Title</h1>
      Pattern B: <p><span style="...font-weight: bold...">Title</span></p>

    Returns the stripped title string, or None if not found.
    """
    # Pattern A — preferred
    h1 = block.find("h1", class_="display-4")
    if h1:
        title = h1.get_text(" ", strip=True)
        if title:
            return title

    # Pattern B — styled span acting as heading
    for span in block.find_all("span"):
        style = span.get("style", "")
        if "font-weight: bold" in style or "font-weight:bold" in style:
            title = span.get_text(" ", strip=True)
            if title and len(title) > 3:
                return title

    return None


def _resolve_image_url(src: str) -> Optional[str]:
    """Resolve a possibly-relative image src to an absolute URL."""
    if not src:
        return None
    if src.startswith("http"):
        return src
    if src.startswith("//"):
        return "https:" + src
    # Relative path like ../images/1by1-square/dale-jackson.jpg
    return urljoin(IMAGE_BASE, src)


def _exhibition_rows(soup: BeautifulSoup) -> list[Tag]:
    """
    Return the set of Bootstrap rows that each represent one exhibition.

    The Emory CMS renders exhibitions inside div.wysiwyg → nested containers.

    Layout A (compact):
      Row with col-md-8 (title + dates + description) + col-md-4 (img).

    Layout B (split across rows):
      Row N has col-md-8 with title + date but NO col-md-4.
      Row N+1 has col-md-8 (description) + col-md-4 (img).
      We detect this by checking if a row has "On view:" text in a col-md-8
      but lacks a col-md-4 — then look at the next sibling row for the image.
    """
    all_rows = soup.find_all("div", class_="row")
    candidates: list[Tag] = []
    skip_next: set[int] = set()

    for i, row in enumerate(all_rows):
        if i in skip_next:
            continue

        col8 = row.find("div", class_="col-md-8", recursive=False)
        if col8 is None:
            continue
        if "On view:" not in row.get_text():
            continue

        col4 = row.find("div", class_="col-md-4", recursive=False)

        # Layout A: both col-md-8 and col-md-4 with img in same row
        if col4 and col4.find("img"):
            candidates.append(row)
            continue

        # Layout B: title/dates row without image — check next row
        if i + 1 < len(all_rows):
            next_row = all_rows[i + 1]
            next_col4 = next_row.find("div", class_="col-md-4", recursive=False)
            if next_col4 and next_col4.find("img"):
                # Merge: use this row (has title/dates) but tag the image source
                row._layout_b_image_row = next_row  # type: ignore[attr-defined]
                skip_next.add(i + 1)
                candidates.append(row)
                continue

        # No image found anywhere — still include if it has title + dates
        candidates.append(row)

    return candidates


def _extract_exhibitions(soup: BeautifulSoup) -> list[dict]:
    """
    Parse the gallery page for all current and upcoming exhibitions.

    Each canonical exhibition row has a col-md-8 (title + dates + description)
    and a col-md-4 (exhibition image).  See _exhibition_rows() for the
    filtering logic that handles the Emory CMS's inconsistent nesting.

    Returns a list of dicts with keys: title, opening_date, closing_date,
    image_url, source_url, description.
    """
    results: list[dict] = []
    seen_titles: set[str] = set()

    for row in _exhibition_rows(soup):
        col8: Tag = row.find("div", class_="col-md-8", recursive=False)
        col4: Optional[Tag] = row.find("div", class_="col-md-4", recursive=False)

        # Layout B: image is in the next row (attached by _exhibition_rows)
        image_row: Optional[Tag] = getattr(row, "_layout_b_image_row", None)

        # Title — may be h1.display-4 (Layout A) or bold span (Layout B)
        title = _extract_title_from_block(col8)
        if not title:
            # Layout B fallback: title may be plain text before "On view:"
            full_text = col8.get_text(" ", strip=True)
            on_view_idx = full_text.find("On view:")
            if on_view_idx > 0:
                candidate = full_text[:on_view_idx].strip()
                # Strip trailing label words
                for suffix in ["Closing Reception:", "Opening Reception:", "Location:", "Gallery Hours:"]:
                    idx = candidate.find(suffix)
                    if idx > 0:
                        candidate = candidate[:idx].strip()
                if len(candidate) > 5:
                    title = candidate

        if not title:
            logger.warning(
                "Emory Visual Arts Gallery: could not extract title from row; skipping"
            )
            continue

        if title in seen_titles:
            continue
        seen_titles.add(title)

        # "On view:" date — find the text-muted paragraph inside col8
        muted_p: Optional[Tag] = col8.find("p", class_="text-muted")
        opening_date: Optional[str] = None
        closing_date: Optional[str] = None
        if muted_p:
            on_view_text = muted_p.get_text(strip=True)
            date_text = on_view_text.removeprefix("On view:").strip()
            opening_date, closing_date = _parse_date_range(date_text)

        # Fallback: parse "On view:" from full text
        if not opening_date:
            full_text = col8.get_text(" ", strip=True)
            on_view_match = re.search(r"On view:\s*(.+?)(?:Opening|Closing|Location|Gallery|$)", full_text)
            if on_view_match:
                opening_date, closing_date = _parse_date_range(on_view_match.group(1))

        if not opening_date:
            logger.warning(
                "Emory Visual Arts Gallery: could not parse dates for %r; "
                "using today as fallback",
                title,
            )
            opening_date = datetime.now().strftime("%Y-%m-%d")

        # Image — in the col-md-4 sibling, or from Layout B next row
        image_url: Optional[str] = None
        img_source = col4 if col4 else None
        if img_source is None and image_row is not None:
            img_source = image_row.find("div", class_="col-md-4", recursive=False)
        if img_source:
            img = img_source.find("img")
            if img:
                raw_src = img.get("src") or img.get("data-src") or ""
                image_url = _resolve_image_url(raw_src)

        # Description — lead paragraph + body paragraphs from the desc sub-col
        # Layout B: description may be in the image_row's col-md-8
        desc_col: Tag = muted_p.parent if muted_p else col8
        if image_row is not None:
            img_row_col8 = image_row.find("div", class_="col-md-8", recursive=False)
            if img_row_col8:
                desc_col = img_row_col8
        description_parts: list[str] = []
        lead = desc_col.find("p", class_="lead")
        if lead:
            description_parts.append(lead.get_text(" ", strip=True))
        for p in desc_col.find_all("p"):
            if "lead" in (p.get("class") or []):
                continue
            if "text-muted" in (p.get("class") or []):
                continue
            text = p.get_text(" ", strip=True)
            if text and len(text) > 20:
                description_parts.append(text)
                if len("\n\n".join(description_parts)) > 600:
                    break

        description = "\n\n".join(description_parts)
        if len(description) > 600:
            description = description[:597] + "..."

        results.append(
            {
                "title": title,
                "opening_date": opening_date,
                "closing_date": closing_date,
                "image_url": image_url,
                "source_url": BASE_URL,
                "description": description,
            }
        )

    return results


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Emory Visual Arts Gallery exhibitions via static HTTP (no Playwright)."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0

    envelope = TypedEntityEnvelope()
    session = requests.Session()

    venue_id = get_or_create_venue(VENUE_DATA)

    logger.info("Emory Visual Arts Gallery: fetching %s", BASE_URL)
    html = _fetch(BASE_URL, session)
    if not html:
        logger.error("Emory Visual Arts Gallery: failed to fetch gallery page")
        return 0, 0, 0

    soup = BeautifulSoup(html, "html.parser")
    exhibitions = _extract_exhibitions(soup)

    if not exhibitions:
        logger.warning("Emory Visual Arts Gallery: no exhibitions found on page")
        return 0, 0, 0

    today = datetime.now().strftime("%Y-%m-%d")

    for parsed in exhibitions:
        # Skip exhibitions that have already closed
        if parsed["closing_date"] and parsed["closing_date"] < today:
            logger.info(
                "Emory Visual Arts Gallery: exhibition %r closed %s — skipping",
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
            venue_name=VENUE_DATA["name"],
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
            "Emory Visual Arts Gallery: queued exhibition %r (%s – %s)",
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
                "Emory Visual Arts Gallery: %d exhibition(s) already current (skipped)",
                skipped,
            )

    logger.info(
        "Emory Visual Arts Gallery crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
