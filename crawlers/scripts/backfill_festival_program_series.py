#!/usr/bin/env python3
"""
Backfill festival program series assignment for existing events.

Goal:
- Reassign events currently linked to coarse festival_program series
  into per-program series buckets (Keynotes, Experiences, inferred program titles).

Usage:
  python backfill_festival_program_series.py --dry-run
  python backfill_festival_program_series.py --execute
  python backfill_festival_program_series.py --execute --festival-slug love-yall-book-fest
"""

from __future__ import annotations

import argparse
import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from dotenv import load_dotenv

from db import get_client, infer_program_title
from enrich_festival_program import ensure_program_series
from utils import setup_logging

logger = logging.getLogger(__name__)


_GENERIC_FESTIVAL_PROGRAM_MARKERS = (
    "after hours",
    "lobby swap",
    "show floor",
    "general admission",
    "daily hours",
)


def _iter_rows(query, page_size: int = 1000) -> Iterable[dict]:
    start = 0
    while True:
        result = query.range(start, start + page_size - 1).execute()
        data = result.data or []
        if not data:
            break
        for row in data:
            yield row
        if len(data) < page_size:
            break
        start += page_size


def _normalize_title(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def _matches_festival_name(title: str, festival_name: str) -> bool:
    normalized_title = _normalize_title(title)
    normalized_festival = _normalize_title(festival_name)
    if not normalized_title or not normalized_festival:
        return False
    if normalized_title == normalized_festival:
        return True
    return re.sub(r"\s+\d{4}$", "", normalized_title) == re.sub(
        r"\s+\d{4}$", "", normalized_festival
    )


def _looks_like_generic_festival_bucket(title: str) -> bool:
    normalized_title = _normalize_title(title)
    return any(
        marker in normalized_title for marker in _GENERIC_FESTIVAL_PROGRAM_MARKERS
    )


def _program_for_event(event: dict, festival_name: str) -> str:
    tags = set(event.get("tags") or [])
    title = (event.get("title") or "").strip()
    title_lower = title.lower()

    if "experience" in tags or "special-event" in tags:
        return "Experiences"
    if "keynote" in tags or "keynote" in title_lower:
        return "Keynotes"

    inferred = infer_program_title(title)
    if inferred:
        return inferred
    if _matches_festival_name(
        title, festival_name
    ) or _looks_like_generic_festival_bucket(title):
        return festival_name
    return festival_name or "General Program"


def _load_target_festivals(client, festival_slug: Optional[str]) -> Dict[str, dict]:
    if festival_slug:
        q = (
            client.table("festivals")
            .select("id,name,slug,categories,image_url")
            .eq("slug", festival_slug)
            .limit(1)
        )
        data = q.execute().data or []
        return {row["id"]: row for row in data}

    q = client.table("festivals").select("id,name,slug,categories,image_url")
    data = q.execute().data or []
    return {row["id"]: row for row in data}


def _load_festival_program_series(
    client, festival_ids: List[str]
) -> Dict[str, List[dict]]:
    grouped: Dict[str, List[dict]] = defaultdict(list)
    if not festival_ids:
        return grouped

    # Query in chunks to avoid huge IN clauses.
    chunk_size = 200
    for i in range(0, len(festival_ids), chunk_size):
        chunk = festival_ids[i : i + chunk_size]
        q = (
            client.table("series")
            .select("id,title,festival_id")
            .eq("series_type", "festival_program")
            .in_("festival_id", chunk)
        )
        for row in _iter_rows(q):
            grouped[row["festival_id"]].append(row)
    return grouped


def backfill(execute: bool = False, festival_slug: Optional[str] = None) -> dict:
    client = get_client()

    festivals = _load_target_festivals(client, festival_slug)
    if not festivals:
        raise ValueError(f"No festivals found for slug={festival_slug!r}")

    series_by_festival = _load_festival_program_series(client, list(festivals.keys()))
    if not series_by_festival:
        logger.info("No festival_program series found for selected festivals.")
        return {
            "events_scanned": 0,
            "events_to_update": 0,
            "events_updated": 0,
            "series_created": 0,
            "festival_count": len(festivals),
        }

    stats = {
        "events_scanned": 0,
        "events_to_update": 0,
        "events_updated": 0,
        "series_created": 0,
        "series_would_create": 0,
        "festival_count": len(series_by_festival),
    }

    # Cache to avoid repeated create/lookups: (festival_id, program_title) -> series_id
    program_series_cache: Dict[Tuple[str, str], str] = {}
    existing_series_keys = set()
    for fest_id, rows in series_by_festival.items():
        for s in rows:
            existing_series_keys.add((fest_id, s["title"]))
            program_series_cache[(fest_id, s["title"])] = s["id"]

    updates: List[Tuple[int, str]] = []
    for festival_id, series_rows in series_by_festival.items():
        series_ids = [s["id"] for s in series_rows]
        if not series_ids:
            continue

        series_title_to_id = {s["title"]: s["id"] for s in series_rows}
        series_id_to_title = {s["id"]: s["title"] for s in series_rows}

        event_query = (
            client.table("events")
            .select("id,title,tags,series_id,start_date")
            .in_("series_id", series_ids)
            .gte("start_date", "2026-01-01")
        )
        for event in _iter_rows(event_query):
            stats["events_scanned"] += 1
            program_title = _program_for_event(event, festivals[festival_id]["name"])
            cache_key = (festival_id, program_title)
            current_series_title = series_id_to_title.get(event.get("series_id"))

            if cache_key not in program_series_cache:
                if execute:
                    before_keys = set(program_series_cache.keys())
                    target_series_id = ensure_program_series(
                        festivals[festival_id], program_title
                    )
                    program_series_cache[cache_key] = target_series_id
                    if (
                        cache_key not in before_keys
                        and cache_key not in existing_series_keys
                    ):
                        stats["series_created"] += 1
                else:
                    existing_id = series_title_to_id.get(program_title)
                    if existing_id:
                        program_series_cache[cache_key] = existing_id
                        target_series_id = existing_id
                    else:
                        target_series_id = ""
                        stats["series_would_create"] += 1
            else:
                target_series_id = program_series_cache[cache_key]

            if execute:
                if event.get("series_id") != target_series_id:
                    stats["events_to_update"] += 1
                    updates.append((event["id"], target_series_id))
            else:
                if target_series_id:
                    if event.get("series_id") != target_series_id:
                        stats["events_to_update"] += 1
                else:
                    if current_series_title != program_title:
                        stats["events_to_update"] += 1

    logger.info(
        "Backfill preview: scanned=%s to_update=%s new_series=%s would_create=%s festivals=%s",
        stats["events_scanned"],
        stats["events_to_update"],
        stats["series_created"],
        stats["series_would_create"],
        stats["festival_count"],
    )

    if not execute:
        return stats

    for event_id, target_series_id in updates:
        client.table("events").update({"series_id": target_series_id}).eq(
            "id", event_id
        ).execute()
        stats["events_updated"] += 1

    logger.info(
        "Backfill applied: updated=%s of %s candidates",
        stats["events_updated"],
        stats["events_to_update"],
    )
    return stats


def main() -> None:
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(env_path)

    parser = argparse.ArgumentParser(
        description="Backfill per-program festival series assignment"
    )
    parser.add_argument(
        "--execute", action="store_true", help="Apply updates (default is dry-run)"
    )
    parser.add_argument("--festival-slug", help="Restrict to one festival slug")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    setup_logging()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    stats = backfill(execute=args.execute, festival_slug=args.festival_slug)
    logger.info("Done: %s", stats)


if __name__ == "__main__":
    main()
