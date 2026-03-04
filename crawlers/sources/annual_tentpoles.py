"""
Crawler for annual tentpole/festival pages with explicit date windows.

This module is mapped from multiple source slugs via SOURCE_OVERRIDES in main.py.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_client,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

_MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

_KNOWN_WINDOWS_BY_SLUG: dict[str, dict[int, tuple[str, str]]] = {
    "ga-renaissance-festival": {
        2026: ("2026-04-11", "2026-05-31"),
    },
    "blue-ridge-trout-fest": {
        2026: ("2026-04-25", "2026-04-25"),
    },
    "breakaway-atlanta": {
        2026: ("2026-05-15", "2026-05-16"),
    },
    "esfna-atlanta": {
        2026: ("2026-06-28", "2026-07-05"),
    },
    "221b-con": {
        2026: ("2026-04-10", "2026-04-12"),
    },
    "fifa-fan-festival-atlanta": {
        2026: ("2026-06-11", "2026-07-19"),
    },
}


@dataclass(frozen=True)
class Config:
    base_title: str
    urls: tuple[str, ...]
    allowed_hosts: tuple[str, ...]
    venue_data: dict
    description: str
    category: str
    subcategory: Optional[str]
    tags: tuple[str, ...]
    is_tentpole: bool
    should_hydrate_festival: bool = False
    force_event_model: bool = False
    append_year_to_title: bool = True


CONFIGS: dict[str, Config] = {
    "piedmont-park-arts-festival": Config(
        base_title="Piedmont Park Arts Festival",
        urls=(
            "http://piedmontparkartsfestival.com/",
            "https://www.affps.com/",
        ),
        allowed_hosts=("piedmontparkartsfestival.com", "www.affps.com", "affps.com"),
        venue_data={
            "name": "Piedmont Park",
            "slug": "piedmont-park",
            "address": "1320 Monroe Dr NE",
            "neighborhood": "Midtown",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30306",
            "lat": 33.7851,
            "lng": -84.3738,
            "venue_type": "park",
            "spot_type": "park",
            "website": "https://www.piedmontpark.org",
        },
        description=(
            "Annual juried outdoor arts festival in Piedmont Park featuring visual artists, "
            "food vendors, family-friendly activities, and curated live cultural programming "
            "across a multi-day weekend format."
        ),
        category="art",
        subcategory="festival",
        tags=("arts-festival", "piedmont-park", "outdoor", "family-friendly"),
        is_tentpole=True,
        force_event_model=True,
    ),
    "national-black-arts-festival": Config(
        base_title="National Black Arts Festival",
        urls=("https://nbaf.org/", "https://nbaf.org/programs-and-events/"),
        allowed_hosts=("nbaf.org", "www.nbaf.org"),
        venue_data={
            "name": "National Black Arts Festival",
            "slug": "national-black-arts-festival",
            "address": "80 Joseph E. Lowery Blvd NW",
            "neighborhood": "Vine City",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30314",
            "venue_type": "organization",
            "spot_type": "organization",
            "website": "https://nbaf.org",
        },
        description=(
            "National Black Arts Festival programming and flagship cultural events celebrating "
            "Black arts, artists, and creative communities in Atlanta."
        ),
        category="art",
        subcategory="festival",
        tags=("black-arts", "culture", "festival", "atlanta"),
        is_tentpole=True,
        force_event_model=True,
    ),
    "native-american-festival-and-pow-wow": Config(
        base_title="Native American Festival and Pow-Wow",
        urls=("https://stonemountainpark.com/activity/events/native-american-festival-and-pow-wow/",),
        allowed_hosts=("stonemountainpark.com", "www.stonemountainpark.com"),
        venue_data={
            "name": "Stone Mountain Park",
            "slug": "stone-mountain-park",
            "address": "1000 Robert E Lee Blvd",
            "neighborhood": "Stone Mountain",
            "city": "Stone Mountain",
            "state": "GA",
            "zip": "30083",
            "lat": 33.8041,
            "lng": -84.1453,
            "venue_type": "park",
            "spot_type": "park",
            "website": "https://stonemountainpark.com",
        },
        description=(
            "Annual Native American Festival and Pow-Wow at Stone Mountain Park with dance, "
            "music, craft demonstrations, and cultural presentations."
        ),
        category="community",
        subcategory="festival",
        tags=("pow-wow", "native-american", "culture", "stone-mountain"),
        is_tentpole=True,
        force_event_model=True,
    ),
    "atlanta-greek-picnic": Config(
        base_title="Atlanta Greek Picnic",
        urls=(
            "https://www.atlantagreekpicnic.com/blog/",
            "https://www.atlantagreekpicnic.com/",
        ),
        allowed_hosts=("atlantagreekpicnic.com", "www.atlantagreekpicnic.com"),
        venue_data={
            "name": "Atlanta Greek Picnic",
            "slug": "atlanta-greek-picnic",
            "address": "Various Locations",
            "neighborhood": "Atlanta",
            "city": "Atlanta",
            "state": "GA",
            "venue_type": "organization",
            "spot_type": "organization",
            "website": "https://www.atlantagreekpicnic.com",
        },
        description=(
            "Annual Atlanta Greek Picnic weekend featuring multi-day social, music, and "
            "community programming."
        ),
        category="community",
        subcategory=None,
        tags=("greek-life", "community", "multi-day", "atlanta"),
        is_tentpole=True,
    ),
    "taste-of-soul-atlanta": Config(
        base_title="Taste of Soul Atlanta",
        urls=("https://tasteofsoulatlanta.com/",),
        allowed_hosts=("tasteofsoulatlanta.com", "www.tasteofsoulatlanta.com"),
        venue_data={
            "name": "Taste of Soul Atlanta",
            "slug": "taste-of-soul-atlanta",
            "address": "Various Locations",
            "neighborhood": "Atlanta",
            "city": "Atlanta",
            "state": "GA",
            "venue_type": "organization",
            "spot_type": "organization",
            "website": "https://tasteofsoulatlanta.com",
        },
        description=(
            "Annual Taste of Soul Atlanta event highlighting food, music, and community "
            "celebration."
        ),
        category="food_drink",
        subcategory=None,
        tags=("food-festival", "soul-food", "community", "atlanta"),
        is_tentpole=True,
    ),
    "ga-renaissance-festival": Config(
        base_title="Georgia Renaissance Festival",
        urls=("https://www.garenfest.com",),
        allowed_hosts=("garenfest.com", "www.garenfest.com"),
        venue_data={
            "name": "Georgia Renaissance Festival Grounds",
            "slug": "ga-renaissance-festival-grounds",
            "address": "6905 Virlyn B Smith Rd",
            "neighborhood": "South Fulton",
            "city": "Fairburn",
            "state": "GA",
            "zip": "30213",
            "venue_type": "organization",
            "spot_type": "organization",
            "website": "https://www.garenfest.com",
        },
        description=(
            "Annual Georgia Renaissance Festival with themed weekends, period performances, "
            "artisan marketplace experiences, and family-friendly fairground programming."
        ),
        category="community",
        subcategory="festival",
        tags=("renaissance-festival", "fairburn", "multi-weekend", "family-friendly"),
        is_tentpole=True,
        force_event_model=True,
        append_year_to_title=False,
    ),
    "blue-ridge-trout-fest": Config(
        base_title="Blue Ridge Trout & Outdoor Adventures Festival",
        urls=("https://blueridgetroutfest.com",),
        allowed_hosts=("blueridgetroutfest.com", "www.blueridgetroutfest.com"),
        venue_data={
            "name": "Downtown Blue Ridge",
            "slug": "downtown-blue-ridge",
            "address": "152 Orvin Lance Dr",
            "neighborhood": "Downtown",
            "city": "Blue Ridge",
            "state": "GA",
            "zip": "30513",
            "venue_type": "downtown_district",
            "spot_type": "district",
            "website": "https://blueridgetroutfest.com",
        },
        description=(
            "Blue Ridge Trout & Outdoor Adventures Festival featuring trout-focused programming, "
            "outdoor recreation activities, and regional vendor activations."
        ),
        category="sports",
        subcategory="festival",
        tags=("outdoors", "trout", "north-georgia", "festival"),
        is_tentpole=True,
        force_event_model=True,
        append_year_to_title=False,
    ),
    "breakaway-atlanta": Config(
        base_title="Breakaway Music Festival Atlanta",
        urls=("https://www.breakawayfestival.com/festival/atlanta-2026",),
        allowed_hosts=("breakawayfestival.com", "www.breakawayfestival.com"),
        venue_data={
            "name": "Breakaway Atlanta",
            "slug": "breakaway-atlanta",
            "address": "Various Locations",
            "neighborhood": "Atlanta",
            "city": "Atlanta",
            "state": "GA",
            "venue_type": "festival",
            "spot_type": "festival",
            "website": "https://www.breakawayfestival.com/",
        },
        description=(
            "Breakaway Music Festival Atlanta multi-day electronic and dance lineup programming "
            "with large-scale production and destination-festival experiences."
        ),
        category="music",
        subcategory="festival",
        tags=("music-festival", "electronic", "dance", "atlanta"),
        is_tentpole=True,
        force_event_model=True,
        append_year_to_title=False,
    ),
    "esfna-atlanta": Config(
        base_title="ESFNA Ethiopian Sports & Cultural Festival",
        urls=("https://esfna.org/",),
        allowed_hosts=("esfna.org", "www.esfna.org"),
        venue_data={
            "name": "ESFNA Festival",
            "slug": "esfna-festival",
            "address": "Various Locations",
            "neighborhood": "Atlanta",
            "city": "Atlanta",
            "state": "GA",
            "venue_type": "festival",
            "spot_type": "festival",
            "website": "https://esfna.org/",
        },
        description=(
            "ESFNA Ethiopian Sports & Cultural Festival featuring tournament play, cultural "
            "celebrations, and community programming across a week-long event window."
        ),
        category="community",
        subcategory="festival",
        tags=("ethiopian", "cultural-festival", "sports", "community"),
        is_tentpole=True,
        force_event_model=True,
        append_year_to_title=False,
    ),
    "221b-con": Config(
        base_title="221B Con",
        urls=("https://www.221bcon.com/",),
        allowed_hosts=("221bcon.com", "www.221bcon.com"),
        venue_data={
            "name": "221B Con Host Hotel",
            "slug": "221b-con-host-hotel",
            "address": "Various Locations",
            "neighborhood": "Atlanta",
            "city": "Atlanta",
            "state": "GA",
            "venue_type": "organization",
            "spot_type": "organization",
            "website": "https://www.221bcon.com/",
        },
        description=(
            "221B Con annual Sherlockian convention with multi-day fan programming and "
            "community gatherings."
        ),
        category="community",
        subcategory="convention",
        tags=("convention", "fandom", "sherlock", "atlanta"),
        is_tentpole=True,
        force_event_model=True,
        append_year_to_title=False,
    ),
    "fifa-fan-festival-atlanta": Config(
        base_title="FIFA Fan Festival Atlanta",
        urls=("https://www.fifa.com/en/tournaments/mens/worldcup/26",),
        allowed_hosts=("fifa.com", "www.fifa.com"),
        venue_data={
            "name": "Centennial Olympic Park",
            "slug": "centennial-olympic-park",
            "address": "265 Park Ave W NW",
            "neighborhood": "Downtown",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30313",
            "venue_type": "park",
            "spot_type": "park",
            "website": "https://www.gwcca.org/centennial-olympic-park",
        },
        description=(
            "FIFA Fan Festival Atlanta citywide fan experience tied to the FIFA World Cup 26 "
            "tournament window, including watch parties and public programming."
        ),
        category="community",
        subcategory="fan_festival",
        tags=("fifa", "world-cup", "fan-festival", "atlanta"),
        is_tentpole=True,
        force_event_model=True,
        append_year_to_title=False,
    ),
}


def _host_allowed(url: str, allowed_hosts: tuple[str, ...]) -> bool:
    host = (urlparse(url).netloc or "").lower()
    return host in allowed_hosts


def _parse_year(value: Optional[str], fallback_year: Optional[int]) -> Optional[int]:
    if value:
        year = int(value)
        if year < 100:
            return 2000 + year
        return year
    return fallback_year


def _safe_date(year: int, month: int, day: int) -> Optional[date]:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _parse_phrase_to_window(phrase: str, fallback_year: Optional[int]) -> Optional[tuple[date, date]]:
    cleaned = re.sub(r"\s+", " ", phrase.strip()).replace("–", "-")

    numeric_range = re.search(
        r"(\d{1,2})/(\d{1,2})/(\d{2,4})\s*-\s*(\d{1,2})/(\d{1,2})/(\d{2,4})",
        cleaned,
    )
    if numeric_range:
        m1, d1, y1, m2, d2, y2 = numeric_range.groups()
        y1n = _parse_year(y1, fallback_year)
        y2n = _parse_year(y2, fallback_year)
        if y1n and y2n:
            start = _safe_date(y1n, int(m1), int(d1))
            end = _safe_date(y2n, int(m2), int(d2))
            if start and end:
                return (start, end if end >= start else start)

    month_tokens = "|".join(sorted(_MONTHS.keys(), key=len, reverse=True))
    multi_month = re.search(
        rf"\b({month_tokens})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*-\s*"
        rf"({month_tokens})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,\s*(\d{{4}}))?",
        cleaned,
        re.IGNORECASE,
    )
    if multi_month:
        m1, d1, m2, d2, y = multi_month.groups()
        year = _parse_year(y, fallback_year)
        if year:
            start = _safe_date(year, _MONTHS[m1.lower().rstrip(".")], int(d1))
            end = _safe_date(year, _MONTHS[m2.lower().rstrip(".")], int(d2))
            if start and end:
                if end < start:
                    end = _safe_date(year + 1, end.month, end.day) or start
                return (start, end)

    same_month = re.search(
        rf"\b({month_tokens})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*-\s*(\d{{1,2}})(?:st|nd|rd|th)?(?:,\s*(\d{{4}}))?",
        cleaned,
        re.IGNORECASE,
    )
    if same_month:
        m, d1, d2, y = same_month.groups()
        year = _parse_year(y, fallback_year)
        if year:
            month = _MONTHS[m.lower().rstrip(".")]
            start = _safe_date(year, month, int(d1))
            end = _safe_date(year, month, int(d2))
            if start and end:
                return (start, end if end >= start else start)

    single_day = re.search(
        rf"\b({month_tokens})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,\s*(\d{{4}}))?",
        cleaned,
        re.IGNORECASE,
    )
    if single_day:
        m, d, y = single_day.groups()
        year = _parse_year(y, fallback_year)
        if year:
            day = _safe_date(year, _MONTHS[m.lower().rstrip(".")], int(d))
            if day:
                return (day, day)

    return None


def _extract_window(slug: str, page_title: str, body_text: str) -> Optional[tuple[date, date]]:
    combined = f"{page_title}\n{body_text}"
    today = date.today()

    if slug == "piedmont-park-arts-festival":
        match = re.search(
            r"Piedmont Park Arts Festival[^\\n:]*[:\\-]?\s*([A-Za-z]+\s+\d{1,2}\s*[-–]\s*\d{1,2},\s*\d{4})",
            combined,
            re.IGNORECASE,
        )
        if match:
            return _parse_phrase_to_window(match.group(1), fallback_year=None)

    if slug == "atlanta-greek-picnic":
        match = re.search(
            r"AGP Fest\s*(\d{4}).{0,80}?(June\s+\d{1,2}(?:st|nd|rd|th)?\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?)",
            combined,
            re.IGNORECASE | re.DOTALL,
        )
        if match:
            year = int(match.group(1))
            return _parse_phrase_to_window(match.group(2), fallback_year=year)

    if slug == "taste-of-soul-atlanta":
        match = re.search(
            r"([A-Za-z]+\s+\d{1,2}\s*[-–]\s*\d{1,2},\s*\d{4})",
            combined,
            re.IGNORECASE,
        )
        if match:
            return _parse_phrase_to_window(match.group(1), fallback_year=None)

    generic_candidates: list[tuple[date, date]] = []
    month_tokens = "|".join(sorted(_MONTHS.keys(), key=len, reverse=True))

    patterns = [
        rf"\b({month_tokens})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?\s*[-–]\s*({month_tokens})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,\s*\d{{4}}",
        rf"\b({month_tokens})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?\s*[-–]\s*\d{{1,2}}(?:st|nd|rd|th)?,\s*\d{{4}}",
        rf"\b({month_tokens})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,\s*\d{{4}}",
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\s*[-–]\s*\d{1,2}/\d{1,2}/\d{2,4}\b",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, combined, re.IGNORECASE):
            window = _parse_phrase_to_window(match.group(0), fallback_year=None)
            if window:
                generic_candidates.append(window)

    if not generic_candidates:
        return None

    upcoming = [w for w in generic_candidates if w[0] >= today]
    if upcoming:
        return sorted(upcoming, key=lambda w: (w[0], w[1]))[0]
    return sorted(generic_candidates, key=lambda w: (w[0], w[1]), reverse=True)[0]


def _resolve_known_window(slug: str, *, today: date) -> Optional[tuple[date, date]]:
    known = _KNOWN_WINDOWS_BY_SLUG.get(slug) or {}
    if not known:
        return None

    candidate_years = (today.year, today.year + 1)
    for year in candidate_years:
        if year not in known:
            continue
        start_iso, end_iso = known[year]
        return date.fromisoformat(start_iso), date.fromisoformat(end_iso)

    latest_year = max(known)
    start_iso, end_iso = known[latest_year]
    return date.fromisoformat(start_iso), date.fromisoformat(end_iso)


def _hydrate_festival_metadata(
    source_slug: str,
    selected_url: str,
    description: str,
    start_date: date,
    end_date: date,
) -> None:
    client = get_client()
    festival_rows = (
        client.table("festivals")
        .select("id,slug")
        .eq("slug", source_slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not festival_rows:
        return

    festival_id = festival_rows[0]["id"]
    client.table("festivals").update(
        {
            "website": selected_url,
            "announced_start": start_date.isoformat(),
            "announced_end": end_date.isoformat() if end_date >= start_date else start_date.isoformat(),
            "description": description,
        }
    ).eq("id", festival_id).execute()

    client.table("series").update({"description": description}).eq("festival_id", festival_id).execute()


def _demote_festival_container_if_present(source_slug: str) -> None:
    """Unlink and remove festival container rows for sources using event model."""
    client = get_client()
    festival_rows = (
        client.table("festivals")
        .select("id,slug")
        .eq("slug", source_slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not festival_rows:
        return

    festival_id = festival_rows[0]["id"]
    client.table("events").update({"festival_id": None}).eq("festival_id", festival_id).execute()
    client.table("series").update({"festival_id": None}).eq("festival_id", festival_id).execute()
    client.table("festivals").delete().eq("id", festival_id).execute()
    logger.info("Demoted festival container to event model for slug: %s", source_slug)


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    slug = source.get("slug") or ""
    config = CONFIGS.get(slug)
    if not config:
        logger.warning("No annual_tentpoles config for slug: %s", slug)
        return 0, 0, 0

    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(config.venue_data)

    today = date.today()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        selected_url = None
        page_title = ""
        body_text = ""

        for candidate_url in config.urls:
            try:
                response = page.goto(candidate_url, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(2000)
                final_url = page.url or candidate_url
                status = response.status if response else None
                if status and status >= 400:
                    logger.warning("Skipping %s candidate due HTTP %s: %s", slug, status, final_url)
                    continue
                if not _host_allowed(final_url, config.allowed_hosts):
                    logger.warning("Skipping %s candidate due off-domain redirect: %s", slug, final_url)
                    continue
                text = page.inner_text("body").strip()
                if len(text) < 20:
                    continue
                selected_url = final_url
                page_title = page.title() or ""
                body_text = text
                break
            except Exception as err:
                logger.warning("Failed %s candidate %s: %s", slug, candidate_url, err)

        browser.close()

    window = _extract_window(slug, page_title, body_text) if selected_url else None
    if not window:
        window = _resolve_known_window(slug, today=today)

    if not selected_url:
        if not window:
            logger.warning("No reachable candidate URL for %s", slug)
            return 0, 0, 0
        selected_url = config.urls[0]
        logger.info("Using known date window fallback for %s without successful fetch", slug)

    if not window:
        logger.warning("No date window found for %s at %s", slug, selected_url)
        return 0, 0, 0

    start_date, end_date = window
    event_year = start_date.year
    title = (
        f"{config.base_title} {event_year}"
        if config.append_year_to_title
        else config.base_title
    )
    content_hash = generate_content_hash(title, config.venue_data["name"], start_date.isoformat())

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": config.description,
        "start_date": start_date.isoformat(),
        "start_time": None,
        "end_date": end_date.isoformat() if end_date > start_date else None,
        "end_time": None,
        "is_all_day": True,
        "category": config.category,
        "subcategory": config.subcategory,
        "tags": list(config.tags),
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": False,
        "is_tentpole": config.is_tentpole,
        "source_url": selected_url,
        "ticket_url": selected_url,
        "image_url": None,
        "raw_text": f"{config.base_title} window {start_date.isoformat()} to {end_date.isoformat()}",
        "extraction_confidence": 0.85,
        "is_recurring": True,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    events_found = 1
    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        events_updated = 1
    else:
        insert_event(event_record)
        events_new = 1
        logger.info("Added %s (%s to %s)", title, start_date.isoformat(), end_date.isoformat())

    if config.force_event_model:
        _demote_festival_container_if_present(source_slug=slug)
    elif config.should_hydrate_festival:
        _hydrate_festival_metadata(
            source_slug=slug,
            selected_url=selected_url,
            description=config.description,
            start_date=start_date,
            end_date=end_date,
        )

    return events_found, events_new, events_updated
