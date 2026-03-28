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
from collections import Counter
import shlex
import subprocess
import sys
from datetime import date, datetime, timedelta
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


def chunked(items: list[str], size: int) -> list[list[str]]:
    if size <= 0:
        return [items]
    return [items[i : i + size] for i in range(0, len(items), size)]


def clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(str(value).split()).strip()


def format_time_label(value: Optional[str]) -> Optional[str]:
    raw = clean_text(value)
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def format_price_note(price_min: Optional[float], price_max: Optional[float]) -> Optional[str]:
    if price_min is None and price_max is None:
        return None
    if price_min is not None and price_max is not None:
        if float(price_min) == float(price_max):
            return f"Ticket price: ${float(price_min):.0f}."
        return f"Ticket range: ${float(price_min):.0f}-${float(price_max):.0f}."
    if price_min is not None:
        return f"Tickets from ${float(price_min):.0f}."
    return f"Tickets up to ${float(price_max):.0f}."


def resolve_portal_id(client, portal_slug: Optional[str]) -> Optional[str]:
    slug = clean_text(portal_slug)
    if not slug:
        return None
    portal_rows = (
        client.table("portals")
        .select("id,slug")
        .eq("slug", slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not portal_rows:
        raise RuntimeError(f"Portal slug not found: {slug}")
    portal_id = clean_text(portal_rows[0].get("id"))
    if not portal_id:
        raise RuntimeError(f"Portal slug resolved without id: {slug}")
    return portal_id


def fetch_short_description_source_counts(
    *,
    portal_slug: Optional[str],
    start_date: str,
    threshold: int,
) -> tuple[list[tuple[str, int]], int]:
    from db import get_client

    client = get_client()
    portal_id = resolve_portal_id(client, portal_slug)

    source_rows = client.table("sources").select("id,slug").execute().data or []
    slug_by_id = {
        int(row["id"]): str(row.get("slug") or row["id"])
        for row in source_rows
        if row.get("id") is not None
    }

    short_counts: Counter[str] = Counter()
    null_source_short_count = 0
    start = 0
    page_size = 1000
    include_active_filter = True

    while True:
        query = (
            client.table("events")
            .select("source_id,description")
            .gte("start_date", start_date)
            .is_("canonical_event_id", "null")
        )
        if include_active_filter:
            query = query.eq("is_active", True)
        if portal_id:
            query = query.or_(f"portal_id.is.null,portal_id.eq.{portal_id}")

        try:
            rows = query.range(start, start + page_size - 1).execute().data or []
        except Exception as exc:
            # Compatibility fallback when events.is_active is not available.
            if include_active_filter and "is_active" in str(exc):
                include_active_filter = False
                short_counts = Counter()
                start = 0
                continue
            raise

        if not rows:
            break

        for row in rows:
            description = str(row.get("description") or "").strip()
            if len(description) >= threshold:
                continue
            source_id = row.get("source_id")
            if source_id is None:
                null_source_short_count += 1
                continue
            try:
                source_key = int(source_id)
            except Exception:
                continue
            slug = slug_by_id.get(source_key, str(source_key))
            short_counts[slug] += 1

        if len(rows) < page_size:
            break
        start += page_size

    return (
        sorted(short_counts.items(), key=lambda item: (-item[1], item[0])),
        int(null_source_short_count),
    )


def build_null_source_description(event: dict, venue: Optional[dict]) -> str:
    title = clean_text(event.get("title")) or "Local event"
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    end_time = format_time_label(clean_text(event.get("end_time")) or None)
    source_url = clean_text(event.get("source_url"))
    ticket_url = clean_text(event.get("ticket_url"))
    is_free = bool(event.get("is_free"))
    price_note = format_price_note(event.get("price_min"), event.get("price_max"))

    venue_name = clean_text((venue or {}).get("name"))
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current:
        parts.append(current if current.endswith(".") else f"{current}.")
    else:
        # No real description — don't fabricate filler. Return empty string
        # so the caller skips this event (a NULL description is better than
        # boilerplate that restates structured fields).
        return ""

    if venue_name:
        if neighborhood:
            parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
        else:
            parts.append(f"Location: {venue_name}, {city}, {state}.")
    else:
        parts.append("Location details are listed on the official event page.")

    if start_date and start_time and end_time:
        parts.append(f"Scheduled on {start_date} from {start_time} to {end_time}.")
    elif start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if is_free:
        parts.append("Admission: free.")
    elif price_note:
        parts.append(price_note)

    if ticket_url:
        parts.append(f"Use the ticket link for latest availability and entry details ({ticket_url}).")
    elif source_url:
        parts.append(f"Check the official listing for current details and policy updates ({source_url}).")
    else:
        parts.append("Check the official listing for current details before attending.")

    return " ".join(parts)[:1600]


def sweep_null_source_short_descriptions(
    *,
    portal_slug: Optional[str],
    start_date: str,
    threshold: int,
    limit: int,
    apply_updates: bool,
) -> tuple[int, int]:
    from db import get_client

    client = get_client()
    portal_id = resolve_portal_id(client, portal_slug)

    include_active_filter = True
    start = 0
    page_size = 1000
    candidates: list[dict] = []

    while True:
        query = (
            client.table("events")
            .select(
                "id,title,description,start_date,start_time,end_time,source_url,ticket_url,"
                "is_free,price_min,price_max,place_id"
            )
            .gte("start_date", start_date)
            .is_("canonical_event_id", "null")
            .is_("source_id", "null")
        )
        if include_active_filter:
            query = query.eq("is_active", True)
        if portal_id:
            query = query.or_(f"portal_id.is.null,portal_id.eq.{portal_id}")

        try:
            rows = query.range(start, start + page_size - 1).execute().data or []
        except Exception as exc:
            if include_active_filter and "is_active" in str(exc):
                include_active_filter = False
                candidates = []
                start = 0
                continue
            raise

        if not rows:
            break
        for row in rows:
            if len(clean_text(row.get("description"))) < threshold:
                candidates.append(row)
            if len(candidates) >= limit:
                break
        if len(candidates) >= limit or len(rows) < page_size:
            break
        start += page_size

    if not candidates:
        return (0, 0)

    venue_ids = sorted(
        {
            int(row["place_id"])
            for row in candidates
            if row.get("place_id") is not None
        }
    )
    venue_map: dict[int, dict] = {}
    if venue_ids:
        venue_rows = (
            client.table("places")
            .select("id,name,neighborhood,city,state")
            .in_("id", venue_ids)
            .execute()
            .data
            or []
        )
        for row in venue_rows:
            if row.get("id") is None:
                continue
            venue_map[int(row["id"])] = row

    improved = 0
    updated = 0
    mode = "apply" if apply_updates else "dry-run"
    print(f"\n== Source-less short-description sweep ({mode}) ==")

    for event in candidates:
        event_id = int(event["id"])
        current = clean_text(event.get("description"))
        venue = venue_map.get(int(event["place_id"])) if event.get("place_id") is not None else None
        enriched = build_null_source_description(event, venue)
        if not enriched or enriched == current:
            continue
        if len(enriched) < threshold and len(enriched) <= len(current):
            continue

        improved += 1
        title = clean_text(event.get("title"))
        print(
            f"[improved] source=<null> id={event_id} len {len(current)} -> {len(enriched)} "
            f"title={title[:90]}"
        )

        if apply_updates:
            client.table("events").update({"description": enriched}).eq("id", event_id).execute()
            updated += 1

    print(
        f"Done ({mode}) source-less sweep: candidates={len(candidates)} "
        f"improved={improved} updated={updated}"
    )
    return (improved, updated)


def run_short_description_sweep(args: argparse.Namespace, py: str, portal_slug: Optional[str]) -> int:
    if args.skip_short_description_sweep:
        print("\n== Short-description sweep ==")
        print("[SKIP] --skip-short-description-sweep set")
        return 0

    if not portal_slug:
        print("\n== Short-description sweep ==")
        print("[SKIP] No portal scope resolved for this run")
        return 0

    max_passes = 1 if args.dry_run else max(1, int(args.short_description_sweep_max_passes))
    batch_size = max(1, int(args.short_description_sweep_batch_size))
    limit = max(1, int(args.short_description_sweep_limit))
    threshold = max(1, int(args.short_description_threshold))

    previous_total: Optional[int] = None

    for sweep_pass in range(1, max_passes + 1):
        source_counts, null_source_short_count = fetch_short_description_source_counts(
            portal_slug=portal_slug,
            start_date=args.start_date,
            threshold=threshold,
        )
        total_short = sum(count for _, count in source_counts) + int(null_source_short_count)
        source_total = len(source_counts) + (1 if null_source_short_count > 0 else 0)
        print(
            f"\n== Short-description sweep pass {sweep_pass}/{max_passes} =="
            f"\nTarget scope portal={portal_slug}, start_date={args.start_date}, "
            f"short<{threshold}, sources={source_total}, events={total_short}"
            f"\nsource-less short events={null_source_short_count}"
        )

        if total_short <= 0:
            print("[OK] No short descriptions remain in scoped visible future events.")
            return 0
        if previous_total is not None and total_short >= previous_total:
            print("[STOP] No further reduction detected; ending sweep loop.")
            return 0
        previous_total = total_short

        source_slugs = [slug for slug, _ in source_counts]
        eventbrite_slugs = [slug for slug in source_slugs if slug.startswith("eventbrite")]
        non_eventbrite_slugs = [slug for slug in source_slugs if not slug.startswith("eventbrite")]

        if non_eventbrite_slugs:
            batches = chunked(non_eventbrite_slugs, batch_size)
            for idx, batch in enumerate(batches, start=1):
                cmd = [
                    py,
                    str(SCRIPTS / "enrich_non_eventbrite_descriptions.py"),
                    "--portal",
                    portal_slug,
                    "--start-date",
                    args.start_date,
                    "--limit",
                    str(limit),
                    "--source-slugs",
                    ",".join(batch),
                ]
                if not args.dry_run:
                    cmd.append("--apply")
                rc = run_step(
                    f"Short-desc non-Eventbrite sweep {sweep_pass}.{idx}/{len(batches)}",
                    cmd,
                )
                if rc != 0:
                    return rc

        if eventbrite_slugs:
            cmd = [
                py,
                str(SCRIPTS / "enrich_eventbrite_descriptions.py"),
                "--portal",
                portal_slug,
                "--start-date",
                args.start_date,
                "--limit",
                str(limit),
                "--source-slug",
                "eventbrite",
            ]
            if not args.dry_run:
                cmd.append("--apply")
            rc = run_step(f"Short-desc Eventbrite sweep {sweep_pass}", cmd)
            if rc != 0:
                return rc

        if null_source_short_count > 0:
            sweep_null_source_short_descriptions(
                portal_slug=portal_slug,
                start_date=args.start_date,
                threshold=threshold,
                limit=limit,
                apply_updates=not args.dry_run,
            )

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
