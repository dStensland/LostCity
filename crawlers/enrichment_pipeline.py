#!/usr/bin/env python3
"""
Orchestrated enrichment pipeline for LostCity.

Runs enrichment phases in sequence, producing a JSON summary.
Designed to run weekly via GitHub Actions or manually.

Phases:
  1. Event descriptions (thin-desc sweep for Eventbrite + non-Eventbrite)
  2. Venue website enrichment (hours, descriptions, meta — skip specials)
  3. Venue image enrichment (website og:image, then Google Places fallback)
  4. Quality recompute (content_health_audit)

Usage:
  cd /Users/coach/Projects/LostCity/crawlers

  # Full pipeline (default: Atlanta portal)
  python3 enrichment_pipeline.py --apply

  # Dry run (preview only)
  python3 enrichment_pipeline.py

  # Custom scope
  python3 enrichment_pipeline.py --city Atlanta --portal atlanta --apply

  # Skip specific phases
  python3 enrichment_pipeline.py --apply --skip-event-descriptions --skip-venue-images
"""

from __future__ import annotations

import argparse
import json
import shlex
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPTS = ROOT / "scripts"
REPORTS = ROOT / "reports"


def run_step(label: str, args: list[str], *, timeout_seconds: int = 3600) -> int:
    """Run a subprocess step with logging."""
    cmd_str = " ".join(shlex.quote(part) for part in args)
    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}")
    print(f"$ {cmd_str}")
    try:
        result = subprocess.run(args, timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        print(f"[TIMEOUT] Step timed out after {timeout_seconds}s: {label}")
        return 1
    if result.returncode != 0:
        print(f"[ERROR] Step failed: {label} (exit={result.returncode})")
    else:
        print(f"[OK] {label}")
    return result.returncode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run orchestrated enrichment pipeline."
    )
    parser.add_argument(
        "--city",
        default="Atlanta",
        help="City scope. Default: Atlanta.",
    )
    parser.add_argument(
        "--portal",
        help="Portal slug scope. If omitted and --city Atlanta, defaults to atlanta.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to database. Default is dry-run.",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Continue pipeline even if a phase fails.",
    )

    # Phase toggles
    parser.add_argument(
        "--skip-event-descriptions",
        action="store_true",
        help="Skip Phase 1: event description enrichment.",
    )
    parser.add_argument(
        "--skip-venue-enrichment",
        action="store_true",
        help="Skip Phase 2: venue website enrichment.",
    )
    parser.add_argument(
        "--skip-venue-images",
        action="store_true",
        help="Skip Phase 3: venue image enrichment.",
    )
    parser.add_argument(
        "--skip-quality-audit",
        action="store_true",
        help="Skip Phase 4: quality recompute audit.",
    )

    # Limits
    parser.add_argument(
        "--event-desc-limit",
        type=int,
        default=600,
        help="Max events per enrichment script run. Default: 600.",
    )
    parser.add_argument(
        "--venue-enrichment-limit",
        type=int,
        default=300,
        help="Max venues per venue enrichment run. Default: 300.",
    )
    parser.add_argument(
        "--venue-image-limit",
        type=int,
        default=200,
        help="Max venues for image scraping. Default: 200.",
    )
    parser.add_argument(
        "--google-image-limit",
        type=int,
        default=100,
        help="Max venues for Google Places image fallback. Default: 100.",
    )

    return parser.parse_args()


def resolve_portal_slug(city: str, portal: str | None) -> str | None:
    if portal:
        return portal
    if city.lower() in ("atlanta", "atl"):
        return "atlanta"
    return None


