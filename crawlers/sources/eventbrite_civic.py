"""
Eventbrite civic category crawler for HelpATL portal.

Discovers community, government, and charity events from Eventbrite's
Atlanta category pages. Attributed to the HelpATL portal so they surface
in civic searches. Covers categories the main eventbrite.py source skips.
"""

from __future__ import annotations

import json
import logging
import re
import time
import requests
from datetime import datetime
from functools import lru_cache
from typing import Optional
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from config import get_config
from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    get_portal_id_by_slug,
)
from dedupe import generate_content_hash
from aggregator_utils import (
    clean_aggregator_title,
    detect_recurring_from_title,
    override_category_from_title,
    build_series_hint_from_recurring,
)

logger = logging.getLogger(__name__)

API_BASE = "https://www.eventbriteapi.com/v3/"

# Civic-relevant Eventbrite category pages for Atlanta metro
CIVIC_BROWSE_URLS = [
    "https://www.eventbrite.com/d/ga--atlanta/community/",
    "https://www.eventbrite.com/d/ga--atlanta/government/",
    "https://www.eventbrite.com/d/ga--atlanta/charity-and-causes/",
]

# Eventbrite category → (lostcity_category, genre_list)
# Only civic-relevant mappings needed here
CATEGORY_MAP = {
    "Community & Culture": ("community", ["cultural"]),
    "Government & Politics": ("community", ["activism"]),
    "Charity & Causes": ("community", ["volunteer"]),
    # Fallback for any other categories that surface on these pages
    "Music": ("music", []),
    "Business & Professional": ("learning", ["networking"]),
    "Food & Drink": ("food_drink", []),
    "Performing & Visual Arts": ("art", []),
    "Film, Media & Entertainment": ("film", []),
    "Sports & Fitness": ("sports", []),
    "Health & Wellness": ("fitness", []),
    "Science & Technology": ("learning", []),
    "Travel & Outdoor": ("outdoor", []),
    "Religion & Spirituality": ("community", ["faith"]),
    "Family & Education": ("family", []),
    "Seasonal & Holiday": ("other", []),
    "Fashion & Beauty": ("other", []),
    "Home & Lifestyle": ("other", []),
    "Hobbies & Special Interest": ("other", []),
    "Other": ("other", []),
    "Nightlife": ("nightlife", []),
}

