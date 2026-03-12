#!/usr/bin/env python3
"""
Source quality alerting — designed for cron job or post-crawl invocation.

Queries per-source quality metrics for upcoming events and flags sources
that exceed alert/warning thresholds. Prints a summary table to stdout
(captured by cron logs) and exits with code 1 if any ALERTs are found.

Usage:
    python3 quality_alerts.py
    python3 quality_alerts.py --min-events 10   # override minimum event floor

Exit codes:
    0 — all clear (no ALERTs)
    1 — one or more sources have triggered an ALERT threshold
"""

import os
import sys
import argparse
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Thresholds ────────────────────────────────────────────────────────────────

ALERT_HELD_PCT = 30        # held_pct >= this AND total_events >= 5 → ALERT
ALERT_MIN_EVENTS = 5

WARN_AVG_QUALITY = 40      # avg_quality < this AND total_events >= 10 → WARNING
WARN_MISSING_DESC_PCT = 80 # missing_desc_pct >= this AND total_events >= 10 → WARNING
WARN_MIDNIGHT_PCT = 50     # midnight_pct >= this AND total_events >= 10 → WARNING
WARN_NO_IMAGE_PCT = 90     # no_image_pct >= this AND total_events >= 10 → WARNING
WARN_MIN_EVENTS = 10

# ── SQL ───────────────────────────────────────────────────────────────────────

QUALITY_SQL = """
SELECT
    s.name,
    s.slug,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE e.is_feed_ready = false) AS held_events,
    ROUND(
        COUNT(*) FILTER (WHERE e.is_feed_ready = false)::numeric
        / NULLIF(COUNT(*), 0) * 100,
        1
    ) AS held_pct,
    ROUND(AVG(e.data_quality)::numeric, 0) AS avg_quality,
    ROUND(
        COUNT(*) FILTER (WHERE e.description IS NULL)::numeric
        / NULLIF(COUNT(*), 0) * 100,
        1
    ) AS missing_desc_pct,
    ROUND(
        COUNT(*) FILTER (WHERE e.start_time = '00:00:00')::numeric
        / NULLIF(COUNT(*), 0) * 100,
        1
    ) AS midnight_pct,
    ROUND(
        COUNT(*) FILTER (WHERE e.image_url IS NULL)::numeric
        / NULLIF(COUNT(*), 0) * 100,
        1
    ) AS no_image_pct
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.start_date >= CURRENT_DATE
  AND s.is_active = true
GROUP BY s.id, s.name, s.slug
HAVING COUNT(*) >= %s
ORDER BY COUNT(*) FILTER (WHERE e.is_feed_ready = false) DESC;
"""


def get_connection():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
        sys.exit(2)
    return psycopg2.connect(database_url)


def fetch_metrics(min_events: int) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(QUALITY_SQL, (min_events,))
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def classify(row: dict) -> str:
    """Return 'ALERT', 'WARN', or 'OK' for a single source row."""
    held_pct = float(row["held_pct"] or 0)
    avg_quality = float(row["avg_quality"] or 0)
    missing_desc_pct = float(row["missing_desc_pct"] or 0)
    midnight_pct = float(row["midnight_pct"] or 0)
    no_image_pct = float(row["no_image_pct"] or 0)
    total = int(row["total_events"])

    if held_pct >= ALERT_HELD_PCT and total >= ALERT_MIN_EVENTS:
        return "ALERT"

    if total >= WARN_MIN_EVENTS:
        if avg_quality < WARN_AVG_QUALITY:
            return "WARN"
        if missing_desc_pct >= WARN_MISSING_DESC_PCT:
            return "WARN"
        if midnight_pct >= WARN_MIDNIGHT_PCT:
            return "WARN"
        if no_image_pct >= WARN_NO_IMAGE_PCT:
            return "WARN"

    return "OK"


def print_table(rows: list[dict]) -> int:
    """Print summary table. Returns count of ALERT rows."""
    # Classify first so we can sort: ALERTs → WARNs → OK
    classified = [(classify(r), r) for r in rows]
    classified.sort(key=lambda x: {"ALERT": 0, "WARN": 1, "OK": 2}[x[0]])

    alert_count = sum(1 for level, _ in classified if level == "ALERT")
    warn_count = sum(1 for level, _ in classified if level == "WARN")

    print()
    print("=" * 115)
    print("  SOURCE QUALITY ALERT REPORT")
    print("=" * 115)
    print(
        f"  {'SOURCE':<38} {'LEVEL':<7} {'TOTAL':>6} {'HELD':>6} {'HELD%':>7} "
        f"{'AVG_Q':>6} {'NO_DESC%':>9} {'MID%':>6} {'NO_IMG%':>8}"
    )
    print("-" * 115)

    for level, row in classified:
        # Only print non-OK rows plus summary — skip OK to keep output short
        if level == "OK":
            continue
        name = row["name"][:37]
        total = int(row["total_events"])
        held = int(row["held_events"])
        held_pct = f"{float(row['held_pct'] or 0):.1f}%"
        avg_q = f"{float(row['avg_quality'] or 0):.0f}"
        no_desc_pct = f"{float(row['missing_desc_pct'] or 0):.1f}%"
        midnight_pct = f"{float(row['midnight_pct'] or 0):.1f}%"
        no_image_pct = f"{float(row['no_image_pct'] or 0):.1f}%"
        print(
            f"  {name:<38} {level:<7} {total:>6} {held:>6} {held_pct:>7} "
            f"{avg_q:>6} {no_desc_pct:>9} {midnight_pct:>6} {no_image_pct:>8}"
        )

    print("-" * 115)

    total_sources = len(rows)
    ok_count = total_sources - alert_count - warn_count

    print(f"  {total_sources} sources checked   "
          f"{alert_count} ALERT   {warn_count} WARN   {ok_count} OK")
    print("=" * 115)
    print()

    if alert_count > 0:
        print(f"  ACTION REQUIRED: {alert_count} source(s) have held_pct >= {ALERT_HELD_PCT}%.")
        print("  Run the crawler or check is_junk_description / is_feed_ready logic.")
        print()

    return alert_count


def main():
    parser = argparse.ArgumentParser(description="Source quality alerting")
    parser.add_argument(
        "--min-events",
        type=int,
        default=5,
        help="Minimum upcoming events for a source to be included (default: 5)",
    )
    args = parser.parse_args()

    rows = fetch_metrics(args.min_events)

    if not rows:
        print("No sources with upcoming events found.")
        sys.exit(0)

    alert_count = print_table(rows)
    sys.exit(1 if alert_count > 0 else 0)


if __name__ == "__main__":
    main()
