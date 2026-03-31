#!/usr/bin/env python3
"""
Activation gate report for crawler first-pass capture.

This turns the strategy's "activation gate" into a live artifact by checking
active sources against the signals their declared data goals imply they should
capture on the first pass.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from source_goals import DESTINATION_INTELLIGENCE_GOALS, resolve_source_data_goals

DEFAULT_REPORT_DIR = ROOT / "reports"
BAD_HEALTH_TAG_HINTS = {
    "timeout",
    "dns-error",
    "ssl-error",
    "parse-error",
    "no-events",
    "instagram-only",
    "facebook-events",
}
EVENT_GOALS = {"events", "showtimes", "lineup"}
FAIL_WEIGHT = {
    "health": 70,
    "stale": 55,
    "missing-primary-venue": 45,
    "events": 60,
    "classes": 60,
    "exhibits": 60,
    "open_calls": 60,
    "specials": 35,
    "venue_hours": 35,
    "images": 30,
}
WARN_WEIGHT = {
    "description": 15,
    "planning": 12,
    "destination-batch": 10,
}


@dataclass
class SourceGate:
    id: int
    slug: str
    name: str
    portal_slug: str
    is_active: bool
    integration_method: str
    last_crawled_at: Optional[str]
    last_crawl_status: Optional[str] = None
    last_crawl_logged_at: Optional[str] = None
    health_tags: list[str] = field(default_factory=list)
    goals: list[str] = field(default_factory=list)
    goal_mode: str = "inferred"
    entity_mode: str = "events"
    primary_venue_id: Optional[int] = None
    primary_venue_name: Optional[str] = None
    venue_type: Optional[str] = None
    future_events: int = 0
    recent_events_30d: int = 0
    active_programs: int = 0
    recent_programs_30d: int = 0
    future_exhibitions: int = 0
    recent_exhibitions_30d: int = 0
    open_open_calls: int = 0
    recent_open_calls_30d: int = 0
    active_specials: int = 0
    has_hours: bool = False
    has_description: bool = False
    has_image: bool = False
    has_planning: bool = False
    status: str = "pass"
    failing_checks: list[str] = field(default_factory=list)
    warning_checks: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    priority_score: int = 0


def paged_select(
    client: Any,
    table: str,
    fields: str,
    *,
    query_builder: Optional[Callable[[Any], Any]] = None,
    page_size: int = 1000,
    order_column: Optional[str] = "id",
) -> list[dict]:
    rows: list[dict] = []
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


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        match = re.match(r"^(.*?)([+-]\d{2}:\d{2})$", normalized)
        if match:
            timestamp_part, tz_part = match.groups()
            if "." in timestamp_part:
                base_part, fraction = timestamp_part.split(".", 1)
                normalized_fraction = (fraction + "000000")[:6]
                try:
                    return datetime.fromisoformat(f"{base_part}.{normalized_fraction}{tz_part}")
                except ValueError:
                    return None
        return None


def stale_days(value: Optional[str], now: datetime) -> Optional[int]:
    parsed = parse_iso_datetime(value)
    if parsed is None:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int((now - parsed.astimezone(timezone.utc)).total_seconds() // 86400)


def crawl_recency_days(source: SourceGate, now: datetime) -> Optional[int]:
    ages = [
        age
        for age in (
            stale_days(source.last_crawled_at, now),
            stale_days(source.last_crawl_logged_at, now),
        )
        if age is not None
    ]
    if not ages:
        return None
    return min(ages)


def has_usable_hours(value: Any) -> bool:
    if not value:
        return False
    if isinstance(value, dict):
        return any(
            isinstance(day, dict) and (day.get("open") or day.get("close"))
            for day in value.values()
        )
    return True


def _problem_tags(tags: list[str]) -> list[str]:
    found = []
    for tag in tags:
        for hint in BAD_HEALTH_TAG_HINTS:
            if hint in tag:
                found.append(tag)
                break
    return found


def _fetch_sources(client: Any, include_inactive: bool) -> list[dict]:
    def builder(query: Any) -> Any:
        if include_inactive:
            return query
        return query.eq("is_active", True)

    return paged_select(
        client,
        "sources",
        "id,slug,name,is_active,owner_portal_id,integration_method,last_crawled_at,health_tags",
        query_builder=builder,
    )


def _fetch_portal_map(client: Any) -> dict[str, str]:
    rows = paged_select(client, "portals", "id,slug", order_column="slug")
    return {row["id"]: row.get("slug") or "unknown" for row in rows if row.get("id")}


def _fetch_venues(client: Any) -> dict[int, dict[str, Any]]:
    rows = paged_select(
        client,
        "places",
        "id,slug,name,place_type,hours,description,image_url,planning_notes",
    )
    return {int(row["id"]): row for row in rows if row.get("id") is not None}


def _venues_by_slug(venues: dict[int, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        str(row.get("slug") or "").strip(): row
        for row in venues.values()
        if row.get("slug")
    }


def _normalize_name(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _unique_venues_by_name(venues: dict[int, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in venues.values():
        normalized = _normalize_name(row.get("name"))
        if normalized:
            grouped[normalized].append(row)

    return {
        normalized: rows[0]
        for normalized, rows in grouped.items()
        if len(rows) == 1
    }


def _fetch_special_counts(client: Any) -> Counter[int]:
    rows = paged_select(
        client,
        "place_specials",
        "place_id",
        query_builder=lambda q: q.eq("is_active", True),
        order_column="place_id",
    )
    return Counter(int(row["place_id"]) for row in rows if row.get("place_id") is not None)


def _fetch_events(client: Any, source_ids: list[int]) -> tuple[list[dict], list[dict]]:
    if not source_ids:
        return [], []
    today = date.today().isoformat()
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    future_rows = paged_select(
        client,
        "events",
        "source_id,place_id",
        query_builder=lambda q: q.in_("source_id", source_ids).eq("is_active", True).gte("start_date", today),
        order_column="source_id",
    )
    recent_rows = paged_select(
        client,
        "events",
        "source_id,place_id",
        query_builder=lambda q: q.in_("source_id", source_ids).gte("created_at", recent_cutoff),
        order_column="source_id",
    )
    return future_rows, recent_rows


def _fetch_programs(client: Any, source_ids: list[int]) -> tuple[list[dict], list[dict]]:
    if not source_ids:
        return [], []
    today = date.today().isoformat()
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    future_rows = paged_select(
        client,
        "programs",
        "source_id,place_id",
        query_builder=lambda q: q.in_("source_id", source_ids).eq("status", "active").or_(f"session_end.gte.{today},session_end.is.null"),
        order_column="source_id",
    )
    recent_rows = paged_select(
        client,
        "programs",
        "source_id,place_id",
        query_builder=lambda q: q.in_("source_id", source_ids).gte("created_at", recent_cutoff),
        order_column="source_id",
    )
    return future_rows, recent_rows


def _fetch_exhibitions(client: Any, source_ids: list[int]) -> tuple[list[dict], list[dict]]:
    if not source_ids:
        return [], []
    today = date.today().isoformat()
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    future_rows = paged_select(
        client,
        "exhibitions",
        "source_id,place_id",
        query_builder=lambda q: q.in_("source_id", source_ids).eq("is_active", True).or_(f"closing_date.gte.{today},closing_date.is.null"),
        order_column="source_id",
    )
    recent_rows = paged_select(
        client,
        "exhibitions",
        "source_id,place_id",
        query_builder=lambda q: q.in_("source_id", source_ids).gte("created_at", recent_cutoff),
        order_column="source_id",
    )
    return future_rows, recent_rows


def _fetch_open_calls(client: Any, source_ids: list[int]) -> tuple[list[dict], list[dict]]:
    if not source_ids:
        return [], []
    today = date.today().isoformat()
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    future_rows = paged_select(
        client,
        "open_calls",
        "source_id,place_id",
        query_builder=lambda q: q.in_("source_id", source_ids).eq("is_active", True).eq("status", "open").or_(f"deadline.gte.{today},deadline.is.null"),
        order_column="source_id",
    )
    recent_rows = paged_select(
        client,
        "open_calls",
        "source_id,place_id",
        query_builder=lambda q: q.in_("source_id", source_ids).gte("created_at", recent_cutoff),
        order_column="source_id",
    )
    return future_rows, recent_rows


def _fetch_latest_crawl_logs(client: Any, source_ids: list[int]) -> dict[int, tuple[str, str]]:
    if not source_ids:
        return {}

    rows = paged_select(
        client,
        "crawl_logs",
        "source_id,status,created_at",
        query_builder=lambda q: q.in_("source_id", source_ids),
        order_column=None,
    )

    latest_by_source: dict[int, tuple[datetime, str, str]] = {}
    for row in rows:
        source_id = row.get("source_id")
        status = str(row.get("status") or "").strip().lower()
        created_at = parse_iso_datetime(row.get("created_at"))
        if source_id is None or not status or created_at is None:
            continue
        source_key = int(source_id)
        current = latest_by_source.get(source_key)
        if current is None or created_at > current[0]:
            latest_by_source[source_key] = (
                created_at,
                status,
                str(row.get("created_at") or created_at.isoformat()),
            )

    return {
        source_id: (status, created_at)
        for source_id, (_created_at, status, created_at) in latest_by_source.items()
    }


def _source_counts(rows: list[dict]) -> Counter[int]:
    return Counter(int(row["source_id"]) for row in rows if row.get("source_id") is not None)


def _source_venue_counts(*row_sets: list[dict]) -> dict[int, Counter[int]]:
    counts: dict[int, Counter[int]] = defaultdict(Counter)
    for rows in row_sets:
        for row in rows:
            source_id = row.get("source_id")
            place_id = row.get("place_id")
            if source_id is None or place_id is None:
                continue
            counts[int(source_id)][int(place_id)] += 1
    return counts


def evaluate_gate(source: SourceGate, *, now: datetime) -> SourceGate:
    fails: list[str] = []
    warns: list[str] = []
    reasons: list[str] = []
    score = 0

    problem_tags = _problem_tags(source.health_tags)
    crawl_age_days = crawl_recency_days(source, now)
    recent_attempt_masks_health = (
        source.last_crawl_status in {"success", "running"}
        and crawl_age_days is not None
        and crawl_age_days <= 1
    )
    if problem_tags and not recent_attempt_masks_health:
        fails.append("health")
        reasons.append(f"health tags: {', '.join(problem_tags[:3])}")
        score += FAIL_WEIGHT["health"]

    age_days = crawl_age_days
    if age_days is None or age_days > 14:
        fails.append("stale")
        reasons.append("source appears stale or uncrawled in the last 14 days")
        score += FAIL_WEIGHT["stale"]

    needs_destination_signals = source.entity_mode in {"events", "programs", "destination"} and bool(
        set(source.goals) & DESTINATION_INTELLIGENCE_GOALS
    )
    destination_batch_without_primary = (
        source.entity_mode == "destination" and source.primary_venue_id is None
    )
    if needs_destination_signals and source.primary_venue_id is None and not destination_batch_without_primary:
        fails.append("missing-primary-venue")
        reasons.append("no primary venue could be inferred for destination signal checks")
        score += FAIL_WEIGHT["missing-primary-venue"]
    elif destination_batch_without_primary:
        warns.append("destination-batch")
        reasons.append("destination batch source has no single primary venue; place-level checks are skipped")
        score += WARN_WEIGHT["destination-batch"]

    if source.entity_mode == "open_calls":
        if source.open_open_calls == 0 and source.recent_open_calls_30d == 0:
            fails.append("open_calls")
            reasons.append("open-call source has no open or recent call output")
            score += FAIL_WEIGHT["open_calls"]
    elif source.entity_mode == "exhibitions":
        if source.future_exhibitions == 0 and source.recent_exhibitions_30d == 0:
            fails.append("exhibits")
            reasons.append("exhibition source has no current or recent exhibition output")
            score += FAIL_WEIGHT["exhibits"]
    elif set(source.goals) & EVENT_GOALS:
        if source.future_events == 0 and source.recent_events_30d == 0:
            fails.append("events")
            reasons.append("event-oriented source has no future or recent event output")
            score += FAIL_WEIGHT["events"]

    if source.entity_mode in {"events", "programs"} and "classes" in source.goals and source.active_programs == 0 and source.recent_programs_30d == 0:
        fails.append("classes")
        reasons.append("classes/programs goal is declared but no active program output is present")
        score += FAIL_WEIGHT["classes"]

    if source.entity_mode == "events" and "exhibits" in source.goals and source.future_exhibitions == 0 and source.recent_exhibitions_30d == 0:
        fails.append("exhibits")
        reasons.append("exhibits goal is declared but no exhibition output is present")
        score += FAIL_WEIGHT["exhibits"]

    if source.primary_venue_id is not None and source.entity_mode in {"events", "programs", "destination"} and "specials" in source.goals and source.active_specials == 0:
        fails.append("specials")
        reasons.append("specials goal is declared but place_specials is empty")
        score += FAIL_WEIGHT["specials"]

    if source.primary_venue_id is not None and source.entity_mode in {"events", "programs", "destination"} and "venue_hours" in source.goals and not source.has_hours:
        fails.append("venue_hours")
        reasons.append("venue_hours goal is declared but the primary venue has no hours")
        score += FAIL_WEIGHT["venue_hours"]

    if source.primary_venue_id is not None and source.entity_mode in {"events", "programs", "destination"} and "images" in source.goals and not source.has_image:
        fails.append("images")
        reasons.append("images goal is declared but the primary venue has no image")
        score += FAIL_WEIGHT["images"]

    if source.primary_venue_id is not None and not source.has_description:
        warns.append("description")
        reasons.append("primary venue is missing a description")
        score += WARN_WEIGHT["description"]

    if "planning" in source.goals and not source.has_planning:
        warns.append("planning")
        reasons.append("planning goal is declared but planning notes are missing")
        score += WARN_WEIGHT["planning"]

    source.failing_checks = fails
    source.warning_checks = warns
    source.reasons = reasons
    source.priority_score = score + min(source.future_events, 100) + min(source.active_programs, 40)
    if fails:
        source.status = "fail"
    elif warns:
        source.status = "warn"
    else:
        source.status = "pass"
        source.priority_score = 0
    return source


def detect_entity_mode(
    slug: str,
    *,
    future_events: int,
    recent_events_30d: int,
    active_programs: int,
    recent_programs_30d: int,
    future_exhibitions: int,
    recent_exhibitions_30d: int,
    open_open_calls: int,
    recent_open_calls_30d: int,
    goals: list[str],
) -> str:
    lowered_slug = (slug or "").lower()
    if lowered_slug.startswith("open-calls-") or open_open_calls > 0 or recent_open_calls_30d > 0:
        return "open_calls"
    if lowered_slug.startswith("exhibitions-") or future_exhibitions > 0 or recent_exhibitions_30d > 0:
        return "exhibitions"
    if "classes" in goals and (active_programs > 0 or recent_programs_30d > 0) and future_events == 0 and recent_events_30d == 0:
        return "programs"
    if goals and set(goals).issubset(DESTINATION_INTELLIGENCE_GOALS):
        return "destination"
    return "events"


def _resolve_primary_venue(
    *,
    source_slug: str,
    source_name: str,
    venue_counts: Optional[Counter[int]],
    venues: dict[int, dict[str, Any]],
    venues_by_slug: dict[str, dict[str, Any]],
    venues_by_name: dict[str, dict[str, Any]],
) -> tuple[Optional[int], Optional[dict[str, Any]]]:
    if venue_counts:
        primary_venue_id = venue_counts.most_common(1)[0][0]
        return primary_venue_id, venues.get(primary_venue_id)

    venue = venues_by_slug.get(str(source_slug or "").strip())
    if venue:
        venue_id = venue.get("id")
        if venue_id is None:
            return None, venue
        return int(venue_id), venue

    venue = venues_by_name.get(_normalize_name(source_name))
    if not venue:
        return None, None

    venue_id = venue.get("id")
    if venue_id is None:
        return None, venue
    return int(venue_id), venue


def build_report(include_inactive: bool = False, portal_slug: Optional[str] = None) -> dict[str, Any]:
    client = get_client()
    sources = _fetch_sources(client, include_inactive=include_inactive)
    portals = _fetch_portal_map(client)
    venues = _fetch_venues(client)
    venues_by_slug = _venues_by_slug(venues)
    venues_by_name = _unique_venues_by_name(venues)
    specials_by_venue = _fetch_special_counts(client)
    source_ids = [int(row["id"]) for row in sources if row.get("id") is not None]

    event_future_rows, event_recent_rows = _fetch_events(client, source_ids)
    program_future_rows, program_recent_rows = _fetch_programs(client, source_ids)
    exhibition_future_rows, exhibition_recent_rows = _fetch_exhibitions(client, source_ids)
    open_call_future_rows, open_call_recent_rows = _fetch_open_calls(client, source_ids)

    future_events = _source_counts(event_future_rows)
    recent_events = _source_counts(event_recent_rows)
    active_programs = _source_counts(program_future_rows)
    recent_programs = _source_counts(program_recent_rows)
    future_exhibitions = _source_counts(exhibition_future_rows)
    recent_exhibitions = _source_counts(exhibition_recent_rows)
    open_open_calls = _source_counts(open_call_future_rows)
    recent_open_calls = _source_counts(open_call_recent_rows)
    latest_crawl_logs = _fetch_latest_crawl_logs(client, source_ids)
    primary_venues = _source_venue_counts(
        event_future_rows,
        event_recent_rows,
        program_future_rows,
        program_recent_rows,
        exhibition_future_rows,
        exhibition_recent_rows,
        open_call_future_rows,
        open_call_recent_rows,
    )

    reviews: list[SourceGate] = []
    now = datetime.now(timezone.utc)
    for row in sources:
        source_id = int(row["id"])
        portal = portals.get(row.get("owner_portal_id"), "unknown")
        if portal_slug and portal != portal_slug:
            continue

        goals, goal_mode = resolve_source_data_goals(
            str(row.get("slug") or ""),
            source_name=str(row.get("name") or ""),
        )
        primary_venue_id = None
        primary_venue_name = None
        venue_type = None
        has_hours = False
        has_description = False
        has_image = False
        has_planning = False
        active_specials = 0

        venue_counts = primary_venues.get(source_id)
        primary_venue_id, venue = _resolve_primary_venue(
            source_slug=str(row.get("slug") or ""),
            source_name=str(row.get("name") or ""),
            venue_counts=venue_counts,
            venues=venues,
            venues_by_slug=venues_by_slug,
            venues_by_name=venues_by_name,
        )
        if venue:
            primary_venue_name = venue.get("name")
            venue_type = venue.get("place_type")
            has_hours = has_usable_hours(venue.get("hours"))
            has_description = bool((venue.get("description") or "").strip())
            has_image = bool((venue.get("image_url") or "").strip())
            has_planning = bool((venue.get("planning_notes") or "").strip())
            active_specials = int(specials_by_venue.get(primary_venue_id, 0))

        latest_crawl_status, last_crawl_logged_at = latest_crawl_logs.get(source_id, (None, None))

        review = SourceGate(
            id=source_id,
            slug=str(row.get("slug") or ""),
            name=str(row.get("name") or row.get("slug") or ""),
            portal_slug=portal,
            is_active=bool(row.get("is_active")),
            integration_method=str(row.get("integration_method") or "unknown").strip().lower(),
            last_crawled_at=row.get("last_crawled_at"),
            last_crawl_status=latest_crawl_status,
            last_crawl_logged_at=last_crawl_logged_at,
            health_tags=list(row.get("health_tags") or []),
            goals=goals,
            goal_mode=goal_mode,
            entity_mode=detect_entity_mode(
                str(row.get("slug") or ""),
                future_events=int(future_events.get(source_id, 0)),
                recent_events_30d=int(recent_events.get(source_id, 0)),
                active_programs=int(active_programs.get(source_id, 0)),
                recent_programs_30d=int(recent_programs.get(source_id, 0)),
                future_exhibitions=int(future_exhibitions.get(source_id, 0)),
                recent_exhibitions_30d=int(recent_exhibitions.get(source_id, 0)),
                open_open_calls=int(open_open_calls.get(source_id, 0)),
                recent_open_calls_30d=int(recent_open_calls.get(source_id, 0)),
                goals=goals,
            ),
            primary_venue_id=primary_venue_id,
            primary_venue_name=primary_venue_name,
            venue_type=venue_type,
            future_events=int(future_events.get(source_id, 0)),
            recent_events_30d=int(recent_events.get(source_id, 0)),
            active_programs=int(active_programs.get(source_id, 0)),
            recent_programs_30d=int(recent_programs.get(source_id, 0)),
            future_exhibitions=int(future_exhibitions.get(source_id, 0)),
            recent_exhibitions_30d=int(recent_exhibitions.get(source_id, 0)),
            open_open_calls=int(open_open_calls.get(source_id, 0)),
            recent_open_calls_30d=int(recent_open_calls.get(source_id, 0)),
            active_specials=active_specials,
            has_hours=has_hours,
            has_description=has_description,
            has_image=has_image,
            has_planning=has_planning,
        )
        reviews.append(evaluate_gate(review, now=now))

    status_counts = Counter(review.status for review in reviews)
    fail_checks = Counter(check for review in reviews for check in review.failing_checks)
    warn_checks = Counter(check for review in reviews for check in review.warning_checks)

    grouped = {
        status: sorted(
            [asdict(review) for review in reviews if review.status == status],
            key=lambda row: (-row["priority_score"], row["portal_slug"], row["slug"]),
        )
        for status in ("fail", "warn", "pass")
    }

    return {
        "generated_at": now.isoformat(),
        "scope": {
            "include_inactive": include_inactive,
            "portal_slug": portal_slug or "all",
        },
        "summary": {
            "sources_reviewed": len(reviews),
            "status_counts": dict(sorted(status_counts.items())),
            "fail_checks": dict(fail_checks.most_common()),
            "warn_checks": dict(warn_checks.most_common()),
        },
        "sources": [asdict(review) for review in reviews],
        "statuses": grouped,
    }


def render_markdown(report: dict[str, Any], limit: int = 25) -> str:
    summary = report["summary"]
    scope = report["scope"]
    statuses = report["statuses"]

    lines = [
        f"# Source Activation Gate - {report['generated_at'][:10]}",
        "",
        f"Scope: portal={scope['portal_slug']}, include_inactive={scope['include_inactive']}",
        "",
        "## Summary",
        "",
        f"- Sources reviewed: {summary['sources_reviewed']}",
        f"- Status counts: {', '.join(f'{key}={value}' for key, value in summary['status_counts'].items()) or 'none'}",
        "",
        "## Top Failing Checks",
        "",
    ]

    if summary["fail_checks"]:
        lines.extend(["| Check | Count |", "| --- | ---: |"])
        for check, count in summary["fail_checks"].items():
            lines.append(f"| {check} | {count} |")
    else:
        lines.append("_None_")

    if summary["warn_checks"]:
        lines.extend(["", "## Warning Checks", "", "| Check | Count |", "| --- | ---: |"])
        for check, count in summary["warn_checks"].items():
            lines.append(f"| {check} | {count} |")

    def add_section(title: str, key: str) -> None:
        rows = statuses.get(key) or []
        lines.extend(["", f"## {title}", ""])
        if not rows:
            lines.append("_None_")
            return
        lines.extend(
            [
                "| Portal | Slug | Goals | Venue | Future Events | Programs | Exhibitions | Specials | Hours | Image | Why |",
                "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |",
            ]
        )
        for row in rows[:limit]:
            goals = ", ".join(row.get("goals") or []) or "-"
            venue = row.get("primary_venue_name") or "-"
            why = "; ".join(row.get("reasons") or []) or "-"
            lines.append(
                f"| {row['portal_slug']} | {row['slug']} | {goals} | {venue} | "
                f"{row['future_events']} | {row['active_programs']} | {row['future_exhibitions']} | {row['active_specials']} | "
                f"{'yes' if row['has_hours'] else 'no'} | {'yes' if row['has_image'] else 'no'} | {why} |"
            )
        if len(rows) > limit:
            lines.extend(["", f"_Showing {limit} of {len(rows)} rows._"])

    add_section("Failing Sources", "fail")
    add_section("Warning Sources", "warn")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate activation-gate report for crawler sources")
    parser.add_argument("--include-inactive", action="store_true", help="Include inactive sources")
    parser.add_argument("--portal", help="Limit review to a single portal slug")
    parser.add_argument("--output", help="Markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    parser.add_argument("--limit", type=int, default=25, help="Rows per markdown table")
    args = parser.parse_args()

    report = build_report(include_inactive=args.include_inactive, portal_slug=args.portal)
    markdown = render_markdown(report, limit=max(1, args.limit))

    output_path = Path(args.output) if args.output else DEFAULT_REPORT_DIR / f"source_activation_gate_{date.today().isoformat()}.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote markdown report: {output_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {json_path}")

    print(
        "Status counts:",
        ", ".join(f"{key}={value}" for key, value in sorted(report["summary"]["status_counts"].items())) or "none",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
