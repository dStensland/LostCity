"""
Eventbrite hybrid crawler for Atlanta metro area events.
Discovers events via website, fetches structured data via API.
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
from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

API_BASE = "https://www.eventbriteapi.com/v3/"

# Browse multiple category-filtered URLs to surface events the generic page buries
BROWSE_URLS = [
    "https://www.eventbrite.com/d/ga--atlanta/all-events/",
    "https://www.eventbrite.com/d/ga--atlanta/food-and-drink/",
    "https://www.eventbrite.com/d/ga--atlanta/classes/",
    "https://www.eventbrite.com/d/ga--atlanta/hobbies/",
    "https://www.eventbrite.com/d/ga--atlanta/charity-and-causes/",
    "https://www.eventbrite.com/d/ga--atlanta/family-activities/",
    "https://www.eventbrite.com/d/ga--atlanta/kids-activities/",
    "https://www.eventbrite.com/d/ga--atlanta/camps-and-retreats/",
]

# Category mapping from Eventbrite to Lost City
# Maps Eventbrite category → (lostcity_category, genre_list)
CATEGORY_MAP = {
    "Music": ("music", []),
    "Business & Professional": ("learning", ["networking"]),
    "Food & Drink": ("food_drink", []),
    "Community & Culture": ("community", ["cultural"]),
    "Performing & Visual Arts": ("art", []),
    "Film, Media & Entertainment": ("film", []),
    "Sports & Fitness": ("sports", []),
    "Health & Wellness": ("fitness", ["yoga"]),
    "Science & Technology": ("learning", ["seminar"]),
    "Travel & Outdoor": ("outdoor", ["adventure"]),
    "Charity & Causes": ("community", ["volunteer"]),
    "Religion & Spirituality": ("community", ["faith"]),
    "Family & Education": ("family", []),
    "Seasonal & Holiday": ("other", ["cultural"]),
    "Government & Politics": ("community", ["activism"]),
    "Fashion & Beauty": ("other", []),
    "Home & Lifestyle": ("other", []),
    "Auto, Boat & Air": ("other", []),
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


def _normalize_eventbrite_venue_name(raw_name: str) -> str:
    """Normalize obvious instruction-style suffixes from Eventbrite venue names."""
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
                objects.extend([item for item in payload["@graph"] if isinstance(item, dict)])
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

    # De-duplicate while preserving order
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


@lru_cache(maxsize=2048)
def fetch_detail_page_enrichment(event_url: str) -> Optional[str]:
    """Fetch supplemental Eventbrite detail content (FAQ, structured blocks)."""
    if not event_url:
        return None

    try:
        response = requests.get(
            event_url,
            timeout=20,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
        )
        if response.status_code >= 400:
            return None

        soup = BeautifulSoup(response.text, "html.parser")
        faq = _extract_faq_highlights(soup)
        return _clean_text(faq)
    except Exception:
        return None


def enrich_description_from_detail_page(base_description: Optional[str], event_url: str) -> str:
    """Expand short API blurbs using detail-page FAQ content when available."""
    current = _clean_text(base_description)
    if len(current) >= EVENTBRITE_DESCRIPTION_ENRICH_MIN_LENGTH:
        return current[:EVENTBRITE_DESCRIPTION_MAX_LENGTH]

    enrichment = fetch_detail_page_enrichment(event_url)
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


def build_structured_eventbrite_description(
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
        parts.append(f"Location: {venue_name}, {venue_city or 'Atlanta'}, {venue_state or 'GA'}.")
    else:
        parts.append("Location details are listed on the official event page.")

    time_label = _format_time_label(start_time)
    if start_date and time_label:
        parts.append(f"Scheduled on {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    parts.append("Free registration." if is_free else "Paid ticketing; price tiers vary by release window.")
    if event_url:
        parts.append(f"Check Eventbrite for current agenda, policy updates, and ticket availability ({event_url}).")

    return " ".join(parts)[:EVENTBRITE_DESCRIPTION_MAX_LENGTH]


def get_api_headers() -> dict:
    """Get API request headers with authentication."""
    cfg = get_config()
    api_key = cfg.api.eventbrite_api_key
    if not api_key:
        raise ValueError("EVENTBRITE_API_KEY not configured")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def discover_event_ids(max_events: int = 500) -> list[str]:
    """Discover event IDs by browsing multiple Eventbrite category pages."""
    event_ids = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        for browse_url in BROWSE_URLS:
            if len(event_ids) >= max_events:
                break

            logger.info(f"Browsing {browse_url} ...")
            try:
                page.goto(browse_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
            except Exception as e:
                logger.warning(f"Failed to load {browse_url}: {e}")
                continue

            # Scroll and collect event IDs
            scroll_count = 0
            max_scrolls = 30
            last_count = len(event_ids)
            no_new_count = 0

            while scroll_count < max_scrolls and len(event_ids) < max_events:
                # Find all event links on page
                links = page.query_selector_all('a[href*="/e/"]')

                for link in links:
                    href = link.get_attribute("href")
                    if href:
                        match = re.search(r'/e/[^/]+-(\d+)', href)
                        if match:
                            event_ids.add(match.group(1))

                if len(event_ids) == last_count:
                    no_new_count += 1
                    try:
                        load_more = page.query_selector('button:has-text("See more"), button:has-text("Load more"), [data-testid="load-more-button"]')
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

                logger.info(f"Scroll {scroll_count + 1}: Found {len(event_ids)} unique events so far")
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2000)
                scroll_count += 1

            logger.info(f"After {browse_url}: {len(event_ids)} total unique events")

        browser.close()

    logger.info(f"Discovered {len(event_ids)} unique event IDs across {len(BROWSE_URLS)} category pages")
    return list(event_ids)[:max_events]


def fetch_event_from_api(event_id: str) -> Optional[dict]:
    """Fetch event details from Eventbrite API."""
    try:
        url = f"{API_BASE}events/{event_id}/"
        params = {"expand": "venue,organizer,category,format,ticket_availability"}
        
        response = requests.get(url, headers=get_api_headers(), params=params, timeout=15)
        
        if response.status_code == 404:
            logger.debug(f"Event {event_id} not found (may be private or ended)")
            return None
        elif response.status_code == 429:
            logger.warning("Rate limited, waiting 30 seconds...")
            time.sleep(30)
            return fetch_event_from_api(event_id)  # Retry once
        
        response.raise_for_status()
        return response.json()
        
    except Exception as e:
        logger.error(f"Error fetching event {event_id}: {e}")
        return None


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse Eventbrite datetime to date and time strings."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    except Exception:
        return None, None


def get_category(eventbrite_category: Optional[str]) -> tuple[str, list[str]]:
    """Map Eventbrite category to Lost City category and genre list."""
    if not eventbrite_category:
        return "other", []
    return CATEGORY_MAP.get(eventbrite_category, ("other", []))


def process_event(event_data: dict, source_id: int, producer_id: Optional[int]) -> Optional[dict]:
    """Process API event data into our format."""
    try:
        # Extract basic info
        title = event_data.get("name", {}).get("text", "").strip()
        if not title:
            return None

        # Skip past events
        start_info = event_data.get("start", {})
        start_date, start_time = parse_datetime(start_info.get("local"))
        if not start_date:
            return None
        
        if start_date < datetime.now().strftime("%Y-%m-%d"):
            return None

        description = event_data.get("description", {}).get("text", "")

        end_info = event_data.get("end", {})
        end_date, end_time = parse_datetime(end_info.get("local"))

        # Get venue info
        venue_data = event_data.get("venue") or {}
        venue_id = None
        venue_name = "TBA"

        if venue_data and venue_data.get("name"):
            venue_name = _normalize_eventbrite_venue_name(venue_data.get("name", ""))
            if not venue_name:
                venue_name = "TBA"
            address = venue_data.get("address", {})

            # Skip if not in Georgia
            region = address.get("region", "")
            if region and region not in ["GA", "Georgia"]:
                return None

            venue_record = {
                "name": venue_name,
                "slug": re.sub(r'[^a-z0-9-]', '', venue_name.lower().replace(" ", "-"))[:50],
                "address": address.get("address_1"),
                "city": address.get("city", "Atlanta"),
                "state": "GA",
                "zip": address.get("postal_code"),
                "venue_type": "event_space",
                "website": None,
            }
            venue_id = get_or_create_venue(venue_record)

        # Get category
        category_data = event_data.get("category") or {}
        category_name = category_data.get("name") if category_data else None
        category, genres = get_category(category_name)

        # Check if free
        is_free = event_data.get("is_free", False)

        # Get image
        logo = event_data.get("logo") or {}
        image_url = None
        if logo:
            original = logo.get("original") or {}
            image_url = original.get("url")

        # Get URL
        event_url = event_data.get("url", "")
        description = enrich_description_from_detail_page(description, event_url)

        # Generate content hash
        content_hash = generate_content_hash(title, venue_name, start_date)

        # Build tags — no source tags (they leak to UI)
        tags = [category]
        if is_free:
            tags.append("free")

        format_data = event_data.get("format") or {}
        format_name = format_data.get("short_name") if format_data else None
        if format_data.get("short_name"):
            tags.append(format_data.get("short_name").lower())

        # Get organizer info
        organizer = event_data.get("organizer") or {}
        organizer_name = organizer.get("name", "") if organizer else ""
        description = build_structured_eventbrite_description(
            title=title,
            base_description=description,
            event_url=event_url,
            venue_name=venue_name,
            venue_city=(venue_data or {}).get("address", {}).get("city", "Atlanta") if venue_data else "Atlanta",
            venue_state="GA",
            start_date=start_date,
            start_time=start_time,
            is_free=is_free,
            category_name=category_name,
            organizer_name=organizer_name,
            format_name=format_name,
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "producer_id": producer_id,
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
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            return {"status": "exists"}

        return event_record
    except Exception as e:
        logger.error(f"Error processing event: {e}")
        return None


def parse_event_for_pipeline(event_data: dict) -> dict | None:
    """Parse Eventbrite API event data into pipeline-compatible dict (no DB ops)."""
    try:
        title = event_data.get("name", {}).get("text", "").strip()
        if not title:
            return None

        start_info = event_data.get("start", {})
        start_date, start_time = parse_datetime(start_info.get("local"))
        if not start_date:
            return None

        if start_date < datetime.now().strftime("%Y-%m-%d"):
            return None

        description = event_data.get("description", {}).get("text", "")

        # Venue
        venue_data = event_data.get("venue") or {}
        venue_dict = None
        if venue_data and venue_data.get("name"):
            venue_name = _normalize_eventbrite_venue_name(venue_data["name"])
            if not venue_name:
                venue_name = "TBA"
            address = venue_data.get("address", {})
            region = address.get("region", "")
            if region and region not in ["GA", "Georgia"]:
                return None
            venue_dict = {
                "name": venue_name,
                "address": address.get("address_1"),
                "city": address.get("city", "Atlanta"),
                "state": "GA",
                "zip": address.get("postal_code"),
            }

        # Category
        category_data = event_data.get("category") or {}
        category_name = category_data.get("name") if category_data else None
        category, genres = get_category(category_name)

        # Image
        logo = event_data.get("logo") or {}
        image_url = None
        if logo:
            original = logo.get("original") or {}
            image_url = original.get("url")

        event_url = event_data.get("url", "")
        description = enrich_description_from_detail_page(description, event_url)
        organizer = event_data.get("organizer") or {}
        organizer_name = organizer.get("name", "") if organizer else ""
        format_data = event_data.get("format") or {}
        description = build_structured_eventbrite_description(
            title=title,
            base_description=description,
            event_url=event_url,
            venue_name=(venue_dict or {}).get("name", "TBA"),
            venue_city=(venue_dict or {}).get("city", "Atlanta"),
            venue_state=(venue_dict or {}).get("state", "GA"),
            start_date=start_date,
            start_time=start_time,
            is_free=bool(event_data.get("is_free", False)),
            category_name=category_name,
            organizer_name=organizer_name,
            format_name=(format_data or {}).get("short_name"),
        )

        return {
            "title": title[:500],
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": image_url,
            "category": category,
            "genres": genres,
            "price_min": None,
            "price_max": None,
            "venue": venue_dict,
        }
    except Exception as e:
        logger.error(f"Error parsing event for pipeline: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Hybrid crawl: discover via website, fetch via API."""
    source_id = source["id"]
    producer_id = source.get("producer_id")

    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Step 1: Discover event IDs from website
        logger.info("Step 1: Discovering events from Eventbrite website...")
        event_ids = discover_event_ids(max_events=500)
        
        if not event_ids:
            logger.warning("No event IDs discovered")
            return 0, 0, 0

        # Step 2: Fetch each event from API
        logger.info(f"Step 2: Fetching {len(event_ids)} events from API...")
        
        for i, event_id in enumerate(event_ids):
            if i > 0 and i % 50 == 0:
                logger.info(f"Progress: {i}/{len(event_ids)} events processed, {events_new} new")
            
            # Fetch from API
            event_data = fetch_event_from_api(event_id)
            if not event_data:
                continue
            
            events_found += 1
            
            # Process into our format
            result = process_event(event_data, source_id, producer_id)
            if not result:
                continue

            if result.get("status") == "exists":
                events_updated += 1
                continue

            # Insert
            try:
                insert_event(result)
                events_new += 1
                logger.debug(f"Added: {result['title'][:50]}... on {result['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert: {result['title'][:50]}: {e}")
            
            # Small delay to be nice to API
            time.sleep(0.2)

        logger.info(
            f"Eventbrite crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Eventbrite: {e}")
        raise

    return events_found, events_new, events_updated
