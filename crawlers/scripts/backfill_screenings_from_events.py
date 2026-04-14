#!/usr/bin/env python3
"""
Backfill additive screening storage from existing event rows for migrated cinema sources.

Use this after the screening tables are migrated so showtime/detail surfaces stop
depending on legacy event-derived grouping immediately.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import set_database_target
from db import get_source_by_slug, sync_source_screenings_from_events

DEFAULT_SOURCE_SLUGS = [
    "plaza-theatre",
    "tara-theatre",
    "landmark-midtown",
    "starlight-drive-in",
    "atlanta-film-festival",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill screening storage from existing event rows.")
    parser.add_argument(
        "--target",
        choices=("production", "staging"),
        default="production",
        help="Database target to use.",
    )
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        help="Specific source slug to backfill. Repeat for multiple sources.",
    )
    return parser.parse_args()


def run(slugs: Iterable[str]) -> int:
    total_times = 0
    for slug in slugs:
        source = get_source_by_slug(slug)
        if not source:
            print(f"SKIP {slug}: source not found")
            continue
        summary = sync_source_screenings_from_events(
            source_id=source["id"],
            source_slug=source["slug"],
        )
        total_times += int(summary.get("times") or 0)
        print(
            f"{slug}: titles={summary.get('titles', 0)} runs={summary.get('runs', 0)} "
            f"times={summary.get('times', 0)} persisted={summary.get('persisted', 0)} "
            f"cleanup={summary.get('cleanup', {})}"
        )
    return total_times


def main() -> int:
    args = parse_args()
    set_database_target(args.target)
    slugs = args.sources or DEFAULT_SOURCE_SLUGS
    run(slugs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
