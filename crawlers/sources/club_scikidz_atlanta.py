"""
Crawler for Club SciKidz Atlanta summer camps.

Source surfaces:
  - Locations page with weekly camp grids and host-site addresses
  - Individual camp detail pages with concept metadata and dated ACTIVE links

Strategy:
  - Build a venue map from the public locations page
  - Extract unique scheduled camp concept URLs from that same page
  - Fetch each camp detail page and emit one event per dated ACTIVE session link
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlanta.clubscikidz.com"
LOCATIONS_URL = f"{BASE_URL}/camp-locations/"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_DELAY = 0.35

SESSION_LINK_RE = re.compile(
    r"(?P<month>\d{1,2})/(?P<day>\d{1,2})\s+(?P<year>\d{4})\s+At\s+(?P<location>.+)",
    re.IGNORECASE,
)
AGE_RANGE_RE = re.compile(r"Ages?\s+(\d+)\s*-\s*(\d+)", re.IGNORECASE)
PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")
DURATION_RE = re.compile(r"(\d+)\s+Days?", re.IGNORECASE)
ADDRESS_RE = re.compile(
    r"(?P<address>[^,]+),?\s+(?P<city>[A-Za-z .'-]+),\s*GA\s+(?P<zip>\d{5})"
)
TIME_RANGE_RE = re.compile(
    r"(?P<start>\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)\s*(?:-|to)\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]m)",
    re.IGNORECASE,
)

BASE_TAGS = [
    "kids",
    "family-friendly",
    "stem",
    "educational",
    "seasonal",
    "rsvp-required",
]


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def _normalize_location_key(name: str) -> str:
    key = _clean_text(name).lower()
    key = key.replace("&", "and")
    key = re.sub(r"\(.*?\)", "", key)
    key = key.replace("/", " ")
    key = re.sub(r"\bchurch\b", "", key)
    key = re.sub(r"\bpresbyterian\b", "presbyterian", key)
    key = re.sub(r"\bumc\b", "", key)
    key = re.sub(r"\batlanta\b", "", key)
    key = re.sub(r"\bdecatur\b", "", key)
    key = re.sub(r"\bduluth\b", "", key)
    key = re.sub(r"\bwest cobb\b", "", key)
    key = re.sub(r"\bpeachtree city\b", "", key)
    key = re.sub(r"\balpharetta\b", "", key)
    key = re.sub(r"[^a-z0-9]+", " ", key)
    return re.sub(r"\s+", " ", key).strip()


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 5 and age_max >= 3:
        tags.append("preschool")
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 13 and age_max >= 10:
        tags.append("tween")
    if age_max >= 13:
        tags.append("teen")
    return tags


def _parse_age_range(text: str) -> tuple[Optional[int], Optional[int], list[str]]:
    match = AGE_RANGE_RE.search(text or "")
    if not match:
        return None, None, []
    age_min = int(match.group(1))
    age_max = int(match.group(2))
    return age_min, age_max, _age_band_tags(age_min, age_max)


def _parse_price_range(text: str) -> tuple[Optional[float], Optional[float]]:
    amounts = [float(value) for value in PRICE_RE.findall(text or "")]
    if not amounts:
        return None, None
    return min(amounts), max(amounts)


def _parse_duration_days(text: str) -> Optional[int]:
    match = DURATION_RE.search(text or "")
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _normalize_time_value(raw: str, fallback_ampm: Optional[str] = None) -> Optional[str]:
    cleaned = _clean_text(raw).lower().replace(".", "")
    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*([ap]m)?", cleaned)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or "00")
    ampm = match.group(3) or (fallback_ampm.lower() if fallback_ampm else None)
    if not ampm:
        return None
    if match.group(3) is None and fallback_ampm and fallback_ampm.lower() == "pm" and hour < 12:
        ampm = "am"
    if ampm == "pm" and hour != 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _parse_schedule_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
    combined = _clean_text(text)
    if not combined:
        return None, None

    explicit_patterns = (
        r"full\s*day[^.]*?(?P<start>\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:-|to)\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]m)",
        r"monday\s*-\s*friday[^.]*?(?P<start>\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:-|to)\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]m)",
        r"our week is[^.]*?(?P<start>\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:-|to)\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]m)",
    )
    for pattern in explicit_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            end_ampm = re.search(r"([ap]m)", match.group("end"), re.IGNORECASE)
            fallback_ampm = end_ampm.group(1) if end_ampm else None
            return _normalize_time_value(match.group("start"), fallback_ampm), _normalize_time_value(match.group("end"))

    match = TIME_RANGE_RE.search(combined)
    if not match:
        return None, None
    end_ampm = re.search(r"([ap]m)", match.group("end"), re.IGNORECASE)
    fallback_ampm = end_ampm.group(1) if end_ampm else None
    return _normalize_time_value(match.group("start"), fallback_ampm), _normalize_time_value(match.group("end"))


def _get_soup(url: str, session: requests.Session) -> Optional[BeautifulSoup]:
    try:
        response = session.get(url, timeout=20)
        response.raise_for_status()
    except Exception as exc:
        logger.warning("[club-scikidz] Failed to fetch %s: %s", url, exc)
        return None
    return BeautifulSoup(response.text, "html.parser")


def _extract_address_parts(raw_address: str) -> dict:
    cleaned = _clean_text(raw_address).replace("(Click Here For Map)", "").strip()
    match = ADDRESS_RE.search(cleaned)
    if not match:
        return {
            "address": cleaned,
            "city": "Atlanta",
            "state": "GA",
            "zip": None,
        }
    return {
        "address": _clean_text(match.group("address")),
        "city": _clean_text(match.group("city")),
        "state": "GA",
        "zip": match.group("zip"),
    }


def _build_venue_data(name: str, raw_address: str, anchor_name: Optional[str]) -> dict:
    address_parts = _extract_address_parts(raw_address)
    venue_name = _clean_text(name)
    return {
        "name": venue_name,
        "slug": f"club-scikidz-{_slugify(venue_name)}",
        "address": address_parts["address"],
        "city": address_parts["city"],
        "state": address_parts["state"],
        "zip": address_parts["zip"],
        "neighborhood": address_parts["city"],
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": (f"{LOCATIONS_URL}#{anchor_name}" if anchor_name else LOCATIONS_URL),
        "vibes": ["family-friendly", "educational"],
    }


def _parse_locations_page(soup: BeautifulSoup) -> tuple[dict[str, dict], set[str]]:
    venue_map: dict[str, dict] = {}
    concept_urls: set[str] = set()

    current_anchor: Optional[str] = None
    for anchor in soup.select("p.location-anchor a[name]"):
        current_anchor = anchor.get("name")
        schedule = anchor.find_parent("p", class_="location-anchor")
        if not schedule:
            continue
        location_schedule = schedule.find_next_sibling(
            "div", class_="location-schedule"
        )
        if not location_schedule:
            continue

        name_node = location_schedule.find("h2")
        address_node = location_schedule.find("div", class_="location-address")
        if not name_node or not address_node:
            continue

        venue_name = _clean_text(name_node.get_text(" ", strip=True))
        venue_data = _build_venue_data(
            venue_name,
            address_node.get_text(" ", strip=True),
            current_anchor,
        )
        venue_map[_normalize_location_key(venue_name)] = venue_data

        for camp_link in location_schedule.select(".age-group a[href]"):
            href = urljoin(BASE_URL, camp_link["href"])
            if "/summer-camps/" not in href:
                continue
            concept_urls.add(href)

    return venue_map, concept_urls


def _extract_camp_description(entry_content: Tag) -> Optional[str]:
    paragraphs: list[str] = []
    for node in entry_content.find_all(["p", "li"]):
        text = _clean_text(node.get_text(" ", strip=True))
        if not text:
            continue
        lowered = text.lower()
        if lowered.startswith("hours & fees") or lowered.startswith(
            "forms & resources"
        ):
            continue
        if lowered.startswith("typical daily schedule") or lowered.startswith(
            "downloads"
        ):
            continue
        paragraphs.append(text)
        if len(" ".join(paragraphs)) > 900:
            break

    description = _clean_text(" ".join(paragraphs))
    return description[:1000] if description else None


def _parse_session_link_text(text: str) -> tuple[Optional[str], Optional[str]]:
    match = SESSION_LINK_RE.search(_clean_text(text))
    if not match:
        return None, None
    try:
        start_date = datetime(
            int(match.group("year")),
            int(match.group("month")),
            int(match.group("day")),
        ).strftime("%Y-%m-%d")
    except ValueError:
        return None, None
    return start_date, _clean_text(match.group("location"))


def _parse_camp_page(soup: BeautifulSoup, camp_url: str) -> Optional[dict]:
    title_node = soup.select_one("h1")
    age_node = next(
        (
            node
            for node in soup.select("h2")
            if _clean_text(node.get_text(" ", strip=True))
            .lower()
            .startswith("age group:")
        ),
        None,
    )
    entry_content = soup.select_one(".entry-content")
    details_box = soup.select_one(".camp-details-box")
    sessions_group = soup.select_one(".sessions-group")

    if not title_node or not entry_content or not details_box or not sessions_group:
        return None

    title = _clean_text(title_node.get_text(" ", strip=True))
    age_text = _clean_text(age_node.get_text(" ", strip=True)) if age_node else ""
    age_min, age_max, age_tags = _parse_age_range(age_text)

    duration_days = _parse_duration_days(details_box.get_text(" ", strip=True)) or 5

    price_note = next(
        (
            _clean_text(node.get_text(" ", strip=True))
            for node in entry_content.find_all(["h3", "p"])
            if "cost" in _clean_text(node.get_text(" ", strip=True)).lower()
        ),
        None,
    )
    if not price_note:
        price_note = _clean_text(details_box.get_text(" ", strip=True))
    price_min, price_max = _parse_price_range(price_note or "")

    description = _extract_camp_description(entry_content)
    schedule_start_time, schedule_end_time = _parse_schedule_time_range(entry_content.get_text(" ", strip=True))

    category_links = [
        _clean_text(a.get_text(" ", strip=True))
        for a in entry_content.select('a[href*="/camp-categories/"]')
        if _clean_text(a.get_text(" ", strip=True))
    ]

    sessions: list[dict] = []
    for link in sessions_group.select("a[href*='session=']"):
        href = urljoin(camp_url, link["href"])
        start_date, location_name = _parse_session_link_text(
            link.get_text(" ", strip=True)
        )
        if not start_date or not location_name:
            continue
        session_id = parse_qs(urlparse(href).query).get("session", [None])[0]
        end_date = None
        try:
            end_date = (
                datetime.strptime(start_date, "%Y-%m-%d")
                + timedelta(days=duration_days - 1)
            ).strftime("%Y-%m-%d")
        except ValueError:
            end_date = None
        sessions.append(
            {
                "session_id": session_id,
                "start_date": start_date,
                "end_date": end_date,
                "location_name": location_name,
                "registration_url": href,
                "session_label": _clean_text(link.get_text(" ", strip=True)),
            }
        )

    return {
        "title": title,
        "age_text": age_text,
        "age_min": age_min,
        "age_max": age_max,
        "age_tags": age_tags,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": price_note,
        "duration_days": duration_days,
        "schedule_start_time": schedule_start_time,
        "schedule_end_time": schedule_end_time,
        "description": description,
        "categories": category_links,
        "camp_url": camp_url,
        "sessions": sessions,
    }


def _resolve_venue(location_name: str, venue_map: dict[str, dict]) -> Optional[dict]:
    key = _normalize_location_key(location_name)
    if key in venue_map:
        return venue_map[key]

    for known_key, venue in venue_map.items():
        if key in known_key or known_key in key:
            return venue
    return None


def _build_tags(camp: dict) -> list[str]:
    combined = " ".join([camp["title"], " ".join(camp.get("categories") or [])]).lower()
    tags = list(BASE_TAGS)
    if (
        "robot" in combined
        or "lego" in combined
        or "vex" in combined
        or "drone" in combined
    ):
        tags.append("robotics")
    if (
        "code" in combined
        or "minecraft" in combined
        or "app" in combined
        or "ai" in combined
    ):
        tags.append("coding")
    if "art" in combined or "animation" in combined:
        tags.append("arts")
    if "medical" in combined or "vet" in combined or "science" in combined:
        tags.append("science")
    tags.extend(camp.get("age_tags") or [])
    return sorted({tag for tag in tags if tag})


def _build_event_record(
    *,
    source_id: int,
    venue_id: int,
    venue_name: str,
    camp: dict,
    session: dict,
) -> dict:
    title = f"{camp['title']} at {venue_name}"
    hash_key = session.get("session_id") or session["start_date"]
    content_hash = generate_content_hash(title, venue_name, hash_key)
    schedule_start_time = camp.get("schedule_start_time")
    schedule_end_time = camp.get("schedule_end_time")
    if not schedule_start_time or not schedule_end_time:
        inferred_start_time, inferred_end_time = _parse_schedule_time_range(
            " ".join(
                part for part in [
                    camp.get("description") or "",
                    camp.get("price_note") or "",
                ] if part
            )
        )
        schedule_start_time = schedule_start_time or inferred_start_time
        schedule_end_time = schedule_end_time or inferred_end_time

    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": camp.get("description"),
        "start_date": session["start_date"],
        "start_time": schedule_start_time,
        "end_date": session.get("end_date"),
        "end_time": schedule_end_time,
        "is_all_day": False if schedule_start_time or schedule_end_time else True,
        "category": "programs",
        "subcategory": "camp",
        "tags": _build_tags(camp),
        "price_min": camp.get("price_min"),
        "price_max": camp.get("price_max"),
        "price_note": camp.get("price_note"),
        "is_free": False,
        "source_url": camp["camp_url"],
        "ticket_url": session["registration_url"],
        "image_url": None,
        "raw_text": " | ".join(
            part
            for part in [
                camp["title"],
                camp.get("age_text"),
                ", ".join(camp.get("categories") or []),
                session.get("session_label"),
                camp.get("price_note"),
            ]
            if part
        ),
        "extraction_confidence": 0.93,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
        "is_class": True,
        "class_category": "education",
    }
    if camp.get("age_min") is not None:
        record["age_min"] = camp["age_min"]
    if camp.get("age_max") is not None:
        record["age_max"] = camp["age_max"]
    return record


def crawl(source: dict) -> tuple[int, int, int]:
    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    locations_soup = _get_soup(LOCATIONS_URL, session)
    if locations_soup is None:
        return 0, 0, 0

    venue_map, camp_urls = _parse_locations_page(locations_soup)
    if not camp_urls:
        logger.warning("[club-scikidz] No camp URLs discovered from locations page")
        return 0, 0, 0

    venue_ids: dict[str, int] = {}
    for key, venue_data in venue_map.items():
        venue_ids[key] = get_or_create_venue(venue_data)

    events_found = 0
    events_new = 0
    events_updated = 0
    today = datetime.now().date()

    for camp_url in sorted(camp_urls):
        time.sleep(REQUEST_DELAY)
        camp_soup = _get_soup(camp_url, session)
        if camp_soup is None:
            continue

        camp = _parse_camp_page(camp_soup, camp_url)
        if not camp or not camp["sessions"]:
            continue

        for camp_session in camp["sessions"]:
            try:
                if (
                    datetime.strptime(camp_session["start_date"], "%Y-%m-%d").date()
                    < today
                ):
                    continue
            except ValueError:
                continue

            venue = _resolve_venue(camp_session["location_name"], venue_map)
            if not venue:
                logger.debug(
                    "[club-scikidz] Unmatched location %r for %s",
                    camp_session["location_name"],
                    camp["title"],
                )
                continue

            venue_key = _normalize_location_key(venue["name"])
            event_record = _build_event_record(
                source_id=source["id"],
                venue_id=venue_ids[venue_key],
                venue_name=venue["name"],
                camp=camp,
                session=camp_session,
            )

            events_found += 1
            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
            except Exception as exc:
                logger.error(
                    "[club-scikidz] Failed to insert %s: %s",
                    event_record["title"],
                    exc,
                )

    logger.info(
        "[club-scikidz] complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
