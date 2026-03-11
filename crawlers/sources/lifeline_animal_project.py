"""
Crawler for LifeLine Animal Project (lifelineanimal.org).

LifeLine runs Fulton County Animal Services and DeKalb County Animal Services
shelters and is Atlanta's largest lifesaving animal organization. Their main
events calendar at /events/ is behind Cloudflare bot detection (including for
iCal exports and the Tribe Events REST API), so this crawler scrapes their
permanent event landing pages directly.

Each major annual event has a dedicated WordPress page that is accessible
without bot verification. Pages use standard OG meta tags and readable body
copy that make date, title, and description extraction reliable.

Known event pages crawled:
- Good Human Gala (signature annual fundraiser, April)
- LifeLine Super Adopt-a-thon (mass adoption event, spring)
- Spooky Pooch 5K & Fun Walk (October fitness fundraiser)
- Healthy Pets (free community vet care clinics)
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from date_utils import parse_human_date
from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://lifelineanimal.org"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

VENUE_DATA = {
    "name": "LifeLine Animal Project",
    "slug": "lifeline-animal-project",
    "address": "3180 Presidential Dr",
    "neighborhood": "Chamblee",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8883,
    "lng": -84.2811,
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["family-friendly", "dog-friendly"],
}

# Permanent event landing pages. Each is a dedicated WordPress page that does
# not require bot verification. LifeLine reuses these URLs each year.
KNOWN_EVENT_PAGES = [
    {
        "url": f"{BASE_URL}/good-human/",
        "default_title": "Good Human Gala",
        "category": "community",
        "tags": ["animals", "fundraiser", "gala"],
        "is_free": False,
    },
    {
        "url": f"{BASE_URL}/super-adopt/",
        "default_title": "LifeLine Super Adopt-a-thon",
        "category": "community",
        "tags": ["animals", "adoption"],
        "is_free": True,
    },
    {
        "url": f"{BASE_URL}/spooky-pooch/",
        "default_title": "Spooky Pooch 5K & Fun Walk",
        "category": "fitness",
        "tags": ["animals", "fundraiser", "outdoor", "5k"],
        "is_free": False,
    },
    {
        "url": f"{BASE_URL}/healthy-pets/",
        "default_title": "Healthy Pets Free Community Vet Care",
        "category": "community",
        "tags": ["animals", "free", "health"],
        "is_free": True,
    },
]


def _fetch(url: str) -> Optional[BeautifulSoup]:
    """Fetch a URL and return parsed HTML, or None on failure."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=25)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return None


def _extract_title(soup: BeautifulSoup, default: str) -> str:
    """Prefer og:title; strip the site name suffix."""
    for meta_prop in ("og:title", "twitter:title"):
        tag = soup.find("meta", property=meta_prop) or soup.find("meta", attrs={"name": meta_prop})
        if tag and tag.get("content"):
            raw = tag["content"]
            for sep in (" - LifeLine", " | LifeLine", " – LifeLine"):
                if sep in raw:
                    raw = raw.split(sep)[0]
            return raw.strip()

    title_tag = soup.find("title")
    if title_tag:
        raw = title_tag.get_text(strip=True)
        for sep in (" - LifeLine", " | LifeLine", " – LifeLine"):
            if sep in raw:
                raw = raw.split(sep)[0]
        return raw.strip()

    return default


def _extract_date(soup: BeautifulSoup, page_text: str) -> Optional[str]:
    """
    Extract event start date from page content.

    Checks JSON-LD schema first, then scans text for date patterns.
    Collects ALL date candidates and returns the most future-forward one —
    LifeLine pages sometimes have maintenance notice dates earlier in the text
    than the actual event date.
    """
    today = datetime.now().date()

    # JSON-LD schema check — only trust startDate, not datePublished (which is the
    # WordPress post creation date, not the event date).
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.get_text())
            items = data.get("@graph", [data])
            for item in items:
                for field in ("startDate",):
                    val = item.get(field)
                    if val and re.match(r"\d{4}-\d{2}-\d{2}", str(val)):
                        iso = str(val)[:10]
                        try:
                            if datetime.strptime(iso, "%Y-%m-%d").date() >= today:
                                return iso
                        except ValueError:
                            pass
        except Exception:
            pass

    # Collect all future-date candidates from visible text
    date_patterns = [
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+\d{1,2},?\s+\d{4}",
        r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+\d{1,2},?\s+\d{4}",
    ]

    candidates: list[str] = []
    for pattern in date_patterns:
        for match in re.finditer(pattern, page_text, re.IGNORECASE):
            parsed = parse_human_date(match.group(0))
            if parsed:
                try:
                    dt = datetime.strptime(parsed, "%Y-%m-%d").date()
                    if dt >= today:
                        candidates.append(parsed)
                except ValueError:
                    pass

    if not candidates:
        return None

    # Prefer dates farther in the future — the event date, not incidental mentions
    candidates.sort()
    return candidates[-1]


