#!/usr/bin/env python3
"""Unified artist backfill and normalization for all event categories.

Replaces three older scripts:
  - batch_backfill_artists.py  (music/comedy/nightlife backfill via parse_lineup_from_title)
  - normalize_event_participants.py  (cleanup existing rows via sanitize_event_artists)
  - backfill_artists.py  (music-only backfill + enrichment + description regen)

Two passes:
  Cleanup  — re-sanitize events that already have event_artists rows
  Backfill — extract artists from titles for events with no rows

Usage:
  python scripts/backfill_event_artists.py --dry-run
  python scripts/backfill_event_artists.py --portal atlanta --categories music --backfill-only --source-slugs terminal-west,boggs-social --dry-run
  python scripts/backfill_event_artists.py --categories sports --dry-run
  python scripts/backfill_event_artists.py --categories comedy --backfill-only --allow-single-entity --dry-run
  python scripts/backfill_event_artists.py --backfill-only
  python scripts/backfill_event_artists.py --cleanup-only
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from collections import Counter
from datetime import date
from typing import Any, Optional
from urllib.parse import urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLERS_ROOT = os.path.dirname(SCRIPT_DIR)
if CRAWLERS_ROOT not in sys.path:
    sys.path.insert(0, CRAWLERS_ROOT)

from db import get_client, sanitize_event_artists, upsert_event_artists

logger = logging.getLogger(__name__)
_EVENTS_HAS_SUBCATEGORY_COLUMN: Optional[bool] = None

# Categories where title extraction makes sense (backfill pass)
BACKFILL_CATEGORIES = {"music", "comedy", "nightlife", "sports"}

# All categories that can have event_artists rows (cleanup pass)
CLEANUP_CATEGORIES = {
    "sports", "comedy", "music", "theater", "nightlife",
    "learning", "words", "community", "art", "film",
}

# Nightlife subcategories where title parsing won't find real performers
_NIGHTLIFE_SKIP_SUBCATEGORIES = {
    "karaoke", "trivia", "bar_event", "poker", "bingo",
    "nightlife.karaoke", "nightlife.trivia", "nightlife.bar_event",
    "nightlife.poker", "nightlife.bingo",
}

# Event-title terms that are usually not artist entities.
_SINGLE_ENTITY_REJECT_TERMS = {
    "tour",
    "festival",
    "experience",
    "worship",
    "service",
    "series",
    "class",
    "workshop",
    "conference",
    "screening",
    "showing",
    "night",
    "party",
    "edition",
    "presents",
}


def _normalize(value: str | None) -> str:
    return " ".join((value or "").lower().split())


def _signature(rows: list[dict[str, Any]]) -> tuple[tuple[str, str, int, bool], ...]:
    """Create a comparable fingerprint of artist rows for change detection."""
    normalized = []
    for row in rows:
        normalized.append((
            _normalize(str(row.get("name") or "")),
            _normalize(str(row.get("role") or "")),
            int(row.get("billing_order") or 0),
            bool(row.get("is_headliner")),
        ))
    normalized.sort()
    return tuple(normalized)


def _is_high_confidence_backfill(
    *,
    title: str,
    category: str,
    artists: list[dict[str, Any]],
    allow_single_entity: bool,
) -> bool:
    names = [
        " ".join(str(row.get("name") or "").split())
        for row in artists
        if " ".join(str(row.get("name") or "").split())
    ]
    unique_names = {name.lower() for name in names}
    if not unique_names:
        return False

    # Sports requires both sides.
    if category == "sports":
        return len(unique_names) >= 2

    # Multi-entity lineups are typically safe.
    if len(unique_names) >= 2:
        return True

    if not allow_single_entity:
        return False

    single = names[0].strip()
    lowered = single.lower()
    if len(single.split()) > 8:
        return False
    if any(ch in single for ch in (":", ";", "|", "/", "\\")):
        return False
    if any(term in lowered for term in _SINGLE_ENTITY_REJECT_TERMS):
        return False
    if lowered in {"live music"}:
        return False

    # Guard obvious title-mirror noise when title is event-y.
    title_norm = " ".join((title or "").lower().split())
    if title_norm == lowered and any(term in title_norm for term in _SINGLE_ENTITY_REJECT_TERMS):
        return False
    if title_norm == lowered and re.search(r"\bsymphony\s+no\.?\s*\d+\b", title_norm):
        return False

    return True


def _resolve_portal_id(client, portal_slug: Optional[str]) -> Optional[str]:
    slug = " ".join((portal_slug or "").split()).strip()
    if not slug:
        return None
    rows = (
        client.table("portals")
        .select("id,slug")
        .eq("slug", slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise ValueError(f"Portal slug not found: {slug}")
    portal_id = str(rows[0].get("id") or "").strip()
    if not portal_id:
        raise ValueError(f"Portal slug resolved without id: {slug}")
    return portal_id


def _resolve_source_ids(client, source_slugs: list[str]) -> list[int]:
    slugs = [s.strip() for s in source_slugs if s and s.strip()]
    if not slugs:
        return []
    rows = (
        client.table("sources")
        .select("id,slug")
        .in_("slug", slugs)
        .execute()
        .data
        or []
    )
    id_by_slug = {str(row.get("slug")): int(row.get("id")) for row in rows if row.get("id") is not None}
    missing = [slug for slug in slugs if slug not in id_by_slug]
    if missing:
        logger.warning("Unknown source slugs ignored: %s", ", ".join(sorted(missing)))
    return [id_by_slug[slug] for slug in slugs if slug in id_by_slug]


def _events_support_subcategory_column(client) -> bool:
    global _EVENTS_HAS_SUBCATEGORY_COLUMN
    if _EVENTS_HAS_SUBCATEGORY_COLUMN is not None:
        return bool(_EVENTS_HAS_SUBCATEGORY_COLUMN)
    try:
        client.table("events").select("subcategory").limit(1).execute()
        _EVENTS_HAS_SUBCATEGORY_COLUMN = True
    except Exception as exc:
        if "subcategory" in str(exc).lower() and "does not exist" in str(exc).lower():
            _EVENTS_HAS_SUBCATEGORY_COLUMN = False
        else:
            raise
    return bool(_EVENTS_HAS_SUBCATEGORY_COLUMN)


def _load_scoped_events(
    categories: set[str],
    source_ids: list[int] | None = None,
    start_date: str | None = None,
    portal_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    client = get_client()
    lower_bound = start_date or date.today().isoformat()
    all_events: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    include_subcategory = _events_support_subcategory_column(client)

    while True:
        fields = (
            "id,title,category_id,subcategory,source_id,source_url,description"
            if include_subcategory
            else "id,title,category_id,source_id,source_url,description"
        )
        query = (
            client.table("events")
            .select(fields)
            .in_("category_id", sorted(categories))
            .gte("start_date", lower_bound)
            .is_("canonical_event_id", "null")
            .eq("is_active", True)
            .order("id")
            .range(offset, offset + page_size - 1)
        )
        if source_ids:
            query = query.in_("source_id", source_ids)
        if portal_id:
            query = query.or_(f"portal_id.is.null,portal_id.eq.{portal_id}")

        rows = query.execute().data or []
        if not rows:
            break
        all_events.extend(rows)
        offset += len(rows)
        if len(rows) < page_size:
            break

    return all_events


def _load_events_with_artists(
    categories: set[str],
    source_ids: list[int] | None = None,
    start_date: str | None = None,
    portal_id: Optional[str] = None,
) -> dict[int, dict[str, Any]]:
    """Fetch upcoming events that have event_artists rows, grouped by event_id."""
    client = get_client()
    scoped_events = _load_scoped_events(
        categories=categories,
        source_ids=source_ids,
        start_date=start_date,
        portal_id=portal_id,
    )
    if not scoped_events:
        return {}

    event_map: dict[int, dict[str, Any]] = {}
    event_ids: list[int] = []
    for event in scoped_events:
        event_id = event.get("id")
        if event_id is None:
            continue
        eid = int(event_id)
        event_ids.append(eid)
        event_map[eid] = event

    all_rows: list[dict[str, Any]] = []
    for i in range(0, len(event_ids), 500):
        chunk = event_ids[i : i + 500]
        rows = (
            client.table("event_artists")
            .select("event_id,name,role,billing_order,is_headliner")
            .in_("event_id", chunk)
            .execute()
            .data
            or []
        )
        all_rows.extend(rows)

    grouped: dict[int, dict[str, Any]] = {}
    for row in all_rows:
        event_id = row.get("event_id")
        if not event_id:
            continue
        eid = int(event_id)
        event = event_map.get(eid) or {}
        category = (event.get("category_id") or "").strip().lower()
        if category not in categories or not event:
            continue

        bucket = grouped.setdefault(eid, {
            "title": event.get("title") or "",
            "category": category,
            "artists": [],
        })
        bucket["artists"].append({
            "name": row.get("name"),
            "role": row.get("role"),
            "billing_order": row.get("billing_order"),
            "is_headliner": row.get("is_headliner"),
        })

    return grouped


def _load_events_without_artists(
    categories: set[str],
    source_ids: list[int] | None = None,
    start_date: str | None = None,
    portal_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Fetch upcoming events in backfill-eligible categories, then filter to those missing artists."""
    client = get_client()
    all_events = _load_scoped_events(
        categories=categories,
        source_ids=source_ids,
        start_date=start_date,
        portal_id=portal_id,
    )

    if not all_events:
        return []

    # Batch-check which already have event_artists rows
    event_ids = [e["id"] for e in all_events]
    has_artists: set[int] = set()
    for i in range(0, len(event_ids), 500):
        chunk = event_ids[i : i + 500]
        r = client.table("event_artists").select("event_id").in_("event_id", chunk).execute()
        for row in r.data or []:
            has_artists.add(row["event_id"])

    return [e for e in all_events if e["id"] not in has_artists]


