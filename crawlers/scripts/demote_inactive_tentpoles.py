#!/usr/bin/env python3
"""
Demote tentpole flags on inactive event rows.

Default mode is dry-run. Use --apply to write updates.
"""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import date
import json
from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Demote is_tentpole on inactive events."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50000,
        help="Maximum rows to inspect. Default: 50000.",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=1000,
        help="Page size for select pagination. Default: 1000.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Batch size for updates. Default: 200.",
    )
    parser.add_argument(
        "--report-out",
        help=(
            "Optional report output path. "
            "Default: ../reports/tentpole-stale-inactive-demotion-YYYY-MM-DD.json"
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates. Default is dry-run.",
    )
    return parser.parse_args()


def default_report_path() -> Path:
    return ROOT.parent / "reports" / f"tentpole-stale-inactive-demotion-{date.today().isoformat()}.json"


def fetch_candidates(limit: int, page_size: int) -> list[dict[str, Any]]:
    client = get_client()
    rows: list[dict[str, Any]] = []
    start = 0
    capped_limit = max(1, int(limit))
    page = max(1, int(page_size))

    while len(rows) < capped_limit:
        end = min(start + page - 1, capped_limit - 1)
        batch = (
            client.table("events")
            .select(
                "id,title,festival_id,start_date,end_date,is_tentpole,is_active,"
                "source_id,series_id,updated_at"
            )
            .eq("is_tentpole", True)
            .eq("is_active", False)
            .is_("canonical_event_id", "null")
            .order("id")
            .range(start, end)
            .execute()
            .data
            or []
        )
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < (end - start + 1):
            break
        start += len(batch)

    return rows[:capped_limit]


def chunked(ids: list[int], size: int) -> list[list[int]]:
    chunk_size = max(1, int(size))
    return [ids[idx : idx + chunk_size] for idx in range(0, len(ids), chunk_size)]


def main() -> int:
    args = parse_args()
    report_path = Path(args.report_out) if args.report_out else default_report_path()
    report_path.parent.mkdir(parents=True, exist_ok=True)

    candidates = fetch_candidates(limit=args.limit, page_size=args.page_size)
    festival_counts = Counter((row.get("festival_id") or "standalone") for row in candidates)

    mode = "apply" if args.apply else "dry-run"
    print(f"Mode: {mode}")
    print(f"Candidates: {len(candidates)}")

    updated = 0
    if args.apply and candidates:
        client = get_client()
        ids = [int(row["id"]) for row in candidates if row.get("id") is not None]
        for group in chunked(ids, args.batch_size):
            result = (
                client.table("events")
                .update({"is_tentpole": False})
                .in_("id", group)
                .execute()
            )
            updated += len(result.data or [])

    payload = {
        "snapshot_date": date.today().isoformat(),
        "mode": mode,
        "candidate_count": len(candidates),
        "updated_count": updated,
        "festival_counts": dict(sorted(festival_counts.items(), key=lambda item: (-item[1], item[0]))),
        "rows": candidates,
    }
    report_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote: {report_path}")
    print(f"Updated: {updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
