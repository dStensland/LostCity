"""
Crawler for Fox Theatre (foxtheatre.org/events).
Atlanta's historic theater hosting Broadway shows, concerts, and special events.

Site uses JavaScript rendering - must use Playwright.
Format: DATE RANGE, CATEGORY, TITLE, "Buy Tickets", "Learn More"
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timezone
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, get_client, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.foxtheatre.org"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "Fox Theatre",
    "slug": "fox-theatre-atlanta",
    "address": "660 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7725,
    "lng": -84.3856,
    "place_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    # Box office: Mon–Fri 10am–6pm, Sat 10am–2pm, closed Sunday
    "hours": {
        "monday": "10:00-18:00",
        "tuesday": "10:00-18:00",
        "wednesday": "10:00-18:00",
        "thursday": "10:00-18:00",
        "friday": "10:00-18:00",
        "saturday": "10:00-14:00",
        "sunday": "closed",
    },
    "vibes": [
        "historic",
        "landmark",
        "broadway",
        "architecture",
        "Midtown",
        "performing-arts",
    ],
    # Fallback description — overridden at runtime by og:description if available
    "description": (
        "The Fox Theatre is Atlanta's premier performing arts venue, a National Historic Landmark "
        "and one of the most magnificent examples of Moorish-Egyptian architecture in the world. "
        "Home to Broadway in Atlanta, concerts, and special events since 1929."
    ),
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range like 'JAN 24 - 25, 2026' or 'FEB 28 - MAR 15, 2026'.
    Returns (start_date, end_date) tuple.
    """
    date_text = date_text.strip().upper()

    # Pattern: "JAN 24 - 25, 2026" (same month)
    match = re.match(r"([A-Z]{3})\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})", date_text)
    if match:
        month, start_day, end_day, year = match.groups()
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%b %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: "FEB 28 - MAR 15, 2026" (different months)
    match = re.match(r"([A-Z]{3})\s+(\d{1,2})\s*-\s*([A-Z]{3})\s+(\d{1,2}),?\s*(\d{4})", date_text)
    if match:
        start_month, start_day, end_month, end_day, year = match.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%b %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Single date "FEB 21, 2026"
    match = re.match(r"([A-Z]{3})\s+(\d{1,2}),?\s*(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "place_id": venue_id,
        "destination_type": "historic_theater",
        "commitment_tier": "halfday",
        "primary_activity": "Broadway shows, concerts, and performing arts in a National Historic Landmark",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day", "date-night"],
        "parking_type": "garage",
        "best_time_of_day": "evening",
        "practical_notes": (
            "Plan for the full evening — most shows run 2-3 hours. The North Avenue MARTA station "
            "is a short walk away, or use Fox-validated parking lots on Ponce de Leon Ave. "
            "Pre-show dining in Midtown is easy within a few blocks."
        ),
        "accessibility_notes": "Fully ADA accessible. Assistive listening devices available at the box office.",
        "family_suitability": "caution",
        "reservation_required": True,
        "permit_required": False,
        "fee_note": "Ticket prices vary by show. Building tours available separately.",
        "source_url": BASE_URL,
        "metadata": {"source_type": "venue_enrichment", "place_type": "theater", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "moorish-egyptian-architecture",
        "title": "Moorish-Egyptian architecture",
        "feature_type": "attraction",
        "description": "A National Historic Landmark and one of the most magnificent examples of Moorish-Egyptian architecture in the world, built in 1929.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "behind-the-scenes-tours",
        "title": "Behind-the-scenes tours",
        "feature_type": "experience",
        "description": "60-minute guided tours exploring the Fox Theatre's history, architecture, and backstage areas.",
        "url": f"{BASE_URL}/tours",
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "egyptian-ballroom-grand-salon",
        "title": "Egyptian Ballroom and Grand Salon",
        "feature_type": "amenity",
        "description": "Historic event spaces available for private events, adding to the building's versatility beyond performances.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "marquee-club-vip",
        "title": "Marquee Club VIP experience",
        "feature_type": "amenity",
        "description": "Premium VIP lounge with exclusive access, craft cocktails, and pre-show dining for select performances.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 40,
    })
    return envelope


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fox Theatre events using Playwright."""
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

            # ----------------------------------------------------------------
            # 0. Homepage — extract og:image / og:description for venue record
            # ----------------------------------------------------------------
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                og_image = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:image\"]'); return m ? m.content : null; }"
                )
                og_desc = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:description\"]') "
                    "|| document.querySelector('meta[name=\"description\"]'); return m ? m.content : null; }"
                )
                if og_image:
                    PLACE_DATA["image_url"] = og_image
                    logger.debug("Fox Theatre: og:image = %s", og_image)
                if og_desc:
                    PLACE_DATA["description"] = og_desc
                    logger.debug("Fox Theatre: og:description captured")
            except Exception as _meta_exc:
                logger.debug("Fox Theatre: could not extract og meta from homepage: %s", _meta_exc)

            venue_id = get_or_create_place(PLACE_DATA)

            # Persist any og: enrichment to the venue record
            try:
                venue_update: dict = {}
                if PLACE_DATA.get("image_url"):
                    venue_update["image_url"] = PLACE_DATA["image_url"]
                if PLACE_DATA.get("description"):
                    venue_update["description"] = PLACE_DATA["description"]
                if venue_update:
                    get_client().table("places").update(venue_update).eq("id", venue_id).execute()
                    logger.info("Fox Theatre: enriched venue record from homepage og: metadata")
            except Exception as _upd_exc:
                logger.warning("Fox Theatre: venue update failed: %s", _upd_exc)

            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            logger.info(f"Fetching Fox Theatre: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract per-event ticket status from DOM badges before body text parsing.
            # The listing page renders "SOLD OUT" and "On Sale [date]" badges alongside
            # each event card. We capture them here keyed by lowercased title so the
            # body-text parsing loop can apply them without touching skip_items.
            ticket_status_map: dict[str, str] = {}
            on_sale_date_map: dict[str, str] = {}
            try:
                raw_status_entries = page.evaluate("""
                    () => {
                        const results = [];
                        // Fox Theatre event cards have a common ancestor containing the
                        // title link and a status badge. Walk every card-like container.
                        document.querySelectorAll('[class*="event"], [class*="show"], article, li').forEach(card => {
                            const titleEl = card.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');
                            if (!titleEl) return;
                            const title = titleEl.textContent.trim();
                            if (!title || title.length < 3) return;
                            const cardText = card.textContent || '';
                            let status = null;
                            let onSaleDate = null;
                            if (/sold\\s*out/i.test(cardText)) {
                                status = 'sold-out';
                            } else {
                                const onSaleMatch = cardText.match(/on\\s+sale\\s+([A-Za-z]+\\s+\\d{1,2}(?:,?\\s*\\d{4})?)/i);
                                if (onSaleMatch) {
                                    status = 'tickets-available';
                                    onSaleDate = onSaleMatch[1].trim();
                                }
                            }
                            if (status) {
                                results.push({title: title.toLowerCase(), status, onSaleDate});
                            }
                        });
                        return results;
                    }
                """)
                for entry in (raw_status_entries or []):
                    key = entry.get("title", "").lower()
                    if key and entry.get("status"):
                        ticket_status_map[key] = entry["status"]
                    if key and entry.get("onSaleDate"):
                        on_sale_date_map[key] = entry["onSaleDate"]
            except Exception as _ts_exc:
                logger.debug("Fox Theatre: ticket status DOM extraction failed: %s", _ts_exc)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = ["skip to content", "accessibility", "buy tickets", "search",
                         "my account", "e-club", "donate", "english", "fox theatre",
                         "tickets", "visit us", "private events", "premium experiences",
                         "community partnerships", "about us", "upcoming events",
                         "category", "tours", "learn more"]

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip nav/UI items
                if line.lower() in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date pattern at start of line
                # Format: "JAN 24 - 25, 2026" or "FEB 21, 2026"
                date_match = re.match(
                    r"([A-Z]{3})\s+(\d{1,2})(?:\s*-\s*(?:[A-Z]{3}\s+)?(\d{1,2}))?,?\s*(\d{4})",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    # Found a date line
                    start_date, end_date = parse_date_range(line)

                    if not start_date:
                        i += 1
                        continue

                    # Look ahead for category and title
                    category_line = None
                    title = None

                    # Next line might be category (REGIONS BANK BROADWAY IN ATLANTA)
                    if i + 1 < len(lines):
                        next_line = lines[i + 1]
                        if "broadway" in next_line.lower() or next_line.isupper():
                            category_line = next_line
                            # Title should be line after that
                            if i + 2 < len(lines):
                                title = lines[i + 2]
                                i += 2
                        else:
                            # No category line, next line is title
                            title = next_line
                            i += 1

                    if not title:
                        i += 1
                        continue

                    # Skip if title is "Buy Tickets" or similar
                    if title.lower() in ["buy tickets", "learn more", "sold out"]:
                        i += 1
                        continue

                    # Check for duplicates
                    # Keep per-listing instances; downstream hash handles true dedupe.
                    event_key = f"{title}|{start_date}|{i}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Provisional hash; recomputed after enrichment if start_time is recovered.
                    content_hash = generate_content_hash(title, "Fox Theatre", start_date)

                    # Check for existing

                    # Determine category based on content
                    event_category = "theater"
                    subcategory = None
                    tags = ["fox-theatre", "midtown"]

                    title_lower = title.lower()
                    if category_line and "broadway" in category_line.lower():
                        subcategory = "broadway"
                        tags.append("broadway")
                    elif any(w in title_lower for w in ["musical", "hamilton", "wicked", "phantom"]):
                        subcategory = "musical"
                        tags.append("broadway")
                    elif any(w in title_lower for w in ["concert", "tour", "live", "band"]):
                        event_category = "music"
                        subcategory = "concert"
                        tags.append("concert")
                    elif any(w in title_lower for w in ["comedy", "comedian", "stand-up"]):
                        event_category = "comedy"
                        tags.append("comedy")
                    elif any(w in title_lower for w in ["dance", "ballet", "riverdance", "ailey"]):
                        subcategory = "dance"
                        tags.append("dance")

                    # Get specific event URL
                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    image_url = image_map.get(title)

                    # Build series_hint for multi-night shows
                    series_hint = None
                    if end_date is not None:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                            "description": category_line,
                        }
                        if image_url:
                            series_hint["image_url"] = image_url

                    # Look up ticket status from DOM extraction
                    title_key = title.lower()
                    dom_ticket_status = ticket_status_map.get(title_key)
                    dom_on_sale_date = on_sale_date_map.get(title_key)

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": category_line,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": event_category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": None,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{line} {title}",
                        "extraction_confidence": 0.90,
                        "is_recurring": end_date is not None,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    if dom_ticket_status:
                        event_record["ticket_status"] = dom_ticket_status
                        event_record["ticket_status_checked_at"] = datetime.now(timezone.utc).isoformat()
                    if dom_on_sale_date:
                        event_record["on_sale_date"] = dom_on_sale_date

                    # Enrich from detail page
                    enrich_event_record(event_record, source_name="Fox Theatre")

                    # Determine is_free if still unknown after enrichment
                    if event_record.get("is_free") is None:
                        desc_lower = (event_record.get("description") or "").lower()
                        title_lower = event_record.get("title", "").lower()
                        combined = f"{title_lower} {desc_lower}"
                        if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                            event_record["is_free"] = True
                            event_record["price_min"] = event_record.get("price_min") or 0
                            event_record["price_max"] = event_record.get("price_max") or 0
                        else:
                            event_record["is_free"] = False

                    event_start_time = event_record.get("start_time")
                    hash_key = f"{start_date}|{event_start_time}" if event_start_time else start_date
                    content_hash = generate_content_hash(title, "Fox Theatre", hash_key)
                    event_record["content_hash"] = content_hash

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Fox Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Fox Theatre: {e}")
        raise

    return events_found, events_new, events_updated
