#!/usr/bin/env python3
"""
dedup_backfill.py — One-time dedup backfill against production events.

Two passes:

1. ARSE self-dedup backfill
   Find future active events from the atlanta-recurring-social source where a
   non-ARSE source already covers the same venue_id + start_date with any active
   event.  ARSE events are low-quality synthetic placeholders — if the real venue
   has a dedicated crawler the ARSE copy should be deactivated.
   Action: set is_active=False on the ARSE copy.

2. Ticketmaster cross-source dedup backfill
   Find future active events from the ticketmaster source where a non-TM source
   already covers the same venue_id + start_date with a normalized-title match.
   Action: set canonical_event_id to the primary-source event ID and set
   is_active=False on the TM copy.

Usage:
    python3 dedup_backfill.py --dry-run          # preview both passes (default)
    python3 dedup_backfill.py --fix              # apply both passes
    python3 dedup_backfill.py --arse-only --fix  # only ARSE pass
    python3 dedup_backfill.py --tm-only --fix    # only Ticketmaster pass
    python3 dedup_backfill.py --verbose          # extra output
"""

from __future__ import annotations

import argparse
import sys
import time
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

# Allow running from the crawlers/ directory directly.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from db import get_client
from dedupe import normalize_text

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ARSE_SOURCE_SLUG = "atlanta-recurring-social"
TM_SOURCE_SLUG = "ticketmaster"

PAGE_SIZE = 500
TITLE_SIMILARITY_THRESHOLD = 85  # rapidfuzz ratio threshold for TM title match

# How similar two normalized titles must be for the TM pass (0-100).
# We use exact-normalized match for ARSE (any non-ARSE event at same venue+date)
# and a fuzzy ratio for TM.
try:
    from rapidfuzz import fuzz as _fuzz

    def title_ratio(a: str, b: str) -> float:
        return _fuzz.ratio(a, b)

except ImportError:
    # Fallback: exact normalized match only.
    def title_ratio(a: str, b: str) -> float:  # type: ignore[misc]
        return 100.0 if a == b else 0.0


# ---------------------------------------------------------------------------
# Retry helper
# ---------------------------------------------------------------------------


