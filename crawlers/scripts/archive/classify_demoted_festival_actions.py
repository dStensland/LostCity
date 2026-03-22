#!/usr/bin/env python3
"""
Classify demoted festival-model sources into archive vs rebuild actions.

Targets are sources tagged with festival-model cleanup markers:
- festival-model-cleanup
- not-in-festivals-table
- retyped-from-festival

Usage:
  python scripts/classify_demoted_festival_actions.py --dry-run
  python scripts/classify_demoted_festival_actions.py --apply
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client

BASE_TAGS = {
    "festival-model-cleanup",
    "not-in-festivals-table",
    "retyped-from-festival",
}
ACTION_TAG_REBUILD = "demoted-action-rebuild"
ACTION_TAG_ARCHIVE = "demoted-action-archive"
ACTION_TAG_KEEP_ACTIVE = "demoted-action-keep-active"

REBUILD_SLUGS = {
    "atlanta-apparel-market",
    "atlanta-cocktail-week",
    "atlanta-coin-show",
    "atlanta-home-show",
    "garden-lights-holiday-nights",
    "smyrna-oysterfest",
    "woodstock-summer-concert-series",
}
ARCHIVE_RULES: dict[str, str] = {
    "alliance-collision-project": "covered_by_active_source:alliance-theatre",
    "atlanta-braves-opening-day": "covered_by_active_source:truist-park",
    "atlanta-hawks-home-opener": "oneoff_sports_event",
    "atlanta-restaurant-week": "seasonal_promo_campaign",
    "atlanta-salsa-congress": "superseded_by:atlanta-salsa-bachata-festival",
    "atlanta-united-season-opener": "oneoff_sports_event",
    "atlanta-wine-week": "superseded_by:atlanta-food-wine-festival",
    "beer-bourbon-bbq": "superseded_by:beer-bourbon-bbq-atlanta",
    "braves-country-fest": "covered_by_active_source:truist-park",
    "braves-fest": "covered_by_active_source:truist-park",
    "chick-fil-a-kickoff-game": "oneoff_sports_event",
    "chick-fil-a-peach-bowl": "oneoff_sports_event",
    "collect-a-con-atlanta": "superseded_by:collect-a-con-atlanta-spring/fall",
    "college-football-playoff-natl": "oneoff_sports_event",
    "covington-vampire-diaries": "superseded_by:covington-vampire-diaries-fest",
    "fernbank-after-dark": "covered_by_active_source:fernbank",
    "horizon-new-south-fest": "covered_by_active_source:horizon-theatre",
    "illuminights-zoo": "covered_by_active_source:zoo-atlanta",
    "sec-championship-game": "oneoff_sports_event",
}


def _merge_tags(existing: list[str] | None, add: set[str]) -> list[str]:
    merged = set(existing or [])
    merged.update(add)
    # Keep only one action tag at a time.
    merged -= {ACTION_TAG_REBUILD, ACTION_TAG_ARCHIVE, ACTION_TAG_KEEP_ACTIVE}
    merged.update(add & {ACTION_TAG_REBUILD, ACTION_TAG_ARCHIVE, ACTION_TAG_KEEP_ACTIVE})
    return sorted(merged)


def _classify(slug: str, is_active: bool) -> tuple[str, str]:
    if is_active:
        return "keep-active", "already_active_source"
    if slug in REBUILD_SLUGS:
        return "rebuild", "independent_recurring_target"
    if slug in ARCHIVE_RULES:
        return "archive", ARCHIVE_RULES[slug]
    # Conservative default: archive until explicitly promoted.
    return "archive", "no_explicit_rebuild_signal"


def _action_tags(action: str) -> set[str]:
    if action == "rebuild":
        return {ACTION_TAG_REBUILD, "needs-crawler-evaluation"}
    if action == "keep-active":
        return {ACTION_TAG_KEEP_ACTIVE}
    return {ACTION_TAG_ARCHIVE, "do-not-build-crawler"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify demoted festival source actions")
    parser.add_argument("--apply", action="store_true", help="Write tags to sources table")
    parser.add_argument("--dry-run", action="store_true", help="Print updates only (default)")
    parser.add_argument(
        "--output",
        default=f"reports/demoted_festival_actions_{datetime.now().date().isoformat()}.csv",
        help="CSV output path relative to crawlers/",
    )
    args = parser.parse_args()
    if not args.apply and not args.dry_run:
        args.dry_run = True

    client = get_client()
    rows = (
        client.table("sources")
        .select("id,slug,name,is_active,source_type,health_tags,url")
        .contains("health_tags", ["festival-model-cleanup"])
        .execute()
        .data
        or []
    )
    rows = sorted(rows, key=lambda r: r["slug"])

    output_rows: list[dict[str, Any]] = []
    counts = {"rebuild": 0, "archive": 0, "keep-active": 0}
    updates = 0

    print(f"TARGETS {len(rows)}")
    for row in rows:
        slug = row["slug"]
        action, reason = _classify(slug, bool(row.get("is_active")))
        counts[action] += 1

        tags = _action_tags(action)
        merged_tags = _merge_tags(row.get("health_tags"), tags)
        patch = {"health_tags": merged_tags}
        print(f"[{action}] {slug} -> {reason}")

        if args.apply:
            client.table("sources").update(patch).eq("id", row["id"]).execute()
            updates += 1

        output_rows.append(
            {
                "slug": slug,
                "name": row.get("name"),
                "is_active": row.get("is_active"),
                "action": action,
                "reason": reason,
                "url": row.get("url"),
                "health_tags": merged_tags,
            }
        )

    output_path = ROOT / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["slug", "name", "is_active", "action", "reason", "url", "health_tags"],
        )
        writer.writeheader()
        for row in output_rows:
            writer.writerow(row)

    print(
        "\nSUMMARY "
        f"rebuild={counts['rebuild']} archive={counts['archive']} keep_active={counts['keep-active']} "
        f"updates={updates}"
    )
    print(f"CSV {output_path}")
    if args.dry_run:
        print("Dry run only; no DB writes.")


if __name__ == "__main__":
    main()
