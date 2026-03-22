"""
Crawler for Dancing Dogs Yoga (dancingdogsyoga.com).

The workshops landing page (atlanta-yoga-workshops) uses a Squarespace
calendar block that renders entirely via JavaScript — no event links appear
in the static HTML response. Playwright is required to collect event detail
URLs from the rendered DOM. Each detail page is then fetched with requests and
parsed for stable event metadata via HTML / JSON-LD.
"""

from __future__ import annotations

import json
import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://dancingdogsyoga.com"
EVENTS_URL = f"{BASE_URL}/atlanta-yoga-workshops"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"}

VENUE_DATA = {
    "name": "Dancing Dogs Yoga",
    "slug": "dancing-dogs-yoga",
    "address": "400 Church St",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7751,
    "lng": -84.2963,
    "venue_type": "studio",
    "spot_type": "studio",
    "website": BASE_URL,
}


def _clean_text(value: str) -> str:
    return " ".join((value or "").split())


def _parse_event_datetime(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")


def _extract_price_info(description: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    matches = []
    for token in re.findall(r"\$\s*\d+(?:\.\d{2})?", description or ""):
        try:
            matches.append(float(token.replace("$", "").strip()))
        except ValueError:
            continue

    if not matches:
        return None, None, None

    note_match = re.search(
        r"(\$[\d.]+\s*[^.\n|]*(?:\|\s*\$[\d.]+\s*[^.\n|]*)?)",
        description,
        re.IGNORECASE,
    )
    return min(matches), max(matches), note_match.group(1).strip() if note_match else None


def extract_event_urls(page) -> list[str]:
    urls = page.evaluate(
        """() => Array.from(
            new Set(
              Array.from(document.querySelectorAll('a[href*="/events/"]'))
                .map((a) => a.href)
                .filter((href) =>
                  href &&
                  !href.includes('?format=ical') &&
                  !href.endsWith('/events')
                )
            )
          )"""
    )
    return [url for url in urls if isinstance(url, str) and url.startswith(BASE_URL)]


def parse_event_detail_html(html: str, event_url: str) -> Optional[dict]:
    soup = BeautifulSoup(html, "html.parser")

    event_ld = None
    for script in soup.select('script[type="application/ld+json"]'):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        candidates = payload if isinstance(payload, list) else [payload]
        for candidate in candidates:
            if isinstance(candidate, dict) and candidate.get("@type") == "Event":
                event_ld = candidate
                break
        if event_ld:
            break

    title = _clean_text(
        (soup.select_one("h1.eventitem-title") or {}).get_text(" ", strip=True)
        if soup.select_one("h1.eventitem-title")
        else (event_ld or {}).get("name", "")
    )
    if not title:
        return None

    start_date_raw = (event_ld or {}).get("startDate")
    if not start_date_raw:
        return None

    start_dt = _parse_event_datetime(start_date_raw)
    end_dt = None
    if (event_ld or {}).get("endDate"):
        end_dt = _parse_event_datetime(event_ld["endDate"])

    paragraphs = [
        _clean_text(p.get_text(" ", strip=True))
        for p in soup.select(".eventitem-column-content p")
    ]
    paragraphs = [p for p in paragraphs if p and p != "Grab Your Spot!"]
    description = " ".join(paragraphs)
    if not description:
        description = _clean_text(
            (soup.select_one(".eventitem-column-content") or {}).get_text(" ", strip=True)
            if soup.select_one(".eventitem-column-content")
            else ""
        )
    description = description.replace(" Grab Your Spot!", "").strip()

    price_min, price_max, price_note = _extract_price_info(description)

    reserve_link = soup.select_one('.eventitem-column-content a[href]:not([href*="calendar"]):not([href*="format=ical"])')
    ticket_url = reserve_link.get("href") if reserve_link else event_url

    image = (event_ld or {}).get("image")
    if isinstance(image, list):
        image_url = image[0] if image else None
    else:
        image_url = image

    return {
        "title": title,
        "description": description or f"Workshop at {VENUE_DATA['name']}",
        "start_date": start_dt.strftime("%Y-%m-%d"),
        "start_time": start_dt.strftime("%H:%M"),
        "end_time": end_dt.strftime("%H:%M") if end_dt else None,
        "source_url": event_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": price_note,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Dancing Dogs Yoga workshops using calendar event detail pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Dancing Dogs Yoga: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=60000)
            event_urls = extract_event_urls(page)

            browser.close()

        for event_url in event_urls:
            try:
                response = requests.get(event_url, headers=HEADERS, timeout=20)
                response.raise_for_status()
            except Exception as exc:
                logger.warning(f"[dancing-dogs-yoga] Failed to fetch {event_url}: {exc}")
                continue

            parsed = parse_event_detail_html(response.text, event_url)
            if not parsed:
                continue

            events_found += 1
            content_hash = generate_content_hash(
                parsed["title"], VENUE_DATA["name"], parsed["start_date"]
            )
            current_hashes.add(content_hash)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": parsed["title"],
                "description": parsed["description"],
                "start_date": parsed["start_date"],
                "start_time": parsed["start_time"],
                "end_date": None,
                "end_time": parsed["end_time"],
                "is_all_day": False,
                "category": "fitness",
                "subcategory": "yoga_workshop",
                "tags": ["dancing-dogs", "yoga", "decatur", "workshop", "wellness"],
                "price_min": parsed["price_min"],
                "price_max": parsed["price_max"],
                "price_note": parsed["price_note"],
                "is_free": parsed["price_min"] == 0 and parsed["price_max"] == 0,
                "source_url": parsed["source_url"],
                "ticket_url": parsed["ticket_url"],
                "image_url": parsed["image_url"],
                "raw_text": parsed["description"],
                "extraction_confidence": 0.95,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
                "is_class": True,
                "class_category": "fitness",
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            series_hint = {
                "series_type": "class_series",
                "series_title": parsed["title"],
                "description": parsed["description"],
            }
            if parsed["image_url"]:
                series_hint["image_url"] = parsed["image_url"]

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info(
                    f"[dancing-dogs-yoga] Added: {parsed['title']} on {parsed['start_date']}"
                )
            except Exception as exc:
                logger.error(
                    f"[dancing-dogs-yoga] Failed to insert {parsed['title']}: {exc}"
                )

        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info(
                f"[dancing-dogs-yoga] Removed {stale_removed} stale workshop rows"
            )

        logger.info(
            f"Dancing Dogs Yoga crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Dancing Dogs Yoga: {e}")
        raise

    return events_found, events_new, events_updated