def _extract_time(page_text: str) -> Optional[str]:
    """
    Extract event start time and return HH:MM (24h).

    Searches for a time (AM/PM) within 100 characters after a future date
    mention. Only considers dates that are today or later, avoiding incidental
    time values that appear near past-date notices (e.g. maintenance windows).
    """
    _TIME_RE = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)")
    _DATE_RE = re.compile(
        r"(?:January|February|March|April|May|June|July|August|September|"
        r"October|November|December)\s+\d{1,2},?\s+\d{4}",
        re.IGNORECASE,
    )
    today = datetime.now().date()

    for date_match in _DATE_RE.finditer(page_text):
        parsed = parse_human_date(date_match.group(0))
        if not parsed:
            continue
        try:
            if datetime.strptime(parsed, "%Y-%m-%d").date() < today:
                continue  # skip past dates
        except ValueError:
            continue

        window = page_text[date_match.start() : date_match.end() + 100]
        time_match = _TIME_RE.search(window)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2) or "0")
            period = time_match.group(3).upper()
            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute:02d}"

    return None


def _extract_image(soup: BeautifulSoup) -> Optional[str]:
    """Extract og:image or first prominent image."""
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        return og_image["content"]
    img = soup.find("img", class_=re.compile(r"hero|banner|featured|event", re.I))
    if img:
        src = img.get("src") or img.get("data-src")
        if src:
            return src if src.startswith("http") else BASE_URL + src
    return None


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _description_mentions_other_known_event(description: str, title: str) -> bool:
    """Reject stale OG descriptions that clearly refer to a different LifeLine event."""
    desc_norm = _normalize_text(description)
    title_norm = _normalize_text(title)

    for page in KNOWN_EVENT_PAGES:
        candidate = _normalize_text(page["default_title"])
        if candidate and candidate in desc_norm and candidate not in title_norm:
            return True

    return False


def _extract_description(soup: BeautifulSoup, title: str) -> Optional[str]:
    """Extract a meaningful description from the page body."""
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        candidate = og_desc["content"].strip()
        if candidate and not _description_mentions_other_known_event(candidate, title):
            return candidate

    content_div = (
        soup.find("div", class_=re.compile(r"entry-content|post-content|page-content|wp-block", re.I))
        or soup.find("main")
    )
    if content_div:
        best = ""
        for p in content_div.find_all("p"):
            text = p.get_text(" ", strip=True)
            text_lower = text.lower()
            if any(
                skip in text_lower
                for skip in [
                    "shop exclusively in the lifeline store",
                    "adoptable pets page will be undergoing maintenance",
                    "view additional event details",
                    "view sponsorship guide",
                ]
            ):
                continue
            if len(text) > len(best) and len(text) > 30:
                best = text
        if best:
            return best[:500]

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl LifeLine Animal Project event landing pages.

    LifeLine's main /events/ calendar and iCal export are blocked by Cloudflare
    bot detection. This crawler targets their dedicated event landing pages,
    which are WordPress pages that serve without challenge.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = datetime.now().date()

    for page_config in KNOWN_EVENT_PAGES:
        url = page_config["url"]
        logger.info("Fetching LifeLine event page: %s", url)

        soup = _fetch(url)
        if not soup:
            continue

        page_text = soup.get_text(" ", strip=True)
        title = _extract_title(soup, page_config["default_title"])
        start_date = _extract_date(soup, page_text)

        if not start_date:
            logger.debug("No date found on %s — skipping", url)
            continue

        try:
            event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            if event_date < today:
                logger.debug("Past event, skipping: %s on %s", title, start_date)
                continue
        except ValueError:
            continue

        events_found += 1

        start_time = _extract_time(page_text)
        image_url = _extract_image(soup)
        description = _extract_description(soup, title)

        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": page_config["category"],
            "subcategory": None,
            "tags": page_config["tags"],
            "price_min": 0 if page_config["is_free"] else None,
            "price_max": 0 if page_config["is_free"] else None,
            "price_note": "Free" if page_config["is_free"] else None,
            "is_free": page_config["is_free"],
            "source_url": url,
            "ticket_url": url,
            "image_url": image_url,
            "raw_text": f"{title} {description or ''}",
            "extraction_confidence": 0.85,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            logger.debug("Updated: %s on %s", title, start_date)
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info("Added: %s on %s", title, start_date)
        except Exception as exc:
            logger.error("Failed to insert '%s': %s", title, exc)

    logger.info(
        "LifeLine Animal Project crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
