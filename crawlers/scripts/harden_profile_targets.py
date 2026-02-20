#!/usr/bin/env python3
"""
Validate profile-backed crawler targets and optionally activate non-zero sources.

Wave flow:
1) Dry-run profile pipeline for each target slug
2) Record found/new/updated/error + runtime
3) Optionally activate sources with non-zero signal

Usage:
  python scripts/harden_profile_targets.py --top10
  python scripts/harden_profile_targets.py --all --limit 20
  python scripts/harden_profile_targets.py --top10 --activate-nonzero
  python scripts/harden_profile_targets.py --all --activate-nonzero --timeout-seconds 90
"""

from __future__ import annotations

import argparse
import csv
import multiprocessing as mp
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client, get_source_by_slug
from pipeline_main import run_profile

TOP10_SLUGS = [
    "dirty-south-trivia",
    "geeks-who-drink",
    "outspoken-entertainment",
    "team-trivia",
    "path-foundation",
    "limelight-theater",
    "georgia-craft-brewers-guild",
    "scott-antique-markets",
    "atlanta-printmakers-studio",
    "a-queens-tea-party",
]

ALL56_SLUGS = [
    "a-queens-tea-party",
    "ark-coffeehaus",
    "atlanta-printmakers-studio",
    "atlanta-school-of-photography",
    "bellina-alimentari",
    "besties-alpharetta",
    "big-river-bindery",
    "bulloch-hall",
    "cabbagetown-art-center",
    "candlefish-atlanta",
    "challenge-aerial",
    "circus-arts-institute",
    "corrina-sephora-studios",
    "cultured-south",
    "dirty-south-trivia",
    "do404",
    "donaldson-bannister-farm",
    "dr-bombays-tea",
    "fabricate-studios",
    "fergussons-on-the-square",
    "full-circle-studio-atl",
    "geeks-who-drink",
    "georgia-craft-brewers-guild",
    "goat-n-hammer",
    "grit-ceramics-studio",
    "hotlanta-glassblowing",
    "indiehouse-modern-fragrances",
    "jessas-tea-parlor",
    "just-add-honey-tea",
    "le-jardin-francais",
    "limelight-theater",
    "lot-23-chandler-co",
    "love-and-make",
    "metal-arts-guild-of-georgia",
    "molly-sanyour-ceramics",
    "mushroom-club-of-georgia",
    "my-signature-scent",
    "outspoken-entertainment",
    "path-foundation",
    "planthouse",
    "pottery-with-a-purpose",
    "scott-antique-markets",
    "scraplanta",
    "second-state-press",
    "shane-mcdonald-studios",
    "southeast-fiber-arts-alliance",
    "swan-coach-house",
    "team-trivia",
    "the-dirty-tea",
    "the-ginger-room",
    "the-grande-event-tea-room",
    "the-homestead-atlanta",
    "the-sky-barre",
    "topstitch-studio",
    "wais-gong-fu-tea",
    "zentea-chamblee",
]


@dataclass
class EvalResult:
    slug: str
    source_exists: bool
    source_type: str | None
    is_active_before: bool | None
    events_found: int
    events_new: int
    events_updated: int
    duration_seconds: float
    status: str
    error: str | None
    activated: bool


def _worker(slug: str, limit: int | None, q: Any) -> None:
    try:
        result = run_profile(slug, dry_run=True, limit=limit)
        q.put(
            {
                "status": "ok",
                "events_found": result.events_found,
                "events_new": result.events_new,
                "events_updated": result.events_updated,
                "error": None,
            }
        )
    except Exception as e:  # noqa: BLE001
        q.put(
            {
                "status": "error",
                "events_found": 0,
                "events_new": 0,
                "events_updated": 0,
                "error": str(e),
            }
        )


