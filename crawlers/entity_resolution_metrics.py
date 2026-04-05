"""Entity-resolution audit snapshot for Phase 4 baseline work."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Optional
from urllib.parse import urlparse

from db import get_client

STEADY_STATE_THRESHOLDS = {
    "duplicate_place_rate_pct": 2.0,
    "unresolved_place_source_match_rate_pct": 1.0,
    "festival_yearly_wrapper_fragmentation_rate_pct": 0.0,
    "program_session_fragmentation_rate_pct": 5.0,
    "organizer_duplication_rate_pct": 0.5,
}


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


def _normalize_text(value: Any) -> str:
    return re.sub(
        r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())
    ).strip()


def _normalize_name(value: Any) -> str:
    normalized = _normalize_text(value)
    normalized = re.sub(
        r"\b(the|inc|llc|ltd|co|company|center|centre|venue|atlanta|festival)\b",
        " ",
        normalized,
    )
    return re.sub(r"\s+", " ", normalized).strip()


def _normalize_address(value: Any) -> str:
    normalized = _normalize_text(value)
    normalized = normalized.replace(" street ", " st ").replace(" avenue ", " ave ")
    normalized = normalized.replace(" road ", " rd ").replace(" boulevard ", " blvd ")
    return re.sub(r"\s+", " ", normalized).strip()


def _domain(url: Any) -> str:
    text = str(url or "").strip()
    if not text:
        return ""
    if "://" not in text:
        text = "https://" + text
    parsed = urlparse(text)
    return parsed.netloc.lower().removeprefix("www.")


def _pct(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 1)


def classify_venue_issue(group: list[dict[str, Any]]) -> str:
    addresses = {row["address_norm"] for row in group if row["address_norm"]}
    domains = {row["domain"] for row in group if row["domain"]}
    if len(addresses) == 1 and addresses and len(domains) <= 1:
        return "matching_only_fix"
    if len(addresses) == 1 and addresses:
        return "alias_support_fix"
    if len(domains) == 1 and domains:
        return "manual_review_only"
    return "manual_review_only"


def classify_program_issue(group: list[dict[str, Any]]) -> str:
    venue_ids = {row.get("venue_id") for row in group if row.get("venue_id")}
    provider_names = {
        _normalize_text(row.get("provider_name"))
        for row in group
        if row.get("provider_name")
    }
    if len(venue_ids) <= 1 and len(provider_names) <= 1:
        return "matching_only_fix"
    return "manual_review_only"


def classify_organizer_issue(group: list[dict[str, Any]]) -> str:
    domains = {row["domain"] for row in group if row["domain"]}
    if len(domains) <= 1:
        return "matching_only_fix"
    return "alias_support_fix"


def classify_festival_issue(_group: list[dict[str, Any]]) -> str:
    return "year_cycle_linkage_fix"


def _looks_like_festival_yearly_wrapper(title: Any, festival_name: Any) -> bool:
    title_norm = _normalize_text(re.sub(r"\b20\d{2}\b", " ", str(title or "")))
    festival_norm = _normalize_text(festival_name)
    if not title_norm or not festival_norm:
        return False
    return festival_norm in title_norm


def _fetch_event_resolution_rows() -> list[dict[str, Any]]:
    try:
        return _fetch_rows(
            "events",
            "id,source_id,place_id,is_active",
            query_builder=lambda q: q.eq("is_active", True),
        )
    except Exception:
        return _fetch_rows(
            "events",
            "id,source_id,venue_id,is_active",
            query_builder=lambda q: q.eq("is_active", True),
        )


def compute_entity_resolution_snapshot() -> dict[str, Any]:
    venues = _fetch_rows("places", "id,name,address,city,website,aliases,is_active")
    festivals = _fetch_rows("festivals", "id,slug,name")
    series = _fetch_rows(
        "series",
        "id,title,festival_id,series_type,is_active",
        query_builder=lambda q: q.not_.is_("festival_id", "null"),
    )
    programs = _fetch_rows(
        "programs",
        "id,name,provider_name,place_id,season,status,source_id,program_type,age_min,age_max,before_after_care,lunch_included,metadata",
        query_builder=lambda q: q.eq("status", "active"),
    )
    organizers = _fetch_rows(
        "organizations", "id,name,city,website,total_events_tracked"
    )
    events = _fetch_event_resolution_rows()

    venue_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in venues:
        if row.get("is_active") is False:
            continue
        normalized = _normalize_name(row.get("name"))
        if not normalized:
            continue
        venue_groups[
            (normalized, _normalize_text(row.get("city") or "atlanta"))
        ].append(
            {
                "id": row.get("id"),
                "name": row.get("name"),
                "address_norm": _normalize_address(row.get("address")),
                "domain": _domain(row.get("website")),
                "city": row.get("city"),
            }
        )

    venue_issues = []
    duplicate_venue_rows = 0
    for (name_key, city_key), group in venue_groups.items():
        if len(group) < 2:
            continue
        duplicate_venue_rows += len(group)
        venue_issues.append(
            {
                "entity_family": "venue",
                "issue_type": "duplicate_place_family",
                "label": classify_venue_issue(group),
                "key": f"{name_key}|{city_key}",
                "count": len(group),
                "sample_names": [row["name"] for row in group[:3]],
                "evidence": {
                    "addresses": sorted(
                        {row["address_norm"] for row in group if row["address_norm"]}
                    )[:3],
                    "domains": sorted(
                        {row["domain"] for row in group if row["domain"]}
                    )[:3],
                },
            }
        )

    unresolved_events = 0
    for row in events:
        place_or_venue_id = row.get("place_id", row.get("venue_id"))
        if row.get("source_id") and not place_or_venue_id:
            unresolved_events += 1

    unresolved_programs = sum(
        1 for row in programs if row.get("source_id") and not row.get("place_id")
    )
    unresolved_records = unresolved_events + unresolved_programs
    total_records = len(events) + len(programs)

    festival_name_by_id = {
        row["id"]: row.get("name") or row.get("slug") for row in festivals
    }
    yearly_wrapper_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in series:
        if (
            row.get("is_active") is False
            or row.get("series_type") == "festival_program"
        ):
            continue
        title = str(row.get("title") or "")
        festival_name = festival_name_by_id.get(row["festival_id"])
        if re.search(r"\b20\d{2}\b", title) and _looks_like_festival_yearly_wrapper(
            title, festival_name
        ):
            yearly_wrapper_groups[row["festival_id"]].append(
                {
                    "series_id": row.get("id"),
                    "title": title,
                    "series_type": row.get("series_type"),
                }
            )

    festival_issues = []
    for festival_id, group in yearly_wrapper_groups.items():
        if not group:
            continue
        festival_issues.append(
            {
                "entity_family": "festival",
                "issue_type": "yearly_wrapper_fragmentation",
                "label": classify_festival_issue(group),
                "festival_id": festival_id,
                "festival_slug": festival_name_by_id.get(festival_id),
                "count": len(group),
                "sample_names": [row["title"] for row in group[:3]],
            }
        )

    program_groups: dict[tuple[str, Any, str, str], list[dict[str, Any]]] = defaultdict(
        list
    )
    for row in programs:
        name_key = _normalize_name(row.get("name"))
        if not name_key:
            continue
        program_groups[
            (
                name_key,
                row.get("place_id"),
                _normalize_text(row.get("provider_name")),
                _normalize_text(row.get("season")),
            )
        ].append(row)

    program_issues = []
    duplicate_program_rows = 0
    for key, group in program_groups.items():
        if len(group) < 2:
            continue
        family_keys = {
            (row.get("metadata") or {}).get("program_family_key")
            for row in group
            if (row.get("metadata") or {}).get("program_family_key")
        }
        if len(family_keys) == 1 and len(group) >= 2:
            continue
        duplicate_program_rows += len(group)
        program_issues.append(
            {
                "entity_family": "program",
                "issue_type": "program_session_fragmentation",
                "label": classify_program_issue(group),
                "key": "|".join(str(part or "") for part in key),
                "count": len(group),
                "sample_names": [row.get("name") for row in group[:3]],
            }
        )

    organizer_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in organizers:
        name_key = _normalize_name(row.get("name"))
        if not name_key:
            continue
        organizer_groups[
            (name_key, _normalize_text(row.get("city") or "atlanta"))
        ].append(
            {
                "id": row.get("id"),
                "name": row.get("name"),
                "domain": _domain(row.get("website")),
                "total_events_tracked": row.get("total_events_tracked") or 0,
            }
        )

    organizer_issues = []
    duplicate_organizer_rows = 0
    for (name_key, city_key), group in organizer_groups.items():
        if len(group) < 2:
            continue
        duplicate_organizer_rows += len(group)
        organizer_issues.append(
            {
                "entity_family": "organizer",
                "issue_type": "organizer_duplicate_family",
                "label": classify_organizer_issue(group),
                "key": f"{name_key}|{city_key}",
                "count": len(group),
                "sample_names": [row["name"] for row in group[:3]],
                "evidence": {
                    "domains": sorted(
                        {row["domain"] for row in group if row["domain"]}
                    )[:3],
                },
            }
        )

    top_issues = sorted(
        venue_issues + festival_issues + program_issues + organizer_issues,
        key=lambda row: (
            -row["count"],
            row["entity_family"],
            row.get("key", row.get("festival_slug", "")),
        ),
    )[:25]

    return {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "counts": {
            "venues": len(venues),
            "events": len(events),
            "programs": len(programs),
            "festivals": len(festivals),
            "festival_linked_series": len(series),
            "organizers": len(organizers),
        },
        "metrics": {
            "duplicate_place_rate_pct": _pct(duplicate_venue_rows, len(venues)),
            "unresolved_place_source_match_rate_pct": _pct(
                unresolved_records, total_records
            ),
            "festival_yearly_wrapper_fragmentation_rate_pct": _pct(
                len(festival_issues), len(festivals)
            ),
            "program_session_fragmentation_rate_pct": _pct(
                duplicate_program_rows, len(programs)
            ),
            "organizer_duplication_rate_pct": _pct(
                duplicate_organizer_rows, len(organizers)
            ),
        },
        "issues": {
            "venue": venue_issues[:10],
            "festival": festival_issues[:10],
            "program": program_issues[:10],
            "organizer": organizer_issues[:10],
        },
        "top_issues": top_issues,
    }


def build_entity_resolution_gate(snapshot: dict[str, Any]) -> dict[str, Any]:
    top_issues = snapshot["top_issues"]
    unlabeled = [row for row in top_issues if not row.get("label")]
    metrics = snapshot["metrics"]
    bounded_queue = (
        metrics.get("duplicate_place_rate_pct", 100.0)
        <= STEADY_STATE_THRESHOLDS["duplicate_place_rate_pct"]
        and metrics.get("unresolved_place_source_match_rate_pct", 100.0)
        <= STEADY_STATE_THRESHOLDS["unresolved_place_source_match_rate_pct"]
        and metrics.get("festival_yearly_wrapper_fragmentation_rate_pct", 100.0)
        <= STEADY_STATE_THRESHOLDS["festival_yearly_wrapper_fragmentation_rate_pct"]
        and metrics.get("program_session_fragmentation_rate_pct", 100.0)
        <= STEADY_STATE_THRESHOLDS["program_session_fragmentation_rate_pct"]
        and metrics.get("organizer_duplication_rate_pct", 100.0)
        <= STEADY_STATE_THRESHOLDS["organizer_duplication_rate_pct"]
    )
    decision = "INCOMPLETE"
    if not unlabeled and bounded_queue:
        decision = "BOUNDED_QUEUE"
    elif not unlabeled:
        decision = "BASELINE_READY"
    return {
        "generated_at": snapshot["generated_at"],
        "decision": decision,
        "ready_for_mutation": decision == "BASELINE_READY",
        "bounded_queue": bounded_queue,
        "top_issue_count": len(top_issues),
        "metrics": metrics,
        "top_issues": top_issues,
    }
