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
from typing import Any, Callable, Optional

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

FIXED_HOURS_VENUE_TYPES = {
    "aquarium",
    "bar",
    "botanical_garden",
    "brewery",
    "cafe",
    "cinema",
    "food_hall",
    "gallery",
    "garden",
    "market",
    "museum",
    "restaurant",
    "zoo",
}

EVENT_LED_DESTINATION_TYPES = {
    "amphitheater",
    "amphitheatre",
    "arts_center",
    "comedy_club",
    "event_space",
    "music_venue",
    "performing_arts",
    "theater",
    "theatre",
}

TIME_SENSITIVE_DUPLICATE_CATEGORIES = {
    "family",
    "fitness",
    "learning",
    "wellness",
}

LAUNCH_GATE_THRESHOLDS = {
    "visible_cross_source_duplicate_groups": {"warn_gt": 0, "fail_gt": 5},
    "visible_same_source_duplicate_groups": {"warn_gt": 0, "fail_gt": 25},
    "registry_closed_venue_leakage": {"warn_gt": 0, "fail_gt": 0},
    "inactive_venue_leakage": {"warn_gt": 25, "fail_gt": 100},
    "crawl_error_rate_pct": {"warn_gt": 8.0, "fail_gt": 15.0},
    "genres_future_pct": {"warn_lt": 50.0, "fail_lt": 40.0},
    "specials_active_total": {"warn_lt": 300, "fail_lt": 200},
    "music_participant_coverage_pct": {"warn_lt": 90.0, "fail_lt": 80.0},
    "indie_showtime_pct_default": {"warn_lt": 90.0, "fail_lt": 80.0},
    "indie_showtime_pct_plaza": {"warn_lt": 85.0, "fail_lt": 70.0},
    # Enrichment quality gates
    "venue_image_fill_rate_pct": {"warn_lt": 50.0, "fail_lt": 30.0},
    "venue_hours_fill_rate_pct": {"warn_lt": 40.0, "fail_lt": 25.0},
    "event_description_fill_rate_pct": {"warn_lt": 70.0, "fail_lt": 50.0},
}

GATE_PROFILES: dict[str, dict[str, Any]] = {
    # Backward-compatible: all checks are hard, using default thresholds.
    "legacy": {
        "soft_check_ids": set(),
        "threshold_overrides": {},
    },
    # City consumer launch: specials depth is advisory (metadata-first strategy).
    "atlanta-consumer": {
        "soft_check_ids": {"specials.active_total"},
        "threshold_overrides": {},
    },
    # Concierge/hotel launches still require strong specials density.
    "concierge-hotel": {
        "soft_check_ids": set(),
        "threshold_overrides": {},
    },
}

SHORT_DESCRIPTION_MAX_LEN = 220
PRIORITY_SOURCE_SHORT_DESC_THRESHOLDS: dict[str, dict[str, float | int]] = {
    "atlanta-recurring-social": {"warn_gt": 30.0, "fail_gt": 45.0, "min_events": 50},
    "team-trivia": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 30},
    "meetup": {"warn_gt": 45.0, "fail_gt": 65.0, "min_events": 20},
    "ticketmaster": {"warn_gt": 15.0, "fail_gt": 25.0, "min_events": 100},
    "eventbrite": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 100},
    "amc-atlanta": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 100},
    "fulton-library": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 100},
    "truist-park": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 50},
    "laughing-skull": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 50},
    "lore-atlanta": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 50},
    "cooks-warehouse": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 50},
    "big-peach-running": {"warn_gt": 20.0, "fail_gt": 35.0, "min_events": 50},
}

ATLANTA_METRO_CITIES = {
    "alpharetta",
    "atlanta",
    "avondale estates",
    "brookhaven",
    "chamblee",
    "college park",
    "decatur",
    "doraville",
    "duluth",
    "dunwoody",
    "east point",
    "johns creek",
    "kennesaw",
    "lawrenceville",
    "marietta",
    "peachtree city",
    "roswell",
    "sandy springs",
    "smyrna",
    "stone mountain",
    "tucker",
    "woodstock",
}

SPORTS_PARTICIPANT_MATCHUP_RE = re.compile(
    r"\b(vs\.?|versus|v\.?|@)\b",
    flags=re.IGNORECASE,
)
SPORTS_NON_PARTICIPANT_RE = re.compile(
    r"(parking|pass|package|registration|register|session|deposit|voucher|hospitality|add-?on|"
    r"tour|training|workout|select-?a-?seat|preseason party|camp|showcase|premium seating)",
    flags=re.IGNORECASE,
)
COMEDY_NON_PARTICIPANT_RE = re.compile(
    r"(open mic|showcase|best of|improv jam|comedy night|workshop|class|"
    r"^saturday night live comedy show$|\bimprov\w*\b|happy hour)",
    flags=re.IGNORECASE,
)
MUSIC_NON_PARTICIPANT_RE = re.compile(
    r"(open mic|live music saturday|karaoke|registration|class|workshop|"
    r"jam session|jazz night|jazz jam|musical improv|burlesque|"
    r"^live music$|\bsymphony\s+no\.?\s*\d+\b|^play:?\s+a\s+celebration\s+of\s+.*\bmusic\b|"
    r"\bsaturday night live\b|\bparty\b|\bafterparty\b|\bbrunch\b|\btrivia\b|\bworship\b|\beucharist\b|\bpostponed\b|\bjam\b)",
    flags=re.IGNORECASE,
)


def normalize_text(value: str) -> str:
    if _normalize_text:
        return _normalize_text(value or "")
    text = (value or "").lower().strip()
    return re.sub(r"\s+", " ", text)


def participant_expected_for_event(title: str, category: str) -> bool:
    title_norm = normalize_text(title or "")
    category_norm = normalize_text(category or "")
    if not title_norm or category_norm not in {"music", "comedy", "sports"}:
        return False

    if category_norm == "sports":
        if SPORTS_NON_PARTICIPANT_RE.search(title_norm):
            return False
        return bool(SPORTS_PARTICIPANT_MATCHUP_RE.search(title_norm))

    if category_norm == "comedy":
        return not bool(COMEDY_NON_PARTICIPANT_RE.search(title_norm))

    if category_norm == "music":
        return not bool(MUSIC_NON_PARTICIPANT_RE.search(title_norm))

    return False


