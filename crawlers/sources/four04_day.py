"""
Crawler for 404 Day (404day.com).

404 Day is Atlanta's annual free outdoor music and culture festival held
every April 4th in Piedmont Park. 2026 marks the 15th annual event.

The site publishes event listings via schema.org JSON-LD on every page, and
a /events page with individual event cards. We parse both the JSON-LD for
structured date/offer data and the HTML cards for descriptions and images.

Two distinct events are crawled:
  1. 404 Day (main festival at Piedmont Park) — free, all-day.
  2. 404 Day: Old Atlanta vs. New Atlanta (separate ticketed event at
     Stankonia Studios) — ticketed, evening concert, different venue.

Both are grouped under a "festival_program" series so the feed shows the
parent context without duplicating content.
"""

from __future__ import annotations

import json
import logging
import re
from html import unescape
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://404day.com"
EVENTS_URL = f"{BASE_URL}/events"
TICKETS_URL = f"{BASE_URL}/tickets"
OG_IMAGE = f"{BASE_URL}/404day-atlanta-music-festival-flyer.jpg"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

# Piedmont Park — shared venue with the existing piedmont_park crawler;
# using the same slug so get_or_create_place returns the existing record.
PIEDMONT_PARK_VENUE = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "400 Park Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7873,
    "lng": -84.3733,
    "venue_type": "park",
    "spot_type": "outdoor",
    "website": "https://piedmontpark.org",
}

# Stankonia Studios — venue for the hip-hop culture night event.
STANKONIA_VENUE = {
    "name": "Stankonia Studios",
    "slug": "stankonia-studios",
    "address": "Atlanta, GA",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "",
    "lat": None,
    "lng": None,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
}

SERIES_HINT = {
    "series_type": "festival_program",
    "series_title": "404 Day 2026",
    "frequency": "irregular",
}


def _fetch_html(url: str) -> str:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    return response.text


def _load_jsonld_objects(html: str) -> list[dict]:
    """Extract all schema.org JSON-LD objects from a page."""
    soup = BeautifulSoup(html, "html.parser")
    objects: list[dict] = []

    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if isinstance(data, dict):
            objects.append(data)
        elif isinstance(data, list):
            objects.extend(item for item in data if isinstance(item, dict))

    return objects


def _find_event_jsonld(html: str) -> Optional[dict]:
    """Return the first schema.org Event object from the page, if any."""
    for obj in _load_jsonld_objects(html):
        if obj.get("@type") == "Event":
            return obj
    return None


def _extract_sanity_image_from_src(src: str) -> Optional[str]:
    """
    The site serves images via Next.js image optimisation with Sanity CDN URLs
    encoded as query parameters. Extract the original Sanity CDN URL.

    Example proxied src:
      /_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2F...%2Fimage.jpg%3Fw%3D600&w=3840&q=75

    The "cdn.sanity.io" substring appears inside the URL-encoded query parameter,
    so we must check for the Next.js proxy pattern first.
    """
    from urllib.parse import unquote

    if not src:
        return None
    # Check for Next.js image proxy — the Sanity URL is URL-encoded in the query.
    if "_next/image" in src and "url=" in src:
        match = re.search(r"url=([^&]+)", src)
        if match:
            raw = unquote(match.group(1))
            # Strip Sanity size params to get the original asset URL.
            return raw.split("?")[0]
    # Direct Sanity CDN URL (not proxied).
    if "cdn.sanity.io" in src:
        return src.split("?")[0]
    return None


