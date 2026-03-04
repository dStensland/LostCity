"""Shared festival audit metrics and positive-state gates.

This module centralizes festival quality checks so all audit scripts report
consistent, schema-correct results.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Callable, Optional

from db import get_client


@dataclass(frozen=True)
class GateSpec:
    key: str
    label: str
    direction: str  # "min" or "max"
    warn: float
    fail: float


POSITIVE_STATE_GATES: tuple[GateSpec, ...] = (
    GateSpec(
        key="announced_start_coverage_pct",
        label="Announced start coverage",
        direction="min",
        warn=90.0,
        fail=75.0,
    ),
    GateSpec(
        key="known_start_coverage_pct",
        label="Known start coverage (announced/pending/last_year)",
        direction="min",
        warn=97.0,
        fail=90.0,
    ),
    GateSpec(
        key="window_integrity_pct",
        label="Events inside announced windows",
        direction="min",
        warn=90.0,
        fail=80.0,
    ),
    GateSpec(
        key="festival_description_quality_pct",
        label="Festival description quality (>=80 chars)",
        direction="min",
        warn=95.0,
        fail=85.0,
    ),
    GateSpec(
        key="series_description_quality_pct",
        label="Festival series description quality (>=80 chars)",
        direction="min",
        warn=85.0,
        fail=60.0,
    ),
    GateSpec(
        key="event_description_quality_pct",
        label="Festival event description quality (>=120 chars)",
        direction="min",
        warn=85.0,
        fail=70.0,
    ),
    GateSpec(
        key="ghost_program_series_pct",
        label="Ghost festival_program series (0 events)",
        direction="max",
        warn=3.0,
        fail=10.0,
    ),
    GateSpec(
        key="single_program_series_pct",
        label="Single-event festival_program series",
        direction="max",
        warn=8.0,
        fail=20.0,
    ),
    GateSpec(
        key="orphan_program_series_pct",
        label="Orphaned festival_program series (0 or 1 event)",
        direction="max",
        warn=15.0,
        fail=30.0,
    ),
    GateSpec(
        key="fragmented_sources_count",
        label="Sources with >=5 festival_program series",
        direction="max",
        warn=0.0,
        fail=0.0,
    ),
    GateSpec(
        key="festival_model_fit_pct",
        label="Festivals structurally fit for festival model",
        direction="min",
        warn=85.0,
        fail=70.0,
    ),
    GateSpec(
        key="tentpole_fit_candidate_pct",
        label="Festival rows that should be tentpole events",
        direction="max",
        warn=8.0,
        fail=20.0,
    ),
)


# Positive-state gates should focus on the currently relevant festival universe
# (recent/upcoming cycles), not long-dormant catalog rows.
ACTIVE_SCOPE_DAYS = 400


def _pct(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 1)


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    text = str(value)[:10]
    try:
        return date.fromisoformat(text)
    except Exception:
        return None


def _fetch_rows(
    table: str,
    fields: str,
    *,
    query_builder: Optional[Callable[[Any], Any]] = None,
    order_column: Optional[str] = "id",
    page_size: int = 1000,
) -> list[dict[str, Any]]:
    client = get_client()
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


def compute_festival_audit_snapshot(*, today: Optional[date] = None) -> dict[str, Any]:
    snapshot_date = today or date.today()

    festivals = _fetch_rows(
        "festivals",
        "id,slug,name,announced_start,announced_end,pending_start,pending_end,last_year_start,last_year_end,description,date_source,date_confidence,image_url,website,festival_type,primary_type,typical_duration_days",
    )
    series = _fetch_rows(
        "series",
        "id,title,slug,series_type,festival_id,description",
        query_builder=lambda q: q.not_.is_("festival_id", "null"),
    )
    events_with_series = _fetch_rows(
        "events",
        "id,title,series_id,festival_id,start_date,end_date,description,source_id,venue_id,is_live,is_class",
        query_builder=lambda q: q.not_.is_("series_id", "null"),
    )
    events_with_direct_festival = _fetch_rows(
        "events",
        "id,title,series_id,festival_id,start_date,end_date,description,source_id,venue_id,is_live,is_class",
        query_builder=lambda q: q.is_("series_id", "null").not_.is_("festival_id", "null"),
    )
    events: list[dict[str, Any]] = []
    events_by_id: dict[Any, dict[str, Any]] = {}
    for event in events_with_series + events_with_direct_festival:
        event_id = event.get("id")
        if event_id in events_by_id:
            continue
        events_by_id[event_id] = event
        events.append(event)
    sources = _fetch_rows("sources", "id,slug,name")

    source_slug_by_id = {
        row.get("id"): (row.get("slug") or row.get("name") or "unknown") for row in sources
    }

    series_by_id = {row["id"]: row for row in series}
    series_ids = set(series_by_id.keys())
    series_by_festival: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in series:
        festival_id = row.get("festival_id")
        if festival_id:
            series_by_festival[festival_id].append(row)

    events_by_series: dict[str, list[dict[str, Any]]] = defaultdict(list)
    events_by_festival: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for event in events:
        series_id = event.get("series_id")
        if series_id in series_ids:
            events_by_series[series_id].append(event)
            festival_id = series_by_id[series_id].get("festival_id")
            if festival_id:
                events_by_festival[festival_id].append(event)

        direct_festival_id = event.get("festival_id")
        if direct_festival_id:
            events_by_festival[direct_festival_id].append(event)

    # Deduplicate festival event lists by event id
    for festival_id, festival_events in list(events_by_festival.items()):
        unique: dict[Any, dict[str, Any]] = {}
        for event in festival_events:
            unique[event.get("id")] = event
        events_by_festival[festival_id] = list(unique.values())

    all_festival_events = [
        event for event in events if event.get("series_id") in series_ids or event.get("festival_id")
    ]

    scope_cutoff = snapshot_date - timedelta(days=ACTIVE_SCOPE_DAYS)
    in_scope_festival_ids: set[str] = set()
    festival_scope_rows: list[dict[str, Any]] = []

    for festival in festivals:
        festival_id = festival.get("id")
        announced_start = _parse_date(festival.get("announced_start"))
        pending_start = _parse_date(festival.get("pending_start"))
        last_year_start = _parse_date(festival.get("last_year_start"))

        linked_events = events_by_festival.get(festival_id, [])
        linked_event_dates = sorted(
            [
                parsed
                for parsed in [_parse_date(event.get("start_date")) for event in linked_events]
                if parsed is not None
            ]
        )
        latest_event_date = linked_event_dates[-1] if linked_event_dates else None

        anchor_candidates = [
            announced_start,
            pending_start,
            last_year_start,
            latest_event_date,
        ]
        scope_anchor = max([candidate for candidate in anchor_candidates if candidate], default=None)
        in_scope = bool(scope_anchor and scope_anchor >= scope_cutoff)
        if in_scope:
            in_scope_festival_ids.add(festival_id)

        festival_scope_rows.append(
            {
                "festival_id": festival_id,
                "slug": festival.get("slug"),
                "scope_anchor": str(scope_anchor) if scope_anchor else None,
                "in_scope": in_scope,
            }
        )

    scoped_festivals = [row for row in festivals if row.get("id") in in_scope_festival_ids]
    scoped_series = [row for row in series if row.get("festival_id") in in_scope_festival_ids]
    scoped_series_ids = {row.get("id") for row in scoped_series}
    scoped_event_ids = {
        event.get("id")
        for festival_id in in_scope_festival_ids
        for event in events_by_festival.get(festival_id, [])
    }
    scoped_festival_events = [row for row in events if row.get("id") in scoped_event_ids]
    scoped_festival_program_series = [
        row for row in scoped_series if row.get("series_type") == "festival_program"
    ]
    scoped_non_program_series = [
        row for row in scoped_series if row.get("series_type") != "festival_program"
    ]

    if not scoped_festivals:
        in_scope_festival_ids = {row.get("id") for row in festivals}
        scoped_festivals = festivals
        scoped_series = series
        scoped_series_ids = {row.get("id") for row in scoped_series}
        scoped_festival_events = events
        scoped_festival_program_series = festival_program_series = [
            row for row in series if row.get("series_type") == "festival_program"
        ]
        scoped_non_program_series = [row for row in series if row.get("series_type") != "festival_program"]
    else:
        festival_program_series = [row for row in series if row.get("series_type") == "festival_program"]

    # Date integrity
    festival_missing_all_dates: list[dict[str, Any]] = []
    festival_missing_announced_start: list[dict[str, Any]] = []
    festival_inverted_announced_range: list[dict[str, Any]] = []
    festival_announced_duration_gt30d: list[dict[str, Any]] = []
    festivals_with_events_outside_announced_window: list[dict[str, Any]] = []

    total_window_scoped_events = 0
    total_window_outside_events = 0

    for festival in scoped_festivals:
        announced_start = _parse_date(festival.get("announced_start"))
        announced_end = _parse_date(festival.get("announced_end"))
        pending_start = _parse_date(festival.get("pending_start"))
        last_year_start = _parse_date(festival.get("last_year_start"))

        if not announced_start and not pending_start and not last_year_start:
            festival_missing_all_dates.append(
                {
                    "slug": festival.get("slug"),
                    "name": festival.get("name"),
                }
            )

        if not announced_start:
            festival_missing_announced_start.append(
                {
                    "slug": festival.get("slug"),
                    "name": festival.get("name"),
                    "pending_start": festival.get("pending_start"),
                    "last_year_start": festival.get("last_year_start"),
                }
            )

        if announced_start and announced_end and announced_end < announced_start:
            festival_inverted_announced_range.append(
                {
                    "slug": festival.get("slug"),
                    "name": festival.get("name"),
                    "announced_start": str(announced_start),
                    "announced_end": str(announced_end),
                }
            )

        if announced_start and announced_end:
            duration = (announced_end - announced_start).days
            if duration > 30:
                festival_announced_duration_gt30d.append(
                    {
                        "slug": festival.get("slug"),
                        "name": festival.get("name"),
                        "duration_days": duration,
                        "announced_start": str(announced_start),
                        "announced_end": str(announced_end),
                    }
                )

            outside_events: list[dict[str, Any]] = []
            linked_events = events_by_festival.get(festival.get("id"), [])
            for event in linked_events:
                event_date = _parse_date(event.get("start_date"))
                if not event_date:
                    continue
                total_window_scoped_events += 1
                if event_date < announced_start or event_date > announced_end:
                    total_window_outside_events += 1
                    series_title = None
                    if event.get("series_id") in series_by_id:
                        series_title = series_by_id[event["series_id"]].get("title")
                    outside_events.append(
                        {
                            "event_id": event.get("id"),
                            "title": event.get("title"),
                            "date": str(event_date),
                            "series_title": series_title,
                            "source_slug": source_slug_by_id.get(event.get("source_id"), "unknown"),
                        }
                    )

            if outside_events:
                festivals_with_events_outside_announced_window.append(
                    {
                        "slug": festival.get("slug"),
                        "name": festival.get("name"),
                        "window": [str(announced_start), str(announced_end)],
                        "outside_count": len(outside_events),
                        "sample": outside_events[:3],
                    }
                )

    # Description quality
    festival_missing_description: list[dict[str, Any]] = []
    festival_short_description: list[dict[str, Any]] = []
    festival_quality_descriptions = 0

    for festival in scoped_festivals:
        description = (festival.get("description") or "").strip()
        if not description:
            festival_missing_description.append(
                {"slug": festival.get("slug"), "name": festival.get("name")}
            )
            continue
        if len(description) < 80:
            festival_short_description.append(
                {
                    "slug": festival.get("slug"),
                    "name": festival.get("name"),
                    "len": len(description),
                    "sample": description[:120],
                }
            )
        else:
            festival_quality_descriptions += 1

    series_missing_description: list[dict[str, Any]] = []
    series_short_description: list[dict[str, Any]] = []
    series_quality_descriptions = 0

    for row in scoped_series:
        description = (row.get("description") or "").strip()
        if not description:
            series_missing_description.append(
                {
                    "series_id": row.get("id"),
                    "series_type": row.get("series_type"),
                    "title": row.get("title"),
                    "festival_id": row.get("festival_id"),
                }
            )
            continue
        if len(description) < 80:
            series_short_description.append(
                {
                    "series_id": row.get("id"),
                    "series_type": row.get("series_type"),
                    "title": row.get("title"),
                    "len": len(description),
                    "sample": description[:120],
                }
            )
        else:
            series_quality_descriptions += 1

    festival_events = [
        event
        for event in scoped_festival_events
        if event.get("series_id") in scoped_series_ids or event.get("festival_id") in in_scope_festival_ids
    ]
    event_missing_description: list[dict[str, Any]] = []
    event_short_description: list[dict[str, Any]] = []
    event_quality_descriptions = 0

    missing_by_source: Counter[str] = Counter()
    short_by_source: Counter[str] = Counter()

    for event in festival_events:
        source_slug = source_slug_by_id.get(event.get("source_id"), "unknown")
        description = (event.get("description") or "").strip()
        if not description:
            event_missing_description.append(
                {
                    "event_id": event.get("id"),
                    "title": event.get("title"),
                    "series_id": event.get("series_id"),
                    "source_slug": source_slug,
                }
            )
            missing_by_source[source_slug] += 1
            continue
        if len(description) < 120:
            event_short_description.append(
                {
                    "event_id": event.get("id"),
                    "title": event.get("title"),
                    "series_id": event.get("series_id"),
                    "source_slug": source_slug,
                    "len": len(description),
                    "sample": description[:120],
                }
            )
            short_by_source[source_slug] += 1
        else:
            event_quality_descriptions += 1

    # Schedule structure
    ghost_program_series: list[dict[str, Any]] = []
    single_program_series: list[dict[str, Any]] = []
    large_spread_program_series: list[dict[str, Any]] = []
    program_multi_source_series: list[dict[str, Any]] = []
    source_program_counter: Counter[str] = Counter()

    for row in scoped_festival_program_series:
        series_events = events_by_series.get(row.get("id"), [])
        event_count = len(series_events)

        if event_count == 0:
            ghost_program_series.append(
                {
                    "series_id": row.get("id"),
                    "title": row.get("title"),
                    "festival_id": row.get("festival_id"),
                }
            )
        elif event_count == 1:
            single_program_series.append(
                {
                    "series_id": row.get("id"),
                    "title": row.get("title"),
                    "festival_id": row.get("festival_id"),
                }
            )

        source_ids = {event.get("source_id") for event in series_events if event.get("source_id")}
        if len(source_ids) > 1:
            program_multi_source_series.append(
                {
                    "series_id": row.get("id"),
                    "title": row.get("title"),
                    "source_count": len(source_ids),
                    "sources": [source_slug_by_id.get(sid, "unknown") for sid in sorted(source_ids)],
                }
            )

        for source_id in source_ids:
            source_program_counter[source_slug_by_id.get(source_id, "unknown")] += 1

        dates = sorted(
            [
                _parse_date(event.get("start_date"))
                for event in series_events
                if _parse_date(event.get("start_date"))
            ]
        )
        if len(dates) >= 2:
            spread_days = (dates[-1] - dates[0]).days
            if spread_days > 14:
                large_spread_program_series.append(
                    {
                        "series_id": row.get("id"),
                        "title": row.get("title"),
                        "event_count": event_count,
                        "spread_days": spread_days,
                        "start": str(dates[0]),
                        "end": str(dates[-1]),
                    }
                )

    fragmented_sources = [
        {"source_slug": slug, "festival_program_series": count}
        for slug, count in source_program_counter.items()
        if count >= 5
    ]
    fragmented_sources.sort(key=lambda item: item["festival_program_series"], reverse=True)

    non_program_series = scoped_non_program_series

    # Model fit: should this stay a festival container or become a tentpole event?
    festival_model_fit: list[dict[str, Any]] = []
    tentpole_fit_candidates: list[dict[str, Any]] = []
    model_fit_ambiguous: list[dict[str, Any]] = []
    model_fit_insufficient: list[dict[str, Any]] = []

    for festival in festivals:
        festival_id = festival.get("id")
        linked_series = series_by_festival.get(festival_id, [])
        linked_events = events_by_festival.get(festival_id, [])

        program_series = [row for row in linked_series if row.get("series_type") == "festival_program"]
        active_program_series = [
            row for row in program_series if len(events_by_series.get(row.get("id"), [])) > 0
        ]

        event_count = len(linked_events)
        dated_event_values = sorted(
            [
                parsed
                for parsed in [_parse_date(event.get("start_date")) for event in linked_events]
                if parsed is not None
            ]
        )
        event_span_days = (
            (dated_event_values[-1] - dated_event_values[0]).days
            if len(dated_event_values) >= 2
            else 0
        )
        unique_venue_count = len({event.get("venue_id") for event in linked_events if event.get("venue_id")})
        unique_source_count = len({event.get("source_id") for event in linked_events if event.get("source_id")})

        announced_start = _parse_date(festival.get("announced_start"))
        announced_end = _parse_date(festival.get("announced_end"))
        declared_span_days = (
            (announced_end - announced_start).days
            if announced_start is not None and announced_end is not None
            else 0
        )
        typical_duration_days = festival.get("typical_duration_days") or 0
        festival_type = (festival.get("festival_type") or "").lower().strip()
        primary_type = (festival.get("primary_type") or "").lower().strip()
        has_tentpole_parent = any(bool(event.get("is_tentpole")) for event in linked_events)

        complex_reasons: list[str] = []
        simple_reasons: list[str] = []

        if len(active_program_series) >= 2:
            complex_reasons.append("multi_program_series")
        if event_count >= 6:
            complex_reasons.append("many_events")
        if unique_venue_count >= 2:
            complex_reasons.append("multi_venue")
        # date span is computed as date-diff, so 1 means a 2-day festival.
        if max(event_span_days, declared_span_days) >= 1:
            complex_reasons.append("multi_day")
        if unique_source_count >= 2:
            complex_reasons.append("multi_source")
        if (
            event_count >= 1
            and (declared_span_days >= 1 or typical_duration_days >= 2)
            and (
                primary_type.endswith("_festival")
                or primary_type.endswith("_conference")
                or primary_type.endswith("_con")
                or "convention" in primary_type
                or primary_type in {"pop_culture_con", "music_festival", "film_festival"}
                or festival_type in {"convention", "conference"}
            )
        ):
            complex_reasons.append("declared_multiday_structural_type")
        if event_count >= 1 and declared_span_days >= 1 and has_tentpole_parent:
            complex_reasons.append("declared_multiday_with_tentpole_parent")

        if len(active_program_series) <= 1:
            simple_reasons.append("no_program_structure")
        if event_count <= 2:
            simple_reasons.append("few_events")
        if unique_venue_count <= 1:
            simple_reasons.append("single_venue")
        if max(event_span_days, declared_span_days) <= 0:
            simple_reasons.append("single_day_or_weekend")
        if unique_source_count <= 1:
            simple_reasons.append("single_source")

        model_row = {
            "festival_id": festival_id,
            "slug": festival.get("slug"),
            "name": festival.get("name"),
            "event_count": event_count,
            "program_series_count": len(program_series),
            "active_program_series_count": len(active_program_series),
            "unique_venue_count": unique_venue_count,
            "unique_source_count": unique_source_count,
            "event_span_days": event_span_days,
            "declared_span_days": declared_span_days,
            "complex_reasons": complex_reasons,
            "simple_reasons": simple_reasons,
        }

        has_any_signal = bool(
            event_count
            or linked_series
            or announced_start
            or announced_end
            or festival.get("pending_start")
            or festival.get("last_year_start")
        )
        if not has_any_signal:
            model_row["classification"] = "insufficient_data"
            model_fit_insufficient.append(model_row)
            continue

        if len(simple_reasons) >= 4 and len(complex_reasons) <= 1 and event_count <= 3:
            model_row["classification"] = "tentpole_fit_candidate"
            model_row["recommended_action"] = "demote_to_tentpole_event"
            tentpole_fit_candidates.append(model_row)
            continue

        if len(complex_reasons) >= 2:
            model_row["classification"] = "festival_fit"
            model_row["recommended_action"] = "keep_festival_structure"
            festival_model_fit.append(model_row)
            continue

        model_row["classification"] = "ambiguous"
        model_row["recommended_action"] = "needs_manual_review"
        model_fit_ambiguous.append(model_row)

    festival_missing_announced_start_all_count = sum(
        1 for festival in festivals if not _parse_date(festival.get("announced_start"))
    )
    festival_missing_all_dates_all_count = sum(
        1
        for festival in festivals
        if not _parse_date(festival.get("announced_start"))
        and not _parse_date(festival.get("pending_start"))
        and not _parse_date(festival.get("last_year_start"))
    )

    scoped_festival_model_fit = [
        row for row in festival_model_fit if row.get("festival_id") in in_scope_festival_ids
    ]
    scoped_tentpole_fit_candidates = [
        row for row in tentpole_fit_candidates if row.get("festival_id") in in_scope_festival_ids
    ]
    scoped_model_fit_ambiguous = [
        row for row in model_fit_ambiguous if row.get("festival_id") in in_scope_festival_ids
    ]

    counts = {
        "festivals": len(festivals),
        "festivals_in_scope": len(scoped_festivals),
        "festivals_out_of_scope": len(festivals) - len(scoped_festivals),
        "festival_linked_series": len(series),
        "festival_linked_series_in_scope": len(scoped_series),
        "festival_program_series": len(festival_program_series),
        "festival_program_series_in_scope": len(scoped_festival_program_series),
        "festival_linked_events": len(all_festival_events),
        "festival_linked_events_in_scope": len(festival_events),
    }
    model_fit_denominator = len(scoped_festival_model_fit) + len(scoped_tentpole_fit_candidates) + len(
        scoped_model_fit_ambiguous
    )

    derived = {
        "announced_start_coverage_pct": _pct(
            counts["festivals_in_scope"] - len(festival_missing_announced_start),
            counts["festivals_in_scope"],
        ),
        "known_start_coverage_pct": _pct(
            counts["festivals_in_scope"] - len(festival_missing_all_dates),
            counts["festivals_in_scope"],
        ),
        "window_integrity_pct": _pct(
            total_window_scoped_events - total_window_outside_events,
            total_window_scoped_events,
        )
        if total_window_scoped_events
        else 100.0,
        "festival_description_quality_pct": _pct(
            festival_quality_descriptions,
            counts["festivals_in_scope"],
        ),
        "series_description_quality_pct": _pct(
            series_quality_descriptions,
            counts["festival_linked_series_in_scope"],
        ),
        "event_description_quality_pct": _pct(
            event_quality_descriptions,
            counts["festival_linked_events_in_scope"],
        ),
        "ghost_program_series_pct": _pct(
            len(ghost_program_series),
            counts["festival_program_series_in_scope"],
        ),
        "single_program_series_pct": _pct(
            len(single_program_series),
            counts["festival_program_series_in_scope"],
        ),
        "orphan_program_series_pct": _pct(
            len(ghost_program_series) + len(single_program_series),
            counts["festival_program_series_in_scope"],
        ),
        "fragmented_sources_count": float(len(fragmented_sources)),
        "non_program_festival_linked_series_pct": _pct(
            len(non_program_series),
            counts["festival_linked_series_in_scope"],
        ),
        "festival_model_fit_pct": _pct(len(scoped_festival_model_fit), model_fit_denominator)
        if model_fit_denominator
        else 100.0,
        "tentpole_fit_candidate_pct": _pct(
            len(scoped_tentpole_fit_candidates),
            counts["festivals_in_scope"],
        ),
        "announced_start_coverage_all_pct": _pct(
            counts["festivals"] - festival_missing_announced_start_all_count,
            counts["festivals"],
        ),
        "known_start_coverage_all_pct": _pct(
            counts["festivals"] - festival_missing_all_dates_all_count,
            counts["festivals"],
        ),
    }

    return {
        "snapshot_date": snapshot_date.isoformat(),
        "scope": {
            "definition": "recent_or_upcoming_cycle",
            "active_scope_days": ACTIVE_SCOPE_DAYS,
            "cutoff_date": scope_cutoff.isoformat(),
            "in_scope_festival_ids": len(in_scope_festival_ids),
        },
        "counts": counts,
        "derived": derived,
        "date_quality": {
            "scope": "in_scope_festivals",
            "festival_missing_all_dates": len(festival_missing_all_dates),
            "festival_missing_announced_start": len(festival_missing_announced_start),
            "festival_missing_all_dates_all": festival_missing_all_dates_all_count,
            "festival_missing_announced_start_all": festival_missing_announced_start_all_count,
            "festival_inverted_announced_range": len(festival_inverted_announced_range),
            "festival_announced_duration_gt30d": len(festival_announced_duration_gt30d),
            "festivals_with_events_outside_announced_window": len(
                festivals_with_events_outside_announced_window
            ),
            "total_window_scoped_events": total_window_scoped_events,
            "total_window_outside_events": total_window_outside_events,
        },
        "description_quality": {
            "scope": "in_scope_festivals",
            "festival_missing_description": len(festival_missing_description),
            "festival_short_description_lt80": len(festival_short_description),
            "series_missing_description": len(series_missing_description),
            "series_short_description_lt80": len(series_short_description),
            "festival_events_missing_description": len(event_missing_description),
            "festival_events_short_description_lt120": len(event_short_description),
            "top_missing_description_sources": missing_by_source.most_common(12),
            "top_short_description_sources": short_by_source.most_common(12),
        },
        "schedule_quality": {
            "scope": "in_scope_festivals",
            "festival_program_ghost_series_zero_events": len(ghost_program_series),
            "festival_program_single_event_series": len(single_program_series),
            "festival_program_large_spread_gt14d": len(large_spread_program_series),
            "festival_program_multi_source_series": len(program_multi_source_series),
            "sources_with_5plus_festival_program_series": len(fragmented_sources),
            "non_program_festival_linked_series": len(non_program_series),
        },
        "model_fit": {
            "festival_fit_count": len(festival_model_fit),
            "tentpole_fit_candidate_count": len(tentpole_fit_candidates),
            "ambiguous_count": len(model_fit_ambiguous),
            "insufficient_data_count": len(model_fit_insufficient),
            "festival_fit_count_in_scope": len(scoped_festival_model_fit),
            "tentpole_fit_candidate_count_in_scope": len(scoped_tentpole_fit_candidates),
            "ambiguous_count_in_scope": len(scoped_model_fit_ambiguous),
            "by_festival": {
                row["festival_id"]: {
                    "slug": row.get("slug"),
                    "classification": row.get("classification"),
                    "recommended_action": row.get("recommended_action"),
                    "event_count": row.get("event_count"),
                    "program_series_count": row.get("program_series_count"),
                    "active_program_series_count": row.get("active_program_series_count"),
                    "unique_venue_count": row.get("unique_venue_count"),
                    "event_span_days": row.get("event_span_days"),
                    "declared_span_days": row.get("declared_span_days"),
                    "complex_reasons": row.get("complex_reasons"),
                    "simple_reasons": row.get("simple_reasons"),
                }
                for row in (
                    festival_model_fit
                    + tentpole_fit_candidates
                    + model_fit_ambiguous
                    + model_fit_insufficient
                )
            },
        },
        "samples": {
            "festival_missing_announced_start": festival_missing_announced_start[:15],
            "festivals_with_events_outside_announced_window": festivals_with_events_outside_announced_window[:15],
            "festival_missing_description": festival_missing_description[:15],
            "festival_short_description": festival_short_description[:15],
            "series_missing_description": series_missing_description[:15],
            "festival_events_missing_description": event_missing_description[:15],
            "ghost_program_series": ghost_program_series[:15],
            "single_program_series": single_program_series[:15],
            "fragmented_sources": fragmented_sources[:15],
            "large_spread_program_series": sorted(
                large_spread_program_series,
                key=lambda row: row["spread_days"],
                reverse=True,
            )[:15],
            "non_program_series": non_program_series[:15],
            "tentpole_fit_candidates": sorted(
                tentpole_fit_candidates,
                key=lambda row: (
                    -row["event_count"],
                    -row["program_series_count"],
                    row["slug"] or "",
                ),
            )[:20],
            "festival_fit_examples": sorted(
                festival_model_fit,
                key=lambda row: (
                    -row["event_count"],
                    -row["program_series_count"],
                    row["slug"] or "",
                ),
            )[:20],
            "model_fit_ambiguous": model_fit_ambiguous[:20],
            "model_fit_insufficient": model_fit_insufficient[:20],
            "out_of_scope_festivals": [
                row for row in festival_scope_rows if not row.get("in_scope")
            ][:20],
        },
    }


def evaluate_positive_state(snapshot: dict[str, Any]) -> dict[str, Any]:
    derived = snapshot["derived"]
    gate_results: list[dict[str, Any]] = []

    severity_rank = {"PASS": 0, "WARN": 1, "FAIL": 2}
    overall = "PASS"

    for gate in POSITIVE_STATE_GATES:
        value = float(derived.get(gate.key, 0.0))
        if gate.direction == "min":
            if value < gate.fail:
                status = "FAIL"
            elif value < gate.warn:
                status = "WARN"
            else:
                status = "PASS"
        else:
            if value > gate.fail:
                status = "FAIL"
            elif value > gate.warn:
                status = "WARN"
            else:
                status = "PASS"

        if severity_rank[status] > severity_rank[overall]:
            overall = status

        gate_results.append(
            {
                "key": gate.key,
                "label": gate.label,
                "direction": gate.direction,
                "value": value,
                "warn": gate.warn,
                "fail": gate.fail,
                "status": status,
            }
        )

    return {
        "overall": overall,
        "gates": gate_results,
    }
