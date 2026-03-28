"""
Crawler for LEGO Discovery Center Atlanta (legodiscoverycenter.com/atlanta).

Located at Phipps Plaza (3500 Peachtree Rd NE, Atlanta GA 30326).

The events listing page exposes Schema.org Event JSON-LD for each special event,
making extraction clean and reliable.  Each event object contains:
  - name, description, url, startDate, endDate, image, location/address

The site redirects from legolanddiscoverycenter.com → legodiscoverycenter.com.
We use the canonical domain directly to skip the redirect.

Event model: seasonal themed events and school-holiday programs (Spring Break,
Halloween, Christmas, etc.) that run for multi-day windows included with admission.
These are NOT daily open-hours — they are programmed special events worth crawling.

What this crawler does NOT capture (and why):
  - Daily general admission / rides / 4D Cinema: These are permanent venue features,
    not events. "The place is open" is not an event per CLAUDE.md rules.
  - Birthday party bookings: Dates/times are managed via Merlin's proprietary ISO
    booking widget with no public API. Cannot be scraped.
  - LEGO workshops / build sessions: Advertised as ongoing venue programming (no
    scheduled dates on the website), not as discrete events with startDate.

If LEGOLAND adds an open-call build workshop schedule in the future, check:
  https://www.legodiscoverycenter.com/atlanta/whats-inside/events/
The site currently only exposes 2–3 seasonal events per year via JSON-LD.

Retry strategy: transient "Server disconnected" errors are common.  The crawler
retries the main page load up to MAX_RETRIES times with exponential backoff before
giving up.  Individual detail-page fetches are best-effort (no retry needed).
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.legodiscoverycenter.com"
EVENTS_URL = f"{BASE_URL}/atlanta/whats-inside/events/"
MAX_RETRIES = 3
RETRY_BASE_DELAY = 5  # seconds; doubles on each retry

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

PLACE_DATA = {
    "name": "LEGO Discovery Center Atlanta",
    "slug": "lego-discovery-center-atlanta",
    "address": "3500 Peachtree Rd NE Suite G-1",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30326",
    "lat": 33.8481,
    "lng": -84.3638,
    "venue_type": "attraction",
    "spot_type": "attraction",
    "website": f"{BASE_URL}/atlanta/",
    "vibes": ["family-friendly", "all-ages"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "family_attraction",
            "commitment_tier": "halfday",
            "primary_activity": "family indoor attraction visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "garage",
            "best_time_of_day": "morning",
            "practical_notes": (
                "LEGOLAND works best as a timed indoor younger-kid outing, especially when families want a weather-proof Buckhead stop that can hold attention without a huge walking day. "
                "It is also one of the easier paid outings for fast bathroom breaks and lower walking friction."
            ),
            "accessibility_notes": (
                "Its indoor attraction layout makes it easier for strollers and shorter-attention-span outings than larger, walking-heavier destination days."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "General admission and special-event pricing vary by date and package.",
            "source_url": f"{BASE_URL}/atlanta/",
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "attraction",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "indoor-build-play-attraction-stack",
            "title": "Indoor build-play attraction stack",
            "feature_type": "amenity",
            "description": "LEGOLAND combines build zones, rides, and play experiences in one indoor stop, which makes it practical for a fuller younger-kid outing without lots of transitions.",
            "url": f"{BASE_URL}/atlanta/",
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "buckhead-weather-proof-younger-kid-anchor",
            "title": "Buckhead weather-proof younger-kid anchor",
            "feature_type": "amenity",
            "description": "Its Buckhead location and indoor format make LEGOLAND a reliable backup or primary plan for younger kids when weather shifts.",
            "url": f"{BASE_URL}/atlanta/",
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "low-walking-indoor-younger-kid-reset",
            "title": "Low-walking indoor younger-kid reset",
            "feature_type": "amenity",
            "description": "LEGOLAND is useful when families want indoor play with less walking burden and easier bathroom access than a larger attraction day.",
            "url": f"{BASE_URL}/atlanta/",
            "is_free": False,
            "sort_order": 30,
        },
    )
    return envelope

# Tags applied to every event at this venue.
# Note: "family-friendly", "all-ages", "kids", "educational", "hands-on",
# "ticketed" are in ALL_TAGS.  "buckhead" is not canonical and will be
# filtered by tag_inference, but is kept here for raw_text context.
BASE_TAGS = [
    "family-friendly",
    "all-ages",
    "kids",
    "educational",
    "hands-on",
    "ticketed",
]


def _clean_title(raw: str) -> str:
    """Strip location boilerplate and SEO suffixes from event names.

    JSON-LD names are SEO-optimised and contain several kinds of noise:
      - ' | LEGO Discovery Center Atlanta'
      - '- LEGO Discovery Center at Phipps Plaza in Buckhead'
      - ' with Kids in Atlanta - LEGO Discovery Center ...'
      - ' Things to Do with Kids in Atlanta'

    We strip all of these so the stored title reads like an event name, not a
    blog article headline.
    """
    raw = raw.strip()
    # Strip trailing " | ..." or " - ..." suffixes that name-check the venue
    raw = re.sub(
        r"\s*[|\-]\s*(?:LEGO|Lego).*$",
        "",
        raw,
        flags=re.IGNORECASE,
    ).strip()
    # Strip possessive forms ("at Phipps Plaza in Buckhead")
    raw = re.sub(r"\s+at\s+Phipps\s+Plaza.*$", "", raw, flags=re.IGNORECASE).strip()
    # Strip SEO blog suffixes: "with Kids in Atlanta", "Things to Do ..."
    raw = re.sub(
        r"\s+(?:Things\s+to\s+Do\s+)?with\s+Kids\s+in\s+\w+$",
        "",
        raw,
        flags=re.IGNORECASE,
    ).strip()
    return raw


def _parse_iso_date(value: str) -> Optional[str]:
    """Parse ISO-8601 date string (YYYY-MM-DD) to YYYY-MM-DD, or None."""
    if not value:
        return None
    try:
        dt = datetime.strptime(value[:10], "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _build_image_url(raw: Optional[str]) -> Optional[str]:
    """Resolve a potentially relative image path to an absolute URL."""
    if not raw:
        return None
    if raw.startswith("http"):
        return raw
    return urljoin(BASE_URL, raw)


def _infer_tags(title: str, description: str) -> list[str]:
    """Append event-specific tags based on title/description keywords."""
    tags = list(BASE_TAGS)
    combined = f"{title} {description}".lower()

    if any(k in combined for k in ["spring break", "spring"]):
        tags.append("seasonal")
    if any(k in combined for k in ["halloween", "spooky", "ghost"]):
        tags.extend(["seasonal", "holiday"])
    if any(k in combined for k in ["christmas", "holiday", "winter", "snow"]):
        tags.extend(["seasonal", "holiday"])
    if any(k in combined for k in ["build", "workshop", "create", "construct"]):
        tags.append("hands-on")
    if any(k in combined for k in ["birthday", "party"]):
        tags.append("social")
    if any(k in combined for k in ["f1", "race", "racing", "car"]):
        pass  # no specific tag needed
    if "free" in combined:
        tags.append("free")

    # Deduplicate while preserving order
    seen: set = set()
    unique = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    return unique


def _extract_json_ld_events(html_content: str) -> list[dict]:
    """Extract all Schema.org Event objects from JSON-LD script tags in page HTML."""
    events = []
    pattern = re.compile(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        re.DOTALL | re.IGNORECASE,
    )
    for match in pattern.finditer(html_content):
        raw = match.group(1).strip()
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue

        # Handle both single objects and @graph arrays
        items = data if isinstance(data, list) else [data]
        for item in items:
            types = item.get("@type", [])
            if isinstance(types, str):
                types = [types]
            if "Event" in types:
                events.append(item)

    return events


def _extract_html_events(html_content: str) -> list[dict]:
    """
    Fallback HTML parser for event cards when JSON-LD is absent or incomplete.

    The LEGO Discovery Center events page renders event cards as article/div
    elements with class names containing "event-card", "EventCard", or similar.
    This parser extracts title, description, dates, and links from those cards.

    Returns a list of partial event dicts (same shape as JSON-LD items) so the
    main crawl loop can process them uniformly.
    """
    soup = BeautifulSoup(html_content, "html.parser")
    events: list[dict] = []

    # Try common event card selectors used by attraction CMS platforms
    card_selectors = [
        "article.event-card",
        "div.event-card",
        "[class*='EventCard']",
        "[class*='event-card']",
        "[class*='event-item']",
        "li.event",
    ]

    cards = []
    for selector in card_selectors:
        try:
            found = soup.select(selector)
            if found:
                cards = found
                logger.debug(
                    "LEGO Discovery Center Atlanta HTML fallback: found %d cards via '%s'",
                    len(found),
                    selector,
                )
                break
        except Exception:
            continue

    if not cards:
        return []

    for card in cards:
        # Title: h2, h3, or first heading
        title_el = card.find(["h2", "h3", "h4"])
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue

        # Link
        link_el = card.find("a", href=True)
        url = ""
        if link_el:
            href = link_el["href"]
            url = href if href.startswith("http") else urljoin(BASE_URL, href)

        # Description: first <p>
        desc_el = card.find("p")
        description = desc_el.get_text(strip=True) if desc_el else ""

        # Dates: look for time elements or date-like text
        start_date = ""
        end_date = ""
        time_els = card.find_all("time")
        if len(time_els) >= 2:
            start_date = time_els[0].get("datetime", "")[:10]
            end_date = time_els[1].get("datetime", "")[:10]
        elif len(time_els) == 1:
            start_date = time_els[0].get("datetime", "")[:10]

        # Image: og:image already captured at page level; try card img
        img_el = card.find("img")
        image = ""
        if img_el:
            image = img_el.get("src", "") or img_el.get("data-src", "")
            if image and not image.startswith("http"):
                image = urljoin(BASE_URL, image)

        events.append(
            {
                "@type": "Event",
                "_source": "html_fallback",
                "name": title,
                "description": description,
                "url": url or EVENTS_URL,
                "startDate": start_date,
                "endDate": end_date,
                "image": image,
            }
        )

    return events


def _crawl_detail_page(page, event_url: str) -> Optional[str]:
    """Visit an event detail page and return the og:image URL if available."""
    try:
        page.goto(event_url, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(1500)
        og_image = page.evaluate(
            "document.querySelector(\"meta[property='og:image']\") "
            "? document.querySelector(\"meta[property='og:image']\").content "
            ": null"
        )
        return og_image or None
    except Exception as exc:
        logger.debug("Could not fetch detail page %s: %s", event_url, exc)
        return None


def _fetch_events_page_with_retry(page) -> Optional[str]:
    """
    Load the LEGO events page with exponential backoff retry.

    Returns the full HTML string on success, None if all retries fail.
    Handles transient "Server disconnected" and timeout errors that occur
    roughly every other crawl on this site.
    """
    delay = RETRY_BASE_DELAY
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            if not response:
                raise RuntimeError("no response object returned")
            if response.status == 404:
                logger.warning(
                    "LEGO Discovery Center Atlanta events page returned 404 — "
                    "treating as no events found"
                )
                return None
            if response.status >= 500:
                raise RuntimeError(f"HTTP {response.status}")

            # Scroll to trigger lazy-loaded content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            return page.content()

        except Exception as exc:
            if attempt < MAX_RETRIES:
                logger.warning(
                    "LEGO Discovery Center Atlanta: page load failed (attempt %d/%d): %s — "
                    "retrying in %ds",
                    attempt,
                    MAX_RETRIES,
                    exc,
                    delay,
                )
                time.sleep(delay)
                delay *= 2
            else:
                logger.error(
                    "LEGO Discovery Center Atlanta: page load failed after %d attempts: %s",
                    MAX_RETRIES,
                    exc,
                )
                return None

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl LEGO Discovery Center Atlanta events using Playwright + JSON-LD."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = datetime.now().date()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            logger.info("Fetching LEGO Discovery Center Atlanta events: %s", EVENTS_URL)
            html = _fetch_events_page_with_retry(page)
            if html is None:
                browser.close()
                return 0, 0, 0

            json_ld_events = _extract_json_ld_events(html)

            if not json_ld_events:
                logger.warning(
                    "LEGO Discovery Center Atlanta: no Event JSON-LD found — "
                    "falling back to HTML card parsing"
                )
                html_events = _extract_html_events(html)
                if html_events:
                    logger.info(
                        "LEGO Discovery Center Atlanta: HTML fallback found %d event cards",
                        len(html_events),
                    )
                    json_ld_events = html_events
                else:
                    logger.warning(
                        "LEGO Discovery Center Atlanta: no events found via JSON-LD or HTML. "
                        "Site structure may have changed."
                    )
                    browser.close()
                    return 0, 0, 0

            logger.info(
                "LEGO Discovery Center Atlanta: found %d events (%s)",
                len(json_ld_events),
                "JSON-LD" if not any(e.get("_source") == "html_fallback" for e in json_ld_events) else "HTML fallback",
            )

            for ld in json_ld_events:
                raw_title = ld.get("name", "").strip()
                if not raw_title:
                    continue

                title = _clean_title(raw_title)
                if not title:
                    continue

                description = ld.get("description", "").strip()
                event_url = ld.get("url", "").strip() or EVENTS_URL

                start_date = _parse_iso_date(ld.get("startDate", ""))
                end_date = _parse_iso_date(ld.get("endDate", ""))

                if not start_date:
                    logger.debug(
                        "LEGO Discovery Center Atlanta: skipping '%s' — no startDate",
                        title,
                    )
                    continue

                # Skip events that have already ended
                if end_date and datetime.strptime(end_date, "%Y-%m-%d").date() < today:
                    logger.debug(
                        "LEGO Discovery Center Atlanta: skipping past event '%s' (ended %s)",
                        title,
                        end_date,
                    )
                    continue

                # Resolve image: JSON-LD image first, then og:image from detail page
                ld_image = _build_image_url(ld.get("image"))
                image_url = ld_image
                if not image_url and event_url and event_url != EVENTS_URL:
                    image_url = _crawl_detail_page(page, event_url) or None
                    if image_url:
                        # Navigate back to events listing
                        page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=20000)
                        page.wait_for_timeout(1000)

                tags = _infer_tags(title, description)

                content_hash = generate_content_hash(
                    title, PLACE_DATA["name"], start_date
                )

                is_html_fallback = ld.get("_source") == "html_fallback"
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description or None,
                    "start_date": start_date,
                    "start_time": None,  # multi-day events — open during attraction hours
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": True,  # seasonal event spanning attraction open hours
                    "category": "family",
                    "subcategory": "seasonal-event",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Included with admission. Tickets from $24.99.",
                    "is_free": False,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": json.dumps({k: v for k, v in ld.items() if k != "_source"})[:5000],
                    "extraction_confidence": 0.75 if is_html_fallback else 0.95,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                events_found += 1

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    logger.debug(
                        "LEGO Discovery Center Atlanta: updated '%s'", title
                    )
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        "LEGO Discovery Center Atlanta: added '%s' (%s – %s)",
                        title,
                        start_date,
                        end_date or "ongoing",
                    )
                except Exception as exc:
                    logger.error(
                        "LEGO Discovery Center Atlanta: failed to insert '%s': %s",
                        title,
                        exc,
                    )

            browser.close()

    except Exception as exc:
        logger.error("LEGO Discovery Center Atlanta crawl failed: %s", exc)
        raise

    if events_found == 0:
        logger.warning(
            "LEGO Discovery Center Atlanta: 0 events found. "
            "Check whether the events page has current seasonal programming."
        )

    logger.info(
        "LEGO Discovery Center Atlanta crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