def _parse_event_cards(html: str) -> list[dict]:
    """
    Parse the /events page HTML cards.

    Real card structure (Next.js app, Sanity CMS):
      <button class="card overflow-hidden !p-0 text-left ...">
        <div class="aspect-video ..."><img ... srcset="..." /></div>
        <div class="p-4">
          <div class="text-[#FF8A3D] text-xs ...">April 4, 2026</div>
          <h3 class="text-[#1A2B3C] ...">Event Title</h3>
          <p class="text-[#5a5a5a] ...">Description text</p>
        </div>
      </button>

    The "RSVP / Tickets" CTA is a click handler on the outer <button> — there
    are no <a> tags inside the card. The ticket URL is constant (TICKETS_URL).
    """
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("button.card.overflow-hidden")
    results: list[dict] = []

    for card in cards:
        # Title — first h3 or h2 inside the card content div.
        title_el = card.find(["h3", "h2"])
        if not title_el:
            continue
        title = unescape(title_el.get_text(" ", strip=True))
        if not title:
            continue

        # Date label — the first <div> directly inside .p-4 that has a month name.
        # We look at direct children of the .p-4 div rather than all descendants,
        # to avoid matching the title or description text.
        date_label = ""
        content_div = card.select_one("div.p-4")
        if content_div:
            for el in content_div.children:
                if el.name in ("div", "span"):
                    text = el.get_text(strip=True)
                    if re.search(
                        r"\b(January|February|March|April|May|June|"
                        r"July|August|September|October|November|December)\b",
                        text,
                    ):
                        date_label = text
                        break

        # Description — first <p> inside the content div (not nested deeper).
        description = ""
        if content_div:
            p_el = content_div.find("p")
            if p_el:
                description = p_el.get_text(" ", strip=True)

        # Image — prefer srcset last entry (largest), fallback to src.
        image_url: Optional[str] = None
        img = card.find("img")
        if img:
            srcset = img.get("srcset", "")
            if srcset:
                # Last srcset entry is the widest (e.g., 3840w).
                entries = [e.strip() for e in srcset.split(",") if e.strip()]
                if entries:
                    candidate = entries[-1].split()[0]
                    image_url = _extract_sanity_image_from_src(candidate)
            if not image_url:
                image_url = _extract_sanity_image_from_src(img.get("src", ""))

        results.append(
            {
                "title": title,
                "date_label": date_label,
                "description": description,
                # Cards are <button> elements with onClick — no <a> href available.
                # Ticket/RSVP URL is always TICKETS_URL (constant).
                "button_url": TICKETS_URL,
                "image_url": image_url,
            }
        )

    return results


