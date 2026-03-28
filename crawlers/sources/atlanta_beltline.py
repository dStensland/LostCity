"""
Crawler for Atlanta BeltLine (beltline.org/events).

The Atlanta BeltLine hosts community events including runs, art shows,
tours, and community gatherings. Site may use JavaScript rendering - using Playwright.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://beltline.org"
EVENTS_URL = f"{BASE_URL}/events/"

# Atlanta BeltLine HQ venue
BELTLINE_HQ = {
    "name": "Atlanta BeltLine",
    "slug": "atlanta-beltline",
    "address": "86 Pryor St SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "place_type": "nonprofit",
    "website": BASE_URL,
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "park",
            "commitment_tier": "halfday",
            "primary_activity": "family trail and park visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
            "best_time_of_day": "morning",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "practical_notes": (
                "The BeltLine's official visitor language centers trails, connected parks, public space, and family-friendly exploration across multiple neighborhoods."
            ),
            "fee_note": "Trail access, connected parks, and many public-space experiences are free; some classes, events, and rentals carry separate costs.",
            "source_url": f"{BASE_URL}/visit/",
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": BELTLINE_HQ.get("place_type"),
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "connected-trails-and-parks",
            "title": "Connected trails and parks",
            "feature_type": "amenity",
            "description": "The BeltLine connects trails, parks, and public space across dozens of Atlanta neighborhoods, making it a flexible free family outing option.",
            "url": f"{BASE_URL}/visit/",
            "price_note": "Walking the trails and using connected public spaces is free.",
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "free-public-art-and-explore-stops",
            "title": "Free public art and explore stops",
            "feature_type": "experience",
            "description": "BeltLine trails pair outdoor movement with free public art, neighborhood stops, and easy exploration for mixed-age family outings.",
            "url": f"{BASE_URL}/visit/",
            "price_note": "Public art and trail exploration are free; nearby attractions vary.",
            "is_free": True,
            "sort_order": 20,
        },
    )
    return envelope


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["run", "running", "5k", "10k", "marathon", "race", "bike", "cycling", "walk", "hike"]):
        return "outdoor"
    if any(word in text for word in ["art", "gallery", "exhibit", "mural", "artist", "sculpture"]):
        return "arts"
    if any(word in text for word in ["tour", "walk", "explore", "nature"]):
        return "outdoor"
    if any(word in text for word in ["workshop", "class", "training", "education"]):
        return "education"
    if any(word in text for word in ["volunteer", "cleanup", "planting", "community service"]):
        return "community"
    if any(word in text for word in ["festival", "celebration", "party"]):
        return "community"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    # Always add beltline tag
    tags.append("beltline")

    if any(word in text for word in ["outdoor", "outside", "nature"]):
        tags.append("outdoor")
    if any(word in text for word in ["run", "running", "5k", "10k", "race"]):
        tags.append("running")
    if any(word in text for word in ["art", "artist", "mural", "exhibit", "sculpture"]):
        tags.append("art")
    if any(word in text for word in ["community", "neighborhood"]):
        tags.append("community")
    if any(word in text for word in ["bike", "cycling", "bicycle"]):
        tags.append("cycling")
    if any(word in text for word in ["walk", "walking", "hike"]):
        tags.append("walking")
    if any(word in text for word in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")
    if any(word in text for word in ["volunteer", "volunteering"]):
        tags.append("volunteer")
    if any(word in text for word in ["tour", "guided"]):
        tags.append("tour")
    if any(word in text for word in ["park", "trail"]):
        tags.append("parks")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Most volunteer/community events are free
    if any(word in text for word in ["volunteer", "community cleanup", "planting"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "entry fee"]):
        return False

    # Many BeltLine events are free, but not all
    return True


def parse_date_from_text(text: str) -> Optional[str]:
    """Try to extract a date from text."""
    current_year = datetime.now().year

    # Try "Month DD, YYYY" or "Month DD"
    match = re.search(r'(\w+)\s+(\d{1,2})(?:,?\s+(\d{4}))?', text)
    if match:
        month_str, day, year = match.groups()
        year = year or str(current_year)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                if dt.date() < datetime.now().date():
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


def _resolve_card_event_date(
    month_abbr: str,
    day_text: str,
    *,
    now: Optional[date] = None,
) -> Optional[str]:
    """Resolve a BeltLine month/day card into the next plausible ISO date."""
    if not month_abbr or not day_text:
        return None

    today = now or datetime.now().date()
    try:
        month_num = datetime.strptime(month_abbr[:3].title(), "%b").month
        day_num = int(day_text)
        candidate = date(today.year, month_num, day_num)
        if candidate < today:
            candidate = date(today.year + 1, month_num, day_num)
        if (candidate - today).days > 270:
            return None
        return candidate.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta BeltLine events using Playwright.
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
            venue_id = get_or_create_place(BELTLINE_HQ)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            logger.info(f"Fetching Atlanta BeltLine events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            image_map = extract_images_from_page(page)
            event_links = extract_event_links(page, BASE_URL)

            link_nodes = page.query_selector_all("a[href*='/events/']")
            logger.info("Found %s event links", len(link_nodes))

            seen_hrefs: set[str] = set()
            for link in link_nodes:
                try:
                    href = link.get_attribute("href")
                    if not href or href in seen_hrefs or href.rstrip("/") == "/events":
                        continue
                    seen_hrefs.add(href)

                    text = link.inner_text().strip()
                    lines = [line.strip() for line in text.split("\n") if line.strip()]
                    if len(lines) < 4:
                        continue

                    month_abbr = lines[0][:3].upper()
                    day_text = lines[1]

                    title = None
                    time_text = None
                    for line in lines[2:]:
                        if re.search(r"\d{1,2}:\d{2}(AM|PM)", line, re.IGNORECASE):
                            time_text = line
                            continue
                        if line.isupper() or len(line) < 10:
                            continue
                        if line in {"IN-PERSON", "VIRTUAL"}:
                            continue
                        if not title:
                            title = line
                            break

                    if not title:
                        continue

                    event_date = _resolve_card_event_date(month_abbr, day_text)
                    if not event_date:
                        continue

                    start_time = parse_time_from_text(time_text or "")
                    source_url = f"{BASE_URL}{href}" if href.startswith("/") else href
                    if not source_url.startswith("http"):
                        source_url = find_event_url(title, event_links, EVENTS_URL) or EVENTS_URL

                    events_found += 1
                    category = determine_category(f"{title} {text}")
                    tags = extract_tags(title, text)
                    is_free = is_free_event(title, text)
                    content_hash = generate_content_hash(title, "Atlanta BeltLine", event_date)

                    card_image = None
                    try:
                        img_el = link.query_selector("img")
                        if img_el:
                            card_image = img_el.get_attribute("src") or img_el.get_attribute("data-src")
                            if card_image and card_image.startswith("/"):
                                card_image = f"{BASE_URL}{card_image}"
                    except Exception:
                        card_image = None

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": event_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": source_url,
                        "ticket_url": None,
                        "image_url": card_image or image_map.get(title),
                        "raw_text": text[:500],
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    enrich_event_record(event_record, source_name="Atlanta BeltLine")

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info("Added: %s on %s", title, event_date)
                    except Exception as e:
                        logger.error("Failed to insert: %s: %s", title, e)
                except Exception as exc:
                    logger.debug("Failed to parse BeltLine card: %s", exc)
                    continue

            browser.close()

        logger.info(
            f"Atlanta BeltLine crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Atlanta BeltLine: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Atlanta BeltLine: {e}")
        raise

    return events_found, events_new, events_updated