def main() -> int:
    args = parse_args()
    py = sys.executable
    portal_slug = resolve_portal_slug(args.city, args.portal)
    start_date = date.today().isoformat()
    started_at = datetime.now(timezone.utc).isoformat()

    phase_results: list[dict] = []

    def record_phase(name: str, rc: int, skipped: bool = False) -> None:
        phase_results.append({
            "phase": name,
            "status": "skipped" if skipped else ("ok" if rc == 0 else "failed"),
            "exit_code": rc,
        })

    # ── Phase 1: Event description enrichment ──────────────────────────
    # Disabled: synthetic description enrichment removed (2026-03-30).
    # Previously called enrich_eventbrite_descriptions.py and
    # enrich_non_eventbrite_descriptions.py which assembled metadata into
    # prose descriptions. Future: re-enable with real extraction.
    print("\n[SKIP] Phase 1: Event description enrichment (synthetic pipeline disabled)")
    record_phase("event_descriptions", 0, skipped=True)

    # ── Phase 2: Venue website enrichment ──────────────────────────────
    if args.skip_venue_enrichment:
        print("\n[SKIP] Phase 2: Venue website enrichment")
        record_phase("venue_enrichment", 0, skipped=True)
    else:
        phase2_rc = 0

        # 2a. Bars — website scrape (hours, descriptions, meta — skip specials)
        bar_cmd = [
            py, str(ROOT / "scrape_venue_specials.py"),
            "--venue-type", "bar",
            "--skip-specials",
            "--limit", str(args.venue_enrichment_limit),
        ]
        if not args.apply:
            bar_cmd.append("--dry-run")

        rc2a = run_step(
            "Phase 2a: Venue enrichment — bars (hours, desc, meta)",
            bar_cmd,
            timeout_seconds=7200,
        )
        phase2_rc = max(phase2_rc, rc2a)

        # 2b. Restaurants
        rest_cmd = [
            py, str(ROOT / "scrape_venue_specials.py"),
            "--venue-type", "restaurant",
            "--skip-specials",
            "--limit", str(args.venue_enrichment_limit),
        ]
        if not args.apply:
            rest_cmd.append("--dry-run")

        rc2b = run_step(
            "Phase 2b: Venue enrichment — restaurants (hours, desc, meta)",
            rest_cmd,
            timeout_seconds=7200,
        )
        phase2_rc = max(phase2_rc, rc2b)

        # 2c. Music venues
        music_cmd = [
            py, str(ROOT / "scrape_venue_specials.py"),
            "--venue-type", "music_venue",
            "--skip-specials",
            "--limit", str(args.venue_enrichment_limit),
        ]
        if not args.apply:
            music_cmd.append("--dry-run")

        rc2c = run_step(
            "Phase 2c: Venue enrichment — music venues (hours, desc, meta)",
            music_cmd,
            timeout_seconds=7200,
        )
        phase2_rc = max(phase2_rc, rc2c)

        record_phase("venue_enrichment", phase2_rc)
        if phase2_rc != 0 and not args.continue_on_error:
            print("[STOP] Phase 2 failed. Use --continue-on-error to proceed.")
            return _write_summary(phase_results, started_at, portal_slug, 1)

    # ── Phase 3: Venue image enrichment ────────────────────────────────
    if args.skip_venue_images:
        print("\n[SKIP] Phase 3: Venue image enrichment")
        record_phase("venue_images", 0, skipped=True)
    else:
        phase3_rc = 0

        # 3a. Scrape images from venue websites
        img_cmd = [
            py, str(ROOT / "scrape_venue_images.py"),
            "--limit", str(args.venue_image_limit),
        ]
        if not args.apply:
            img_cmd.append("--dry-run")

        rc3a = run_step("Phase 3a: Scrape venue images from websites", img_cmd)
        phase3_rc = max(phase3_rc, rc3a)

        # 3b. Google Places fallback for venues still missing images
        google_cmd = [
            py, str(ROOT / "fetch_venue_photos_google.py"),
            "--limit", str(args.google_image_limit),
        ]
        if not args.apply:
            google_cmd.append("--dry-run")

        rc3b = run_step("Phase 3b: Google Places image fallback", google_cmd)
        phase3_rc = max(phase3_rc, rc3b)

        record_phase("venue_images", phase3_rc)
        if phase3_rc != 0 and not args.continue_on_error:
            print("[STOP] Phase 3 failed. Use --continue-on-error to proceed.")
            return _write_summary(phase_results, started_at, portal_slug, 1)

    # ── Phase 4: Quality recompute ─────────────────────────────────────
    if args.skip_quality_audit:
        print("\n[SKIP] Phase 4: Quality audit recompute")
        record_phase("quality_audit", 0, skipped=True)
    else:
        audit_cmd = [
            py, str(SCRIPTS / "content_health_audit.py"),
            "--city", args.city,
        ]
        if portal_slug:
            audit_cmd.extend(["--portal", portal_slug])

        rc4 = run_step("Phase 4: Content health audit recompute", audit_cmd)
        record_phase("quality_audit", rc4)

    # ── Summary ────────────────────────────────────────────────────────
    failed_phases = [p for p in phase_results if p["status"] == "failed"]
    exit_code = 1 if failed_phases else 0
    return _write_summary(phase_results, started_at, portal_slug, exit_code)


def _write_summary(
    phase_results: list[dict],
    started_at: str,
    portal_slug: str | None,
    exit_code: int,
) -> int:
    """Write summary JSON to reports/ and print human-readable output."""
    finished_at = datetime.now(timezone.utc).isoformat()

    summary = {
        "pipeline": "enrichment",
        "started_at": started_at,
        "finished_at": finished_at,
        "portal": portal_slug,
        "phases": phase_results,
        "overall_status": "failed" if exit_code != 0 else "ok",
    }

    REPORTS.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    suffix = f"_{portal_slug}" if portal_slug else ""
    out_path = REPORTS / f"enrichment_pipeline_{today}{suffix}.json"
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\nWrote pipeline summary: {out_path}")

    # Human-readable summary
    print(f"\n{'=' * 60}")
    print("  Enrichment Pipeline Summary")
    print(f"{'=' * 60}")
    for p in phase_results:
        icon = {"ok": "[OK]", "failed": "[FAIL]", "skipped": "[SKIP]"}.get(
            p["status"], "[??]"
        )
        print(f"  {icon} {p['phase']}")

    failed = [p for p in phase_results if p["status"] == "failed"]
    if failed:
        print(f"\n{len(failed)} phase(s) failed.")
    else:
        skipped = [p for p in phase_results if p["status"] == "skipped"]
        ok = [p for p in phase_results if p["status"] == "ok"]
        print(f"\n{len(ok)} phase(s) succeeded, {len(skipped)} skipped.")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
