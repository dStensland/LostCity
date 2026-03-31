#!/usr/bin/env python3
"""
Generate a weekly source review artifact from the live sources inventory.

The report classifies sources into action queues aligned to CRAWLER_STRATEGY.md:
- connector
- rehab
- graduate-from-llm
- ignore

It combines database runtime signals (health tags, future yield, recent inserts,
last crawl time) with profile metadata (integration method, data goals, vendor
family hints) and emits a markdown report suitable for weekly ops review.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from pipeline.loader import find_profile_path
from source_goals import resolve_source_data_goals, source_has_event_feed_goal, source_is_destination_only


PLATFORM_PATTERNS: list[tuple[str, str, tuple[str, ...], str]] = [
    ("rec1", "Rec1 / CivicRec", ("rec1.com", "civicrec"), "platform"),
    ("iclasspro", "iClassPro", ("iclasspro",), "platform"),
    ("tribe_events", "Tribe Events", ("wp-json/tribe/events", "tribe events", "?ical=1"), "platform"),
    ("localist", "Localist", ("localist", "/api/2/events"), "platform"),
    ("wix_bookings", "Wix Bookings", ("wix bookings", "bookings widget", "wix.com"), "platform"),
    ("mobilize", "Mobilize", ("mobilize", "api.mobilize.us"), "platform"),
    ("volunteerhub", "VolunteerHub", ("volunteerhub",), "platform"),
    ("blackthorn", "Blackthorn", ("blackthorn", "events.blackthorn.io"), "platform"),
    ("ovationtix", "OvationTix", ("ovationtix", "trs/api/rest"), "platform"),
    ("eventscalendar_co", "Eventscalendar.co", ("eventscalendar.co", "broker.eventscalendar.co"), "platform"),
    ("bibliocommons", "BiblioCommons", ("bibliocommons",), "platform"),
    ("libcal", "LibCal", ("libcal", "ical_subscribe"), "platform"),
    ("mindbody", "Mindbody", ("mindbody", "mindbodyonline"), "platform"),
    ("fareharbor", "FareHarbor", ("fareharbor",), "platform"),
    ("amilia", "Amilia", ("amilia",), "platform"),
    ("nextjs_hydration", "Next.js hydration", ("__next_data__", "next.js"), "pattern"),
    ("graphql_app", "GraphQL app", ("/graphql", "graphql"), "pattern"),
]

BAD_HEALTH_TAG_HINTS = {
    "timeout",
    "dns-error",
    "ssl-error",
    "parse-error",
    "no-events",
    "instagram-only",
    "facebook-events",
}
CONNECTOR_REVIEW_METHODS = {
    "beautifulsoup",
    "crawler",
    "html",
    "llm_crawler",
    "llm_extraction",
    "playwright",
    "playwright_crawler",
    "requests",
}
CONNECTOR_LIKE_METHODS = {"api", "feed", "python", "python_crawler"}
DEFAULT_REPORT_DIR = ROOT / "reports"


@dataclass
class SourceReview:
    id: int
    slug: str
    name: str
    url: Optional[str]
    source_type: Optional[str]
    is_active: bool
    integration_method: str
    expected_event_count: Optional[int]
    last_crawled_at: Optional[str]
    owner_portal_id: Optional[str]
    portal_slug: str
    health_tags: list[str] = field(default_factory=list)
    future_items: int = 0
    recent_inserts_30d: int = 0
    profile_path: Optional[str] = None
    profile_method: Optional[str] = None
    data_goals: list[str] = field(default_factory=list)
    goal_mode: str = "inferred"
    event_feed_goal: bool = False
    destination_only: bool = False
    entity_lane: str = "events"
    platform_family: Optional[str] = None
    platform_label: Optional[str] = None
    platform_kind: Optional[str] = None
    host_group: Optional[str] = None
    action: str = "ignore"
    reasons: list[str] = field(default_factory=list)
    ignore_reason: Optional[str] = None
    priority_score: int = 0


@dataclass
class FamilyRollup:
    family: str
    label: str
    kind: str
    source_count: int
    active_count: int
    methods: dict[str, int]
    llm_count: int
    example_slugs: list[str]
    recommendation: str


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


def _load_profile_text(slug: str) -> tuple[Optional[Path], str, Optional[str]]:
    path = find_profile_path(slug)
    if not path:
        return None, "", None
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return path, "", None

    profile_method = None
    lower = text.lower()
    for line in lower.splitlines():
        stripped = line.strip()
        if stripped.startswith("integration_method:"):
            profile_method = stripped.split(":", 1)[1].strip().strip("'\"")
            break
        if '"integration_method"' in stripped and ":" in stripped:
            try:
                profile_method = json.loads("{" + stripped.rstrip(",") + "}").get("integration_method")
                break
            except Exception:
                continue
    return path, text, profile_method


def _host_group(*urls: Optional[str]) -> Optional[str]:
    for raw in urls:
        value = (raw or "").strip()
        if not value:
            continue
        if not value.startswith("http"):
            value = f"https://{value}"
        try:
            host = urlparse(value).netloc.lower().lstrip("www.")
        except Exception:
            continue
        if host:
            return host
    return None


def detect_platform_family(
    slug: str,
    name: str,
    source_url: Optional[str],
    profile_text: str,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    combined = " ".join(
        part
        for part in (
            (slug or "").lower(),
            (name or "").lower(),
            (source_url or "").lower(),
            (profile_text or "").lower(),
        )
        if part
    )
    for family, label, markers, kind in PLATFORM_PATTERNS:
        if any(marker in combined for marker in markers):
            return family, label, kind
    return None, None, None


def detect_entity_lane(slug: str, source_type: Optional[str], goals: list[str]) -> str:
    lowered_slug = (slug or "").lower()
    lowered_type = (source_type or "").lower()
    goal_set = set(goals or [])

    if lowered_slug.startswith("open-calls-") or "open_call" in lowered_type or "open_calls" in lowered_type:
        return "open_calls"
    if lowered_slug.startswith("exhibitions-"):
        return "exhibitions"
    if "exhibits" in goal_set and not bool(goal_set & {"events", "classes", "showtimes", "lineup"}):
        return "exhibitions"
    return "events"


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def stale_days(value: Optional[str], now: datetime) -> Optional[int]:
    parsed = parse_iso_datetime(value)
    if parsed is None:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int((now - parsed.astimezone(timezone.utc)).total_seconds() // 86400)


def _is_deactivated(tags: list[str]) -> bool:
    return any(tag.startswith("deactivated:") for tag in tags)


def _problem_tags(tags: list[str]) -> list[str]:
    found = []
    for tag in tags:
        for hint in BAD_HEALTH_TAG_HINTS:
            if hint in tag:
                found.append(tag)
                break
    return found


def _connector_candidate_families(sources: list[SourceReview]) -> dict[str, FamilyRollup]:
    grouped: dict[str, list[SourceReview]] = defaultdict(list)
    for source in sources:
        if source.platform_kind == "platform" and source.platform_family:
            grouped[source.platform_family].append(source)

    candidates: dict[str, FamilyRollup] = {}
    for family, members in grouped.items():
        active_members = [member for member in members if member.is_active]
        methods = Counter(member.integration_method for member in members)
        reviewable = [member for member in active_members if member.integration_method in CONNECTOR_REVIEW_METHODS]
        llm_count = sum(1 for member in active_members if member.integration_method == "llm_crawler")
        qualifies = len(active_members) >= 3 or (len(active_members) >= 2 and llm_count >= 1)
        if not qualifies or not reviewable:
            continue
        label = members[0].platform_label or family
        candidates[family] = FamilyRollup(
            family=family,
            label=label,
            kind=members[0].platform_kind or "platform",
            source_count=len(members),
            active_count=len(active_members),
            methods=dict(sorted(methods.items())),
            llm_count=llm_count,
            example_slugs=[member.slug for member in reviewable[:6]],
            recommendation="Promote/extend a shared connector before adding more bespoke crawlers.",
        )
    return candidates


def classify_source(
    source: SourceReview,
    *,
    connector_candidates: dict[str, FamilyRollup],
    now: datetime,
) -> SourceReview:
    reasons: list[str] = []

    if not source.is_active:
        source.action = "ignore"
        source.ignore_reason = "inactive"
        source.priority_score = 0
        return source

    if _is_deactivated(source.health_tags):
        source.action = "ignore"
        source.ignore_reason = "deactivated"
        source.priority_score = 0
        return source

    tag_issues = _problem_tags(source.health_tags)
    age_days = stale_days(source.last_crawled_at, now)
    lane_bears_feed = source.entity_lane in {"events", "exhibitions", "open_calls"}
    low_yield = lane_bears_feed and source.future_items < max(1, min(5, (source.expected_event_count or 0) // 2))
    zero_yield = lane_bears_feed and source.future_items == 0
    stale = age_days is None or age_days > 14

    if source.integration_method == "llm_crawler":
        reasons.append("primary integration still uses llm_crawler")
        if source.platform_family and source.platform_family in connector_candidates:
            reasons.append(f"family {source.platform_label} has multiple active sources")
        if source.future_items > 0:
            reasons.append(f"{source.future_items} future items make this worth graduating")
        elif source.recent_inserts_30d > 0:
            reasons.append(f"{source.recent_inserts_30d} recent inserts show live signal")
        source.action = "graduate-from-llm"
        source.reasons = reasons
        source.priority_score = 300 + min(source.future_items, 200) + min(source.recent_inserts_30d, 50)
        return source

    if tag_issues:
        reasons.append(f"health tags: {', '.join(tag_issues[:3])}")
    if zero_yield and not source.destination_only:
        reasons.append(f"active {source.entity_lane.replace('_', ' ')} source has zero future items")
    elif low_yield and source.recent_inserts_30d > 0 and not source.destination_only:
        reasons.append(f"{source.entity_lane.replace('_', ' ')} yield is low relative to expected volume")
    if stale:
        reasons.append("source appears stale or uncrawled in the last 14 days")

    if reasons:
        source.action = "rehab"
        source.reasons = reasons
        score = 180 + min(source.future_items, 150) + min(source.recent_inserts_30d, 40)
        if tag_issues:
            score += 25
        if zero_yield:
            score += 15
        if stale:
            score += 10
        source.priority_score = score
        return source

    if (
        source.platform_family
        and source.platform_family in connector_candidates
        and source.integration_method in CONNECTOR_REVIEW_METHODS
    ):
        source.action = "connector"
        source.reasons = [f"belongs to repeated platform family {source.platform_label}"]
        source.priority_score = 220 + min(source.future_items, 100) + min(source.recent_inserts_30d, 30)
        return source

    source.action = "ignore"
    if source.destination_only:
        source.ignore_reason = "destination-only"
    elif source.integration_method in CONNECTOR_LIKE_METHODS:
        source.ignore_reason = "already-connector-like"
    else:
        source.ignore_reason = "healthy"
    source.priority_score = 0
    return source


def _fetch_sources(client: Any, include_inactive: bool) -> list[dict]:
    def builder(query: Any) -> Any:
        if include_inactive:
            return query
        return query.eq("is_active", True)

    return paged_select(
        client,
        "sources",
        "id,slug,name,url,source_type,is_active,owner_portal_id,"
        "integration_method,expected_event_count,health_tags,last_crawled_at",
        query_builder=builder,
    )


def _fetch_portal_map(client: Any) -> dict[str, str]:
    rows = paged_select(client, "portals", "id,slug", order_column="slug")
    return {row["id"]: row.get("slug") or "unknown" for row in rows if row.get("id")}


def _fetch_event_counts(client: Any, source_ids: list[int]) -> tuple[dict[int, int], dict[int, int]]:
    if not source_ids:
        return {}, {}

    today = date.today().isoformat()
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    future_rows = paged_select(
        client,
        "events",
        "source_id",
        query_builder=lambda q: q.in_("source_id", source_ids).eq("is_active", True).gte("start_date", today),
        order_column="source_id",
    )
    recent_rows = paged_select(
        client,
        "events",
        "source_id",
        query_builder=lambda q: q.in_("source_id", source_ids).gte("created_at", recent_cutoff),
        order_column="source_id",
    )

    future_counts = Counter(row.get("source_id") for row in future_rows if row.get("source_id"))
    recent_counts = Counter(row.get("source_id") for row in recent_rows if row.get("source_id"))
    return dict(future_counts), dict(recent_counts)


def _fetch_exhibition_counts(client: Any, source_ids: list[int]) -> tuple[dict[int, int], dict[int, int]]:
    if not source_ids:
        return {}, {}

    today = date.today().isoformat()
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    future_rows = paged_select(
        client,
        "exhibitions",
        "source_id",
        query_builder=lambda q: q.in_("source_id", source_ids).eq("is_active", True).or_(f"closing_date.gte.{today},closing_date.is.null"),
        order_column="source_id",
    )
    recent_rows = paged_select(
        client,
        "exhibitions",
        "source_id",
        query_builder=lambda q: q.in_("source_id", source_ids).gte("created_at", recent_cutoff),
        order_column="source_id",
    )

    future_counts = Counter(row.get("source_id") for row in future_rows if row.get("source_id"))
    recent_counts = Counter(row.get("source_id") for row in recent_rows if row.get("source_id"))
    return dict(future_counts), dict(recent_counts)


def _fetch_open_call_counts(client: Any, source_ids: list[int]) -> tuple[dict[int, int], dict[int, int]]:
    if not source_ids:
        return {}, {}

    today = date.today().isoformat()
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    future_rows = paged_select(
        client,
        "open_calls",
        "source_id",
        query_builder=lambda q: q.in_("source_id", source_ids).eq("is_active", True).eq("status", "open").or_(f"deadline.gte.{today},deadline.is.null"),
        order_column="source_id",
    )
    recent_rows = paged_select(
        client,
        "open_calls",
        "source_id",
        query_builder=lambda q: q.in_("source_id", source_ids).gte("created_at", recent_cutoff),
        order_column="source_id",
    )

    future_counts = Counter(row.get("source_id") for row in future_rows if row.get("source_id"))
    recent_counts = Counter(row.get("source_id") for row in recent_rows if row.get("source_id"))
    return dict(future_counts), dict(recent_counts)


def build_review(include_inactive: bool = False, portal_slug: Optional[str] = None) -> dict[str, Any]:
    client = get_client()
    portal_map = _fetch_portal_map(client)
    source_rows = _fetch_sources(client, include_inactive=include_inactive)

    reviews: list[SourceReview] = []
    source_ids = [row["id"] for row in source_rows if row.get("id")]
    event_future_counts, event_recent_counts = _fetch_event_counts(client, source_ids)
    exhibition_future_counts, exhibition_recent_counts = _fetch_exhibition_counts(client, source_ids)
    open_call_future_counts, open_call_recent_counts = _fetch_open_call_counts(client, source_ids)
    now = datetime.now(timezone.utc)

    for row in source_rows:
        slug = row.get("slug") or ""
        profile_path, profile_text, profile_method = _load_profile_text(slug)
        portal = portal_map.get(row.get("owner_portal_id"), "unknown")
        if portal_slug and portal != portal_slug:
            continue

        goals, goal_mode = resolve_source_data_goals(slug, source_name=row.get("name") or "")
        entity_lane = detect_entity_lane(slug, row.get("source_type"), goals)
        family, family_label, family_kind = detect_platform_family(
            slug=slug,
            name=row.get("name") or "",
            source_url=row.get("url"),
            profile_text=profile_text,
        )

        if entity_lane == "open_calls":
            future_items = open_call_future_counts.get(row["id"], 0)
            recent_inserts = open_call_recent_counts.get(row["id"], 0)
        elif entity_lane == "exhibitions":
            future_items = exhibition_future_counts.get(row["id"], 0)
            recent_inserts = exhibition_recent_counts.get(row["id"], 0)
        else:
            future_items = event_future_counts.get(row["id"], 0)
            recent_inserts = event_recent_counts.get(row["id"], 0)

        reviews.append(
            SourceReview(
                id=row["id"],
                slug=slug,
                name=row.get("name") or slug,
                url=row.get("url"),
                source_type=row.get("source_type"),
                is_active=bool(row.get("is_active")),
                integration_method=(row.get("integration_method") or profile_method or "unknown").strip().lower(),
                expected_event_count=row.get("expected_event_count"),
                last_crawled_at=row.get("last_crawled_at"),
                owner_portal_id=row.get("owner_portal_id"),
                portal_slug=portal,
                health_tags=list(row.get("health_tags") or []),
                future_items=future_items,
                recent_inserts_30d=recent_inserts,
                profile_path=str(profile_path) if profile_path else None,
                profile_method=profile_method,
                data_goals=goals,
                goal_mode=goal_mode,
                event_feed_goal=source_has_event_feed_goal(goals),
                destination_only=source_is_destination_only(goals),
                entity_lane=entity_lane,
                platform_family=family,
                platform_label=family_label,
                platform_kind=family_kind,
                host_group=_host_group(row.get("url")),
            )
        )

    connector_candidates = _connector_candidate_families(reviews)
    for review in reviews:
        classify_source(review, connector_candidates=connector_candidates, now=now)

    method_counts = Counter(review.integration_method for review in reviews)
    action_counts = Counter(review.action for review in reviews)
    ignore_counts = Counter(review.ignore_reason or "unknown" for review in reviews if review.action == "ignore")

    platform_counts = Counter(
        review.platform_label or review.platform_family
        for review in reviews
        if review.platform_kind == "platform" and review.platform_family
    )
    host_counts = Counter(review.host_group for review in reviews if review.host_group)

    action_lists = {
        action: sorted(
            [review for review in reviews if review.action == action],
            key=lambda item: (
                -item.priority_score,
                item.portal_slug,
                item.slug,
            ),
        )
        for action in ("connector", "rehab", "graduate-from-llm", "ignore")
    }

    return {
        "generated_at": now.isoformat(),
        "scope": {
            "include_inactive": include_inactive,
            "portal_slug": portal_slug or "all",
        },
        "summary": {
            "sources_reviewed": len(reviews),
            "active_sources": sum(1 for review in reviews if review.is_active),
            "event_feed_sources": sum(1 for review in reviews if review.event_feed_goal),
            "destination_only_sources": sum(1 for review in reviews if review.destination_only),
            "method_counts": dict(sorted(method_counts.items())),
            "action_counts": dict(sorted(action_counts.items())),
            "ignore_counts": dict(sorted(ignore_counts.items())),
            "platform_counts": dict(platform_counts.most_common(12)),
            "top_host_counts": dict(host_counts.most_common(12)),
        },
        "connector_families": [asdict(item) for item in sorted(connector_candidates.values(), key=lambda item: (-item.active_count, item.family))],
        "sources": [asdict(review) for review in reviews],
        "actions": {key: [asdict(review) for review in value] for key, value in action_lists.items()},
    }


def render_markdown(review: dict[str, Any], limit: int = 25) -> str:
    generated = review["generated_at"]
    summary = review["summary"]
    scope = review["scope"]
    connector_families = review["connector_families"]
    actions = review["actions"]

    lines = [
        f"# Weekly Source Review - {generated[:10]}",
        "",
        f"Scope: portal={scope['portal_slug']}, include_inactive={scope['include_inactive']}",
        "",
        "## Summary",
        "",
        f"- Sources reviewed: {summary['sources_reviewed']}",
        f"- Active sources: {summary['active_sources']}",
        f"- Event-feed sources: {summary['event_feed_sources']}",
        f"- Destination-only sources: {summary['destination_only_sources']}",
        f"- Action counts: {', '.join(f'{key}={value}' for key, value in summary['action_counts'].items()) or 'none'}",
        "",
        "## Entity Lanes",
        "",
        f"- Events lane: {sum(1 for row in review['sources'] if row['entity_lane'] == 'events')}",
        f"- Exhibitions lane: {sum(1 for row in review['sources'] if row['entity_lane'] == 'exhibitions')}",
        f"- Open calls lane: {sum(1 for row in review['sources'] if row['entity_lane'] == 'open_calls')}",
        "",
        "## Top Priorities This Week",
        "",
    ]

    top_priority_rows = sorted(
        [row for rows in actions.values() for row in rows if row.get("action") != "ignore"],
        key=lambda row: (-row.get("priority_score", 0), row.get("slug", "")),
    )[:10]
    if top_priority_rows:
        lines.extend(
            [
                "| Action | Slug | Lane | Score | Future | Recent 30d | Why |",
                "| --- | --- | --- | ---: | ---: | ---: | --- |",
            ]
        )
        for row in top_priority_rows:
            why = "; ".join(row.get("reasons") or []) or "-"
            lines.append(
                f"| {row['action']} | {row['slug']} | {row['entity_lane']} | {row.get('priority_score', 0)} | "
                f"{row['future_items']} | {row['recent_inserts_30d']} | {why} |"
            )
    else:
        lines.append("_No action items._")

    lines.extend(["", "## Method Mix", "", "| Method | Count |", "| --- | ---: |"])
    for method, count in summary["method_counts"].items():
        lines.append(f"| {method} | {count} |")

    if connector_families:
        lines.extend(
            [
                "",
                "## Connector Candidates",
                "",
                "| Family | Active | Methods | Example Slugs | Recommendation |",
                "| --- | ---: | --- | --- | --- |",
            ]
        )
        for family in connector_families[:limit]:
            methods = ", ".join(f"{key}:{value}" for key, value in family["methods"].items())
            examples = ", ".join(family["example_slugs"])
            lines.append(
                f"| {family['label']} | {family['active_count']} | {methods} | {examples} | {family['recommendation']} |"
            )

    def add_source_section(title: str, key: str) -> None:
        rows = actions.get(key) or []
        lines.extend(["", f"## {title}", ""])
        if not rows:
            lines.append("_None_")
            return
        lines.extend(
            [
                "| Portal | Slug | Method | Family | Future | Recent 30d | Reasons |",
                "| --- | --- | --- | --- | ---: | ---: | --- |",
            ]
        )
        for row in rows[:limit]:
            family = row.get("platform_label") or row.get("host_group") or "-"
            reasons = "; ".join(row.get("reasons") or []) or (row.get("ignore_reason") or "-")
            lines.append(
                f"| {row['portal_slug']} | {row['slug']} ({row['entity_lane']}) | {row['integration_method']} | {family} | "
                f"{row['future_items']} | {row['recent_inserts_30d']} | {reasons} |"
            )
        if len(rows) > limit:
            lines.append("")
            lines.append(f"_Showing {limit} of {len(rows)} rows._")

    add_source_section("Graduate From LLM", "graduate-from-llm")
    add_source_section("Rehab Queue", "rehab")
    add_source_section("Ignore Summary", "ignore")

    if summary["ignore_counts"]:
        lines.extend(["", "### Ignore Breakdown", "", "| Reason | Count |", "| --- | ---: |"])
        for reason, count in summary["ignore_counts"].items():
            lines.append(f"| {reason} | {count} |")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the weekly crawler source review artifact")
    parser.add_argument("--include-inactive", action="store_true", help="Include inactive sources in the review")
    parser.add_argument("--portal", help="Limit review to a single portal slug")
    parser.add_argument("--output", help="Markdown output path (default: crawlers/reports/weekly_source_review_<date>.md)")
    parser.add_argument("--json-output", help="Optional JSON output path")
    parser.add_argument("--limit", type=int, default=25, help="Rows to show per markdown section")
    args = parser.parse_args()

    review = build_review(include_inactive=args.include_inactive, portal_slug=args.portal)
    markdown = render_markdown(review, limit=max(1, args.limit))

    output_path = Path(args.output) if args.output else DEFAULT_REPORT_DIR / f"weekly_source_review_{date.today().isoformat()}.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote markdown report: {output_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(review, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {json_path}")

    action_counts = review["summary"]["action_counts"]
    print(
        "Action counts:",
        ", ".join(f"{key}={value}" for key, value in sorted(action_counts.items())) or "none",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
