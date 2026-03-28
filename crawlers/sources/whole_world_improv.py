"""
Crawler for Whole World Improv Theatre (wholeworldtheatre.com).
Improv comedy theater near Atlantic Station.

Site structure: Shows listed on homepage with /show/[slug]/[date]/ URLs.
Each show page has JSON-LD structured data with Event schema.
"""

from __future__ import annotations

import json
import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.wholeworldtheatre.com"

PLACE_DATA = {
    "name": "Whole World Improv Theatre",
    "slug": "whole-world-improv",
    "address": "1216 Spring St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7878,
    "lng": -84.3886,
    "place_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}


def goto_with_retry(page, url: str, *, attempts: int = 3, timeout_ms: int = 45000) -> None:
    """Navigate with simple retry/backoff for transient renderer/network failures."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            return
        except Exception as exc:  # noqa: BLE001 - source-level crawler retry guard
            last_exc = exc
            if attempt >= attempts:
                raise
            page.wait_for_timeout(1500 * attempt)
    if last_exc:
        raise last_exc


def parse_jsonld_datetime(iso_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse ISO datetime string from JSON-LD into (date, time) strings."""
    if not iso_str:
        return None, None
    try:
        # Handle "2026-02-27T20:00:00-05:00" format
        # Strip timezone offset for parsing
        clean = re.sub(r"[+-]\d{2}:\d{2}$", "", iso_str)
        clean = clean.replace("Z", "")
        dt = datetime.fromisoformat(clean)
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, TypeError):
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Whole World Improv shows via JSON-LD structured data."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching Whole World Improv: {BASE_URL}")
            goto_with_retry(page, BASE_URL, attempts=3, timeout_ms=45000)
            page.wait_for_timeout(4000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract image map for event images
            image_map = extract_images_from_page(page)

            # Find show links - uses /show/[slug]/[date]/ pattern
            show_links = page.query_selector_all('a[href*="/show/"]')

            show_urls = set()
            for link in show_links:
                href = link.get_attribute("href")
                if href and "/show/" in href:
                    full_url = href if href.startswith("http") else BASE_URL + href
                    show_urls.add(full_url)

            logger.info(f"Found {len(show_urls)} show pages")

            # Process show pages
            for show_url in show_urls:
                try:
                    goto_with_retry(page, show_url, attempts=2, timeout_ms=30000)
                    page.wait_for_timeout(2000)

                    # Extract JSON-LD structured data
                    ld_scripts = page.query_selector_all('script[type="application/ld+json"]')

                    event_data = None
                    for script in ld_scripts:
                        try:
                            raw = script.inner_text()
                            data = json.loads(raw)
                            # Handle both single object and array
                            items = data if isinstance(data, list) else [data]
                            for item in items:
                                if item.get("@type") == "Event":
                                    event_data = item
                                    break
                            if event_data:
                                break
                        except (json.JSONDecodeError, AttributeError):
                            continue

                    if not event_data:
                        # Fallback: try extracting date from URL pattern /show/slug/YYYY-MM-DD/
                        url_date_match = re.search(r"/show/[^/]+/(\d{4}-\d{2}-\d{2})", show_url)
                        if not url_date_match:
                            logger.debug(f"No JSON-LD or URL date found: {show_url}")
                            continue

                        # Build event data from URL + page content
                        start_date = url_date_match.group(1)

                        # Get title from h1
                        title = None
                        h1 = page.query_selector("h1")
                        if h1:
                            title = h1.inner_text().strip()
                        if not title:
                            slug_match = re.search(r"/show/([^/]+)/", show_url)
                            if slug_match:
                                title = slug_match.group(1).replace("-", " ").title()
                        if not title:
                            continue

                        # Get time from body text ("FROM 8:00 PM TO 9:30 PM")
                        body_text = page.inner_text("body")
                        time_match = re.search(r"FROM\s+(\d{1,2}:\d{2})\s*(AM|PM)", body_text, re.IGNORECASE)
                        start_time = None
                        if time_match:
                            hour_min, period = time_match.groups()
                            h, m = hour_min.split(":")
                            h = int(h)
                            if period.upper() == "PM" and h != 12:
                                h += 12
                            elif period.upper() == "AM" and h == 12:
                                h = 0
                            start_time = f"{h:02d}:{m}"

                        price_match = re.search(r"\$(\d+)", body_text)
                        price = int(price_match.group(1)) if price_match else None

                        event_data = {
                            "name": title,
                            "startDate": f"{start_date}T{start_time or '20:00'}:00",
                            "description": None,
                            "offers": {"price": str(price)} if price else {},
                        }

                    # Extract fields from JSON-LD
                    title = event_data.get("name", "").strip()
                    if not title or len(title) < 3:
                        continue

                    start_date, start_time = parse_jsonld_datetime(event_data.get("startDate"))
                    end_date, end_time = parse_jsonld_datetime(event_data.get("endDate"))

                    if not start_date:
                        continue

                    # Skip past events
                    try:
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue
                    except ValueError:
                        continue

                    # Extract price from offers
                    price = None
                    offers = event_data.get("offers", {})
                    if isinstance(offers, list):
                        offers = offers[0] if offers else {}
                    price_str = offers.get("price")
                    if price_str:
                        try:
                            price = int(float(price_str))
                        except (ValueError, TypeError):
                            pass

                    description = event_data.get("description")
                    if description:
                        description = description[:500]

                    events_found += 1

                    event_start_time = start_time or "20:00"
                    hash_key = f"{start_date}|{event_start_time}"
                    content_hash = generate_content_hash(title, "Whole World Improv", hash_key)

                    # Find image by title match
                    event_image = event_data.get("image")
                    if not event_image:
                        title_lower = title.lower()
                        for img_alt, img_url in image_map.items():
                            if img_alt.lower() == title_lower or title_lower in img_alt.lower() or img_alt.lower() in title_lower:
                                event_image = img_url
                                break

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at Whole World Improv Theatre",
                        "start_date": start_date,
                        "start_time": event_start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": "comedy",
                        "subcategory": "improv",
                        "tags": ["whole-world-improv", "comedy", "improv", "midtown"],
                        "price_min": price,
                        "price_max": price,
                        "price_note": f"${price}" if price else None,
                        "is_free": price == 0 if price is not None else False,
                        "source_url": show_url,
                        "ticket_url": show_url,
                        "image_url": event_image,
                        "raw_text": f"{title} - {start_date} {start_time}",
                        "extraction_confidence": 0.92,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record, genres=["improv", "comedy"])
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {start_time}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process {show_url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Whole World Improv crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Whole World Improv: {e}")
        raise

    return events_found, events_new, events_updated
