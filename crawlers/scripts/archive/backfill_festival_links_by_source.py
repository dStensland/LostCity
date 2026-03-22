#!/usr/bin/env python3
"""Backfill festival_id links for dedicated festival source slugs.

Usage:
  python3 backfill_festival_links_by_source.py
  python3 backfill_festival_links_by_source.py --apply
  python3 backfill_festival_links_by_source.py --apply --source atlanta-film-festival
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Optional

from db import get_client
from series import resolve_festival_id


@dataclass(frozen=True)
class Mapping:
    source_slug: str
    festival_name: str
    festival_type: Optional[str] = None


MAPPINGS: tuple[Mapping, ...] = (
    Mapping("atlanta-film-festival", "Atlanta Film Festival"),
    Mapping("sweet-auburn-springfest", "Sweet Auburn Springfest"),
    Mapping("bronzelens", "BronzeLens Film Festival"),
    Mapping("elevate-atl-art", "Elevate Atlanta"),
)


def _fetch_source(slug: str) -> Optional[dict[str, Any]]:
    client = get_client()
    rows = (
        client.table("sources")
        .select("id,slug,name,url,is_active")
        .eq("slug", slug)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def _fetch_source_events(source_id: int) -> list[dict[str, Any]]:
    client = get_client()
    return (
        client.table("events")
        .select("id,title,start_date,festival_id,series_id,is_tentpole,is_active")
        .eq("source_id", source_id)
        .order("start_date")
        .execute()
        .data
        or []
    )


def _update_series_festival(series_id: str, festival_id: str) -> None:
    client = get_client()
    client.table("series").update({"festival_id": festival_id}).eq("id", series_id).execute()


def _fetch_series(series_id: str) -> Optional[dict[str, Any]]:
    client = get_client()
    rows = (
        client.table("series").select("id,festival_id").eq("id", series_id).execute().data or []
    )
    return rows[0] if rows else None


def _update_event_festival(event_id: int, festival_id: str) -> None:
    client = get_client()
    client.table("events").update({"festival_id": festival_id}).eq("id", event_id).execute()


def _set_tentpole(event_id: int) -> None:
    client = get_client()
    client.table("events").update({"is_tentpole": True}).eq("id", event_id).execute()


def _pick_parent_tentpole(events: list[dict[str, Any]], festival_name: str) -> Optional[dict[str, Any]]:
    today = date.today().isoformat()
    lowered_name = festival_name.lower()

    def score(row: dict[str, Any]) -> tuple[int, int, str]:
        title = str(row.get("title") or "").lower()
        name_overlap = 1 if any(tok in title for tok in lowered_name.split()[:2]) else 0
        upcoming = 1 if (row.get("start_date") or "") >= today else 0
        return (upcoming, name_overlap, str(row.get("start_date") or ""))

    if not events:
        return None
    return sorted(events, key=score, reverse=True)[0]


def run(apply: bool, source_filter: Optional[str] = None) -> dict[str, Any]:
    report_rows: list[dict[str, Any]] = []
    client = get_client()

    mappings = [m for m in MAPPINGS if not source_filter or m.source_slug == source_filter]

    for mapping in mappings:
        source = _fetch_source(mapping.source_slug)
        if not source:
            report_rows.append(
                {
                    "source_slug": mapping.source_slug,
                    "status": "missing_source",
                }
            )
            continue

        festival_id = resolve_festival_id(
            client,
            mapping.festival_name,
            festival_type=mapping.festival_type,
            website=source.get("url"),
            create_if_missing=apply,
        )

        if not festival_id:
            report_rows.append(
                {
                    "source_slug": mapping.source_slug,
                    "source_id": source["id"],
                    "status": "festival_not_resolved_dry_run",
                    "festival_name": mapping.festival_name,
                }
            )
            continue

        events = _fetch_source_events(source["id"])
        event_updates = 0
        series_updates = 0
        candidate_pool: list[dict[str, Any]] = []
        touched_series: set[str] = set()

        for event in events:
            candidate_pool.append(event)
            if event.get("festival_id") != festival_id:
                event_updates += 1
                if apply:
                    _update_event_festival(int(event["id"]), festival_id)
            series_id = event.get("series_id")
            if series_id and series_id not in touched_series:
                touched_series.add(series_id)
                # Ensure attached series is also linked to the same festival.
                series_row = _fetch_series(series_id)
                if not series_row:
                    continue
                if series_row.get("festival_id") != festival_id:
                    series_updates += 1
                    if apply:
                        _update_series_festival(series_id, festival_id)

        picked_tentpole = _pick_parent_tentpole(candidate_pool, mapping.festival_name)
        tentpole_event_id = picked_tentpole.get("id") if picked_tentpole else None
        tentpole_changed = False
        if picked_tentpole and not bool(picked_tentpole.get("is_tentpole")):
            tentpole_changed = True
            if apply:
                _set_tentpole(int(picked_tentpole["id"]))

        report_rows.append(
            {
                "source_slug": mapping.source_slug,
                "source_id": source["id"],
                "festival_id": festival_id,
                "festival_name": mapping.festival_name,
                "events_seen": len(events),
                "event_festival_updates": event_updates,
                "series_festival_updates": series_updates,
                "tentpole_event_id": tentpole_event_id,
                "tentpole_changed": tentpole_changed,
                "status": "applied" if apply else "dry_run",
            }
        )

    return {
        "snapshot_date": date.today().isoformat(),
        "apply": apply,
        "rows": report_rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill festival links by source slug")
    parser.add_argument("--apply", action="store_true", help="Apply updates")
    parser.add_argument("--source", help="Run only one source slug")
    args = parser.parse_args()

    payload = run(args.apply, args.source)
    print(json.dumps(payload, indent=2))

    suffix = "apply" if args.apply else "dryrun"
    source_part = f"-{args.source}" if args.source else ""
    out = Path(
        f"/Users/coach/Projects/LostCity/reports/festival-link-backfill-by-source-{suffix}{source_part}-{date.today().isoformat()}.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
