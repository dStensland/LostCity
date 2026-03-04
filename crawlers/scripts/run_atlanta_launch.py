#!/usr/bin/env python3
"""
Run a full Atlanta launch-quality crawl + maintenance + health gate in one command.

This script enforces portal scope, writes a single run log, and emits a summary JSON.
"""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import set_database_target
from db import configure_write_mode, get_client, get_portal_id_by_slug, reset_client
from main import _run_source_list
from utils import setup_logging


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full Atlanta launch crawl + maintenance + gate.")
    parser.add_argument("--city", default="Atlanta", help="City for maintenance/gate checks.")
    parser.add_argument("--portal", default="atlanta", help="Portal slug scope for source selection and gate.")
    parser.add_argument("--workers", type=int, default=6, help="Parallel workers for crawl phase.")
    parser.add_argument("--as-of", default=date.today().isoformat(), help="As-of date for gate checks.")
    parser.add_argument("--output-dir", default="reports", help="Output directory for logs + summary JSON.")
    parser.add_argument("--skip-best-effort", action="store_true", help="Skip best-effort maintenance steps.")
    parser.add_argument("--dry-run", action="store_true", help="Run without writes where supported.")
    parser.add_argument(
        "--allow-production-writes",
        action="store_true",
        help="Required to run with production writes when --dry-run is not set.",
    )
    return parser.parse_args()


def configure_file_logging(log_path: Path) -> None:
    formatter = logging.Formatter("%(asctime)s %(levelname)s:%(name)s:%(message)s")
    root_logger = logging.getLogger()
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)


def read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def run_subprocess(label: str, cmd: list[str], logger: logging.Logger) -> int:
    logger.info("[%s] $ %s", label, " ".join(cmd))
    result = subprocess.run(cmd)
    logger.info("[%s] exit=%s", label, result.returncode)
    return int(result.returncode)


def main() -> int:
    args = parse_args()
    if not args.dry_run and not args.allow_production_writes:
        raise SystemExit(
            "Refusing production writes without --allow-production-writes. "
            "Pass --dry-run to preview."
        )

    output_dir = (ROOT / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = output_dir / f"atlanta_launch_run_{run_id}.log"
    summary_path = output_dir / f"atlanta_launch_run_summary_{run_id}.json"

    setup_logging()
    configure_file_logging(log_path)
    logger = logging.getLogger("atlanta_launch_run")

    started_at = datetime.now().isoformat()
    logger.info("Run started: %s", started_at)
    logger.info("Scope portal=%s city=%s as_of=%s", args.portal, args.city, args.as_of)

    set_database_target("production")
    reset_client()
    configure_write_mode(not args.dry_run, reason="")

    client = get_client()
    portal_id = get_portal_id_by_slug(args.portal)
    if not portal_id:
        raise RuntimeError(f"Portal slug not found: {args.portal}")

    sources = (
        client.table("sources")
        .select("*")
        .eq("is_active", True)
        .eq("owner_portal_id", portal_id)
        .order("slug")
        .execute()
        .data
        or []
    )
    logger.info("Resolved sources: %s", len(sources))

    crawl_results = _run_source_list(
        sources,
        parallel=True,
        max_workers=max(1, int(args.workers)),
    )
    crawl_failed_slugs = sorted([slug for slug, ok in crawl_results.items() if not ok])
    crawl_succeeded = sum(1 for ok in crawl_results.values() if ok)
    logger.info(
        "Crawl phase complete: total=%s succeeded=%s failed=%s",
        len(crawl_results),
        crawl_succeeded,
        len(crawl_failed_slugs),
    )
    if crawl_failed_slugs:
        logger.warning("Failed crawl slugs: %s", ", ".join(crawl_failed_slugs))

    post_crawl_cmd = [
        sys.executable,
        str(ROOT / "scripts" / "post_crawl_maintenance.py"),
        "--city",
        args.city,
        "--portal",
        args.portal,
        "--start-date",
        args.as_of,
        "--continue-on-error",
    ]
    if args.skip_best_effort:
        post_crawl_cmd.append("--skip-best-effort")
    if args.dry_run:
        post_crawl_cmd.append("--dry-run")
    maintenance_exit = run_subprocess("post_crawl_maintenance", post_crawl_cmd, logger)

    gate_cmd = [
        sys.executable,
        str(ROOT / "scripts" / "launch_health_check.py"),
        "--city",
        args.city,
        "--portal",
        args.portal,
        "--as-of",
        args.as_of,
    ]
    gate_exit = run_subprocess("launch_health_check", gate_cmd, logger)

    gate_path = output_dir / f"content_health_gate_{args.as_of}_portal-{args.portal}_city-{args.city.lower()}.json"
    metrics_path = output_dir / (
        f"content_health_metrics_{args.as_of}_portal-{args.portal}_city-{args.city.lower()}.json"
    )
    gate = read_json(gate_path)
    metrics = read_json(metrics_path)

    completed_at = datetime.now().isoformat()
    summary = {
        "run_id": run_id,
        "started_at": started_at,
        "completed_at": completed_at,
        "scope": {
            "portal": args.portal,
            "portal_id": portal_id,
            "city": args.city,
            "as_of": args.as_of,
        },
        "crawl": {
            "sources_total": len(crawl_results),
            "sources_succeeded": crawl_succeeded,
            "sources_failed": len(crawl_failed_slugs),
            "failed_slugs": crawl_failed_slugs,
        },
        "maintenance": {
            "skip_best_effort": bool(args.skip_best_effort),
            "exit_code": maintenance_exit,
        },
        "gate": {
            "exit_code": gate_exit,
            "overall_status": (gate or {}).get("overall_status"),
            "counts": (gate or {}).get("counts"),
        },
        "metrics": {
            "visible_future_events": ((metrics or {}).get("counts") or {}).get("future_events_visible"),
            "future_events_total": ((metrics or {}).get("counts") or {}).get("future_events_total"),
            "active_sources": ((metrics or {}).get("counts") or {}).get("active_sources"),
            "crawl_error_rate_pct": ((metrics or {}).get("crawl_freshness") or {}).get("error_rate_pct"),
        },
        "artifacts": {
            "log": str(log_path),
            "summary": str(summary_path),
            "gate_json": str(gate_path),
            "metrics_json": str(metrics_path),
        },
    }

    summary_path.write_text(json.dumps(summary, indent=2))
    logger.info("Summary written: %s", summary_path)
    print(json.dumps(summary, indent=2))

    blocking_failure = (
        maintenance_exit != 0
        or gate_exit != 0
        or (summary["gate"]["overall_status"] not in {"PASS", None})
        or len(crawl_failed_slugs) > 0
    )
    return 1 if blocking_failure else 0


if __name__ == "__main__":
    raise SystemExit(main())
