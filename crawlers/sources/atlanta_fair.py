"""
Crawler for Atlanta Fair (atlantafair.net).

The official site publishes the seasonal date window, venue, hours, and price
tables directly on static pages, so this crawler models the fair as a single
annual tentpole event with rich pricing metadata.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantafair.net/"
HOURS_URL = "https://atlantafair.net/hours"
PRICES_URL = "https://atlantafair.net/prices"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

PLACE_DATA = {
    "name": "Atlanta Fair",
    "slug": "atlanta-fair",
    "address": "688 Central Ave SW",
    "neighborhood": "Summerhill",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "venue_type": "event_space",
    "spot_type": "event_space",
    "website": BASE_URL,
}

DATE_RANGE_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(\d{1,2})\s*-\s*"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)?\s*"
    r"(\d{1,2}),\s*(\d{4})",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"\$\d+(?:\.\d{2})?")


def _fetch_html(url: str) -> str:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    return response.text


def _page_text(html: str) -> str:
    return " ".join(BeautifulSoup(html, "html.parser").get_text(" ", strip=True).split())


def parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    match = DATE_RANGE_RE.search(text)
    if not match:
        return None, None

    start_month, start_day, end_month, end_day, year = match.groups()
    end_month = end_month or start_month

    start_date = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")
    end_date = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")
    return start_date, end_date


def extract_og_image(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    meta = soup.select_one('meta[property="og:image"]') or soup.select_one('meta[name="twitter:image"]')
    if not meta:
        return None
    content = (meta.get("content") or "").strip()
    return content or None


def extract_hours_summary(text: str) -> str:
    patterns = [
        (
            r"Monday thru Thursday Opens at 5PM Get in GATE before 9PM & Stay until 10PM",
            "Monday-Thursday: opens 5 PM, gate entry until 9 PM, rides until 10 PM.",
        ),
        (
            r"Friday Opens at 5PM Get in GATE before 10PM & Stay until 11PM",
            "Friday: opens 5 PM, gate entry until 10 PM, rides until 11 PM.",
        ),
        (
            r"Saturday & Sunday Opens at 1PM Get in GATE before 10PM & Stay until 11PM",
            "Saturday-Sunday: opens 1 PM, gate entry until 10 PM, rides until 11 PM.",
        ),
    ]
    parts = [summary for pattern, summary in patterns if re.search(pattern, text, re.IGNORECASE)]
    return " ".join(parts)


def extract_price_note(text: str) -> tuple[Optional[float], Optional[float], str]:
    normalized = text.replace("AX", "Amex")
    parts: list[str] = []

    admission_match = re.search(
        r"Children \(always\) \$3 .*? Monday thru Thursday \$5 .*? Friday \$10 .*? Saturday .*? \$10 .*? Sunday .*? \$10",
        normalized,
        re.IGNORECASE,
    )
    if admission_match:
        parts.append("Admission: children 42\" and under $3; ages 42\" and over $5 Monday-Thursday, $10 Friday-Sunday.")

    armband_match = re.search(r"Armbands \$35 .*? UNLIMITED RIDES", normalized, re.IGNORECASE)
    if armband_match:
        parts.append("Unlimited ride armbands $35 and sold until one hour before close.")

    single_ticket_match = re.search(r"Single Tickets \$1\.25 Book of 25 Tickets \$25", normalized, re.IGNORECASE)
    if single_ticket_match:
        parts.append("Ride tickets $1.25 each or $25 for a book of 25; rides use 2-4 tickets.")

    payment_match = re.search(
        r"We accept all credit & debit cards .*? Apple Pay, Google Pay & CASH",
        normalized,
        re.IGNORECASE,
    )
    if payment_match:
        parts.append("Accepts credit/debit cards, Apple Pay, Google Pay, and cash.")

    price_values = [float(value.replace("$", "")) for value in PRICE_RE.findall(normalized)]
    price_min = min(price_values) if price_values else None
    price_max = max(price_values) if price_values else None
    return price_min, price_max, " ".join(parts)


def build_event_record(source_id: int, homepage_html: str, hours_html: str, prices_html: str) -> dict:
    homepage_text = _page_text(homepage_html)
    hours_text = _page_text(hours_html)
    prices_text = _page_text(prices_html)

    start_date, end_date = parse_date_range(homepage_text)
    if not start_date or not end_date:
        raise ValueError("Atlanta Fair site did not expose the seasonal date range")

    price_min, price_max, price_note = extract_price_note(prices_text)
    hours_summary = extract_hours_summary(hours_text)
    venue_id = get_or_create_place(PLACE_DATA)
    year = start_date[:4]
    title = f"Atlanta Fair {year}"
    content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

    description = (
        "Seasonal Atlanta Fair featuring carnival rides, midway games, fair food, and family entertainment "
        "near Georgia State Stadium."
    )
    if hours_summary:
        description = f"{description} {hours_summary}"

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": None,
        "end_date": end_date,
        "end_time": None,
        "is_all_day": True,
        "category": "family",
        "subcategory": "fair",
        "tags": ["atlanta-fair", "fair", "family", "rides", "summerhill", "tentpole"],
        "price_min": price_min,
        "price_max": price_max,
        "price_note": price_note or "Ticketed fair admission and ride passes available on site.",
        "is_free": False,
        "is_tentpole": True,
        "source_url": BASE_URL,
        "ticket_url": None,
        "image_url": extract_og_image(homepage_html),
        "raw_text": " ".join([homepage_text, hours_text, prices_text]),
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Fair as a single seasonal tentpole event."""
    source_id = source["id"]
    homepage_html = _fetch_html(BASE_URL)
    hours_html = _fetch_html(HOURS_URL)
    prices_html = _fetch_html(PRICES_URL)

    event_record = build_event_record(source_id, homepage_html, hours_html, prices_html)
    existing = find_event_by_hash(event_record["content_hash"])

    if existing:
        smart_update_existing_event(existing, event_record)
        return 1, 0, 1

    insert_event(event_record)
    return 1, 1, 0
