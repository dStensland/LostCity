"""
Structured data extraction for event detail pages.

Targets:
- JSON-LD (schema.org Event)
- Open Graph / Twitter meta tags
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any, Optional

from dateutil import parser as dateparser

from bs4 import BeautifulSoup

from description_quality import classify_description
from extractors.lineup import dedupe_artists, split_lineup_text
from show_signals import extract_ticket_status
from utils import is_likely_non_event_image

logger = logging.getLogger(__name__)


def _parse_price(value: Any) -> Optional[float]:
    """Best-effort price parsing."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Strip currency symbols and commas
        cleaned = re.sub(r"[^0-9.]", "", value)
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _coerce_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _clean_description(value: Any) -> Optional[str]:
    description = _coerce_str(value)
    if not description:
        return None
    description = " ".join(description.split())
    if classify_description(description) != "good":
        return None
    return description


def _extract_images(image_field: Any) -> list[dict]:
    images: list[dict] = []
    if image_field is None:
        return images

    items = image_field if isinstance(image_field, list) else [image_field]
    for item in items:
        if isinstance(item, str):
            url = item.strip()
            if not url or is_likely_non_event_image(url):
                continue
            images.append({"url": url})
            continue
        if isinstance(item, dict):
            url = _coerce_str(item.get("url") or item.get("contentUrl") or item.get("@id"))
            if not url or is_likely_non_event_image(url):
                continue
            image = {"url": url}
            if item.get("width") is not None:
                image["width"] = item.get("width")
            if item.get("height") is not None:
                image["height"] = item.get("height")
            images.append(image)
            continue
    return images


def _first_image(image_field: Any) -> Optional[str]:
    images = _extract_images(image_field)
    if not images:
        return None
    return _coerce_str(images[0].get("url"))


def _extract_location_name(location_field: Any) -> Optional[str]:
    if location_field is None:
        return None
    if isinstance(location_field, str):
        return _coerce_str(location_field)
    if isinstance(location_field, list):
        for item in location_field:
            name = _extract_location_name(item)
            if name:
                return name
        return None
    if isinstance(location_field, dict):
        name = _coerce_str(location_field.get("name"))
        if name:
            return name
        return _extract_location_name(location_field.get("location"))
    return None


def _iter_location_dicts(location_field: Any) -> list[dict[str, Any]]:
    if isinstance(location_field, dict):
        return [location_field]
    if isinstance(location_field, list):
        return [item for item in location_field if isinstance(item, dict)]
    return []


def _location_type_matches(location_obj: dict[str, Any], suffix: str) -> bool:
    obj_type = location_obj.get("@type")
    if isinstance(obj_type, list):
        return any(isinstance(item, str) and item.endswith(suffix) for item in obj_type)
    return isinstance(obj_type, str) and obj_type.endswith(suffix)


def _has_virtual_location(location_field: Any) -> bool:
    return any(_location_type_matches(item, "VirtualLocation") for item in _iter_location_dicts(location_field))


def _extract_virtual_location_urls(location_field: Any) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for item in _iter_location_dicts(location_field):
        if not _location_type_matches(item, "VirtualLocation"):
            continue
        url = _coerce_str(item.get("url"))
        if not url or not re.match(r"^https?://", url, re.IGNORECASE) or url in seen:
            continue
        urls.append(url)
        seen.add(url)
    return urls


def _normalize_attendance_mode(value: Any) -> Optional[str]:
    raw = _coerce_str(value)
    if not raw:
        return None
    lowered = raw.lower().rstrip("/")
    if lowered.endswith("onlineeventattendancemode"):
        return "online"
    if lowered.endswith("mixedeventattendancemode"):
        return "mixed"
    if lowered.endswith("offlineeventattendancemode"):
        return "offline"
    return None


def _is_moved_online_event_status(value: Any) -> bool:
    raw = _coerce_str(value)
    if not raw:
        return False
    lowered = raw.lower().rstrip("/")
    return lowered.endswith("eventmovedonline")


def _append_http_url(urls: list[str], value: Any) -> None:
    if value is None:
        return
    if isinstance(value, str):
        url = _coerce_str(value)
        if url and re.match(r"^https?://", url, re.IGNORECASE):
            urls.append(url)
        return
    if isinstance(value, list):
        for item in value:
            _append_http_url(urls, item)
        return


