#!/usr/bin/env python3
"""
Probe NPS API coverage for Yonder public-land inventory.

This script is designed to become useful the moment `NPS_API_KEY` exists
locally. Until then it reports the current blocker and the exact endpoint
family being targeted.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/probe_yonder_nps_coverage.py
"""

from __future__ import annotations

import os
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

NPS_API_KEY = (os.getenv("NPS_API_KEY") or "").strip()
NPS_BASE_URL = "https://developer.nps.gov/api/v1"
TARGET_PARK_CODES = ["chat", "ocmu", "cuis", "cuga"]


def request_json(path: str, *, params: dict[str, str]) -> tuple[int, dict | str]:
    response = requests.get(
        f"{NPS_BASE_URL}{path}",
        params={**params, "api_key": NPS_API_KEY},
        headers={"User-Agent": "LostCity Yonder Probe"},
        timeout=20,
    )
    try:
        payload = response.json()
    except Exception:
        payload = response.text
    return response.status_code, payload


def main() -> int:
    print("=" * 72)
    print("Yonder NPS API Probe")
    print("=" * 72)
    print(f"Endpoint family: {NPS_BASE_URL}/parks and /campgrounds")

    if not NPS_API_KEY:
        print("Status: blocked")
        print("Reason: NPS_API_KEY is not set locally")
        print("What unlocks next: Georgia park + campground coverage for NPS-managed inventory")
        return 0

    print("Status: key present")
    print("")

    status, payload = request_json("/parks", params={"stateCode": "ga", "limit": "10"})
    print(f"Georgia parks: HTTP {status}")
    if isinstance(payload, dict):
        rows = payload.get("data") or []
        print(f"Returned parks: {len(rows)}")
        for row in rows[:10]:
            print(f"- {row.get('fullName')} [{row.get('parkCode')}]")
    else:
        print(str(payload)[:400])

    print("")
    print("Target park-code campground queries:")
    for park_code in TARGET_PARK_CODES:
        status, payload = request_json("/campgrounds", params={"parkCode": park_code, "limit": "10"})
        print(f"- {park_code}: HTTP {status}")
        if isinstance(payload, dict):
            rows = payload.get("data") or []
            for row in rows[:5]:
                print(f"  - {row.get('name')} [{row.get('parkCode')}]")
        else:
            print(f"  {str(payload)[:300]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
