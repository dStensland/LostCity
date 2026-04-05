#!/usr/bin/env python3
"""
One-command post-crawl maintenance for launch health.

Default flow:
1) apply closed venue registry
2) deactivate events on inactive venues (no-op when events.is_active is absent)
3) demote tentpole flags on inactive events
4) canonicalize exact same-source duplicates
5) canonicalize cross-source duplicates
6) launch health gate check

Optional:
- include conservative venue reactivation pass
- include portal-scoped short-description sweep to keep feed descriptions robust
"""

from __future__ import annotations

import argparse
import shlex
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def run_step(label: str, args: list[str]) -> int:
    cmd_str = " ".join(shlex.quote(part) for part in args)
    print(f"\n== {label} ==")
    print(f"$ {cmd_str}")
    result = subprocess.run(args)
    if result.returncode != 0:
        print(f"[ERROR] Step failed: {label} (exit={result.returncode})")
    else:
        print(f"[OK] {label}")
    return result.returncode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run post-crawl launch maintenance sequence.")
    parser.add_argument(
        "--start-date",
        default=date.today().isoformat(),
        help="Lower bound start_date for duplicate canonicalization.",
    )
    parser.add_argument(
        "--city",
        default="Atlanta",
        help="City scope for launch gate check and optional reactivation. Default: Atlanta.",
    )
    parser.add_argument(
        "--strict-city",
        action="store_true",
        help="Disable metro expansion for --city Atlanta in scoped checks.",
    )
    parser.add_argument(
        "--portal",
        help=(
            "Optional portal slug scope. If omitted and --city Atlanta, defaults to atlanta. "
            "Used for short-description sweeps and launch health checks."
        ),
    )
    parser.add_argument(
        "--include-reactivation",
        action="store_true",
        help="Run conservative inactive-venue reactivation pass.",
    )
    parser.add_argument(
        "--reactivation-min-visible-events",
        type=int,
        default=2,
        help="Min visible events for reactivation candidates. Default: 2.",
    )
    parser.add_argument(
        "--skip-short-description-sweep",
        action="store_true",
        help="Skip iterative short-description sweep step.",
    )
    parser.add_argument(
        "--skip-inactive-tentpole-demotion",
        action="store_true",
        help="Skip demotion step for inactive events currently marked as tentpoles.",
    )
    parser.add_argument(
        "--short-description-sweep-max-passes",
        type=int,
        default=4,
        help="Maximum iterative sweep passes. Default: 4.",
    )
    parser.add_argument(
        "--short-description-sweep-batch-size",
        type=int,
        default=60,
        help="Max source slugs per enrichment batch. Default: 60.",
    )
    parser.add_argument(
        "--short-description-sweep-limit",
        type=int,
        default=20000,
        help="Candidate limit per enrichment batch. Default: 20000.",
    )
    parser.add_argument(
        "--short-description-threshold",
        type=int,
        default=220,
        help="Description length threshold for sweep targeting. Default: 220.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dry-run write steps where supported.",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Continue remaining steps even if one step fails.",
    )
    parser.add_argument(
        "--skip-best-effort",
        action="store_true",
        help="Skip best-effort steps (cross-source canonicalization + description sweeps).",
    )
    parser.add_argument(
        "--fail-on-best-effort",
        action="store_true",
        help="Return non-zero if any best-effort step fails.",
    )
    return parser.parse_args()


def resolve_portal_slug(city: str, explicit_portal: Optional[str]) -> Optional[str]:
    if explicit_portal and explicit_portal.strip():
        return explicit_portal.strip()
    if city.strip().lower() == "atlanta":
        return "atlanta"
    return None


def run_short_description_sweep(args: argparse.Namespace, py: str, portal_slug: Optional[str]) -> int:
    """Disabled: synthetic description enrichment removed.

    Previously invoked enrich_eventbrite_descriptions.py and
    enrich_non_eventbrite_descriptions.py to fill short descriptions
    with template-assembled metadata. This produced machine-readable
    descriptions that degraded content quality. See spec:
    docs/superpowers/specs/2026-03-30-description-pipeline-fix.md
    """
    print("\n== Short-description sweep ==")
    print("[SKIP] Synthetic description enrichment disabled (pipeline fix 2026-03-30)")
    return 0