def _evaluate_slug(slug: str, limit: int | None, timeout_seconds: int) -> EvalResult:
    source = get_source_by_slug(slug)
    source_exists = source is not None
    source_type = source.get("source_type") if source else None
    is_active_before = source.get("is_active") if source else None

    start = time.perf_counter()
    events_found = 0
    events_new = 0
    events_updated = 0
    status = "ok"
    error: str | None = None

    q: Any = mp.Queue()
    proc = mp.Process(target=_worker, args=(slug, limit, q))
    proc.start()
    proc.join(timeout_seconds)

    if proc.is_alive():
        proc.terminate()
        proc.join(5)
        status = "timeout"
        error = "profile validation timed out"
    else:
        payload = q.get() if not q.empty() else None
        if payload:
            status = payload["status"]
            error = payload["error"]
            events_found = payload["events_found"]
            events_new = payload["events_new"]
            events_updated = payload["events_updated"]
        else:
            status = "error"
            error = "worker exited without payload"

    duration = round(time.perf_counter() - start, 2)
    return EvalResult(
        slug=slug,
        source_exists=source_exists,
        source_type=source_type,
        is_active_before=is_active_before,
        events_found=events_found,
        events_new=events_new,
        events_updated=events_updated,
        duration_seconds=duration,
        status=status,
        error=error,
        activated=False,
    )


def _should_activate(result: EvalResult) -> bool:
    if result.status != "ok":
        return False
    if result.is_active_before:
        return False
    return (result.events_found > 0) and ((result.events_new + result.events_updated) > 0)


def _activate_slug(client: Any, slug: str) -> bool:
    resp = client.table("sources").update({"is_active": True}).eq("slug", slug).execute()
    return bool(resp.data)


def _write_report(results: list[EvalResult], filename: str) -> Path:
    out = ROOT / "reports" / filename
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "slug",
                "source_exists",
                "source_type",
                "is_active_before",
                "events_found",
                "events_new",
                "events_updated",
                "duration_seconds",
                "status",
                "error",
                "activated",
            ],
        )
        writer.writeheader()
        for r in results:
            writer.writerow(
                {
                    "slug": r.slug,
                    "source_exists": r.source_exists,
                    "source_type": r.source_type,
                    "is_active_before": r.is_active_before,
                    "events_found": r.events_found,
                    "events_new": r.events_new,
                    "events_updated": r.events_updated,
                    "duration_seconds": r.duration_seconds,
                    "status": r.status,
                    "error": r.error,
                    "activated": r.activated,
                }
            )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Hardening run for profile-backed crawler targets")
    parser.add_argument("--top10", action="store_true", help="Run top-10 wave")
    parser.add_argument("--all", action="store_true", help="Run all-56 wave")
    parser.add_argument("--activate-nonzero", action="store_true", help="Activate non-zero dry-run sources")
    parser.add_argument("--limit", type=int, default=20, help="run_profile limit parameter")
    parser.add_argument("--timeout-seconds", type=int, default=75, help="Per-source timeout")
    args = parser.parse_args()

    if not args.top10 and not args.all:
        parser.error("Choose one: --top10 or --all")

    slugs = TOP10_SLUGS if args.top10 else ALL56_SLUGS
    limit = args.limit if args.limit > 0 else None
    client = get_client()

    results: list[EvalResult] = []
    for slug in slugs:
        r = _evaluate_slug(slug, limit=limit, timeout_seconds=args.timeout_seconds)
        if args.activate_nonzero and _should_activate(r):
            r.activated = _activate_slug(client, slug)
        results.append(r)
        print(
            f"{slug}: status={r.status} found={r.events_found} new={r.events_new} "
            f"updated={r.events_updated} duration={r.duration_seconds}s activated={r.activated}"
            + (f" error={r.error}" if r.error else "")
        )

    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    wave = "top10" if args.top10 else "all56"
    report_name = f"profile_hardening_{wave}_{now}.csv"
    report_path = _write_report(results, report_name)

    ok = [r for r in results if r.status == "ok"]
    nonzero = [r for r in ok if _should_activate(r)]
    activated = [r for r in results if r.activated]
    timeouts = [r for r in results if r.status == "timeout"]
    errors = [r for r in results if r.status == "error"]

    print("\nSUMMARY")
    print(f"wave {wave}")
    print(f"total {len(results)}")
    print(f"ok {len(ok)}")
    print(f"nonzero_signal {len(nonzero)}")
    print(f"activated {len(activated)}")
    print(f"timeouts {len(timeouts)}")
    print(f"errors {len(errors)}")
    print(f"report {report_path}")


if __name__ == "__main__":
    main()