def _normalize_slug_phrase(value: str) -> str:
    cleaned = re.sub(r"-(?:\d+)$", "", value.strip().lower())
    cleaned = re.sub(r"[-_]+", " ", cleaned)
    return " ".join(cleaned.split()).strip()


def _to_display_name(value: str) -> str:
    words = []
    for token in value.split():
        if token.upper() in {"DJ", "MC"}:
            words.append(token.upper())
        elif re.fullmatch(r"[a-z]\.", token):
            words.append(token.upper())
        else:
            words.append(token.capitalize())
    return " ".join(words).strip()


def _fallback_single_entity_from_source(
    *,
    source_slug: str,
    source_url: str,
    description: str,
) -> list[dict[str, Any]]:
    slug = source_slug.strip().lower()
    url = (source_url or "").strip()
    desc = " ".join((description or "").split())
    if not slug:
        return []

    # Masquerade pages often keep the artist in URL slug/lede when card titles are tour names.
    if slug == "the-masquerade":
        special_slug_names = {
            "theartit": "TheARTI$T",
        }

        def _candidate_allowed(value: str) -> bool:
            lowered = value.lower()
            if any(
                token in lowered
                for token in ("karaoke", "open mic", "trivia", "party", "tour", "experience")
            ):
                return False
            return True

        match = re.search(
            r"at The Masquerade\.?\s+([A-Za-z0-9$&'’\-\.\s]{2,90}?)\s+(?:is|are)\b",
            desc,
            flags=re.IGNORECASE,
        )
        if match:
            candidate = " ".join((match.group(1) or "").split()).strip(" -\u2013\u2014")
            candidate = re.sub(r"^[A-Za-z][A-Za-z\s\-]{0,30}[’']s\s+", "", candidate)
            if candidate and _candidate_allowed(candidate):
                return [{
                    "name": candidate,
                    "role": "headliner",
                    "billing_order": 1,
                    "is_headliner": True,
                }]

        if url:
            parsed = urlparse(url)
            parts = [p for p in parsed.path.split("/") if p]
            if len(parts) >= 2 and parts[0] == "events":
                slug_part = _normalize_slug_phrase(parts[1])
                if slug_part and _candidate_allowed(slug_part):
                    display_name = special_slug_names.get(slug_part) or _to_display_name(slug_part)
                    return [{
                        "name": display_name,
                        "role": "headliner",
                        "billing_order": 1,
                        "is_headliner": True,
                    }]

    return []


