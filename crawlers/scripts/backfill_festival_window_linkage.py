#!/usr/bin/env python3
"""
Repair festival event linkage for rows outside the announced festival window.

Heuristics:
- If a linked festival series has only out-of-window active events, demote the
  series out of festival scope (`festival_id = null`, `series_type = other`).
- If a linked series has both in-window and out-of-window rows with the same
  normalized title, deactivate the out-of-window duplicates.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_client


def _normalize_title(title: Optional[str]) -> str:
    return " ".join((title or "").lower().split())


def _in_window(start_date: Optional[str], start: str, end: str) -> bool:
    if not start_date:
        return False
    return start <= start_date <= end


def _plan_series_action(
    *,
    festival_start: str,
    festival_end: str,
    series: dict,
    events: list[dict],
) -> Optional[dict]:
    active_events = [event for event in events if event.get("is_active") is not False]
    if not active_events:
        return None

    in_window = [
        event
        for event in active_events
        if _in_window(event.get("start_date"), festival_start, festival_end)
    ]
    outside = [
        event
        for event in active_events
        if event.get("start_date")
        and not _in_window(event.get("start_date"), festival_start, festival_end)
    ]

    if not outside:
        return None

    if not in_window:
        return {
            "action": "demote_series",
            "series_id": series["id"],
            "event_ids": [event["id"] for event in outside],
        }

    in_window_titles = {_normalize_title(event.get("title")) for event in in_window}
    duplicate_outside = [
        event
        for event in outside
        if _normalize_title(event.get("title")) in in_window_titles
    ]
    if duplicate_outside:
        return {
            "action": "deactivate_events",
            "series_id": series["id"],
            "event_ids": [event["id"] for event in duplicate_outside],
        }

    return None


def _load_festival_scope(
    client, slug: str
) -> tuple[dict, list[dict], dict[str, list[dict]]]:
    festival_rows = (
        client.table("festivals")
        .select("id,slug,name,announced_start,announced_end")
        .eq("slug", slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not festival_rows:
        raise RuntimeError(f"Festival not found: {slug}")
    festival = festival_rows[0]

    series_rows = (
        client.table("series")
        .select("id,title,series_type,festival_id")
        .eq("festival_id", festival["id"])
        .execute()
        .data
        or []
    )
    series_ids = [row["id"] for row in series_rows]
    events_by_series: dict[str, list[dict]] = defaultdict(list)
    if series_ids:
        event_rows = (
            client.table("events")
            .select("id,title,start_date,is_active,series_id,festival_id")
            .in_("series_id", series_ids)
            .eq("is_active", True)
            .execute()
            .data
            or []
        )
        for row in event_rows:
            events_by_series[row["series_id"]].append(row)

    return festival, series_rows, events_by_series


def _load_direct_festival_events(client, festival_id: str) -> list[dict]:
    return (
        client.table("events")
        .select("id,title,start_date,is_active,series_id,festival_id")
        .eq("festival_id", festival_id)
        .is_("series_id", "null")
        .eq("is_active", True)
        .execute()
        .data
        or []
    )


def repair_festival_window_linkage(*, slugs: list[str], dry_run: bool) -> dict:
    client = get_client()
    stats = {"series_demoted": 0, "events_deactivated": 0, "skipped": 0}

    for slug in slugs:
        festival, series_rows, events_by_series = _load_festival_scope(client, slug)
        start = festival.get("announced_start")
        end = festival.get("announced_end") or start
        if not start or not end:
            raise RuntimeError(f"Festival {slug} is missing announced dates")

        for series in series_rows:
            plan = _plan_series_action(
                festival_start=start,
                festival_end=end,
                series=series,
                events=events_by_series.get(series["id"], []),
            )
            if not plan:
                stats["skipped"] += 1
                continue

            if plan["action"] == "demote_series":
                if not dry_run:
                    client.table("series").update(
                        {"festival_id": None, "series_type": "other"}
                    ).eq("id", plan["series_id"]).execute()
                    client.table("events").update({"festival_id": None}).in_(
                        "id", plan["event_ids"]
                    ).execute()
                stats["series_demoted"] += 1
                continue

            if plan["action"] == "deactivate_events":
                if not dry_run:
                    client.table("events").update({"is_active": False}).in_(
                        "id", plan["event_ids"]
                    ).execute()
                stats["events_deactivated"] += len(plan["event_ids"])
                continue

            stats["skipped"] += 1

        direct_events = _load_direct_festival_events(client, festival["id"])
        for event in direct_events:
            if not _in_window(event.get("start_date"), start, end):
                if not dry_run:
                    client.table("events").update({"festival_id": None}).eq(
                        "id", event["id"]
                    ).execute()
                stats["series_demoted"] += 1

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Repair out-of-window festival linkage"
    )
    parser.add_argument("--slug", action="append", dest="slugs", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    stats = repair_festival_window_linkage(slugs=args.slugs, dry_run=args.dry_run)
    print(stats)


if __name__ == "__main__":
    main()
