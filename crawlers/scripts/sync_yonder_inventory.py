#!/usr/bin/env python3
"""
Run all current Yonder provider inventory sync jobs.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/sync_yonder_inventory.py
    python3 scripts/sync_yonder_inventory.py --apply
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

SYNC_SCRIPTS = [
    "scripts/sync_yonder_ga_state_park_inventory.py",
    "scripts/sync_yonder_whitewater_express_inventory.py",
    "scripts/sync_yonder_unicoi_inventory.py",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run all current Yonder inventory sync jobs.")
    parser.add_argument("--apply", action="store_true", help="Write all provider snapshots to the database.")
    args = parser.parse_args()

    failures: list[str] = []
    for script in SYNC_SCRIPTS:
        cmd = [sys.executable, script]
        if args.apply:
            cmd.append("--apply")

        logger.info("")
        logger.info("Running %s", script)
        result = subprocess.run(cmd, cwd=ROOT)
        if result.returncode != 0:
            failures.append(script)

    logger.info("")
    if failures:
        logger.info("Yonder inventory sync finished with failures:")
        for script in failures:
            logger.info("- %s", script)
        raise SystemExit(1)

    logger.info("Yonder inventory sync finished successfully.")


if __name__ == "__main__":
    main()
