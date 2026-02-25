#!/usr/bin/env python3
"""
Formal content health audit for LostCity.

Produces:
1) JSON metrics for machine diffing and dashboards.
2) Markdown assessment for human review.

Run:
  cd /Users/coach/Projects/LostCity/crawlers
  python3 scripts/content_health_audit.py
"""

from __future__ import annotations

import argparse
import glob
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client

try:
    from dedupe import normalize_text as _normalize_text
except Exception:
    _normalize_text = None

try:
    from closed_venues import CLOSED_VENUE_SLUGS
except Exception:
    CLOSED_VENUE_SLUGS = set()


INDIE_THEATER_SLUG_ALIASES: dict[str, list[str]] = {
    "plaza-theatre": ["plaza-theatre"],
    "tara-theatre": ["tara-theatre"],
    "landmark-midtown-art-cinema": ["landmark-midtown-art-cinema", "landmark-midtown"],
    "starlight-drive-in": ["starlight-drive-in", "starlight-drive-in-theatre"],
}

HISTORY_KEYWORDS = (
    "historic",
    "history",
    "heritage",
    "landmark",
    "civil rights",
    "founded",
    "since ",
)

HISTORIC_TYPES = {
    "historic_site",
    "historical_site",
    "historic_building",
    "landmark",
    "museum",
}

LAUNCH_GATE_THRESHOLDS = {
    "visible_cross_source_duplicate_groups": {"warn_gt": 0, "fail_gt": 5},
    "visible_same_source_duplicate_groups": {"warn_gt": 0, "fail_gt": 25},
    "registry_closed_venue_leakage": {"warn_gt": 0, "fail_gt": 0},
    "inactive_venue_leakage": {"warn_gt": 25, "fail_gt": 100},
    "crawl_error_rate_pct": {"warn_gt": 8.0, "fail_gt": 15.0},
    "genres_future_pct": {"warn_lt": 50.0, "fail_lt": 40.0},
    "specials_active_total": {"warn_lt": 300, "fail_lt": 200},
    "indie_showtime_pct_default": {"warn_lt": 90.0, "fail_lt": 80.0},
    "indie_showtime_pct_plaza": {"warn_lt": 85.0, "fail_lt": 70.0},
}


def normalize_text(value: str) -> str:
    if _normalize_text:
        return _normalize_text(value or "")
    text = (value or "").lower().strip()
    return re.sub(r"\s+", " ", text)


