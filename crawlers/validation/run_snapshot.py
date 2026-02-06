#!/usr/bin/env python3
"""
Generate a quality snapshot for a source based on current DB state.

Examples:
  python validation/run_snapshot.py --source the-earl --mode legacy --days 180
  python validation/run_snapshot.py --source the-earl --mode pipeline --updated-since 2026-02-06T02:00:00Z
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Any

sys.path.append(str(Path(__file__).resolve().parents[1]))

from db import get_client, get_source_by_slug

DEFAULT_DAYS = 180
PAGE_SIZE = 1000
BATCH_SIZE = 500


def _parse_iso(value: str) -> datetime:
    value = value.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _chunked(items: list[int], size: int) -> Iterable[list[int]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _fetch_events(
    source_id: int,
    updated_since: str | None,
    days: int,
    include_past: bool,
    max_events: int | None,
) -> list[dict[str, Any]]:
    client = get_client()

    def build_query():
        q = (
            client.table("events")
            .select(
                "id,title,description,start_date,start_time,ticket_url,image_url,tags,price_min,price_max,source_url,updated_at"
            )
            .eq("source_id", source_id)
        )
        if updated_since:
            q = q.gte("updated_at", updated_since)
        else:
            today = datetime.now(timezone.utc).date()
            if not include_past:
                q = q.gte("start_date", today.isoformat())
            if days > 0:
                end_date = today + timedelta(days=days)
                q = q.lte("start_date", end_date.isoformat())
        return q

    results: list[dict[str, Any]] = []
    offset = 0
    while True:
        data = build_query().range(offset, offset + PAGE_SIZE - 1).execute().data or []
        if not data:
            break
        results.extend(data)
        if len(data) < PAGE_SIZE:
            break
        if max_events is not None and len(results) >= max_events:
            results = results[:max_events]
            break
        offset += PAGE_SIZE

    return results


def _fetch_event_ids_with_children(table: str, event_ids: list[int]) -> set[int]:
    client = get_client()
    if not event_ids:
        return set()

    found: set[int] = set()
    for batch in _chunked(event_ids, BATCH_SIZE):
        try:
            result = (
                client.table(table)
                .select("event_id")
                .in_("event_id", batch)
                .execute()
            )
            for row in result.data or []:
                if row.get("event_id") is not None:
                    found.add(int(row["event_id"]))
        except Exception:
            return set()

    return found


def _describe_length(value: str | None) -> int:
    if not value:
        return 0
    return len(value.strip())


def _coverage(count: int, total: int) -> float:
    if total == 0:
        return 0.0
    return round((count / total) * 100.0, 2)


def run_snapshot(args: argparse.Namespace) -> dict[str, Any]:
    source = get_source_by_slug(args.source)
    if not source:
        raise SystemExit(f"Source not found: {args.source}")

    updated_since = None
    if args.updated_since:
        updated_since = _iso(_parse_iso(args.updated_since))
    elif args.window_mins:
        updated_since = _iso(datetime.now(timezone.utc) - timedelta(minutes=args.window_mins))

    events = _fetch_events(
        source_id=source["id"],
        updated_since=updated_since,
        days=args.days,
        include_past=args.include_past,
        max_events=args.max,
    )

    event_ids = [int(e["id"]) for e in events if e.get("id") is not None]

    event_ids_with_artists = _fetch_event_ids_with_children("event_artists", event_ids)
    event_ids_with_images = _fetch_event_ids_with_children("event_images", event_ids)

    total = len(events)
    has_description = sum(1 for e in events if _describe_length(e.get("description")) > 0)
    has_ticket = sum(1 for e in events if e.get("ticket_url"))
    has_image = sum(
        1
        for e in events
        if e.get("image_url") or (e.get("id") in event_ids_with_images)
    )
    has_tags = sum(1 for e in events if e.get("tags"))
    has_start_time = sum(1 for e in events if e.get("start_time"))
    has_price = sum(1 for e in events if e.get("price_min") or e.get("price_max"))
    has_artists = sum(1 for e in events if e.get("id") in event_ids_with_artists)

    desc_lengths = [
        _describe_length(e.get("description"))
        for e in events
        if _describe_length(e.get("description")) > 0
    ]
    desc_lengths_sorted = sorted(desc_lengths)
    median_desc_len = 0
    if desc_lengths_sorted:
        mid = len(desc_lengths_sorted) // 2
        median_desc_len = desc_lengths_sorted[mid]

    samples = {
        "missing_ticket_url": [],
        "missing_image": [],
        "missing_description": [],
        "missing_artists": [],
    }

    def add_sample(key: str, event: dict[str, Any]) -> None:
        if len(samples[key]) >= args.sample:
            return
        samples[key].append(
            {
                "id": event.get("id"),
                "title": event.get("title"),
                "start_date": event.get("start_date"),
                "source_url": event.get("source_url"),
            }
        )

    for event in events:
        if not event.get("ticket_url"):
            add_sample("missing_ticket_url", event)
        if not event.get("image_url") and event.get("id") not in event_ids_with_images:
            add_sample("missing_image", event)
        if _describe_length(event.get("description")) == 0:
            add_sample("missing_description", event)
        if event.get("id") not in event_ids_with_artists:
            add_sample("missing_artists", event)

    snapshot = {
        "source": {
            "id": source["id"],
            "slug": source["slug"],
            "name": source.get("name"),
        },
        "mode": args.mode,
        "generated_at": _iso(datetime.now(timezone.utc)),
        "filters": {
            "updated_since": updated_since,
            "days": args.days,
            "include_past": args.include_past,
            "max": args.max,
        },
        "counts": {
            "total": total,
            "with_description": has_description,
            "with_ticket_url": has_ticket,
            "with_image": has_image,
            "with_tags": has_tags,
            "with_start_time": has_start_time,
            "with_price": has_price,
            "with_artists": has_artists,
        },
        "coverage": {
            "description": _coverage(has_description, total),
            "ticket_url": _coverage(has_ticket, total),
            "image": _coverage(has_image, total),
            "tags": _coverage(has_tags, total),
            "start_time": _coverage(has_start_time, total),
            "price": _coverage(has_price, total),
            "artists": _coverage(has_artists, total),
        },
        "summary": {
            "median_description_length": median_desc_len,
        },
        "samples": samples,
    }

    return snapshot


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Source slug")
    parser.add_argument("--mode", default="unknown", help="Label for the run: legacy|pipeline|llm")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help="Future window in days")
    parser.add_argument("--updated-since", help="ISO timestamp for updated_at filter")
    parser.add_argument("--window-mins", type=int, help="Minutes lookback window for updated_at")
    parser.add_argument("--include-past", action="store_true", help="Include past events")
    parser.add_argument("--max", type=int, help="Max events to include")
    parser.add_argument("--sample", type=int, default=10, help="Sample size per missing field")
    parser.add_argument("--out", help="Output path for JSON snapshot")

    args = parser.parse_args()

    if args.updated_since and args.window_mins:
        raise SystemExit("Use only one of --updated-since or --window-mins")

    snapshot = run_snapshot(args)

    out_path: Path
    if args.out:
        out_path = Path(args.out)
    else:
        timestamp = snapshot["generated_at"].replace(":", "").replace("-", "")
        out_path = Path("validation") / "runs" / f"{args.source}-{args.mode}-{timestamp}.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(snapshot, indent=2))
    print(f"Snapshot written to {out_path}")


if __name__ == "__main__":
    main()
