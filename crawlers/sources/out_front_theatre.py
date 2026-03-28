"""
Crawler for Out Front Theatre Company (outfronttheatre.com).

Out Front Theatre Company is Georgia's LGBTQIA+ theater company, presenting
plays, musicals, and performances that tell LGBTQIA+ stories.

Strategy: sitemap-driven discovery + per-page Playwright rendering.
Fetches the event sitemap via requests (no JS needed), then renders each
event page with Playwright to extract structured data from Elementor HTML.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://outfronttheatre.com"
SITEMAP_URL = f"{BASE_URL}/event-sitemap.xml"

PLACE_DATA = {
    "name": "Out Front Theatre Company",
    "slug": "out-front-theatre-company",
    "address": "999 Brady Ave NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7812,
    "lng": -84.4107,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "description": (
        "Georgia's LGBTQIA+ theater company, dedicated to producing and presenting "
        "stories that reflect the full spectrum of queer experience. Located in West "
        "Midtown Atlanta with a full season of mainstage productions, cabarets, and "
        "special events."
    ),
    "vibes": ["theater", "lgbtq", "performing-arts", "west-midtown"],
}

# Non-show pages to skip
SKIP_SLUGS = {
    "gift-cards",
    "gift-card",
    "donate",
    "support",
    "subscribe",
    "membership",
    "volunteer",
    "auditions",
    "about",
    "contact",
    "education",
    "rehearsal",
    "workshop",
}

REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"}


def get_event_urls_from_sitemap() -> list[str]:
    """Fetch and parse the event sitemap, returning all /event/{slug}/ URLs."""
    try:
        resp = requests.get(SITEMAP_URL, headers=REQUEST_HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("Could not fetch sitemap %s: %s", SITEMAP_URL, exc)
        return []

    soup = BeautifulSoup(resp.text, "xml")
    urls = []
    for loc in soup.find_all("loc"):
        url = loc.get_text(strip=True)
        if "/event/" in url:
            # Extract slug for skip check
            slug = url.rstrip("/").rsplit("/", 1)[-1]
            if slug.lower() in SKIP_SLUGS:
                logger.debug("Skipping non-show URL: %s", url)
                continue
            urls.append(url)

    logger.info("Sitemap returned %d event URLs", len(urls))
    return urls


def parse_date_range(body_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range from Elementor page body text.

    Handles formats:
      - "March 12 - 28, 2026"          (same month)
      - "April 30 - May 16, 2026"       (cross-month)
      - "April 3, 2026"                 (single date)
    """
    # Cross-month: "Month Day - Month Day, Year"
    cross = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})\s*[-\u2013\u2014]\s*"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2}),?\s*(\d{4})",
        body_text,
        re.IGNORECASE,
    )
    if cross:
        s_mon, s_day, e_mon, e_day, year = cross.groups()
        try:
            s = datetime.strptime(f"{s_mon} {s_day} {year}", "%B %d %Y")
            e = datetime.strptime(f"{e_mon} {e_day} {year}", "%B %d %Y")
            return s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Same month: "Month Day - Day, Year"
    same = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2}),?\s*(\d{4})",
        body_text,
        re.IGNORECASE,
    )
    if same:
        month, s_day, e_day, year = same.groups()
        try:
            s = datetime.strptime(f"{month} {s_day} {year}", "%B %d %Y")
            e = datetime.strptime(f"{month} {e_day} {year}", "%B %d %Y")
            return s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date: "Month Day, Year"
    single = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2}),?\s*(\d{4})",
        body_text,
        re.IGNORECASE,
    )
    if single:
        month, day, year = single.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            date_str = dt.strftime("%Y-%m-%d")
            return date_str, date_str
        except ValueError:
            pass

    return None, None