def pct(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def has_column(client, table: str, column: str) -> bool:
    try:
        client.table(table).select(column).limit(1).execute()
        return True
    except Exception as exc:
        text = str(exc).lower()
        if "does not exist" in text or "pgrst205" in text:
            return False
        raise


def count_exact(
    client,
    table: str,
    select_field: str = "id",
    query_builder: Callable[[Any], Any] | None = None,
) -> int:
    query = client.table(table).select(select_field, count="exact")
    if query_builder:
        query = query_builder(query)
    result = query.limit(1).execute()
    return int(result.count or 0)


def paged_select(
    client,
    table: str,
    fields: str,
    *,
    query_builder: Callable[[Any], Any] | None = None,
    page_size: int = 1000,
    order_column: str | None = "id",
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        query = client.table(table).select(fields).range(offset, offset + page_size - 1)
        if query_builder:
            query = query_builder(query)
        if order_column:
            query = query.order(order_column)
        result = query.execute()
        batch = result.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    return rows


def chunked(values: list[int], size: int = 400) -> list[list[int]]:
    return [values[idx : idx + size] for idx in range(0, len(values), size)]


def fetch_id_name_map(
    client,
    table: str,
    ids: set[int],
    *,
    key_field: str = "id",
    value_expr: Callable[[dict[str, Any]], str],
) -> dict[int, str]:
    if not ids:
        return {}
    out: dict[int, str] = {}
    for bucket in chunked(sorted(ids)):
        rows = (
            client.table(table)
            .select("id,name,slug")
            .in_(key_field, bucket)
            .execute()
            .data
            or []
        )
        for row in rows:
            rid = int(row.get(key_field) or 0)
            if rid:
                out[rid] = value_expr(row)
    return out


def status_rank(status: str) -> int:
    return {"PASS": 0, "WARN": 1, "FAIL": 2}.get(status.upper(), 2)


def collapse_status(statuses: list[str]) -> str:
    if not statuses:
        return "PASS"
    return max(statuses, key=status_rank)


def apply_threshold(
    value: float | int,
    *,
    warn_gt: float | int | None = None,
    fail_gt: float | int | None = None,
    warn_lt: float | int | None = None,
    fail_lt: float | int | None = None,
) -> str:
    if fail_gt is not None and value > fail_gt:
        return "FAIL"
    if warn_gt is not None and value > warn_gt:
        return "WARN"
    if fail_lt is not None and value < fail_lt:
        return "FAIL"
    if warn_lt is not None and value < warn_lt:
        return "WARN"
    return "PASS"


def deep_get(payload: dict[str, Any], path: str, default: Any = None) -> Any:
    current: Any = payload
    for part in path.split("."):
        if not isinstance(current, dict):
            return default
        current = current.get(part)
        if current is None:
            return default
    return current


@dataclass
class DateScope:
    as_of: date
    end_date: date
    tomorrow: date
    last_24h: datetime
    last_7d: datetime


def build_scope(as_of: date, window_days: int) -> DateScope:
    now = datetime.now(timezone.utc)
    return DateScope(
        as_of=as_of,
        end_date=as_of + timedelta(days=window_days),
        tomorrow=as_of + timedelta(days=1),
        last_24h=now - timedelta(hours=24),
        last_7d=now - timedelta(days=7),
    )


def _group_duplicate_metrics(rows: list[dict[str, Any]]) -> dict[str, int]:
    groups: dict[tuple[str, str, int], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = (
            normalize_text(row.get("title") or ""),
            str(row.get("start_date") or ""),
            int(row.get("venue_id") or 0),
        )
        groups[key].append(row)

    same_source_groups = 0
    same_source_rows = 0
    cross_source_groups = 0
    cross_source_rows = 0
    cross_source_dupe_rows = 0

    for group_rows in groups.values():
        if len(group_rows) < 2:
            continue

        source_ids = [int(r.get("source_id") or 0) for r in group_rows]
        unique_sources = set(source_ids)

        if len(unique_sources) < len(source_ids):
            same_source_groups += 1
            same_source_rows += len(source_ids) - len(unique_sources)

        if len(unique_sources) > 1:
            cross_source_groups += 1
            cross_source_rows += len(group_rows)
            cross_source_dupe_rows += len(group_rows) - 1

    return {
        "same_source_duplicate_groups": same_source_groups,
        "same_source_duplicate_rows": same_source_rows,
        "cross_source_groups": cross_source_groups,
        "cross_source_rows": cross_source_rows,
        "cross_source_duplicate_rows": cross_source_dupe_rows,
    }


def _extract_duplicate_clusters(
    rows: list[dict[str, Any]],
    *,
    source_name_map: dict[int, str],
    venue_name_map: dict[int, str],
    max_clusters: int = 15,
) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, int], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = (
            normalize_text(row.get("title") or ""),
            str(row.get("start_date") or ""),
            int(row.get("venue_id") or 0),
        )
        grouped[key].append(row)

    clusters: list[dict[str, Any]] = []
    for (normalized_title, start_date, venue_id), group_rows in grouped.items():
        if len(group_rows) < 2:
            continue
        source_ids = [int(r.get("source_id") or 0) for r in group_rows]
        source_slugs = sorted({source_name_map.get(sid, str(sid)) for sid in source_ids if sid})
        clusters.append(
            {
                "normalized_title": normalized_title,
                "start_date": start_date,
                "venue_id": venue_id,
                "venue_name": venue_name_map.get(venue_id, str(venue_id)),
                "event_ids": sorted([int(r.get("id") or 0) for r in group_rows if r.get("id") is not None]),
                "canonical_event_ids": sorted(
                    {
                        int(r.get("canonical_event_id"))
                        for r in group_rows
                        if r.get("canonical_event_id") is not None
                    }
                ),
                "source_slugs": source_slugs,
                "source_count": len(source_slugs),
                "row_count": len(group_rows),
            }
        )

    clusters.sort(
        key=lambda row: (
            -int(row["source_count"]),
            -int(row["row_count"]),
            row["start_date"],
            row["normalized_title"],
        )
    )
    return clusters[:max_clusters]


def build_metrics(scope: DateScope) -> dict[str, Any]:
    client = get_client()
    as_of = scope.as_of.isoformat()
    end_date = scope.end_date.isoformat()
    tomorrow = scope.tomorrow.isoformat()

    # Core counts.
    future_events_total = count_exact(
        client,
        "events",
        query_builder=lambda q: q.gte("start_date", as_of),
    )
    future_events_visible = count_exact(
        client,
        "events",
        query_builder=lambda q: q.gte("start_date", as_of).is_("canonical_event_id", "null"),
    )
    active_sources = count_exact(
        client,
        "sources",
        query_builder=lambda q: q.eq("is_active", True),
    )
    venues_total = count_exact(client, "venues")

    # Duplicate integrity (all future vs visible future).
    duplicate_rows_all = paged_select(
        client,
        "events",
        "id,title,start_date,venue_id,source_id,canonical_event_id,category,start_time,is_all_day,genres",
        query_builder=lambda q: q.gte("start_date", as_of),
    )
    duplicate_rows_visible = [r for r in duplicate_rows_all if r.get("canonical_event_id") is None]
    dup_all = _group_duplicate_metrics(duplicate_rows_all)
    dup_visible = _group_duplicate_metrics(duplicate_rows_visible)

    source_ids_for_duplicates = {
        int(row.get("source_id") or 0)
        for row in duplicate_rows_all
        if row.get("source_id") is not None
    }
    venue_ids_for_duplicates = {
        int(row.get("venue_id") or 0)
        for row in duplicate_rows_all
        if row.get("venue_id") is not None
    }
    source_name_map_full = fetch_id_name_map(
        client,
        "sources",
        source_ids_for_duplicates,
        value_expr=lambda row: row.get("slug") or row.get("name") or str(row.get("id")),
    )
    venue_name_map = fetch_id_name_map(
        client,
        "venues",
        venue_ids_for_duplicates,
        value_expr=lambda row: row.get("name") or row.get("slug") or str(row.get("id")),
    )

    visible_duplicate_clusters = _extract_duplicate_clusters(
        duplicate_rows_visible,
        source_name_map=source_name_map_full,
        venue_name_map=venue_name_map,
        max_clusters=20,
    )

    # Genres.
    future_events_with_genres = count_exact(
        client,
        "events",
        query_builder=lambda q: q.gte("start_date", as_of).not_.is_("genres", "null"),
    )
    music_film_events_total = count_exact(
        client,
        "events",
        query_builder=lambda q: q.gte("start_date", as_of).in_("category", ["music", "film"]),
    )
    music_film_with_genres = count_exact(
        client,
        "events",
        query_builder=lambda q: q.gte("start_date", as_of)
        .in_("category", ["music", "film"])
        .not_.is_("genres", "null"),
    )
    venues_with_genres = count_exact(
        client,
        "venues",
        query_builder=lambda q: q.not_.is_("genres", "null"),
    )

    # Time quality buckets (visible future events).
    time_quality_buckets = {"timed": 0, "all_day": 0, "date_only": 0}
    date_only_by_category: Counter[str] = Counter()
    genre_coverage_by_category_totals: Counter[str] = Counter()
    genre_coverage_by_category_with_genres: Counter[str] = Counter()
    for row in duplicate_rows_visible:
        category = (row.get("category") or "uncategorized").strip()
        genre_coverage_by_category_totals[category] += 1
        if isinstance(row.get("genres"), list) and len(row.get("genres") or []) > 0:
            genre_coverage_by_category_with_genres[category] += 1

        if (row.get("start_time") or "").strip():
            time_quality_buckets["timed"] += 1
        elif bool(row.get("is_all_day")):
            time_quality_buckets["all_day"] += 1
        else:
            time_quality_buckets["date_only"] += 1
            date_only_by_category[category] += 1

    top_date_only_categories = [
        {"category": category, "date_only_events": count}
        for category, count in date_only_by_category.most_common(10)
    ]

    genre_coverage_by_category = []
    for category, total in genre_coverage_by_category_totals.items():
        with_genres = int(genre_coverage_by_category_with_genres.get(category, 0))
        genre_coverage_by_category.append(
            {
                "category": category,
                "events_total": int(total),
                "with_genres": with_genres,
                "coverage_pct": pct(with_genres, int(total)),
            }
        )
    genre_coverage_by_category.sort(
        key=lambda row: (-int(row["events_total"]), row["category"])
    )

    # Specials.
    active_special_rows = paged_select(
        client,
        "venue_specials",
        "id,type,venue_id",
        query_builder=lambda q: q.eq("is_active", True),
    )
    special_type_counts = Counter((row.get("type") or "unknown") for row in active_special_rows)

    # Venue mobility + history fields (single venue scan for consistency).
    venue_rows = paged_select(
        client,
        "venues",
        "id,slug,name,active,neighborhood,venue_type,vibes,description,parking_note,transit_note,transit_score,walkable_neighbor_count",
    )
    venues_with_parking_note = sum(1 for row in venue_rows if (row.get("parking_note") or "").strip())
    venues_with_transit_note = sum(1 for row in venue_rows if (row.get("transit_note") or "").strip())
    venues_with_transit_score = sum(1 for row in venue_rows if row.get("transit_score") is not None)
    venues_with_walkable_neighbor_count = sum(
        1 for row in venue_rows if int(row.get("walkable_neighbor_count") or 0) > 0
    )

    walkable_neighbors_rows = count_exact(client, "walkable_neighbors", select_field="venue_id")
    walkability_score_column_present = has_column(client, "venues", "walkability_score")
    historic_facts_column_present = has_column(client, "venues", "historic_facts")

    venues_with_historic_vibe = sum(
        1 for row in venue_rows if isinstance(row.get("vibes"), list) and "historic" in row.get("vibes", [])
    )
    venues_with_museum_or_historic_type = sum(
        1 for row in venue_rows if (row.get("venue_type") or "") in HISTORIC_TYPES
    )
    venues_with_historyish_description = sum(
        1
        for row in venue_rows
        if any(keyword in (row.get("description") or "").lower() for keyword in HISTORY_KEYWORDS)
    )

    # Initiative coverage by neighborhood.
    walkability_by_neighborhood: Counter[str] = Counter()
    historic_by_neighborhood: Counter[str] = Counter()
    for row in venue_rows:
        neighborhood = (row.get("neighborhood") or "Unknown").strip() or "Unknown"
        if int(row.get("walkable_neighbor_count") or 0) > 0:
            walkability_by_neighborhood[neighborhood] += 1
        is_historic = (
            ((row.get("venue_type") or "") in HISTORIC_TYPES)
            or (isinstance(row.get("vibes"), list) and "historic" in (row.get("vibes") or []))
            or any(keyword in (row.get("description") or "").lower() for keyword in HISTORY_KEYWORDS)
        )
        if is_historic:
            historic_by_neighborhood[neighborhood] += 1

    neighborhood_by_venue_id: dict[int, str] = {}
    for row in venue_rows:
        vid = row.get("id")
        if vid is None:
            continue
        neighborhood_by_venue_id[int(vid)] = (row.get("neighborhood") or "Unknown").strip() or "Unknown"

    specials_by_neighborhood: Counter[str] = Counter()
    for row in active_special_rows:
        vid = row.get("venue_id")
        if vid is None:
            continue
        neighborhood = neighborhood_by_venue_id.get(int(vid), "Unknown")
        specials_by_neighborhood[neighborhood] += 1

    # Explore track editorial coverage.
    explore_track_venues_total = 0
    explore_track_venues_with_editorial_blurb = 0
    explore_track_venues_with_historyish_blurb = 0
    if has_column(client, "explore_track_venues", "editorial_blurb"):
        track_rows = paged_select(client, "explore_track_venues", "id,editorial_blurb")
        explore_track_venues_total = len(track_rows)
        for row in track_rows:
            blurb = (row.get("editorial_blurb") or "").strip()
            if not blurb:
                continue
            explore_track_venues_with_editorial_blurb += 1
            lowered = blurb.lower()
            if any(keyword in lowered for keyword in HISTORY_KEYWORDS):
                explore_track_venues_with_historyish_blurb += 1

    # Crawl freshness + error concentration.
    logs_24h = paged_select(
        client,
        "crawl_logs",
        "source_id,status,events_found,events_new,events_updated,started_at",
        query_builder=lambda q: q.gte("started_at", scope.last_24h.isoformat()),
    )
    logs_7d_count = count_exact(
        client,
        "crawl_logs",
        query_builder=lambda q: q.gte("started_at", scope.last_7d.isoformat()),
    )
    status_counts = Counter((row.get("status") or "unknown") for row in logs_24h)
    events_found_24h = sum(int(row.get("events_found") or 0) for row in logs_24h)
    events_new_24h = sum(int(row.get("events_new") or 0) for row in logs_24h)
    events_updated_24h = sum(int(row.get("events_updated") or 0) for row in logs_24h)
    unique_sources_24h = len({row.get("source_id") for row in logs_24h if row.get("source_id") is not None})
    error_count_24h = int(status_counts.get("error", 0))
    completed_count_24h = int(status_counts.get("success", 0)) + int(status_counts.get("error", 0))
    error_rate_pct_24h = round((error_count_24h / completed_count_24h) * 100, 1) if completed_count_24h else 0.0

    error_source_counts = Counter(
        int(row.get("source_id"))
        for row in logs_24h
        if (row.get("status") or "").lower() == "error" and row.get("source_id") is not None
    )
    top_error_source_ids = [sid for sid, _ in error_source_counts.most_common(5)]
    source_name_map: dict[int, str] = {}
    if top_error_source_ids:
        source_rows = (
            client.table("sources")
            .select("id,slug,name")
            .in_("id", top_error_source_ids)
            .execute()
            .data
            or []
        )
        source_name_map = {int(r["id"]): (r.get("slug") or r.get("name") or str(r["id"])) for r in source_rows}
    top_error_sources = [
        {"source_id": sid, "source": source_name_map.get(sid, str(sid)), "errors": count}
        for sid, count in error_source_counts.most_common(5)
    ]

    # Closed venue leakage.
    closed_venue_rows: list[dict[str, Any]] = []
    if CLOSED_VENUE_SLUGS:
        closed_venue_rows = (
            client.table("venues")
            .select("id,slug,name,active")
            .in_("slug", sorted(CLOSED_VENUE_SLUGS))
            .execute()
            .data
            or []
        )
    closed_venue_ids = [int(row["id"]) for row in closed_venue_rows if row.get("id") is not None]
    future_visible_events_on_registry_closed_venues = 0
    if closed_venue_ids:
        future_visible_events_on_registry_closed_venues = count_exact(
            client,
            "events",
            query_builder=lambda q: q.gte("start_date", as_of)
            .is_("canonical_event_id", "null")
            .in_("venue_id", closed_venue_ids),
        )

    inactive_venue_ids = {int(row["id"]) for row in venue_rows if row.get("active") is False and row.get("id") is not None}
    future_visible_events_rows = paged_select(
        client,
        "events",
        "id,venue_id",
        query_builder=lambda q: q.gte("start_date", as_of).is_("canonical_event_id", "null"),
    )
    future_visible_events_on_inactive_venues = sum(
        1 for row in future_visible_events_rows if int(row.get("venue_id") or 0) in inactive_venue_ids
    )

    # Indie theater showtime coverage.
    indie_aliases = sorted({alias for aliases in INDIE_THEATER_SLUG_ALIASES.values() for alias in aliases})
    indie_venues = (
        client.table("venues")
        .select("id,slug,name")
        .in_("slug", indie_aliases)
        .execute()
        .data
        or []
    )
    venue_by_slug = {row.get("slug"): row for row in indie_venues}
    indie_showtimes: dict[str, dict[str, Any]] = {}
    for canonical_slug, aliases in INDIE_THEATER_SLUG_ALIASES.items():
        venue = next((venue_by_slug.get(alias) for alias in aliases if venue_by_slug.get(alias)), None)
        if not venue:
            indie_showtimes[canonical_slug] = {
                "venue_name": canonical_slug,
                "events_next_window": 0,
                "with_start_time": 0,
                "without_start_time": 0,
                "time_coverage_pct": 0.0,
                "tomorrow_events": 0,
                "missing_venue": True,
            }
            continue

        venue_events = paged_select(
            client,
            "events",
            "start_date,start_time",
            query_builder=lambda q, vid=int(venue["id"]): q.eq("venue_id", vid)
            .gte("start_date", as_of)
            .lte("start_date", end_date)
            .is_("canonical_event_id", "null"),
            order_column="start_date",
        )
        total = len(venue_events)
        with_time = sum(1 for row in venue_events if (row.get("start_time") or "").strip())
        without_time = total - with_time
        tomorrow_events = sum(1 for row in venue_events if row.get("start_date") == tomorrow)

        indie_showtimes[canonical_slug] = {
            "venue_name": venue.get("name") or canonical_slug,
            "events_next_window": total,
            "with_start_time": with_time,
            "without_start_time": without_time,
            "time_coverage_pct": pct(with_time, total),
            "tomorrow_events": tomorrow_events,
        }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": {
            "future_start_date": as_of,
            "next_window_end_date": end_date,
            "window_days": (scope.end_date - scope.as_of).days,
        },
        "counts": {
            "future_events_total": future_events_total,
            "future_events_visible": future_events_visible,
            "active_sources": active_sources,
            "venues_total": venues_total,
        },
        "duplicates": {
            "all_future": dup_all,
            "visible_future": dup_visible,
            "visible_clusters_top": visible_duplicate_clusters,
        },
        "genres": {
            "future_events_with_genres": future_events_with_genres,
            "future_events_genres_pct": pct(future_events_with_genres, future_events_total),
            "music_film_events_total": music_film_events_total,
            "music_film_with_genres": music_film_with_genres,
            "music_film_genres_pct": pct(music_film_with_genres, music_film_events_total),
            "venues_with_genres": venues_with_genres,
            "venues_with_genres_pct": pct(venues_with_genres, venues_total),
        },
        "specials": {
            "active_total": len(active_special_rows),
            "active_by_type": dict(sorted(special_type_counts.items(), key=lambda item: (-item[1], item[0]))),
            "happy_hour_active": int(special_type_counts.get("happy_hour", 0)),
        },
        "mobility": {
            "venues_with_parking_note": venues_with_parking_note,
            "venues_with_parking_note_pct": pct(venues_with_parking_note, venues_total),
            "venues_with_transit_note": venues_with_transit_note,
            "venues_with_transit_note_pct": pct(venues_with_transit_note, venues_total),
            "venues_with_transit_score": venues_with_transit_score,
            "venues_with_transit_score_pct": pct(venues_with_transit_score, venues_total),
            "venues_with_walkable_neighbor_count": venues_with_walkable_neighbor_count,
            "venues_with_walkable_neighbor_count_pct": pct(venues_with_walkable_neighbor_count, venues_total),
            "walkable_neighbors_rows": walkable_neighbors_rows,
            "walkability_score_column_present": walkability_score_column_present,
            "coverage_by_neighborhood_top": [
                {"neighborhood": neighborhood, "venues_with_walkable_neighbors": count}
                for neighborhood, count in walkability_by_neighborhood.most_common(12)
            ],
        },
        "historic": {
            "venues_with_historic_vibe": venues_with_historic_vibe,
            "venues_with_museum_or_historic_type": venues_with_museum_or_historic_type,
            "venues_with_historyish_description": venues_with_historyish_description,
            "explore_track_venues_total": explore_track_venues_total,
            "explore_track_venues_with_editorial_blurb": explore_track_venues_with_editorial_blurb,
            "explore_track_venues_with_historyish_blurb": explore_track_venues_with_historyish_blurb,
            "historic_facts_column_present": historic_facts_column_present,
            "coverage_by_neighborhood_top": [
                {"neighborhood": neighborhood, "venues_with_history_signal": count}
                for neighborhood, count in historic_by_neighborhood.most_common(12)
            ],
        },
        "time_quality": {
            "buckets_visible_future": time_quality_buckets,
            "top_date_only_categories": top_date_only_categories,
        },
        "genre_coverage_by_category_top": genre_coverage_by_category[:15],
        "specials_by_neighborhood_top": [
            {"neighborhood": neighborhood, "active_specials": count}
            for neighborhood, count in specials_by_neighborhood.most_common(12)
        ],
        "closed_venues": {
            "registry_venues_matched": len(closed_venue_rows),
            "future_visible_events_on_registry_closed_venues": future_visible_events_on_registry_closed_venues,
            "future_visible_events_on_inactive_venues": future_visible_events_on_inactive_venues,
        },
        "crawl_freshness": {
            "logs_last_24h": len(logs_24h),
            "logs_last_7d": logs_7d_count,
            "unique_sources_last_24h": unique_sources_24h,
            "status_last_24h": dict(status_counts),
            "error_rate_pct": error_rate_pct_24h,
            "events_found_last_24h": events_found_24h,
            "events_new_last_24h": events_new_24h,
            "events_updated_last_24h": events_updated_24h,
            "top_error_sources_last_24h": top_error_sources,
        },
        "indie_showtimes": indie_showtimes,
    }


