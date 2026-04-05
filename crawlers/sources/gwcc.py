"""
Crawler for Georgia World Congress Center public calendar.

This source should own the long-tail convention-center calendar on GWCCA's
official event calendar page, while leaving dedicated stadium/arena sources to
their stronger crawlers.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gwcca.org"
CALENDAR_URL = f"{BASE_URL}/event-calendar"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

VENUES = {
    "georgia world congress center": {
        "name": "Georgia World Congress Center",
        "slug": "georgia-world-congress-center",
        "address": "285 Andrew Young International Blvd NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "place_type": "convention_center",
        "website": BASE_URL,
    },
    "centennial olympic park": {
        "name": "Centennial Olympic Park",
        "slug": "centennial-olympic-park",
        "address": "265 Park Ave W NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "place_type": "outdoor",
        "website": BASE_URL,
    },
    "mercedes-benz stadium": {
        "name": "Mercedes-Benz Stadium",
        "slug": "mercedes-benz-stadium",
        "address": "1 AMB Drive NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "place_type": "stadium",
        "website": "https://www.mercedesbenzstadium.com",
    },
    "state farm arena": {
        "name": "State Farm Arena",
        "slug": "state-farm-arena",
        "address": "1 State Farm Drive",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "place_type": "arena",
        "website": "https://www.statefarmarena.com",
    },
}

DEDICATED_EVENT_PATTERNS = (
    re.compile(r"^mbs:", re.IGNORECASE),
    re.compile(r"\bfifa world cup\b", re.IGNORECASE),
    re.compile(r"\batlanta united\b", re.IGNORECASE),
    re.compile(r"\batlanta hawks\b", re.IGNORECASE),
    re.compile(r"\bmomocon\b", re.IGNORECASE),
    re.compile(r"\bmodex\b", re.IGNORECASE),
    re.compile(r"\btransact\b", re.IGNORECASE),
    re.compile(r"\binternational woodworking fair\b", re.IGNORECASE),
    re.compile(r"\bhinman dental meeting\b", re.IGNORECASE),
)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_date_text(date_text: str) -> str:
    cleaned = clean_text(date_text).replace("–", "-").replace("—", "-")
    cleaned = re.sub(r"^(\d{1,2})\s+", "", cleaned)
    cleaned = cleaned.replace("Sept.", "Sep").replace("Sept", "Sep")
    cleaned = re.sub(r"\b([A-Za-z]{3,9})\.\s+", r"\1 ", cleaned)
    return cleaned


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse GWCCA date strings such as:
    - "Jan 16, 2026"
    - "Jan 8-11, 2026"
    - "January 30 - February 2, 2026"
    """
    cleaned = normalize_date_text(date_text)
    month_formats = ["%B %d, %Y", "%b %d, %Y"]

    def try_parse(text: str) -> Optional[datetime]:
        for fmt in month_formats:
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
        return None

    cross_month_match = re.match(
        r"([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})",
        cleaned,
        re.IGNORECASE,
    )
    if cross_month_match:
        month1, day1, month2, day2, year = cross_month_match.groups()
        start = try_parse(f"{month1} {day1}, {year}")
        end = try_parse(f"{month2} {day2}, {year}")
        if start and end:
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

    same_month_match = re.match(
        r"([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})",
        cleaned,
        re.IGNORECASE,
    )
    if same_month_match:
        month, start_day, end_day, year = same_month_match.groups()
        start = try_parse(f"{month} {start_day}, {year}")
        end = try_parse(f"{month} {end_day}, {year}")
        if start and end:
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

    single_match = re.match(r"([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", cleaned, re.IGNORECASE)
    if single_match:
        month, day, year = single_match.groups()
        parsed = try_parse(f"{month} {day}, {year}")
        if parsed:
            return parsed.strftime("%Y-%m-%d"), None

    return None, None


def determine_category(title: str, description: str = "") -> str:
    text = f"{title} {description}".lower()
    if any(token in text for token in ("concert", "music", "live", "tour", "uncut")):
        return "music"
    if any(token in text for token in ("summit", "conference", "meeting", "expo", "convention", "tradeshow", "trade show")):
        return "community"
    if any(token in text for token in ("graduation", "commencement", "festival", "fanfare", "talent competition")):
        return "community"
    if any(token in text for token in ("volleyball", "championship", "tournament")):
        return "sports"
    return "community"


def infer_tags(title: str) -> list[str]:
    text = title.lower()
    tags = ["gwcc", "convention-center"]
    if any(token in text for token in ("expo", "tradeshow", "trade show")):
        tags.append("expo")
    if any(token in text for token in ("conference", "summit", "meeting")):
        tags.append("conference")
    if any(token in text for token in ("commencement", "graduation")):
        tags.append("graduation")
    if any(token in text for token in ("talent", "dance", "volleyball")):
        tags.append("competition")
    return tags


