#!/usr/bin/env python3
"""
Audit federal park / recreation-area backbone coverage for Yonder.

This focuses on outdoor-relevant federal anchors that support hiking, paddling,
wildlife, and day-use discovery, not just overnight camping.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/audit_yonder_federal_backbone_coverage.py
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client
from utils import slugify

NPS_API_KEY = (os.getenv("NPS_API_KEY") or "").strip()
RIDB_API_KEY = (os.getenv("RIDB_API_KEY") or "").strip()
NPS_BASE_URL = "https://developer.nps.gov/api/v1"
RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1"

RIDB_TARGET_RECAREA_IDS = [
    "1040",
    "1544",
    "440",
    "442",
    "443",
    "454",
    "455",
    "450",
    "1288",
    "1308",
    "1420",
    "1565",
    "3099",
    "4148",
    "449",
    "451",
]
NPS_TARGET_PARK_CODES = ["cuis", "kemo", "ocmu"]
ALIASES = {
    "cumberland island national seashore": "cumberland island",
    "chattahoochee oconee national forest": "chattahoochee oconee national forest",
    "okefenokee national wildlife refuge": "okefenokee",
    "banks lake national wildlife refuge": "banks lake",
    "blackbeard island national wildlife refuge": "blackbeard island",
    "harris neck national wildlife refuge": "harris neck",
    "piedmont national wildlife refuge": "piedmont",
    "bond swamp national wildlife refuge": "bond swamp",
    "sapelo island national estuarine research reserve": "sapelo island",
    "kennesaw mountain national battlefield park": "kennesaw mountain",
}


def normalize_name(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).split())


def name_variants(value: str) -> set[str]:
    normalized = normalize_name(value)
    if not normalized:
        return set()
    normalized = ALIASES.get(normalized, normalized)
    variants = {normalized}
    suffixes = [
        " national seashore",
        " national forest",
        " national wildlife refuge",
        " national estuarine research reserve",
        " national battlefield park",
        " national historical park",
        " lake",
    ]
    for suffix in suffixes:
        if normalized.endswith(suffix):
            variants.add(normalized[: -len(suffix)].strip())
        else:
            variants.add(f"{normalized}{suffix}")
    return {item for item in variants if item}


def candidate_present(name: str, slug: str, venue_rows: list[dict]) -> bool:
    candidate_variants = name_variants(name)
    for row in venue_rows:
        if row.get("slug") == slug:
            return True
        if candidate_variants & name_variants(row.get("name") or ""):
            return True
    return False


def fetch_venue_rows() -> list[dict]:
    client = get_client()
    rows = []
    offset = 0
    while True:
        batch = (
            client.table("venues")
            .select("name,slug,state,active,venue_type")
            .order("id")
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        if not batch:
            break
        rows.extend(
            row for row in batch if row.get("active", True) is not False and row.get("state") == "GA"
        )
        if len(batch) < 1000:
            break
        offset += 1000
    return rows


def fetch_nps_targets() -> list[dict]:
    rows = []
    if not NPS_API_KEY:
        return rows
    for park_code in NPS_TARGET_PARK_CODES:
        response = requests.get(
            f"{NPS_BASE_URL}/parks",
            params={"parkCode": park_code, "limit": "1", "api_key": NPS_API_KEY},
            headers={"User-Agent": "LostCity Yonder Audit"},
            timeout=20,
        )
        response.raise_for_status()
        data = (response.json() or {}).get("data") or []
        if not data:
            continue
        row = data[0]
        rows.append(
            {
                "source": "nps",
                "name": row.get("fullName"),
                "slug": slugify(row.get("fullName") or ""),
                "website": row.get("url"),
                "source_id": row.get("parkCode"),
            }
        )
    return rows


def fetch_ridb_targets() -> list[dict]:
    rows = []
    if not RIDB_API_KEY:
        return rows
    for recarea_id in RIDB_TARGET_RECAREA_IDS:
        response = requests.get(
            f"{RIDB_BASE_URL}/recareas/{recarea_id}",
            headers={"apikey": RIDB_API_KEY, "User-Agent": "LostCity Yonder Audit"},
            timeout=20,
        )
        response.raise_for_status()
        row = response.json()
        rows.append(
            {
                "source": "ridb",
                "name": row.get("RecAreaName"),
                "slug": slugify(row.get("RecAreaName") or ""),
                "website": row.get("RecAreaReservationURL") or row.get("RecAreaMapURL"),
                "source_id": row.get("RecAreaID"),
            }
        )
    return rows


def main() -> int:
    venue_rows = fetch_venue_rows()
    nps_rows = fetch_nps_targets()
    ridb_rows = fetch_ridb_targets()

    print("=" * 72)
    print("Yonder Federal Backbone Coverage Audit")
    print("=" * 72)
    print(f"NPS key present: {bool(NPS_API_KEY)}")
    print(f"RIDB key present: {bool(RIDB_API_KEY)}")
    print(f"NPS backbone targets fetched: {len(nps_rows)}")
    print(f"RIDB backbone targets fetched: {len(ridb_rows)}")

    for label, rows in [("NPS", nps_rows), ("RIDB", ridb_rows)]:
        missing = [row for row in rows if not candidate_present(row["name"], row["slug"], venue_rows)]
        print("")
        print(f"{label} backbone targets missing from current GA venue graph: {len(missing)}")
        for row in missing:
            print(f"- {row['name']} | {row['source_id']} | {row.get('website') or 'no-site'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
