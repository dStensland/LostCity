#!/usr/bin/env python3
"""
Persist Unicoi Lodge overnight inventory snapshots for Yonder.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/sync_yonder_unicoi_inventory.py
    python3 scripts/sync_yonder_unicoi_inventory.py --apply
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import requests
from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import get_config

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

VENUE_SLUG = "unicoi-state-park"
PROVIDER_ID = "unicoi_lodge"
SEARCH_URL = "https://us01.iqwebbook.com/ULGA340/api/roomtype/search"
REFERER_URL = "https://us01.iqwebbook.com/ULGA340/"


def get_next_weekend_window(reference: date | None = None) -> tuple[str, str, int, str]:
    today = reference or date.today()
    days_until_friday = (4 - today.weekday()) % 7
    arrival = today + timedelta(days=days_until_friday)
    departure = arrival + timedelta(days=2)
    nights = 2
    return (
        arrival.strftime("%a, %b %-d %Y"),
        departure.strftime("%a, %b %-d %Y"),
        nights,
        f"{arrival.strftime('%a %b')} {arrival.day} for {nights} nights",
    )


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


def load_venue_id(client) -> int | None:
    result = (
        client.table("places")
        .select("id")
        .eq("slug", VENUE_SLUG)
        .eq("is_active", True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return result.data["id"] if result.data else None


def normalize_unit_type(name: str) -> str | None:
    lowered = name.lower()
    if "picnic shelter" in lowered:
        return None
    if "camp" in lowered or "tent" in lowered:
        return "tent_site"
    if "cabin" in lowered or "villa" in lowered or "cottage" in lowered:
        return "cabin"
    if "room" in lowered or "lodge" in lowered or "suite" in lowered or "parlor" in lowered:
        return "lodge_room"
    return None


def canonicalize_label(name: str) -> str:
    value = re.sub(r"Campsite\s*#\d+\s*-\s*", "", name, flags=re.I)
    value = re.sub(r"\bRoom\s*#?\d+\b", "Room", value, flags=re.I)
    value = re.sub(r"\bCabin\s*#?\d+\b", "Cabin", value, flags=re.I)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def choose_public_rate(rate_types: list[dict]) -> dict | None:
    available = [
        rate
        for rate in rate_types
        if rate.get("isAvailable") and (rate.get("averageNightlyRate") or 0) > 0
    ]
    if not available:
        return None

    for rate in available:
        if (rate.get("name") or "").strip().lower() == "best available rate":
            return rate

    non_discount = [
        rate
        for rate in available
        if not any(
            token in (rate.get("name") or "").lower()
            for token in ["veteran", "senior", "discount"]
        )
    ]
    if non_discount:
        return min(non_discount, key=lambda rate: rate["averageNightlyRate"])

    return min(available, key=lambda rate: rate["averageNightlyRate"])


def fetch_inventory_payload(arrival_date: str, departure_date: str) -> dict:
    params = {
        "arrivalDate": arrival_date,
        "departureDate": departure_date,
        "rooms": json.dumps([{"adultsCount": 1, "childrenCount": 0}]),
        "couponTitle": "",
        "sortPropertyName": "",
        "sortIsAscending": "true",
        "filterHideSmoking": "false",
    }
    response = requests.get(
        SEARCH_URL,
        params=params,
        timeout=20,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json, text/plain, */*",
            "Referer": REFERER_URL,
        },
    )
    response.raise_for_status()
    return response.json()


def build_snapshot(payload: dict) -> tuple[list[dict], list[dict], int]:
    room_type_results = payload.get("data", {}).get("roomTypeResults", [])
    grouped: dict[str, dict] = {}
    sample_sites: list[dict] = []
    total_results = 0

    for room_type in room_type_results:
        unit_type = normalize_unit_type(room_type.get("name", ""))
        if not unit_type:
            continue

        total_results += 1
        rate_types = [
            rate
            for room in room_type.get("rooms", [])
            for rate in room.get("rateTypes", [])
        ]
        public_rate = choose_public_rate(rate_types)
        label = canonicalize_label(room_type["name"])

        bucket = grouped.setdefault(
            unit_type,
            {
                "unitType": unit_type,
                "rawLabels": [],
                "visibleInventoryCount": 0,
                "sampleSiteLabel": None,
                "sampleDetailStatus": "bookable",
                "sampleNightlyRate": None,
                "sampleWeeklyRate": None,
                "_bestRateValue": None,
            },
        )
        if label not in bucket["rawLabels"]:
            bucket["rawLabels"].append(label)
        bucket["visibleInventoryCount"] += 1

        if public_rate:
            sample_sites.append(
                {
                    "name": room_type["name"],
                    "unitType": unit_type,
                    "selectedRateName": public_rate.get("name"),
                    "averageNightlyRate": public_rate.get("averageNightlyRate"),
                    "depositDescription": public_rate.get("depositDescription"),
                }
            )
            rate_value = public_rate["averageNightlyRate"]
            if bucket["_bestRateValue"] is None or rate_value < bucket["_bestRateValue"]:
                bucket["_bestRateValue"] = rate_value
                bucket["sampleSiteLabel"] = room_type["name"]
                bucket["sampleNightlyRate"] = f"${rate_value:.2f}"

    records = []
    for bucket in grouped.values():
        bucket["rawLabels"] = sorted(bucket["rawLabels"])[:12]
        bucket.pop("_bestRateValue", None)
        records.append(bucket)

    records.sort(key=lambda record: record["visibleInventoryCount"], reverse=True)
    return records, sample_sites, total_results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Persist Unicoi Lodge inventory snapshots."
    )
    parser.add_argument("--apply", action="store_true", help="Write snapshot to the database.")
    args = parser.parse_args()

    arrival_date_display, departure_date_display, nights, window_label = get_next_weekend_window()
    payload = fetch_inventory_payload(arrival_date_display, departure_date_display)
    records, sample_sites, total_results = build_snapshot(payload)

    if not args.apply:
        logger.info("Unicoi inventory snapshot preview")
        logger.info("Arrival: %s", arrival_date_display)
        logger.info("Departure: %s", departure_date_display)
        logger.info("Overnight results: %s", total_results)
        for record in records:
            logger.info(
                "%s | count=%s | sample=%s | from=%s",
                record["unitType"],
                record["visibleInventoryCount"],
                record["sampleSiteLabel"] or "-",
                record["sampleNightlyRate"] or "-",
            )
        return

    client = build_client()
    venue_id = load_venue_id(client)
    if not venue_id:
        raise RuntimeError(f"Could not find active venue row for {VENUE_SLUG}")

    arrival_date_iso = (date.today() + timedelta(days=(4 - date.today().weekday()) % 7)).isoformat()
    payload_row = {
        "place_id": venue_id,
        "provider_id": PROVIDER_ID,
        "inventory_scope": "overnight",
        "arrival_date": arrival_date_iso,
        "nights": nights,
        "captured_for_date": date.today().isoformat(),
        "window_label": window_label,
        "total_results": total_results,
        "source_url": SEARCH_URL,
        "records": records,
        "sample_sites": sample_sites[:25],
        "metadata": {
            "provider_label": "Unicoi Lodge",
            "search_params": {
                "arrivalDate": arrival_date_display,
                "departureDate": departure_date_display,
            },
            "sync_mode": "crawler",
        },
    }

    (
        client.table("place_inventory_snapshots")
        .upsert(
            payload_row,
            on_conflict=(
                "place_id,provider_id,inventory_scope,arrival_date,nights,captured_for_date"
            ),
        )
        .execute()
    )

    logger.info("Persisted Unicoi snapshot")
    logger.info("Arrival: %s", arrival_date_iso)
    logger.info("Nights: %s", nights)
    logger.info("Overnight results: %s", total_results)


if __name__ == "__main__":
    main()