def _build_main_festival_event(
    source_id: int,
    venue_id: int,
    card: dict,
    jsonld: Optional[dict],
) -> dict:
    """Build the event record for the main 404 Day festival at Piedmont Park."""
    start_date = "2026-04-04"
    if jsonld:
        raw_start = jsonld.get("startDate", "")
        if raw_start:
            start_date = raw_start[:10]

    image_url = card.get("image_url") or OG_IMAGE
    description = card.get("description") or (
        "Atlanta's annual free outdoor music and culture festival. "
        "Live music, local food vendors, and community spirit in Piedmont Park. "
        "Free to attend every April 4th."
    )
    # Trim very long descriptions extracted from the page.
    if len(description) > 600:
        description = description[:597] + "..."

    content_hash = generate_content_hash("404 Day 2026", "Piedmont Park", start_date)

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": "404 Day 2026",
        "description": description,
        "start_date": start_date,
        "start_time": None,
        "end_date": start_date,
        "end_time": None,
        "is_all_day": True,
        "category": "music",
        "subcategory": "festival",
        "tags": ["404-day", "festival", "free", "outdoor", "midtown", "piedmont-park", "tentpole"],
        "price_min": 0,
        "price_max": 0,
        "price_note": "Free to attend",
        "is_free": True,
        "is_tentpole": True,
        "source_url": BASE_URL,
        "ticket_url": TICKETS_URL,
        "image_url": image_url,
        "raw_text": json.dumps({"jsonld": jsonld, "card": card}, sort_keys=True),
        "extraction_confidence": 0.97,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def _build_stankonia_event(
    source_id: int,
    venue_id: int,
    card: dict,
) -> dict:
    """Build the event record for the ticketed Old Atlanta vs. New Atlanta event."""
    start_date = "2026-04-04"
    description = card.get("description") or (
        "A one-night collision of Atlanta legends and rising stars celebrating the "
        "past, present, and future of the 404, live at Stankonia Studios."
    )
    if len(description) > 600:
        description = description[:597] + "..."

    title = "404 Day: Old Atlanta vs. New Atlanta"
    content_hash = generate_content_hash(title, "Stankonia Studios", start_date)
    ticket_url = card.get("button_url") or TICKETS_URL

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": None,
        "end_date": start_date,
        "end_time": None,
        "is_all_day": False,
        "category": "music",
        "subcategory": "concert",
        "tags": ["404-day", "hip-hop", "atlanta", "concert", "culture", "live-music"],
        "price_min": None,
        "price_max": None,
        "price_note": "Ticketed — capacity is limited",
        "is_free": False,
        "is_tentpole": False,
        "source_url": EVENTS_URL,
        "ticket_url": ticket_url,
        "image_url": card.get("image_url"),
        "raw_text": json.dumps(card, sort_keys=True),
        "extraction_confidence": 0.90,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def _upsert_event(event_record: dict, series_hint: Optional[dict] = None) -> tuple[int, int]:
    """Insert or smart-update an event. Returns (new, updated)."""
    existing = find_event_by_hash(event_record["content_hash"])
    if existing:
        smart_update_existing_event(existing, event_record)
        return 0, 1
    insert_event(event_record, series_hint=series_hint)
    return 1, 0


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl 404day.com for the annual festival and its associated events.

    Strategy:
    1. Fetch the /events page — contains HTML event cards + JSON-LD.
    2. Parse the JSON-LD Event object for authoritative date/offer data.
    3. Parse HTML cards for descriptions and images (card order: main festival
       first, Stankonia night second).
    4. Upsert both events grouped under the "404 Day 2026" series.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Fetch both pages; the homepage JSON-LD is canonical for the main event.
        homepage_html = _fetch_html(BASE_URL)
        events_html = _fetch_html(EVENTS_URL)
    except requests.RequestException as exc:
        logger.error("404 Day: failed to fetch pages — %s", exc)
        raise

    # JSON-LD from the homepage gives authoritative start/end dates and offers.
    main_jsonld = _find_event_jsonld(homepage_html)

    # Parse HTML cards from the events page.
    cards = _parse_event_cards(events_html)
    logger.info("404 Day: found %d event cards on /events", len(cards))

    # Identify the main festival card (Piedmont Park) and the Stankonia card.
    main_card: dict = {}
    stankonia_card: Optional[dict] = None

    for card in cards:
        title_lower = card["title"].lower()
        if "old atlanta" in title_lower or "new atlanta" in title_lower or "stankonia" in title_lower:
            stankonia_card = card
        elif "404 day" in title_lower:
            # Take the first matching card as the main festival card.
            if not main_card:
                main_card = card

    if not main_card and cards:
        # Fallback: use the first card if pattern matching fails.
        main_card = cards[0]

    # --- Main festival event (Piedmont Park, free) ---
    piedmont_venue_id = get_or_create_place(PIEDMONT_PARK_VENUE)
    main_event = _build_main_festival_event(source_id, piedmont_venue_id, main_card, main_jsonld)
    events_found += 1
    new_count, updated_count = _upsert_event(main_event, series_hint=SERIES_HINT)
    events_new += new_count
    events_updated += updated_count
    logger.info(
        "404 Day main festival: %s (new=%s, updated=%s)",
        main_event["start_date"],
        new_count,
        updated_count,
    )

    # --- Stankonia concert event (ticketed, separate venue) ---
    if stankonia_card:
        stankonia_venue_id = get_or_create_place(STANKONIA_VENUE)
        stankonia_event = _build_stankonia_event(source_id, stankonia_venue_id, stankonia_card)
        events_found += 1
        new_count, updated_count = _upsert_event(stankonia_event, series_hint=SERIES_HINT)
        events_new += new_count
        events_updated += updated_count
        logger.info(
            "404 Day Stankonia event: %s (new=%s, updated=%s)",
            stankonia_event["start_date"],
            new_count,
            updated_count,
        )
    else:
        logger.info("404 Day: Stankonia event card not found on /events — skipping")

    logger.info(
        "404 Day crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