def pct(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def normalized_venue_type(row: dict[str, Any]) -> str:
    return str(row.get("venue_type") or "").strip().lower()


def has_usable_hours(value: Any) -> bool:
    if not value:
        return False
    if isinstance(value, dict):
        for day in value.values():
            if not isinstance(day, dict):
                continue
            if day.get("open") or day.get("close"):
                return True
        return False
    return True


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


def count_rows_for_venue_ids(
    client,
    table: str,
    venue_ids: set[int],
    *,
    venue_column: str = "venue_id",
) -> int:
    if not venue_ids:
        return 0
    total = 0
    for bucket in chunked(sorted(venue_ids)):
        total += count_exact(
            client,
            table,
            select_field=venue_column,
            query_builder=lambda q, ids=bucket: q.in_(venue_column, ids),
        )
    return total


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


def resolve_gate_profile(
    profile_arg: str,
    *,
    portal: str | None,
    city: str | None,
) -> str:
    if profile_arg != "auto":
        if profile_arg not in GATE_PROFILES:
            raise ValueError(
                f"Unsupported gate profile '{profile_arg}'. Valid profiles: "
                f"{', '.join(sorted(GATE_PROFILES.keys()))}, auto"
            )
        return profile_arg

    normalized_portal = (portal or "").strip().lower()
    normalized_city = normalize_city(city)
    if normalized_portal == "atlanta" and normalized_city == "atlanta":
        return "atlanta-consumer"
    return "legacy"


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


def normalize_city(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.strip().lower())


def city_in_scope(
    venue_city: str | None,
    scope_city: str | None,
    *,
    include_metro: bool = True,
) -> bool:
    if not scope_city:
        return True
    normalized_scope = normalize_city(scope_city)
    normalized_venue = normalize_city(venue_city)
    if not normalized_scope or not normalized_venue:
        return False

    if normalized_scope == "atlanta":
        if "atlanta" in normalized_venue:
            return True
        if include_metro and normalized_venue in ATLANTA_METRO_CITIES:
            return True
        return False

    if normalized_venue == normalized_scope:
        return True
    matcher = re.compile(rf"\b{re.escape(normalized_scope)}\b")
    return bool(matcher.search(normalized_venue))


@dataclass
class DateScope:
    as_of: date
    end_date: date
    tomorrow: date
    last_24h: datetime
    last_7d: datetime
    city: str | None
    include_metro: bool
    portal: str | None


def build_scope(
    as_of: date,
    window_days: int,
    *,
    city: str | None = None,
    include_metro: bool = True,
    portal: str | None = None,
) -> DateScope:
    now = datetime.now(timezone.utc)
    return DateScope(
        as_of=as_of,
        end_date=as_of + timedelta(days=window_days),
        tomorrow=as_of + timedelta(days=1),
        last_24h=now - timedelta(hours=24),
        last_7d=now - timedelta(days=7),
        city=city.strip() if city else None,
        include_metro=include_metro,
        portal=portal.strip() if portal else None,
    )


def _group_duplicate_metrics(rows: list[dict[str, Any]]) -> dict[str, int]:
    groups: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = duplicate_group_key(row)
        groups[key].append(row)

    def source_time_key(row: dict[str, Any]) -> tuple[int, str]:
        return (
            int(row.get("source_id") or 0),
            str(row.get("start_time") or "").strip() or "__none__",
        )

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

        per_source_time_counts: Counter[tuple[int, str]] = Counter(
            source_time_key(row) for row in group_rows
        )
        same_source_duplicate_rows = sum(
            count - 1 for count in per_source_time_counts.values() if count > 1
        )
        if same_source_duplicate_rows > 0:
            same_source_groups += 1
            same_source_rows += same_source_duplicate_rows

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
    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = duplicate_group_key(row)
        grouped[key].append(row)

    clusters: list[dict[str, Any]] = []
    for group_key, group_rows in grouped.items():
        if len(group_rows) < 2:
            continue
        normalized_title = str(group_key[0])
        start_date = str(group_key[1])
        venue_id = int(group_key[2])
        source_ids = [int(r.get("source_id") or 0) for r in group_rows]
        source_slugs = sorted({source_name_map.get(sid, str(sid)) for sid in source_ids if sid})
        unique_sources = set(source_ids)
        if len(unique_sources) <= 1:
            per_source_time_counts: Counter[tuple[int, str]] = Counter(
                (
                    int(row.get("source_id") or 0),
                    str(row.get("start_time") or "").strip() or "__none__",
                )
                for row in group_rows
            )
            if not any(count > 1 for count in per_source_time_counts.values()):
                continue
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


def duplicate_group_key(row: dict[str, Any]) -> tuple[Any, ...]:
    title = normalize_text(row.get("title") or "")
    start_date = str(row.get("start_date") or "")
    venue_id = int(row.get("venue_id") or 0)
    category = normalize_text(row.get("category_id") or row.get("category") or "")
    if category in TIME_SENSITIVE_DUPLICATE_CATEGORIES:
        start_time = str(row.get("start_time") or "").strip() or "__none__"
        return (title, start_date, venue_id, start_time)
    return (title, start_date, venue_id)


def build_metrics(scope: DateScope) -> dict[str, Any]:
    client = get_client()
    as_of = scope.as_of.isoformat()
    end_date = scope.end_date.isoformat()
    tomorrow = scope.tomorrow.isoformat()
    city_scope = scope.city
    city_scope_active = bool(city_scope)
    include_metro = bool(scope.include_metro)
    portal_scope = (scope.portal or "").strip()
    portal_scope_active = bool(portal_scope)
    events_active_column = "is_active" if has_column(client, "events", "is_active") else None
    events_has_portal_id = has_column(client, "events", "portal_id")
    portal_scope_id: Optional[str] = None
    if portal_scope_active:
        portal_rows = (
            client.table("portals")
            .select("id,slug")
            .eq("slug", portal_scope)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not portal_rows:
            raise ValueError(f"Unknown portal slug: {portal_scope}")
        portal_scope_id = str(portal_rows[0]["id"])

    def row_in_portal_scope(row: dict[str, Any]) -> bool:
        if not portal_scope_active:
            return True
        if not events_has_portal_id:
            return True
        row_portal_id = row.get("portal_id")
        if row_portal_id is None:
            return True
        return str(row_portal_id) == str(portal_scope_id)

    def apply_active_filter(query):
        if not events_active_column:
            return query
        return query.eq(events_active_column, True)

    # Schema compatibility: prefer category_id (current), fallback to category (legacy).
    events_has_category_id = has_column(client, "events", "category_id")
    events_has_category = has_column(client, "events", "category")
    category_name_by_id: dict[str, str] = {}
    music_film_category_ids: list[str] = []

    if events_has_category_id:
        category_rows = client.table("categories").select("id,name").execute().data or []
        for row in category_rows:
            category_id = str(row.get("id") or "").strip()
            category_name = str(row.get("name") or category_id).strip()
            if not category_id:
                continue
            category_name_by_id[category_id] = category_name or category_id
            if category_id in {"music", "film"}:
                music_film_category_ids.append(category_id)

    def category_label(row: dict[str, Any]) -> str:
        if events_has_category_id:
            category_id = str(row.get("category_id") or "").strip()
            if category_id:
                return category_name_by_id.get(category_id, category_id)
        if events_has_category:
            legacy = str(row.get("category") or "").strip()
            if legacy:
                return legacy
        return "uncategorized"

    # Venue mobility + history fields (single venue scan for consistency).
    venue_rows_all = paged_select(
        client,
        "venues",
        "id,slug,name,active,city,neighborhood,venue_type,vibes,description,genres,parking_note,transit_note,transit_score,walkable_neighbor_count,image_url,hours,website,planning_notes",
    )
    if city_scope_active:
        venue_rows = [
            row
            for row in venue_rows_all
            if city_in_scope(
                row.get("city"),
                city_scope,
                include_metro=include_metro,
            )
        ]
    else:
        venue_rows = venue_rows_all

    scoped_venue_ids = {int(row["id"]) for row in venue_rows if row.get("id") is not None}
    venues_total = len(venue_rows)

    # Duplicate integrity (all future vs visible future).
    duplicate_fields = (
        "id,title,start_date,venue_id,source_id,portal_id,canonical_event_id,start_time,is_all_day,genres,description"
    )
    if events_has_category_id:
        duplicate_fields += ",category_id"
    elif events_has_category:
        duplicate_fields += ",category"

    duplicate_rows_all = paged_select(
        client,
        "events",
        duplicate_fields,
        query_builder=lambda q: apply_active_filter(q).gte("start_date", as_of),
    )
    if city_scope_active:
        duplicate_rows_all = [
            row
            for row in duplicate_rows_all
            if int(row.get("venue_id") or 0) in scoped_venue_ids
        ]
    if portal_scope_active:
        duplicate_rows_all = [row for row in duplicate_rows_all if row_in_portal_scope(row)]
    duplicate_rows_visible = [r for r in duplicate_rows_all if r.get("canonical_event_id") is None]
    future_events_total = len(duplicate_rows_all)
    future_events_visible = len(duplicate_rows_visible)
    if city_scope_active:
        active_sources = len(
            {
                int(row.get("source_id") or 0)
                for row in duplicate_rows_all
                if row.get("source_id") is not None
            }
            - {0}
        )
    else:
        active_sources = count_exact(
            client,
            "sources",
            query_builder=lambda q: q.eq("is_active", True),
        )
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

    source_visible_totals: Counter[str] = Counter()
    source_visible_short_descriptions: Counter[str] = Counter()
    for row in duplicate_rows_visible:
        source_id = int(row.get("source_id") or 0)
        if source_id <= 0:
            continue
        source_slug = str(source_name_map_full.get(source_id) or source_id)
        source_visible_totals[source_slug] += 1
        if len(str(row.get("description") or "").strip()) < SHORT_DESCRIPTION_MAX_LEN:
            source_visible_short_descriptions[source_slug] += 1

    source_description_quality_rows = []
    for slug, total in source_visible_totals.items():
        short_count = int(source_visible_short_descriptions.get(slug, 0))
        source_description_quality_rows.append(
            {
                "source": slug,
                "events": int(total),
                "short_descriptions": short_count,
                "short_pct": pct(short_count, int(total)),
            }
        )
    source_description_quality_rows.sort(
        key=lambda row: (-int(row["short_descriptions"]), -int(row["events"]), row["source"])
    )

    priority_source_quality: dict[str, dict[str, Any]] = {}
    for slug, threshold in PRIORITY_SOURCE_SHORT_DESC_THRESHOLDS.items():
        total = int(source_visible_totals.get(slug, 0))
        short_count = int(source_visible_short_descriptions.get(slug, 0))
        priority_source_quality[slug] = {
            "events": total,
            "short_descriptions": short_count,
            "short_pct": pct(short_count, total),
            "min_events": int(threshold.get("min_events", 0)),
        }

    # Participant coverage for event types where performer/team modules matter.
    participant_categories = {"music", "comedy", "sports"}
    participant_event_ids_by_category: dict[str, set[int]] = {
        category: set() for category in participant_categories
    }
    participant_expected_event_ids_by_category: dict[str, set[int]] = {
        category: set() for category in participant_categories
    }
    participant_events_by_source: dict[str, set[int]] = {}
    participant_expected_events_by_source: dict[str, set[int]] = {}

    for row in duplicate_rows_visible:
        category_value = str(
            row.get("category_id") or row.get("category") or ""
        ).strip().lower()
        if category_value not in participant_categories:
            continue
        event_id = row.get("id")
        if event_id is None:
            continue
        event_int = int(event_id)
        participant_event_ids_by_category[category_value].add(event_int)

        source_id = row.get("source_id")
        if source_id is not None:
            source_slug = str(source_name_map_full.get(int(source_id)) or source_id)
            participant_events_by_source.setdefault(source_slug, set()).add(event_int)
        else:
            source_slug = ""

        if participant_expected_for_event(str(row.get("title") or ""), category_value):
            participant_expected_event_ids_by_category[category_value].add(event_int)
            if source_slug:
                participant_expected_events_by_source.setdefault(source_slug, set()).add(
                    event_int
                )

    participant_event_ids = sorted(
        {
            event_id
            for ids in participant_event_ids_by_category.values()
            for event_id in ids
        }
    )
    participant_events_with_rows: set[int] = set()
    for bucket in chunked(participant_event_ids, size=500):
        rows = (
            client.table("event_artists")
            .select("event_id")
            .in_("event_id", bucket)
            .execute()
            .data
            or []
        )
        for row in rows:
            event_id = row.get("event_id")
            if event_id is not None:
                participant_events_with_rows.add(int(event_id))

    participant_coverage_by_category: dict[str, dict[str, Any]] = {}
    for category in sorted(participant_categories):
        event_ids = participant_event_ids_by_category.get(category, set())
        with_participants = sum(
            1 for event_id in event_ids if event_id in participant_events_with_rows
        )
        total = len(event_ids)
        participant_coverage_by_category[category] = {
            "events": total,
            "with_participants": with_participants,
            "without_participants": max(total - with_participants, 0),
            "coverage_pct": pct(with_participants, total),
        }

    participant_expected_coverage_by_category: dict[str, dict[str, Any]] = {}
    for category in sorted(participant_categories):
        event_ids = participant_expected_event_ids_by_category.get(category, set())
        with_participants = sum(
            1 for event_id in event_ids if event_id in participant_events_with_rows
        )
        total = len(event_ids)
        participant_expected_coverage_by_category[category] = {
            "events_expected": total,
            "with_participants": with_participants,
            "without_participants": max(total - with_participants, 0),
            "coverage_pct": pct(with_participants, total),
        }

    participant_coverage_by_source_rows: list[dict[str, Any]] = []
    for source_slug, source_event_ids in participant_events_by_source.items():
        total = len(source_event_ids)
        with_participants = sum(
            1 for event_id in source_event_ids if event_id in participant_events_with_rows
        )
        without_participants = max(total - with_participants, 0)
        participant_coverage_by_source_rows.append(
            {
                "source": source_slug,
                "events": total,
                "with_participants": with_participants,
                "without_participants": without_participants,
                "coverage_pct": pct(with_participants, total),
                "missing_pct": pct(without_participants, total),
            }
        )
    participant_coverage_by_source_rows.sort(
        key=lambda row: (
            -int(row["without_participants"]),
            -int(row["events"]),
            row["source"],
        )
    )

    participant_expected_coverage_by_source_rows: list[dict[str, Any]] = []
    for source_slug, source_event_ids in participant_expected_events_by_source.items():
        total = len(source_event_ids)
        with_participants = sum(
            1 for event_id in source_event_ids if event_id in participant_events_with_rows
        )
        without_participants = max(total - with_participants, 0)
        participant_expected_coverage_by_source_rows.append(
            {
                "source": source_slug,
                "events_expected": total,
                "with_participants": with_participants,
                "without_participants": without_participants,
                "coverage_pct": pct(with_participants, total),
                "missing_pct": pct(without_participants, total),
            }
        )
    participant_expected_coverage_by_source_rows.sort(
        key=lambda row: (
            -int(row["without_participants"]),
            -int(row["events_expected"]),
            row["source"],
        )
    )

    visible_duplicate_clusters = _extract_duplicate_clusters(
        duplicate_rows_visible,
        source_name_map=source_name_map_full,
        venue_name_map=venue_name_map,
        max_clusters=20,
    )

    # Genres.
    future_events_with_genres = sum(1 for row in duplicate_rows_all if row.get("genres") is not None)
    if events_has_category_id and music_film_category_ids:
        music_film_set = set(music_film_category_ids)
        music_film_rows = [
            row
            for row in duplicate_rows_all
            if str(row.get("category_id") or "").strip() in music_film_set
        ]
        music_film_events_total = len(music_film_rows)
        music_film_with_genres = sum(1 for row in music_film_rows if row.get("genres") is not None)
    elif events_has_category:
        music_film_rows = [
            row
            for row in duplicate_rows_all
            if str(row.get("category") or "").strip().lower() in {"music", "film"}
        ]
        music_film_events_total = len(music_film_rows)
        music_film_with_genres = sum(1 for row in music_film_rows if row.get("genres") is not None)
    else:
        music_film_events_total = 0
        music_film_with_genres = 0
    venues_with_genres = sum(1 for row in venue_rows if row.get("genres") is not None)

    # Time quality buckets (visible future events).
    time_quality_buckets = {"timed": 0, "all_day": 0, "date_only": 0}
    date_only_by_category: Counter[str] = Counter()
    genre_coverage_by_category_totals: Counter[str] = Counter()
    genre_coverage_by_category_with_genres: Counter[str] = Counter()
    for row in duplicate_rows_visible:
        category = category_label(row)
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
    if city_scope_active:
        active_special_rows = [
            row
            for row in active_special_rows
            if int(row.get("venue_id") or 0) in scoped_venue_ids
        ]
    special_type_counts = Counter((row.get("type") or "unknown") for row in active_special_rows)

    venues_with_parking_note = sum(1 for row in venue_rows if (row.get("parking_note") or "").strip())
    venues_with_transit_note = sum(1 for row in venue_rows if (row.get("transit_note") or "").strip())
    venues_with_transit_score = sum(1 for row in venue_rows if row.get("transit_score") is not None)
    venues_with_walkable_neighbor_count = sum(
        1 for row in venue_rows if int(row.get("walkable_neighbor_count") or 0) > 0
    )

    if city_scope_active:
        walkable_neighbors_rows = count_rows_for_venue_ids(client, "walkable_neighbors", scoped_venue_ids)
    else:
        walkable_neighbors_rows = count_exact(client, "walkable_neighbors", select_field="venue_id")
    walkability_score_column_present = has_column(client, "venues", "walkability_score")

    # Enrichment fill rates (venue-level).
    venues_with_image = sum(1 for row in venue_rows if (row.get("image_url") or "").strip())
    venues_with_hours = sum(1 for row in venue_rows if has_usable_hours(row.get("hours")))
    venues_with_website = sum(1 for row in venue_rows if (row.get("website") or "").strip())
    venues_with_description = sum(1 for row in venue_rows if (row.get("description") or "").strip())
    fixed_hours_rows = [
        row for row in venue_rows if normalized_venue_type(row) in FIXED_HOURS_VENUE_TYPES
    ]
    fixed_hours_with_hours = sum(1 for row in fixed_hours_rows if has_usable_hours(row.get("hours")))
    event_led_rows = [
        row for row in venue_rows if normalized_venue_type(row) in EVENT_LED_DESTINATION_TYPES
    ]
    event_led_with_planning = sum(
        1 for row in event_led_rows if (row.get("planning_notes") or "").strip()
    )

    # Enrichment fill rates (event-level): descriptions >= SHORT_DESCRIPTION_MAX_LEN.
    event_long_descriptions = sum(
        1
        for row in duplicate_rows_visible
        if len((row.get("description") or "").strip()) >= SHORT_DESCRIPTION_MAX_LEN
    )

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
    logs_7d_rows = paged_select(
        client,
        "crawl_logs",
        "source_id,started_at",
        query_builder=lambda q: q.gte("started_at", scope.last_7d.isoformat()),
    )
    if city_scope_active or portal_scope_active:
        source_id_set = {sid for sid in source_ids_for_duplicates if sid > 0}
        logs_24h = [
            row
            for row in logs_24h
            if int(row.get("source_id") or 0) in source_id_set
        ]
        logs_7d_rows = [
            row
            for row in logs_7d_rows
            if int(row.get("source_id") or 0) in source_id_set
        ]
    logs_7d_count = len(logs_7d_rows)
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
    closed_venue_rows = [
        row for row in venue_rows if str(row.get("slug") or "") in CLOSED_VENUE_SLUGS
    ]
    closed_venue_ids = [int(row["id"]) for row in closed_venue_rows if row.get("id") is not None]
    closed_venue_id_set = set(closed_venue_ids)
    future_visible_events_on_registry_closed_venues = sum(
        1
        for row in duplicate_rows_visible
        if int(row.get("venue_id") or 0) in closed_venue_id_set
    )

    inactive_venue_ids = {int(row["id"]) for row in venue_rows if row.get("active") is False and row.get("id") is not None}
    future_visible_events_on_inactive_venues = sum(
        1 for row in duplicate_rows_visible if int(row.get("venue_id") or 0) in inactive_venue_ids
    )

    # Indie theater showtime coverage.
    indie_aliases = sorted({alias for aliases in INDIE_THEATER_SLUG_ALIASES.values() for alias in aliases})
    indie_venues = [
        {"id": row.get("id"), "slug": row.get("slug"), "name": row.get("name"), "city": row.get("city")}
        for row in venue_rows_all
        if str(row.get("slug") or "") in indie_aliases
        and (
            not city_scope_active
            or city_in_scope(
                row.get("city"),
                city_scope,
                include_metro=include_metro,
            )
        )
    ]
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
            query_builder=lambda q, vid=int(venue["id"]): apply_active_filter(
                q.eq("venue_id", vid)
            )
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

    scope_slug = "global"
    if city_scope and portal_scope:
        scope_slug = (
            f"portal-{normalize_city(portal_scope).replace(' ', '-')}"
            f"_city-{normalize_city(city_scope).replace(' ', '-')}"
        )
    elif portal_scope:
        scope_slug = f"portal-{normalize_city(portal_scope).replace(' ', '-')}"
    elif city_scope:
        scope_slug = f"city-{normalize_city(city_scope).replace(' ', '-')}"

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": {
            "future_start_date": as_of,
            "next_window_end_date": end_date,
            "window_days": (scope.end_date - scope.as_of).days,
            "events_active_column": events_active_column or "none",
            "city_filter": city_scope,
            "portal_filter": portal_scope or None,
            "portal_id": portal_scope_id,
            "include_metro": include_metro if normalize_city(city_scope) == "atlanta" else False,
            "scope_slug": scope_slug,
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
        "enrichment": {
            "venue_image_fill_rate_pct": pct(venues_with_image, venues_total),
            "venue_hours_fill_rate_pct": pct(venues_with_hours, venues_total),
            "fixed_hours_venue_fill_rate_pct": pct(fixed_hours_with_hours, len(fixed_hours_rows)),
            "venue_website_fill_rate_pct": pct(venues_with_website, venues_total),
            "venue_description_fill_rate_pct": pct(venues_with_description, venues_total),
            "event_led_destination_planning_fill_rate_pct": pct(
                event_led_with_planning, len(event_led_rows)
            ),
            "event_description_fill_rate_pct": pct(event_long_descriptions, future_events_visible),
            "venues_with_image": venues_with_image,
            "venues_with_hours": venues_with_hours,
            "fixed_hours_venues_total": len(fixed_hours_rows),
            "fixed_hours_venues_with_hours": fixed_hours_with_hours,
            "venues_with_website": venues_with_website,
            "venues_with_description": venues_with_description,
            "event_led_destinations_total": len(event_led_rows),
            "event_led_destinations_with_planning": event_led_with_planning,
            "event_long_descriptions": event_long_descriptions,
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
        "source_description_quality": {
            "short_description_max_len": SHORT_DESCRIPTION_MAX_LEN,
            "by_source_top": source_description_quality_rows[:25],
            "priority_sources": priority_source_quality,
        },
        "participants": {
            "by_category": participant_coverage_by_category,
            "by_category_expected": participant_expected_coverage_by_category,
            "by_source_top": participant_coverage_by_source_rows[:25],
            "by_source_expected_top": participant_expected_coverage_by_source_rows[:25],
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


def evaluate_launch_gate(metrics: dict[str, Any], *, gate_profile: str) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    profile_config = GATE_PROFILES.get(gate_profile, GATE_PROFILES["legacy"])
    soft_check_ids = set(profile_config.get("soft_check_ids") or set())
    thresholds = dict(LAUNCH_GATE_THRESHOLDS)
    threshold_overrides = profile_config.get("threshold_overrides") or {}
    for key, override in threshold_overrides.items():
        merged = dict(thresholds.get(key) or {})
        merged.update(override)
        thresholds[key] = merged
    events_active_column = str(
        deep_get(metrics, "scope.events_active_column", "none") or "none"
    )
    has_row_level_event_active = events_active_column != "none"

    def add_check_with_threshold(
        check_id: str,
        label: str,
        value: float | int,
        threshold: dict[str, Any],
        context: str = "",
    ) -> None:
        severity = "soft" if check_id in soft_check_ids else "hard"
        status = apply_threshold(value, **threshold)
        if severity == "soft" and status == "FAIL":
            status = "WARN"
        checks.append(
            {
                "id": check_id,
                "label": label,
                "value": value,
                "status": status,
                "severity": severity,
                "threshold": threshold,
                "context": context,
            }
        )

    def add_check(check_id: str, label: str, value: float | int, threshold_key: str, context: str = "") -> None:
        add_check_with_threshold(
            check_id=check_id,
            label=label,
            value=value,
            threshold=thresholds[threshold_key],
            context=context,
        )

    def add_info_check(check_id: str, label: str, value: float | int, context: str = "") -> None:
        checks.append(
            {
                "id": check_id,
                "label": label,
                "value": value,
                "status": "PASS",
                "severity": "info",
                "threshold": {},
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
    registry_leakage = int(
        deep_get(metrics, "closed_venues.future_visible_events_on_registry_closed_venues", 0)
    )
    inactive_leakage = int(
        deep_get(metrics, "closed_venues.future_visible_events_on_inactive_venues", 0)
    )
    if has_row_level_event_active:
        add_check(
            "closed.registry_leakage",
            "Visible events on registry-closed venues",
            registry_leakage,
            "registry_closed_venue_leakage",
        )
        add_check(
            "closed.inactive_leakage",
            "Visible events on inactive venues",
            inactive_leakage,
            "inactive_venue_leakage",
        )
    else:
        add_info_check(
            "closed.registry_leakage",
            "Registry-closed venue backlog rows (feed-suppressed)",
            registry_leakage,
            context=(
                "events.is_active missing in current schema; launch feed visibility is "
                "guarded by venue.active suppression."
            ),
        )
        add_info_check(
            "closed.inactive_leakage",
            "Inactive-venue backlog rows (feed-suppressed)",
            inactive_leakage,
            context=(
                "events.is_active missing in current schema; row-level event deactivation "
                "is unavailable."
            ),
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

    # Enrichment quality gates
    venue_image_pct = float(deep_get(metrics, "enrichment.venue_image_fill_rate_pct", 0.0))
    venue_hours_pct = float(deep_get(metrics, "enrichment.venue_hours_fill_rate_pct", 0.0))
    fixed_hours_pct = float(deep_get(metrics, "enrichment.fixed_hours_venue_fill_rate_pct", 0.0))
    event_led_planning_pct = float(
        deep_get(metrics, "enrichment.event_led_destination_planning_fill_rate_pct", 0.0)
    )
    event_desc_pct = float(deep_get(metrics, "enrichment.event_description_fill_rate_pct", 0.0))
    venues_with_image = int(deep_get(metrics, "enrichment.venues_with_image", 0))
    venues_with_hours = int(deep_get(metrics, "enrichment.venues_with_hours", 0))
    fixed_hours_total = int(deep_get(metrics, "enrichment.fixed_hours_venues_total", 0))
    fixed_hours_with_hours = int(deep_get(metrics, "enrichment.fixed_hours_venues_with_hours", 0))
    event_led_total = int(deep_get(metrics, "enrichment.event_led_destinations_total", 0))
    event_led_with_planning = int(
        deep_get(metrics, "enrichment.event_led_destinations_with_planning", 0)
    )
    event_long_descs = int(deep_get(metrics, "enrichment.event_long_descriptions", 0))
    venues_total_for_context = int(deep_get(metrics, "counts.venues_total", 0))
    events_visible_for_context = int(deep_get(metrics, "counts.future_events_visible", 0))

    add_check(
        "enrichment.venue_image_fill_rate",
        "Venue image fill rate %",
        venue_image_pct,
        "venue_image_fill_rate_pct",
        context=f"{venues_with_image}/{venues_total_for_context} venues with image_url",
    )
    add_check(
        "enrichment.venue_hours_fill_rate",
        "Venue hours fill rate %",
        venue_hours_pct,
        "venue_hours_fill_rate_pct",
        context=f"{venues_with_hours}/{venues_total_for_context} venues with hours",
    )
    add_info_check(
        "enrichment.fixed_hours_venue_fill_rate",
        "Fixed-hours venue fill rate %",
        fixed_hours_pct,
        context=f"{fixed_hours_with_hours}/{fixed_hours_total} fixed-hours venues with hours",
    )
    add_info_check(
        "enrichment.event_led_destination_planning_fill_rate",
        "Event-led destination planning fill rate %",
        event_led_planning_pct,
        context=f"{event_led_with_planning}/{event_led_total} event-led destinations with planning notes",
    )
    add_check(
        "enrichment.event_description_fill_rate",
        "Event description fill rate % (>= 220 chars)",
        event_desc_pct,
        "event_description_fill_rate_pct",
        context=f"{event_long_descs}/{events_visible_for_context} visible events with description >= {SHORT_DESCRIPTION_MAX_LEN} chars",
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

    priority_source_quality = deep_get(metrics, "source_description_quality.priority_sources", {}) or {}
    for slug, threshold in PRIORITY_SOURCE_SHORT_DESC_THRESHOLDS.items():
        item = priority_source_quality.get(slug) or {}
        total_events = int(item.get("events", 0))
        short_events = int(item.get("short_descriptions", 0))
        short_pct = float(item.get("short_pct", 0.0))
        min_events = int(threshold.get("min_events", 0))

        if total_events < min_events:
            add_info_check(
                f"content.short_desc_pct.{slug}",
                f"{slug} short-description coverage %",
                short_pct,
                context=f"insufficient volume for gate ({total_events}/{min_events} events)",
            )
            continue

        source_threshold = {
            "warn_gt": float(threshold.get("warn_gt", 100.0)),
            "fail_gt": float(threshold.get("fail_gt", 100.0)),
        }
        add_check_with_threshold(
            check_id=f"content.short_desc_pct.{slug}",
            label=f"{slug} short-description coverage %",
            value=short_pct,
            threshold=source_threshold,
            context=f"{short_events}/{total_events} descriptions < {SHORT_DESCRIPTION_MAX_LEN} chars",
        )

    music_participant = deep_get(metrics, "participants.by_category.music", {}) or {}
    music_events = int(music_participant.get("events", 0))
    music_with_participants = int(music_participant.get("with_participants", 0))
    music_coverage_pct = float(music_participant.get("coverage_pct", 0.0))
    if music_events == 0:
        add_info_check(
            "participants.music_coverage_pct",
            "Music participant coverage %",
            music_coverage_pct,
            context="no visible future music events in scope",
        )
    else:
        add_check(
            "participants.music_coverage_pct",
            "Music participant coverage %",
            music_coverage_pct,
            "music_participant_coverage_pct",
            context=f"{music_with_participants}/{music_events} music events with event_artists",
        )

    counts = Counter(check["status"] for check in checks)
    overall_status = collapse_status([check["status"] for check in checks])
    hard_checks = [check for check in checks if check.get("severity") == "hard"]
    blocking_status = collapse_status([check["status"] for check in hard_checks])
    blocking_counts = Counter(check["status"] for check in hard_checks)

    return {
        "gate_profile": gate_profile,
        "overall_status": overall_status,
        "blocking_status": blocking_status,
        "counts": {"PASS": counts.get("PASS", 0), "WARN": counts.get("WARN", 0), "FAIL": counts.get("FAIL", 0)},
        "blocking_counts": {
            "PASS": blocking_counts.get("PASS", 0),
            "WARN": blocking_counts.get("WARN", 0),
            "FAIL": blocking_counts.get("FAIL", 0),
        },
        "checks": checks,
    }


def load_previous_metrics(
    output_dir: Path,
    as_of: date,
    *,
    scope_slug: str = "global",
) -> tuple[dict[str, Any] | None, str | None]:
    suffix = "" if scope_slug == "global" else f"_{scope_slug}"
    pattern = str(output_dir / f"content_health_metrics_*{suffix}.json")
    candidates = []
    for path in glob.glob(pattern):
        if scope_slug == "global":
            match = re.search(r"content_health_metrics_(\d{4}-\d{2}-\d{2})\.json$", path)
        else:
            match = re.search(
                rf"content_health_metrics_(\d{{4}}-\d{{2}}-\d{{2}})_{re.escape(scope_slug)}\.json$",
                path,
            )
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

    lines.append("## Participant Gap Drilldown (Actionable)")
    participant_source_rows = deep_get(metrics, "participants.by_source_expected_top", []) or []
    participant_gap_rows = [
        row for row in participant_source_rows if int(row.get("without_participants", 0)) > 0
    ]
    if not participant_gap_rows:
        lines.append("- No actionable participant gaps detected in tracked categories.")
    else:
        rows = []
        for row in participant_gap_rows[:15]:
            rows.append(
                [
                    str(row.get("source", "")),
                    str(row.get("events_expected", 0)),
                    str(row.get("without_participants", 0)),
                    f"{row.get('missing_pct', 0.0)}%",
                ]
            )
        lines.extend(
            _markdown_table(
                ["Source", "Expected Events", "Without Participants", "Missing %"],
                rows,
            )
        )
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
    if metrics["scope"].get("city_filter"):
        lines.append(
            f"- City filter: **{metrics['scope']['city_filter']}** "
            f"(metro={str(bool(metrics['scope'].get('include_metro'))).lower()})"
        )
    if metrics["scope"].get("portal_filter"):
        lines.append(f"- Portal filter: **{metrics['scope']['portal_filter']}**")
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
    lines.append(
        "Destination quality is evaluated separately from pure event yield. "
        "A venue can be healthy and strategically useful even with zero future events "
        "if it is a strong destination for nearby recommendations, hangs, concierge support, "
        "or before/after planning."
    )
    lines.append("")
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

    enrichment = metrics["enrichment"]
    lines.append("### Destination Readiness")
    lines.append(
        f"- Venue website fill: **{enrichment['venues_with_website']:,} / {counts['venues_total']:,}** "
        f"(**{enrichment['venue_website_fill_rate_pct']}%**)"
    )
    lines.append(
        f"- Venue image fill: **{enrichment['venues_with_image']:,} / {counts['venues_total']:,}** "
        f"(**{enrichment['venue_image_fill_rate_pct']}%**)"
    )
    lines.append(
        f"- Venue hours fill: **{enrichment['venues_with_hours']:,} / {counts['venues_total']:,}** "
        f"(**{enrichment['venue_hours_fill_rate_pct']}%**)"
    )
    lines.append(
        f"- Fixed-hours venue fill: **{enrichment['fixed_hours_venues_with_hours']:,} / "
        f"{enrichment['fixed_hours_venues_total']:,}** "
        f"(**{enrichment['fixed_hours_venue_fill_rate_pct']}%**)"
    )
    lines.append(
        f"- Venue description fill: **{enrichment['venues_with_description']:,} / {counts['venues_total']:,}** "
        f"(**{enrichment['venue_description_fill_rate_pct']}%**)"
    )
    lines.append(
        f"- Event-led destination planning fill: **{enrichment['event_led_destinations_with_planning']:,} / "
        f"{enrichment['event_led_destinations_total']:,}** "
        f"(**{enrichment['event_led_destination_planning_fill_rate_pct']}%**)"
    )
    lines.append(
        "- Destination readiness should inform recommendations even when a venue has "
        "no current events, especially for restaurants, bars, lodging-adjacent places, "
        "and pre/post-event gathering spots."
    )
    lines.append(
        "- Daily hours matter most for fixed-hours destinations like museums, cinemas, "
        "restaurants, and bars. Event-led venues like theaters and amphitheaters should "
        "be judged more heavily on planning logistics than on stable weekly hours."
    )
    lines.append("")

    source_desc = metrics.get("source_description_quality") or {}
    priority_sources = source_desc.get("priority_sources") or {}
    if priority_sources:
        lines.append("### Source Description Quality (Priority)")
        rows = []
        for slug in PRIORITY_SOURCE_SHORT_DESC_THRESHOLDS.keys():
            item = priority_sources.get(slug) or {}
            rows.append(
                [
                    slug,
                    str(item.get("events", 0)),
                    str(item.get("short_descriptions", 0)),
                    f"{item.get('short_pct', 0.0)}%",
                ]
            )
        lines.extend(
            _markdown_table(
                ["Source", "Visible Events", f"Short < {SHORT_DESCRIPTION_MAX_LEN}", "Short %"],
                rows,
            )
        )
        lines.append("")

    participant_quality = deep_get(metrics, "participants.by_category", {}) or {}
    if participant_quality:
        lines.append("### Participant Coverage (Raw)")
        rows = []
        for category in ("music", "comedy", "sports"):
            item = participant_quality.get(category) or {}
            rows.append(
                [
                    category,
                    str(item.get("events", 0)),
                    str(item.get("with_participants", 0)),
                    str(item.get("without_participants", 0)),
                    f"{item.get('coverage_pct', 0.0)}%",
                ]
            )
        lines.extend(
            _markdown_table(
                ["Category", "Visible Events", "With Participants", "Without Participants", "Coverage %"],
                rows,
            )
        )
        lines.append("")

    participant_expected_quality = deep_get(metrics, "participants.by_category_expected", {}) or {}
    if participant_expected_quality:
        lines.append("### Participant Coverage (Actionable Expected)")
        rows = []
        for category in ("music", "comedy", "sports"):
            item = participant_expected_quality.get(category) or {}
            rows.append(
                [
                    category,
                    str(item.get("events_expected", 0)),
                    str(item.get("with_participants", 0)),
                    str(item.get("without_participants", 0)),
                    f"{item.get('coverage_pct', 0.0)}%",
                ]
            )
        lines.extend(
            _markdown_table(
                ["Category", "Expected Events", "With Participants", "Without Participants", "Coverage %"],
                rows,
            )
        )
        lines.append("")

    participant_source_quality = deep_get(metrics, "participants.by_source_expected_top", []) or []
    if participant_source_quality:
        lines.append("### Participant Gaps by Source (Actionable Top)")
        gap_rows = []
        for item in participant_source_quality[:15]:
            if int(item.get("without_participants", 0)) <= 0:
                continue
            gap_rows.append(
                [
                    str(item.get("source", "")),
                    str(item.get("events_expected", 0)),
                    str(item.get("without_participants", 0)),
                    f"{item.get('missing_pct', 0.0)}%",
                ]
            )
        if gap_rows:
            lines.extend(
                _markdown_table(
                    ["Source", "Expected Events", "Without Participants", "Missing %"],
                    gap_rows,
                )
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
    scope_slug = str(deep_get(metrics, "scope.scope_slug", "global") or "global")
    suffix = "" if scope_slug == "global" else f"_{scope_slug}"
    json_path = output_dir / f"content_health_metrics_{date_slug}{suffix}.json"
    md_path = output_dir / f"content_health_assessment_{date_slug}{suffix}.md"
    gate_path = output_dir / f"content_health_gate_{date_slug}{suffix}.json"
    findings_path = output_dir / f"content_health_findings_{date_slug}{suffix}.md"
    json_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(metrics), encoding="utf-8")
    gate_payload = {
        "generated_at": metrics["generated_at"],
        "as_of": metrics["scope"]["future_start_date"],
        "gate_profile": gate["gate_profile"],
        "overall_status": gate["overall_status"],
        "blocking_status": gate["blocking_status"],
        "counts": gate["counts"],
        "blocking_counts": gate["blocking_counts"],
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
    parser.add_argument(
        "--city",
        type=str,
        default=None,
        help="Optional city scope. Example: --city Atlanta",
    )
    parser.add_argument(
        "--portal",
        type=str,
        default=None,
        help="Optional portal slug scope. Includes public rows plus this portal's rows.",
    )
    parser.add_argument(
        "--strict-city",
        action="store_true",
        help="Disable metro expansion for --city Atlanta and require strict city matching.",
    )
    parser.add_argument(
        "--gate-profile",
        type=str,
        default="auto",
        choices=["auto", "legacy", "atlanta-consumer", "concierge-hotel"],
        help=(
            "Launch gate profile. auto selects atlanta-consumer for Atlanta city portal "
            "scope; otherwise legacy."
        ),
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

    scope = build_scope(
        as_of,
        args.window_days,
        city=args.city,
        include_metro=not args.strict_city,
        portal=args.portal,
    )
    gate_profile = resolve_gate_profile(
        args.gate_profile,
        portal=scope.portal,
        city=scope.city,
    )
    output_dir = Path(args.output_dir)
    metrics = build_metrics(scope)
    metrics.setdefault("scope", {})["gate_profile"] = gate_profile
    scope_slug = str(deep_get(metrics, "scope.scope_slug", "global") or "global")
    previous_metrics, previous_date = load_previous_metrics(
        output_dir,
        as_of,
        scope_slug=scope_slug,
    )
    gate = evaluate_launch_gate(metrics, gate_profile=gate_profile)
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
        f"launch gate={gate['overall_status']} (blocking={gate['blocking_status']}, profile={gate_profile})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
