#!/usr/bin/env python3
"""
Persist Whitewater Express package inventory snapshots for Yonder.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/sync_yonder_whitewater_express_inventory.py
    python3 scripts/sync_yonder_whitewater_express_inventory.py --apply
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import get_config

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

VENUE_SLUG = "whitewater-express-columbus"
PROVIDER_ID = "whitewater_express"
CATALOG_URL = (
    "https://whitewaterexpress.rezdy.com/catalog/137258/whitewater-rafting?iframe=true"
)


def get_next_weekend_window(reference: date | None = None) -> tuple[str, int, str]:
    today = reference or date.today()
    days_until_friday = (4 - today.weekday()) % 7
    arrival = today + timedelta(days=days_until_friday)
    nights = 2
    return arrival.isoformat(), nights, f"{arrival.strftime('%a %b')} {arrival.day} for {nights} nights"


def parse_price_value(price_text: str | None) -> float | None:
    if not price_text:
        return None
    match = re.search(r"\$([\d,]+(?:\.\d{2})?)", price_text)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def fetch_package_catalog() -> list[dict]:
    response = requests.get(
        CATALOG_URL,
        timeout=20,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    packages = []
    for node in soup.select(".products-list-item"):
        title_link = node.select_one("h2 a")
        if not title_link:
            continue

        title = " ".join(title_link.get_text(" ", strip=True).split())
        description_node = node.select_one(".products-list-item-overview p")
        duration_node = None
        for li in node.select(".products-list-item-overview li"):
            text = " ".join(li.get_text(" ", strip=True).split())
            if text.lower().startswith("duration:"):
                duration_node = text
                break

        price_node = node.select_one(".products-price .price")
        price_text = " ".join(price_node.get_text(" ", strip=True).split()) if price_node else None
        href = title_link.get("href")
        booking_url = f"https://whitewaterexpress.rezdy.com{href}" if href else None

        packages.append(
            {
                "title": title,
                "description": " ".join(description_node.get_text(" ", strip=True).split())
                if description_node
                else None,
                "duration": duration_node.replace("Duration:", "").strip()
                if duration_node
                else None,
                "price": price_text,
                "price_value": parse_price_value(price_text),
                "booking_url": booking_url,
            }
        )

    return packages


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
        client.table("venues")
        .select("id")
        .eq("slug", VENUE_SLUG)
        .eq("active", True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return result.data["id"] if result.data else None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Persist Whitewater Express package inventory snapshots."
    )
    parser.add_argument("--apply", action="store_true", help="Write snapshot to the database.")
    args = parser.parse_args()

    arrival_date, nights, window_label = get_next_weekend_window()
    packages = fetch_package_catalog()
    cheapest_package = min(
        (pkg for pkg in packages if pkg["price_value"] is not None),
        key=lambda pkg: pkg["price_value"],
        default=None,
    )

    record = {
        "unitType": "guide_package",
        "rawLabels": [pkg["title"] for pkg in packages],
        "visibleInventoryCount": len(packages),
        "sampleSiteLabel": cheapest_package["title"] if cheapest_package else (packages[0]["title"] if packages else None),
        "sampleDetailStatus": "bookable" if packages else None,
        "sampleNightlyRate": cheapest_package["price"] if cheapest_package else None,
        "sampleWeeklyRate": None,
    }

    if not args.apply:
        logger.info("Whitewater Express snapshot sync preview")
        logger.info("Arrival: %s", arrival_date)
        logger.info("Nights: %s", nights)
        logger.info("Packages: %s", len(packages))
        for package in packages:
            logger.info(
                "%s | %s | %s",
                package["title"],
                package["duration"] or "-",
                package["price"] or "-",
            )
        return

    client = build_client()
    venue_id = load_venue_id(client)
    if not venue_id:
        raise RuntimeError(f"Could not find active venue row for {VENUE_SLUG}")

    payload = {
        "venue_id": venue_id,
        "provider_id": PROVIDER_ID,
        "inventory_scope": "package",
        "arrival_date": arrival_date,
        "nights": nights,
        "captured_for_date": date.today().isoformat(),
        "captured_at": datetime.utcnow().isoformat(),
        "window_label": window_label,
        "total_results": len(packages),
        "source_url": CATALOG_URL,
        "records": [record],
        "sample_sites": packages,
        "metadata": {
          "provider_label": "Whitewater Express",
          "catalog_url": CATALOG_URL,
          "sync_mode": "crawler",
          "record_shape": "package_catalog",
        },
    }

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

    logger.info("Persisted Whitewater Express snapshot")
    logger.info("Arrival: %s", arrival_date)
    logger.info("Nights: %s", nights)
    logger.info("Packages: %s", len(packages))


if __name__ == "__main__":
    main()
