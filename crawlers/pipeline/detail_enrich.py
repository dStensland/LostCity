"""
Detail page enrichment using the extraction stack.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Optional
from urllib.parse import urldefrag, urljoin, urlparse

from bs4 import BeautifulSoup

from date_utils import normalize_iso_date, parse_human_date
from description_quality import classify_description
from extractors.structured import extract_jsonld_event_fields, extract_open_graph_fields
from extractors.lineup import (
    dedupe_artist_entries,
    normalize_artist_role,
    split_lineup_text_with_roles,
)
from extractors.selectors import extract_all, extract_first
from extractors.heuristic import extract_heuristic_fields
from extractors.llm_detail import extract_detail_with_llm
from pipeline.models import DetailConfig, SelectorSet
from show_signals import extract_ticket_status
from utils import is_likely_non_event_image, normalize_time_format, parse_date_range, parse_price

logger = logging.getLogger(__name__)

CONFIDENCE_BY_SOURCE = {
    "jsonld": 0.90,
    "open_graph": 0.65,
    "selectors": 0.80,
    "heuristic": 0.55,
    "llm": 0.50,
}

EXTRACTION_VERSION = "pipeline_v3"
_LISTING_LIKE_PATHS = {
    "/",
    "/events",
    "/event",
    "/calendar",
    "/shows",
    "/upcoming",
    "/upcoming-events",
}
_TICKET_HOST_HINTS = (
    "ticketmaster.",
    "axs.",
    "eventbrite.",
    "etix.",
    "evenue.net",
    "ticketweb.",
    "tickets.",
    "seetickets.",
    "dice.fm",
    "tixr.com",
    "universe.com",
)
_SOCIAL_HOST_HINTS = (
    "instagram.com",
    "facebook.com",
    "x.com",
    "twitter.com",
    "tiktok.com",
    "youtube.com",
    "linkedin.com",
)
_MAP_HOST_HINTS = (
    "maps.google.",
    "google.com",
    "maps.apple.com",
    "waze.com",
)
_NON_TICKET_PATH_HINTS = (
    "/account",
    "/login",
    "/sign-in",
    "/signin",
    "/my-account",
)


def _artist_entries_from_value(value: Any) -> list[dict[str, str]]:
    if not value:
        return []
    if isinstance(value, str):
        return dedupe_artist_entries(split_lineup_text_with_roles(value))
    if isinstance(value, list):
        return dedupe_artist_entries(value)
    return []


def _merge_field(field: str, current: Any, new: Any) -> Any:
    if new is None or new == "":
        return current

    if current in (None, ""):
        return new

    if field == "description":
        # Prefer longer descriptions
        return new if len(str(new)) > len(str(current)) else current

    if field == "ticket_url":
        # Prefer a specific ticket link if current looks like a generic page
        if current and new and current != new and "ticket" in new.lower():
            return new
        return current

    if field == "artists":
        current_entries = _artist_entries_from_value(current)
        new_entries = _artist_entries_from_value(new)
        if not current_entries:
            return new_entries or current
        if not new_entries:
            return current_entries or current
        return dedupe_artist_entries(current_entries + new_entries)

    return current


def _normalize_url(value: Optional[str], base_url: str) -> Optional[str]:
    if value and not value.startswith("http"):
        return urljoin(base_url, value)
    return value


def _normalize_urls(result: dict, base_url: str) -> dict:
    for key in ("ticket_url", "image_url"):
        value = result.get(key)
        normalized = _normalize_url(value, base_url)
        if normalized:
            result[key] = normalized

    images = result.get("images")
    if isinstance(images, list):
        for image in images:
            if not isinstance(image, dict):
                continue
            url = image.get("url")
            normalized = _normalize_url(url, base_url)
            if normalized:
                image["url"] = normalized

    links = result.get("links")
    if isinstance(links, list):
        for link in links:
            if not isinstance(link, dict):
                continue
            url = link.get("url")
            normalized = _normalize_url(url, base_url)
            if normalized:
                link["url"] = normalized

    return result


def _normalize_url_path(value: Optional[str]) -> str:
    try:
        path = (urlparse(value or "").path or "").strip()
    except Exception:
        return "/"
    if path.endswith("/"):
        path = path.rstrip("/")
    return path or "/"


def _is_listing_like_url(url: Optional[str]) -> bool:
    value = (url or "").strip()
    if not value:
        return True
    return _normalize_url_path(value) in _LISTING_LIKE_PATHS


def _looks_like_explicit_ticket_url(url: Optional[str]) -> bool:
    value = (url or "").strip()
    if not value:
        return False
    try:
        parsed = urlparse(value)
    except Exception:
        return False

    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()
    query = (parsed.query or "").lower()
    combined = " ".join(part for part in (host, path, query) if part)

    if any(hint in host for hint in _TICKET_HOST_HINTS):
        return True

    return any(
        token in combined
        for token in (
            "/tickets",
            "ticket=",
            "tickets=",
            "buy",
            "checkout",
            "purchase",
            "cart",
            "register",
            "admission",
        )
    )


def _is_same_page_url(url: Optional[str], base_url: str) -> bool:
    normalized = _normalize_url(url, base_url)
    if not normalized:
        return False
    return urldefrag(normalized.rstrip("/"))[0] == urldefrag(base_url.rstrip("/"))[0]


def _infer_link_type(raw_type: Optional[str], url: str, base_url: str) -> Optional[str]:
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()
    query = (parsed.query or "").lower()
    combined = " ".join(part for part in (host, path, query) if part)
    base_host = (urlparse(base_url).netloc or "").lower()

    normalized_type = str(raw_type or "").strip().lower()
    if normalized_type in {"ticket", "website", "organizer", "map", "social", "email", "phone"}:
        return normalized_type

    if parsed.scheme == "mailto":
        return "email"

    if parsed.scheme == "tel":
        return "phone"

    if _looks_like_explicit_ticket_url(url):
        return "ticket"

    if any(hint in host for hint in _SOCIAL_HOST_HINTS):
        return "social"

    if any(hint in host for hint in _MAP_HOST_HINTS) or any(
        token in combined for token in ("google maps", "/maps", "maps?q=", "dir/?", "directions")
    ):
        return "map"

    if any(token in combined for token in ("organizer", "presentedby", "presenter", "about", "contact")):
        return "organizer"

    if host and host == base_host and not _is_same_page_url(url, base_url):
        return "website"

    if host and host != base_host:
        return "website"

    return None


def _is_useful_ticket_candidate(url: Optional[str], base_url: str) -> bool:
    normalized = _normalize_url(url, base_url)
    if not normalized:
        return False
    path = (urlparse(normalized).path or "").lower()
    if _is_same_page_url(normalized, base_url):
        return False
    if any(path == hint or path.startswith(f"{hint}/") for hint in _NON_TICKET_PATH_HINTS):
        return False
    if _is_listing_like_url(normalized) and not _looks_like_explicit_ticket_url(normalized):
        return False
    return True


def _rank_ticket_candidate(url: str, base_url: str) -> tuple[int, int, int]:
    parsed = urlparse(url)
    base_host = (urlparse(base_url).netloc or "").lower()
    score = 0
    if _looks_like_explicit_ticket_url(url):
        score += 100
    if not _is_listing_like_url(url):
        score += 10
    if (parsed.netloc or "").lower() != base_host:
        score += 2
    return score, len(parsed.path or ""), len(parsed.query or "")


def _sanitize_link_fields(data: dict, base_url: str) -> dict:
    if not data:
        return data

    sanitized = dict(data)
    normalized_links: list[dict[str, Any]] = []
    seen_links: set[tuple[str, str]] = set()
    ticket_candidates: list[str] = []

    def add_link(link_type: Optional[str], raw_url: str) -> None:
        normalized_url = _normalize_url(str(raw_url).strip(), base_url)
        if not normalized_url:
            return
        type_key = _infer_link_type(link_type, normalized_url, base_url)
        if not type_key:
            return
        base_host = (urlparse(base_url).netloc or "").lower()
        normalized_host = (urlparse(normalized_url).netloc or "").lower()
        if type_key == "ticket":
            if not _is_useful_ticket_candidate(normalized_url, base_url):
                return
            ticket_candidates.append(normalized_url)
        elif type_key in {"email", "phone"}:
            pass
        elif _is_same_page_url(normalized_url, base_url):
            return
        elif normalized_host == base_host and _is_listing_like_url(normalized_url):
            return
        key = (type_key, normalized_url)
        if key in seen_links:
            return
        normalized_links.append({"type": type_key, "url": normalized_url})
        seen_links.add(key)

    links = sanitized.get("links")
    if isinstance(links, list):
        for item in links:
            if isinstance(item, str):
                add_link(None, item)
                continue
            if not isinstance(item, dict):
                continue
            link_type = item.get("type")
            link_url = item.get("url")
            if link_url:
                add_link(str(link_type) if link_type else None, str(link_url))

    ticket_url = sanitized.get("ticket_url")
    if ticket_url:
        add_link("ticket", str(ticket_url))

    if ticket_candidates:
        sanitized["ticket_url"] = max(
            ticket_candidates,
            key=lambda candidate: _rank_ticket_candidate(candidate, base_url),
        )
    else:
        sanitized.pop("ticket_url", None)

    if normalized_links:
        sanitized["links"] = normalized_links
    else:
        sanitized.pop("links", None)

    return sanitized


def _extract_selector_price_fields(price_text: str) -> dict:
    normalized = " ".join(str(price_text).split()).strip()
    if not normalized:
        return {}

    result: dict[str, Any] = {}
    status = extract_ticket_status(normalized)
    if status:
        result["ticket_status"] = status

    price_min, price_max, parsed_note = parse_price(normalized)
    if price_min is not None:
        result["price_min"] = float(price_min)
    if price_max is not None:
        result["price_max"] = float(price_max)

    if normalized.lower().startswith("free") or (
        price_min is not None and price_max is not None and float(price_max) == 0.0
    ):
        result["is_free"] = True

    if parsed_note:
        result["price_note"] = "Free" if parsed_note == "Free" else normalized
    elif any(token in normalized for token in ("$", "USD", "usd")) and (
        len(set(filter(None, (price_min, price_max)))) > 1
        or any(marker in normalized.lower() for marker in ("adv", "door", "dos", "ga", "vip", "from", "+", "/"))
    ):
        result["price_note"] = normalized

    return result


def _extract_selector_time_fields(time_text: str) -> dict:
    normalized = " ".join(str(time_text).split()).strip()
    if not normalized:
        return {}

    result: dict[str, Any] = {}
    upper = normalized.upper()

    range_match = re.search(
        r"(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–—TO]+\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)",
        upper,
    )
    if range_match:
        start_token = range_match.group(1).strip()
        end_token = range_match.group(2).strip()

        start_has_period = bool(re.search(r"\b(?:AM|PM)\b", start_token))
        end_has_period = bool(re.search(r"\b(?:AM|PM)\b", end_token))
        if not start_has_period and end_has_period:
            start_token = f"{start_token} {end_token.split()[-1]}"
        elif start_has_period and not end_has_period:
            end_token = f"{end_token} {start_token.split()[-1]}"

        start_time = normalize_time_format(start_token)
        end_time = normalize_time_format(end_token)
        if start_time:
            result["start_time"] = start_time
        if end_time:
            result["end_time"] = end_time
        if result:
            return result

    for pattern in (
        r"(?:show|starts?|begin(?:s)?|performance|doors?|door)\s*(?:at|opens?)?\s*[:\-]?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))",
        r"\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b",
        r"\b(\d{1,2}:\d{2})\b",
    ):
        match = re.search(pattern, upper)
        if not match:
            continue
        start_time = normalize_time_format(match.group(1))
        if start_time:
            result["start_time"] = start_time
            return result

    return result


def _extract_selector_date_fields(date_text: str) -> dict:
    normalized = " ".join(str(date_text).split()).strip()
    if not normalized:
        return {}

    result: dict[str, Any] = {}

    start_date, end_date = parse_date_range(normalized)
    if start_date:
        result["start_date"] = start_date
    if end_date:
        result["end_date"] = end_date
    if result:
        return result

    iso_date = normalize_iso_date(normalized)
    if iso_date:
        return {"start_date": iso_date}

    human_date = parse_human_date(normalized, context_text=normalized)
    if human_date:
        return {"start_date": human_date}

    return result


def _extract_selector_fields(html: str, selectors: SelectorSet) -> dict:
    if not html:
        return {}
    soup = BeautifulSoup(html, "lxml")
    result: dict = {}

    for field, spec in selectors.model_dump().items():
        if not spec:
            continue
        if field == "artists":
            matches = soup.select(spec)
            entries: list[dict[str, str]] = []
            for match in matches:
                text = match.get_text(" ", strip=True)
                if not text:
                    continue

                role_hint: Optional[str] = None
                classes = " ".join(match.get("class") or []).lower()
                node_id = str(match.get("id") or "").lower()
                parent = match.find_parent()
                parent_classes = " ".join(parent.get("class") or []).lower() if parent else ""
                parent_id = str(parent.get("id") or "").lower() if parent else ""
                context = " ".join([classes, node_id, parent_classes, parent_id])
                if "headliner" in context:
                    role_hint = "headliner"
                elif any(token in context for token in ("support", "opener", "opening", "special-guest")):
                    role_hint = "support"

                parsed_entries = split_lineup_text_with_roles(text)
                if not parsed_entries:
                    parsed_entries = [{"name": text, "role": role_hint or "headliner"}]

                for parsed in parsed_entries:
                    role = normalize_artist_role(parsed.get("role")) or "headliner"
                    if role == "headliner" and role_hint:
                        role = role_hint
                    entries.append({"name": parsed.get("name", ""), "role": role})

            if entries:
                result[field] = dedupe_artist_entries(entries)
            continue

        if field in ("image_url", "ticket_url", "links"):
            values = extract_all(soup, spec)
            if values:
                if field == "image_url":
                    result[field] = values[0]
                    result["images"] = [{"url": v} for v in values]
                elif field == "ticket_url":
                    result[field] = values[0]
                    if len(values) > 1:
                        result["links"] = [{"type": "ticket", "url": v} for v in values]
                else:
                    result["links"] = values
            continue

        if field == "price":
            value = extract_first(soup, spec)
            if value:
                result.update(_extract_selector_price_fields(value))
            continue

        if field == "time":
            value = extract_first(soup, spec)
            if value:
                result.update(_extract_selector_time_fields(value))
            continue

        if field == "date":
            value = extract_first(soup, spec)
            if value:
                result.update(_extract_selector_date_fields(value))
            continue

        value = extract_first(soup, spec)
        if value:
            result[field] = value

    return result


def _combine_provenance(existing: Optional[dict], source: str, url: str) -> dict:
    if not existing:
        return {"source": source, "url": url}
    sources = existing.get("sources")
    if sources is None:
        prev = existing.get("source")
        sources = [prev] if prev else []
    if source in sources:
        return existing
    merged = sorted({*sources, source})
    return {"source": "mixed", "sources": merged, "url": url}


def _combine_confidence(existing: Optional[float], new: float) -> float:
    if existing is None:
        return new
    return max(existing, new)


def _merge_and_track(
    field: str,
    current: Any,
    new: Any,
    source: str,
    url: str,
    enriched: dict,
    field_provenance: dict,
    field_confidence: dict,
) -> None:
    merged = _merge_field(field, current, new)
    if merged == current:
        return
    enriched[field] = merged
    field_provenance[field] = _combine_provenance(field_provenance.get(field), source, url)
    confidence = CONFIDENCE_BY_SOURCE.get(source, 0.5)
    field_confidence[field] = _combine_confidence(field_confidence.get(field), confidence)


def _collect_images(
    data: dict,
    source: str,
    base_url: str,
    images_by_url: dict[str, dict],
    image_order: list[str],
) -> None:
    confidence = CONFIDENCE_BY_SOURCE.get(source, 0.5)
    items: list = []

    images = data.get("images")
    if isinstance(images, list):
        items.extend(images)
    image_url = data.get("image_url")
    if image_url:
        items.insert(0, {"url": image_url})

    for item in items:
        if isinstance(item, str):
            url = item
            width = None
            height = None
            img_type = None
        elif isinstance(item, dict):
            url = item.get("url") or item.get("src")
            width = item.get("width")
            height = item.get("height")
            img_type = item.get("type")
        else:
            continue

        if not url:
            continue

        normalized = _normalize_url(str(url).strip(), base_url)
        if not normalized:
            continue
        if is_likely_non_event_image(normalized):
            continue

        existing = images_by_url.get(normalized)
        if not existing:
            images_by_url[normalized] = {
                "url": normalized,
                "width": width,
                "height": height,
                "type": img_type,
                "source": source,
                "confidence": confidence,
                "is_primary": False,
            }
            image_order.append(normalized)
            continue

        if width and not existing.get("width"):
            existing["width"] = width
        if height and not existing.get("height"):
            existing["height"] = height
        if img_type and not existing.get("type"):
            existing["type"] = img_type
        if confidence > (existing.get("confidence") or 0):
            existing["confidence"] = confidence
            existing["source"] = source


def _sanitize_image_fields(data: dict, base_url: str) -> dict:
    if not data:
        return data

    sanitized = dict(data)
    valid_images: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    items: list[Any] = []
    image_url = data.get("image_url")
    if image_url:
        items.append({"url": image_url})
    images = data.get("images")
    if isinstance(images, list):
        items.extend(images)

    for item in items:
        if isinstance(item, str):
            raw_url = item
            width = None
            height = None
            img_type = None
        elif isinstance(item, dict):
            raw_url = item.get("url") or item.get("src")
            width = item.get("width")
            height = item.get("height")
            img_type = item.get("type")
        else:
            continue

        if not raw_url:
            continue

        normalized = _normalize_url(str(raw_url).strip(), base_url)
        if not normalized or is_likely_non_event_image(normalized) or normalized in seen_urls:
            continue

        image: dict[str, Any] = {"url": normalized}
        if width is not None:
            image["width"] = width
        if height is not None:
            image["height"] = height
        if img_type:
            image["type"] = img_type

        valid_images.append(image)
        seen_urls.add(normalized)

    if valid_images:
        sanitized["images"] = valid_images
        sanitized["image_url"] = valid_images[0]["url"]
    else:
        sanitized.pop("images", None)
        sanitized.pop("image_url", None)

    return sanitized


def _sanitize_description_fields(data: dict) -> dict:
    if not data:
        return data

    sanitized = dict(data)
    description = sanitized.get("description")
    if not isinstance(description, str):
        return sanitized

    normalized = " ".join(description.split()).strip()
    title = str(sanitized.get("title") or "").strip()
    if not normalized:
        sanitized.pop("description", None)
        return sanitized
    if title:
        if normalized.lower() == title.lower():
            sanitized.pop("description", None)
            return sanitized
        title_pattern = re.compile(
            rf"^(?:{re.escape(title)}(?:\s*[:|\\-]\s*|\s+))+",
            re.IGNORECASE,
        )
        stripped = title_pattern.sub("", normalized).strip()
        if stripped and stripped.lower() != normalized.lower():
            normalized = stripped
        if normalized.lower() == title.lower():
            sanitized.pop("description", None)
            return sanitized
    if classify_description(normalized) != "good":
        sanitized.pop("description", None)
        return sanitized

    sanitized["description"] = normalized
    return sanitized


def _sanitize_price_fields(data: dict) -> dict:
    if not data:
        return data

    sanitized = dict(data)
    price_note = sanitized.get("price_note")
    if isinstance(price_note, str):
        normalized_note = " ".join(price_note.split()).strip()
        if normalized_note:
            sanitized["price_note"] = normalized_note
            status = extract_ticket_status(normalized_note)
            if status and not sanitized.get("ticket_status"):
                sanitized["ticket_status"] = status
            has_numeric_price = (
                sanitized.get("price_min") is not None
                or sanitized.get("price_max") is not None
                or bool(sanitized.get("is_free"))
            )
            if status and not has_numeric_price:
                sanitized.pop("price_note", None)
        else:
            sanitized.pop("price_note", None)

    return sanitized


def _sanitize_extracted_fields(data: dict, base_url: str) -> dict:
    return _sanitize_image_fields(
        _sanitize_link_fields(
            _sanitize_price_fields(_sanitize_description_fields(data)),
            base_url,
        ),
        base_url,
    )


def _collect_links(
    data: dict,
    source: str,
    base_url: str,
    links_by_key: dict[tuple[str, str], dict],
    link_order: list[tuple[str, str]],
) -> None:
    confidence = CONFIDENCE_BY_SOURCE.get(source, 0.5)
    items: list = []

    links = data.get("links")
    if isinstance(links, list):
        items.extend(links)
    ticket_url = data.get("ticket_url")
    if ticket_url:
        items.insert(0, {"type": "ticket", "url": ticket_url})

    for item in items:
        if isinstance(item, str):
            link_type = "ticket"
            url = item
        elif isinstance(item, dict):
            link_type = item.get("type")
            url = item.get("url")
        else:
            continue

        if not link_type or not url:
            continue

        normalized = _normalize_url(str(url).strip(), base_url)
        if not normalized:
            continue

        key = (str(link_type).strip().lower(), normalized)
        existing = links_by_key.get(key)
        if not existing:
            links_by_key[key] = {
                "type": str(link_type).strip(),
                "url": normalized,
                "source": source,
                "confidence": confidence,
            }
            link_order.append(key)
            continue

        if confidence > (existing.get("confidence") or 0):
            existing["confidence"] = confidence
            existing["source"] = source


def enrich_from_detail(
    html: str,
    url: str,
    source_name: str,
    config: DetailConfig,
) -> dict:
    """Run the extraction stack on a detail page."""
    if not html:
        return {}

    enriched: dict[str, Any] = {}
    field_provenance: dict[str, Any] = {}
    field_confidence: dict[str, float] = {}
    images_by_url: dict[str, dict] = {}
    image_order: list[str] = []
    links_by_key: dict[tuple[str, str], dict] = {}
    link_order: list[tuple[str, str]] = []

    jsonld_present = False
    if config.use_jsonld or config.jsonld_only:
        jsonld = _sanitize_extracted_fields(extract_jsonld_event_fields(html), url)
        jsonld_present = bool(jsonld)
        for k, v in jsonld.items():
            _merge_and_track(k, enriched.get(k), v, "jsonld", url, enriched, field_provenance, field_confidence)
        _collect_images(jsonld, "jsonld", url, images_by_url, image_order)
        _collect_links(jsonld, "jsonld", url, links_by_key, link_order)

    if config.jsonld_only:
        if not jsonld_present:
            return {"_skip": True, "extraction_version": EXTRACTION_VERSION}

        enriched = _normalize_urls(enriched, url)
        if image_order:
            enriched["images"] = [images_by_url[key] for key in image_order if key in images_by_url]
        if link_order:
            enriched["links"] = [links_by_key[key] for key in link_order if key in links_by_key]

        image_url = enriched.get("image_url")
        if image_url and isinstance(enriched.get("images"), list):
            for image in enriched["images"]:
                image["is_primary"] = image.get("url") == image_url

        enriched["field_provenance"] = field_provenance
        enriched["field_confidence"] = field_confidence
        enriched["extraction_version"] = EXTRACTION_VERSION
        return enriched

    if config.use_open_graph:
        og = _sanitize_extracted_fields(extract_open_graph_fields(html), url)
        for k, v in og.items():
            _merge_and_track(k, enriched.get(k), v, "open_graph", url, enriched, field_provenance, field_confidence)
        _collect_images(og, "open_graph", url, images_by_url, image_order)
        _collect_links(og, "open_graph", url, links_by_key, link_order)

    if config.selectors:
        sel = _sanitize_extracted_fields(_extract_selector_fields(html, config.selectors), url)
        for k, v in sel.items():
            _merge_and_track(k, enriched.get(k), v, "selectors", url, enriched, field_provenance, field_confidence)
        _collect_images(sel, "selectors", url, images_by_url, image_order)
        _collect_links(sel, "selectors", url, links_by_key, link_order)

    if config.use_heuristic:
        heur = _sanitize_extracted_fields(extract_heuristic_fields(html), url)
        for k, v in heur.items():
            _merge_and_track(k, enriched.get(k), v, "heuristic", url, enriched, field_provenance, field_confidence)
        _collect_images(heur, "heuristic", url, images_by_url, image_order)
        _collect_links(heur, "heuristic", url, links_by_key, link_order)

    if config.use_llm:
        # Only invoke LLM when prior steps left gaps — saves API tokens
        desc = enriched.get("description") or ""
        has_good_desc = len(str(desc)) > 50
        has_image = bool(enriched.get("image_url") or image_order)
        has_ticket = bool(enriched.get("ticket_url"))
        has_time = bool(enriched.get("start_time"))
        has_price = enriched.get("price_min") is not None or enriched.get("is_free")
        if not (has_good_desc and has_image and has_ticket and has_time and has_price):
            llm = extract_detail_with_llm(html, url, source_name)
            llm = _sanitize_extracted_fields(llm, url)
            for k, v in llm.items():
                _merge_and_track(k, enriched.get(k), v, "llm", url, enriched, field_provenance, field_confidence)
            _collect_images(llm, "llm", url, images_by_url, image_order)
            _collect_links(llm, "llm", url, links_by_key, link_order)

    enriched = _normalize_urls(enriched, url)
    if image_order:
        enriched["images"] = [images_by_url[key] for key in image_order if key in images_by_url]
    if link_order:
        enriched["links"] = [links_by_key[key] for key in link_order if key in links_by_key]

    image_url = enriched.get("image_url")
    if image_url and isinstance(enriched.get("images"), list):
        for image in enriched["images"]:
            image["is_primary"] = image.get("url") == image_url

    enriched["field_provenance"] = field_provenance
    enriched["field_confidence"] = field_confidence
    enriched["extraction_version"] = EXTRACTION_VERSION
    return enriched