def deactivate_ghost_series(*, dry_run: bool = False) -> int:
    """Deactivate series with zero future events that are older than 60 days."""
    from db import get_client

    client = get_client()
    mode = "dry-run" if dry_run else "apply"
    print(f"\n== Deactivate ghost series ({mode}) ==")

    # Get all series IDs that have at least one future active event
    active_series_ids: set[str] = set()
    page_start = 0
    page_size = 1000
    while True:
        q = client.table("events").select("series_id")
        q = q.gte("start_date", date.today().isoformat())
        q = q.filter("series_id", "not.is", "null")
        events_page = q.range(page_start, page_start + page_size - 1).execute().data or []
        for row in events_page:
            if row.get("series_id"):
                active_series_ids.add(row["series_id"])
        if len(events_page) < page_size:
            break
        page_start += page_size

    # Get all active series
    all_series: list[dict] = []
    page_start = 0
    while True:
        page = (
            client.table("series")
            .select("id,title,series_type")
            .eq("is_active", True)
            .range(page_start, page_start + page_size - 1)
            .execute()
            .data or []
        )
        all_series.extend(page)
        if len(page) < page_size:
            break
        page_start += page_size

    ghost_ids = [s["id"] for s in all_series if s["id"] not in active_series_ids]

    if not ghost_ids:
        print("[OK] No ghost series found.")
        return 0

    print(f"Found {len(ghost_ids)} ghost series (active but no future events).")

    if dry_run:
        for gid in ghost_ids[:10]:
            print(f"  [would deactivate] {gid}")
        if len(ghost_ids) > 10:
            print(f"  ... and {len(ghost_ids) - 10} more")
        return 0

    # Deactivate in batches
    batch_size = 100
    deactivated = 0
    for i in range(0, len(ghost_ids), batch_size):
        batch = ghost_ids[i : i + batch_size]
        client.table("series").update({"is_active": False}).in_("id", batch).execute()
        deactivated += len(batch)

    print(f"[OK] Deactivated {deactivated} ghost series.")
    return 0


def fix_html_entities_in_series(*, dry_run: bool = False) -> int:
    """Fix HTML entities in series titles (e.g. &amp; → &)."""
    import html as html_mod
    from db import get_client

    client = get_client()
    mode = "dry-run" if dry_run else "apply"
    print(f"\n== Fix HTML entities in series titles ({mode}) ==")

    # Find series with HTML entities
    candidates: list[dict] = []
    for pattern in ["%&amp;%", "%&#%"]:
        result = (
            client.table("series")
            .select("id,title")
            .like("title", pattern)
            .limit(500)
            .execute()
        )
        if result.data:
            candidates.extend(result.data)

    # Dedupe
    seen: set[str] = set()
    unique: list[dict] = []
    for c in candidates:
        if c["id"] not in seen:
            seen.add(c["id"])
            unique.append(c)
    candidates = unique

    if not candidates:
        print("[OK] No HTML entities found in series titles.")
        return 0

    print(f"Found {len(candidates)} series with HTML entities.")
    fixed = 0
    for row in candidates:
        old_title = row["title"]
        # Loop to handle double-encoded entities like &amp;#8211;
        new_title = old_title
        for _ in range(3):  # max 3 passes
            decoded = html_mod.unescape(new_title)
            if decoded == new_title:
                break
            new_title = decoded
        if new_title == old_title:
            continue
        if dry_run:
            print(f"  [would fix] {old_title!r} → {new_title!r}")
        else:
            client.table("series").update({"title": new_title}).eq("id", row["id"]).execute()
        fixed += 1

    print(f"[{'would fix' if dry_run else 'OK'}] Fixed {fixed} series titles.")
    return 0