def _extract_organizer_links(event_obj: dict) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    organizers = event_obj.get("organizer")
    items = organizers if isinstance(organizers, list) else [organizers]
    seen: set[tuple[str, str]] = set()

    for item in items:
        if not isinstance(item, dict):
            continue

        organizer_url = _coerce_str(item.get("url"))
        if organizer_url and re.match(r"^https?://", organizer_url, re.IGNORECASE):
            key = ("organizer", organizer_url)
            if key not in seen:
                links.append({"type": "organizer", "url": organizer_url})
                seen.add(key)

        email = _coerce_str(item.get("email"))
        if email:
            email_url = email if email.lower().startswith("mailto:") else f"mailto:{email}"
            key = ("email", email_url)
            if key not in seen:
                links.append({"type": "email", "url": email_url})
                seen.add(key)

        telephone = _coerce_str(item.get("telephone"))
        if telephone:
            phone_url = telephone if telephone.lower().startswith("tel:") else f"tel:{telephone}"
            key = ("phone", phone_url)
            if key not in seen:
                links.append({"type": "phone", "url": phone_url})
                seen.add(key)

        same_as_urls: list[str] = []
        _append_http_url(same_as_urls, item.get("sameAs"))
        for url in same_as_urls:
            key = ("social", url)
            if key in seen:
                continue
            links.append({"type": "social", "url": url})
            seen.add(key)

    return links


def _iter_offer_dicts(offers: Any) -> list[dict[str, Any]]:
    if isinstance(offers, dict):
        return [offers]
    if isinstance(offers, list):
        return [offer for offer in offers if isinstance(offer, dict)]
    return []


def _aggregate_offer_status(statuses: list[str]) -> Optional[str]:
    normalized = [status for status in statuses if status]
    if not normalized:
        return None
    unique = set(normalized)
    if unique == {"cancelled"}:
        return "cancelled"
    if unique == {"sold-out"}:
        return "sold-out"
    if "tickets-available" in unique:
        return "tickets-available"
    if "low-tickets" in unique and "sold-out" not in unique:
        return "low-tickets"
    if "low-tickets" in unique:
        return "low-tickets"
    if "sold-out" in unique:
        return "sold-out"
    return normalized[0]


def _extract_offer_fields(offers: Any) -> dict[str, Any]:
    offer_items = _iter_offer_dicts(offers)
    if not offer_items:
        return {}

    result: dict[str, Any] = {}
    links: list[dict[str, str]] = []
    seen_links: set[str] = set()
    numeric_prices: list[float] = []
    free_flags: list[bool] = []
    statuses: list[str] = []
    price_notes: list[str] = []
    single_offer_price_note: Optional[str] = None

    for offer in offer_items:
        url = _coerce_str(offer.get("url"))
        if url and url not in seen_links:
            links.append({"type": "ticket", "url": url})
            seen_links.add(url)

        price_note = _coerce_str(offer.get("price"))
        low_price = _parse_price(offer.get("lowPrice"))
        high_price = _parse_price(offer.get("highPrice"))
        direct_price = _parse_price(offer.get("price"))
        availability = _coerce_str(offer.get("availability"))
        status = extract_ticket_status(price_note) or extract_ticket_status(availability)
        if status:
            statuses.append(status)

        offer_prices = [value for value in (low_price, high_price, direct_price) if value is not None]
        if offer_prices:
            numeric_prices.extend(float(value) for value in offer_prices)

        is_free_offer = bool(
            (price_note and "free" in price_note.lower())
            or any(float(value) == 0.0 for value in offer_prices)
            or status == "free"
        )
        free_flags.append(is_free_offer)

        if price_note and not extract_ticket_status(price_note) and direct_price is None:
            price_notes.append(price_note)

        if (
            len(offer_items) == 1
            and price_note
            and not extract_ticket_status(price_note)
            and low_price is None
            and high_price is None
        ):
            single_offer_price_note = price_note

    if links:
        result["ticket_url"] = links[0]["url"]
        if len(links) > 1:
            result["links"] = links

    if numeric_prices:
        result["price_min"] = min(numeric_prices)
        result["price_max"] = max(numeric_prices)

    if free_flags and all(free_flags) and not any(
        value > 0.0 for value in numeric_prices
    ):
        result["is_free"] = True

    aggregated_status = _aggregate_offer_status(statuses)
    if aggregated_status:
        result["ticket_status"] = aggregated_status

    if single_offer_price_note:
        result["price_note"] = single_offer_price_note
    elif not numeric_prices and price_notes:
        result["price_note"] = price_notes[0]

    return result


