#!/usr/bin/env python3
"""
Audit federal campground coverage for Yonder using live NPS and RIDB APIs.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/audit_yonder_federal_campground_coverage.py
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
NPS_TARGET_PARK_CODES = ["cuis", "chat", "ocmu"]
RIDB_TARGET_QUERIES = [
    "Duckett Mill",
    "Old Federal",
    "Bolding Mill",
    "Toto Creek",
    "Van Pugh South",
]
RIDB_NAME_ALIASES = {
    "duckett mill": "ducket mill",
}
RIDB_EXCLUDED_NAMES = {
    "van pugh south day use facility",
}


def normalize_name(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).split())


def name_variants(value: str) -> set[str]:
    normalized = normalize_name(value)
    if not normalized:
        return set()
    normalized = RIDB_NAME_ALIASES.get(normalized, normalized)
    variants = {normalized}
    suffixes = [" campground", " campsite", " wilderness campsite", " beach campground"]
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
        existing_variants = name_variants(row.get("name") or "")
        if candidate_variants & existing_variants:
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


def fetch_nps_campgrounds() -> list[dict]:
    rows = []
    if not NPS_API_KEY:
        return rows
    for park_code in NPS_TARGET_PARK_CODES:
        response = requests.get(
            f"{NPS_BASE_URL}/campgrounds",
            params={"parkCode": park_code, "limit": "50", "api_key": NPS_API_KEY},
            headers={"User-Agent": "LostCity Yonder Audit"},
            timeout=20,
        )
        response.raise_for_status()
        for row in (response.json() or {}).get("data") or []:
            rows.append(
                {
                    "source": "nps",
                    "name": row.get("name"),
                    "slug": slugify(row.get("name") or ""),
                    "website": row.get("url"),
                    "reservation_url": row.get("reservationUrl"),
                    "park_code": row.get("parkCode"),
                }
            )
    return rows


def fetch_ridb_facilities() -> list[dict]:
    rows = []
    if not RIDB_API_KEY:
        return rows
    for query in RIDB_TARGET_QUERIES:
        response = requests.get(
            f"{RIDB_BASE_URL}/facilities",
            params={"query": query, "limit": "10"},
            headers={"apikey": RIDB_API_KEY, "User-Agent": "LostCity Yonder Audit"},
            timeout=20,
        )
        response.raise_for_status()
        for row in (response.json() or {}).get("RECDATA") or []:
            if (row.get("FacilityTypeDescription") or "").lower() != "campground":
                continue
            normalized_name = normalize_name(row.get("FacilityName") or "")
            if normalized_name in RIDB_EXCLUDED_NAMES:
                continue
            rows.append(
                {
                    "source": "ridb",
                    "name": row.get("FacilityName"),
                    "slug": slugify(row.get("FacilityName") or ""),
                    "website": row.get("FacilityReservationURL") or row.get("FacilityMapURL"),
                    "facility_id": row.get("FacilityID"),
                }
            )
    return rows


def main() -> int:
    venue_rows = fetch_venue_rows()
    nps_rows = fetch_nps_campgrounds()
    ridb_rows = fetch_ridb_facilities()

    print("=" * 72)
    print("Yonder Federal Campground Coverage Audit")
    print("=" * 72)
    print(f"NPS key present: {bool(NPS_API_KEY)}")
    print(f"RIDB key present: {bool(RIDB_API_KEY)}")
    print(f"NPS campground rows fetched: {len(nps_rows)}")
    print(f"RIDB campground rows fetched: {len(ridb_rows)}")

    for label, rows in [("NPS", nps_rows), ("RIDB", ridb_rows)]:
        missing = [row for row in rows if not candidate_present(row["name"], row["slug"], venue_rows)]
        print("")
        print(f"{label} missing from current GA venue graph: {len(missing)}")
        for row in missing[:25]:
            extras = " | ".join([x for x in [row.get("park_code"), row.get("facility_id"), row.get("website")] if x])
            print(f"- {row['name']}{(' | ' + extras) if extras else ''}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