def run_cleanup_pass(
    categories: set[str],
    source_ids: list[int] | None = None,
    start_date: str | None = None,
    portal_id: Optional[str] = None,
    dry_run: bool = True,
    skip_linking: bool = False,
    max_events: int = 0,
    show_samples: int = 20,
) -> dict[str, int]:
    """Re-sanitize existing event_artists rows; delete or upsert if changed."""
    stats: Counter[str] = Counter()
    samples: list[str] = []

    grouped = _load_events_with_artists(
        categories=categories,
        source_ids=source_ids,
        start_date=start_date,
        portal_id=portal_id,
    )
    event_ids = sorted(grouped.keys())
    if max_events > 0:
        event_ids = event_ids[:max_events]

    logger.info("Cleanup pass: %d events with existing artists", len(event_ids))

    client = get_client()
    for idx, event_id in enumerate(event_ids, start=1):
        payload = grouped[event_id]
        title = payload["title"]
        category = payload["category"]
        current_artists = payload["artists"]

        before = _signature(current_artists)
        sanitized = sanitize_event_artists(title, category, current_artists)
        after = _signature(sanitized)

        stats["checked"] += 1

        if before == after:
            continue

        if not sanitized:
            # Sanitized to empty — delete all rows
            stats["deleted"] += 1
            if len(samples) < show_samples:
                names = ", ".join(a.get("name") or "" for a in current_artists)
                samples.append(f"  DELETE {event_id} [{category}] {title[:60]}\n    was: {names}")
            if not dry_run:
                client.table("event_artists").delete().eq("event_id", event_id).execute()
        else:
            stats["changed"] += 1
            if len(samples) < show_samples:
                before_names = ", ".join(a.get("name") or "" for a in current_artists)
                after_names = ", ".join(a.get("name") or "" for a in sanitized)
                samples.append(
                    f"  UPDATE {event_id} [{category}] {title[:60]}\n"
                    f"    before: {before_names}\n    after:  {after_names}"
                )
            if not dry_run:
                upsert_event_artists(event_id, sanitized, link_canonical=not skip_linking)

        if idx % 250 == 0:
            logger.info("Cleanup: processed %d/%d events...", idx, len(event_ids))

    mode = "DRY RUN" if dry_run else "APPLIED"
    print(f"\n=== Cleanup {mode} ===")
    print(f"  Checked: {stats['checked']}")
    print(f"  Changed: {stats['changed']}")
    print(f"  Deleted: {stats['deleted']}")
    if samples:
        print("\nSample changes:")
        for s in samples:
            print(s)

    return {
        "cleanup_checked": stats["checked"],
        "cleanup_changed": stats["changed"],
        "cleanup_deleted": stats["deleted"],
    }


