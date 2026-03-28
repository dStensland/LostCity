"""
Crawler for College Football Hall of Fame (cfbhall.com).

Site uses JavaScript rendering - must use Playwright.
Events are on /happenings/ page, not /events.
"""

from __future__ import annotations

from calendar import monthrange
import re
import logging
from datetime import datetime, date
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

BASE_URL = "https://www.cfbhall.com"
HAPPENINGS_URL = f"{BASE_URL}/happenings/"

PLACE_DATA = {
    "name": "College Football Hall of Fame",
    "slug": "college-football-hall-of-fame",
    "address": "250 Marietta St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7609,
    "lng": -84.3935,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # description and image_url are extracted dynamically from og: tags on the homepage
    # at crawl time — see _enrich_venue_data() called before get_or_create_place().
    # Hours verified 2026-03-11: Sun-Fri 10am-5pm, Sat 9am-5pm
    "hours": {
        "monday": "10:00-17:00",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-17:00",
        "saturday": "09:00-17:00",
        "sunday": "10:00-17:00",
    },
    "vibes": ["sports", "interactive", "family-friendly", "educational", "downtown"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "sports_museum",
            "commitment_tier": "halfday",
            "primary_activity": "interactive football history visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "garage",
            "best_time_of_day": "morning",
            "practical_notes": (
                "The Hall of Fame works best as a planned downtown family anchor for school-age kids who "
                "want an interactive sports stop. It is easier to pair with other downtown attractions than "
                "to treat as a quick errand stop."
            ),
            "accessibility_notes": (
                "Indoor exhibits and elevator-served circulation make this a lower-friction sports-history stop "
                "than an outdoor stadium visit, but it still plays best for families ready for a purposeful museum-style outing."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "General admission applies; check the Hall of Fame for current ticket pricing and exhibit access.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "interactive-football-history-galleries",
            "title": "Interactive football history galleries",
            "feature_type": "amenity",
            "description": "The Hall of Fame blends football history with interactive exhibits that make it a stronger family stop than a static trophy museum.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "downtown-sports-history-anchor",
            "title": "Downtown sports history anchor",
            "feature_type": "experience",
            "description": "This is one of the city's clearest school-age downtown sports anchors when families want a purposeful indoor plan built around football.",
            "url": HAPPENINGS_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    return envelope

def _enrich_venue_data(page) -> None:
    """
    Fetch og:description and og:image from the CFB Hall of Fame homepage and inject
    them into PLACE_DATA so get_or_create_place() stores them on first creation.
    Only fills fields that are not already set.
    """
    try:
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(1500)
        og_desc = page.get_attribute('meta[property="og:description"]', "content")
        og_image = page.get_attribute('meta[property="og:image"]', "content")
        if og_desc and not PLACE_DATA.get("description"):
            PLACE_DATA["description"] = re.sub(r"\s+", " ", og_desc).strip()
        if og_image and not PLACE_DATA.get("image_url"):
            PLACE_DATA["image_url"] = og_image.strip()
    except Exception as exc:
        logger.debug("CFB Hall of Fame homepage og: fetch failed: %s", exc)


SKIP_TITLE_PATTERNS = (
    "follow the college football hall of fame",
    "exclusive chick-fil-a member benefits",
)


def _current_year() -> int:
    return datetime.now().year


def _month_end(year: int, month: int) -> str:
    return date(year, month, monthrange(year, month)[1]).strftime("%Y-%m-%d")


def _month_start(year: int, month: int) -> str:
    return date(year, month, 1).strftime("%Y-%m-%d")


def _mid_month(year: int, month: int) -> str:
    return date(year, month, 15).strftime("%Y-%m-%d")


def infer_ongoing_range(detail_text: str, page_status: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Infer a conservative ongoing exhibit range from detail copy.

    Returns (start_date, end_date, content_kind).
    """
    text = detail_text.lower()
    year = _current_year()
    today = datetime.now().strftime("%Y-%m-%d")
    current_month = datetime.now().month

    if "throughout march" in text:
        start = today if current_month == 3 else _month_start(year, 3)
        return start, _month_end(year, 3), "exhibit"

    if "through early april" in text:
        return today, _mid_month(year, 4), "exhibit"

    if "through early summer" in text:
        return today, _mid_month(year, 6), "exhibit"

    if page_status.lower() in {"now open", "now available"}:
        return today, None, "exhibit"

    return None, None, None


def extract_detail_text(page) -> str:
    body = page.locator("body").inner_text()
    return re.sub(r"\s+", " ", body).strip()


def should_skip_page(title: str, page_status: str, detail_text: str) -> bool:
    combined = f"{title} {page_status} {detail_text}".lower()

    if any(pattern in combined for pattern in SKIP_TITLE_PATTERNS):
        return True

    if "apply by" in combined or "scholarship" in combined:
        return True

    if "guided tours now available" in combined:
        return True

    return False


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date ranges like:
    - "Saturday, February 28 - Sunday, March 1"
    - "Now Open"

    Returns (start_date, end_date) or (None, None) if unparseable.
    """
    # Handle ongoing exhibitions
    if "now open" in date_text.lower() or "follow" in date_text.lower() or "now available" in date_text.lower():
        return None, None

    # Try to parse date range like "Saturday, February 28 - Sunday, March 1"
    # Pattern: Day, Month DD - Day, Month DD
    range_match = re.search(
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
        r'(\d{1,2})\s*-\s*'
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
        r'(\d{1,2})',
        date_text,
        re.IGNORECASE
    )

    if range_match:
        start_month, start_day, end_month, end_day = range_match.groups()
        current_year = datetime.now().year

        try:
            # Parse start date
            start_dt = datetime.strptime(f"{start_month} {start_day} {current_year}", "%B %d %Y")
            # If start date is in the past, assume next year
            if start_dt.date() < datetime.now().date():
                start_dt = datetime.strptime(f"{start_month} {start_day} {current_year + 1}", "%B %d %Y")

            # Parse end date
            end_year = start_dt.year
            # Handle year rollover (e.g., Dec 31 - Jan 1)
            end_dt = datetime.strptime(f"{end_month} {end_day} {end_year}", "%B %d %Y")
            if end_dt < start_dt:
                end_dt = datetime.strptime(f"{end_month} {end_day} {end_year + 1}", "%B %d %Y")

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try single date format
    single_match = re.search(
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
        r'(\d{1,2})(?:,?\s+(\d{4}))?',
        date_text,
        re.IGNORECASE
    )

    if single_match:
        month, day, year = single_match.groups()
        year = year or str(datetime.now().year)

        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month} {day} {int(year) + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl College Football Hall of Fame events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            _enrich_venue_data(page)
            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))
            exhibition_envelope = TypedEntityEnvelope()

            logger.info(f"Fetching College Football Hall of Fame: {HAPPENINGS_URL}")
            page.goto(HAPPENINGS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event cards - they have class "event card-zoom"
            event_cards = page.query_selector_all('.event.card-zoom')

            logger.info(f"Found {len(event_cards)} event cards")

            for card in event_cards:
                try:
                    # Get the event URL from the link inside the card
                    link_elem = card.query_selector('a[href*="/happenings/"]')
                    if not link_elem:
                        continue

                    event_url = link_elem.get_attribute("href")
                    if not event_url or event_url == "/happenings/":
                        continue

                    if not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    # Get title from h2
                    title_elem = card.query_selector("h2")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    if not title or len(title) < 5:
                        continue

                    # Skip navigation items
                    if title.lower() in ["happenings", "news", "blog", "events and happenings"]:
                        continue

                    # Get status/date signal from listing card
                    date_elem = card.query_selector(".happening-date, .happenings-date")
                    date_text = ""
                    if date_elem:
                        date_text = date_elem.inner_text().strip()

                    # Visit detail page because the listing status field is now often
                    # sponsor or status text rather than a literal date.
                    detail_page = context.new_page()
                    detail_page.goto(event_url, wait_until="domcontentloaded", timeout=45000)
                    detail_page.wait_for_timeout(2000)

                    detail_text = extract_detail_text(detail_page)
                    if should_skip_page(title, date_text, detail_text):
                        logger.info(f"Skipping '{title}' - non-event utility/promotional page")
                        detail_page.close()
                        continue

                    # Parse explicit date first; if unavailable, infer ongoing range
                    # for exhibit-style pages with enough detail signal.
                    start_date, end_date = parse_date_range(date_text)
                    content_kind = "event"
                    if not start_date:
                        start_date, end_date, inferred_kind = infer_ongoing_range(detail_text, date_text)
                        if inferred_kind:
                            content_kind = inferred_kind

                    if not start_date:
                        logger.info(f"Skipping '{title}' - no parseable date (text: '{date_text}')")
                        detail_page.close()
                        continue

                    # Get description from the detail page content.
                    description = "Event at College Football Hall of Fame"
                    for selector in ("main p", ".content p", ".entry-content p", "article p"):
                        p_tags = detail_page.query_selector_all(selector)
                        for p_tag in p_tags:
                            desc_text = p_tag.inner_text().strip()
                            if len(desc_text) > 40:
                                description = desc_text[:500]
                                break
                        if description != "Event at College Football Hall of Fame":
                            break

                    # Get image URL
                    image_url = None
                    img_elem = detail_page.query_selector("main img, article img, .hero img, img")
                    if img_elem:
                        image_url = img_elem.get_attribute("src")
                        if image_url and not image_url.startswith("http"):
                            if image_url.startswith("//"):
                                image_url = "https:" + image_url
                            elif image_url.startswith("/"):
                                image_url = BASE_URL + image_url

                    detail_page.close()

                    events_found += 1

                    # Route exhibitions to the exhibitions table, not events
                    if content_kind == "exhibit":
                        ex_record, _ = build_exhibition_record(
                            title=title,
                            venue_id=venue_id,
                            source_id=source_id,
                            opening_date=start_date,
                            closing_date=end_date,
                            venue_name="College Football Hall of Fame",
                            description=description,
                            image_url=image_url,
                            source_url=event_url,
                            admission_type="ticketed",
                            tags=["college-football", "hall-of-fame", "exhibition", "downtown", "sports"],
                        )
                        exhibition_envelope.add("exhibitions", ex_record)
                        events_new += 1
                        logger.info(f"Exhibition routed: {title} ({start_date} → {end_date})")
                        continue

                    content_hash = generate_content_hash(title, "College Football Hall of Fame", start_date)

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": None,  # No specific times on the happenings page
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": True,
                        "content_kind": "event",
                        "category": "museums",
                        "subcategory": None,
                        "tags": [
                            "college-football",
                            "hall-of-fame",
                            "football",
                            "downtown",
                            "sports",
                        ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_text} - {detail_text[:500]}",
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        logger.info(f"Event updated: {title}")
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}" + (f" - {end_date}" if end_date else ""))
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event card: {e}")
                    continue

            if exhibition_envelope.exhibitions:
                persist_typed_entity_envelope(exhibition_envelope)

            browser.close()

        logger.info(
            f"College Football Hall of Fame crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl College Football Hall of Fame: {e}")
        raise

    return events_found, events_new, events_updated
