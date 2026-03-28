"""
Unified crawler for 404 Day / 404 Day Weekend.

Combines two official sites into one festival structure:
  - 404weekend.com — parade, 5K, block party, gala, city takeover, night party
  - 404day.com — main Piedmont Park music festival + Stankonia Studios concert

All events are children under a single "404 Day Weekend" parent event.
The 404-day source is deactivated; this crawler owns the entire festival.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta
from html import unescape
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://404weekend.com"
EVENTS_URL = f"{BASE_URL}/events/"
PARADE_URL = f"{BASE_URL}/parade/"

# 404day.com — main festival site (Piedmont Park + Stankonia)
DAY_BASE_URL = "https://404day.com"
DAY_EVENTS_URL = f"{DAY_BASE_URL}/events"
DAY_TICKETS_URL = f"{DAY_BASE_URL}/tickets"
DAY_OG_IMAGE = f"{DAY_BASE_URL}/404day-atlanta-music-festival-flyer.jpg"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

TITLE_NORMALIZATION = {
    "2nd Annual 404 Day! Parade": "2nd Annual 404 Day Parade",
    "404 Day! Weekend Celebration & Night Party": "404 Day Weekend Celebration & Night Party",
    "404 Day! Weekend City Takeover": "404 Day Weekend City Takeover",
    "404 Day! Weekend Block Party @ Underground Atlanta": "404 Day Weekend Block Party @ Underground Atlanta",
    "2026 Run Atlanta 404 Day! Weekend 5K": "2026 Run Atlanta 404 Day Weekend 5K",
}

KNOWN_VENUES = {
    "Monday Night Garage": {
        "name": "Monday Night Garage",
        "slug": "monday-night-garage",
        "address": "Atlanta, GA",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "",
        "place_type": "brewery",
        "spot_type": "brewery",
        "website": "https://mondaynightbrewing.com/",
    },
    "Underground Atlanta": {
        "name": "Underground Atlanta",
        "slug": "underground-atlanta",
        "address": "Atlanta, GA",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "",
        "place_type": "landmark",
        "spot_type": "landmark",
        "website": "https://www.undergroundatl.com/",
    },
    "The Stave Room": {
        "name": "The Stave Room",
        "slug": "the-stave-room",
        "address": "Atlanta, GA",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "",
        "place_type": "event_space",
        "spot_type": "event_space",
        "website": "https://www.novareevents.com/the-stave-room",
    },
    "Downtown Atlanta": {
        "name": "Downtown Atlanta",
        "slug": "downtown-atlanta",
        "address": "Downtown Atlanta, Atlanta, GA",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "",
        "place_type": "landmark",
        "spot_type": "landmark",
        "website": BASE_URL,
    },
    "All Around Atlanta": {
        "name": "All Around Atlanta",
        "slug": "all-around-atlanta",
        "address": "Atlanta, GA",
        "neighborhood": "Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "",
        "place_type": "organization",
        "spot_type": "organization",
        "website": BASE_URL,
    },
    "404 Day Weekend": {
        "name": "404 Day Weekend",
        "slug": "404-day-weekend",
        "address": "Atlanta, GA",
        "neighborhood": "Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "",
        "place_type": "festival",
        "spot_type": "festival",
        "website": BASE_URL,
    },
    "Piedmont Park": {
        "name": "Piedmont Park",
        "slug": "piedmont-park",
        "address": "400 Park Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7873,
        "lng": -84.3733,
        "place_type": "park",
        "spot_type": "outdoor",
        "website": "https://piedmontpark.org",
    },
    "Stankonia Studios": {
        "name": "Stankonia Studios",
        "slug": "stankonia-studios",
        "address": "Atlanta, GA",
        "neighborhood": "Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "",
        "place_type": "music_venue",
        "spot_type": "music_venue",
        "website": DAY_BASE_URL,
    },
}

DATE_PREFIX_RE = re.compile(
    r"^(?P<weekday>[A-Za-z]+),?\s+(?P<month>[A-Za-z]+)\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?$"
)
TIME_RE = re.compile(r"^(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?\s*(?P<ampm>[AaPp][Mm])$")


def _fetch_html(url: str) -> str:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    return response.text


def _load_jsonld_objects(html: str) -> list[dict]:
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


def normalize_title(title: str) -> str:
    cleaned = re.sub(r"\s+", " ", unescape(title or "")).strip()
    return TITLE_NORMALIZATION.get(cleaned, cleaned.replace("!", ""))


def parse_iso_datetime(value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not value:
        return None, None

    text = str(value).strip()
    if not text:
        return None, None

    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            d = date.fromisoformat(text[:10])
        except ValueError:
            return None, None
        return d.isoformat(), None

    date_part = dt.date().isoformat()
    time_part = dt.strftime("%H:%M")
    if text.endswith("T00:00:00") or "T00:00:00-" in text or "T00:00:00+" in text:
        return date_part, time_part
    return date_part, time_part


def _split_schedule_parts(text: str) -> tuple[str, str]:
    normalized = " ".join(unescape(text or "").replace("•", "|").split())
    if "|" not in normalized:
        raise ValueError(f"Unrecognized schedule text: {text!r}")
    date_part, time_part = normalized.split("|", 1)
    return date_part.strip(), time_part.strip()


def _parse_date_phrase(text: str, year: int) -> date:
    normalized = " ".join(text.split())
    match = DATE_PREFIX_RE.match(normalized)
    if not match:
        raise ValueError(f"Unrecognized date phrase: {text!r}")
    payload = match.groupdict()
    return datetime.strptime(
        f"{payload['month']} {payload['day']} {year}",
        "%B %d %Y",
    ).date()


def _parse_time_phrase(text: str) -> str:
    normalized = re.sub(r"\s+", "", text).upper()
    match = TIME_RE.match(normalized)
    if not match:
        raise ValueError(f"Unrecognized time phrase: {text!r}")

    hour = int(match.group("hour"))
    minute = int(match.group("minute") or "0")
    ampm = match.group("ampm")
    if hour == 12:
        hour = 0
    if ampm == "PM":
        hour += 12
    return f"{hour:02d}:{minute:02d}"


def parse_schedule_text(text: str, year: int) -> dict:
    date_part, time_part = _split_schedule_parts(text)

    if "–" in time_part:
        left, right = [segment.strip() for segment in time_part.split("–", 1)]
    else:
        left, right = time_part, None

    start_date = _parse_date_phrase(date_part, year)
    start_time = _parse_time_phrase(left)
    end_date: Optional[date] = None
    end_time: Optional[str] = None

    if right:
        if "," in right:
            pieces = [segment.strip() for segment in right.rsplit("|", 1)]
            if len(pieces) == 2:
                end_date = _parse_date_phrase(pieces[0], year)
                end_time = _parse_time_phrase(pieces[1])
            else:
                end_date = _parse_date_phrase(right, year)
        else:
            try:
                end_time = _parse_time_phrase(right)
                end_date = start_date
            except ValueError:
                end_date = _parse_date_phrase(right, year)

    if end_time and end_date is None:
        end_date = start_date

    if end_date and end_time and end_date == start_date and end_time < start_time:
        end_date = end_date + timedelta(days=1)

    return {
        "start_date": start_date.isoformat(),
        "start_time": start_time,
        "end_date": end_date.isoformat() if end_date else None,
        "end_time": end_time,
        "is_all_day": False,
    }


def _parse_schedule_safe(text: str, year: int) -> dict:
    """Try to parse schedule text; return empty schedule on failure."""
    try:
        return parse_schedule_text(text, year)
    except ValueError:
        # Site may have changed format (e.g. bare ISO dates). Return empty
        # schedule — build_child_event will fill dates from JSON-LD.
        logger.debug("Could not parse schedule text %r — will use JSON-LD dates", text)
        # Try bare ISO date as fallback
        try:
            d = date.fromisoformat(text.strip()[:10])
            return {
                "start_date": d.isoformat(),
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
            }
        except ValueError:
            return {
                "start_date": None,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
            }


def parse_schedule_cards(html: str, year: int) -> dict[str, dict]:
    soup = BeautifulSoup(html, "html.parser")
    cards: dict[str, dict] = {}

    for card in soup.select(".events-grid .event-card"):
        title_el = card.select_one(".event-title")
        time_el = card.select_one(".event-time")
        if not title_el:
            continue

        raw_title = " ".join(title_el.get_text(" ", strip=True).split())
        title = normalize_title(raw_title)
        location = card.select_one(".event-location")
        description = card.select_one(".event-description")
        button = card.select_one(".event-button[href]")
        image = card.select_one(".event-image img")

        schedule_text = time_el.get_text(" ", strip=True) if time_el else ""
        schedule = _parse_schedule_safe(schedule_text, year) if schedule_text else {
            "start_date": None, "start_time": None,
            "end_date": None, "end_time": None, "is_all_day": True,
        }

        cards[title] = {
            "title": title,
            "schedule_text": schedule_text,
            "location_name": location.get_text(" ", strip=True) if location else "",
            "description": description.get_text(" ", strip=True) if description else "",
            "button_label": button.get_text(" ", strip=True) if button else "",
            "button_url": button.get("href") if button else None,
            "image_url": image.get("src") if image else None,
            **schedule,
        }

    return cards


def parse_event_series(html: str) -> dict:
    for obj in _load_jsonld_objects(html):
        if obj.get("@type") != "EventSeries":
            continue
        return obj
    raise ValueError("404 Weekend homepage did not expose EventSeries JSON-LD")


def parse_collection_event_urls(html: str) -> dict[str, dict]:
    for obj in _load_jsonld_objects(html):
        if obj.get("@type") != "CollectionPage":
            continue
        main_entity = obj.get("mainEntity") or {}
        items = main_entity.get("itemListElement") or []
        mapped: dict[str, dict] = {}
        for item in items:
            event = item.get("item") if isinstance(item, dict) and item.get("item") else item
            if not isinstance(event, dict) or event.get("@type") != "Event":
                continue
            title = normalize_title(event.get("name", ""))
            if not title:
                continue
            mapped[title] = event
        return mapped
    return {}


def parse_detail_jsonld(html: str) -> Optional[dict]:
    for obj in _load_jsonld_objects(html):
        if obj.get("@type") == "Event":
            return obj
    return None


def build_venue_data(name: str) -> dict:
    normalized = " ".join(unescape(name or "").split()).strip() or "404 Day Weekend"
    if normalized in KNOWN_VENUES:
        return dict(KNOWN_VENUES[normalized])

    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-") or "404-day-weekend"
    return {
        "name": normalized,
        "slug": slug,
        "address": "Atlanta, GA",
        "neighborhood": "Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "",
        "place_type": "organization",
        "spot_type": "organization",
        "website": BASE_URL,
    }


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    lowered = title.lower()

    if "5k" in lowered or "run atlanta" in lowered:
        return "sports", "race", ["404-day", "race", "running", "community", "atlanta"]
    if "parade" in lowered:
        return "community", "parade", ["404-day", "parade", "community", "atlanta", "free"]
    if "block party" in lowered:
        return "nightlife", "block_party", ["404-day", "block-party", "nightlife", "community", "atlanta"]
    if "night party" in lowered:
        return "nightlife", "party", ["404-day", "nightlife", "party", "atlanta"]
    if "gala" in lowered:
        return "community", "fundraiser", ["404-day", "gala", "fundraiser", "community", "atlanta"]
    return "community", "festival", ["404-day", "festival", "community", "atlanta"]


def should_keep_ticket_url(title: str, button_label: str, button_url: Optional[str], price_note: Optional[str]) -> bool:
    if not button_url:
        return False
    lowered_title = title.lower()
    lowered_label = (button_label or "").lower()
    lowered_note = (price_note or "").lower()
    if "parade" in lowered_title and ("register" in lowered_label or "free" in lowered_note):
        return False
    return True


def build_parent_event(
    source_id: int,
    series: dict,
    year: int,
) -> dict:
    start_date, _ = parse_iso_datetime(series.get("startDate"))
    end_date, _ = parse_iso_datetime(series.get("endDate"))
    place_data = build_venue_data("404 Day Weekend")
    venue_id = get_or_create_place(place_data)
    title = normalize_title(series.get("name") or f"404 Day Weekend {year}")
    content_hash = generate_content_hash(title, place_data["name"], start_date or f"{year}-04-01")

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": (
            "Atlanta's annual 404 Day celebration: free music festival at Piedmont Park, "
            "parade, block party, scholarship gala, 5K, citywide activations, and more."
        ),
        "start_date": start_date,
        "start_time": None,
        "end_date": end_date,
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "festival",
        "tags": ["404-day", "404-weekend", "atlanta", "community", "tentpole"],
        "price_min": None,
        "price_max": None,
        "price_note": "Mixed free and ticketed weekend programming",
        "is_free": False,
        "is_tentpole": True,
        "source_url": BASE_URL,
        "ticket_url": EVENTS_URL,
        "image_url": None,
        "raw_text": json.dumps(series, sort_keys=True),
        "extraction_confidence": 0.96,
        "is_recurring": True,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def build_child_event(
    source_id: int,
    title: str,
    card: dict,
    collection_event: dict,
    detail_event: Optional[dict],
    parade_event: Optional[dict],
) -> dict:
    category, subcategory, tags = determine_category(title)
    place_data = build_venue_data(card.get("location_name") or title)
    venue_id = get_or_create_place(place_data)

    source_url = collection_event.get("url") or (detail_event or {}).get("url") or EVENTS_URL
    if "parade" in title.lower():
        source_url = PARADE_URL

    start_date = card["start_date"]
    start_time = card["start_time"]
    end_date = card.get("end_date")
    end_time = card.get("end_time")

    if "parade" in title.lower() and parade_event:
        parade_start_date, parade_start_time = parse_iso_datetime(parade_event.get("startDate"))
        parade_end_date, parade_end_time = parse_iso_datetime(parade_event.get("endDate"))
        start_date = parade_start_date or start_date
        start_time = parade_start_time or start_time
        end_date = parade_end_date or end_date
        end_time = parade_end_time or end_time
    elif detail_event:
        detail_start_date, detail_start_time = parse_iso_datetime(detail_event.get("startDate"))
        detail_end_date, detail_end_time = parse_iso_datetime(detail_event.get("endDate"))
        if not end_date:
            end_date = detail_end_date
        if not end_time:
            end_time = detail_end_time
        if not start_date:
            start_date = detail_start_date
        if not start_time:
            start_time = detail_start_time

    description_parts = [card.get("description") or ""]
    if "parade" in title.lower():
        description_parts.append(
            "Route begins at Ralph McGill Ave & Cortland St. and ends near Underground Atlanta."
        )
    description = " ".join(part.strip() for part in description_parts if part and part.strip())

    offer = (detail_event or {}).get("offers") or {}
    button_label = card.get("button_label") or ""
    button_url = card.get("button_url")
    is_free = "free" in button_label.lower() or "free" in description.lower()
    price_note: Optional[str] = None
    if "parade" in title.lower():
        is_free = True
        price_note = "Free to attend; group registration available"
    elif button_label:
        price_note = button_label

    ticket_url = button_url or (offer.get("url") if isinstance(offer, dict) else None)
    if not should_keep_ticket_url(title, button_label, ticket_url, price_note):
        ticket_url = None

    content_hash = generate_content_hash(
        title,
        place_data["name"],
        f"{start_date}|{start_time or 'all-day'}",
    )

    raw_payload = {
        "card": card,
        "collection_event": collection_event,
        "detail_event": detail_event,
        "parade_event": parade_event if "parade" in title.lower() else None,
    }

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "is_all_day": False,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": 0 if is_free else None,
        "price_max": 0 if is_free else None,
        "price_note": price_note,
        "is_free": is_free,
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": (
            (detail_event or {}).get("image", {}).get("url")
            if isinstance((detail_event or {}).get("image"), dict)
            else (detail_event or {}).get("image")
        )
        or (
            collection_event.get("image", {}).get("url")
            if isinstance(collection_event.get("image"), dict)
            else collection_event.get("image")
        )
        or card.get("image_url"),
        "raw_text": json.dumps(raw_payload, sort_keys=True),
        "extraction_confidence": 0.95 if "parade" in title.lower() else 0.93,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def _extract_sanity_image_from_src(src: str) -> Optional[str]:
    """Extract original Sanity CDN URL from a Next.js image proxy URL."""
    from urllib.parse import unquote

    if not src:
        return None
    if "_next/image" in src and "url=" in src:
        match = re.search(r"url=([^&]+)", src)
        if match:
            raw = unquote(match.group(1))
            return raw.split("?")[0]
    if "cdn.sanity.io" in src:
        return src.split("?")[0]
    return None


def _parse_404day_event_cards(html: str) -> list[dict]:
    """Parse 404day.com /events page cards (Next.js + Sanity CMS)."""
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("button.card.overflow-hidden")
    results: list[dict] = []

    for card in cards:
        title_el = card.find(["h3", "h2"])
        if not title_el:
            continue
        title = unescape(title_el.get_text(" ", strip=True))
        if not title:
            continue

        description = ""
        content_div = card.select_one("div.p-4")
        if content_div:
            p_el = content_div.find("p")
            if p_el:
                description = p_el.get_text(" ", strip=True)

        image_url: Optional[str] = None
        img = card.find("img")
        if img:
            srcset = img.get("srcset", "")
            if srcset:
                entries = [e.strip() for e in srcset.split(",") if e.strip()]
                if entries:
                    candidate = entries[-1].split()[0]
                    image_url = _extract_sanity_image_from_src(candidate)
            if not image_url:
                image_url = _extract_sanity_image_from_src(img.get("src", ""))

        results.append({
            "title": title,
            "description": description,
            "button_url": DAY_TICKETS_URL,
            "image_url": image_url,
        })

    return results


def _build_piedmont_park_child(source_id: int, card: dict, jsonld: Optional[dict]) -> dict:
    """Build child event for the main 404 Day festival at Piedmont Park."""
    start_date = "2026-04-04"
    if jsonld:
        raw_start = jsonld.get("startDate", "")
        if raw_start:
            start_date = raw_start[:10]

    image_url = card.get("image_url") or DAY_OG_IMAGE
    description = card.get("description") or (
        "Atlanta's annual free outdoor music and culture festival. "
        "Live music, local food vendors, and community spirit in Piedmont Park."
    )
    if len(description) > 600:
        description = description[:597] + "..."

    place_data = build_venue_data("Piedmont Park")
    venue_id = get_or_create_place(place_data)
    content_hash = generate_content_hash("404 Day 2026", "Piedmont Park", start_date)

    return {
        "source_id": source_id,
        "place_id": venue_id,
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
        "is_tentpole": False,  # Parent is the tentpole
        "source_url": DAY_BASE_URL,
        "ticket_url": DAY_TICKETS_URL,
        "image_url": image_url,
        "raw_text": json.dumps({"jsonld": jsonld, "card": card}, sort_keys=True),
        "extraction_confidence": 0.95,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def _build_stankonia_child(source_id: int, card: dict) -> dict:
    """Build child event for the Old Atlanta vs. New Atlanta concert at Stankonia."""
    start_date = "2026-04-04"
    description = card.get("description") or (
        "A one-night collision of Atlanta legends and rising stars celebrating the "
        "past, present, and future of the 404, live at Stankonia Studios."
    )
    if len(description) > 600:
        description = description[:597] + "..."

    title = "404 Day: Old Atlanta vs. New Atlanta"
    place_data = build_venue_data("Stankonia Studios")
    venue_id = get_or_create_place(place_data)
    content_hash = generate_content_hash(title, "Stankonia Studios", start_date)

    return {
        "source_id": source_id,
        "place_id": venue_id,
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
        "source_url": DAY_EVENTS_URL,
        "ticket_url": card.get("button_url") or DAY_TICKETS_URL,
        "image_url": card.get("image_url"),
        "raw_text": json.dumps(card, sort_keys=True),
        "extraction_confidence": 0.90,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def _upsert_event(event_record: dict) -> tuple[int, int]:
    existing = find_event_by_hash(event_record["content_hash"])
    if existing:
        smart_update_existing_event(existing, event_record)
        return 0, 1
    insert_event(event_record)
    return 1, 0


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl 404weekend.com + 404day.com as a unified 404 Day festival."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    homepage_html = _fetch_html(BASE_URL)
    events_html = _fetch_html(EVENTS_URL)
    series = parse_event_series(homepage_html)
    start_date, _ = parse_iso_datetime(series.get("startDate"))
    year = int((start_date or str(datetime.now().year))[:4])

    cards = parse_schedule_cards(events_html, year)
    collection_events = parse_collection_event_urls(events_html)
    parade_detail = parse_detail_jsonld(_fetch_html(PARADE_URL))

    parent_event = build_parent_event(source_id, series, year)
    events_found += 1
    new_count, updated_count = _upsert_event(parent_event)
    events_new += new_count
    events_updated += updated_count

    detail_cache: dict[str, Optional[dict]] = {}
    subevents = series.get("subEvent") or []
    for subevent in subevents:
        raw_title = subevent.get("name", "")
        title = normalize_title(raw_title)
        if not title:
            logger.warning("404 Weekend subevent has no title — skipping")
            continue

        # Build a synthetic card from JSON-LD if HTML card parsing missed it
        if title not in cards:
            sub_start_date, sub_start_time = parse_iso_datetime(subevent.get("startDate"))
            sub_end_date, sub_end_time = parse_iso_datetime(subevent.get("endDate"))
            location = subevent.get("location") or {}
            location_name = location.get("name") if isinstance(location, dict) else ""
            image_data = subevent.get("image")
            image_url = image_data.get("url") if isinstance(image_data, dict) else image_data if isinstance(image_data, str) else None
            cards[title] = {
                "title": title,
                "schedule_text": "",
                "location_name": location_name or "",
                "description": subevent.get("description") or "",
                "button_label": "",
                "button_url": subevent.get("url"),
                "image_url": image_url,
                "start_date": sub_start_date,
                "start_time": sub_start_time,
                "end_date": sub_end_date,
                "end_time": sub_end_time,
                "is_all_day": not sub_start_time,
            }
            logger.info("404 Weekend: built card from JSON-LD for %s", title)

        detail_url = collection_events.get(title, {}).get("url") or subevent.get("url")
        if detail_url and detail_url not in detail_cache:
            detail_cache[detail_url] = parse_detail_jsonld(_fetch_html(detail_url))

        child_event = build_child_event(
            source_id=source_id,
            title=title,
            card=cards[title],
            collection_event=collection_events.get(title, subevent),
            detail_event=detail_cache.get(detail_url),
            parade_event=parade_detail,
        )
        events_found += 1
        new_count, updated_count = _upsert_event(child_event)
        events_new += new_count
        events_updated += updated_count

    # -----------------------------------------------------------------
    # Phase 2: Fold in 404day.com events (Piedmont Park + Stankonia)
    # -----------------------------------------------------------------
    try:
        day_homepage_html = _fetch_html(DAY_BASE_URL)
        day_events_html = _fetch_html(DAY_EVENTS_URL)
    except requests.RequestException as exc:
        logger.warning("404 Day: failed to fetch 404day.com — %s (weekend events still saved)", exc)
        return events_found, events_new, events_updated

    # JSON-LD from homepage gives authoritative date for main festival
    day_main_jsonld = None
    for obj in _load_jsonld_objects(day_homepage_html):
        if obj.get("@type") == "Event":
            day_main_jsonld = obj
            break

    # Parse HTML cards from /events page
    day_cards = _parse_404day_event_cards(day_events_html)
    logger.info("404 Day: found %d event cards on 404day.com/events", len(day_cards))

    # Identify cards: Piedmont Park main fest vs Stankonia concert
    main_card: dict = {}
    stankonia_card: Optional[dict] = None
    for card in day_cards:
        title_lower = card["title"].lower()
        if "old atlanta" in title_lower or "new atlanta" in title_lower or "stankonia" in title_lower:
            stankonia_card = card
        elif "404 day" in title_lower and not main_card:
            main_card = card

    if not main_card and day_cards:
        main_card = day_cards[0]

    # Piedmont Park festival (free, all-day music festival)
    if main_card:
        piedmont_event = _build_piedmont_park_child(source_id, main_card, day_main_jsonld)
        events_found += 1
        new_count, updated_count = _upsert_event(piedmont_event)
        events_new += new_count
        events_updated += updated_count
        logger.info("404 Day: Piedmont Park festival → new=%d, updated=%d", new_count, updated_count)

    # Stankonia concert (ticketed, evening)
    if stankonia_card:
        stankonia_event = _build_stankonia_child(source_id, stankonia_card)
        events_found += 1
        new_count, updated_count = _upsert_event(stankonia_event)
        events_new += new_count
        events_updated += updated_count
        logger.info("404 Day: Stankonia concert → new=%d, updated=%d", new_count, updated_count)

    return events_found, events_new, events_updated