def run_backfill_pass(
    categories: set[str],
    source_ids: list[int] | None = None,
    start_date: str | None = None,
    portal_id: Optional[str] = None,
    dry_run: bool = True,
    skip_linking: bool = False,
    allow_single_entity: bool = False,
    max_events: int = 0,
    show_samples: int = 20,
) -> dict[str, int]:
    """Extract artists from titles for events with no event_artists rows."""
    stats: Counter[str] = Counter()
    samples: list[str] = []

    missing = _load_events_without_artists(
        categories=categories,
        source_ids=source_ids,
        start_date=start_date,
        portal_id=portal_id,
    )
    if max_events > 0:
        missing = missing[:max_events]

    logger.info("Backfill pass: %d events without artists", len(missing))
    source_ids = sorted(
        {int(event["source_id"]) for event in missing if event.get("source_id") is not None}
    )
    source_slug_by_id: dict[int, str] = {}
    if source_ids:
        client = get_client()
        for i in range(0, len(source_ids), 200):
            rows = (
                client.table("sources")
                .select("id,slug")
                .in_("id", source_ids[i : i + 200])
                .execute()
                .data
                or []
            )
            for row in rows:
                if row.get("id") is not None and row.get("slug"):
                    source_slug_by_id[int(row["id"])] = str(row["slug"])

    for idx, event in enumerate(missing, start=1):
        event_id = event["id"]
        title = event.get("title") or ""
        category = (event.get("category_id") or "").strip().lower()
        subcategory = (event.get("subcategory") or "").strip().lower()
        source_id = event.get("source_id")
        source_slug = (
            source_slug_by_id.get(int(source_id), "") if source_id is not None else ""
        )

        # Skip nightlife events in participatory subcategories
        if category == "nightlife" and subcategory in _NIGHTLIFE_SKIP_SUBCATEGORIES:
            stats["skipped_nightlife"] += 1
            continue

        stats["checked"] += 1
        parsed_result = sanitize_event_artists(title, category, [])
        fallback_result = _fallback_single_entity_from_source(
            source_slug=source_slug,
            source_url=str(event.get("source_url") or ""),
            description=str(event.get("description") or ""),
        )

        result = parsed_result
        if not result:
            result = fallback_result

        if (
            result
            and parsed_result
            and fallback_result
            and not _is_high_confidence_backfill(
                title=title,
                category=category,
                artists=parsed_result,
                allow_single_entity=allow_single_entity,
            )
            and _is_high_confidence_backfill(
                title=title,
                category=category,
                artists=fallback_result,
                allow_single_entity=allow_single_entity,
            )
        ):
            # Prefer source-derived fallback when title-derived parse is low-confidence.
            result = fallback_result

        if not result:
            stats["no_artists"] += 1
            continue
        if not _is_high_confidence_backfill(
            title=title,
            category=category,
            artists=result,
            allow_single_entity=allow_single_entity,
        ):
            stats["low_confidence"] += 1
            continue

        stats["added"] += 1
        if len(samples) < show_samples:
            names = ", ".join(a.get("name") or "" for a in result)
            samples.append(f"  ADD {event_id} [{category}] {title[:60]} -> {names}")

        if not dry_run:
            upsert_event_artists(event_id, result, link_canonical=not skip_linking)

        if idx % 100 == 0:
            logger.info("Backfill: processed %d/%d events...", idx, len(missing))

    mode = "DRY RUN" if dry_run else "APPLIED"
    print(f"\n=== Backfill {mode} ===")
    print(f"  Checked: {stats['checked']}")
    print(f"  Added:   {stats['added']}")
    print(f"  No artists found: {stats['no_artists']}")
    if stats["low_confidence"]:
        print(f"  Skipped low-confidence: {stats['low_confidence']}")
    if stats["skipped_nightlife"]:
        print(f"  Skipped nightlife: {stats['skipped_nightlife']}")
    if samples:
        print("\nSample additions:")
        for s in samples:
            print(s)

    return {
        "backfill_checked": stats["checked"],
        "backfill_added": stats["added"],
    }


