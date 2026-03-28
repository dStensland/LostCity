"""
Crawler for Alan Avery Art Company (alanaveryartcompany.com).

Strategy: static HTTP only — no Playwright required.

Site is a Wix-built gallery website. The main /exhibitions,
/upcoming-exhibitions, and /past-exhibitions pages render all content
via client-side JavaScript and yield no parseable exhibition data in
static HTML. However, the gallery uses Wix Events for openings and
special programming, and those events ARE indexed in the Wix-generated
event-pages-sitemap.xml with full JSON-LD structured data.

Crawl pipeline:
1. GET /event-pages-sitemap.xml  → discover Wix Event URLs
2. For each event URL, GET the page and parse <script type="application/ld+json">
   for: name, startDate, endDate, description, image, location
3. Route results through the exhibition lane (opening events at a pure
   gallery are exhibitions by function) via build_exhibition_record() +
   TypedEntityEnvelope + persist_typed_entity_envelope().

Limitation: The standing exhibitions listed on the gallery's own
/exhibitions and /upcoming-exhibitions pages are not reachable via
static HTTP — they require Playwright to render. Future enhancement
should add Playwright-based extraction for those pages. This crawler
ensures orchestration does not crash in the interim.

Address confirmed from Wix site's own geocoding data (656 Miami Cir NE).
The task brief listed 315 E Paces Ferry — that address is incorrect.
Actual venue: 656 Miami Circle NE Suite 110, Atlanta GA 30324 (Buckhead).
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime
from html import unescape
from typing import Optional

import requests

from db import get_or_create_place
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alanaveryartcompany.com"
SITEMAP_URL = f"{BASE_URL}/event-pages-sitemap.xml"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Address and coordinates confirmed from Wix site's own JSON-LD and geocoding data.
# The suite number (110) is the gallery within the Miami Circle complex.
PLACE_DATA = {
    "name": "Alan Avery Art Company",
    "slug": "alan-avery-art-company",
    "address": "656 Miami Cir NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8289,
    "lng": -84.3657,
    "place_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
}

EXHIBITION_TAGS = [
    "gallery",
    "exhibition",
    "buckhead",
    "contemporary-art",
    "alan-avery",
    "fine-art",
]

# Courtesy delay between event-detail requests (seconds)
_REQUEST_DELAY = 0.75


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return response text, or None on failure."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("Alan Avery: request failed for %s: %s", url, exc)
        return None


def _discover_event_urls(sitemap_html: str) -> list[str]:
    """
    Parse the Wix event-pages-sitemap.xml and return all event-detail URLs.

    Wix injects namespace-prefixed image elements (image:image, image:loc,
    image:title) into their sitemaps. Rather than fight ElementTree's
    namespace handling, we use a simple regex to extract <loc> text directly
    — the sitemap content is predictable and well-formed enough for this.
    """
    urls: list[str] = []
    for m in re.finditer(r"<loc>(https?://[^<]+)</loc>", sitemap_html):
        loc_text = m.group(1).strip()
        if "/event-details/" in loc_text:
            urls.append(loc_text)
    return list(dict.fromkeys(urls))  # deduplicate, preserve order


def _parse_jsonld(html: str) -> Optional[dict]:
    """
    Extract the first application/ld+json block from an event page and
    return it as a dict. Returns None if not found or unparseable.
    """
    m = re.search(
        r'<script\s+type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not m:
        return None
    try:
        return json.loads(m.group(1).strip())
    except json.JSONDecodeError as exc:
        logger.warning("Alan Avery: JSON-LD parse error: %s", exc)
        return None


def _iso_to_date(raw: str) -> Optional[str]:
    """
    Convert an ISO 8601 datetime string to YYYY-MM-DD.

    Handles:
      - '2024-10-11T22:00:00-04:00'
      - '2024-10-11'
    """
    m = re.match(r"(\d{4}-\d{2}-\d{2})", raw)
    return m.group(1) if m else None


def _parse_event_page(html: str, source_url: str) -> Optional[dict]:
    """
    Extract exhibition metadata from a Wix event-details page.

    Uses JSON-LD (schema.org/Event) as the primary data source — Wix
    injects this reliably for every published event.

    Returns a dict with keys:
      title, opening_date, closing_date, description, image_url
    """
    ld = _parse_jsonld(html)
    if not ld:
        logger.warning("Alan Avery: no JSON-LD found at %s", source_url)
        return None

    if ld.get("@type") != "Event":
        logger.warning(
            "Alan Avery: unexpected JSON-LD @type %r at %s",
            ld.get("@type"),
            source_url,
        )
        return None

    title = ld.get("name", "").strip()
    if not title:
        logger.warning("Alan Avery: no event name in JSON-LD at %s", source_url)
        return None

    # Dates — startDate is the opening/reception; endDate is when it closes
    opening_date = _iso_to_date(ld.get("startDate", ""))
    # Wix events typically represent a single-night reception, not a multi-month
    # exhibition run. Use the endDate as closing_date if present; otherwise leave
    # it as None so the exhibition shows as ongoing.
    closing_raw = ld.get("endDate", "")
    closing_date = _iso_to_date(closing_raw) if closing_raw else None

    # Description — prefer the longer 'description' field over og:description
    description: Optional[str] = None
    raw_desc = ld.get("description", "").strip()
    if raw_desc:
        description = unescape(raw_desc)

    # Image — schema.org ImageObject or plain URL string
    image_url: Optional[str] = None
    img_field = ld.get("image")
    if isinstance(img_field, dict):
        image_url = img_field.get("url")
    elif isinstance(img_field, str):
        image_url = img_field

    return {
        "title": title,
        "opening_date": opening_date,
        "closing_date": closing_date,
        "description": description,
        "image_url": image_url,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Alan Avery Art Company via Wix event-pages sitemap + JSON-LD."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0

    envelope = TypedEntityEnvelope()
    session = requests.Session()

    venue_id = get_or_create_place(PLACE_DATA)

    # Step 1: discover event URLs from the sitemap
    logger.info("Alan Avery: fetching event sitemap %s", SITEMAP_URL)
    sitemap_html = _fetch(SITEMAP_URL, session)
    if not sitemap_html:
        logger.error(
            "Alan Avery: could not fetch event sitemap — returning 0 results. "
            "Note: standing exhibitions at /exhibitions require Playwright."
        )
        return 0, 0, 0

    event_urls = _discover_event_urls(sitemap_html)
    logger.info(
        "Alan Avery: found %d event URL(s) in sitemap: %s",
        len(event_urls),
        event_urls,
    )

    if not event_urls:
        logger.info(
            "Alan Avery: no Wix Events found in sitemap (gallery may not have "
            "posted events recently). Standing exhibitions at /exhibitions are "
            "JS-rendered and require Playwright to extract."
        )
        return 0, 0, 0

    today = datetime.now().strftime("%Y-%m-%d")

    # Step 2: fetch each event page and extract structured data
    for url in event_urls:
        time.sleep(_REQUEST_DELAY)

        page_html = _fetch(url, session)
        if not page_html:
            logger.warning("Alan Avery: skipping %s (fetch failed)", url)
            continue

        parsed = _parse_event_page(page_html, url)
        if not parsed:
            logger.warning("Alan Avery: skipping %s (parse failed)", url)
            continue

        # Skip events that have already closed.
        # Wix Events at this gallery are opening receptions — closing_date is
        # typically the same night (end of the reception), not the exhibition
        # close. We keep the event if the opening date hasn't passed yet, OR
        # if there's no closing date (treat as ongoing).
        if parsed["closing_date"] and parsed["closing_date"] < today:
            logger.debug(
                "Alan Avery: skipping past event %r (closed %s)",
                parsed["title"],
                parsed["closing_date"],
            )
            continue

        if parsed["opening_date"] and parsed["opening_date"] < today:
            # Opening date passed but no closing date — also skip (past reception)
            if not parsed["closing_date"]:
                logger.debug(
                    "Alan Avery: skipping past reception %r (opened %s, no closing date)",
                    parsed["title"],
                    parsed["opening_date"],
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
            description=parsed["description"],
            image_url=parsed["image_url"],
            source_url=url,
            portal_id=portal_id,
            admission_type="free",
            tags=EXHIBITION_TAGS,
        )
        envelope.add("exhibitions", ex_record)
        logger.info(
            "Alan Avery: queued exhibition %r (%s – %s)",
            parsed["title"],
            parsed["opening_date"] or "?",
            parsed["closing_date"] or "ongoing",
        )

    # Step 3: persist
    if envelope.exhibitions:
        persist_result = persist_typed_entity_envelope(envelope)
        events_new = persist_result.persisted.get("exhibitions", 0)
        skipped = persist_result.skipped.get("exhibitions", 0)
        if skipped:
            events_updated = skipped
            logger.info(
                "Alan Avery: %d exhibition(s) already current (skipped)", skipped
            )

    logger.info(
        "Alan Avery crawl complete: %d found, %d new, %d updated. "
        "Note: standing exhibitions at /exhibitions require Playwright — "
        "only Wix Events (openings/receptions) are captured by this crawler.",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
