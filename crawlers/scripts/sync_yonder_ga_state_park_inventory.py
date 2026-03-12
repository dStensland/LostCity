#!/usr/bin/env python3
"""
Persist Georgia State Parks inventory snapshots for Yonder weekend anchors.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/sync_yonder_ga_state_park_inventory.py
    python3 scripts/sync_yonder_ga_state_park_inventory.py --apply
    python3 scripts/sync_yonder_ga_state_park_inventory.py --arrival 03/20/2026 --nights 2 --apply
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path

from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import get_config
from extract_yonder_ga_state_park_inventory import (
    fetch_inventory_snapshot,
    fetch_probe_map,
    get_next_weekend_arrival,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def format_window_label(arrival_date: str, nights: int) -> str:
    arrival = datetime.strptime(arrival_date, "%m/%d/%Y")
    return f"{arrival.strftime('%a %b')} {arrival.day} for {nights} nights"


def to_iso_date(arrival_date: str) -> str:
    return datetime.strptime(arrival_date, "%m/%d/%Y").strftime("%Y-%m-%d")


def build_client():
    cfg = get_config()
    missing = cfg.database.missing_active_credentials()
    if missing:
        raise RuntimeError(
            f"Missing Supabase credentials for {cfg.database.active_target}: {', '.join(missing)}"
        )
    return create_client(
        cfg.database.active_supabase_url,
        cfg.database.active_supabase_service_key,
    )


def load_venue_map(client, slugs: list[str]) -> dict[str, int]:
    result = (
        client.table("venues")
        .select("id,slug")
        .in_("slug", slugs)
        .eq("active", True)
        .execute()
    )
    return {row["slug"]: row["id"] for row in (result.data or [])}


def build_snapshot_rows(
    arrival_date: str,
    nights: int,
    sample_limit: int,
    detail_limit: int,
):
    probe_map = fetch_probe_map()
    snapshots = []
    for yonder_slug, (provider_slug, park_id, search_url) in probe_map.items():
        snapshot = fetch_inventory_snapshot(
            yonder_slug=yonder_slug,
            provider_slug=provider_slug,
            park_id=park_id,
            arrival_date=arrival_date,
            nights=nights,
            sample_limit=sample_limit,
            detail_limit=detail_limit,
        )
        snapshots.append((snapshot, search_url))
    return snapshots


def build_runtime_records(snapshot) -> list[dict]:
    sample_site_by_unit_type = {}
    for site in snapshot.sample_sites:
        sample_site_by_unit_type.setdefault(site.normalized_unit_type, site)

    records = []
    for record in snapshot.normalized_records:
        sample_site = sample_site_by_unit_type.get(record.unit_type)
        records.append(
            {
                "unitType": record.unit_type,
                "rawLabels": record.raw_labels,
                "visibleInventoryCount": record.visible_inventory_count,
                "sampleSiteLabel": sample_site.site_label if sample_site else None,
                "sampleDetailStatus": record.sample_detail_status,
                "sampleNightlyRate": record.sample_nightly_rate,
                "sampleWeeklyRate": record.sample_weekly_rate,
            }
        )
    return records


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Persist Yonder Georgia State Park inventory snapshots."
    )
    parser.add_argument(
        "--arrival",
        default=get_next_weekend_arrival(),
        help="Arrival date in MM/DD/YYYY format.",
    )
    parser.add_argument("--nights", type=int, default=2, help="Length of stay in nights.")
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=5,
        help="Number of sample site rows per park.",
    )
    parser.add_argument(
        "--detail-limit",
        type=int,
        default=2,
        help="Number of sample site rows per park to enrich with detail-page pricing.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write snapshot rows to the database.",
    )
    args = parser.parse_args()

    snapshot_rows = build_snapshot_rows(
        arrival_date=args.arrival,
        nights=args.nights,
        sample_limit=args.sample_limit,
        detail_limit=args.detail_limit,
    )
    arrival_date_iso = to_iso_date(args.arrival)
    window_label = format_window_label(args.arrival, args.nights)

    if not args.apply:
        logger.info("Georgia State Parks snapshot sync preview")
        logger.info("Arrival: %s", args.arrival)
        logger.info("Nights: %s", args.nights)
        logger.info("Snapshots: %s", len(snapshot_rows))
        logger.info("")
        for snapshot, _search_url in snapshot_rows:
            logger.info(
                "%s | provider=%s | total=%s | records=%s",
                snapshot.yonder_slug,
                snapshot.provider_slug,
                snapshot.total_results if snapshot.total_results is not None else "-",
                len(snapshot.normalized_records),
            )
        return

    client = build_client()
    venue_map = load_venue_map(
        client, [snapshot.yonder_slug for snapshot, _search_url in snapshot_rows]
    )

    payload = []
    capture_date = date.today().isoformat()
    captured_at = datetime.utcnow().isoformat()
    skipped = []
    for snapshot, search_url in snapshot_rows:
        venue_id = venue_map.get(snapshot.yonder_slug)
        if not venue_id:
            skipped.append(snapshot.yonder_slug)
            continue

        payload.append(
            {
                "venue_id": venue_id,
                "provider_id": "ga_state_parks",
                "inventory_scope": "overnight",
                "arrival_date": arrival_date_iso,
                "nights": args.nights,
                "captured_for_date": capture_date,
                "captured_at": captured_at,
                "window_label": window_label,
                "total_results": snapshot.total_results,
                "source_url": search_url,
                "records": build_runtime_records(snapshot),
                "sample_sites": [asdict(site) for site in snapshot.sample_sites],
                "metadata": {
                    "provider_label": "GA State Parks",
                    "provider_slug": snapshot.provider_slug,
                    "park_id": snapshot.park_id,
                    "sync_mode": "crawler",
                    "sample_limit": args.sample_limit,
                    "detail_limit": args.detail_limit,
                },
            }
        )

    if payload:
        (
            client.table("venue_inventory_snapshots")
            .upsert(
                payload,
                on_conflict=(
                    "venue_id,provider_id,inventory_scope,arrival_date,nights,captured_for_date"
                ),
            )
            .execute()
        )

    logger.info("Persisted Georgia State Parks snapshots")
    logger.info("Arrival: %s", args.arrival)
    logger.info("Nights: %s", args.nights)
    logger.info("Written: %s", len(payload))
    if skipped:
        logger.info("Skipped: %s", ", ".join(sorted(skipped)))


if __name__ == "__main__":
    main()
