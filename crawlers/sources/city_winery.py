"""
Crawler for City Winery Atlanta (citywinery.com).
Restaurant, winery, and intimate music venue at Ponce City Market.

Site uses Vivenu ticketing with a public API at awsapi.citywinery.com/events.
Pagination via skip param in increments of 16.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

API_URL = "https://awsapi.citywinery.com/events"
BASE_URL = "https://citywinery.com"
PAGE_SIZE = 16
MAX_PAGES = 12  # Cap at ~192 events to avoid runaway

HEADERS = {
    "Origin": "https://citywinery.com",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

PLACE_DATA = {
    "name": "City Winery Atlanta",
    "slug": "city-winery-atlanta",
    "address": "650 North Ave NE",
    "neighborhood": "Ponce City Market Area",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7724,
    "lng": -84.3654,
    "place_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL + "/atlanta",
}

# Map City Winery genre tags to our genre taxonomy
GENRE_MAP = {
    "JAZZ": "jazz",
    "BLUES": "blues",
    "R&B": "r-and-b",
    "HIP HOP": "hip-hop",
    "NEO SOUL": "neo-soul",
    "SOUL": "soul",
    "POP": "pop",
    "ROCK": "rock",
    "COUNTRY": "country",
    "FOLK": "folk",
    "LATIN": "latin",
    "COMEDY": "comedy",
    "GOSPEL": "gospel",
    "FUNK": "funk",
    "REGGAE": "reggae",
    "CLASSICAL": "classical",
    "SINGER-SONGWRITER": "singer-songwriter",
    "TRIBUTE": "tribute",
    "ELECTRONIC": "electronic",
    "INDIE": "indie",
    "ALTERNATIVE": "alternative",
}

# Eastern Time offset (UTC-5 standard, UTC-4 daylight)
ET = timezone(timedelta(hours=-5))


def parse_utc_datetime(iso_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse UTC ISO datetime and convert to Eastern Time."""
    if not iso_str:
        return None, None
    try:
        # Parse "2026-02-27T23:00:00.000Z"
        clean = iso_str.replace("Z", "+00:00")
        dt_utc = datetime.fromisoformat(clean)
        # Convert to Eastern Time
        dt_et = dt_utc.astimezone(ET)
        return dt_et.strftime("%Y-%m-%d"), dt_et.strftime("%H:%M")
    except (ValueError, TypeError):
        return None, None


def map_genres(api_tags: list) -> list[str]:
    """Map City Winery genre tags to our taxonomy."""
    genres = []
    for tag in (api_tags or []):
        mapped = GENRE_MAP.get(tag.upper())
        if mapped:
            genres.append(mapped)
    return genres or ["live-music"]


_FOOD_DRINK_KEYWORDS = frozenset(
    [
        "tour",
        "tasting",
        "dinner",
        "brunch",
        "lunch",
        "chef",
        "winemaker",
        "winery",
        "pairing",
        "harvest",
        "vintage",
        "culinary",
    ]
)


def derive_category(genres: list[str], title: str) -> str:
    """Derive event category from genres and title.

    Priority order:
    1. comedy/stand-up genre (when live-music is absent) → "comedy"
    2. drag genre → "nightlife"
    3. food/drink keywords in title → "food_drink"
    4. default → "music"
    """
    genre_set = set(genres)
    title_lower = title.lower()
    title_words = set(title_lower.split())

    if ("comedy" in genre_set or "stand-up" in genre_set) and "live-music" not in genre_set:
        return "comedy"

    if "drag" in genre_set:
        return "nightlife"

    if _FOOD_DRINK_KEYWORDS & title_words:
        return "food_drink"

    return "music"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City Winery Atlanta via Vivenu API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        all_events = []
        for page in range(MAX_PAGES):
            skip = page * PAGE_SIZE
            logger.info(f"Fetching City Winery API (skip={skip})")

            resp = requests.get(
                API_URL,
                params={"location": "Atlanta", "skip": skip},
                headers=HEADERS,
                timeout=15,
            )
            resp.raise_for_status()

            data = resp.json()
            if data.get("status") != "success":
                logger.warning(f"API returned non-success: {data.get('status')}")
                break

            page_events = data.get("data", {}).get("event_data", [])
            if not page_events:
                break

            all_events.extend(page_events)

            if len(page_events) < PAGE_SIZE:
                break

        logger.info(f"Fetched {len(all_events)} total events from API")

        for event in all_events:
            try:
                title = (event.get("name") or "").strip()
                if not title or len(title) < 3:
                    continue

                start_date, start_time = parse_utc_datetime(event.get("start"))
                end_date, end_time = parse_utc_datetime(event.get("end"))

                if not start_date:
                    continue

                # Skip past events
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue
                except ValueError:
                    continue

                events_found += 1

                # Build source URL from event slug
                event_slug = event.get("url", "")
                source_url = f"{BASE_URL}/pages/genre/{event_slug}" if event_slug else f"{BASE_URL}/atlanta/events"

                # Extract data from API response
                price = event.get("startingPrice")
                sale_status = event.get("saleStatus", "")
                seo = event.get("seoSettings") or {}
                description = seo.get("description", "")
                if description:
                    description = description[:500]

                api_tags = seo.get("tags", [])
                genres = map_genres(api_tags)

                image_url = event.get("image")

                is_recurring = event.get("eventType") == "RECURRENCE"

                # Price note for sold out events
                price_note = None
                if sale_status == "soldOut":
                    price_note = "Sold Out"
                elif price:
                    price_note = f"From ${price}"

                content_hash = generate_content_hash(title, "City Winery Atlanta", start_date + (start_time or ""))

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": description or f"{title} at City Winery Atlanta",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": derive_category(genres, title),
                    "tags": ["city-winery", "live-music", "dinner-show", "ponce-city-market"],
                    "price_min": price,
                    "price_max": price,
                    "price_note": price_note,
                    "is_free": price == 0 if price is not None else False,
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "image_url": image_url,
                    "raw_text": f"{title} - {start_date} {start_time}",
                    "extraction_confidence": 0.95,
                    "is_recurring": is_recurring,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record, genres=genres)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            except Exception as e:
                logger.warning(f"Failed to process event: {e}")
                continue

        logger.info(
            f"City Winery crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch City Winery API: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl City Winery: {e}")
        raise

    return events_found, events_new, events_updated
