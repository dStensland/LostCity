"""
Crawler for Fox Theatre (foxtheatre.org/events).
Atlanta's historic theater hosting Broadway shows, concerts, and special events.

Site uses JavaScript rendering — must use Playwright.
Event cards use class="eventItem" with structured date elements and "Load More"
pagination triggered by a button with id="loadMoreEvents".
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timezone
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import get_or_create_place, get_client, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import enrich_event_record
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

# Fox site category class → our category/subcategory
CATEGORY_MAP = {
    "broadway": ("theater", "broadway"),
    "concerts": ("music", "concert"),
    "comedy": ("comedy", None),
    "special_engagements": ("theater", "special_engagement"),
    "holiday": ("theater", "holiday"),
    "family": ("family", None),
}

# Month abbreviations the Fox site uses (full names like "June" in addition to abbrevs)
MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "june": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10",
    "nov": "11", "dec": "12",
}


def _parse_fox_date(month_text: str, day_text: str, year_text: str) -> Optional[str]:
    """
    Parse a date from Fox Theatre's DOM elements.
    month_text: "Apr", "May", "June"
    day_text:   "10", "3"
    year_text:  ", 2026"  (leading comma/space stripped)
    Returns YYYY-MM-DD or None.
    """
    month_key = month_text.strip().lower()[:4].rstrip("e")  # "june" → "jun"
    month_num = MONTH_MAP.get(month_key) or MONTH_MAP.get(month_text.strip().lower()[:3])
    if not month_num:
        return None
    year_str = re.sub(r"[^0-9]", "", year_text)
    day_str = day_text.strip().zfill(2)
    if not year_str or not day_str:
        return None
    return f"{year_str}-{month_num}-{day_str}"


def _parse_event_item(item: "BeautifulSoup") -> Optional[dict]:
    """
    Parse a single eventItem div into a raw event dict.
    Returns None if required fields are missing.
    """
    # --- Title ---
    h3 = item.find("h3")
    if not h3:
        return None
    title = h3.get_text(strip=True)
    if not title or len(title) < 3:
        return None

    # --- URL ---
    detail_link = item.find("a", href=lambda h: h and "/events/detail/" in h)
    event_url = detail_link["href"] if detail_link else EVENTS_URL
    if event_url and not event_url.startswith("http"):
        event_url = BASE_URL + event_url

    # --- Date parsing ---
    # The DOM splits dates across: m-date__month, m-date__day (one or two), m-date__year
    month_el = item.find(class_="m-date__month")
    year_el = item.find(class_="m-date__year")
    day_els = item.find_all(class_="m-date__day")

    if not month_el or not year_el or not day_els:
        # Fallback: try the raw date element text e.g. "Apr10-12, 2026"
        date_el = item.find(class_="date")
        if not date_el:
            return None
        raw = date_el.get_text(strip=True)
        # Try to parse "Apr10-12, 2026" or "May5, 2026"
        m = re.match(
            r"([A-Za-z]+)(\d{1,2})(?:-([A-Za-z]*)(\d{1,2}))?,?\s*(\d{4})", raw
        )
        if not m:
            return None
        start_month, start_day, end_month_str, end_day, year_str = m.groups()
        start_date = _parse_fox_date(start_month, start_day, year_str)
        if not start_date:
            return None
        if end_day:
            end_month_for_parse = end_month_str if end_month_str else start_month
            end_date = _parse_fox_date(end_month_for_parse, end_day, year_str)
        else:
            end_date = None
    else:
        month_text = month_el.get_text(strip=True)
        year_text = year_el.get_text(strip=True)

        # Determine if this is a range (two m-date__day elements) or single
        # For cross-month ranges, the second date block has its own m-date__month
        if len(day_els) == 2:
            # Check if there's a second month element (cross-month range)
            range_last = item.find(class_="m-date__rangeLast")
            second_month_el = range_last.find(class_="m-date__month") if range_last else None
            end_month_text = second_month_el.get_text(strip=True) if second_month_el else month_text

            start_date = _parse_fox_date(month_text, day_els[0].get_text(strip=True), year_text)
            end_date = _parse_fox_date(end_month_text, day_els[1].get_text(strip=True), year_text)
        else:
            start_date = _parse_fox_date(month_text, day_els[0].get_text(strip=True), year_text)
            end_date = None

    if not start_date:
        return None

    # --- Category from CSS classes ---
    item_classes = item.get("class", [])
    category = "theater"
    subcategory = None
    for cls in item_classes:
        if cls in CATEGORY_MAP:
            category, subcategory = CATEGORY_MAP[cls]
            break

    tags = ["fox-theatre", "midtown"]
    if subcategory:
        tags.append(subcategory)
    elif category != "theater":
        tags.append(category)

    # --- Category label (e.g. "Regions Bank Broadway in Atlanta") ---
    cat_label_el = item.find(class_="category")
    category_label = cat_label_el.get_text(strip=True) if cat_label_el else None

    # --- Subtitle / supporting act ---
    subtitle_el = item.find("h4") or item.find(class_="subtitle") or item.find("p", class_="m-eventList__subtitle")
    subtitle = subtitle_el.get_text(strip=True) if subtitle_el else None

    # Build description from category label + subtitle
    desc_parts = [p for p in [category_label, subtitle] if p]
    description = " — ".join(desc_parts) if desc_parts else None

    return {
        "title": title,
        "start_date": start_date,
        "end_date": end_date,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "description": description,
        "event_url": event_url,
    }


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
    # Main Auditorium
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "fox-main-auditorium",
        "title": "Main Auditorium",
        "feature_type": "attraction",
        "admission_type": "ticketed",
        "description": (
            "The 4,665-seat Moorish/Egyptian Revival main theater, one of Atlanta's most iconic "
            "performance spaces. Hosts Broadway in Atlanta, major concerts, and headline events "
            "under its famous night-sky ceiling with twinkling stars and a cloud projection system."
        ),
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 10,
        "image_url": "https://www.foxtheatre.org/assets/img/JonathanPhillipsPhotography_InteriorLeftVomCurtains-1-696d41ed67.jpg",
        "image_source": "crawler",
    })
    # Egyptian Ballroom
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "fox-egyptian-ballroom",
        "title": "The Egyptian Ballroom",
        "feature_type": "attraction",
        "admission_type": "ticketed",
        "description": (
            "An ornate event space decorated in authentic Egyptian Revival style, used for "
            "smaller performances, standing-room concerts, private events, and receptions. "
            "Seats up to 700 in theater configuration."
        ),
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 20,
        "image_url": "https://www.foxtheatre.org/assets/img/Mezzanine-Lobby_Oasis-Court_H-f336669730.jpg",
        "image_source": "crawler",
    })
    # Historic Architecture
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "fox-historic-architecture",
        "title": "Historic Architecture",
        "feature_type": "attraction",
        "admission_type": "included",
        "description": (
            "1929 movie palace featuring Moorish and Egyptian Revival design: a night-sky ceiling "
            "with 96 twinkling stars and cloud projections, ornate minarets, hand-painted murals, "
            "and a courtyard-style lobby. A National Historic Landmark and one of the most "
            "visually spectacular buildings in the American South."
        ),
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 30,
        "image_url": "https://www.foxtheatre.org/assets/img/default-image-11feedde8d.png",
        "image_source": "og_image",
    })
    # Behind-the-scenes tours
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "behind-the-scenes-tours",
        "title": "Behind-the-Scenes Tours",
        "feature_type": "experience",
        "admission_type": "ticketed",
        "description": "60-minute guided tours exploring the Fox Theatre's history, architecture, and backstage areas.",
        "url": f"{BASE_URL}/tours",
        "is_free": False,
        "sort_order": 40,
        "image_url": "https://www.foxtheatre.org/assets/img/Fox-Ushers_Historic-0d478cfbe4.jpg",
        "image_source": "crawler",
    })
    # Marquee Club VIP
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "marquee-club-vip",
        "title": "Marquee Club VIP Experience",
        "feature_type": "amenity",
        "admission_type": "ticketed",
        "description": "Premium VIP lounge with exclusive access, craft cocktails, and pre-show dining for select performances.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 50,
        "image_url": "https://www.foxtheatre.org/assets/img/FOXATL2018_0210_045429-8324_ALIVECOVERAGE-245e9b3c4b.jpg",
        "image_source": "crawler",
    })
    return envelope


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fox Theatre events using Playwright with Load More pagination."""
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

            # Persist og: enrichment to the venue record
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

            # ----------------------------------------------------------------
            # 1. Events page — load all events via "Load More" clicks
            # ----------------------------------------------------------------
            logger.info("Fox Theatre: fetching %s", EVENTS_URL)
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Click "Load More" until the button disappears or we hit a cap
            load_more_clicks = 0
            max_clicks = 20  # safety cap (~240 events at 12/click)
            while load_more_clicks < max_clicks:
                try:
                    btn = page.query_selector("#loadMoreEvents")
                    if not btn or not btn.is_visible():
                        logger.debug("Fox Theatre: Load More button gone after %d clicks", load_more_clicks)
                        break
                    btn.scroll_into_view_if_needed()
                    btn.click()
                    page.wait_for_timeout(1500)
                    load_more_clicks += 1
                    logger.debug("Fox Theatre: Load More click #%d", load_more_clicks)
                except PlaywrightTimeoutError:
                    logger.debug("Fox Theatre: Load More timeout, stopping pagination")
                    break
                except Exception as _lm_exc:
                    logger.debug("Fox Theatre: Load More error: %s", _lm_exc)
                    break

            logger.info("Fox Theatre: %d Load More clicks performed", load_more_clicks)

            # ----------------------------------------------------------------
            # 2. Parse all eventItem cards from the fully-loaded page
            # ----------------------------------------------------------------
            html = page.content()
            browser.close()

        soup = BeautifulSoup(html, "html.parser")
        items = soup.find_all(class_="eventItem")
        logger.info("Fox Theatre: found %d eventItem elements", len(items))

        seen_events: set[str] = set()

        for item in items:
            parsed = _parse_event_item(item)
            if not parsed:
                continue

            title = parsed["title"]
            start_date = parsed["start_date"]
            end_date = parsed["end_date"]
            event_url = parsed["event_url"]

            # Dedup within this crawl run (same title + date)
            dedup_key = f"{title}|{start_date}"
            if dedup_key in seen_events:
                continue
            seen_events.add(dedup_key)

            events_found += 1

            # Build series_hint for multi-night runs
            series_hint = None
            if end_date is not None:
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "description": parsed.get("description"),
                }

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": parsed.get("description"),
                "start_date": start_date,
                "start_time": None,
                "end_date": end_date,
                "end_time": None,
                "is_all_day": False,
                "category": parsed["category"],
                "subcategory": parsed.get("subcategory"),
                "tags": parsed["tags"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": None,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": None,
                "raw_text": f"{start_date} {title}",
                "extraction_confidence": 0.92,
                "is_recurring": end_date is not None,
                "recurrence_rule": None,
            }

            # Enrich from detail page (picks up start_time, image_url, description, etc.)
            enrich_event_record(event_record, source_name="Fox Theatre")

            # Resolve is_free if still unknown after enrichment
            if event_record.get("is_free") is None:
                combined = f"{(event_record.get('title') or '')} {(event_record.get('description') or '')}".lower()
                if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                    event_record["is_free"] = True
                    event_record.setdefault("price_min", 0)
                    event_record.setdefault("price_max", 0)
                else:
                    event_record["is_free"] = False

            # Recompute hash after enrichment (may have resolved start_time)
            event_start_time = event_record.get("start_time")
            hash_key = f"{start_date}|{event_start_time}" if event_start_time else start_date
            content_hash = generate_content_hash(title, "Fox Theatre", hash_key)
            event_record["content_hash"] = content_hash

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info("Fox Theatre: added '%s' on %s", title, start_date)
            except Exception as insert_exc:
                logger.error("Fox Theatre: failed to insert '%s': %s", title, insert_exc)

        logger.info(
            "Fox Theatre crawl complete: %d found, %d new, %d updated",
            events_found, events_new, events_updated,
        )

    except Exception as e:
        logger.error("Fox Theatre: crawl failed: %s", e)
        raise

    return events_found, events_new, events_updated
