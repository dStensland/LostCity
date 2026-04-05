#!/usr/bin/env python3
# ruff: noqa: E402
"""Collapse clearly orphaned festival_program series into direct festival events.

Safe cases only:
1. description is empty
2. all linked rows are inactive, or
3. exactly one active row exists and its title matches the series title
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
CRAWLERS_ROOT = REPO_ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS_ROOT))

from db import get_client


def _norm(text: str | None) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip().lower()


def plan_orphan_series_cleanup(
    series_rows: list[dict[str, Any]],
    events_by_series: dict[str, list[dict[str, Any]]],
    *,
    allowed_festival_ids: set[str] | None = None,
    festival_rows_by_id: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for row in series_rows:
        if row.get("series_type") != "festival_program":
            continue
        festival_id = row.get("festival_id")
        if not festival_id:
            continue
        if allowed_festival_ids is not None and festival_id not in allowed_festival_ids:
            continue
        linked_events = events_by_series.get(row.get("id"), [])
        active_events = [
            event for event in linked_events if event.get("is_active") is not False
        ]
        if not linked_events:
            continue

        action = None
        has_description = bool((row.get("description") or "").strip())
        all_titles_match = all(
            _norm(event.get("title")) == _norm(row.get("title"))
            for event in linked_events
        )
        if len(active_events) == 0:
            if has_description:
                festival_row = (festival_rows_by_id or {}).get(festival_id) or {}
                if festival_row.get("id"):
                    action = "delete_stale_wrapper_and_preserve_festival_description"
            else:
                action = "unlink_stale_rows_and_delete_series"
        elif len(active_events) == 1 and _norm(active_events[0].get("title")) == _norm(
            row.get("title")
        ):
            if not has_description:
                action = "promote_single_event_and_delete_series"
            elif all_titles_match:
                action = "promote_single_event_and_preserve_description"
        elif len(active_events) == 1 and has_description:
            inactive_events = [
                event for event in linked_events if event.get("is_active") is False
            ]
            inactive_titles_match = bool(inactive_events) and all(
                _norm(event.get("title")) == _norm(row.get("title"))
                for event in inactive_events
            )
            if (
                inactive_titles_match
                and active_events[0].get("festival_id") == festival_id
            ):
                action = "promote_single_child_event_and_preserve_festival_description"

        if not action:
            continue

        candidates.append(
            {
                "series_id": row.get("id"),
                "festival_id": festival_id,
                "title": row.get("title"),
                "action": action,
                "event_ids": [
                    event.get("id")
                    for event in linked_events
                    if event.get("id") is not None
                ],
                "active_event_ids": [
                    event.get("id")
                    for event in active_events
                    if event.get("id") is not None
                ],
            }
        )

    candidates.sort(
        key=lambda row: ((row.get("festival_id") or ""), (row.get("title") or ""))
    )
    return candidates


def _fetch_festival_ids(slugs: list[str]) -> set[str]:
    if not slugs:
        return set()
    client = get_client()
    rows = (
        client.table("festivals").select("id,slug").in_("slug", slugs).execute().data
        or []
    )
    return {row["id"] for row in rows if row.get("id")}


def cleanup_orphan_series(*, execute: bool, slugs: list[str]) -> dict[str, Any]:
    client = get_client()
    allowed_festival_ids = _fetch_festival_ids(slugs)
    festival_rows = (
        client.table("festivals").select("id,description").execute().data or []
    )
    festival_rows_by_id = {row["id"]: row for row in festival_rows if row.get("id")}

    series_rows = (
        client.table("series")
        .select("id,title,festival_id,series_type,description")
        .eq("series_type", "festival_program")
        .not_.is_("festival_id", "null")
        .execute()
        .data
        or []
    )
    series_ids = [row["id"] for row in series_rows if row.get("id")]
    events_by_series: dict[str, list[dict[str, Any]]] = {}
    chunk_size = 200
    for start in range(0, len(series_ids), chunk_size):
        chunk = series_ids[start : start + chunk_size]
        rows = (
            client.table("events")
            .select("id,title,series_id,is_active,festival_id")
            .in_("series_id", chunk)
            .execute()
            .data
            or []
        )
        for row in rows:
            series_id = row.get("series_id")
            if not series_id:
                continue
            events_by_series.setdefault(series_id, []).append(row)

    candidates = plan_orphan_series_cleanup(
        series_rows,
        events_by_series,
        allowed_festival_ids=allowed_festival_ids if slugs else None,
        festival_rows_by_id=festival_rows_by_id,
    )

    applied = 0
    if execute:
        for candidate in candidates:
            series_description = (
                next(
                    (
                        row.get("description")
                        for row in series_rows
                        if row.get("id") == candidate["series_id"]
                    ),
                    None,
                )
                or ""
            ).strip()
            active_event_rows = [
                event
                for event in events_by_series.get(candidate["series_id"], [])
                if event.get("id") in set(candidate["active_event_ids"])
            ]
            festival_row = festival_rows_by_id.get(candidate["festival_id"]) or {}
            festival_description = (festival_row.get("description") or "").strip()
            for event_id in candidate["event_ids"]:
                stale_event_rows = events_by_series.get(candidate["series_id"], [])
                matching_event = next(
                    (
                        event
                        for event in stale_event_rows
                        if event.get("id") == event_id
                    ),
                    {},
                )
                update_payload = {"series_id": None}
                if not matching_event.get("festival_id"):
                    update_payload["festival_id"] = candidate["festival_id"]
                client.table("events").update(update_payload).eq(
                    "id", event_id
                ).execute()
            if candidate["action"] in {
                "promote_single_event_and_delete_series",
                "promote_single_event_and_preserve_description",
                "promote_single_child_event_and_preserve_festival_description",
            }:
                for event in active_event_rows:
                    update_payload: dict[str, Any] = {}
                    if not event.get("festival_id"):
                        update_payload["festival_id"] = candidate["festival_id"]
                    if (
                        candidate["action"]
                        in {
                            "promote_single_event_and_preserve_description",
                            "promote_single_child_event_and_preserve_festival_description",
                        }
                        and series_description
                        and len(series_description)
                        > len((event.get("description") or "").strip())
                    ):
                        update_payload["description"] = series_description
                    if update_payload:
                        client.table("events").update(update_payload).eq(
                            "id", event["id"]
                        ).execute()
            if (
                candidate["action"]
                == "delete_stale_wrapper_and_preserve_festival_description"
                and series_description
                and len(series_description) > len(festival_description)
            ):
                client.table("festivals").update(
                    {"description": series_description}
                ).eq("id", candidate["festival_id"]).execute()
            client.table("series").delete().eq("id", candidate["series_id"]).execute()
            applied += 1

    return {
        "candidate_count": len(candidates),
        "applied_count": applied,
        "candidates": candidates[:25],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collapse safe orphan festival_program series"
    )
    parser.add_argument(
        "--execute", action="store_true", help="Apply cleanup (default is dry-run)"
    )
    parser.add_argument(
        "--slug",
        action="append",
        default=[],
        help="Restrict cleanup to one or more festival slugs",
    )
    args = parser.parse_args()

    stats = cleanup_orphan_series(execute=args.execute, slugs=args.slug)
    print(stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
