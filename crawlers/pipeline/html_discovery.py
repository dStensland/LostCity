"""
HTML discovery with fallback to list pages or detail links.
"""

from __future__ import annotations

import logging
from typing import Iterable
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from extractors.structured import extract_jsonld_event_fields
from pipeline.fetch import fetch_html
from pipeline.llm_discovery import discover_from_llm
from pipeline.models import DiscoveryConfig, DetailConfig

logger = logging.getLogger(__name__)

_LIST_KEYWORDS = ("show-calendar", "calendar", "shows", "events", "event", "schedule", "lineup")
_DETAIL_SEGMENTS = ("show", "shows", "event", "events", "concert")
_MIN_EVENTS = 5
_MIN_DETAIL_LINKS = 8
_MAX_DETAIL_FALLBACK = 120


def _extract_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    base = urlparse(base_url)
    links: set[str] = set()

    for a in soup.find_all("a"):
        href = a.get("href")
        if not href:
            continue
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue

        full = urljoin(base_url, href)
        parsed = urlparse(full)
        if parsed.scheme not in ("http", "https"):
            continue
        if parsed.netloc and parsed.netloc != base.netloc:
            continue
        links.add(full.split("#")[0])

    return list(links)


def _is_detail_url(url: str) -> bool:
    path = urlparse(url).path.rstrip("/")
    segments = [s for s in path.split("/") if s]
    if not segments:
        return False

    for key in _DETAIL_SEGMENTS:
        if key in segments:
            idx = segments.index(key)
            return idx < len(segments) - 1
    return False


def _is_list_url(url: str) -> bool:
    if _is_detail_url(url):
        return False
    lower = url.lower()
    return any(key in lower for key in _LIST_KEYWORDS)


def _unique_events(events: Iterable[dict]) -> list[dict]:
    seen: set[tuple] = set()
    unique: list[dict] = []
    for event in events:
        key = (
            event.get("title"),
            event.get("start_date"),
            event.get("start_time"),
            event.get("detail_url") or event.get("ticket_url"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(event)
    return unique


def _seed_from_jsonld(detail_url: str, data: dict) -> dict | None:
    title = data.get("title")
    start_date = data.get("start_date")
    if not title or not start_date:
        return None

    return {
        "title": title,
        "start_date": start_date,
        "start_time": data.get("start_time"),
        "end_date": data.get("end_date"),
        "end_time": data.get("end_time"),
        "detail_url": detail_url,
        "ticket_url": data.get("ticket_url"),
        "image_url": data.get("image_url"),
        "description": data.get("description"),
        "price_min": data.get("price_min"),
        "price_max": data.get("price_max"),
        "price_note": data.get("price_note"),
        "is_free": data.get("is_free"),
        "artists": data.get("artists"),
    }


def discover_from_html(
    html: str,
    base_url: str,
    source_name: str,
    discovery: DiscoveryConfig,
    detail: DetailConfig,
    limit: int | None = None,
) -> list[dict]:
    events = discover_from_llm(html, base_url, source_name)
    events = _unique_events(events)

    if limit and len(events) >= limit:
        return events[:limit]

    links = _extract_links(html, base_url)
    list_urls = [url for url in links if _is_list_url(url)]
    detail_urls = [url for url in links if _is_detail_url(url)]

    needs_fallback = len(events) < _MIN_EVENTS and (
        list_urls or len(detail_urls) >= _MIN_DETAIL_LINKS
    )

    if not needs_fallback:
        return events[:limit] if limit else events

    logger.info(
        "LLM discovery yielded %s events for %s; trying fallback URLs",
        len(events),
        base_url,
    )

    # Try list-style pages first.
    for list_url in list_urls:
        list_html, err = fetch_html(list_url, discovery.fetch)
        if err:
            logger.debug("Fallback list fetch failed: %s - %s", list_url, err)
            continue
        more = discover_from_llm(list_html, list_url, source_name)
        events.extend(more)
        events = _unique_events(events)
        if limit and len(events) >= limit:
            return events[:limit]

    # If still low, walk detail links and extract JSON-LD event data.
    if detail.enabled and len(events) < _MIN_EVENTS and detail_urls:
        max_links = limit if limit else _MAX_DETAIL_FALLBACK
        for detail_url in detail_urls[:max_links]:
            detail_html, err = fetch_html(detail_url, detail.fetch)
            if err:
                continue
            data = extract_jsonld_event_fields(detail_html)
            seed = _seed_from_jsonld(detail_url, data)
            if seed:
                events.append(seed)
                events = _unique_events(events)
            if limit and len(events) >= limit:
                return events[:limit]

    return events[:limit] if limit else events