def parse_price_info(body_text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """Extract price from text like 'Prices: $25 / $30 / $35' or 'Free'."""
    text_lower = body_text.lower()

    if re.search(r"\bfree\b", text_lower):
        return 0.0, 0.0, "Free", True

    # "Prices: $25 / $30 / $35"
    amounts = [float(m) for m in re.findall(r"\$(\d+(?:\.\d{2})?)", body_text)]
    if amounts:
        note_match = re.search(r"Prices?:\s*([^\n]+)", body_text, re.IGNORECASE)
        note = note_match.group(1).strip()[:80] if note_match else None
        return min(amounts), max(amounts), note, False

    return None, None, None, False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Out Front Theatre Company via sitemap + per-page Playwright rendering."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        # Step 1: discover event URLs from sitemap (no JS needed)
        event_urls = get_event_urls_from_sitemap()
        if not event_urls:
            logger.warning("No event URLs found in sitemap — aborting")
            return 0, 0, 0

        venue_id = get_or_create_place(PLACE_DATA)
        today = datetime.now().date()

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            for event_url in event_urls:
                try:
                    logger.debug("Fetching event page: %s", event_url)
                    page.goto(event_url, wait_until="domcontentloaded", timeout=25000)
                    page.wait_for_timeout(2000)

                    # --- Title ---
                    title: Optional[str] = None
                    for selector in [
                        "h1.elementor-heading-title",
                        "h2.elementor-heading-title",
                        "h1",
                    ]:
                        el = page.query_selector(selector)
                        if el:
                            candidate = el.inner_text().strip()
                            if candidate and len(candidate) > 2:
                                title = candidate
                                break

                    if not title:
                        logger.debug("No title found on %s", event_url)
                        continue

                    # Skip clearly non-show pages that slipped through
                    title_lower = title.lower()
                    if any(skip in title_lower for skip in ("gift card", "donate", "audition")):
                        continue

                    # --- Body text for date/price extraction ---
                    body_text = page.inner_text("body")

                    # --- Dates ---
                    start_date, end_date = parse_date_range(body_text)
                    if not start_date:
                        logger.debug("No dates found for: %s", title)
                        continue

                    # Skip fully past events (end_date has passed)
                    check_date = end_date or start_date
                    try:
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < today:
                            continue
                    except ValueError:
                        pass

                    # --- Description ---
                    description: Optional[str] = None
                    desc_elements = page.query_selector_all(".elementor-widget-text-editor p")
                    paragraphs = []
                    for el in desc_elements:
                        text = el.inner_text().strip()
                        if text and len(text) > 20:
                            paragraphs.append(text)
                    if paragraphs:
                        description = " ".join(paragraphs[:3])[:600]

                    # --- Price ---
                    price_min, price_max, price_note, is_free = parse_price_info(body_text)

                    # --- Ticket URL (OvationTix) ---
                    ticket_url: Optional[str] = None
                    ticket_el = page.query_selector('a[href*="ovationtix"]')
                    if ticket_el:
                        ticket_url = ticket_el.get_attribute("href")

                    # --- Image (og:image) ---
                    image_url: Optional[str] = None
                    og_el = page.query_selector('meta[property="og:image"]')
                    if og_el:
                        image_url = og_el.get_attribute("content") or None

                    # --- Category / tags ---
                    tags = ["theater", "lgbtq", "performing-arts", "west-midtown"]
                    category = "theater"
                    subcategory: Optional[str] = None

                    body_lower = body_text.lower()
                    if "musical" in body_lower:
                        subcategory = "musical"
                    elif "cabaret" in body_lower or "piano bar" in body_lower:
                        subcategory = "cabaret"
                        tags.append("cabaret")
                        category = "nightlife"
                    elif "concert" in body_lower and "musical" not in body_lower:
                        subcategory = "concert"
                        category = "music"

                    is_recurring = bool(
                        re.search(r"\bmonthly\b|\bweekly\b|\bevery\b", body_lower)
                    )

                    events_found += 1

                    # Hash on start_date (show run = one event record per run)
                    content_hash = generate_content_hash(
                        title, "Out Front Theatre Company", start_date
                    )
                    seen_hashes.add(content_hash)

                    series_hint = None
                    if end_date and end_date != start_date:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                        }
                        if description:
                            series_hint["description"] = description
                        if image_url:
                            series_hint["image_url"] = image_url

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at Out Front Theatre Company",
                        "start_date": start_date,
                        "start_time": "19:30",
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": sorted(set(tags)),
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": ticket_url or event_url,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.88,
                        "is_recurring": is_recurring,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info("Added: %s (%s to %s)", title, start_date, end_date)
                    except Exception as exc:
                        logger.error("Failed to insert %s: %s", title, exc)

                except PlaywrightTimeout:
                    logger.warning("Timeout loading %s — skipping", event_url)
                    continue
                except Exception as exc:
                    logger.warning("Error processing %s: %s", event_url, exc)
                    continue

            browser.close()

        if seen_hashes:
            stale = remove_stale_source_events(source_id, seen_hashes)
            if stale:
                logger.info("Removed %d stale Out Front Theatre events", stale)

        logger.info(
            "Out Front Theatre crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Out Front Theatre Company: %s", exc)
        raise

    return events_found, events_new, events_updated
