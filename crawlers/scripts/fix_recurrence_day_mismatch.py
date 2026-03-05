#!/usr/bin/env python3
"""
Fix recurring events where recurrence_rule BYDAY doesn't match start_date's
actual day of week.

Example: An event on Monday with recurrence_rule "FREQ=WEEKLY;BYDAY=TU" means
the badge says "Every Tuesday" but the event appears on Monday.

Also fixes series records where day_of_week disagrees with the majority of
their linked events.

Usage:
    python3 fix_recurrence_day_mismatch.py           # Dry run
    python3 fix_recurrence_day_mismatch.py --apply    # Apply fixes
"""

import re
import sys
import logging
from collections import Counter
from datetime import datetime

from config import get_config
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BYDAY_TO_WEEKDAY = {
    "MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6,
}
WEEKDAY_TO_BYDAY = {v: k for k, v in BYDAY_TO_WEEKDAY.items()}
WEEKDAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
BYDAY_RE = re.compile(r"BYDAY=([A-Z]{2})", re.IGNORECASE)


def fix_event_recurrence_rules(client, apply: bool) -> int:
    """Find and fix events where recurrence_rule BYDAY != start_date day."""
    logger.info("=== Scanning events with recurrence_rule BYDAY mismatches ===\n")

    # Fetch all events with recurrence_rule containing BYDAY
    result = client.table("events").select(
        "id, title, start_date, recurrence_rule, is_recurring"
    ).not_.is_("recurrence_rule", "null").gte(
        "start_date", datetime.now().strftime("%Y-%m-%d")
    ).execute()

    events = result.data or []
    logger.info(f"Found {len(events)} events with recurrence_rule set\n")

    fixed = 0
    for event in events:
        rule = event.get("recurrence_rule") or ""
        start_date_str = event.get("start_date") or ""
        match = BYDAY_RE.search(rule)
        if not match:
            continue

        byday = match.group(1).upper()
        expected_weekday = BYDAY_TO_WEEKDAY.get(byday)
        if expected_weekday is None:
            continue

        try:
            actual_date = datetime.strptime(start_date_str[:10], "%Y-%m-%d")
        except (ValueError, TypeError):
            continue

        actual_weekday = actual_date.weekday()
        if actual_weekday == expected_weekday:
            continue

        correct_byday = WEEKDAY_TO_BYDAY[actual_weekday]
        fixed_rule = BYDAY_RE.sub(f"BYDAY={correct_byday}", rule)

        logger.info(
            f"  EVENT {event['id']}: \"{event.get('title', '')[:60]}\"\n"
            f"    start_date={start_date_str} ({actual_date.strftime('%A')})\n"
            f"    recurrence_rule: {rule} → {fixed_rule}"
        )

        if apply:
            client.table("events").update(
                {"recurrence_rule": fixed_rule}
            ).eq("id", event["id"]).execute()
            logger.info("    ✓ Fixed")

        fixed += 1

    logger.info(f"\n{'Fixed' if apply else 'Would fix'} {fixed} event(s)\n")
    return fixed


def fix_series_day_of_week(client, apply: bool) -> int:
    """Find and fix series where day_of_week disagrees with linked events."""
    logger.info("=== Scanning series with stale day_of_week ===\n")

    # Fetch recurring_show and class_series with day_of_week set
    result = client.table("series").select(
        "id, title, day_of_week, series_type"
    ).in_(
        "series_type", ["recurring_show", "class_series"]
    ).not_.is_(
        "day_of_week", "null"
    ).execute()

    series_list = result.data or []
    logger.info(f"Found {len(series_list)} series with day_of_week set\n")

    fixed = 0
    for series in series_list:
        series_id = series["id"]
        series_dow = (series.get("day_of_week") or "").strip().lower()

        # Fetch future events in this series
        events_result = client.table("events").select(
            "start_date"
        ).eq(
            "series_id", series_id
        ).gte(
            "start_date", datetime.now().strftime("%Y-%m-%d")
        ).limit(20).execute()

        events = events_result.data or []
        if not events:
            continue

        # Count actual day-of-week from event start_dates
        day_counts = Counter()
        for ev in events:
            try:
                d = datetime.strptime(str(ev["start_date"])[:10], "%Y-%m-%d")
                day_counts[WEEKDAY_NAMES[d.weekday()]] += 1
            except (ValueError, TypeError):
                pass

        if not day_counts:
            continue

        majority_day, majority_count = day_counts.most_common(1)[0]
        total_events = sum(day_counts.values())
        distinct_days = len(day_counts)

        if majority_day == series_dow:
            continue  # Consistent

        # Skip series that appear daily (events on 4+ different days) — these
        # shouldn't have a single day_of_week; they need frequency="daily".
        if distinct_days >= 4 and majority_count < total_events * 0.6:
            logger.info(
                f"  SKIP {series_id[:8]}: \"{series.get('title', '')[:60]}\"\n"
                f"    Events on {distinct_days} different days → likely daily, not weekly\n"
                f"    {dict(day_counts)}"
            )
            continue

        # Only fix if the majority day is clearly dominant (>50% of events)
        if majority_count <= total_events * 0.5:
            logger.info(
                f"  AMBIGUOUS {series_id[:8]}: \"{series.get('title', '')[:60]}\"\n"
                f"    day_of_week: \"{series_dow}\" but events split: {dict(day_counts)}\n"
                f"    → Likely needs series split, not day correction"
            )
            continue

        logger.info(
            f"  SERIES {series_id[:8]}: \"{series.get('title', '')[:60]}\"\n"
            f"    day_of_week: \"{series_dow}\" but {total_events} future events → {dict(day_counts)}\n"
            f"    → Should be \"{majority_day}\" ({majority_count}/{total_events} events)"
        )

        if apply:
            client.table("series").update(
                {"day_of_week": majority_day}
            ).eq("id", series_id).execute()
            logger.info("    ✓ Fixed")

        fixed += 1

    logger.info(f"\n{'Fixed' if apply else 'Would fix'} {fixed} series record(s)\n")
    return fixed


def main():
    apply = "--apply" in sys.argv

    if not apply:
        logger.info("DRY RUN — pass --apply to make changes\n")

    config = get_config()
    db = config.database
    client = create_client(db.active_supabase_url, db.active_supabase_key)

    event_fixes = fix_event_recurrence_rules(client, apply)
    series_fixes = fix_series_day_of_week(client, apply)

    logger.info("=" * 60)
    logger.info(f"Total: {event_fixes} event(s), {series_fixes} series record(s)")
    if not apply and (event_fixes or series_fixes):
        logger.info("Run with --apply to commit these fixes")


if __name__ == "__main__":
    main()
