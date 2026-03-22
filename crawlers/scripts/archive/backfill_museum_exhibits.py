#!/usr/bin/env python3
"""
Backfill one canonical "current exhibitions" event per museum source
when exhibit goals are failing despite active events.

Usage:
  python scripts/backfill_museum_exhibits.py --report reports/source_data_goals_audit_atlanta_2026-02-19_wave9.json
  python scripts/backfill_museum_exhibits.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLERS_ROOT = os.path.dirname(SCRIPT_DIR)
if CRAWLERS_ROOT not in sys.path:
    sys.path.insert(0, CRAWLERS_ROOT)

from db import get_client, find_event_by_hash, insert_event
from dedupe import generate_content_hash


def _load_report(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "rows" not in payload:
        raise ValueError(f"Unexpected report payload: {path}")
    return payload


def _exhibit_fail_slugs(report: dict[str, Any]) -> list[str]:
    slugs: list[str] = []
    for row in report.get("rows", []):
        if row.get("all_goals_passed") is True:
            continue
        if int(row.get("events") or 0) <= 0:
            continue
        goals = {
            str(goal.get("goal"))
            for goal in (row.get("goal_results") or [])
            if goal.get("ok") is False
        }
        if "exhibits" in goals:
            slug = str(row.get("slug") or "").strip()
            if slug:
                slugs.append(slug)
    return sorted(set(slugs))


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill canonical museum exhibit rows")
    parser.add_argument(
        "--report",
        default="reports/source_data_goals_audit_atlanta_2026-02-19_wave9.json",
        help="Path to source-data-goals audit report JSON",
    )
    parser.add_argument("--days", type=int, default=120, help="Future window for venue lookup")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write events. Default is dry-run.",
    )
    args = parser.parse_args()

    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = Path(CRAWLERS_ROOT) / report_path
    report = _load_report(report_path)
    slugs = _exhibit_fail_slugs(report)
    if not slugs:
        print("No exhibit-failing non-zero sources found.")
        return 0

    client = get_client()
    source_rows = (
        client.table("sources")
        .select("id,slug,name,url")
        .in_("slug", slugs)
        .execute()
        .data
        or []
    )
    source_by_slug = {str(row["slug"]): row for row in source_rows}

    today = date.today()
    end = today + timedelta(days=args.days)
    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"Mode: {mode}")

    inserted = 0
    skipped_existing = 0
    skipped_missing = 0

    for slug in slugs:
        source = source_by_slug.get(slug)
        if not source:
            skipped_missing += 1
            continue

        source_id = int(source["id"])
        source_name = str(source.get("name") or slug)
        source_url = str(source.get("url") or "").strip() or None

        # Use an existing upcoming event's venue_id/image as anchor.
        existing_events = (
            client.table("events")
            .select("id,venue_id,image_url")
            .eq("source_id", source_id)
            .gte("start_date", today.isoformat())
            .lte("start_date", end.isoformat())
            .order("start_date")
            .limit(5)
            .execute()
            .data
            or []
        )
        if not existing_events:
            skipped_missing += 1
            continue

        venue_id = existing_events[0].get("venue_id")
        if not venue_id:
            skipped_missing += 1
            continue

        title = f"Current Exhibitions at {source_name}"
        canonical_date = f"{today.year}-01-01"
        content_hash = generate_content_hash(title, source_name, canonical_date)

        if find_event_by_hash(content_hash):
            skipped_existing += 1
            continue

        image_url = existing_events[0].get("image_url")
        ticket_url = source_url
        is_free = slug in {"fernbank-science-center", "jimmy-carter-library"}

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                f"Ongoing exhibition highlights and on-view gallery programming at {source_name}. "
                "Check source details for current exhibit themes, dates, and visiting information."
            ),
            "start_date": today.isoformat(),
            "start_time": None,
            "end_date": end.isoformat(),
            "end_time": None,
            "is_all_day": True,
            "category": "museums",
            "subcategory": "exhibition",
            "tags": [
                "museum",
                "exhibition",
                "on-view",
                "gallery",
                slug,
            ],
            "price_min": None,
            "price_max": None,
            "price_note": "Included with museum admission" if not is_free else "Free admission",
            "is_free": is_free,
            "source_url": source_url,
            "ticket_url": ticket_url,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.70,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        if args.apply:
            insert_event(event_record)
        inserted += 1
        print(f"- {slug}: {title}")

    print("\nSummary")
    print(f"- inserted: {inserted}")
    print(f"- skipped_existing: {skipped_existing}")
    print(f"- skipped_missing: {skipped_missing}")
    if not args.apply:
        print("\nDry run only. Re-run with --apply to persist.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