def evaluate_launch_gate(metrics: dict[str, Any]) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []

    def add_check(check_id: str, label: str, value: float | int, threshold_key: str, context: str = "") -> None:
        threshold = LAUNCH_GATE_THRESHOLDS[threshold_key]
        status = apply_threshold(value, **threshold)
        checks.append(
            {
                "id": check_id,
                "label": label,
                "value": value,
                "status": status,
                "threshold": threshold,
                "context": context,
            }
        )

    add_check(
        "duplicates.cross_source_visible",
        "Visible cross-source duplicate groups",
        int(deep_get(metrics, "duplicates.visible_future.cross_source_groups", 0)),
        "visible_cross_source_duplicate_groups",
    )
    add_check(
        "duplicates.same_source_visible",
        "Visible same-source duplicate groups",
        int(deep_get(metrics, "duplicates.visible_future.same_source_duplicate_groups", 0)),
        "visible_same_source_duplicate_groups",
    )
    add_check(
        "closed.registry_leakage",
        "Visible events on registry-closed venues",
        int(deep_get(metrics, "closed_venues.future_visible_events_on_registry_closed_venues", 0)),
        "registry_closed_venue_leakage",
    )
    add_check(
        "closed.inactive_leakage",
        "Visible events on inactive venues",
        int(deep_get(metrics, "closed_venues.future_visible_events_on_inactive_venues", 0)),
        "inactive_venue_leakage",
    )
    add_check(
        "crawl.error_rate_24h",
        "24h crawl error rate %",
        float(deep_get(metrics, "crawl_freshness.error_rate_pct", 0.0)),
        "crawl_error_rate_pct",
    )
    add_check(
        "genres.future_coverage",
        "Future events with genres %",
        float(deep_get(metrics, "genres.future_events_genres_pct", 0.0)),
        "genres_future_pct",
    )
    add_check(
        "specials.active_total",
        "Active specials total",
        int(deep_get(metrics, "specials.active_total", 0)),
        "specials_active_total",
    )

    for slug, item in (metrics.get("indie_showtimes") or {}).items():
        venue_name = item.get("venue_name") or slug
        coverage = float(item.get("time_coverage_pct") or 0.0)
        threshold_key = (
            "indie_showtime_pct_plaza"
            if slug == "plaza-theatre"
            else "indie_showtime_pct_default"
        )
        add_check(
            f"showtimes.{slug}",
            f"{venue_name} time coverage %",
            coverage,
            threshold_key,
            context=f"{item.get('with_start_time', 0)}/{item.get('events_next_window', 0)} with time",
        )

    counts = Counter(check["status"] for check in checks)
    overall_status = collapse_status([check["status"] for check in checks])

    return {
        "overall_status": overall_status,
        "counts": {"PASS": counts.get("PASS", 0), "WARN": counts.get("WARN", 0), "FAIL": counts.get("FAIL", 0)},
        "checks": checks,
    }