def get_venue_for_event(title: str, card_text: str = "") -> dict:
    text = f"{title} {card_text}".lower()
    if "centennial olympic park" in text:
        return VENUES["centennial olympic park"]
    if "mercedes-benz stadium" in text or title.lower().startswith("mbs:"):
        return VENUES["mercedes-benz stadium"]
    if "state farm arena" in text:
        return VENUES["state farm arena"]
    return VENUES["georgia world congress center"]


def should_skip_dedicated_event(title: str, venue_slug: str) -> bool:
    if venue_slug in {"mercedes-benz-stadium", "state-farm-arena"}:
        return True
    return any(pattern.search(title) for pattern in DEDICATED_EVENT_PATTERNS)


def build_description(title: str, venue: dict, start_date: str, end_date: Optional[str], start_time: Optional[str]) -> str:
    date_label = start_date if not end_date else f"{start_date} through {end_date}"
    time_label = f" starting at {start_time}" if start_time else ""
    return (
        f"{title} is listed on the official GWCCA event calendar at {venue['name']} in "
        f"{venue['neighborhood']}, Atlanta. Scheduled for {date_label}{time_label}. "
        f"Confirm final event details with the official event page before attending."
    )


def parse_card_date(raw_text: str, fallback_year: int) -> tuple[Optional[str], Optional[str]]:
    start_date, end_date = parse_date_range(raw_text)
    if start_date:
        return start_date, end_date

    short_match = re.search(r"([A-Za-z]{3,9})\s+(\d{1,2})", normalize_date_text(raw_text))
    if short_match:
        month, day = short_match.groups()
        parsed = parse_date_range(f"{month} {day}, {fallback_year}")
        if parsed[0]:
            return parsed
    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the GWCCA public event calendar with deterministic card parsing."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1600, "height": 2000},
            )
            page = context.new_page()

            logger.info("Fetching GWCC calendar: %s", CALENDAR_URL)
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector(".event-heading", timeout=15000)
            page.wait_for_timeout(1500)

            headings = page.query_selector_all(".event-heading")
            dates = page.query_selector_all(".event-date")
            fallback_year = datetime.now().year

            for i, heading_el in enumerate(headings):
                title = clean_text(heading_el.inner_text())
                if not title or i >= len(dates):
                    continue

                raw_date_text = clean_text(dates[i].inner_text())
                start_date, end_date = parse_card_date(raw_date_text, fallback_year)
                if not start_date:
                    continue

                card_handle = heading_el.evaluate_handle(
                    "el => el.closest('.w-dyn-item') || el.closest('.event-card') || el.parentElement"
                )
                card = card_handle.as_element()
                if card is None:
                    continue

                card_text = clean_text(card.inner_text())
                place_data = get_venue_for_event(title, card_text)
                if should_skip_dedicated_event(title, place_data["slug"]):
                    continue

                source_url = CALENDAR_URL
                link = card.query_selector("a[href]")
                if link:
                    href = link.get_attribute("href")
                    if href:
                        source_url = href if href.startswith("http") else f"{BASE_URL}{href}"

                image_url = None
                img = card.query_selector("img[src]")
                if img:
                    src = img.get_attribute("src")
                    if src and "atlblackexpo.com" not in src:
                        image_url = src if src.startswith("http") else f"{BASE_URL}{src}"

                category = determine_category(title, card_text)
                venue_id = get_or_create_place(place_data)
                content_hash = generate_content_hash(title, place_data["name"], start_date)
                current_hashes.add(content_hash)
                events_found += 1

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": build_description(title, place_data, start_date, end_date, None),
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": True,
                    "category": category,
                    "subcategory": "expo" if "expo" in title.lower() or "convention" in title.lower() else None,
                    "tags": infer_tags(title),
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": source_url,
                    "ticket_url": None,
                    "image_url": image_url,
                    "raw_text": f"{title} | {raw_date_text}",
                    "extraction_confidence": 0.9,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_existing_event_for_insert(event_record)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.info("Added GWCC event: %s on %s", title, start_date)

            browser.close()

        removed = remove_stale_source_events(source_id, current_hashes)
        if removed:
            logger.info("Removed %s stale GWCC rows after refresh", removed)

        logger.info(
            "GWCC crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )

    except PlaywrightTimeout as exc:
        logger.error("Timeout fetching GWCC: %s", exc)
        raise
    except Exception as exc:
        logger.error("Failed to crawl GWCC: %s", exc)
        raise

    return events_found, events_new, events_updated
