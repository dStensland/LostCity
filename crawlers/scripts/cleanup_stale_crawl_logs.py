#!/usr/bin/env python3
"""
Cancel stale crawl_logs rows stuck in "running" status.

Usage:
  python3 scripts/cleanup_stale_crawl_logs.py
  python3 scripts/cleanup_stale_crawl_logs.py --hours 6
  python3 scripts/cleanup_stale_crawl_logs.py --source amc-atlanta --source regal-atlanta
  python3 scripts/cleanup_stale_crawl_logs.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client  # noqa: E402


DEFAULT_REASON = "Auto-cancelled stale running crawl log during maintenance."


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Cancel stale running crawl logs."
    )
    parser.add_argument(
        "--hours",
        type=float,
        default=2.0,
        help="Consider running logs older than this many hours as stale (default: 2).",
    )
    parser.add_argument(
        "--source",
        action="append",
        default=[],
        help="Limit to one or more source slugs. Can be provided multiple times.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1000,
        help="Maximum number of stale rows to process (default: 1000).",
    )
    parser.add_argument(
        "--reason",
        default=DEFAULT_REASON,
        help="Reason stored in error_message for cancelled rows.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print rows that would be cancelled without writing changes.",
    )
    return parser.parse_args()


def _normalize_slugs(values: list[str]) -> list[str]:
    slugs: list[str] = []
    for value in values:
        for part in value.split(","):
            slug = part.strip()
            if slug:
                slugs.append(slug)
    return sorted(set(slugs))


def main() -> None:
    args = _parse_args()
    client = get_client()

    cutoff = datetime.now(timezone.utc) - timedelta(hours=args.hours)
    cutoff_iso = cutoff.isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    selected_slugs = _normalize_slugs(args.source)
    source_map: dict[int, str] = {}

    if selected_slugs:
        source_rows = (
            client.table("sources")
            .select("id,slug")
            .in_("slug", selected_slugs)
            .execute()
            .data
            or []
        )
        source_map = {row["id"]: row["slug"] for row in source_rows}
        found_slugs = set(source_map.values())
        missing_slugs = [slug for slug in selected_slugs if slug not in found_slugs]
        if missing_slugs:
            print(f"Warning: unknown source slug(s): {', '.join(missing_slugs)}")
        if not source_map:
            print("No matching sources found. Exiting.")
            return

    query = (
        client.table("crawl_logs")
        .select("id,source_id,started_at,status")
        .eq("status", "running")
        .lt("started_at", cutoff_iso)
        .order("started_at")
        .limit(args.limit)
    )

    if source_map:
        query = query.in_("source_id", list(source_map.keys()))

    stale_rows = query.execute().data or []

    if not stale_rows:
        print(f"No stale running logs found (cutoff: {cutoff_iso}).")
        return

    if not source_map:
        source_ids = sorted({row["source_id"] for row in stale_rows})
        source_rows = (
            client.table("sources")
            .select("id,slug")
            .in_("id", source_ids)
            .execute()
            .data
            or []
        )
        source_map = {row["id"]: row["slug"] for row in source_rows}

    print(
        f"Found {len(stale_rows)} stale running log(s) older than {args.hours}h "
        f"(cutoff: {cutoff_iso})"
    )
    if args.dry_run:
        print("DRY RUN: no rows will be updated.")

    counts = Counter()
    for row in stale_rows:
        slug = source_map.get(row["source_id"], f"source-{row['source_id']}")
        counts[slug] += 1
        print(f"- log_id={row['id']} source={slug} started_at={row['started_at']}")
        if args.dry_run:
            continue
        client.table("crawl_logs").update(
            {
                "status": "cancelled",
                "completed_at": now_iso,
                "error_message": args.reason,
            }
        ).eq("id", row["id"]).execute()

    print("\nSummary by source:")
    for slug, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        print(f"- {slug}: {count}")

    if args.dry_run:
        print("\nDone (dry-run).")
    else:
        print("\nDone.")


if __name__ == "__main__":
    main()
