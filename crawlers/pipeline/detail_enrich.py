"""
Detail page enrichment using the extraction stack.
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from extractors.structured import extract_jsonld_event_fields, extract_open_graph_fields
from extractors.lineup import dedupe_artists, split_lineup_text
from extractors.selectors import extract_all, extract_first
from extractors.heuristic import extract_heuristic_fields
from extractors.llm_detail import extract_detail_with_llm
from pipeline.models import DetailConfig, SelectorSet

logger = logging.getLogger(__name__)

CONFIDENCE_BY_SOURCE = {
    "jsonld": 0.90,
    "open_graph": 0.65,
    "selectors": 0.80,
    "heuristic": 0.55,
    "llm": 0.50,
}

EXTRACTION_VERSION = "pipeline_v3"


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
        def _to_list(value: Any) -> list:
            if not value:
                return []
            if isinstance(value, list):
                return value
            if isinstance(value, str):
                parsed = split_lineup_text(value)
                return parsed or [value]
            return []

        current_list = _to_list(current)
        new_list = _to_list(new)
        if not current_list:
            return new_list or current
        if not new_list:
            return current_list or current
        return dedupe_artists(current_list + new_list)

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
            texts: list[str] = []
            for match in matches:
                text = match.get_text(" ", strip=True)
                if text:
                    texts.append(text)
            if texts:
                artists: list[str] = []
                for text in texts:
                    artists.extend(split_lineup_text(text) or [text])
                result[field] = dedupe_artists(artists)
            continue

        if field in ("image_url", "ticket_url"):
            values = extract_all(soup, spec)
            if values:
                result[field] = values[0]
                if field == "image_url" and len(values) > 1:
                    result["images"] = [{"url": v} for v in values]
                if field == "ticket_url" and len(values) > 1:
                    result["links"] = [{"type": "ticket", "url": v} for v in values]
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
        jsonld = extract_jsonld_event_fields(html)
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
        og = extract_open_graph_fields(html)
        for k, v in og.items():
            _merge_and_track(k, enriched.get(k), v, "open_graph", url, enriched, field_provenance, field_confidence)
        _collect_images(og, "open_graph", url, images_by_url, image_order)
        _collect_links(og, "open_graph", url, links_by_key, link_order)

    if config.selectors:
        sel = _extract_selector_fields(html, config.selectors)
        for k, v in sel.items():
            _merge_and_track(k, enriched.get(k), v, "selectors", url, enriched, field_provenance, field_confidence)
        _collect_images(sel, "selectors", url, images_by_url, image_order)
        _collect_links(sel, "selectors", url, links_by_key, link_order)

    if config.use_heuristic:
        heur = extract_heuristic_fields(html)
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