def _parse_datetime(value: Any) -> tuple[Optional[str], Optional[str]]:
    if not value or not isinstance(value, str):
        return None, None

    try:
        dt = dateparser.isoparse(value)
    except Exception:
        try:
            dt = dateparser.parse(value)
        except Exception:
            return None, None

    if not isinstance(dt, datetime):
        return None, None

    date_str = dt.date().isoformat()
    has_time = bool(re.search(r"\d{1,2}:\d{2}", value))
    time_str = dt.strftime("%H:%M") if has_time else None
    return date_str, time_str


def _parse_time_value(value: Any) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None

    try:
        dt = dateparser.isoparse(value)
    except Exception:
        try:
            dt = dateparser.parse(value)
        except Exception:
            return None

    if not isinstance(dt, datetime):
        return None

    return dt.strftime("%H:%M:%S")


def _infer_series_dates_from_sub_events(value: Any) -> tuple[Optional[str], Optional[str]]:
    items = value if isinstance(value, list) else [value]
    start_dates: list[str] = []
    end_dates: list[str] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        start_date, _ = _parse_datetime(item.get("startDate"))
        end_date, _ = _parse_datetime(item.get("endDate"))
        if start_date:
            start_dates.append(start_date)
        if end_date:
            end_dates.append(end_date)
        elif start_date:
            end_dates.append(start_date)

    inferred_start = min(start_dates) if start_dates else None
    inferred_end = max(end_dates) if end_dates else None
    return inferred_start, inferred_end


def _infer_series_dates_from_schedule(value: Any) -> tuple[Optional[str], Optional[str]]:
    items = value if isinstance(value, list) else [value]
    start_dates: list[str] = []
    end_dates: list[str] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        start_date, _ = _parse_datetime(item.get("startDate"))
        end_date, _ = _parse_datetime(item.get("endDate"))
        if start_date:
            start_dates.append(start_date)
        if end_date:
            end_dates.append(end_date)

    inferred_start = min(start_dates) if start_dates else None
    inferred_end = max(end_dates) if end_dates else None
    return inferred_start, inferred_end


def _append_jsonld_dicts(value: Any, objects: list[dict]) -> None:
    if isinstance(value, dict):
        objects.append(value)
        for nested in value.values():
            if isinstance(nested, (dict, list)):
                _append_jsonld_dicts(nested, objects)
        return

    if isinstance(value, list):
        for item in value:
            if isinstance(item, (dict, list)):
                _append_jsonld_dicts(item, objects)


def _iter_jsonld_objects(soup: BeautifulSoup) -> list[dict]:
    objects: list[dict] = []
    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        _append_jsonld_dicts(data, objects)
    return objects


def _is_event_obj(obj: dict) -> bool:
    obj_type = obj.get("@type")
    if isinstance(obj_type, list):
        return any(
            isinstance(t, str) and (t == "Event" or t.endswith("Event") or t.endswith("EventSeries"))
            for t in obj_type
        )
    if isinstance(obj_type, str):
        return obj_type == "Event" or obj_type.endswith("Event") or obj_type.endswith("EventSeries")
    return False


def _extract_performers(event_obj: dict) -> list[str]:
    performers: list[str] = []

    def add_name(value: Any) -> None:
        if value is None:
            return
        if isinstance(value, str):
            performers.append(value)
            return
        if isinstance(value, dict):
            name = value.get("name")
            if name:
                performers.append(str(name))
            return

    for key in ("performer", "performers", "actor"):
        value = event_obj.get(key)
        if isinstance(value, list):
            for item in value:
                add_name(item)
        else:
            add_name(value)

    # Some sites store performers as a string list in a single field.
    if not performers:
        raw = event_obj.get("artists") or event_obj.get("artist")
        if isinstance(raw, str):
            performers.extend(split_lineup_text(raw))

    return dedupe_artists(performers)


