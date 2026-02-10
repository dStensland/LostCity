#!/usr/bin/env python3
"""
Config-driven crawler pipeline runner (discovery + detail enrichment).

Usage:
  python pipeline_main.py --source example-venue
  python pipeline_main.py --source example-venue --insert --limit 25
"""

from __future__ import annotations

import argparse
import logging
from dataclasses import dataclass
from urllib.parse import urljoin

from db import (
    get_source_by_slug,
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    update_event,
    upsert_event_artists,
    upsert_event_images,
    upsert_event_links,
    update_event_extraction_metadata,
    compute_event_update,
    create_event_update_notifications,
    format_event_update_message,
    create_crawl_log,
    update_crawl_log,
)
from dedupe import generate_content_hash
from crawler_health import record_crawl_start, record_crawl_success, record_crawl_failure
from utils import setup_logging, slugify

from pipeline.loader import load_profile
from pipeline.fetch import fetch_html
from pipeline.discovery import discover_from_list
from pipeline.detail_enrich import enrich_from_detail
from pipeline.feed_discovery import discover_from_feed
from pipeline.html_discovery import discover_from_html
from pipeline.api_adapters import discover_events as discover_api_events

logger = logging.getLogger(__name__)


@dataclass
class CrawlResult:
    """Tracks event counts across a pipeline run."""
    events_found: int = 0
    events_new: int = 0
    events_updated: int = 0

_VENUE_CACHE: dict[str, int] = {}
_VENUE_TYPE_CACHE: dict[int, str | None] = {}
_DISCOVERY_CONFIDENCE = 0.70


def _get_or_create_default_venue(profile) -> int | None:
    if not profile.defaults.venue_name:
        return None

    venue_slug = slugify(profile.defaults.venue_name)
    if venue_slug in _VENUE_CACHE:
        return _VENUE_CACHE[venue_slug]

    venue_data = {
        "name": profile.defaults.venue_name,
        "slug": venue_slug,
        "website": None,
    }
    venue_id = get_or_create_venue(venue_data)
    _VENUE_CACHE[venue_slug] = venue_id

    from db import get_venue_by_id
    venue = get_venue_by_id(venue_id)
    if venue:
        _VENUE_TYPE_CACHE[venue_id] = venue.get("venue_type")

    return venue_id


def _get_or_create_event_venue(event: dict) -> int | None:
    venue = event.get("venue") or {}
    name = venue.get("name")
    if not name:
        return None

    slug = slugify(name)
    if slug in _VENUE_CACHE:
        return _VENUE_CACHE[slug]

    venue_data = {
        "name": name,
        "slug": slug,
        "address": venue.get("address"),
        "neighborhood": venue.get("neighborhood"),
        "city": venue.get("city"),
        "state": venue.get("state"),
        "zip": venue.get("zip"),
        "website": venue.get("website"),
    }
    venue_id = get_or_create_venue(venue_data)
    _VENUE_CACHE[slug] = venue_id
    return venue_id


def _merge_tags(event_tags: list | None, default_tags: list | None) -> list:
    tags = set(event_tags or [])
    tags.update(default_tags or [])
    return list(tags)


_VENUE_TYPE_TO_CATEGORY: dict[str, str] = {
    "music_venue": "music",
    "nightclub": "nightlife",
    "comedy_club": "comedy",
    "gallery": "art",
    "museum": "art",
    "brewery": "food_drink",
    "distillery": "food_drink",
    "winery": "food_drink",
    "bar": "nightlife",
    "sports_bar": "sports",
    "restaurant": "food_drink",
    "coffee_shop": "food_drink",
    "cinema": "film",
    "theater": "theater",
    "arena": "sports",
    "church": "community",
    "library": "learning",
    "bookstore": "words",
    "record_store": "music",
    "fitness_center": "fitness",
    "park": "outdoors",
    "garden": "outdoors",
    "farmers_market": "markets",
    "food_hall": "food_drink",
    "community_center": "community",
    "convention_center": "community",
    "college": "learning",
    "university": "learning",
}


