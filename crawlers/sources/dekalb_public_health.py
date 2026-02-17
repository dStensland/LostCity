"""
Crawler for DeKalb Public Health events (dekalbpublichealth.com).

Site uses EventON with AJAX rendering on the archive page.
We use Playwright to render, then parse event cards from page HTML.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import find_event_by_hash, smart_update_existing_event, get_or_create_venue, insert_event
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://dekalbpublichealth.com"
EVENTS_URL = f"{BASE_URL}/events/"

DEFAULT_VENUE = {
    "name": "DeKalb Public Health",
    "slug": "dekalb-public-health",
    "address": "445 Winn Way",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7867,
    "lng": -84.2787,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["family-friendly", "all-ages"],
}

SKIP_TITLE_PATTERNS = (
    "service alert",
    "closed",
    "closure",
    "holiday closure",
    "maintenance",
)

TRAINING_KEYWORDS = (
    "training",
    "class",
    "workshop",
    "course",
    "education",
)

WELLNESS_KEYWORDS = (
    "health",
    "screening",
    "vaccine",
    "vaccination",
    "immunization",
    "wellness",
    "naloxone",
    "opioid",
    "cancer",
    "prevention",
    "safety",
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def parse_eventon_datetime(value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Parse EventON datetime strings like `2026-2-19T14:00-5:00`.
    Returns (YYYY-MM-DD, HH:MM) in local event time.
    """
    if not value:
        return None, None

    match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2})", value)
    if not match:
        return None, None

    year, month, day, hour, minute = (int(part) for part in match.groups())
    try:
        date_obj = datetime(year, month, day, hour, minute)
    except ValueError:
        return None, None

    return date_obj.strftime("%Y-%m-%d"), date_obj.strftime("%H:%M")


def classify_event(title: str, description: str) -> tuple[str, list[str]]:
    """Map event text into Lost City category + tags."""
    text = f"{title} {description}".lower()
    tags = ["public-health", "dekalb", "atlanta-metro", "community"]

    if any(keyword in text for keyword in TRAINING_KEYWORDS):
        category = "learning"
        tags.append("class")
    elif any(keyword in text for keyword in WELLNESS_KEYWORDS):
        category = "wellness"
    else:
        category = "community"

    if "naloxone" in text or "opioid" in text:
        tags.extend(["naloxone", "opioid-response"])
    if "vaccine" in text or "immunization" in text:
        tags.append("immunization")
    if "screening" in text:
        tags.append("screening")
    if "passenger" in text or "car seat" in text:
        tags.append("child-safety")
    if "van" in text:
        tags.append("mobile-clinic")
    if "free" in text:
        tags.append("free")

    # Keep order stable while removing duplicates.
    deduped_tags = list(dict.fromkeys(tags))
    return category, deduped_tags


def build_location_venue(location_name: str, location_address: str) -> dict:
    """Build venue payload for event-specific location."""
    if not location_name:
        return DEFAULT_VENUE

    base_slug = slugify(location_name) or "dekalb-public-health-location"
    return {
        "name": location_name,
        "slug": f"dekalb-public-health-{base_slug}"[:120],
        "address": location_address or None,
        "city": "Decatur",
        "state": "GA",
        "venue_type": "organization",
        "spot_type": "organization",
        "website": BASE_URL,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl upcoming events from DeKalb Public Health EventON calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        logger.info(f"Fetching DeKalb Public Health events: {EVENTS_URL}")
        page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=45000)

        # EventON hydrates the event list asynchronously.
        for _ in range(10):
            if page.locator(".eventon_list_event[data-event_id]").count() > 0:
                break
            page.wait_for_timeout(1200)

        html = page.content()
        browser.close()

    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select(".eventon_list_event[data-event_id]")
    logger.info(f"Found {len(cards)} event cards")

    for card in cards:
        try:
            title = _clean_text(
                card.select_one(".evoet_title").get_text(" ", strip=True)
                if card.select_one(".evoet_title")
                else None
            )
            if not title:
                continue

            title_lower = title.lower()
            if any(skip in title_lower for skip in SKIP_TITLE_PATTERNS):
                continue

            start_meta = card.select_one("meta[itemprop='startDate']")
            end_meta = card.select_one("meta[itemprop='endDate']")
            start_date, start_time = parse_eventon_datetime(
                start_meta.get("content") if start_meta else None
            )
            end_date, end_time = parse_eventon_datetime(
                end_meta.get("content") if end_meta else None
            )
            if not start_date:
                continue

            try:
                if (
                    datetime.strptime(start_date, "%Y-%m-%d").date()
                    < datetime.now().date()
                ):
                    continue
            except ValueError:
                continue

            schema_link = card.select_one(".evo_event_schema a[itemprop='url']")
            source_url = schema_link.get("href") if schema_link else None
            source_url = source_url or EVENTS_URL

            location_el = card.select_one(".event_location_attrs")
            location_name = _clean_text(
                location_el.get("data-location_name") if location_el else None
            )
            location_address = _clean_text(
                location_el.get("data-location_address") if location_el else None
            )

            subtitle = _clean_text(
                card.select_one(".evcal_event_subtitle").get_text(" ", strip=True)
                if card.select_one(".evcal_event_subtitle")
                else None
            )
            full_description = _clean_text(
                card.select_one(".eventon_desc_in").get_text(" ", strip=True)
                if card.select_one(".eventon_desc_in")
                else None
            )
            description = (
                full_description or subtitle or f"{title} at DeKalb Public Health"
            )

            # Prefer event-specific venue when location metadata exists.
            venue_payload = build_location_venue(location_name, location_address)
            venue_id = get_or_create_venue(venue_payload)

            venue_name_for_hash = location_name or DEFAULT_VENUE["name"]
            content_hash = generate_content_hash(title, venue_name_for_hash, start_date)
            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)

            events_found += 1

            category, tags = classify_event(title, description)

            is_free = "free" in description.lower() or "free" in title_lower
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "tags": tags,
                "price_min": 0 if is_free else None,
                "price_max": 0 if is_free else None,
                "price_note": "Free" if is_free else None,
                "is_free": is_free,
                "source_url": source_url,
                "ticket_url": source_url,
                "image_url": None,
                "raw_text": json.dumps(
                    {
                        "location_name": location_name,
                        "location_address": location_address,
                        "subtitle": subtitle[:500],
                    }
                ),
                "extraction_confidence": 0.95,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} ({start_date})")

        except Exception as exc:
            logger.error(f"Failed to process DeKalb event card: {exc}")
            continue

    logger.info(
        "DeKalb Public Health crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