def load_previous_metrics(output_dir: Path, as_of: date) -> tuple[dict[str, Any] | None, str | None]:
    pattern = str(output_dir / "content_health_metrics_*.json")
    candidates = []
    for path in glob.glob(pattern):
        match = re.search(r"content_health_metrics_(\d{4}-\d{2}-\d{2})\.json$", path)
        if not match:
            continue
        try:
            run_date = date.fromisoformat(match.group(1))
        except ValueError:
            continue
        if run_date >= as_of:
            continue
        candidates.append((run_date, Path(path)))

    if not candidates:
        return None, None

    candidates.sort(key=lambda row: row[0], reverse=True)
    previous_date, previous_path = candidates[0]
    payload = json.loads(previous_path.read_text(encoding="utf-8"))
    return payload, previous_date.isoformat()


def build_regression(current: dict[str, Any], previous: dict[str, Any] | None, previous_date: str | None) -> dict[str, Any]:
    metric_paths = [
        ("counts.future_events_visible", "Visible future events"),
        ("duplicates.visible_future.cross_source_groups", "Visible cross-source duplicate groups"),
        ("duplicates.visible_future.same_source_duplicate_groups", "Visible same-source duplicate groups"),
        ("closed_venues.future_visible_events_on_registry_closed_venues", "Closed venue leakage (registry)"),
        ("closed_venues.future_visible_events_on_inactive_venues", "Closed venue leakage (inactive)"),
        ("crawl_freshness.error_rate_pct", "24h crawl error rate %"),
        ("specials.active_total", "Active specials"),
        ("genres.future_events_genres_pct", "Future genre coverage %"),
        ("mobility.venues_with_walkable_neighbor_count", "Venues with walkable neighbors"),
    ]
    indie_paths = []
    for slug, item in (current.get("indie_showtimes") or {}).items():
        indie_paths.append((f"indie_showtimes.{slug}.time_coverage_pct", f"{item.get('venue_name', slug)} time coverage %"))
    metric_paths.extend(indie_paths)

    comparisons: list[dict[str, Any]] = []
    if previous is None:
        return {
            "previous_date": None,
            "available": False,
            "metrics": comparisons,
        }

    for path, label in metric_paths:
        current_value = deep_get(current, path)
        previous_value = deep_get(previous, path)
        if current_value is None or previous_value is None:
            continue
        if not isinstance(current_value, (int, float)) or not isinstance(previous_value, (int, float)):
            continue
        delta = round(float(current_value) - float(previous_value), 2)
        comparisons.append(
            {
                "path": path,
                "label": label,
                "current": current_value,
                "previous": previous_value,
                "delta": delta,
            }
        )

    comparisons.sort(key=lambda row: abs(float(row["delta"])), reverse=True)
    return {
        "previous_date": previous_date,
        "available": True,
        "metrics": comparisons,
    }


