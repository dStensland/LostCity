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
        "id,title,start_date,venue_id,source_id,canonical_event_id",
        query_builder=lambda q: q.gte("start_date", as_of),
    )
    duplicate_rows_visible = [r for r in duplicate_rows_all if r.get("canonical_event_id") is None]
    dup_all = _group_duplicate_metrics(duplicate_rows_all)
    dup_visible = _group_duplicate_metrics(duplicate_rows_visible)

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

    # Specials.
    active_special_rows = paged_select(
        client,
        "venue_specials",
        "id,type",
        query_builder=lambda q: q.eq("is_active", True),
    )
    special_type_counts = Counter((row.get("type") or "unknown") for row in active_special_rows)

    # Venue mobility + history fields (single venue scan for consistency).
    venue_rows = paged_select(
        client,
        "venues",
        "id,slug,name,active,venue_type,vibes,description,parking_note,transit_note,transit_score,walkable_neighbor_count",
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
        },
        "historic": {
            "venues_with_historic_vibe": venues_with_historic_vibe,
            "venues_with_museum_or_historic_type": venues_with_museum_or_historic_type,
            "venues_with_historyish_description": venues_with_historyish_description,
            "explore_track_venues_total": explore_track_venues_total,
            "explore_track_venues_with_editorial_blurb": explore_track_venues_with_editorial_blurb,
            "explore_track_venues_with_historyish_blurb": explore_track_venues_with_historyish_blurb,
            "historic_facts_column_present": historic_facts_column_present,
        },
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
            "events_found_last_24h": events_found_24h,
            "events_new_last_24h": events_new_24h,
            "events_updated_last_24h": events_updated_24h,
            "top_error_sources_last_24h": top_error_sources,
        },
        "indie_showtimes": indie_showtimes,
    }


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
) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    date_slug = as_of.isoformat()
    json_path = output_dir / f"content_health_metrics_{date_slug}.json"
    md_path = output_dir / f"content_health_assessment_{date_slug}.md"
    json_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(metrics), encoding="utf-8")
    return json_path, md_path


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
    metrics = build_metrics(scope)
    output_dir = Path(args.output_dir)
    json_path, md_path = write_report_files(output_dir, as_of, metrics)

    print(f"Wrote JSON: {json_path}")
    print(f"Wrote Markdown: {md_path}")
    print(
        "Summary: "
        f"{metrics['counts']['future_events_visible']} visible future events, "
        f"{metrics['specials']['active_total']} active specials, "
        f"{metrics['mobility']['venues_with_walkable_neighbor_count']} venues with walkable neighbors."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
