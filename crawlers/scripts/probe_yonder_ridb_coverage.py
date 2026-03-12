#!/usr/bin/env python3
"""
Probe RIDB / Recreation.gov coverage for Yonder public-land inventory.

This script is designed to become useful the moment `RIDB_API_KEY` exists
locally. Until then it reports the current blocker and the exact endpoint
family being targeted.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/probe_yonder_ridb_coverage.py
"""

from __future__ import annotations

import os
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

RIDB_API_KEY = (os.getenv("RIDB_API_KEY") or "").strip()
RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1"
TARGET_QUERIES = [
    "Ocmulgee Flats",
    "Duckett Mill",
    "Old Federal Campground",
    "Bolding Mill Campground",
    "Toto Creek Campground",
]


def request_json(path: str, *, params: dict[str, str]) -> tuple[int, dict | str]:
    response = requests.get(
        f"{RIDB_BASE_URL}{path}",
        params=params,
        headers={"apikey": RIDB_API_KEY, "User-Agent": "LostCity Yonder Probe"},
        timeout=20,
    )
    try:
        payload = response.json()
    except Exception:
        payload = response.text
    return response.status_code, payload


def main() -> int:
    print("=" * 72)
    print("Yonder RIDB / Recreation.gov Probe")
    print("=" * 72)
    print(f"Endpoint family: {RIDB_BASE_URL}/facilities and /recareas")

    if not RIDB_API_KEY:
        print("Status: blocked")
        print("Reason: RIDB_API_KEY is not set locally")
        print("What unlocks next: facility / recreation-area search against Georgia public-land inventory")
        return 0

    print("Status: key present")
    print("")

    status, payload = request_json("/recareas", params={"state": "GA", "limit": "5"})
    print(f"Georgia recareas: HTTP {status}")
    if isinstance(payload, dict):
        recareas = payload.get("RECDATA") or []
        print(f"Returned recareas: {len(recareas)}")
        for row in recareas[:5]:
            print(f"- {row.get('RecAreaName')} [{row.get('RecAreaID')}]")
    else:
        print(str(payload)[:400])

    print("")
    print("Target facility queries:")
    for query in TARGET_QUERIES:
        status, payload = request_json("/facilities", params={"query": query, "limit": "3"})
        print(f"- {query}: HTTP {status}")
        if isinstance(payload, dict):
            rows = payload.get("RECDATA") or []
            for row in rows[:3]:
                print(f"  - {row.get('FacilityName')} [{row.get('FacilityID')}]")
        else:
            print(f"  {str(payload)[:300]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
