"""
heal_events.py — Automated data quality healing loop.

Run after crawl to detect and fix common data issues.
Integrates into main.py post-crawl pipeline.

Usage:
    python3 heal_events.py --report    # alerts only
    python3 heal_events.py --fix --dry-run  # preview fixes
    python3 heal_events.py --fix       # apply fixes
"""

import re
import sys
import logging
import argparse
from datetime import date

logger = logging.getLogger(__name__)


def get_client():
    from db import get_client as _get_client
    return _get_client()


def smart_title_case(text: str) -> str:
    """Title-case with exceptions for common small words and apostrophes."""
    from db import smart_title_case as _stc
    return _stc(text)


PAGE_SIZE = 1000


def _fetch_all_pages(client, table, select, filters):
    """Paginate through Supabase results (default limit is 1000)."""
    all_rows = []
    offset = 0
    while True:
        query = client.table(table).select(select)
        for method, args in filters:
            query = getattr(query, method)(*args)
        query = query.range(offset, offset + PAGE_SIZE - 1)
        result = query.execute()
        rows = result.data or []
        all_rows.extend(rows)
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return all_rows


def _future_active_events(client, select):
    """Fetch all future active events with given select columns."""
    return _fetch_all_pages(client, "events", select, [
        ("gte", ("start_date", date.today().isoformat())),
        ("eq", ("is_active", True)),
    ])


def fix_price_inversions(client, dry_run=False) -> int:
    """Swap price_min/price_max where min > max on future events."""
    rows = _future_active_events(client, "id, title, price_min, price_max")

    count = 0
    for row in rows:
        pmin = row.get("price_min")
        pmax = row.get("price_max")
        if pmin is not None and pmax is not None:
            try:
                if float(pmin) > float(pmax):
                    if dry_run:
                        logger.info(
                            "  [DRY RUN] Would swap prices on: %s (%s > %s)",
                            row["title"][:60],
                            pmin,
                            pmax,
                        )
                    else:
                        client.table("events").update(
                            {
                                "price_min": pmax,
                                "price_max": pmin,
                            }
                        ).eq("id", row["id"]).execute()
                    count += 1
            except (ValueError, TypeError):
                continue
    return count


def fix_sold_out_titles(client, dry_run=False) -> int:
    """Strip SOLD OUT / CANCELLED etc from event titles, set ticket_status."""
    STATUS_RE = re.compile(
        r"(?:^\s*(?:SOLD\s*OUT|CANCELLED|POSTPONED|RESCHEDULED)\s*[-:!]\s*)"
        r"|(?:\s*[-:]\s*(?:SOLD\s*OUT|CANCELLED|POSTPONED|RESCHEDULED)\s*$)"
        r"|(?:\s*[\[(](?:SOLD\s*OUT|CANCELLED|POSTPONED|RESCHEDULED)[\])]\s*)",
        re.IGNORECASE,
    )

    rows = _future_active_events(client, "id, title, ticket_status")

    count = 0
    for row in rows:
        title = row.get("title") or ""
        match = STATUS_RE.search(title)
        if match:
            cleaned = STATUS_RE.sub("", title).strip()
            if not cleaned:
                continue
            matched_text = match.group(0).strip().lower()
            update = {"title": cleaned}
            if "sold" in matched_text and "out" in matched_text:
                update["ticket_status"] = "sold-out"

            if dry_run:
                logger.info(
                    "  [DRY RUN] Would clean title: '%s' -> '%s'",
                    title[:60],
                    cleaned[:60],
                )
            else:
                try:
                    client.table("events").update(update).eq("id", row["id"]).execute()
                except Exception as e:
                    if "duplicate key" in str(e) or "23505" in str(e):
                        # Clean version already exists — deactivate the dirty copy
                        client.table("events").update({"is_active": False}).eq("id", row["id"]).execute()
                        logger.info("  Deactivated duplicate after title clean: %s", title[:60])
                    else:
                        logger.warning("  Failed to update title: %s — %s", title[:60], e)
                        continue
            count += 1
    return count


def fix_all_caps_titles(client, dry_run=False) -> int:
    """Convert ALL CAPS titles to smart title case."""
    rows = _future_active_events(client, "id, title")

    count = 0
    for row in rows:
        title = row.get("title") or ""
        if title == title.upper() and len(title) > 5:
            fixed = smart_title_case(title)
            if fixed != title:
                if dry_run:
                    logger.info(
                        "  [DRY RUN] Would fix caps: '%s' -> '%s'",
                        title[:60],
                        fixed[:60],
                    )
                else:
                    client.table("events").update({"title": fixed}).eq("id", row["id"]).execute()
                count += 1
    return count