def run_artist_backfill(
    categories: list[str] | None = None,
    source_ids: list[int] | None = None,
    start_date: str | None = None,
    portal_id: Optional[str] = None,
    dry_run: bool = False,
    cleanup: bool = True,
    backfill: bool = True,
    skip_linking: bool = False,
    allow_single_entity: bool = False,
    max_events: int = 0,
) -> dict:
    """Run artist cleanup and/or backfill. Returns combined stats dict."""
    results: dict[str, int] = {}

    cleanup_cats = set(categories) & CLEANUP_CATEGORIES if categories else CLEANUP_CATEGORIES
    backfill_cats = set(categories) & BACKFILL_CATEGORIES if categories else BACKFILL_CATEGORIES

    if cleanup and cleanup_cats:
        results.update(run_cleanup_pass(
            categories=cleanup_cats,
            source_ids=source_ids,
            start_date=start_date,
            portal_id=portal_id,
            dry_run=dry_run,
            skip_linking=skip_linking,
            allow_single_entity=allow_single_entity,
            max_events=max_events,
        ))

    if backfill and backfill_cats:
        results.update(run_backfill_pass(
            categories=backfill_cats,
            source_ids=source_ids,
            start_date=start_date,
            portal_id=portal_id,
            dry_run=dry_run,
            skip_linking=skip_linking,
            allow_single_entity=allow_single_entity,
            max_events=max_events,
        ))

    return results


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Unified artist backfill and normalization for event_artists"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--cleanup-only", action="store_true", help="Only run cleanup pass")
    parser.add_argument("--backfill-only", action="store_true", help="Only run backfill pass")
    parser.add_argument("--skip-linking", action="store_true", help="Skip canonical artist linking")
    parser.add_argument(
        "--allow-single-entity",
        action="store_true",
        help="Allow single-title participant backfills (off by default to reduce noisy rows).",
    )
    parser.add_argument("--max-events", type=int, default=0, help="Cap events per pass (0=all)")
    parser.add_argument(
        "--start-date",
        default=date.today().isoformat(),
        help="Lower bound start_date (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--portal",
        default=None,
        help="Optional portal slug scope (includes portal rows + public rows).",
    )
    parser.add_argument(
        "--source-slugs",
        default=None,
        help="Optional comma-separated source slugs to scope pass.",
    )
    parser.add_argument(
        "--categories",
        nargs="*",
        default=None,
        help="Limit to specific categories (e.g. sports comedy music)",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    do_cleanup = not args.backfill_only
    do_backfill = not args.cleanup_only
    source_ids: list[int] | None = None
    portal_id: Optional[str] = None

    client = get_client()
    if args.source_slugs:
        source_ids = _resolve_source_ids(
            client, [s.strip() for s in str(args.source_slugs).split(",")]
        )
        if not source_ids:
            logger.warning("No valid source IDs resolved from --source-slugs; no rows will match.")
    if args.portal:
        try:
            portal_id = _resolve_portal_id(client, args.portal)
        except ValueError as exc:
            logger.error(str(exc))
            return 2

    stats = run_artist_backfill(
        categories=args.categories,
        source_ids=source_ids,
        start_date=args.start_date,
        portal_id=portal_id,
        dry_run=args.dry_run,
        cleanup=do_cleanup,
        backfill=do_backfill,
        skip_linking=args.skip_linking,
        allow_single_entity=args.allow_single_entity,
        max_events=args.max_events,
    )

    print(f"\nFinal stats: {stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