def extract_jsonld_event_fields(html: str) -> dict:
    """Extract detail fields from JSON-LD Event objects."""
    if not html:
        return {}

    soup = BeautifulSoup(html, "lxml")
    objs = _iter_jsonld_objects(soup)

    event_obj = None
    for obj in objs:
        if _is_event_obj(obj):
            event_obj = obj
            break

    if not event_obj:
        return {}

    result: dict[str, Any] = {}

    title = _coerce_str(event_obj.get("name"))
    if title:
        result["title"] = title

    start_date, start_time = _parse_datetime(event_obj.get("startDate"))
    if start_date:
        result["start_date"] = start_date
    if start_time:
        result["start_time"] = start_time

    end_date, end_time = _parse_datetime(event_obj.get("endDate"))
    if end_date:
        result["end_date"] = end_date
    if end_time:
        result["end_time"] = end_time

    doors_time = _parse_time_value(event_obj.get("doorTime"))
    if doors_time:
        result["doors_time"] = doors_time

    if "start_date" not in result or "end_date" not in result:
        subevent_start, subevent_end = _infer_series_dates_from_sub_events(event_obj.get("subEvent"))
        schedule_start, schedule_end = _infer_series_dates_from_schedule(event_obj.get("eventSchedule"))

        if "start_date" not in result:
            inferred_start = subevent_start or schedule_start
            if inferred_start:
                result["start_date"] = inferred_start

        if "end_date" not in result:
            inferred_end = subevent_end or schedule_end
            if inferred_end:
                result["end_date"] = inferred_end

    description = _clean_description(event_obj.get("description"))
    if description:
        result["description"] = description

    if event_obj.get("isAccessibleForFree") is True:
        result["is_free"] = True

    event_status_value = event_obj.get("eventStatus")
    event_status = extract_ticket_status(event_status_value)
    moved_online = _is_moved_online_event_status(event_status_value)

    location_field = event_obj.get("location")
    venue_name = _extract_location_name(location_field)
    if venue_name:
        result["venue_name"] = venue_name

    attendance_mode = _normalize_attendance_mode(event_obj.get("eventAttendanceMode"))
    virtual_location_urls = _extract_virtual_location_urls(location_field)
    is_virtual = attendance_mode == "online" or _has_virtual_location(location_field) or moved_online
    is_mixed = attendance_mode == "mixed"
    if is_virtual or is_mixed:
        tags = list(result.get("tags") or [])
        if "virtual" not in tags:
            tags.append("virtual")
        if is_mixed and "hybrid" not in tags:
            tags.append("hybrid")
        result["tags"] = tags
        if moved_online or (is_virtual and not venue_name):
            result["venue_name"] = "Online / Virtual Event"
    if virtual_location_urls:
        existing_links = result.get("links")
        new_links = [{"type": "website", "url": url} for url in virtual_location_urls]
        if isinstance(existing_links, list):
            result["links"] = existing_links + new_links
        else:
            result["links"] = new_links

    images = _extract_images(event_obj.get("image"))
    if images:
        result["images"] = images
        result["image_url"] = _coerce_str(images[0].get("url"))

    offer_fields = _extract_offer_fields(event_obj.get("offers"))
    if offer_fields:
        result.update(offer_fields)

    if event_status == "cancelled":
        result["ticket_status"] = "cancelled"

    performers = _extract_performers(event_obj)
    if performers:
        result["artists"] = performers

    organizer_links = _extract_organizer_links(event_obj)
    if organizer_links:
        existing_links = result.get("links")
        if isinstance(existing_links, list):
            result["links"] = existing_links + organizer_links
        else:
            result["links"] = organizer_links

    return result


def extract_open_graph_fields(html: str) -> dict:
    """Extract Open Graph / Twitter fields."""
    if not html:
        return {}

    soup = BeautifulSoup(html, "lxml")
    result: dict[str, Any] = {}

    def get_meta(name: str) -> Optional[str]:
        tag = soup.find("meta", property=name) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
        return None

    def get_all_meta(names: list[str]) -> list[str]:
        values: list[str] = []
        for name in names:
            for tag in soup.find_all("meta", property=name):
                if tag.get("content"):
                    values.append(tag["content"].strip())
            for tag in soup.find_all("meta", attrs={"name": name}):
                if tag.get("content"):
                    values.append(tag["content"].strip())
        return values

    og_desc = _clean_description(get_meta("og:description") or get_meta("description"))
    if og_desc:
        result["description"] = og_desc

    og_images = get_all_meta(["og:image", "twitter:image", "og:image:url"])
    og_images = [url for url in og_images if not is_likely_non_event_image(url)]
    if og_images:
        result["images"] = [{"url": url} for url in og_images]
        result["image_url"] = og_images[0]

    return result