def fix_midnight_times(client, dry_run=False) -> int:
    """Null out 00:00:00 start_times on future events (sentinel for unknown time)."""
    rows = _fetch_all_pages(client, "events", "id, title, start_time, is_all_day", [
        ("eq", ("start_time", "00:00:00")),
        ("gte", ("start_date", date.today().isoformat())),
        ("eq", ("is_active", True)),
    ])

    # Skip genuine all-day events
    rows = [r for r in rows if not r.get("is_all_day")]

    count = 0
    for row in rows:
        if dry_run:
            logger.info(
                "  [DRY RUN] Would clear midnight time on: %s",
                row["title"][:60],
            )
        else:
            try:
                client.table("events").update(
                    {"start_time": None}
                ).eq("id", row["id"]).execute()
            except Exception as e:
                if "23505" in str(e) or "duplicate key" in str(e):
                    # Unique constraint conflict — clearing time creates a dupe.
                    # Deactivate this copy instead.
                    client.table("events").update(
                        {"is_active": False}
                    ).eq("id", row["id"]).execute()
                    logger.info("  Deactivated duplicate after midnight clear: %s", row["title"][:60])
                else:
                    logger.warning("  Failed to clear midnight on: %s — %s", row["title"][:60], e)
                    continue
        count += 1
    return count


def deactivate_closed_venue_events(client, dry_run=False) -> int:
    """Deactivate future events at closed venues."""
    from closed_venues import CLOSED_VENUE_SLUGS

    if not CLOSED_VENUE_SLUGS:
        return 0

    venue_result = (
        client.table("places")
        .select("id, slug")
        .in_("slug", list(CLOSED_VENUE_SLUGS))
        .execute()
    )

    closed_venue_ids = [v["id"] for v in (venue_result.data or [])]
    if not closed_venue_ids:
        return 0

    events_result = (
        client.table("events")
        .select("id, title, place_id")
        .in_("place_id", closed_venue_ids)
        .gte("start_date", date.today().isoformat())
        .eq("is_active", True)
        .execute()
    )

    count = len(events_result.data or [])
    if count > 0:
        if dry_run:
            for row in events_result.data or []:
                logger.info("  [DRY RUN] Would deactivate: %s", row["title"][:60])
        else:
            for row in events_result.data or []:
                client.table("events").update({"is_active": False}).eq("id", row["id"]).execute()

    return count


# ===== ALERT CHECKS (report only) =====


def alert_missing_venue_ids(client) -> list:
    """Find events missing venue_id, grouped by source."""
    rows = _fetch_all_pages(client, "events", "id, title, source_id", [
        ("is_", ("place_id", "null")),
        ("gte", ("start_date", date.today().isoformat())),
        ("eq", ("is_active", True)),
    ])

    by_source: dict = {}
    for row in rows:
        sid = row.get("source_id")
        by_source.setdefault(sid, []).append(row["title"][:60])

    alerts = []
    for source_id, titles in sorted(by_source.items(), key=lambda x: -len(x[1])):
        alerts.append(f"Source {source_id}: {len(titles)} events missing venue_id")
    return alerts


def alert_suspicious_prices(client) -> list:
    """Find events with prices > $500."""
    rows = _future_active_events(client, "id, title, price_min, price_max, source_id")

    alerts = []
    for row in rows:
        for field in ("price_min", "price_max"):
            val = row.get(field)
            if val is not None:
                try:
                    if float(val) > 500:
                        alerts.append(
                            f"${float(val):.0f} {field} on: {row['title'][:60]}"
                            f" (source {row.get('source_id')})"
                        )
                except (ValueError, TypeError):
                    continue
    return alerts


def alert_boilerplate_sources(client) -> list:
    """Flag sources where >50% of future events have boilerplate descriptions."""
    from description_quality import classify_description

    rows = _future_active_events(client, "id, title, description, source_id")

    by_source: dict[int, dict] = {}
    for row in rows:
        sid = row.get("source_id")
        if sid is None:
            continue
        stats = by_source.setdefault(sid, {"total": 0, "boilerplate": 0})
        stats["total"] += 1
        classification = classify_description(row.get("description"))
        if classification in ("junk", "boilerplate"):
            stats["boilerplate"] += 1

    alerts = []
    for source_id, stats in sorted(by_source.items(), key=lambda x: -x[1]["boilerplate"]):
        if stats["total"] >= 5:
            pct = 100 * stats["boilerplate"] / stats["total"]
            if pct > 50:
                alerts.append(
                    f"Source {source_id}: {stats['boilerplate']}/{stats['total']} "
                    f"({pct:.0f}%) boilerplate descriptions"
                )
    return alerts


def alert_midnight_sources(client) -> list:
    """Flag sources where >30% of future events have midnight sentinel times."""
    rows = _future_active_events(client, "id, title, start_time, source_id")

    by_source: dict[int, dict] = {}
    for row in rows:
        sid = row.get("source_id")
        if sid is None:
            continue
        stats = by_source.setdefault(sid, {"total": 0, "midnight": 0})
        stats["total"] += 1
        if row.get("start_time") in ("00:00:00", "00:00"):
            stats["midnight"] += 1

    alerts = []
    for source_id, stats in sorted(by_source.items(), key=lambda x: -x[1]["midnight"]):
        if stats["total"] >= 5:
            pct = 100 * stats["midnight"] / stats["total"]
            if pct > 30:
                alerts.append(
                    f"Source {source_id}: {stats['midnight']}/{stats['total']} "
                    f"({pct:.0f}%) midnight sentinel times"
                )
    return alerts


