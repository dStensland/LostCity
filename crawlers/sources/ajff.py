"""
Crawler for Atlanta Jewish Film Festival (ajff.org).

Uses AJFF's public JSON API rather than scraping the React shell so we preserve
screening-level dates, ticket links, venues, and images.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    get_or_create_virtual_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://ajff.org"
API_BASE_URL = "https://data.ajff.org"
LISTING_PATH = "/films"
PAGE_LIMIT = 50
REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)",
    "Accept": "application/vnd.api+json, application/json;q=0.9, */*;q=0.8",
}
PHYSICAL_INCLUDE = (
    "field_space,"
    "field_space.field_venue,"
    "field_offering,"
    "field_offering.field_feature_film,"
    "field_offering.field_feature_film.field_hero_image,"
    "field_offering.field_feature_film.field_hero_image.field_media_image,"
    "field_offering.field_hero_image,"
    "field_offering.field_hero_image.field_media_image"
)
VIRTUAL_INCLUDE = PHYSICAL_INCLUDE
FESTIVAL_INCLUDE = (
    "field_heroes,"
    "field_heroes.field_hero_image,"
    "field_heroes.field_hero_image.field_media_image"
)
IMAGE_STYLE_PRIORITY = (
    "ajff_rec_slider",
    "ajff_org_hero",
    "ajff_org_large_no_crop",
    "ajff_rec_hero",
    "ajff_org_small_no_crop",
    "ajff_org_small",
)
SKIP_SALE_STATUSES = {"date_passed", "cancelled"}
FESTIVAL_VENUE = {
    "name": "Atlanta Jewish Film Festival",
    "slug": "atlanta-jewish-film-festival",
    "address": "Atlanta, GA",
    "city": "Atlanta",
    "state": "GA",
    "zip": None,
    "place_type": "festival",
    "website": BASE_URL,
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(str(value).split()).strip()


def _strip_html(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    soup = BeautifulSoup(value, "html.parser")
    for img in soup.find_all("img"):
        img.decompose()
    text = _clean_text(soup.get_text(" ", strip=True))
    return text or None


def _extract_meta_description(entity: Optional[dict]) -> Optional[str]:
    if not entity:
        return None
    for tag in entity.get("attributes", {}).get("meta", []) or []:
        attrs = tag.get("attributes") or {}
        if attrs.get("name") == "description" and attrs.get("content"):
            return _clean_text(attrs["content"])
    return None


def _parse_iso_datetime(value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not value:
        return None, None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None, None
    return dt.date().isoformat(), dt.strftime("%H:%M")


def _normalize_ongoing_dates(
    start_date: Optional[str],
    end_date: Optional[str],
    today_iso: Optional[str] = None,
) -> tuple[Optional[str], Optional[str]]:
    """Keep active multi-day windows visible by normalizing open starts to today."""
    if not start_date:
        return start_date, end_date
    today_iso = today_iso or date.today().isoformat()
    if end_date and start_date < today_iso <= end_date:
        return today_iso, end_date
    return start_date, end_date


def _entity_from_relationship(
    entity: Optional[dict], relationship_name: str, included: dict[tuple[str, str], dict]
) -> Optional[dict]:
    if not entity:
        return None
    rel = (entity.get("relationships") or {}).get(relationship_name, {})
    data = rel.get("data")
    if not isinstance(data, dict):
        return None
    return included.get((data.get("type"), data.get("id")))


def _first_entity_from_relationship(
    entity: Optional[dict], relationship_name: str, included: dict[tuple[str, str], dict]
) -> Optional[dict]:
    if not entity:
        return None
    rel = (entity.get("relationships") or {}).get(relationship_name, {})
    data = rel.get("data")
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            return included.get((first.get("type"), first.get("id")))
    if isinstance(data, dict):
        return included.get((data.get("type"), data.get("id")))
    return None


def _build_web_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{BASE_URL}{path}"


def _canonical_path_from_resolved_url(resolved_url: str) -> str:
    path = urlparse(resolved_url).path or ""
    if path.startswith("/super-shopper/"):
        path = path.removeprefix("/super-shopper/")
    return path.lstrip("/")


def _image_url_from_file(file_entity: Optional[dict]) -> Optional[str]:
    if not file_entity:
        return None

    links = file_entity.get("links") or {}
    for key in IMAGE_STYLE_PRIORITY:
        href = (links.get(key) or {}).get("href")
        if href:
            return href

    for value in links.values():
        if isinstance(value, dict) and value.get("href"):
            return value["href"]

    uri = (file_entity.get("attributes") or {}).get("uri")
    if isinstance(uri, dict):
        return _build_web_url(uri.get("url") or uri.get("value"))
    return None


def _image_url_from_entity(
    entity: Optional[dict], included: dict[tuple[str, str], dict]
) -> Optional[str]:
    if not entity:
        return None
    media = _entity_from_relationship(entity, "field_hero_image", included)
    file_entity = _entity_from_relationship(media, "field_media_image", included)
    return _image_url_from_file(file_entity)


def _build_source_url(offering: Optional[dict], film: Optional[dict]) -> str:
    for entity in (offering, film):
        if not entity:
            continue
        attrs = entity.get("attributes") or {}
        path = (attrs.get("path") or {}).get("alias") or attrs.get("field_path")
        url = _build_web_url(path)
        if url:
            return url
    return f"{BASE_URL}{LISTING_PATH}"


def _infer_venue_type(name: str, parent_name: str) -> str:
    combined = f"{name} {parent_name}".lower()
    if "cinema" in combined:
        return "cinema"
    if "theater" in combined or "theatre" in combined or "auditorium" in combined:
        return "theater"
    if "museum" in combined:
        return "museum"
    if "synagogue" in combined:
        return "synagogue"
    if "temple" in combined:
        return "temple"
    if "center" in combined or "centre" in combined:
        return "arts_center"
    return "venue"


def _build_venue_data(space: Optional[dict], venue: Optional[dict]) -> dict:
    space_attrs = (space or {}).get("attributes") or {}
    venue_attrs = (venue or {}).get("attributes") or {}
    name = (
        space_attrs.get("title")
        or venue_attrs.get("title")
        or "Atlanta Jewish Film Festival"
    )
    parent_name = venue_attrs.get("title") or ""
    address = venue_attrs.get("field_address") or {}
    website_path = (venue_attrs.get("path") or {}).get("alias") or venue_attrs.get(
        "field_path"
    )

    return {
        "name": name,
        "slug": f"ajff-{slugify(name)}"[:120],
        "address": address.get("address_line1") or None,
        "city": address.get("locality") or "Atlanta",
        "state": address.get("administrative_area") or "GA",
        "zip": address.get("postal_code") or None,
        "place_type": _infer_venue_type(name, parent_name),
        "website": _build_web_url(website_path) or BASE_URL,
    }


def _build_description(
    *,
    base_description: Optional[str],
    sale_status: str,
    is_virtual: bool,
    release_window: Optional[str],
    geo_block: Optional[str],
    has_qa: Optional[bool],
) -> Optional[str]:
    parts: list[str] = []
    base = _clean_text(base_description)
    if base:
        parts.append(base)

    if has_qa:
        parts.append("Includes a Q&A component.")

    if is_virtual and release_window:
        parts.append(f"Streaming window: {release_window}.")

    if is_virtual and geo_block:
        parts.append(f"Streaming access is restricted to viewers in {geo_block}.")

    if sale_status == "sold_out":
        parts.append("Currently sold out.")

    description = " ".join(parts).strip()
    return description[:1800] if description else None


def _build_price_note(
    *,
    sale_status: str,
    is_virtual: bool,
    release_window: Optional[str],
    geo_block: Optional[str],
) -> Optional[str]:
    parts: list[str] = []
    if sale_status == "sold_out":
        parts.append("Sold out")

    if is_virtual and release_window:
        parts.append(release_window)

    if is_virtual and geo_block:
        parts.append(f"Geo-blocked to {geo_block}")

    if not parts:
        return None
    return ". ".join(parts)


def _should_keep_item(
    attributes: dict,
    *,
    is_virtual: bool,
    today_iso: str,
) -> bool:
    sale_status = str(attributes.get("field_sale_status") or "").strip().lower()
    if sale_status in SKIP_SALE_STATUSES:
        return False

    if is_virtual:
        end_date, _ = _parse_iso_datetime(attributes.get("field_end_date"))
        if end_date and end_date < today_iso:
            return False
        return True

    start_date, _ = _parse_iso_datetime(attributes.get("field_date_time"))
    return bool(start_date and start_date >= today_iso)


def _fetch_json(
    session: requests.Session, path_or_url: str, params: Optional[dict] = None
) -> dict:
    url = (
        path_or_url
        if path_or_url.startswith("http://") or path_or_url.startswith("https://")
        else f"{API_BASE_URL}{path_or_url}"
    )
    response = session.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _get_current_festival(
    session: requests.Session,
) -> tuple[str, dict]:
    listing_translation = _fetch_json(
        session,
        "/router/translate-path",
        {"path": LISTING_PATH, "_format": "json"},
    )
    resolved_url = listing_translation.get("resolved")
    if not resolved_url:
        raise ValueError("AJFF translate-path did not return a resolved festival URL")

    canonical_path = _canonical_path_from_resolved_url(resolved_url)
    festival_translation = _fetch_json(
        session,
        "/router/translate-path",
        {"path": canonical_path, "_format": "json"},
    )
    jsonapi = festival_translation.get("jsonapi") or {}
    festival_url = jsonapi.get("individual")
    festival_uuid = ((festival_translation.get("entity") or {}).get("uuid") or "").strip()
    if not festival_url or not festival_uuid:
        raise ValueError("AJFF festival translation is missing jsonapi festival metadata")

    return festival_uuid, _fetch_json(session, festival_url, {"include": FESTIVAL_INCLUDE})


def _fetch_happenings(
    session: requests.Session,
    *,
    endpoint: str,
    festival_uuid: str,
    date_sort_field: str,
    include: str,
) -> tuple[list[dict], dict[tuple[str, str], dict]]:
    offset = 0
    items: list[dict] = []
    included: dict[tuple[str, str], dict] = {}

    while True:
        payload = _fetch_json(
            session,
            f"/api/happening/{endpoint}",
            {
                "filter[festival][path]": "field_festival_series.id",
                "filter[festival][value]": festival_uuid,
                "sort[title][path]": "field_offering.field_sort_title",
                "sort[title][direction]": "ASC",
                "sort[date][path]": date_sort_field,
                "sort[date][direction]": "ASC",
                "include": include,
                "page[offset]": str(offset),
                "page[limit]": str(PAGE_LIMIT),
            },
        )

        batch = payload.get("data") or []
        if not batch:
            break

        items.extend(batch)
        for entity in payload.get("included") or []:
            included[(entity.get("type"), entity.get("id"))] = entity

        if len(batch) < PAGE_LIMIT:
            break
        offset += len(batch)

    return items, included


def _build_event_record(
    item: dict,
    included: dict[tuple[str, str], dict],
    *,
    today_iso: str,
) -> Optional[dict]:
    attributes = item.get("attributes") or {}
    is_virtual = item.get("type") == "happening--virtual_screening"

    if not _should_keep_item(attributes, is_virtual=is_virtual, today_iso=today_iso):
        return None

    offering = _entity_from_relationship(item, "field_offering", included)
    feature_film = _entity_from_relationship(offering, "field_feature_film", included)

    offering_attrs = (offering or {}).get("attributes") or {}
    film_attrs = (feature_film or {}).get("attributes") or {}

    title = _clean_text(
        offering_attrs.get("title")
        or film_attrs.get("title")
        or attributes.get("name")
    )
    if not title:
        return None

    synopsis = (
        _strip_html(offering_attrs.get("field_synopsis"))
        or _clean_text(offering_attrs.get("field_teaser"))
        or _extract_meta_description(offering)
        or _strip_html(film_attrs.get("field_synopsis"))
        or _clean_text(film_attrs.get("field_teaser"))
        or _extract_meta_description(feature_film)
    )

    sale_status = str(attributes.get("field_sale_status") or "").strip().lower()
    release_window = _clean_text(attributes.get("field_release_window_qualifier"))
    geo_block = _clean_text(attributes.get("field_geo_block"))

    source_url = _build_source_url(offering, feature_film)
    image_url = _image_url_from_entity(offering, included) or _image_url_from_entity(
        feature_film, included
    )
    ticket_url = ((attributes.get("field_ticket_purchase_url") or {}).get("url") or None)

    tags = ["film", "festival", "jewish", "ajff"]

    if is_virtual:
        original_start_date, _ = _parse_iso_datetime(attributes.get("field_start_date"))
        end_date, _ = _parse_iso_datetime(attributes.get("field_end_date"))
        start_date, end_date = _normalize_ongoing_dates(
            original_start_date, end_date, today_iso
        )
        hash_basis = f"{original_start_date or ''}|{end_date or ''}"
        content_hash = generate_content_hash(title, "Online / Virtual Event", hash_basis)
        tags.append("virtual-cinema")
        place_data = None
        start_time = None
        end_time = None
        is_all_day = True
    else:
        start_date, start_time = _parse_iso_datetime(attributes.get("field_date_time"))
        end_date = None
        end_time = None
        space = _entity_from_relationship(item, "field_space", included)
        venue = _entity_from_relationship(space, "field_venue", included)
        place_data = _build_venue_data(space, venue)
        venue_name = place_data["name"]
        hash_basis = f"{start_date or ''}|{start_time or ''}"
        content_hash = generate_content_hash(title, venue_name, hash_basis)
        is_all_day = False

    return {
        "title": title,
        "description": _build_description(
            base_description=synopsis,
            sale_status=sale_status,
            is_virtual=is_virtual,
            release_window=release_window or None,
            geo_block=geo_block or None,
            has_qa=attributes.get("field_has_q_a"),
        ),
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "is_all_day": is_all_day,
        "category": "film",
        "subcategory": "festival",
        "tags": tags,
        "price_min": None,
        "price_max": None,
        "price_note": _build_price_note(
            sale_status=sale_status,
            is_virtual=is_virtual,
            release_window=release_window or None,
            geo_block=geo_block or None,
        ),
        "is_free": False,
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
        "is_virtual": is_virtual,
        "venue_data": place_data,
    }


def _build_tentpole_event_record(
    festival_payload: dict,
    *,
    today_iso: str,
) -> dict:
    festival = festival_payload.get("data") or {}
    attrs = festival.get("attributes") or {}
    included = {
        (entity.get("type"), entity.get("id")): entity
        for entity in (festival_payload.get("included") or [])
    }

    original_start_date = _clean_text(attrs.get("field_start_date"))
    original_end_date = _clean_text(attrs.get("field_end_date"))
    start_date, end_date = _normalize_ongoing_dates(
        original_start_date or None,
        original_end_date or None,
        today_iso=today_iso,
    )
    if not start_date:
        raise ValueError("AJFF festival payload missing field_start_date")

    hero = _first_entity_from_relationship(festival, "field_heroes", included)
    hero_attrs = (hero or {}).get("attributes") or {}
    hero_body = _strip_html(((hero_attrs.get("field_body") or {}).get("processed")))
    teaser = _clean_text(attrs.get("field_teaser"))
    meta_description = _extract_meta_description(festival)
    description_parts = []
    for part in (meta_description, teaser, hero_body):
        cleaned = _clean_text(part)
        if cleaned and cleaned not in description_parts:
            description_parts.append(cleaned)

    title = _clean_text(attrs.get("title")) or "Atlanta Jewish Film Festival"
    source_url = _build_web_url((attrs.get("path") or {}).get("alias") or attrs.get("field_path")) or f"{BASE_URL}{LISTING_PATH}"
    ticket_url = f"{BASE_URL}{LISTING_PATH}"
    image_url = _image_url_from_entity(hero, included)
    content_hash = generate_content_hash(
        title,
        FESTIVAL_VENUE["name"],
        f"{original_start_date}|{original_end_date}",
    )

    price_note = None
    if teaser:
        price_note = teaser
    ticketing_status = _clean_text(attrs.get("field_ticketing_status"))
    if ticketing_status == "on_sale" and not price_note:
        price_note = "Now on sale"

    return {
        "title": title,
        "description": " ".join(description_parts) if description_parts else None,
        "start_date": start_date,
        "start_time": None,
        "end_date": original_end_date or end_date,
        "end_time": None,
        "is_all_day": True,
        "category": "film",
        "subcategory": "festival",
        "tags": ["film", "festival", "jewish", "ajff", "tentpole"],
        "price_min": None,
        "price_max": None,
        "price_note": price_note,
        "is_free": False,
        "is_tentpole": True,
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
        "venue_data": FESTIVAL_VENUE,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl AJFF screenings from the current festival series API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()
    today_iso = date.today().isoformat()

    try:
        session = requests.Session()
        session.headers.update(REQUEST_HEADERS)

        festival_uuid, festival_payload = _get_current_festival(session)
        festival = festival_payload.get("data") or {}
        festival_title = _clean_text(
            (festival.get("attributes") or {}).get("title")
            or (festival.get("attributes") or {}).get("name")
            or festival.get("label")
        )
        logger.info("Resolved AJFF festival: %s (%s)", festival_title or "unknown", festival_uuid)

        tentpole_record = _build_tentpole_event_record(
            festival_payload,
            today_iso=today_iso,
        )
        tentpole_hash = tentpole_record["content_hash"]
        seen_hashes.add(tentpole_hash)
        events_found += 1

        festival_venue_id = get_or_create_place(tentpole_record.pop("venue_data"))
        tentpole_record["source_id"] = source_id
        tentpole_record["venue_id"] = festival_venue_id

        existing = find_event_by_hash(tentpole_hash)
        if existing:
            smart_update_existing_event(existing, tentpole_record)
            events_updated += 1
        else:
            insert_event(tentpole_record)
            events_new += 1

        physical_items, physical_included = _fetch_happenings(
            session,
            endpoint="screening",
            festival_uuid=festival_uuid,
            date_sort_field="field_date_time",
            include=PHYSICAL_INCLUDE,
        )
        virtual_items, virtual_included = _fetch_happenings(
            session,
            endpoint="virtual_screening",
            festival_uuid=festival_uuid,
            date_sort_field="field_start_date",
            include=VIRTUAL_INCLUDE,
        )

        venue_cache: dict[str, int] = {}
        virtual_venue_id: Optional[int] = None

        for item, included in [(entry, physical_included) for entry in physical_items]:
            event_record = _build_event_record(item, included, today_iso=today_iso)
            if not event_record:
                continue

            content_hash = event_record["content_hash"]
            seen_hashes.add(content_hash)
            events_found += 1

            place_data = event_record.pop("venue_data")
            cache_key = place_data["slug"]
            venue_id = venue_cache.get(cache_key)
            if venue_id is None:
                venue_id = get_or_create_place(place_data)
                venue_cache[cache_key] = venue_id

            event_record.pop("is_virtual", None)
            event_record["source_id"] = source_id
            event_record["venue_id"] = venue_id

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1

        for item, included in [(entry, virtual_included) for entry in virtual_items]:
            event_record = _build_event_record(item, included, today_iso=today_iso)
            if not event_record:
                continue

            content_hash = event_record["content_hash"]
            seen_hashes.add(content_hash)
            events_found += 1

            event_record.pop("venue_data", None)
            event_record.pop("is_virtual", None)
            if virtual_venue_id is None:
                virtual_venue_id = get_or_create_virtual_venue()
            event_record["source_id"] = source_id
            event_record["venue_id"] = virtual_venue_id

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info("Removed %s stale AJFF events", stale_removed)

        logger.info(
            "AJFF crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )
    except Exception as exc:
        logger.error("Failed to crawl AJFF: %s", exc)
        raise

    return events_found, events_new, events_updated
