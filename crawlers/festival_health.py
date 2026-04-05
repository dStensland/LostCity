"""
Post-crawl festival health check and backfill.

Runs after every crawl to:
- Backfill titles on UNNAMED/NULL-title series from event data or parent festival
- Backfill festival dates (announced_start/end) from linked event dates
- Log warnings for single-event and ghost (0-event) festival_program series
- Print summary stats
"""

import logging
from datetime import date
from typing import Optional
from db import get_client

logger = logging.getLogger(__name__)


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def _festival_date_backfill_updates(
    festival: dict, event_dates: list[str], event_count: int
) -> dict:
    """Conservatively backfill festival dates from linked active events.

    Only backfill when the linked-event coverage is strong enough to represent
    the parent festival itself:
    - two or more distinct event dates, or
    - a one-day festival with multiple linked events on the same date.
    """
    if not event_dates:
        return {}

    unique_dates = sorted({d for d in event_dates if _parse_date(d)})
    if not unique_dates:
        return {}

    typical_duration_days = int(festival.get("typical_duration_days") or 0)
    distinct_date_count = len(unique_dates)

    if distinct_date_count >= 2:
        start = _parse_date(unique_dates[0])
        end = _parse_date(unique_dates[-1])
        if not start or not end:
            return {}
        span_days = (end - start).days + 1
        if typical_duration_days and span_days > max(typical_duration_days + 2, 7):
            return {}
    else:
        if typical_duration_days not in (0, 1) or event_count < 2:
            return {}

    updates = {}
    if not festival.get("announced_start"):
        updates["announced_start"] = unique_dates[0]
    if not festival.get("announced_end"):
        updates["announced_end"] = unique_dates[-1]
    if updates and not festival.get("date_source"):
        updates["date_source"] = "linked-event-backfill"
    return updates


def run_festival_health_check() -> dict:
    """
    Check and repair festival_program series health.

    Returns dict with stats:
        total, with_events, titles_backfilled, festival_dates_backfilled,
        ghosts, single_event
    """
    client = get_client()
    stats = {
        "total": 0,
        "with_events": 0,
        "titles_backfilled": 0,
        "festival_dates_backfilled": 0,
        "ghosts": 0,
        "single_event": 0,
    }

    # Fetch all festival_program series
    result = (
        client.table("series")
        .select("id, title, festival_id, description")
        .eq("series_type", "festival_program")
        .execute()
    )
    series_list = result.data or []
    stats["total"] = len(series_list)

    if not series_list:
        logger.info("Festival health: no festival_program series found")
        return stats

    series_ids = [s["id"] for s in series_list]

    # Batch fetch event counts and date ranges per series
    event_data = {}
    for batch_start in range(0, len(series_ids), 50):
        batch = series_ids[batch_start : batch_start + 50]
        events_result = (
            client.table("events")
            .select("series_id, start_date, title, is_active")
            .in_("series_id", batch)
            .execute()
        )
        for ev in events_result.data or []:
            if ev.get("is_active") is False:
                continue
            sid = ev["series_id"]
            if sid not in event_data:
                event_data[sid] = {"count": 0, "dates": [], "titles": []}
            event_data[sid]["count"] += 1
            if ev.get("start_date"):
                event_data[sid]["dates"].append(ev["start_date"])
            if ev.get("title"):
                event_data[sid]["titles"].append(ev["title"])

    # Track festivals that need date backfill
    festivals_to_backfill = {}
    festival_event_counts = {}

    for series in series_list:
        sid = series["id"]
        ev_info = event_data.get(sid, {"count": 0, "dates": [], "titles": []})

        if ev_info["count"] > 0:
            stats["with_events"] += 1
        else:
            stats["ghosts"] += 1

        if ev_info["count"] == 1:
            stats["single_event"] += 1

        # Collect event dates for parent festival date backfill
        fid = series.get("festival_id")
        if fid and ev_info["dates"]:
            if fid not in festivals_to_backfill:
                festivals_to_backfill[fid] = []
            festivals_to_backfill[fid].extend(ev_info["dates"])
            festival_event_counts[fid] = (
                festival_event_counts.get(fid, 0) + ev_info["count"]
            )

        # Backfill title if NULL or "UNNAMED"
        title = series.get("title") or ""
        if not title.strip() or title.strip().upper() == "UNNAMED":
            new_title = _derive_title(ev_info["titles"], fid, client)
            if new_title:
                try:
                    client.table("series").update({"title": new_title}).eq(
                        "id", sid
                    ).execute()
                    stats["titles_backfilled"] += 1
                except Exception as e:
                    logger.warning(f"Failed to backfill title for series {sid}: {e}")

    # Backfill festival announced_start/announced_end from event dates
    for fid, dates in festivals_to_backfill.items():
        try:
            fest = (
                client.table("festivals")
                .select(
                    "id, announced_start, announced_end, typical_duration_days, date_source"
                )
                .eq("id", fid)
                .maybeSingle()
                .execute()
            )
            if not fest.data:
                continue
            event_count = festival_event_counts.get(fid, 0)
            updates = _festival_date_backfill_updates(fest.data, dates, event_count)
            if updates:
                client.table("festivals").update(updates).eq("id", fid).execute()
                stats["festival_dates_backfilled"] += 1
        except Exception as e:
            logger.warning(f"Failed to backfill dates for festival {fid}: {e}")

    # Log warnings
    if stats["ghosts"] > 0:
        logger.warning(f"Festival health: {stats['ghosts']} ghost series (0 events)")
    if stats["single_event"] > 0:
        logger.warning(f"Festival health: {stats['single_event']} single-event series")

    logger.info(
        f"Festival health: {stats['total']} series, "
        f"{stats['with_events']} with events, "
        f"{stats['titles_backfilled']} titles backfilled, "
        f"{stats['festival_dates_backfilled']} festival dates backfilled"
    )

    return stats


def _derive_title(
    event_titles: list, festival_id: Optional[str], client
) -> Optional[str]:
    """Derive a series title from event titles or parent festival name."""
    # Try parent festival name first
    if festival_id:
        try:
            fest = (
                client.table("festivals")
                .select("name")
                .eq("id", festival_id)
                .maybeSingle()
                .execute()
            )
            if fest.data and fest.data.get("name"):
                return fest.data["name"]
        except Exception:
            pass

    # Most common event title
    if event_titles:
        from collections import Counter

        title_counts = Counter(event_titles)
        most_common, count = title_counts.most_common(1)[0]
        if count > 1 or len(event_titles) == 1:
            return most_common

    return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    stats = run_festival_health_check()
    print(f"\nFestival health stats: {stats}")
