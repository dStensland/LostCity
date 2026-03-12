#!/usr/bin/env python3
"""
City readiness check -- minimum viable criteria before a city goes "live".

Queries the database and prints a pass/fail report for each criterion.
Exits 0 if all checks pass, 1 if any fail.

Usage:
    python scripts/city_readiness_check.py --city Atlanta --state GA
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client  # noqa: E402

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------

CATEGORY_MIN_EVENTS_PER_WEEK = 30
CATEGORY_MIN_COUNT = 6

SOURCE_MIN_ACTIVE = 50

CORE_CATEGORIES = {"music", "nightlife", "food_drink", "art"}

IMAGE_COVERAGE_MIN_PCT = 80.0
IMAGE_EXCLUDE_CATEGORY = "film"  # TMDB fills these; not a meaningful coverage signal

NEIGHBORHOOD_NULL_MAX_PCT = 10.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _pct(numerator: int, denominator: int) -> float:
    return (numerator / denominator * 100.0) if denominator > 0 else 0.0


def _pass_fail(passing: bool) -> str:
    return "PASS" if passing else "FAIL"


def _marker(passing: bool) -> str:
    return "  [ok]" if passing else "  [!!]"


def _fetch_city_venue_ids(client, city: str, state: str) -> set[int]:
    """Return the set of venue IDs in the target city (case-insensitive)."""
    rows = (
        client.table("venues")
        .select("id,city,state")
        .execute()
        .data
        or []
    )
    return {
        int(r["id"])
        for r in rows
        if r.get("id") is not None
        and (r.get("city") or "").strip().lower() == city.strip().lower()
        and (r.get("state") or "").strip().upper() == state.strip().upper()
    }


def _fetch_future_events_for_venues(
    client,
    venue_ids: set[int],
    today: str,
    week_end: str,
) -> list[dict]:
    """
    Fetch active events in the next 7 days for the given venue IDs.

    Uses page-based fetching because Supabase returns at most 1 000 rows
    per request and many cities will have more than that.
    """
    if not venue_ids:
        return []

    all_rows: list[dict] = []
    page_size = 1000
    offset = 0

    while True:
        result = (
            client.table("events")
            .select("id,category_id,image_url,source_id,venue_id")
            .eq("is_active", True)
            .gte("start_date", today)
            .lte("start_date", week_end)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        page = result.data or []
        # Filter to city venue IDs in Python (avoids IN clause length limits)
        for row in page:
            vid = row.get("venue_id")
            if vid is not None and int(vid) in venue_ids:
                category_id = row.get("category_id")
                if category_id is None:
                    row["category"] = "other"
                else:
                    row["category"] = str(category_id).strip().lower().replace(" ", "_")
                all_rows.append(row)
        if len(page) < page_size:
            break
        offset += page_size

    return all_rows


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def check_category_coverage(events: list[dict]) -> tuple[bool, dict]:
    """6+ categories each with 30+ events in the next 7 days."""
    counts: Counter[str] = Counter()
    for e in events:
        cat = (e.get("category") or "other").strip().lower()
        counts[cat] += 1

    qualifying = {k: v for k, v in counts.items() if v >= CATEGORY_MIN_EVENTS_PER_WEEK}
    passing = len(qualifying) >= CATEGORY_MIN_COUNT

    return passing, {"counts": dict(counts), "qualifying": qualifying}


def check_active_sources(client, venue_ids: set[int], events: list[dict]) -> tuple[bool, dict]:
    """
    50+ active source crawlers tied to this city.

    Derived from distinct source_ids on future city events -- consistent
    with how content_health_audit.py scopes active sources to a city
    (sources table has no city column).
    """
    source_ids = {
        int(r["source_id"])
        for r in events
        if r.get("source_id") is not None
    }
    count = len(source_ids)
    passing = count >= SOURCE_MIN_ACTIVE
    return passing, {"active_source_count": count}


def check_core_categories(events: list[dict]) -> tuple[bool, dict]:
    """music, nightlife, food_drink, and art must each have at least 1 event."""
    counts: Counter[str] = Counter()
    for e in events:
        cat = (e.get("category") or "other").strip().lower()
        counts[cat] += 1

    coverage = {cat: counts.get(cat, 0) for cat in sorted(CORE_CATEGORIES)}
    passing = all(v > 0 for v in coverage.values())
    return passing, {"coverage": coverage}


def check_image_coverage(events: list[dict]) -> tuple[bool, dict]:
    """80%+ of non-film events must have an image_url."""
    non_film = [
        e for e in events
        if (e.get("category") or "").strip().lower() != IMAGE_EXCLUDE_CATEGORY
    ]
    total = len(non_film)
    with_image = sum(1 for e in non_film if e.get("image_url"))
    pct = _pct(with_image, total)
    passing = pct >= IMAGE_COVERAGE_MIN_PCT
    return passing, {"total": total, "with_image": with_image, "pct": pct}


def check_neighborhood_attribution(client, city: str, state: str) -> tuple[bool, dict]:
    """Less than 10% of city venues should have a null neighborhood."""
    rows = (
        client.table("venues")
        .select("id,neighborhood,city,state")
        .execute()
        .data
        or []
    )
    city_lower = city.strip().lower()
    state_upper = state.strip().upper()
    city_rows = [
        r for r in rows
        if (r.get("city") or "").strip().lower() == city_lower
        and (r.get("state") or "").strip().upper() == state_upper
    ]
    total = len(city_rows)
    null_count = sum(1 for r in city_rows if not r.get("neighborhood"))
    null_pct = _pct(null_count, total)
    passing = null_pct < NEIGHBORHOOD_NULL_MAX_PCT
    return passing, {"total": total, "null_count": null_count, "null_pct": null_pct}


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def check_city_readiness(city: str, state: str) -> bool:
    client = get_client()
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    week_end = (now + timedelta(days=7)).strftime("%Y-%m-%d")

    print()
    print("=" * 62)
    print(f"  City Readiness Check: {city}, {state}")
    print(f"  Evaluation window: {today} through {week_end}")
    print("=" * 62)
    print()

    # -- Shared data fetched once --
    venue_ids = _fetch_city_venue_ids(client, city, state)
    if not venue_ids:
        print(f"  ERROR: No venues found for {city}, {state}. Check --city / --state spelling.")
        print()
        return False

    events = _fetch_future_events_for_venues(
        client,
        venue_ids,
        today,
        week_end,
    )

    results: list[tuple[str, bool, str]] = []  # (label, passing, detail)

    # 1. Category coverage
    passing, data = check_category_coverage(events)
    qualifying = data["qualifying"]
    counts = data["counts"]
    label = (
        f"6+ categories with {CATEGORY_MIN_EVENTS_PER_WEEK}+ events/week"
    )
    detail_lines = []
    for cat, cnt in sorted(counts.items(), key=lambda x: -x[1]):
        ok = cnt >= CATEGORY_MIN_EVENTS_PER_WEEK
        detail_lines.append(f"    {'[ok]' if ok else '[ ]'} {cat}: {cnt}")
    summary = f"{len(qualifying)} qualifying categories (need {CATEGORY_MIN_COUNT})"
    results.append((label, passing, summary))

    print(f"1. {label}")
    print("-" * 50)
    for line in detail_lines:
        print(line)
    print(f"\n  Result: {_pass_fail(passing)} -- {summary}\n")

    # 2. Active sources
    passing, data = check_active_sources(client, venue_ids, events)
    count = data["active_source_count"]
    label = f"50+ active source crawlers"
    summary = f"{count} active sources with city events (need {SOURCE_MIN_ACTIVE})"
    results.append((label, passing, summary))

    print(f"2. {label}")
    print("-" * 50)
    print(f"  Sources with city events in window: {count}")
    print(f"\n  Result: {_pass_fail(passing)} -- {summary}\n")

    # 3. Core categories
    passing, data = check_core_categories(events)
    coverage = data["coverage"]
    label = "Core categories independently covered (music, nightlife, food_drink, art)"
    detail_lines = [
        f"    {'[ok]' if cnt > 0 else '[!!]'} {cat}: {cnt} events/week"
        for cat, cnt in sorted(coverage.items())
    ]
    missing = [cat for cat, cnt in coverage.items() if cnt == 0]
    summary = "all present" if not missing else f"missing: {', '.join(sorted(missing))}"
    results.append((label, passing, summary))

    print(f"3. Core categories")
    print("-" * 50)
    for line in detail_lines:
        print(line)
    print(f"\n  Result: {_pass_fail(passing)} -- {summary}\n")

    # 4. Image coverage
    passing, data = check_image_coverage(events)
    total = data["total"]
    with_image = data["with_image"]
    pct_val = data["pct"]
    label = f"Image coverage 80%+ (non-{IMAGE_EXCLUDE_CATEGORY} events)"
    summary = f"{with_image}/{total} events have images ({pct_val:.1f}%, need {IMAGE_COVERAGE_MIN_PCT:.0f}%)"
    results.append((label, passing, summary))

    print(f"4. {label}")
    print("-" * 50)
    print(f"  Non-{IMAGE_EXCLUDE_CATEGORY} events in window: {total}")
    print(f"  With image_url: {with_image} ({pct_val:.1f}%)")
    print(f"\n  Result: {_pass_fail(passing)} -- {summary}\n")

    # 5. Neighborhood attribution
    passing, data = check_neighborhood_attribution(client, city, state)
    total_v = data["total"]
    null_count = data["null_count"]
    null_pct = data["null_pct"]
    label = f"Neighborhood attribution (<{NEIGHBORHOOD_NULL_MAX_PCT:.0f}% null)"
    summary = (
        f"{null_count}/{total_v} venues missing neighborhood ({null_pct:.1f}%, "
        f"need <{NEIGHBORHOOD_NULL_MAX_PCT:.0f}%)"
    )
    results.append((label, passing, summary))

    print(f"5. {label}")
    print("-" * 50)
    print(f"  Venues in {city}, {state}: {total_v}")
    print(f"  Missing neighborhood: {null_count} ({null_pct:.1f}%)")
    print(f"\n  Result: {_pass_fail(passing)} -- {summary}\n")

    # -- Summary --
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    total_checks = len(results)
    overall = "READY TO LAUNCH" if failed == 0 else "NOT READY"

    print("=" * 62)
    print(f"  OVERALL: {overall}  ({passed}/{total_checks} checks passed)")
    print()
    if failed:
        print("  Blocking issues:")
        for label, ok, summary in results:
            if not ok:
                print(f"    [FAIL] {label}")
                print(f"           {summary}")
    print("=" * 62)
    print()

    return failed == 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check whether a city meets minimum viable criteria for going live."
    )
    parser.add_argument("--city", default="Atlanta", help="City name (default: Atlanta)")
    parser.add_argument("--state", default="GA", help="State abbreviation (default: GA)")
    args = parser.parse_args()

    ready = check_city_readiness(args.city, args.state)
    return 0 if ready else 1


if __name__ == "__main__":
    sys.exit(main())
