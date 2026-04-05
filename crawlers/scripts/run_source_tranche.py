#!/usr/bin/env python3
"""
Run a sequential batch of crawler sources, waiting for the production write lock.

Examples:
  python3 scripts/run_source_tranche.py --dry-run --source hotel-clermont --source boggs-social
  python3 scripts/run_source_tranche.py --allow-production-writes --source hotel-clermont --source boggs-social
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "main.py"
LOCK_MESSAGE = "Another production write crawl is already active"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a sequential source tranche with lock-aware retry."
    )
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        required=True,
        help="Source slug to run. Repeat for multiple sources.",
    )
    parser.add_argument(
        "--db-target",
        default="production",
        help="Crawler DB target. Defaults to production.",
    )
    parser.add_argument(
        "--allow-production-writes",
        action="store_true",
        help="Actually write to the target DB.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run read-only dry-runs instead of writes.",
    )
    parser.add_argument(
        "--wait-seconds",
        type=float,
        default=30.0,
        help="Seconds to wait before retrying when the production write lock is active.",
    )
    parser.add_argument(
        "--max-lock-retries",
        type=int,
        default=0,
        help="Maximum retries on the production write lock. 0 means retry forever.",
    )
    parser.add_argument(
        "--extra-arg",
        action="append",
        default=[],
        help="Extra arg to pass through to main.py. Repeatable.",
    )
    return parser.parse_args()


def build_base_cmd(args: argparse.Namespace) -> list[str]:
    cmd = [sys.executable, str(MAIN), "--db-target", args.db_target]
    if args.dry_run:
        cmd.append("--dry-run")
    elif args.allow_production_writes:
        cmd.append("--allow-production-writes")
    else:
        raise SystemExit("Use either --dry-run or --allow-production-writes.")

    for extra in args.extra_arg:
        cmd.append(extra)
    return cmd


def run_one_source(base_cmd: list[str], slug: str, args: argparse.Namespace) -> int:
    attempts = 0
    while True:
        cmd = [*base_cmd, "--source", slug]
        print(f"\n=== Running source tranche item: {slug} ===", flush=True)
        print("$ " + " ".join(cmd), flush=True)
        result = subprocess.run(
            cmd,
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        if result.stdout:
            print(result.stdout, end="", flush=True)
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr, flush=True)

        combined = f"{result.stdout}\n{result.stderr}"
        if result.returncode == 0:
            print(f"=== Completed: {slug} ===", flush=True)
            return 0

        if LOCK_MESSAGE in combined:
            attempts += 1
            if args.max_lock_retries and attempts > args.max_lock_retries:
                print(
                    f"Lock retry budget exceeded for {slug}.",
                    file=sys.stderr,
                    flush=True,
                )
                return result.returncode or 1
            print(
                f"Production write lock active while waiting to run {slug}. "
                f"Retrying in {args.wait_seconds:.0f}s.",
                flush=True,
            )
            time.sleep(args.wait_seconds)
            continue

        print(
            f"=== Failed: {slug} (exit={result.returncode}) ===",
            file=sys.stderr,
            flush=True,
        )
        return result.returncode or 1


def main() -> int:
    args = parse_args()
    base_cmd = build_base_cmd(args)

    for slug in args.sources:
        rc = run_one_source(base_cmd, slug, args)
        if rc != 0:
            return rc
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
