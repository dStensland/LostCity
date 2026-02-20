#!/usr/bin/env python3
"""
Audit inactive sources and classify why they are not active.

This makes "no crawler needed" explicit for festival entries that are modeled
through the festival hierarchy (festival -> series[festival_program] -> events).

Usage:
  python scripts/audit_inactive_sources.py
  python scripts/audit_inactive_sources.py --only-no-module
  python scripts/audit_inactive_sources.py --output reports/inactive_sources_audit.csv
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from main import BLOCKED_SOURCE_SLUGS, get_source_modules
from pipeline.loader import find_profile_path

DISCOURAGED_CURATOR_SLUGS = {
    "artsatl-calendar",
    "creative-loafing",
    "access-atlanta",
    "do615",
    "nashville-scene",
    "nashville-com",
    "discover-atlanta",
    "visit-music-city",
    "visit-franklin",
}
DISCOURAGED_SOURCE_TYPES = {
    "aggregator",
    "tourism_board",
}
INTERNAL_NONCRAWLER_TYPES = {
    "manual",
    "user",
    "website",
    "social_media",
}


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _classify_reason(source: dict[str, Any], module_slugs: set[str]) -> tuple[str, str, str]:
    """
    Returns (reason_code, reason_detail, recommended_action).
    """
    slug = source["slug"]
    source_type = (source.get("source_type") or "").lower()
    tags = set(source.get("health_tags") or [])
    module_exists = slug in module_slugs
    profile_exists = find_profile_path(slug) is not None
    expected = source.get("expected_event_count")

    if slug in BLOCKED_SOURCE_SLUGS:
        return (
            "blocked_closed_source",
            "Source is permanently blocked/closed in crawler runtime.",
            "keep_inactive",
        )

    if not module_exists and source_type == "festival":
        return (
            "festival_structure_managed_no_crawler_required",
            "Festival entry is managed by festival hierarchy; no standalone crawler is required.",
            "keep_inactive_structural",
        )

    if not module_exists and source_type in INTERNAL_NONCRAWLER_TYPES:
        return (
            "internal_noncrawler_source",
            "Internal/manual/social source should remain non-crawler.",
            "keep_inactive_internal",
        )

    if not module_exists and profile_exists:
        return (
            "profile_pipeline_ready_no_module_required",
            "No dedicated module, but a profile exists and can run through pipeline fallback.",
            "validate_profile_then_activate",
        )

    if not module_exists:
        return (
            "no_crawler_module_other",
            "No crawler module is registered for this source slug.",
            "triage_build_or_archive",
        )

    if "zero-events-deactivated" in tags:
        return (
            "auto_zero_events_deactivated",
            "Auto-deactivated after repeated zero-event successful crawls.",
            "reactivate_only_after_fix",
        )

    if source_type in DISCOURAGED_SOURCE_TYPES or slug in DISCOURAGED_CURATOR_SLUGS:
        return (
            "strategy_deprioritized_curator",
            "Curator/aggregator source is deprioritized in favor of first-party sources.",
            "keep_inactive_unless_gap",
        )

    if expected is not None and expected == 0:
        return (
            "zero_expected_event_yield",
            "Expected event count has decayed to zero.",
            "reactivate_after_manual_validation",
        )

    if not source.get("owner_portal_id"):
        return (
            "missing_owner_portal_id",
            "owner_portal_id is null; portal isolation policy may block activation.",
            "assign_owner_portal_before_activation",
        )

    if not source.get("last_crawled_at"):
        return (
            "never_crawled_or_onboarding_pending",
            "No crawl history recorded.",
            "validate_then_activate",
        )

    return (
        "manual_or_legacy_inactive",
        "Inactive without a strong automatic signal (likely manual or legacy decision).",
        "manual_review",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit inactive source reasons.")
    parser.add_argument(
        "--only-no-module",
        action="store_true",
        help="Only output inactive sources without crawler modules.",
    )
    parser.add_argument(
        "--output",
        default=f"reports/inactive_sources_audit_{datetime.now().date().isoformat()}.csv",
        help="CSV output path (relative to crawlers/).",
    )
    args = parser.parse_args()

    module_slugs = set(get_source_modules().keys())
    client = get_client()
    rows = (
        client.table("sources")
        .select(
            "id,slug,name,is_active,source_type,integration_method,crawl_frequency,"
            "health_tags,active_months,last_crawled_at,expected_event_count,owner_portal_id,url"
        )
        .eq("is_active", False)
        .execute()
        .data
        or []
    )

    now = datetime.now(timezone.utc)
    results: list[dict[str, Any]] = []
    for source in rows:
        reason_code, reason_detail, action = _classify_reason(source, module_slugs)
        last_dt = _parse_ts(source.get("last_crawled_at"))
        age_days = None
        if last_dt is not None:
            age_days = int((now - last_dt).total_seconds() // 86400)

        row = {
            **source,
            "module_exists": source["slug"] in module_slugs,
            "reason_code": reason_code,
            "reason_detail": reason_detail,
            "recommended_action": action,
            "last_crawled_age_days": age_days,
        }
        results.append(row)

    if args.only_no_module:
        results = [r for r in results if not r["module_exists"]]

    reason_counts = Counter(r["reason_code"] for r in results)
    type_counts = Counter((r.get("source_type") or "null") for r in results)

    print(f"ROWS {len(results)}")
    print("\nREASON_COUNTS")
    for reason, count in reason_counts.most_common():
        print(f"{reason} {count}")

    print("\nSOURCE_TYPE_COUNTS")
    for source_type, count in type_counts.most_common():
        print(f"{source_type} {count}")

    output_path = ROOT / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "id",
        "slug",
        "name",
        "is_active",
        "module_exists",
        "reason_code",
        "reason_detail",
        "recommended_action",
        "source_type",
        "integration_method",
        "crawl_frequency",
        "expected_event_count",
        "health_tags",
        "active_months",
        "last_crawled_at",
        "last_crawled_age_days",
        "owner_portal_id",
        "url",
    ]
    with output_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in sorted(results, key=lambda r: (r["reason_code"], r["slug"])):
            writer.writerow({k: row.get(k) for k in fieldnames})

    print(f"\nCSV {output_path}")


if __name__ == "__main__":
    main()