def _markdown_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    lines = []
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        lines.append("| " + " | ".join(row) + " |")
    return lines


def render_findings_markdown(metrics: dict[str, Any], gate: dict[str, Any], regression: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"# Content Health Findings - {metrics['scope']['future_start_date']}")
    lines.append("")
    lines.append(f"Overall launch gate: **{gate['overall_status']}**")
    lines.append(
        f"Checks: PASS {gate['counts']['PASS']} | WARN {gate['counts']['WARN']} | FAIL {gate['counts']['FAIL']}"
    )
    lines.append("")

    lines.append("## Launch Gate")
    gate_rows = []
    for check in gate["checks"]:
        threshold_bits = []
        for key, value in check["threshold"].items():
            threshold_bits.append(f"{key}={value}")
        gate_rows.append(
            [
                check["status"],
                check["label"],
                str(check["value"]),
                ", ".join(threshold_bits),
                check.get("context", "") or "-",
            ]
        )
    lines.extend(_markdown_table(["Status", "Check", "Value", "Threshold", "Context"], gate_rows))
    lines.append("")

    lines.append("## Regression")
    if not regression.get("available"):
        lines.append("- No prior metrics file found for date-over-date comparison.")
    else:
        lines.append(f"- Baseline date: **{regression['previous_date']}**")
        delta_rows = []
        for row in regression["metrics"][:15]:
            delta_rows.append(
                [
                    row["label"],
                    str(row["previous"]),
                    str(row["current"]),
                    f"{row['delta']:+}",
                ]
            )
        lines.extend(_markdown_table(["Metric", "Previous", "Current", "Delta"], delta_rows))
    lines.append("")

    lines.append("## Critical Findings")
    failed = [c for c in gate["checks"] if c["status"] == "FAIL"]
    warned = [c for c in gate["checks"] if c["status"] == "WARN"]
    if not failed and not warned:
        lines.append("- No launch-blocking or warning checks in this run.")
    else:
        for check in failed:
            lines.append(f"- FAIL: {check['label']} (value={check['value']})")
        for check in warned:
            lines.append(f"- WARN: {check['label']} (value={check['value']})")
    lines.append("")

    lines.append("## Duplicate Drilldown (Visible)")
    clusters = deep_get(metrics, "duplicates.visible_clusters_top", [])
    if not clusters:
        lines.append("- No visible duplicate clusters detected.")
    else:
        cluster_rows = []
        for cluster in clusters[:12]:
            cluster_rows.append(
                [
                    cluster["start_date"],
                    cluster["venue_name"],
                    str(cluster["row_count"]),
                    str(cluster["source_count"]),
                    ", ".join(cluster["source_slugs"][:3]),
                    cluster["normalized_title"][:48],
                ]
            )
        lines.extend(_markdown_table(["Date", "Venue", "Rows", "Sources", "Source Slugs", "Normalized Title"], cluster_rows))
    lines.append("")

    lines.append("## Crawl Error Sources (24h)")
    error_rows = deep_get(metrics, "crawl_freshness.top_error_sources_last_24h", [])
    if not error_rows:
        lines.append("- No sources with crawl errors in the last 24h.")
    else:
        table_rows = [[r["source"], str(r["errors"]), str(r["source_id"])] for r in error_rows]
        lines.extend(_markdown_table(["Source", "Errors", "Source ID"], table_rows))
    lines.append("")

    lines.append("## Time Quality")
    buckets = deep_get(metrics, "time_quality.buckets_visible_future", {})
    lines.append(
        f"- Visible future events: timed={buckets.get('timed', 0)}, all_day={buckets.get('all_day', 0)}, date_only={buckets.get('date_only', 0)}"
    )
    date_only_rows = deep_get(metrics, "time_quality.top_date_only_categories", [])
    if date_only_rows:
        lines.extend(
            _markdown_table(
                ["Category", "Date-only Events"],
                [[row["category"], str(row["date_only_events"])] for row in date_only_rows[:10]],
            )
        )
    lines.append("")

    lines.append("## Initiative Coverage by Neighborhood")
    specials_rows = metrics.get("specials_by_neighborhood_top") or []
    walk_rows = deep_get(metrics, "mobility.coverage_by_neighborhood_top", [])
    hist_rows = deep_get(metrics, "historic.coverage_by_neighborhood_top", [])
    if specials_rows:
        lines.append("### Specials")
        lines.extend(
            _markdown_table(
                ["Neighborhood", "Active Specials"],
                [[row["neighborhood"], str(row["active_specials"])] for row in specials_rows[:10]],
            )
        )
        lines.append("")
    if walk_rows:
        lines.append("### Walkability")
        lines.extend(
            _markdown_table(
                ["Neighborhood", "Venues w/ Walkable Neighbors"],
                [[row["neighborhood"], str(row["venues_with_walkable_neighbors"])] for row in walk_rows[:10]],
            )
        )
        lines.append("")
    if hist_rows:
        lines.append("### Historic")
        lines.extend(
            _markdown_table(
                ["Neighborhood", "Venues w/ History Signal"],
                [[row["neighborhood"], str(row["venues_with_history_signal"])] for row in hist_rows[:10]],
            )
        )
        lines.append("")

    return "\n".join(lines) + "\n"