def _infer_category(title: str, venue_type: str | None = None) -> str | None:
    """Best-effort category from title keywords or venue type."""
    if venue_type and venue_type in _VENUE_TYPE_TO_CATEGORY:
        return _VENUE_TYPE_TO_CATEGORY[venue_type]

    t = title.lower()
    if any(w in t for w in ("concert", "live music", "band", "dj set", "open mic")):
        return "music"
    if any(w in t for w in ("comedy", "stand-up", "standup", "improv")):
        return "comedy"
    if any(w in t for w in ("trivia", "bingo", "karaoke", "game night")):
        return "nightlife"
    if any(w in t for w in ("yoga", "run club", "5k", "marathon", "fitness")):
        return "fitness"
    if any(w in t for w in ("workshop", "class", "seminar", "lecture")):
        return "learning"
    if any(w in t for w in ("exhibit", "gallery", "art show", "opening reception")):
        return "art"
    if any(w in t for w in ("film", "movie", "screening")):
        return "film"
    if any(w in t for w in ("market", "pop-up", "popup")):
        return "markets"
    if any(w in t for w in ("drag", "burlesque")):
        return "nightlife"
    return None


def _ensure_link(links: list[dict], link_type: str, url: str, source: str, confidence: float) -> None:
    if not url:
        return
    for link in links:
        if link.get("type") == link_type and link.get("url") == url:
            return
    links.append(
        {
            "type": link_type,
            "url": url,
            "source": source,
            "confidence": confidence,
        }
    )


def _ensure_image(images: list[dict], url: str, source: str, confidence: float, is_primary: bool = False) -> None:
    if not url:
        return
    for image in images:
        if image.get("url") == url:
            if confidence > (image.get("confidence") or 0):
                image["confidence"] = confidence
                image["source"] = source
            if is_primary:
                image["is_primary"] = True
            return
    images.append(
        {
            "url": url,
            "source": source,
            "confidence": confidence,
            "is_primary": is_primary,
        }
    )


def _normalize_image_list(images: list) -> list[dict]:
    normalized: list[dict] = []
    for item in images:
        if isinstance(item, dict):
            if item.get("url"):
                normalized.append(item)
            continue
        if isinstance(item, str):
            normalized.append({"url": item})
    return normalized


def _normalize_link_list(links: list) -> list[dict]:
    normalized: list[dict] = []
    for item in links:
        if isinstance(item, dict):
            if item.get("type") and item.get("url"):
                normalized.append(item)
            continue
        if isinstance(item, str):
            normalized.append({"type": "ticket", "url": item})
    return normalized


def _should_skip_jsonld_only(profile, detail_url: str | None, enriched: dict) -> bool:
    if not profile.detail.jsonld_only:
        return False
    if not detail_url:
        return True
    if enriched.get("_skip"):
        return True
    if not enriched:
        return True
    return False