def alert_imageless_sources(client) -> list:
    """Flag sources where >70% of future events have no image_url."""
    rows = _future_active_events(client, "id, title, image_url, source_id")

    by_source: dict[int, dict] = {}
    for row in rows:
        sid = row.get("source_id")
        if sid is None:
            continue
        stats = by_source.setdefault(sid, {"total": 0, "no_image": 0})
        stats["total"] += 1
        if not row.get("image_url"):
            stats["no_image"] += 1

    alerts = []
    for source_id, stats in sorted(by_source.items(), key=lambda x: -x[1]["no_image"]):
        if stats["total"] >= 5:
            pct = 100 * stats["no_image"] / stats["total"]
            if pct > 70:
                alerts.append(
                    f"Source {source_id}: {stats['no_image']}/{stats['total']} "
                    f"({pct:.0f}%) missing images"
                )
    return alerts


def run_healing_loop(dry_run=False, fix=True, report=True, verbose=False) -> dict:
    """
    Main healing loop entry point.

    Returns stats dict: {prices_fixed, titles_cleaned, caps_fixed, closed_deactivated, alerts}
    """
    if verbose:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    client = get_client()
    stats: dict = {}

    if fix:
        logger.info("Running auto-fix actions...")

        stats["prices_fixed"] = fix_price_inversions(client, dry_run=dry_run)
        if stats["prices_fixed"]:
            logger.info("  Price inversions fixed: %s", stats["prices_fixed"])

        stats["titles_cleaned"] = fix_sold_out_titles(client, dry_run=dry_run)
        if stats["titles_cleaned"]:
            logger.info("  SOLD OUT titles cleaned: %s", stats["titles_cleaned"])

        stats["caps_fixed"] = fix_all_caps_titles(client, dry_run=dry_run)
        if stats["caps_fixed"]:
            logger.info("  ALL CAPS titles fixed: %s", stats["caps_fixed"])

        stats["midnight_times_cleared"] = fix_midnight_times(client, dry_run=dry_run)
        if stats["midnight_times_cleared"]:
            logger.info("  Midnight sentinel times cleared: %s", stats["midnight_times_cleared"])

        stats["closed_deactivated"] = deactivate_closed_venue_events(client, dry_run=dry_run)
        if stats["closed_deactivated"]:
            logger.info("  Closed venue events deactivated: %s", stats["closed_deactivated"])

    all_alerts: list = []
    if report:
        logger.info("Running alert checks...")

        venue_alerts = alert_missing_venue_ids(client)
        all_alerts.extend(venue_alerts)
        for a in venue_alerts:
            logger.warning("  ALERT: %s", a)

        price_alerts = alert_suspicious_prices(client)
        all_alerts.extend(price_alerts)
        for a in price_alerts:
            logger.warning("  ALERT: %s", a)

        boilerplate_alerts = alert_boilerplate_sources(client)
        all_alerts.extend(boilerplate_alerts)
        for a in boilerplate_alerts:
            logger.warning("  ALERT: %s", a)

        midnight_alerts = alert_midnight_sources(client)
        all_alerts.extend(midnight_alerts)
        for a in midnight_alerts:
            logger.warning("  ALERT: %s", a)

        imageless_alerts = alert_imageless_sources(client)
        all_alerts.extend(imageless_alerts)
        for a in imageless_alerts:
            logger.warning("  ALERT: %s", a)

    stats["alerts"] = len(all_alerts)
    stats["alert_details"] = all_alerts

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Data quality healing loop")
    parser.add_argument("--fix", action="store_true", help="Apply auto-fix actions")
    parser.add_argument("--report", action="store_true", help="Run alert checks")
    parser.add_argument("--dry-run", action="store_true", help="Preview fixes without applying")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    # Default to --report if nothing specified
    if not args.fix and not args.report:
        args.report = True

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s: %(message)s",
    )
    # Always show our own logs when run as script
    logger.setLevel(logging.INFO)

    stats = run_healing_loop(
        dry_run=args.dry_run,
        fix=args.fix,
        report=args.report,
        verbose=args.verbose,
    )

    print("\n--- Healing Loop Results ---")
    if args.fix:
        print(f"Prices fixed:        {stats.get('prices_fixed', 0)}")
        print(f"Titles cleaned:      {stats.get('titles_cleaned', 0)}")
        print(f"ALL CAPS fixed:      {stats.get('caps_fixed', 0)}")
        print(f"Midnight cleared:    {stats.get('midnight_times_cleared', 0)}")
        print(f"Closed deactivated:  {stats.get('closed_deactivated', 0)}")
        if args.dry_run:
            print("(DRY RUN -- no changes applied)")
    if args.report:
        print(f"Alerts:              {stats.get('alerts', 0)}")
        for detail in stats.get("alert_details", []):
            print(f"  - {detail}")