def _is_transient(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(
        m in text
        for m in (
            "timeout",
            "timed out",
            "connection reset",
            "connectionterminated",
            "protocol_error",
            "resource temporarily unavailable",
        )
    )


def _retry(name: str, fn, *, max_retries: int = 4, base: float = 1.0):
    for attempt in range(1, max_retries + 2):
        try:
            return fn()
        except Exception as exc:
            if attempt > max_retries or not _is_transient(exc):
                raise
            wait = base * (2 ** (attempt - 1))
            print(f"  [retry] {name} attempt {attempt}/{max_retries}: {exc}; sleeping {wait:.1f}s")
            time.sleep(wait)


# ---------------------------------------------------------------------------
# Source lookup
# ---------------------------------------------------------------------------


def _lookup_source_id(client, slug: str) -> int | None:
    """Resolve a source slug to its database ID."""
    result = _retry(
        f"lookup source {slug}",
        lambda: client.table("sources").select("id").eq("slug", slug).maybe_single().execute(),
    )
    if result and result.data:
        return result.data["id"]
    return None


def _build_primary_source_ids(client) -> set[int]:
    """
    Return the set of source IDs that are dedicated (non-aggregator) sources.
    Aggregator/synthetic sources (ARSE, TM, Eventbrite, etc.) are excluded.
    Sources table is small — we fetch it all and filter client-side.
    """
    # Fetch all sources so we can filter client-side.  Sources table is small.
    result = _retry(
        "fetch all sources",
        lambda: client.table("sources").select("id, slug, name").execute(),
    )
    rows = result.data or [] if result else []

    # Build slug->source map.  Aggregator/synthetic slugs excluded.
    aggregator_prefixes = ("ticketmaster", "eventbrite", "mobilize", "bigtickets")
    aggregator_exact = {
        "atlanta-recurring-social",
        "instagram-captions",
        "creative-loafing",
        "artsatl-calendar",
    }

    def _is_primary(slug: str) -> bool:
        s = (slug or "").lower().strip()
        if s in aggregator_exact:
            return False
        if s.startswith(aggregator_prefixes):
            return False
        if s.endswith("-test"):
            return False
        return True

    return {r["id"] for r in rows if _is_primary(r.get("slug", ""))}


# ---------------------------------------------------------------------------
# Pagination helper
# ---------------------------------------------------------------------------


def _fetch_source_events(
    client,
    source_id: int,
    today: str,
    verbose: bool = False,
) -> list[dict]:
    """
    Fetch all future active events for a given source_id, paginated.
    Returns list of event dicts with id, title, venue_id, start_date,
    start_time, canonical_event_id.
    """
    fields = "id,title,venue_id,start_date,start_time,canonical_event_id"
    rows: list[dict] = []
    offset = 0

    while True:
        batch = _retry(
            f"fetch events source={source_id} offset={offset}",
            lambda o=offset: (
                client.table("events")
                .select(fields)
                .eq("source_id", source_id)
                .eq("is_active", True)
                .gte("start_date", today)
                .order("id")
                .range(o, o + PAGE_SIZE - 1)
                .execute()
            ),
        )
        page = (batch.data or []) if batch else []
        if verbose:
            print(f"  fetched page offset={offset} count={len(page)}")
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    return rows


def _fetch_venue_events_other_sources(
    client,
    venue_id: int,
    start_date: str,
    exclude_source_id: int,
    today: str,
    primary_source_ids: set[int] | None = None,
) -> list[dict]:
    """
    Fetch active events at a venue on a specific date from sources other than
    exclude_source_id.  Optionally filter to primary-source events only.
    """
    fields = "id,title,source_id,start_date,start_time,canonical_event_id"
    result = _retry(
        f"venue events venue={venue_id} date={start_date}",
        lambda: (
            client.table("events")
            .select(fields)
            .eq("place_id", venue_id)
            .eq("start_date", start_date)
            .eq("is_active", True)
            .neq("source_id", exclude_source_id)
            .execute()
        ),
    )
    rows = (result.data or []) if result else []

    if primary_source_ids is not None:
        rows = [r for r in rows if r.get("source_id") in primary_source_ids]

    return rows


# ---------------------------------------------------------------------------
# Pass 1: ARSE self-dedup
# ---------------------------------------------------------------------------


def run_arse_pass(
    client,
    arse_source_id: int,
    primary_source_ids: set[int],
    today: str,
    dry_run: bool,
    verbose: bool,
) -> dict[str, int]:
    """
    Find future active ARSE events where a primary source already covers the
    same venue+date.  Deactivate the ARSE copy.

    Returns stats dict.
    """
    print(f"\n=== Pass 1: ARSE self-dedup (source_id={arse_source_id}) ===")

    arse_events = _fetch_source_events(client, arse_source_id, today, verbose=verbose)
    print(f"  Found {len(arse_events)} future active ARSE events to examine")

    deactivated = 0
    skipped = 0

    # Group for readable output.
    by_venue: dict[int, list[str]] = defaultdict(list)

    for ev in arse_events:
        venue_id = ev.get("venue_id")
        start_date = ev.get("start_date")
        title = ev.get("title", "")
        ev_id = ev["id"]

        if not venue_id or not start_date:
            skipped += 1
            continue

        # Check if any primary source already covers this venue+date.
        covering = _fetch_venue_events_other_sources(
            client,
            venue_id,
            start_date,
            exclude_source_id=arse_source_id,
            today=today,
            primary_source_ids=primary_source_ids,
        )

        if not covering:
            skipped += 1
            continue

        # A primary source covers this slot — deactivate ARSE copy.
        deactivated += 1
        label = f"{title[:60]!r} on {start_date} (id={ev_id})"

        if verbose:
            covering_summary = ", ".join(
                f"src={r.get('source_id')} {r.get('title', '')[:40]!r}"
                for r in covering[:3]
            )
            by_venue[venue_id].append(f"  DEACTIVATE {label}  <- covered by [{covering_summary}]")
        else:
            by_venue[venue_id].append(f"  DEACTIVATE {label}")

        if not dry_run:
            _retry(
                f"deactivate ARSE event {ev_id}",
                lambda eid=ev_id: (
                    client.table("events")
                    .update({"is_active": False})
                    .eq("id", eid)
                    .execute()
                ),
            )

    # Print grouped output.
    if verbose or deactivated > 0:
        for venue_id, lines in sorted(by_venue.items()):
            print(f"\n  Venue {venue_id}:")
            for line in lines:
                print(f"  {line}")

    print(f"\n  ARSE pass complete: {deactivated} deactivated, {skipped} skipped (no coverage)")
    return {"deactivated": deactivated, "skipped": skipped}


# ---------------------------------------------------------------------------
# Pass 2: Ticketmaster cross-source dedup
# ---------------------------------------------------------------------------


def run_tm_pass(
    client,
    tm_source_id: int,
    primary_source_ids: set[int],
    today: str,
    dry_run: bool,
    verbose: bool,
) -> dict[str, int]:
    """
    Find future active TM events where a primary source covers the same
    venue+date with a similar title.  Set canonical_event_id to the primary
    source's event and deactivate the TM copy.

    Returns stats dict.
    """
    print(f"\n=== Pass 2: Ticketmaster cross-source dedup (source_id={tm_source_id}) ===")

    tm_events = _fetch_source_events(client, tm_source_id, today, verbose=verbose)
    print(f"  Found {len(tm_events)} future active TM events to examine")

    canonicalized = 0
    skipped = 0
    already_done = 0

    by_venue: dict[int, list[str]] = defaultdict(list)

    for ev in tm_events:
        venue_id = ev.get("venue_id")
        start_date = ev.get("start_date")
        title = ev.get("title", "")
        ev_id = ev["id"]
        existing_canonical = ev.get("canonical_event_id")

        if not venue_id or not start_date or not title:
            skipped += 1
            continue

        # Already canonicalized — skip.
        if existing_canonical is not None:
            already_done += 1
            continue

        norm_tm_title = normalize_text(title)
        if not norm_tm_title:
            skipped += 1
            continue

        # Find primary-source events at same venue+date.
        candidates = _fetch_venue_events_other_sources(
            client,
            venue_id,
            start_date,
            exclude_source_id=tm_source_id,
            today=today,
            primary_source_ids=primary_source_ids,
        )

        if not candidates:
            skipped += 1
            continue

        # Find best title match among candidates.
        best_match: dict | None = None
        best_score = 0.0

        for cand in candidates:
            norm_cand = normalize_text(cand.get("title", ""))
            if not norm_cand:
                continue
            score = title_ratio(norm_tm_title, norm_cand)
            if score >= TITLE_SIMILARITY_THRESHOLD and score > best_score:
                best_score = score
                best_match = cand

        if best_match is None:
            skipped += 1
            continue

        # Resolve the canonical: if best_match itself points at a canonical,
        # use that upstream canonical.
        canonical_target_id: int = best_match["id"]
        if best_match.get("canonical_event_id"):
            canonical_target_id = best_match["canonical_event_id"]

        canonicalized += 1
        label = (
            f"{title[:55]!r} on {start_date} (id={ev_id})"
            f" -> canonical={canonical_target_id} [{best_score:.0f}%]"
        )

        if verbose:
            by_venue[venue_id].append(f"  CANONICALIZE {label}")
        else:
            by_venue[venue_id].append(f"  CANONICALIZE {label}")

        if not dry_run:
            _retry(
                f"canonicalize TM event {ev_id}",
                lambda eid=ev_id, cid=canonical_target_id: (
                    client.table("events")
                    .update({"canonical_event_id": cid, "is_active": False})
                    .eq("id", eid)
                    .execute()
                ),
            )

    # Print grouped output.
    if verbose or canonicalized > 0:
        for venue_id, lines in sorted(by_venue.items()):
            print(f"\n  Venue {venue_id}:")
            for line in lines:
                print(f"  {line}")

    print(
        f"\n  TM pass complete: {canonicalized} canonicalized, "
        f"{already_done} already done, {skipped} skipped (no title match)"
    )
    return {"canonicalized": canonicalized, "already_done": already_done, "skipped": skipped}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="One-time dedup backfill: ARSE self-dedup and TM cross-source dedup",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--fix",
        action="store_true",
        help="Apply changes (default is dry-run)",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Preview changes without writing (default when --fix is omitted)",
    )
    parser.add_argument(
        "--arse-only",
        action="store_true",
        help="Run only the ARSE pass",
    )
    parser.add_argument(
        "--tm-only",
        action="store_true",
        help="Run only the Ticketmaster pass",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Print per-event detail",
    )
    args = parser.parse_args()

    # Default to dry-run unless --fix is explicitly passed.
    dry_run = not args.fix

    today = date.today().isoformat()
    mode_label = "DRY RUN (preview)" if dry_run else "APPLYING CHANGES"
    print(f"dedup_backfill.py — {mode_label}")
    print(f"Date filter: start_date >= {today}")

    client = get_client()

    # Resolve source IDs.
    run_arse = not args.tm_only
    run_tm = not args.arse_only

    arse_source_id: int | None = None
    tm_source_id: int | None = None

    if run_arse:
        arse_source_id = _lookup_source_id(client, ARSE_SOURCE_SLUG)
        if arse_source_id is None:
            print(f"  WARNING: Source slug '{ARSE_SOURCE_SLUG}' not found in DB — skipping ARSE pass")
            run_arse = False
        else:
            print(f"  ARSE source '{ARSE_SOURCE_SLUG}' -> id={arse_source_id}")

    if run_tm:
        tm_source_id = _lookup_source_id(client, TM_SOURCE_SLUG)
        if tm_source_id is None:
            print(f"  WARNING: Source slug '{TM_SOURCE_SLUG}' not found in DB — skipping TM pass")
            run_tm = False
        else:
            print(f"  TM source '{TM_SOURCE_SLUG}' -> id={tm_source_id}")

    if not run_arse and not run_tm:
        print("  Nothing to run.")
        return

    # Build the set of primary source IDs once (used by both passes).
    primary_source_ids = _build_primary_source_ids(client)
    print(f"  Primary (non-aggregator) source IDs: {len(primary_source_ids)} sources")

    stats: dict[str, Any] = {}

    if run_arse and arse_source_id is not None:
        stats["arse"] = run_arse_pass(
            client,
            arse_source_id=arse_source_id,
            primary_source_ids=primary_source_ids,
            today=today,
            dry_run=dry_run,
            verbose=args.verbose,
        )

    if run_tm and tm_source_id is not None:
        stats["tm"] = run_tm_pass(
            client,
            tm_source_id=tm_source_id,
            primary_source_ids=primary_source_ids,
            today=today,
            dry_run=dry_run,
            verbose=args.verbose,
        )

    # Summary.
    print("\n=== Summary ===")
    if "arse" in stats:
        s = stats["arse"]
        print(f"  ARSE deactivated:       {s['deactivated']}")
        print(f"  ARSE skipped:           {s['skipped']}")
    if "tm" in stats:
        s = stats["tm"]
        print(f"  TM canonicalized:       {s['canonicalized']}")
        print(f"  TM already done:        {s['already_done']}")
        print(f"  TM skipped:             {s['skipped']}")
    if dry_run:
        print("\n  (DRY RUN — no changes written; pass --fix to apply)")


if __name__ == "__main__":
    main()