def render_markdown(metrics: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"# Content Health Assessment - {metrics['scope']['future_start_date']}")
    lines.append("")
    lines.append("## Scope")
    lines.append(f"- Generated at: {metrics['generated_at']}")
    lines.append(f"- Future window: {metrics['scope']['future_start_date']} to {metrics['scope']['next_window_end_date']}")
    lines.append(f"- Window days: {metrics['scope']['window_days']}")
    lines.append("")

    counts = metrics["counts"]
    lines.append("## Core Counts")
    lines.append(f"- Future events (total): **{counts['future_events_total']:,}**")
    lines.append(f"- Future events (visible canonical): **{counts['future_events_visible']:,}**")
    lines.append(f"- Active sources: **{counts['active_sources']:,}**")
    lines.append(f"- Venues: **{counts['venues_total']:,}**")
    lines.append("")

    duplicates = metrics["duplicates"]
    lines.append("## Duplicate Integrity")
    lines.append("- All future events:")
    lines.append(
        f"  - Same-source groups: **{duplicates['all_future']['same_source_duplicate_groups']}** "
        f"(rows: {duplicates['all_future']['same_source_duplicate_rows']})"
    )
    lines.append(
        f"  - Cross-source groups: **{duplicates['all_future']['cross_source_groups']}** "
        f"(rows: {duplicates['all_future']['cross_source_rows']})"
    )
    lines.append("- Visible future events:")
    lines.append(
        f"  - Same-source groups: **{duplicates['visible_future']['same_source_duplicate_groups']}** "
        f"(rows: {duplicates['visible_future']['same_source_duplicate_rows']})"
    )
    lines.append(
        f"  - Cross-source groups: **{duplicates['visible_future']['cross_source_groups']}** "
        f"(rows: {duplicates['visible_future']['cross_source_rows']})"
    )
    lines.append("")

    specials = metrics["specials"]
    lines.append("## Initiative Coverage")
    lines.append("### Specials / Happy Hour")
    lines.append(f"- Active `venue_specials`: **{specials['active_total']:,}**")
    lines.append(f"- Active `happy_hour`: **{specials['happy_hour_active']:,}**")
    if specials["active_by_type"]:
        for special_type, count in specials["active_by_type"].items():
            lines.append(f"- `{special_type}`: {count}")
    lines.append("")

    genres = metrics["genres"]
    lines.append("### Genres")
    lines.append(
        f"- Future events with genres: **{genres['future_events_with_genres']:,} / {counts['future_events_total']:,}** "
        f"(**{genres['future_events_genres_pct']}%**)"
    )
    lines.append(
        f"- Music+film with genres: **{genres['music_film_with_genres']:,} / {genres['music_film_events_total']:,}** "
        f"(**{genres['music_film_genres_pct']}%**)"
    )
    lines.append(
        f"- Venues with genres: **{genres['venues_with_genres']:,} / {counts['venues_total']:,}** "
        f"(**{genres['venues_with_genres_pct']}%**)"
    )
    lines.append("")

    mobility = metrics["mobility"]
    lines.append("### Walkability / Mobility")
    lines.append(
        f"- Parking notes: **{mobility['venues_with_parking_note']:,} / {counts['venues_total']:,}** "
        f"(**{mobility['venues_with_parking_note_pct']}%**)"
    )
    lines.append(
        f"- Transit notes: **{mobility['venues_with_transit_note']:,} / {counts['venues_total']:,}** "
        f"(**{mobility['venues_with_transit_note_pct']}%**)"
    )
    lines.append(
        f"- Transit scores present: **{mobility['venues_with_transit_score']:,} / {counts['venues_total']:,}** "
        f"(**{mobility['venues_with_transit_score_pct']}%**)"
    )
    lines.append(
        f"- Walkable-neighbor count > 0: **{mobility['venues_with_walkable_neighbor_count']:,} / {counts['venues_total']:,}** "
        f"(**{mobility['venues_with_walkable_neighbor_count_pct']}%**)"
    )
    lines.append(f"- `walkable_neighbors` rows: **{mobility['walkable_neighbors_rows']:,}**")
    lines.append(
        f"- Dedicated `walkability_score` column present: **{str(mobility['walkability_score_column_present']).lower()}**"
    )
    lines.append("")

    historic = metrics["historic"]
    lines.append("### Historic Coverage")
    lines.append(f"- Venues with `historic` vibe: **{historic['venues_with_historic_vibe']:,}**")
    lines.append(f"- Venues with museum/historic types: **{historic['venues_with_museum_or_historic_type']:,}**")
    lines.append(f"- Venues with history-like descriptions: **{historic['venues_with_historyish_description']:,}**")
    lines.append(
        f"- Explore track venue blurbs: **{historic['explore_track_venues_with_editorial_blurb']:,} / {historic['explore_track_venues_total']:,}** "
        f"(history-like: {historic['explore_track_venues_with_historyish_blurb']:,})"
    )
    lines.append(
        f"- Dedicated `historic_facts` column present: **{str(historic['historic_facts_column_present']).lower()}**"
    )
    lines.append("")

    lines.append("## Indie Showtime Coverage")
    for slug, item in metrics["indie_showtimes"].items():
        if item.get("missing_venue"):
            lines.append(f"- `{slug}`: venue record not found")
            continue
        lines.append(
            f"- {item['venue_name']}: **{item['with_start_time']}/{item['events_next_window']}** "
            f"with times ({item['time_coverage_pct']}%), tomorrow events: {item['tomorrow_events']}"
        )
    lines.append("")

    closed = metrics["closed_venues"]
    lines.append("## Closed Venue Leakage")
    lines.append(f"- Closed registry venues matched: **{closed['registry_venues_matched']}**")
    lines.append(
        f"- Future visible events on registry-closed venues: **{closed['future_visible_events_on_registry_closed_venues']}**"
    )
    lines.append(
        f"- Future visible events on inactive venues: **{closed['future_visible_events_on_inactive_venues']}**"
    )
    lines.append("")

    crawl = metrics["crawl_freshness"]
    lines.append("## Crawl Freshness (Last 24h)")
    lines.append(f"- Runs: **{crawl['logs_last_24h']:,}** across **{crawl['unique_sources_last_24h']:,}** sources")
    lines.append(f"- Status counts: `{crawl['status_last_24h']}`")
    lines.append(
        f"- Throughput: found **{crawl['events_found_last_24h']:,}**, new **{crawl['events_new_last_24h']:,}**, "
        f"updated **{crawl['events_updated_last_24h']:,}**"
    )
    if crawl["top_error_sources_last_24h"]:
        lines.append("- Top erroring sources:")
        for row in crawl["top_error_sources_last_24h"]:
            lines.append(f"  - `{row['source']}` ({row['errors']})")

    lines.append("")
    lines.append("## Notes")
    lines.append("- Walkability/history are tracked as distributed metrics today; this audit intentionally reports both")
    lines.append("  distributed coverage and dedicated-column presence checks to avoid false negatives.")
    lines.append("")
    return "\n".join(lines)