def run_profile(slug: str, dry_run: bool, limit: int | None) -> CrawlResult:
    result = CrawlResult()
    profile = load_profile(slug)
    source = get_source_by_slug(slug)
    if not source:
        raise ValueError(f"Source '{slug}' not found in database")

    if not profile.discovery.enabled:
        logger.info(f"{slug}: discovery disabled")
        return result

    default_venue_id = _get_or_create_default_venue(profile)

    if profile.discovery.type == "api":
        if not profile.discovery.api:
            raise ValueError(f"API discovery requires api config for '{slug}'")
        events = discover_api_events(
            profile.discovery.api.adapter,
            limit=limit,
            params=profile.discovery.api.params or None,
        )
        logger.info(f"{slug}: {len(events)} API events discovered")
        _process_api_events(events, source, profile, default_venue_id, dry_run=dry_run, result=result)
        return result

    if profile.discovery.type == "feed":
        all_seeds: list[dict] = []
        seen_keys: set[tuple] = set()

        for feed_url in profile.discovery.urls:
            content, err = fetch_html(feed_url, profile.discovery.fetch)
            if err:
                logger.warning(f"Feed fetch failed ({slug}): {feed_url} - {err}")
                continue

            seeds = discover_from_feed(content, feed_url, profile.discovery)
            for seed in seeds:
                detail_url = seed.get("detail_url")
                if detail_url and not detail_url.startswith("http"):
                    detail_url = urljoin(feed_url, detail_url)
                    seed["detail_url"] = detail_url

                key = (seed.get("title"), seed.get("start_date"), detail_url)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                all_seeds.append(seed)

        if limit:
            all_seeds = all_seeds[:limit]

        logger.info(f"{slug}: {len(all_seeds)} feed events discovered")

        for seed in all_seeds:
            detail_url = seed.get("detail_url")
            source_url = detail_url or profile.discovery.urls[0]
            title = seed.get("title")

            enriched: dict = {}
            if detail_url and profile.detail.enabled:
                html, err = fetch_html(detail_url, profile.detail.fetch)
                if err:
                    logger.debug(f"Detail fetch failed: {detail_url} - {err}")
                else:
                    enriched = enrich_from_detail(html, detail_url, profile.name, profile.detail)

            if _should_skip_jsonld_only(profile, detail_url, enriched):
                logger.debug("Skipping (jsonld-only): %s", detail_url or title)
                continue

            start_date = seed.get("start_date")
            if not title or not start_date:
                logger.debug(f"Skipping seed missing date: {seed.get('title')}")
                continue

            content_hash = generate_content_hash(title, profile.defaults.venue_name or "", start_date)
            artists = enriched.get("artists")
            images = _normalize_image_list(list(enriched.get("images") or []))
            links = _normalize_link_list(list(enriched.get("links") or []))
            field_provenance = enriched.get("field_provenance") or {}
            field_confidence = enriched.get("field_confidence") or {}
            extraction_version = enriched.get("extraction_version") or "pipeline_v3"

            venue_type = _VENUE_TYPE_CACHE.get(default_venue_id) if default_venue_id else None
            category = profile.defaults.category or _infer_category(title, venue_type)

            event_record = {
                "source_id": source["id"],
                "venue_id": default_venue_id,
                "title": title,
                "description": enriched.get("description") or seed.get("description"),
                "start_date": start_date,
                "start_time": enriched.get("start_time") or seed.get("start_time"),
                "end_date": enriched.get("end_date") or seed.get("end_date"),
                "end_time": enriched.get("end_time") or seed.get("end_time"),
                "is_all_day": False,
                "category": category,
                # subcategory deprecated — genres[] used instead
                "tags": _merge_tags(enriched.get("tags"), profile.defaults.tags),
                "price_min": enriched.get("price_min"),
                "price_max": enriched.get("price_max"),
                "price_note": enriched.get("price_note"),
                "is_free": bool(enriched.get("is_free")),
                "source_url": source_url,
                "ticket_url": enriched.get("ticket_url") or seed.get("ticket_url"),
                "image_url": enriched.get("image_url") or seed.get("image_url"),
                "raw_text": None,
                "extraction_confidence": 0.80,
                "extraction_version": extraction_version,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            if not event_record.get("ticket_url") and detail_url:
                event_record["ticket_url"] = detail_url

            ticket_url = event_record.get("ticket_url")
            image_url = event_record.get("image_url")

            if ticket_url and "ticket_url" not in field_provenance:
                field_provenance["ticket_url"] = {"source": "discovery", "url": source_url}
                field_confidence["ticket_url"] = _DISCOVERY_CONFIDENCE
            if image_url and "image_url" not in field_provenance:
                field_provenance["image_url"] = {"source": "discovery", "url": source_url}
                field_confidence["image_url"] = _DISCOVERY_CONFIDENCE

            _ensure_link(links, "event", source_url, "discovery", 0.9)
            if ticket_url:
                _ensure_link(links, "ticket", ticket_url, "discovery", _DISCOVERY_CONFIDENCE)
            if image_url:
                _ensure_image(images, image_url, "discovery", _DISCOVERY_CONFIDENCE, is_primary=True)

            if field_provenance:
                event_record["field_provenance"] = field_provenance
            if field_confidence:
                event_record["field_confidence"] = field_confidence

            result.events_found += 1
            existing = find_event_by_hash(content_hash)
            if existing:
                update_data, changes, cancelled = compute_event_update(existing, event_record)
                if update_data:
                    update_event(existing["id"], update_data)
                    result.events_updated += 1
                    message = format_event_update_message(
                        existing.get("title", title),
                        changes,
                        cancelled=cancelled,
                    )
                    if changes or cancelled:
                        create_event_update_notifications(existing["id"], message)
                if artists:
                    upsert_event_artists(existing["id"], artists)
                if images:
                    upsert_event_images(existing["id"], images)
                if links:
                    upsert_event_links(existing["id"], links)
                if field_provenance or field_confidence or extraction_version:
                    update_event_extraction_metadata(
                        existing["id"],
                        field_provenance=field_provenance or None,
                        field_confidence=field_confidence or None,
                        extraction_version=extraction_version,
                    )
                continue

            if dry_run:
                logger.info(f"[DRY RUN] {title} ({start_date}) -> {event_record.get('ticket_url')}")
                result.events_new += 1
            else:
                try:
                    event_id = insert_event(event_record)
                    result.events_new += 1
                    if artists:
                        upsert_event_artists(event_id, artists)
                    if images:
                        upsert_event_images(event_id, images)
                    if links:
                        upsert_event_links(event_id, links)
                    logger.info(f"Inserted: {title} ({start_date})")
                except Exception as e:
                    logger.warning(f"Insert failed: {title} - {e}")
        return result

    if profile.discovery.type == "html":
        _process_llm_discovery(profile, source, default_venue_id, dry_run=dry_run, limit=limit, result=result)
        return result

    # List-based discovery
    all_seeds: list[dict] = []
    seen_keys: set[tuple] = set()

    for list_url in profile.discovery.urls:
        html, err = fetch_html(list_url, profile.discovery.fetch)
        if err:
            logger.warning(f"Fetch failed ({slug}): {list_url} - {err}")
            continue

        seeds = discover_from_list(html, profile.discovery)
        for seed in seeds:
            detail_url = seed.get("detail_url")
            if detail_url and not detail_url.startswith("http"):
                detail_url = urljoin(list_url, detail_url)
                seed["detail_url"] = detail_url

            key = (seed.get("title"), seed.get("start_date"), detail_url)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            all_seeds.append(seed)

    if limit:
        all_seeds = all_seeds[:limit]

    logger.info(f"{slug}: {len(all_seeds)} seeds discovered")

    for seed in all_seeds:
        detail_url = seed.get("detail_url")
        source_url = detail_url or profile.discovery.urls[0]
        title = seed.get("title")

        enriched: dict = {}
        if detail_url and profile.detail.enabled:
            html, err = fetch_html(detail_url, profile.detail.fetch)
            if err:
                logger.debug(f"Detail fetch failed: {detail_url} - {err}")
            else:
                enriched = enrich_from_detail(html, detail_url, profile.name, profile.detail)

        if _should_skip_jsonld_only(profile, detail_url, enriched):
            logger.debug("Skipping (jsonld-only): %s", detail_url or title)
            continue

        start_date = seed.get("start_date")
        if not title or not start_date:
            logger.debug(f"Skipping seed missing date: {seed.get('title')}")
            continue

        content_hash = generate_content_hash(title, profile.defaults.venue_name or "", start_date)
        artists = enriched.get("artists")
        images = _normalize_image_list(list(enriched.get("images") or []))
        links = _normalize_link_list(list(enriched.get("links") or []))
        field_provenance = enriched.get("field_provenance") or {}
        field_confidence = enriched.get("field_confidence") or {}
        extraction_version = enriched.get("extraction_version") or "pipeline_v3"

        venue_type = _VENUE_TYPE_CACHE.get(default_venue_id) if default_venue_id else None
        category = profile.defaults.category or _infer_category(title, venue_type)

        event_record = {
            "source_id": source["id"],
            "venue_id": default_venue_id,
            "title": title,
            "description": enriched.get("description") or seed.get("description"),
            "start_date": start_date,
            "start_time": enriched.get("start_time") or seed.get("start_time"),
            "end_date": enriched.get("end_date") or seed.get("end_date"),
            "end_time": enriched.get("end_time") or seed.get("end_time"),
            "is_all_day": False,
            "category": category,
            # subcategory deprecated — genres[] used instead
            "tags": _merge_tags(enriched.get("tags"), profile.defaults.tags),
            "price_min": enriched.get("price_min"),
            "price_max": enriched.get("price_max"),
            "price_note": enriched.get("price_note"),
            "is_free": bool(enriched.get("is_free")),
            "source_url": source_url,
            "ticket_url": enriched.get("ticket_url") or seed.get("ticket_url"),
            "image_url": enriched.get("image_url") or seed.get("image_url"),
            "raw_text": None,
            "extraction_confidence": 0.80,
            "extraction_version": extraction_version,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        if not event_record.get("ticket_url") and detail_url:
            event_record["ticket_url"] = detail_url

        ticket_url = event_record.get("ticket_url")
        image_url = event_record.get("image_url")

        if ticket_url and "ticket_url" not in field_provenance:
            field_provenance["ticket_url"] = {"source": "discovery", "url": source_url}
            field_confidence["ticket_url"] = _DISCOVERY_CONFIDENCE
        if image_url and "image_url" not in field_provenance:
            field_provenance["image_url"] = {"source": "discovery", "url": source_url}
            field_confidence["image_url"] = _DISCOVERY_CONFIDENCE

        _ensure_link(links, "event", source_url, "discovery", 0.9)
        if ticket_url:
            _ensure_link(links, "ticket", ticket_url, "discovery", _DISCOVERY_CONFIDENCE)
        if image_url:
            _ensure_image(images, image_url, "discovery", _DISCOVERY_CONFIDENCE, is_primary=True)

        if field_provenance:
            event_record["field_provenance"] = field_provenance
        if field_confidence:
            event_record["field_confidence"] = field_confidence

        result.events_found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            update_data, changes, cancelled = compute_event_update(existing, event_record)
            if update_data:
                update_event(existing["id"], update_data)
                result.events_updated += 1
                message = format_event_update_message(
                    existing.get("title", title),
                    changes,
                    cancelled=cancelled,
                )
                if changes or cancelled:
                    create_event_update_notifications(existing["id"], message)
            if artists:
                upsert_event_artists(existing["id"], artists)
            if images:
                upsert_event_images(existing["id"], images)
            if links:
                upsert_event_links(existing["id"], links)
            if field_provenance or field_confidence or extraction_version:
                update_event_extraction_metadata(
                    existing["id"],
                    field_provenance=field_provenance or None,
                    field_confidence=field_confidence or None,
                    extraction_version=extraction_version,
                )
            continue

        if dry_run:
            logger.info(f"[DRY RUN] {title} ({start_date}) -> {event_record.get('ticket_url')}")
            result.events_new += 1
        else:
            try:
                event_id = insert_event(event_record)
                result.events_new += 1
                if artists:
                    upsert_event_artists(event_id, artists)
                if images:
                    upsert_event_images(event_id, images)
                if links:
                    upsert_event_links(event_id, links)
                logger.info(f"Inserted: {title} ({start_date})")
            except Exception as e:
                logger.warning(f"Insert failed: {title} - {e}")

    return result


def _process_llm_discovery(profile, source, default_venue_id: int | None, dry_run: bool, limit: int | None, result: CrawlResult | None = None) -> None:
    if result is None:
        result = CrawlResult()
    all_events: list[dict] = []
    for url in profile.discovery.urls:
        html, err = fetch_html(url, profile.discovery.fetch)
        if err:
            logger.warning(f"Fetch failed ({profile.slug}): {url} - {err}")
            continue
        events = discover_from_html(
            html,
            url,
            profile.name,
            profile.discovery,
            profile.detail,
            limit=limit,
        )
        all_events.extend(events)

    if limit:
        all_events = all_events[:limit]

    logger.info(f"{profile.slug}: {len(all_events)} LLM events discovered")

    for event in all_events:
        title = event.get("title")
        start_date = event.get("start_date")
        if not title or not start_date:
            continue

        detail_url = event.get("detail_url")
        enriched = {}
        if detail_url and profile.detail.enabled:
            html, err = fetch_html(detail_url, profile.detail.fetch)
            if err:
                logger.debug(f"Detail fetch failed: {detail_url} - {err}")
            else:
                enriched = enrich_from_detail(html, detail_url, profile.name, profile.detail)
        if _should_skip_jsonld_only(profile, detail_url, enriched):
            logger.debug("Skipping (jsonld-only): %s", detail_url or title)
            continue

        venue_id = default_venue_id or _get_or_create_event_venue(event)

        content_hash = generate_content_hash(
            title,
            profile.defaults.venue_name or (event.get("venue") or {}).get("name", ""),
            start_date,
        )

        artists = enriched.get("artists") or event.get("artists")
        images = _normalize_image_list(list(enriched.get("images") or event.get("images") or []))
        links = _normalize_link_list(list(enriched.get("links") or event.get("links") or []))
        field_provenance = enriched.get("field_provenance") or {}
        field_confidence = enriched.get("field_confidence") or {}
        extraction_version = enriched.get("extraction_version") or "pipeline_v3"

        venue_type = _VENUE_TYPE_CACHE.get(venue_id) if venue_id else None
        category = event.get("category") or profile.defaults.category or _infer_category(title, venue_type)

        event_record = {
            "source_id": source["id"],
            "venue_id": venue_id,
            "title": title,
            "description": enriched.get("description") or event.get("description"),
            "start_date": start_date,
            "start_time": enriched.get("start_time") or event.get("start_time"),
            "end_date": enriched.get("end_date") or event.get("end_date"),
            "end_time": enriched.get("end_time") or event.get("end_time"),
            "is_all_day": bool(event.get("is_all_day")),
            "category": category,
            # subcategory deprecated — genres[] used instead
            "tags": _merge_tags(event.get("tags"), profile.defaults.tags),
            "price_min": enriched.get("price_min") or event.get("price_min"),
            "price_max": enriched.get("price_max") or event.get("price_max"),
            "price_note": enriched.get("price_note") or event.get("price_note"),
            "is_free": bool(enriched.get("is_free") or event.get("is_free")),
            "source_url": detail_url or event.get("detail_url") or event.get("ticket_url") or profile.discovery.urls[0],
            "ticket_url": enriched.get("ticket_url") or event.get("ticket_url"),
            "image_url": enriched.get("image_url") or event.get("image_url"),
            "raw_text": None,
            "extraction_confidence": min(event.get("confidence", 0.7), 1.0),
            "extraction_version": extraction_version,
            "is_recurring": bool(event.get("is_recurring")),
            "recurrence_rule": event.get("recurrence_rule"),
            "content_hash": content_hash,
        }

        if not event_record.get("ticket_url") and detail_url:
            event_record["ticket_url"] = detail_url

        ticket_url = event_record.get("ticket_url")
        image_url = event_record.get("image_url")
        source_url = event_record.get("source_url")

        if ticket_url and "ticket_url" not in field_provenance:
            field_provenance["ticket_url"] = {"source": "discovery", "url": source_url}
            field_confidence["ticket_url"] = _DISCOVERY_CONFIDENCE
        if image_url and "image_url" not in field_provenance:
            field_provenance["image_url"] = {"source": "discovery", "url": source_url}
            field_confidence["image_url"] = _DISCOVERY_CONFIDENCE

        _ensure_link(links, "event", source_url, "discovery", 0.9)
        if ticket_url:
            _ensure_link(links, "ticket", ticket_url, "discovery", _DISCOVERY_CONFIDENCE)
        if image_url:
            _ensure_image(images, image_url, "discovery", _DISCOVERY_CONFIDENCE, is_primary=True)

        if field_provenance:
            event_record["field_provenance"] = field_provenance
        if field_confidence:
            event_record["field_confidence"] = field_confidence

        result.events_found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            update_data, changes, cancelled = compute_event_update(existing, event_record)
            if update_data:
                update_event(existing["id"], update_data)
                result.events_updated += 1
                message = format_event_update_message(
                    existing.get("title", title),
                    changes,
                    cancelled=cancelled,
                )
                if changes or cancelled:
                    create_event_update_notifications(existing["id"], message)
            if artists:
                upsert_event_artists(existing["id"], artists)
            if images:
                upsert_event_images(existing["id"], images)
            if links:
                upsert_event_links(existing["id"], links)
            if field_provenance or field_confidence or extraction_version:
                update_event_extraction_metadata(
                    existing["id"],
                    field_provenance=field_provenance or None,
                    field_confidence=field_confidence or None,
                    extraction_version=extraction_version,
                )
            continue

        if dry_run:
            logger.info(f"[DRY RUN] {title} ({start_date}) -> {event_record.get('ticket_url')}")
            result.events_new += 1
        else:
            try:
                event_id = insert_event(event_record)
                result.events_new += 1
                if artists:
                    upsert_event_artists(event_id, artists)
                if images:
                    upsert_event_images(event_id, images)
                if links:
                    upsert_event_links(event_id, links)
                logger.info(f"Inserted: {title} ({start_date})")
            except Exception as e:
                logger.warning(f"Insert failed: {title} - {e}")


def _process_api_events(events: list[dict], source: dict, profile, default_venue_id: int | None, dry_run: bool, result: CrawlResult | None = None) -> None:
    if result is None:
        result = CrawlResult()
    api_confidence = 0.95
    for event in events:
        title = event.get("title")
        start_date = event.get("start_date")
        if not title or not start_date:
            continue

        venue_id = default_venue_id or _get_or_create_event_venue(event)
        venue_name = (event.get("venue") or {}).get("name", "") or profile.defaults.venue_name or ""

        content_hash = generate_content_hash(title, venue_name, start_date)

        tags = _merge_tags(None, profile.defaults.tags)

        field_provenance: dict = {}
        field_confidence: dict = {}

        event_record = {
            "source_id": source["id"],
            "venue_id": venue_id,
            "title": title,
            "description": event.get("description"),
            "start_date": start_date,
            "start_time": event.get("start_time"),
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": event.get("category") or profile.defaults.category,
            # subcategory deprecated — genres[] used instead
            "tags": tags,
            "price_min": event.get("price_min"),
            "price_max": event.get("price_max"),
            "price_note": None,
            "is_free": False,
            "source_url": event.get("source_url"),
            "ticket_url": event.get("ticket_url"),
            "image_url": event.get("image_url"),
            "raw_text": None,
            "extraction_confidence": 0.9,
            "extraction_version": "pipeline_v3",
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        if not event_record.get("ticket_url") and event_record.get("source_url"):
            event_record["ticket_url"] = event_record["source_url"]

        for key in ("title", "description", "start_date", "start_time", "ticket_url", "image_url", "price_min", "price_max"):
            if event_record.get(key) is not None:
                field_provenance[key] = {"source": "api", "url": event.get("source_url")}
                field_confidence[key] = api_confidence

        if field_provenance:
            event_record["field_provenance"] = field_provenance
        if field_confidence:
            event_record["field_confidence"] = field_confidence

        images = _normalize_image_list(list(event.get("images") or []))
        links = _normalize_link_list(list(event.get("links") or []))

        if event.get("image_url"):
            _ensure_image(images, event.get("image_url"), "api", api_confidence, is_primary=True)
        if event.get("source_url"):
            _ensure_link(links, "event", event.get("source_url"), "api", api_confidence)
        if event.get("ticket_url"):
            _ensure_link(links, "ticket", event.get("ticket_url"), "api", api_confidence)

        result.events_found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            update_data, changes, cancelled = compute_event_update(existing, event_record)
            if update_data:
                update_event(existing["id"], update_data)
                result.events_updated += 1
                message = format_event_update_message(
                    existing.get("title", title),
                    changes,
                    cancelled=cancelled,
                )
                if changes or cancelled:
                    create_event_update_notifications(existing["id"], message)
            if event.get("artists"):
                upsert_event_artists(existing["id"], event.get("artists"))
            if images:
                upsert_event_images(existing["id"], images)
            if links:
                upsert_event_links(existing["id"], links)
            if field_provenance or field_confidence:
                update_event_extraction_metadata(
                    existing["id"],
                    field_provenance=field_provenance or None,
                    field_confidence=field_confidence or None,
                    extraction_version="pipeline_v3",
                )
            continue

        if dry_run:
            logger.info(f"[DRY RUN] {title} ({start_date}) -> {event_record.get('ticket_url')}")
            result.events_new += 1
        else:
            try:
                event_id = insert_event(event_record)
                result.events_new += 1
                if event.get("artists"):
                    upsert_event_artists(event_id, event.get("artists"))
                if images:
                    upsert_event_images(event_id, images)
                if links:
                    upsert_event_links(event_id, links)
                logger.info(f"Inserted: {title} ({start_date})")
            except Exception as e:
                logger.warning(f"Insert failed: {title} - {e}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run config-driven pipeline")
    parser.add_argument("--source", action="append", help="Source slug (repeatable)")
    parser.add_argument("--insert", action="store_true", help="Insert events into DB")
    parser.add_argument("--limit", type=int, default=0, help="Limit seeds per source")
    parser.add_argument("--post-crawl", action="store_true", help="Run post-crawl health report and HTML dashboard")
    args = parser.parse_args()

    setup_logging()

    if args.post_crawl:
        from crawler_health import print_health_report
        from post_crawl_report import save_report

        print_health_report()
        filepath = save_report()
        logger.info(f"HTML report saved: {filepath}")
        return

    if not args.source:
        parser.error("--source is required unless --post-crawl is used")

    dry_run = not args.insert

    for slug in args.source:
        source = get_source_by_slug(slug)
        source_id = source["id"] if source else None

        # Start health + crawl log tracking
        run_id = record_crawl_start(slug)
        crawl_log_id = None
        if source_id and not dry_run:
            try:
                crawl_log_id = create_crawl_log(source_id)
            except Exception as e:
                logger.debug(f"Could not create crawl_log: {e}")

        try:
            result = run_profile(slug, dry_run=dry_run, limit=args.limit or None)
            record_crawl_success(run_id, result.events_found, result.events_new, result.events_updated)
            if crawl_log_id:
                update_crawl_log(
                    crawl_log_id,
                    status="success",
                    events_found=result.events_found,
                    events_new=result.events_new,
                    events_updated=result.events_updated,
                )
            logger.info(f"{slug}: found={result.events_found} new={result.events_new} updated={result.events_updated}")
        except Exception as e:
            error_msg = str(e)
            record_crawl_failure(run_id, error_msg)
            if crawl_log_id:
                update_crawl_log(crawl_log_id, status="error", error_message=error_msg[:500])
            logger.error(f"{slug}: {error_msg}")


if __name__ == "__main__":
    main()
