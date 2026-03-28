#!/usr/bin/env python3
"""
Conservatively reactivate inactive venues that have active future events.

Heuristics (default):
- venue is inactive
- venue is NOT in closed_venues registry
- venue description does NOT contain closure lock language
- venue slug is not a placeholder slug
- venue has at least N visible future events
- venue has at least one active source driving those events
- source slug does not match excluded sensitive patterns
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from closed_venues import CLOSED_VENUE_SLUGS


DEFAULT_PLACEHOLDER_SLUG_RE = re.compile(
    r"^(unknown-venue|null|community-location|atlanta-ga|meetup-space|community)$"
)
DEFAULT_ADDRESSISH_SLUG_RE = re.compile(r"^\d{3,}-")
DEFAULT_EXCLUDED_SOURCE_PATTERNS = (
    re.compile(r"^na-", re.I),
    re.compile(r"^aa-", re.I),
    re.compile(r"al-anon", re.I),
    re.compile(r"recovery", re.I),
    re.compile(r"support[-_]?group", re.I),
)
HARD_CLOSURE_RE = re.compile(
    r"(do not reactivate via crawler|permanently closed|closed for good|out of business)",
    re.I,
)

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


@dataclass
class Candidate:
    venue_id: int
    slug: str
    name: str
    city: str
    visible_future_events: int
    active_source_rows: int
    active_sources_top: list[str]
    skip_reason: str | None = None


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
    return bool(re.search(rf"\b{re.escape(normalized_scope)}\b", normalized_venue))


def paged_select(
    client,
    table: str,
    fields: str,
    *,
    query_builder=None,
    page_size: int = 1000,
    order_column: str = "id",
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        query = client.table(table).select(fields).order(order_column).range(
            offset,
            offset + page_size - 1,
        )
        if query_builder:
            query = query_builder(query)
        batch = query.execute().data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reactivate conservative subset of inactive venues with future events."
    )
    parser.add_argument(
        "--start-date",
        default=date.today().isoformat(),
        help="Future lower bound date (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--city",
        default="Atlanta",
        help="City scope. Default: Atlanta.",
    )
    parser.add_argument(
        "--strict-city",
        action="store_true",
        help="Disable metro expansion for --city Atlanta.",
    )
    parser.add_argument(
        "--min-visible-events",
        type=int,
        default=2,
        help="Minimum visible future events to qualify. Default: 2.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes only.",
    )
    parser.add_argument(
        "--exclude-source-regex",
        action="append",
        default=[],
        help="Additional source slug exclusion regex (can repeat).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute reactivation writes.",
    )
    args = parser.parse_args()

    do_apply = args.apply and not args.dry_run
    if args.apply and args.dry_run:
        print("[WARN] Both --apply and --dry-run set; proceeding as dry-run.")

    excluded_patterns = list(DEFAULT_EXCLUDED_SOURCE_PATTERNS)
    for raw in args.exclude_source_regex:
        excluded_patterns.append(re.compile(raw, re.I))

    client = get_client()

    inactive_venues_all = paged_select(
        client,
        "venues",
        "id,slug,name,city,description,active",
        query_builder=lambda q: q.eq("active", False),
    )
    inactive_venues = [
        row
        for row in inactive_venues_all
        if city_in_scope(
            row.get("city"),
            args.city,
            include_metro=not args.strict_city,
        )
    ]
    venue_by_id = {
        int(row["id"]): row
        for row in inactive_venues
        if row.get("id") is not None
    }
    scoped_venue_ids = set(venue_by_id.keys())

    # Load visible future events once and aggregate on inactive venue IDs.
    future_rows = paged_select(
        client,
        "events",
        "id,venue_id,source_id,start_date,canonical_event_id",
        query_builder=lambda q: q.gte("start_date", args.start_date).is_(
            "canonical_event_id", "null"
        ),
    )
    events_by_venue: dict[int, int] = defaultdict(int)
    source_rows_by_venue: dict[int, Counter[int]] = defaultdict(Counter)
    for row in future_rows:
        venue_id = int(row.get("venue_id") or 0)
        if venue_id not in scoped_venue_ids:
            continue
        events_by_venue[venue_id] += 1
        source_id = int(row.get("source_id") or 0)
        if source_id > 0:
            source_rows_by_venue[venue_id][source_id] += 1

    # Load source activity map for IDs seen in scoped inactive venue rows.
    all_source_ids = sorted(
        {sid for counter in source_rows_by_venue.values() for sid in counter.keys()}
    )
    source_meta: dict[int, tuple[str, bool]] = {}
    for idx in range(0, len(all_source_ids), 400):
        bucket = all_source_ids[idx : idx + 400]
        if not bucket:
            continue
        rows = (
            client.table("sources")
            .select("id,slug,is_active")
            .in_("id", bucket)
            .execute()
            .data
            or []
        )
        for row in rows:
            source_meta[int(row["id"])] = (
                str(row.get("slug") or ""),
                bool(row.get("is_active")),
            )

    candidates: list[Candidate] = []
    skipped: Counter[str] = Counter()

    for venue_id, count in sorted(events_by_venue.items(), key=lambda item: -item[1]):
        venue = venue_by_id[venue_id]
        slug = str(venue.get("slug") or "")
        name = str(venue.get("name") or "")
        city = str(venue.get("city") or "")
        description = str(venue.get("description") or "")

        if count < args.min_visible_events:
            skipped["below_min_visible_events"] += 1
            continue
        if slug in CLOSED_VENUE_SLUGS:
            skipped["closed_registry"] += 1
            continue
        if HARD_CLOSURE_RE.search(description):
            skipped["closure_signal_in_description"] += 1
            continue
        if DEFAULT_PLACEHOLDER_SLUG_RE.match(slug) or DEFAULT_ADDRESSISH_SLUG_RE.match(slug):
            skipped["placeholder_or_address_slug"] += 1
            continue

        source_counter = source_rows_by_venue.get(venue_id, Counter())
        active_source_rows = 0
        active_sources_top: list[str] = []
        has_allowed_active_source = False

        for source_id, row_count in source_counter.most_common(6):
            source_slug, source_active = source_meta.get(source_id, (str(source_id), False))
            if source_active:
                active_source_rows += row_count
            active_sources_top.append(f"{source_slug}(active={source_active}):{row_count}")
            if source_active and not any(p.search(source_slug) for p in excluded_patterns):
                has_allowed_active_source = True

        if not has_allowed_active_source:
            skipped["no_allowed_active_source"] += 1
            continue

        candidates.append(
            Candidate(
                venue_id=venue_id,
                slug=slug,
                name=name,
                city=city,
                visible_future_events=count,
                active_source_rows=active_source_rows,
                active_sources_top=active_sources_top,
            )
        )

    print(
        f"Scoped inactive venues: {len(inactive_venues)} | "
        f"with visible future events: {len(events_by_venue)}"
    )
    print(
        f"Candidates for reactivation: {len(candidates)} "
        f"(visible rows={sum(c.visible_future_events for c in candidates)})"
    )
    if skipped:
        print("Skipped breakdown:")
        for reason, count in skipped.most_common():
            print(f"- {reason}: {count}")

    for candidate in candidates[:120]:
        print(
            f"- venue_id={candidate.venue_id} slug={candidate.slug} "
            f"events={candidate.visible_future_events} city={candidate.city} "
            f"sources={'; '.join(candidate.active_sources_top[:3])}"
        )

    if not do_apply:
        print("Dry run complete (no writes). Use --apply to execute.")
        return

    updated = 0
    for candidate in candidates:
        client.table("places").update({"active": True}).eq("id", candidate.venue_id).execute()
        updated += 1

    print(
        f"Applied updates: venues_reactivated={updated}, "
        f"estimated_visible_rows_recovered={sum(c.visible_future_events for c in candidates)}"
    )


if __name__ == "__main__":
    main()
