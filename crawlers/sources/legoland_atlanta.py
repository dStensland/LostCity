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
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import find_event_by_hash, get_or_create_venue, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.legodiscoverycenter.com"
EVENTS_URL = f"{BASE_URL}/atlanta/whats-inside/events/"

VENUE_DATA = {
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
    """Strip location boilerplate appended to event names.

    JSON-LD names often include ' | LEGO Discovery Center Atlanta' or
    '- LEGO Discovery Center at Phipps Plaza in Buckhead' suffixes.
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info("Fetching LEGO Discovery Center Atlanta events: %s", EVENTS_URL)
            response = page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)

            if not response or response.status == 404:
                logger.warning(
                    "LEGO Discovery Center Atlanta events page returned %s — "
                    "treating as no events found",
                    response.status if response else "no response",
                )
                browser.close()
                return 0, 0, 0

            # Scroll to trigger lazy-loaded content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            html = page.content()
            json_ld_events = _extract_json_ld_events(html)

            if not json_ld_events:
                logger.warning(
                    "LEGO Discovery Center Atlanta: no Event JSON-LD found on events page. "
                    "Site structure may have changed."
                )
                browser.close()
                return 0, 0, 0

            logger.info(
                "LEGO Discovery Center Atlanta: found %d Event JSON-LD objects",
                len(json_ld_events),
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
                    title, VENUE_DATA["name"], start_date
                )

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
                    "raw_text": json.dumps(ld)[:5000],
                    "extraction_confidence": 0.95,
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
