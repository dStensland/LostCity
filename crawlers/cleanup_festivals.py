"""
One-time cleanup for existing bad festival_program series data.

Run AFTER verifying root cause fixes work (db.py changes).

Operations:
1. Delete ghost series (0 events, no description)
2. Unlink single-event festival_program series (set series_id=NULL, delete series)
3. Consolidate fragmented series from same festival into one primary series
4. Backfill titles on remaining series via festival_health

Usage:
    python cleanup_festivals.py --dry-run    # Preview changes
    python cleanup_festivals.py              # Execute changes
"""

import argparse
import logging
from db import get_client

logger = logging.getLogger(__name__)


def cleanup_festivals(dry_run: bool = True) -> dict:
    """Clean up bad festival_program series."""
    client = get_client()
    stats = {
        "ghosts_deleted": 0,
        "single_event_unlinked": 0,
        "consolidated": 0,
        "titles_backfilled": 0,
        "festival_dates_backfilled": 0,
    }

    # Fetch all festival_program series
    result = (
        client.table("series")
        .select("id, title, festival_id, description")
        .eq("series_type", "festival_program")
        .execute()
    )
    all_series = result.data or []
    logger.info(f"Found {len(all_series)} festival_program series")

    if not all_series:
        return stats

    series_ids = [s["id"] for s in all_series]

    # Build event count + date range per series
    event_data = {}
    for batch_start in range(0, len(series_ids), 50):
        batch = series_ids[batch_start : batch_start + 50]
        events_result = (
            client.table("events")
            .select("id, series_id, start_date, title")
            .in_("series_id", batch)
            .execute()
        )
        for ev in events_result.data or []:
            sid = ev["series_id"]
            if sid not in event_data:
                event_data[sid] = {"count": 0, "dates": [], "titles": [], "event_ids": []}
            event_data[sid]["count"] += 1
            if ev.get("start_date"):
                event_data[sid]["dates"].append(ev["start_date"])
            if ev.get("title"):
                event_data[sid]["titles"].append(ev["title"])
            event_data[sid]["event_ids"].append(ev["id"])

    # Track which series IDs get deleted so we skip them in later phases
    deleted_ids = set()

    # --- Phase 1: Delete ghost series (0 events, no description) ---
    for series in all_series:
        sid = series["id"]
        ev_info = event_data.get(sid)
        if ev_info and ev_info["count"] > 0:
            continue
        # Keep if it has a description (manually curated)
        if series.get("description"):
            continue

        logger.info(f"Ghost series: {series.get('title', 'NULL')} ({sid})")
        if not dry_run:
            try:
                client.table("series").delete().eq("id", sid).execute()
                stats["ghosts_deleted"] += 1
                deleted_ids.add(sid)
            except Exception as e:
                logger.warning(f"Failed to delete ghost series {sid}: {e}")
        else:
            stats["ghosts_deleted"] += 1
            deleted_ids.add(sid)

    # --- Phase 2: Unlink single-event festival_program series ---
    for series in all_series:
        sid = series["id"]
        if sid in deleted_ids:
            continue
        ev_info = event_data.get(sid)
        if not ev_info or ev_info["count"] != 1:
            continue

        logger.info(
            f"Single-event series: {series.get('title', 'NULL')} ({sid}) — "
            f"unlinking event {ev_info['event_ids'][0]}"
        )
        if not dry_run:
            try:
                # Unlink the event
                client.table("events").update(
                    {"series_id": None}
                ).eq("id", ev_info["event_ids"][0]).execute()
                # Delete the series
                client.table("series").delete().eq("id", sid).execute()
                stats["single_event_unlinked"] += 1
                deleted_ids.add(sid)
            except Exception as e:
                logger.warning(f"Failed to unlink single-event series {sid}: {e}")
        else:
            stats["single_event_unlinked"] += 1
            deleted_ids.add(sid)

    # --- Phase 3: Consolidate fragmented series from same festival ---
    by_festival = {}
    for series in all_series:
        sid = series["id"]
        if sid in deleted_ids:
            continue
        fid = series.get("festival_id")
        if not fid:
            continue
        ev_info = event_data.get(sid)
        if not ev_info or ev_info["count"] == 0:
            continue
        if fid not in by_festival:
            by_festival[fid] = []
        by_festival[fid].append((series, ev_info))

    for fid, group in by_festival.items():
        if len(group) <= 1:
            continue
        # Keep the series with the most events as the primary
        group.sort(key=lambda x: x[1]["count"], reverse=True)
        primary_series, _ = group[0]
        primary_id = primary_series["id"]

        for series, ev_info in group[1:]:
            sid = series["id"]
            logger.info(
                f"Consolidating series {series.get('title', 'NULL')} ({sid}) "
                f"into {primary_series.get('title', 'NULL')} ({primary_id})"
            )
            if not dry_run:
                try:
                    client.table("events").update(
                        {"series_id": primary_id}
                    ).eq("series_id", sid).execute()
                    client.table("series").delete().eq("id", sid).execute()
                    stats["consolidated"] += 1
                    deleted_ids.add(sid)
                except Exception as e:
                    logger.warning(f"Failed to consolidate series {sid}: {e}")
            else:
                stats["consolidated"] += 1

    # --- Phase 4: Backfill titles and festival dates on remaining series ---
    if not dry_run:
        from festival_health import run_festival_health_check
        health_stats = run_festival_health_check()
        stats["titles_backfilled"] = health_stats.get("titles_backfilled", 0)
        stats["festival_dates_backfilled"] = health_stats.get("festival_dates_backfilled", 0)

    return stats


def main():
    parser = argparse.ArgumentParser(description="Clean up bad festival_program series")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without executing")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    mode = "DRY RUN" if args.dry_run else "LIVE"
    logger.info(f"Running festival cleanup ({mode})...")

    stats = cleanup_festivals(dry_run=args.dry_run)

    print(f"\n{'=' * 50}")
    print(f"Festival Cleanup Results ({mode})")
    print(f"{'=' * 50}")
    print(f"Ghost series deleted:       {stats['ghosts_deleted']}")
    print(f"Single-event unlinked:      {stats['single_event_unlinked']}")
    print(f"Fragmented consolidated:    {stats['consolidated']}")
    print(f"Titles backfilled:          {stats['titles_backfilled']}")
    print(f"Festival dates backfilled:  {stats['festival_dates_backfilled']}")


if __name__ == "__main__":
    main()
