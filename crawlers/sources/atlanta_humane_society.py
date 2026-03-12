"""
Crawler for Atlanta Humane Society events (atlantahumane.org/events/).

Atlanta Humane Society uses WordPress with The Events Calendar (Tribe Events)
plugin. Their entire site is behind Cloudflare bot detection, which blocks
plain requests but allows Playwright with domcontentloaded wait.

Events include adoption events, fundraising galas, volunteer orientations,
give-back nights, bingo fundraisers, and community education programs. The
Tribe Events list view loads fully after domcontentloaded and exposes clean
structured data: datetime attributes, venue address, and description snippets.

Pagination: Tribe Events list view renders all upcoming events in a single
request (typically ~5-15 events). Pagination links are checked and followed
when present.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
    update_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantahumane.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Atlanta Humane Society",
    "slug": "atlanta-humane-society",
    "address": "981 Howell Mill Rd NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7813,
    "lng": -84.4114,
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["dog-friendly", "family-friendly"],
}


def _parse_time_from_text(text: str) -> Optional[str]:
    """
    Parse start time from Tribe Events time display.

    Handles formats like "6 p.m.", "6:00 p.m.", "11 a.m.", "11:00 AM".
    """
    # Match "6 p.m." or "6:00 p.m." or "11:00 AM"
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*([ap]\.?\s*m\.?)",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or "0")
    period = re.sub(r"[\s.]", "", match.group(3)).lower()

    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute:02d}"


def _categorize(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["animals", "atlanta-humane"]

    if any(w in text for w in ["info session", "information session", "support program", "learn more about this program"]):
        tags.append("family-friendly")
        return "learning", "info-session", tags

    if any(w in text for w in ["adopt", "adoptable", "meet the pets"]):
        tags.extend(["adoption", "family-friendly"])
        return "community", "adoption-event", tags

    if any(w in text for w in ["volunteer", "orientation", "walk dogs"]):
        tags.append("volunteer")
        return "community", "volunteer", tags

    if any(w in text for w in ["gala", "fundraiser", "benefit", "auction", "raffle", "donate", "giving"]):
        tags.append("fundraiser")
        return "community", "fundraiser", tags

    if any(w in text for w in ["bingo", "trivia", "give back", "brewery", "wine", "beer"]):
        tags.extend(["fundraiser", "nightlife"])
        return "community", "fundraiser", tags

    if any(w in text for w in ["clinic", "vaccine", "wellness", "spay", "neuter"]):
        tags.extend(["health", "family-friendly"])
        return "community", "pet-clinic", tags

    if any(w in text for w in ["brunch", "walk", "5k", "run", "hike"]):
        tags.extend(["outdoor", "family-friendly"])
        return "community", "community-event", tags

    tags.append("family-friendly")
    return "community", "community-event", tags


def _sync_existing_event(existing: dict, incoming: dict) -> None:
    """Force high-signal classification fields to current source truth."""
    direct_updates = {}
    field_pairs = (
        ("category_id", incoming.get("category")),
        ("tags", incoming.get("tags")),
    )

    for existing_field, incoming_value in field_pairs:
        if existing.get(existing_field) != incoming_value:
            direct_updates[existing_field] = incoming_value

    if direct_updates:
        update_event(existing["id"], direct_updates)
        existing = {**existing, **direct_updates}

    smart_update_existing_event(existing, incoming)


def _parse_events_from_html(html: str, source_url: str) -> list[dict]:
    """
    Parse Tribe Events list-view HTML into raw event dicts.

    Each event article has:
    - .tribe-events-calendar-list__event-title-link  (title + href)
    - time[datetime]                                  (ISO date)
    - .tribe-events-calendar-list__event-datetime     (time text)
    - .tribe-events-calendar-list__event-venue-title  (venue name)
    - .tribe-events-calendar-list__event-venue-address (venue address)
    - .tribe-events-calendar-list__event-description  (description excerpt)
    - img (featured image)
    """
    soup = BeautifulSoup(html, "html.parser")
    events = []

    today = datetime.now().date()

    for article in soup.select(".tribe-events-calendar-list__event"):
        try:
            # Title + URL
            title_link = article.select_one(".tribe-events-calendar-list__event-title-link")
            if not title_link:
                continue
            title = title_link.get_text(strip=True)
            event_url = title_link.get("href") or source_url

            # Date from <time datetime="YYYY-MM-DD">
            time_el = article.select_one("time[datetime]")
            if not time_el:
                continue
            start_date = time_el.get("datetime", "")[:10]
            if not start_date or not re.match(r"\d{4}-\d{2}-\d{2}", start_date):
                continue

            # Skip past events
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                if event_date < today:
                    continue
            except ValueError:
                continue

            # Time from datetime display text (e.g., "March 16 @ 6 p.m. - 9 p.m.")
            datetime_el = article.select_one(".tribe-events-calendar-list__event-datetime")
            start_time = None
            if datetime_el:
                dt_text = datetime_el.get_text(" ", strip=True)
                start_time = _parse_time_from_text(dt_text)

            # Venue (event may be at a different location — e.g., brewery, park)
            venue_name_el = article.select_one(".tribe-events-calendar-list__event-venue-title")
            venue_addr_el = article.select_one(".tribe-events-calendar-list__event-venue-address")
            event_venue_name = venue_name_el.get_text(strip=True) if venue_name_el else None
            event_venue_addr = venue_addr_el.get_text(strip=True) if venue_addr_el else None

            # Description excerpt
            desc_el = article.select_one(".tribe-events-calendar-list__event-description")
            description = desc_el.get_text(" ", strip=True) if desc_el else None
            if description and len(description) > 500:
                description = description[:497] + "..."

            # Image
            img = article.select_one("img")
            image_url = img.get("src") if img else None

            events.append({
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "event_venue_name": event_venue_name,
                "event_venue_addr": event_venue_addr,
                "description": description,
                "image_url": image_url,
                "source_url": event_url,
            })

        except Exception as exc:
            logger.debug("Error parsing event article: %s", exc)
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Humane Society events using Playwright.

    The site is behind Cloudflare; Playwright with domcontentloaded bypasses
    it. Tribe Events list view renders synchronously — no extra wait needed
    beyond the initial page load.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_venue(VENUE_DATA)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1440, "height": 900},
                locale="en-US",
                timezone_id="America/New_York",
            )
            page = context.new_page()

            urls_to_crawl = [EVENTS_URL]
            crawled_urls: set[str] = set()
            all_raw_events: list[dict] = []

            while urls_to_crawl:
                url = urls_to_crawl.pop(0)
                if url in crawled_urls:
                    continue
                crawled_urls.add(url)

                logger.info("Fetching Atlanta Humane events: %s", url)
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(2000)

                html = page.content()
                raw_events = _parse_events_from_html(html, url)
                all_raw_events.extend(raw_events)
                logger.info("Found %d events on %s", len(raw_events), url)

                # Follow pagination if present (Tribe Events next-page link)
                soup = BeautifulSoup(html, "html.parser")
                next_link = soup.select_one(
                    "a.tribe-events-c-nav__next, "
                    "a[rel='next'], "
                    ".tribe-events-nav-next a"
                )
                if next_link and next_link.get("href"):
                    next_url = next_link["href"]
                    if next_url.startswith("/"):
                        next_url = BASE_URL + next_url
                    if next_url not in crawled_urls:
                        urls_to_crawl.append(next_url)

            browser.close()

        # Deduplicate by title + date before inserting
        seen: set[str] = set()
        for ev in all_raw_events:
            key = f"{ev['title']}|{ev['start_date']}"
            if key in seen:
                continue
            seen.add(key)

            events_found += 1
            title = ev["title"]
            start_date = ev["start_date"]

            category, subcategory, tags = _categorize(title, ev.get("description") or "")

            # If the event is at AHS main venue, use the default venue_id.
            # Events at third-party venues (breweries, parks) still attribute
            # to AHS as the organizer — we don't create separate venue records
            # for one-off offsite events.
            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
            current_hashes.add(content_hash)

            is_free = any(
                w in (f"{title} {ev.get('description') or ''}").lower()
                for w in ["free", "no cost", "no charge", "complimentary"]
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": ev.get("description"),
                "start_date": start_date,
                "start_time": ev.get("start_time"),
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": 0 if is_free else None,
                "price_max": 0 if is_free else None,
                "price_note": "Free" if is_free else None,
                "is_free": is_free,
                "source_url": ev["source_url"],
                "ticket_url": ev["source_url"],
                "image_url": ev.get("image_url"),
                "raw_text": f"{title} {ev.get('description') or ''}",
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                _sync_existing_event(existing, event_record)
                events_updated += 1
                logger.debug("Updated: %s on %s", title, start_date)
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.info("Added: %s on %s", title, start_date)
            except Exception as exc:
                logger.error("Failed to insert '%s': %s", title, exc)

        stale_deleted = remove_stale_source_events(source_id, current_hashes)
        if stale_deleted:
            logger.info(
                "Removed %s stale Atlanta Humane Society events after refresh",
                stale_deleted,
            )

    except Exception as exc:
        logger.error("Failed to crawl Atlanta Humane Society: %s", exc)
        raise

    logger.info(
        "Atlanta Humane Society crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