def main() -> int:
    args = parse_args()
    py = sys.executable
    portal_slug = resolve_portal_slug(args.city, args.portal)

    required_steps: list[tuple[str, list[str]]] = []
    best_effort_steps: list[tuple[str, list[str]]] = []

    apply_closed = [py, str(SCRIPTS / "apply_closed_venues.py")]
    if not args.dry_run:
        apply_closed.append("--apply")
    required_steps.append(("Apply closed venue registry", apply_closed))

    deactivate = [py, str(SCRIPTS / "deactivate_events_on_inactive_venues.py")]
    if not args.dry_run:
        deactivate.append("--apply")
    required_steps.append(("Deactivate events on inactive venues", deactivate))

    if args.include_reactivation:
        reactivate = [
            py,
            str(SCRIPTS / "reactivate_inactive_venues_with_future_events.py"),
            "--start-date",
            args.start_date,
            "--city",
            args.city,
            "--min-visible-events",
            str(args.reactivation_min_visible_events),
        ]
        if args.strict_city:
            reactivate.append("--strict-city")
        if args.dry_run:
            reactivate.append("--dry-run")
        else:
            reactivate.append("--apply")
        best_effort_steps.append(("Reactivate inactive venues with active future events", reactivate))

    if not args.skip_inactive_tentpole_demotion:
        demote_tentpoles = [py, str(SCRIPTS / "demote_inactive_tentpoles.py")]
        if not args.dry_run:
            demote_tentpoles.append("--apply")
        required_steps.append(("Demote inactive tentpole flags", demote_tentpoles))

    same_source = [
        py,
        str(SCRIPTS / "canonicalize_same_source_exact_duplicates.py"),
        "--start-date",
        args.start_date,
    ]
    if args.dry_run:
        same_source.append("--dry-run")
    required_steps.append(("Canonicalize same-source exact duplicates", same_source))

    if not args.skip_best_effort:
        checkpoint_path = ROOT / "reports" / "maintenance_checkpoints" / (
            f"cross_source_dupes_{args.start_date}_{portal_slug or 'global'}.json"
        )
        cross_source = [
            py,
            str(SCRIPTS / "canonicalize_cross_source_duplicates.py"),
            "--start-date",
            args.start_date,
            "--page-size",
            "300",
            "--max-retries",
            "5",
            "--retry-base-seconds",
            "1.5",
            "--checkpoint-file",
            str(checkpoint_path),
        ]
        if args.dry_run:
            cross_source.append("--dry-run")
        best_effort_steps.append(("Canonicalize cross-source duplicates", cross_source))

        # Fuzzy cross-source dedup (catches near-duplicates missed by exact canonicalization)
        fuzzy_dedup = [
            py,
            str(ROOT / "post_crawl_dedup.py"),
            "--write",
            "--days",
            "30",
        ]
        if args.dry_run:
            fuzzy_dedup = [
                py,
                str(ROOT / "post_crawl_dedup.py"),
                "--dry-run",
                "--days",
                "30",
            ]
        best_effort_steps.append(("Fuzzy cross-source dedup", fuzzy_dedup))

    required_failures = 0
    best_effort_failures = 0
    stop_required_pipeline = False

    for label, step_cmd in required_steps:
        rc = run_step(label, step_cmd)
        if rc != 0:
            required_failures += 1
            if not args.continue_on_error:
                print(
                    f"[STOP] Required step failed and --continue-on-error not set: {label}. "
                    "Proceeding directly to launch gate check."
                )
                stop_required_pipeline = True
                break

    if not stop_required_pipeline and not args.skip_best_effort:
        for label, step_cmd in best_effort_steps:
            rc = run_step(label, step_cmd)
            if rc != 0:
                best_effort_failures += 1
                print(f"[WARN] Best-effort step failed and will not block launch gate: {label}")

    if args.skip_best_effort:
        print("\n== Best-effort steps ==")
        print("[SKIP] --skip-best-effort set")
    else:
        try:
            rc = run_short_description_sweep(args, py, portal_slug)
        except Exception as exc:
            print(f"[ERROR] Short-description sweep failed: {exc}")
            rc = 1
        if rc != 0:
            best_effort_failures += 1
            print("[WARN] Best-effort short-description sweep failed and will not block launch gate.")

    # --- Inline maintenance steps (series hygiene) ---
    try:
        fix_html_entities_in_series(dry_run=args.dry_run)
    except Exception as exc:
        print(f"[WARN] HTML entity fix failed: {exc}")
        best_effort_failures += 1

    try:
        deactivate_ghost_series(dry_run=args.dry_run)
    except Exception as exc:
        print(f"[WARN] Ghost series cleanup failed: {exc}")
        best_effort_failures += 1

    # --- Refresh venue specials (biweekly cadence) ---
    # The specials scraper uses --max-age-days=14 by default, so it auto-skips
    # venues verified within 14 days. This naturally creates a biweekly cadence.
    try:
        specials_cmd = [
            py,
            str(SCRIPTS.parent / "scrape_venue_specials.py"),
            "--venue-type", "bar",
            "--limit", "50",
        ]
        if args.dry_run:
            specials_cmd.append("--dry-run")
        rc = run_step("Refresh venue specials (bars)", specials_cmd)
        if rc != 0:
            best_effort_failures += 1
            print("[WARN] Venue specials refresh failed (non-blocking)")
    except Exception as exc:
        print(f"[WARN] Venue specials refresh failed: {exc}")
        best_effort_failures += 1

    # --- Refresh pre-computed feed counts (feed_category_counts table) ---
    # Calls refresh_feed_counts(portal_id) for every active portal so the
    # city-pulse feed endpoint can read pre-aggregated counts instead of
    # issuing 3 heavy category-scan queries per cold load.
    if not args.dry_run:
        try:
            from db import get_client

            client = get_client()
            print("\n== Refresh feed category counts ==")
            portal_rows = (
                client.table("portals")
                .select("id,slug")
                .eq("status", "active")
                .execute()
                .data
                or []
            )
            refreshed = 0
            for portal in portal_rows:
                pid = portal.get("id")
                pslug = portal.get("slug", pid)
                if not pid:
                    continue
                try:
                    client.rpc("refresh_feed_counts", {"p_portal_id": pid}).execute()
                    print(f"  [OK] portal={pslug}")
                    refreshed += 1
                except Exception as exc_inner:
                    print(f"  [WARN] portal={pslug}: {exc_inner}")
                    best_effort_failures += 1
            print(f"[OK] Refreshed feed counts for {refreshed}/{len(portal_rows)} portals.")
        except Exception as exc:
            print(f"[WARN] Feed counts refresh failed: {exc}")
            best_effort_failures += 1
    else:
        print("\n== Refresh feed category counts ==")
        print("[SKIP] dry-run — skipping refresh_feed_counts RPC calls")

    # --- Refresh pre-computed feed events (feed_events_ready table) ---
    # Calls refresh_feed_events_ready(portal_id) for every active portal so the
    # feed endpoint can read a single flat table instead of 4+ parallel joins.
    if not args.dry_run:
        try:
            from db import get_client

            client = get_client()
            print("\n== Refresh feed events ready ==")
            portal_rows = (
                client.table("portals")
                .select("id,slug")
                .eq("status", "active")
                .execute()
                .data
                or []
            )
            refreshed = 0
            for portal in portal_rows:
                pid = portal.get("id")
                pslug = portal.get("slug", pid)
                if not pid:
                    continue
                try:
                    client.rpc("refresh_feed_events_ready", {"p_portal_id": pid}).execute()
                    print(f"  [OK] portal={pslug}")
                    refreshed += 1
                except Exception as exc_inner:
                    print(f"  [WARN] portal={pslug}: {exc_inner}")
                    best_effort_failures += 1
            print(f"[OK] Refreshed feed events ready for {refreshed}/{len(portal_rows)} portals.")
        except Exception as exc:
            print(f"[WARN] Feed events ready refresh failed: {exc}")
            best_effort_failures += 1
    else:
        print("\n== Refresh feed events ready ==")
        print("[SKIP] dry-run — skipping refresh_feed_events_ready RPC calls")

    launch_check = [
        py,
        str(SCRIPTS / "launch_health_check.py"),
        "--city",
        args.city,
    ]
    if portal_slug:
        launch_check.extend(["--portal", portal_slug])
    if args.strict_city:
        launch_check.append("--strict-city")

    rc = run_step("Launch health gate check", launch_check)
    gate_failures = 0
    if rc != 0:
        gate_failures += 1

    if required_failures or gate_failures or (args.fail_on_best_effort and best_effort_failures):
        print(
            "\nCompleted with blocking failures: "
            f"required={required_failures}, gate={gate_failures}, best_effort={best_effort_failures}"
        )
        return 1

    if best_effort_failures:
        print(
            "\nCompleted with non-blocking best-effort failures: "
            f"{best_effort_failures}"
        )
    else:
        print("\nPost-crawl maintenance completed successfully.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
