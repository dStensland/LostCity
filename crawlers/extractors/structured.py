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

from extractors.lineup import dedupe_artists, split_lineup_text

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


def _extract_images(image_field: Any) -> list[dict]:
    images: list[dict] = []
    if image_field is None:
        return images

    items = image_field if isinstance(image_field, list) else [image_field]
    for item in items:
        if isinstance(item, str):
            images.append({"url": item.strip()})
            continue
        if isinstance(item, dict):
            url = _coerce_str(item.get("url") or item.get("contentUrl") or item.get("@id"))
            if not url:
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

        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict):
                objects.append(item)
    return objects


def _is_event_obj(obj: dict) -> bool:
    obj_type = obj.get("@type")
    if isinstance(obj_type, list):
        return any(t == "Event" or t.endswith("Event") for t in obj_type)
    if isinstance(obj_type, str):
        return obj_type == "Event" or obj_type.endswith("Event")
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

    description = _coerce_str(event_obj.get("description"))
    if description:
        result["description"] = description

    images = _extract_images(event_obj.get("image"))
    if images:
        result["images"] = images
        result["image_url"] = _coerce_str(images[0].get("url"))

    offers = event_obj.get("offers")
    offers_obj = None
    if isinstance(offers, list) and offers:
        offers_obj = offers[0]
    elif isinstance(offers, dict):
        offers_obj = offers

    if offers_obj:
        ticket_url = _coerce_str(offers_obj.get("url"))
        if ticket_url:
            result["ticket_url"] = ticket_url

        price_note = _coerce_str(offers_obj.get("price"))
        low_price = _parse_price(offers_obj.get("lowPrice"))
        high_price = _parse_price(offers_obj.get("highPrice"))

        if low_price is not None:
            result["price_min"] = low_price
        if high_price is not None:
            result["price_max"] = high_price

        if price_note and "price_min" not in result:
            # Preserve unparsed price text as a note
            result["price_note"] = price_note

        if price_note and "free" in price_note.lower():
            result["is_free"] = True

    # Collect all ticket URLs if multiple offers present
    if isinstance(offers, list):
        links: list[dict] = []
        for offer in offers:
            if not isinstance(offer, dict):
                continue
            url = _coerce_str(offer.get("url"))
            if url:
                links.append({"type": "ticket", "url": url})
        if links:
            result["links"] = links

    performers = _extract_performers(event_obj)
    if performers:
        result["artists"] = performers

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

    og_desc = get_meta("og:description") or get_meta("description")
    if og_desc:
        result["description"] = og_desc

    og_images = get_all_meta(["og:image", "twitter:image", "og:image:url"])
    if og_images:
        result["images"] = [{"url": url} for url in og_images]
        result["image_url"] = og_images[0]

    return result