EVENTBRITE_DESCRIPTION_ENRICH_MIN_LENGTH = 260
EVENTBRITE_DESCRIPTION_MAX_LENGTH = 4000
_VENUE_PAREN_NOTE_RE = re.compile(r"\s*\(([^)]{1,120})\)\s*$")
_VENUE_PAREN_DROP_HINTS = (
    "course map",
    "emailed",
    "email",
    "details sent",
    "address shared",
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _normalize_venue_name(raw_name: str) -> str:
    name = _clean_text(raw_name)
    if not name:
        return ""
    match = _VENUE_PAREN_NOTE_RE.search(name)
    if match:
        note = match.group(1).lower()
        if any(hint in note for hint in _VENUE_PAREN_DROP_HINTS):
            name = _clean_text(name[: match.start()])
    return name


def _iter_jsonld_objects(soup: BeautifulSoup) -> list[dict]:
    objects: list[dict] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text() or ""
        raw = raw.strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except Exception:
            continue
        if isinstance(payload, dict):
            if isinstance(payload.get("@graph"), list):
                objects.extend(
                    [item for item in payload["@graph"] if isinstance(item, dict)]
                )
            objects.append(payload)
        elif isinstance(payload, list):
            objects.extend([item for item in payload if isinstance(item, dict)])
    return objects


def _extract_faq_highlights(soup: BeautifulSoup) -> Optional[str]:
    highlights: list[str] = []
    for obj in _iter_jsonld_objects(soup):
        raw_type = obj.get("@type")
        types = raw_type if isinstance(raw_type, list) else [raw_type]
        types = [str(t) for t in types if t]
        if "FAQPage" not in types:
            continue
        for item in obj.get("mainEntity") or []:
            if not isinstance(item, dict):
                continue
            question = _clean_text(item.get("name"))
            accepted = item.get("acceptedAnswer")
            answer = ""
            if isinstance(accepted, dict):
                answer = _clean_text(accepted.get("text"))
            if question and answer:
                highlights.append(f"{question} {answer}")
            elif answer:
                highlights.append(answer)
    if not highlights:
        return None
    deduped: list[str] = []
    seen: set[str] = set()
    for item in highlights:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    if not deduped:
        return None
    return f"FAQ highlights: {' '.join(deduped[:5])}"


@lru_cache(maxsize=1024)
def _fetch_detail_enrichment(event_url: str) -> Optional[str]:
    if not event_url:
        return None
    try:
        response = requests.get(
            event_url,
            timeout=20,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
        )
        if response.status_code >= 400:
            return None
        soup = BeautifulSoup(response.text, "html.parser")
        faq = _extract_faq_highlights(soup)
        return _clean_text(faq)
    except Exception:
        return None


def _enrich_description(base_description: Optional[str], event_url: str) -> str:
    current = _clean_text(base_description)
    if len(current) >= EVENTBRITE_DESCRIPTION_ENRICH_MIN_LENGTH:
        return current[:EVENTBRITE_DESCRIPTION_MAX_LENGTH]
    enrichment = _fetch_detail_enrichment(event_url)
    if not enrichment:
        return current[:EVENTBRITE_DESCRIPTION_MAX_LENGTH]
    if current and enrichment.lower() in current.lower():
        return current[:EVENTBRITE_DESCRIPTION_MAX_LENGTH]
    if current and current.lower() in enrichment.lower():
        merged = enrichment
    elif current:
        merged = f"{current}\n\n{enrichment}"
    else:
        merged = enrichment
    return merged[:EVENTBRITE_DESCRIPTION_MAX_LENGTH]


def _format_time_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def _build_description(
    *,
    title: str,
    base_description: Optional[str],
    event_url: str,
    venue_name: str,
    venue_city: str,
    venue_state: str,
    start_date: Optional[str],
    start_time: Optional[str],
    is_free: bool,
    category_name: Optional[str],
    organizer_name: Optional[str],
    format_name: Optional[str],
) -> str:
    current = _clean_text(base_description)
    if len(current) >= EVENTBRITE_DESCRIPTION_ENRICH_MIN_LENGTH:
        return current[:EVENTBRITE_DESCRIPTION_MAX_LENGTH]

    parts: list[str] = []
    if current:
        parts.append(current if current.endswith(".") else f"{current}.")
    else:
        descriptor = "Eventbrite event"
        if category_name:
            descriptor = f"{category_name} event"
        parts.append(f"{title} is an Eventbrite {descriptor}.")

    if organizer_name:
        parts.append(f"Hosted by {organizer_name}.")
    if format_name:
        parts.append(f"Format: {format_name}.")

    if venue_name and venue_name != "TBA":
        parts.append(
            f"Location: {venue_name}, {venue_city or 'Atlanta'}, {venue_state or 'GA'}."
        )
    else:
        parts.append("Location details are listed on the official event page.")

    time_label = _format_time_label(start_time)
    if start_date and time_label:
        parts.append(f"Scheduled on {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    parts.append(
        "Free registration."
        if is_free
        else "Paid ticketing; price tiers vary by release window."
    )
    if event_url:
        parts.append(
            f"Check Eventbrite for current agenda and ticket availability ({event_url})."
        )

    return " ".join(parts)[:EVENTBRITE_DESCRIPTION_MAX_LENGTH]


def _get_api_headers() -> dict:
    cfg = get_config()
    api_key = cfg.api.eventbrite_api_key
    if not api_key:
        raise ValueError("EVENTBRITE_API_KEY not configured")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _discover_event_ids(max_events: int = 300) -> list[str]:
    """Browse civic Eventbrite category pages and collect event IDs."""
    event_ids: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        for browse_url in CIVIC_BROWSE_URLS:
            if len(event_ids) >= max_events:
                break

            logger.info("Browsing civic page: %s", browse_url)
            try:
                page.goto(browse_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
            except Exception as e:
                logger.warning("Failed to load %s: %s", browse_url, e)
                continue

            scroll_count = 0
            max_scrolls = 25
            last_count = len(event_ids)
            no_new_count = 0

            while scroll_count < max_scrolls and len(event_ids) < max_events:
                links = page.query_selector_all('a[href*="/e/"]')
                for link in links:
                    href = link.get_attribute("href")
                    if href:
                        match = re.search(r"/e/[^/]+-(\d+)", href)
                        if match:
                            event_ids.add(match.group(1))

                if len(event_ids) == last_count:
                    no_new_count += 1
                    try:
                        load_more = page.query_selector(
                            'button:has-text("See more"), button:has-text("Load more"), [data-testid="load-more-button"]'
                        )
                        if load_more and load_more.is_visible():
                            load_more.click()
                            page.wait_for_timeout(2000)
                            no_new_count = 0
                            continue
                    except Exception:
                        pass
                    if no_new_count >= 5:
                        break
                else:
                    no_new_count = 0
                    last_count = len(event_ids)

                logger.info(
                    "Scroll %d: %d civic event IDs found",
                    scroll_count + 1,
                    len(event_ids),
                )
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2000)
                scroll_count += 1

            logger.info(
                "After %s: %d total civic event IDs", browse_url, len(event_ids)
            )

        browser.close()

    logger.info(
        "Discovered %d unique civic event IDs across %d category pages",
        len(event_ids),
        len(CIVIC_BROWSE_URLS),
    )
    return list(event_ids)[:max_events]


def _fetch_event_from_api(event_id: str) -> Optional[dict]:
    try:
        url = f"{API_BASE}events/{event_id}/"
        params = {"expand": "venue,organizer,category,format,ticket_availability"}
        response = requests.get(
            url, headers=_get_api_headers(), params=params, timeout=15
        )
        if response.status_code == 404:
            logger.debug("Event %s not found (may be private or ended)", event_id)
            return None
        elif response.status_code == 429:
            logger.warning("Rate limited, waiting 30 seconds...")
            time.sleep(30)
            return _fetch_event_from_api(event_id)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error("Error fetching event %s: %s", event_id, e)
        return None


def _parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    except Exception:
        return None, None


def _get_category(eventbrite_category: Optional[str]) -> tuple[str, list[str]]:
    if not eventbrite_category:
        return "community", []
    return CATEGORY_MAP.get(eventbrite_category, ("community", []))


def _process_event(
    event_data: dict,
    source_id: int,
    producer_id: Optional[int],
    helpatl_portal_id: Optional[str],
) -> Optional[dict]:
    try:
        title = event_data.get("name", {}).get("text", "").strip()
        title = clean_aggregator_title(title)
        if not title:
            return None

        start_info = event_data.get("start", {})
        start_date, start_time = _parse_datetime(start_info.get("local"))
        if not start_date:
            return None

        if start_date < datetime.now().strftime("%Y-%m-%d"):
            return None

        description = event_data.get("description", {}).get("text", "")

        end_info = event_data.get("end", {})
        end_date, end_time = _parse_datetime(end_info.get("local"))

        # Venue
        place_data = event_data.get("venue") or {}
        venue_id = None
        venue_name = "TBA"

        if place_data and place_data.get("name"):
            venue_name = _normalize_venue_name(place_data.get("name", ""))
            if not venue_name:
                venue_name = "TBA"
            address = place_data.get("address", {})

            region = address.get("region", "")
            if region and region not in ["GA", "Georgia"]:
                return None

            venue_record = {
                "name": venue_name,
                "slug": re.sub(r"[^a-z0-9-]", "", venue_name.lower().replace(" ", "-"))[
                    :50
                ],
                "address": address.get("address_1"),
                "city": address.get("city", "Atlanta"),
                "state": "GA",
                "zip": address.get("postal_code"),
                "place_type": "event_space",
                "website": None,
            }
            venue_id = get_or_create_place(venue_record)

        # Category — default to community since this is the civic crawler
        category_data = event_data.get("category") or {}
        category_name = category_data.get("name") if category_data else None
        category, genres = _get_category(category_name)
        category = override_category_from_title(title, category)

        # If the resulting category is non-civic, still include it —
        # the browse page is civic-filtered so non-civic results are edge cases.

        is_free = event_data.get("is_free", False)

        logo = event_data.get("logo") or {}
        image_url = None
        if logo:
            original = logo.get("original") or {}
            image_url = original.get("url")

        event_url = event_data.get("url", "")
        description = _enrich_description(description, event_url)

        content_hash = generate_content_hash(title, venue_name, start_date)

        tags = [category]
        if is_free:
            tags.append("free")

        format_data = event_data.get("format") or {}
        format_name = format_data.get("short_name") if format_data else None
        if format_name:
            tags.append(format_name.lower())

        organizer = event_data.get("organizer") or {}
        organizer_name = organizer.get("name", "") if organizer else ""

        description = _build_description(
            title=title,
            base_description=description,
            event_url=event_url,
            venue_name=venue_name,
            venue_city=(
                (place_data or {}).get("address", {}).get("city", "Atlanta")
                if place_data
                else "Atlanta"
            ),
            venue_state="GA",
            start_date=start_date,
            start_time=start_time,
            is_free=is_free,
            category_name=category_name,
            organizer_name=organizer_name,
            format_name=format_name,
        )

        eb_is_series = bool(event_data.get("is_series"))
        eb_series_id = event_data.get("series_id")
        title_is_recurring, title_frequency, title_day = detect_recurring_from_title(
            title
        )

        is_recurring = eb_is_series or bool(eb_series_id) or title_is_recurring
        frequency = title_frequency
        day_of_week = title_day

        series_hint = build_series_hint_from_recurring(
            title, is_recurring, frequency, day_of_week
        )

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "producer_id": producer_id,
            "portal_id": helpatl_portal_id,
            "title": title[:500],
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date or start_date,
            "end_time": end_time,
            "is_all_day": False,
            "category": category,
            "genres": genres,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Free" if is_free else "See Eventbrite",
            "is_free": is_free,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.95,
            "is_recurring": is_recurring,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        event_record["_series_hint"] = series_hint

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            return {"status": "exists"}

        return event_record
    except Exception as e:
        logger.error("Error processing civic event: %s", e)
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Discover civic Eventbrite events for HelpATL via website + API."""
    source_id = source["id"]
    producer_id = source.get("producer_id")

    # Resolve HelpATL portal ID for explicit event attribution
    helpatl_portal_id = get_portal_id_by_slug("helpatl")
    if not helpatl_portal_id:
        logger.error(
            "Could not resolve HelpATL portal ID — aborting civic Eventbrite crawl"
        )
        return 0, 0, 0

    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(
            "Eventbrite civic: discovering events from community/government/charity pages..."
        )
        event_ids = _discover_event_ids(max_events=300)

        if not event_ids:
            logger.warning(
                "Eventbrite civic: no event IDs discovered from civic category pages"
            )
            return 0, 0, 0

        logger.info(
            "Eventbrite civic: fetching %d event IDs from API...", len(event_ids)
        )

        for i, event_id in enumerate(event_ids):
            if i > 0 and i % 50 == 0:
                logger.info(
                    "Eventbrite civic progress: %d/%d events processed, %d new",
                    i,
                    len(event_ids),
                    events_new,
                )

            event_data = _fetch_event_from_api(event_id)
            if not event_data:
                continue

            events_found += 1

            result = _process_event(
                event_data, source_id, producer_id, helpatl_portal_id
            )
            if not result:
                continue

            if result.get("status") == "exists":
                events_updated += 1
                continue

            try:
                insert_event(result, series_hint=result.pop("_series_hint", None))
                events_new += 1
                logger.debug(
                    "Civic event added: %s on %s",
                    result["title"][:50],
                    result["start_date"],
                )
            except Exception as e:
                logger.error(
                    "Failed to insert civic event %s: %s",
                    result.get("title", "")[:50],
                    e,
                )

            time.sleep(0.2)

        logger.info(
            "Eventbrite civic crawl complete: %d found, %d new, %d existing",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as e:
        logger.error("Eventbrite civic crawl failed: %s", e)
        raise

    return events_found, events_new, events_updated