def write_report_files(
    output_dir: Path,
    as_of: date,
    metrics: dict[str, Any],
    gate: dict[str, Any],
    regression: dict[str, Any],
) -> tuple[Path, Path, Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    date_slug = as_of.isoformat()
    json_path = output_dir / f"content_health_metrics_{date_slug}.json"
    md_path = output_dir / f"content_health_assessment_{date_slug}.md"
    gate_path = output_dir / f"content_health_gate_{date_slug}.json"
    findings_path = output_dir / f"content_health_findings_{date_slug}.md"
    json_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(metrics), encoding="utf-8")
    gate_payload = {
        "generated_at": metrics["generated_at"],
        "as_of": metrics["scope"]["future_start_date"],
        "overall_status": gate["overall_status"],
        "counts": gate["counts"],
        "checks": gate["checks"],
        "regression": regression,
    }
    gate_path.write_text(json.dumps(gate_payload, indent=2) + "\n", encoding="utf-8")
    findings_path.write_text(render_findings_markdown(metrics, gate, regression), encoding="utf-8")
    return json_path, md_path, gate_path, findings_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate formal content health audit artifacts.")
    parser.add_argument(
        "--as-of",
        type=str,
        default=date.today().isoformat(),
        help="Audit date (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=30,
        help="Forward-looking window for showtime checks. Default: 30.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(ROOT / "reports"),
        help="Directory for generated JSON/Markdown artifacts.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        as_of = date.fromisoformat(args.as_of)
    except ValueError:
        print(f"Invalid --as-of date: {args.as_of}", file=sys.stderr)
        return 2

    if args.window_days <= 0:
        print("--window-days must be > 0", file=sys.stderr)
        return 2

    scope = build_scope(as_of, args.window_days)
    output_dir = Path(args.output_dir)
    previous_metrics, previous_date = load_previous_metrics(output_dir, as_of)
    metrics = build_metrics(scope)
    gate = evaluate_launch_gate(metrics)
    regression = build_regression(metrics, previous_metrics, previous_date)
    json_path, md_path, gate_path, findings_path = write_report_files(
        output_dir, as_of, metrics, gate, regression
    )

    print(f"Wrote JSON: {json_path}")
    print(f"Wrote Markdown: {md_path}")
    print(f"Wrote Gate JSON: {gate_path}")
    print(f"Wrote Findings Markdown: {findings_path}")
    print(
        "Summary: "
        f"{metrics['counts']['future_events_visible']} visible future events, "
        f"{metrics['specials']['active_total']} active specials, "
        f"{metrics['mobility']['venues_with_walkable_neighbor_count']} venues with walkable neighbors, "
        f"launch gate={gate['overall_status']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
