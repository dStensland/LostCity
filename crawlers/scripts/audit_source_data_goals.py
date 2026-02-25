#!/usr/bin/env python3
"""
Audit active sources against declared/inferred source data goals.

Usage:
  python scripts/audit_source_data_goals.py --portal atlanta --days 120
  python scripts/audit_source_data_goals.py --portal atlanta --include-unscoped
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from source_goals import resolve_source_data_goals

EXHIBIT_RE = re.compile(
    r"\b(exhibit|exhibition|installation|on view|on display)\b", re.IGNORECASE
)
SPECIALS_RE = re.compile(
    r"\b(happy hour|special|deal|prix fixe|bottomless|brunch special)\b", re.IGNORECASE
)
CLASSES_RE = re.compile(
    r"\b(class|workshop|training|masterclass|bootcamp)\b", re.IGNORECASE
)

TICKET_COVERAGE_THRESHOLD = 0.60
IMAGE_COVERAGE_THRESHOLD = 0.60


def _month_window(start: date, end: date) -> set[int]:
    months: set[int] = set()
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        months.add(cursor.month)
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return months


def _goal_value(
    goal: str, events: list[dict], lineup_event_ids: set[int]
) -> tuple[float, str]:
    if goal == "venue_hours":
        return -1.0, "na"

    total = len(events)
    if goal == "events":
        return float(total), "count"

    if total == 0:
        return 0.0, "count"

    if goal == "tickets":
        covered = sum(1 for e in events if e.get("ticket_url"))
        return covered / total, "ratio"
    if goal == "images":
        covered = sum(1 for e in events if e.get("image_url"))
        return covered / total, "ratio"

    exhibit_count = 0
    specials_count = 0
    class_count = 0
    showtime_count = 0
    for e in events:
        title = e.get("title") or ""
        description = e.get("description") or ""
        text = f"{title} {description}"
        tags = {str(tag).lower() for tag in (e.get("tags") or [])}
        genres = {str(genre).lower() for genre in (e.get("genres") or [])}
        cat = (e.get("category") or "").lower()
        content_kind = (e.get("content_kind") or "").lower()

        if (
            content_kind == "exhibit"
            or
            "exhibition" in tags
            or "exhibit" in tags
            or "on-view" in tags
            or "exhibition" in genres
            or "exhibit" in genres
            or "gallery" in genres
            or EXHIBIT_RE.search(text)
        ):
            exhibit_count += 1

        if (
            content_kind == "special"
            or
            "specials" in tags
            or "happy-hour" in tags
            or "specials" in genres
            or SPECIALS_RE.search(text)
        ):
            specials_count += 1

        if (
            e.get("is_class")
            or "class" in tags
            or "workshop" in tags
            or "class" in genres
            or "workshop" in genres
            or CLASSES_RE.search(text)
        ):
            class_count += 1

        if cat == "film" or "showtime" in tags or "showtime" in genres:
            showtime_count += 1

    if goal == "exhibits":
        return float(exhibit_count), "count"
    if goal == "specials":
        return float(specials_count), "count"
    if goal == "classes":
        return float(class_count), "count"
    if goal == "showtimes":
        return float(showtime_count), "count"
    if goal == "lineup":
        return float(len(lineup_event_ids)), "count"
    return 0.0, "count"


def _goal_ok(goal: str, value: float, mode: str) -> bool | None:
    if mode == "na":
        return None
    if goal == "tickets":
        return value >= TICKET_COVERAGE_THRESHOLD
    if goal == "images":
        return value >= IMAGE_COVERAGE_THRESHOLD
    return value > 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit source data-goal coverage.")
    parser.add_argument("--portal", default="atlanta", help="Portal slug to audit")
    parser.add_argument("--days", type=int, default=120, help="Days ahead window")
    parser.add_argument(
        "--include-unscoped",
        action="store_true",
        help="Include active sources with owner_portal_id = NULL",
    )
    parser.add_argument(
        "--output-json",
        default=None,
        help="Optional path for JSON report output",
    )
    args = parser.parse_args()

    client = get_client()

    portal_row = (
        client.table("portals")
        .select("id,slug")
        .eq("slug", args.portal)
        .maybe_single()
        .execute()
        .data
    )
    if not portal_row:
        raise SystemExit(f"Portal not found: {args.portal}")
    portal_id = portal_row["id"]

    source_rows = (
        client.table("sources")
        .select("id,slug,name,is_active,owner_portal_id,active_months")
        .eq("is_active", True)
        .execute()
        .data
        or []
    )
    if args.include_unscoped:
        source_rows = [
            s for s in source_rows if s.get("owner_portal_id") in {portal_id, None}
        ]
    else:
        source_rows = [s for s in source_rows if s.get("owner_portal_id") == portal_id]

    venue_rows = (
        client.table("venues")
        .select("id,slug,name,venue_type,spot_type")
        .execute()
        .data
        or []
    )
    venues_by_slug = {v["slug"]: v for v in venue_rows if v.get("slug")}

    start = date.today()
    end = start + timedelta(days=args.days)
    window_months = _month_window(start, end)
    source_ids = [s["id"] for s in source_rows]

    events_by_source: dict[int, list[dict]] = defaultdict(list)
    all_event_ids: list[int] = []
    batch_size = 75
    event_fields = (
        "id,source_id,title,description,start_date,end_date,start_time,is_all_day,"
        "category,content_kind,genres,tags,ticket_url,image_url,is_class"
    )
    for i in range(0, len(source_ids), batch_size):
        batch = source_ids[i : i + batch_size]
        rows_in_window = (
            client.table("events")
            .select(event_fields)
            .gte("start_date", start.isoformat())
            .lte("start_date", end.isoformat())
            .in_("source_id", batch)
            .execute()
            .data
            or []
        )
        ongoing_rows = (
            client.table("events")
            .select(event_fields)
            .lt("start_date", start.isoformat())
            .gte("end_date", start.isoformat())
            .in_("source_id", batch)
            .execute()
            .data
            or []
        )

        merged_rows: dict[str, dict] = {}
        for row in rows_in_window + ongoing_rows:
            row_id = row.get("id")
            key = str(row_id) if row_id is not None else (
                f"{row.get('source_id')}|{row.get('title')}|{row.get('start_date')}|{row.get('end_date')}"
            )
            merged_rows[key] = row

        for row in merged_rows.values():
            sid = row.get("source_id")
            if sid is None:
                continue
            events_by_source[sid].append(row)
            if row.get("id"):
                all_event_ids.append(row["id"])

    # Lineup coverage from event_artists for lineup goals.
    lineup_event_ids: set[int] = set()
    for i in range(0, len(all_event_ids), 100):
        batch = all_event_ids[i : i + 100]
        rows = (
            client.table("event_artists")
            .select("event_id")
            .in_("event_id", batch)
            .execute()
            .data
            or []
        )
        lineup_event_ids.update(int(r["event_id"]) for r in rows if r.get("event_id"))

    report_rows = []
    explicit_count = 0
    inferred_count = 0
    pass_all_count = 0

    for source in sorted(source_rows, key=lambda s: s["slug"]):
        source_id = source["id"]
        source_slug = source["slug"]
        source_name = source["name"]
        venue = venues_by_slug.get(source_slug) or {}
        active_months = source.get("active_months") or []
        source_active_months = {
            int(month)
            for month in active_months
            if isinstance(month, int) or (isinstance(month, str) and str(month).isdigit())
        }
        seasonally_out_of_window = bool(source_active_months) and not (
            source_active_months & window_months
        )

        goals, mode = resolve_source_data_goals(
            source_slug=source_slug,
            source_name=source_name,
            venue_type=venue.get("venue_type"),
            spot_type=venue.get("spot_type"),
        )
        if mode == "profile":
            explicit_count += 1
        else:
            inferred_count += 1

        source_events = events_by_source.get(source_id, [])
        source_lineup_event_ids = {
            e["id"] for e in source_events if e.get("id") in lineup_event_ids
        }
        goal_results = []
        all_passed = True
        for goal in goals:
            if seasonally_out_of_window and goal != "venue_hours":
                goal_results.append(
                    {
                        "goal": goal,
                        "value": -1.0,
                        "mode": "na",
                        "ok": None,
                    }
                )
                continue
            value, value_mode = _goal_value(
                goal, source_events, source_lineup_event_ids
            )
            ok = _goal_ok(goal, value, value_mode)
            if ok is False:
                all_passed = False
            goal_results.append(
                {
                    "goal": goal,
                    "value": value,
                    "mode": value_mode,
                    "ok": ok,
                }
            )

        if goals and all((g["ok"] is not False) for g in goal_results):
            pass_all_count += 1

        report_rows.append(
            {
                "source_id": source_id,
                "slug": source_slug,
                "name": source_name,
                "goal_mode": mode,
                "goals": goals,
                "events": len(source_events),
                "goal_results": goal_results,
                "all_goals_passed": all_passed,
            }
        )

    failing = [
        r for r in report_rows if any(g["ok"] is False for g in r["goal_results"])
    ]
    failing = sorted(failing, key=lambda r: (r["events"], r["slug"]))

    summary = {
        "portal": args.portal,
        "days": args.days,
        "sources_audited": len(report_rows),
        "sources_with_profile_goals": explicit_count,
        "sources_with_inferred_goals": inferred_count,
        "sources_passing_all_goals": pass_all_count,
        "sources_with_goal_failures": len(failing),
    }

    print("SOURCE DATA-GOAL HEALTH")
    for key, value in summary.items():
        print(f"{key}: {value}")

    print("\nTop goal gaps (up to 40):")
    shown = 0
    for row in failing:
        failed = [g for g in row["goal_results"] if g["ok"] is False]
        if not failed:
            continue
        problems = ", ".join(
            (
                f"{g['goal']}={g['value']:.2f}"
                if g["mode"] == "ratio"
                else f"{g['goal']}={int(g['value'])}"
            )
            for g in failed
        )
        print(
            f"{row['slug']}\tevents={row['events']}\tmode={row['goal_mode']}\t{problems}"
        )
        shown += 1
        if shown >= 40:
            break

    if args.output_json:
        output_path = Path(args.output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps({"summary": summary, "rows": report_rows}, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"\nWrote JSON report: {output_path}")


if __name__ == "__main__":
    main()
