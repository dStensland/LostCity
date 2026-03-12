#!/usr/bin/env python3
"""
Run the full Yonder inventory cycle: sync, freshness check, and optional prune.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/run_yonder_inventory_cycle.py
    python3 scripts/run_yonder_inventory_cycle.py --apply
"""

from __future__ import annotations

import argparse
import logging
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def run_step(label: str, command: list[str]) -> None:
    logger.info("")
    logger.info("%s", label)
    result = subprocess.run(command, cwd=ROOT)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the full Yonder inventory sync and health-check cycle."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write provider snapshots and prune stale history.",
    )
    parser.add_argument(
        "--skip-prune",
        action="store_true",
        help="Skip retention pruning after a successful apply cycle.",
    )
    parser.add_argument(
        "--keep-per-window",
        type=int,
        default=2,
        help="Retention count for prune step when apply mode is enabled.",
    )
    parser.add_argument(
        "--freshness-max-age-days",
        type=int,
        default=1,
        help="Maximum allowed age in days for current snapshots.",
    )
    args = parser.parse_args()

    sync_command = [sys.executable, "scripts/sync_yonder_inventory.py"]
    if args.apply:
        sync_command.append("--apply")
    run_step("Running provider sync", sync_command)

    run_step(
        "Checking inventory freshness",
        [
            sys.executable,
            "scripts/check_yonder_inventory_freshness.py",
            "--max-age-days",
            str(args.freshness_max_age_days),
        ],
    )

    if args.apply and not args.skip_prune:
        run_step(
            "Pruning stale snapshot history",
            [
                sys.executable,
                "scripts/prune_yonder_inventory_snapshots.py",
                "--keep-per-window",
                str(args.keep_per_window),
                "--apply",
            ],
        )

    run_step(
        "Auditing persisted snapshot state",
        [sys.executable, "scripts/audit_yonder_inventory_snapshots.py"],
    )

    logger.info("")
    logger.info("Yonder inventory cycle completed successfully.")


if __name__ == "__main__":
    main()
