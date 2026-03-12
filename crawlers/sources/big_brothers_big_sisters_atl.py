"""
Crawler for Big Brothers Big Sisters of Metro Atlanta (bbbsatl.org).

Big Brothers Big Sisters provides youth mentorship programs and
organizes community events. Site may use JavaScript rendering - using Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.bbbsatl.org"
EVENTS_URL = f"{BASE_URL}/events"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Big Brothers Big Sisters HQ venue
BBBS_HQ = {
    "name": "Big Brothers Big Sisters of Metro Atlanta",
    "slug": "big-brothers-big-sisters-atlanta",
    "address": "220 Interstate North Pkwy SE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def goto_with_retry(page, url: str, *, attempts: int = 3, timeout_ms: int = 45000) -> None:
    """Navigate with retry/backoff for transient renderer/network failures."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            return
        except Exception as exc:  # noqa: BLE001 - crawler retry guard
            last_exc = exc
            if attempt >= attempts:
                raise
            page.wait_for_timeout(1500 * attempt)
    if last_exc:
        raise last_exc


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["mentor", "youth", "kid", "children", "student", "education", "tutoring", "school"]):
        return "education"
    if any(word in text for word in ["volunteer", "volunteering", "service"]):
        return "community"
    if any(word in text for word in ["fundraiser", "gala", "benefit", "donor"]):
        return "community"
    if any(word in text for word in ["workshop", "training", "seminar"]):
        return "education"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    if any(word in text for word in ["youth", "kid", "children", "student", "teen"]):
        tags.append("youth")
    if any(word in text for word in ["mentor", "mentoring", "mentorship"]):
        tags.append("mentorship")
    if any(word in text for word in ["volunteer", "volunteering"]):
        tags.append("volunteer")
    if any(word in text for word in ["education", "school", "learning", "tutoring"]):
        tags.append("education")
    if any(word in text for word in ["family", "families"]):
        tags.append("family-friendly")
    if any(word in text for word in ["community", "neighborhood"]):
        tags.append("community")
    if any(word in text for word in ["charity", "nonprofit", "fundraiser", "benefit"]):
        tags.append("charity")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Most volunteer/mentorship events are free
    if any(word in text for word in ["volunteer", "mentor", "orientation"]):
        return True

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "donation"]):
        return False

    # Default to True for volunteer org
    return True


def parse_date_from_text(text: str) -> Optional[str]:
    """Try to extract a date from text."""
    current_year = datetime.now().year

    # Try "Month DD, YYYY" or "Month DD"
    match = re.search(r'(\w+)\s+(\d{1,2})(?:,?\s+(\d{4}))?', text)
    if match:
        month_str, day, year = match.groups()
        explicit_year = year is not None
        year = year or str(current_year)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%B %d %Y")
            if not explicit_year and dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                if not explicit_year and dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Try "MM/DD/YYYY" or "M/D/YY"
    match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', text)
    if match:
        month, day, year = match.groups()
        if len(year) == 2:
            year = f"20{year}"
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_from_text(text: str) -> Optional[str]:
    """Try to extract a time from text."""
    match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)', text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        minute = minute or "00"
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def is_date_like_text(text: str) -> bool:
    return bool(re.fullmatch(r"[A-Z][a-z]+ \d{1,2}, \d{4}", text.strip()))


def normalize_title_candidate(text: str) -> Optional[str]:
    clean = " ".join(text.split()).strip()
    if not clean or is_date_like_text(clean):
        return None
    clean = clean.split("|")[0].strip()
    clean = clean.split(" - ")[0].strip()
    if clean.lower() in {
        "events",
        "fundraising events",
        "program events",
        "corporate partnerships",
        "big futures",
        "match resources",
    }:
        return None
    if len(clean) < 4:
        return None
    if clean.lower() == "bsfl":
        return "BSFL"
    return clean


def title_from_slug(url: str) -> Optional[str]:
    path = urlparse(url).path.strip("/")
    if not path:
        return None
    slug = path.split("/")[-1]
    if slug in {"events", "program-events"}:
        return None
    title = slug.replace("-", " ").replace("_", " ").strip()
    return title.title() if title else None


def fetch_event_title(url: str) -> Optional[str]:
    try:
        response = requests.get(
            url,
            timeout=15,
            headers={"User-Agent": USER_AGENT},
            allow_redirects=True,
        )
        html = response.text
    except Exception:
        return title_from_slug(url)

    og_match = re.search(
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if og_match:
        title = normalize_title_candidate(og_match.group(1))
        if title:
            return title

    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if title_match:
        title = normalize_title_candidate(title_match.group(1).split("|")[0])
        if title:
            return title

    h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.IGNORECASE | re.DOTALL)
    if h1_match:
        h1_text = re.sub(r"<[^>]+>", " ", h1_match.group(1))
        title = normalize_title_candidate(h1_text)
        if title:
            return title

    return title_from_slug(response.url)


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Big Brothers Big Sisters of Metro Atlanta events using Playwright.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get venue ID
            venue_id = get_or_create_venue(BBBS_HQ)

            logger.info(f"Fetching BBBS Atlanta events: {EVENTS_URL}")
            goto_with_retry(page, EVENTS_URL, attempts=3, timeout_ms=45000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            seen_hashes: set[str] = set()
            for anchor in page.locator("a[href]").all():
                try:
                    anchor_text = " ".join(anchor.inner_text().split())
                except Exception:
                    continue

                if not is_date_like_text(anchor_text):
                    continue

                event_date = parse_date_from_text(anchor_text)
                if not event_date:
                    continue
                if event_date < datetime.now().strftime("%Y-%m-%d"):
                    continue

                href = anchor.get_attribute("href")
                if not href:
                    continue

                event_url = urljoin(BASE_URL, href)
                title = fetch_event_title(event_url)
                title = normalize_title_candidate(title or "")
                if not title:
                    logger.debug("Skipping BBBS event with unresolved title: %s", event_url)
                    continue

                description = None
                try:
                    parent = anchor.locator("xpath=ancestor::*[self::div or self::section][1]")
                    parent_text = " ".join(parent.inner_text().split())
                    parent_text = parent_text.replace(anchor_text, "").replace(title, "").strip()
                    if parent_text:
                        description = parent_text[:500]
                except Exception:
                    description = None

                event_time = parse_time_from_text(description or "")
                category = determine_category(title, description or "")
                tags = extract_tags(title, description or "")
                is_free = is_free_event(title, description or "")

                content_hash = generate_content_hash(
                    title, "Big Brothers Big Sisters of Metro Atlanta", event_date
                )
                if content_hash in seen_hashes:
                    continue
                seen_hashes.add(content_hash)
                events_found += 1

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": event_date,
                    "start_time": event_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": event_time is None,
                    "category": category,
                    "subcategory": None,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_map.get(title),
                    "raw_text": f"{title} | {event_date} | {(description or '')[:200]}"[:500],
                    "extraction_confidence": 0.75,
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
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {event_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(
            f"BBBS Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching BBBS Atlanta: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl BBBS Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
