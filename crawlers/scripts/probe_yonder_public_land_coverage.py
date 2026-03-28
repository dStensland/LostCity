#!/usr/bin/env python3
"""
Probe public-land trail and camping breadth for Yonder.

This script is intentionally read-mostly:
  - fetches public named trail / trailhead / camp-site candidates from OSM Overpass
  - compares them against the current LostCity venue graph
  - reports which source families are ready or blocked by missing API keys

It does not write to the database.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/probe_yonder_public_land_coverage.py
    python3 scripts/probe_yonder_public_land_coverage.py --refresh-cache
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client
from utils import slugify


OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)
DEFAULT_CACHE_HOURS = 24 * 7

QUERY_DEFS = {
    "camp_sites": """
[out:json][timeout:90];
area["ISO3166-2"="US-GA"]->.searchArea;
(
  nwr["tourism"="camp_site"]["name"](area.searchArea);
  nwr["tourism"="caravan_site"]["name"](area.searchArea);
);
out tags center;
""".strip(),
    "trailheads": """
[out:json][timeout:90];
area["ISO3166-2"="US-GA"]->.searchArea;
(
  nwr["information"="trailhead"]["name"](area.searchArea);
);
out tags center;
""".strip(),
    "hiking_routes": """
[out:json][timeout:120];
area["ISO3166-2"="US-GA"]->.searchArea;
(
  relation["route"="hiking"]["name"](area.searchArea);
);
out tags center;
""".strip(),
}

KIND_PRIORITY = {"camp_site": 0, "trailhead": 1, "hiking_route": 2}
LOW_SIGNAL_CAMP_NAME_RE = (
    r"^\d+$|^ac\s*\d+$|^backcountry(?: campsite)?\s*#?\d+$|^campsite\s*#?\d+$|"
    r"^camping area \d+$|^campground$"
)
TRAIL_NAME_ALIASES = {
    "gahuti": "gahuti trail",
    "pine moutain trail": "pine mountain trail",
    "pine mountain trail": "pine mountain trail",
    "upper terrora natura trail": "upper terrora nature trail",
    "upper terrora nature trail": "upper terrora nature trail",
    "terrora lake loop trail": "terrora trail",
    "terrora trail": "terrora trail",
    "ocmulgee flats camp": "ocmulgee horse camp",
    "ocmulgee horse camp": "ocmulgee horse camp",
    "pataula rv park": "pataula creek rv campground",
    "pataula creek rv campground": "pataula creek rv campground",
    "eagles roost r v resort": "eagle s roost rv resort",
    "eagle s roost rv resort": "eagle s roost rv resort",
    "lake park r v campground": "lake park rv campground",
    "lake park rv campground": "lake park rv campground",
    "river s end campground and rv park": "rivers end campground rv park",
    "rivers end campground rv park": "rivers end campground rv park",
    "cathead creek ranch rv park": "cat head creek rv park",
    "cat head creek rv park": "cat head creek rv park",
}

CAMP_OPERATOR_ALIASES = {
    ("lake blackshear campgrounds", ""): "georgia veterans state park campground",
    ("mulberry gap mountain bike getaway", ""): "mulberry gap adventure basecamp",
    ("pioneer camping", "stephen c foster state park"): "stephen c foster state park pioneer campground",
}


@dataclass(frozen=True)
class Candidate:
    kind: str
    name: str
    slug: str
    lat: float | None
    lng: float | None
    operator: str | None
    website: str | None


def normalize_name(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).split())


def name_variants(value: str) -> set[str]:
    normalized = normalize_name(value)
    if not normalized:
        return set()
    variants = {normalized, TRAIL_NAME_ALIASES.get(normalized, normalized)}
    suffixes = [" trail", " loop", " loop trail", " path", " nature trail"]
    for suffix in suffixes:
        if normalized.endswith(suffix):
            variants.add(normalized[: -len(suffix)].strip())
        else:
            variants.add(f"{normalized}{suffix}")
    return {item for item in variants if item}


def candidate_name_variants(candidate: Candidate) -> set[str]:
    variants = name_variants(candidate.name)
    operator_norm = normalize_name(candidate.operator or "")
    candidate_norm = normalize_name(candidate.name)
    alias = CAMP_OPERATOR_ALIASES.get((candidate_norm, operator_norm))
    if alias:
        variants.add(alias)
    return {item for item in variants if item}


def candidate_matches_existing(candidate: Candidate, venue_rows: list[dict[str, Any]]) -> bool:
    candidate_norm = normalize_name(candidate.name)
    if not candidate_norm:
        return False
    candidate_variants = candidate_name_variants(candidate)

    for row in venue_rows:
        slug = row.get("slug") or ""
        if slug == candidate.slug:
            return True
        existing_name = row.get("name") or ""
        existing_norm = normalize_name(existing_name)
        if not existing_norm:
            continue
        existing_variants = name_variants(existing_name)
        if candidate_norm == existing_norm:
            return True
        if candidate_variants & existing_variants:
            return True
        if len(candidate_norm) >= 8 and candidate_norm in existing_norm:
            return True
        if len(existing_norm) >= 8 and existing_norm in candidate_norm:
            return True
    return False


def fetch_rows(client: Any, table: str, fields: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        batch = (
            client.table(table)
            .select(fields)
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def cache_path(name: str) -> Path:
    return CACHE_DIR / f"yonder-public-land-{name}.json"


def fetch_overpass(name: str, query: str, *, refresh_cache: bool, cache_hours: int) -> list[dict[str, Any]]:
    path = cache_path(name)
    if path.exists() and not refresh_cache:
        age_hours = (time.time() - path.stat().st_mtime) / 3600
        if age_hours <= cache_hours:
            with path.open() as fh:
                return json.load(fh)

    response = requests.post(
        OVERPASS_URL,
        data={"data": query},
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json().get("elements", [])

    with path.open("w") as fh:
        json.dump(payload, fh)

    return payload


def normalize_candidates(elements: list[dict[str, Any]], kind: str) -> list[Candidate]:
    results: list[Candidate] = []
    seen: set[tuple[str, str]] = set()
    for element in elements:
        tags = element.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name:
            continue

        normalized_kind = kind
        if tags.get("tourism") in {"camp_site", "caravan_site"}:
            normalized_kind = "camp_site"
        elif tags.get("information") == "trailhead":
            normalized_kind = "trailhead"
        elif tags.get("route") == "hiking":
            normalized_kind = "hiking_route"

        slug = slugify(name)
        if not slug:
            continue
        if normalized_kind == "camp_site" and _is_low_signal_camp_name(name):
            continue

        dedupe_key = (normalized_kind, slug)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        lat = element.get("lat") or (element.get("center") or {}).get("lat")
        lng = element.get("lon") or (element.get("center") or {}).get("lon")
        results.append(
            Candidate(
                kind=normalized_kind,
                name=name,
                slug=slug,
                lat=lat,
                lng=lng,
                operator=tags.get("operator"),
                website=tags.get("website"),
            )
        )
    return results


def _is_low_signal_camp_name(name: str) -> bool:
    return bool(re.match(LOW_SIGNAL_CAMP_NAME_RE, name.strip(), re.IGNORECASE))


def source_status_summary() -> list[str]:
    lines = [
        f"- `osm_overpass`: ready (no key required, cached HTTP acquisition)",
        (
            "- `ridb_recreation_gov`: blocked until `RIDB_API_KEY` exists"
            if not os.getenv("RIDB_API_KEY")
            else "- `ridb_recreation_gov`: key present, ready for next probe"
        ),
        (
            "- `nps_api`: blocked until `NPS_API_KEY` exists"
            if not os.getenv("NPS_API_KEY")
            else "- `nps_api`: key present, ready for next probe"
        ),
    ]
    return lines


def rank_missing(candidate: Candidate) -> tuple[int, int, int, str]:
    return (
        KIND_PRIORITY.get(candidate.kind, 99),
        0 if candidate.operator else 1,
        0 if candidate.website else 1,
        candidate.name.lower(),
    )


def main() -> int:
    refresh_cache = "--refresh-cache" in sys.argv
    client = get_client()
    venue_rows = [
        row
        for row in fetch_rows(
            client,
            "venues",
            "id,name,slug,venue_type,state,active",
        )
        if row.get("is_active", True) is not False and row.get("state") == "GA"
    ]

    candidates: list[Candidate] = []
    for kind, query in QUERY_DEFS.items():
        elements = fetch_overpass(
            kind,
            query,
            refresh_cache=refresh_cache,
            cache_hours=DEFAULT_CACHE_HOURS,
        )
        candidates.extend(normalize_candidates(elements, kind))

    deduped: dict[tuple[str, str], Candidate] = {}
    for candidate in candidates:
        deduped[(candidate.kind, candidate.slug)] = candidate
    candidates = list(deduped.values())

    missing = [
        candidate
        for candidate in candidates
        if not candidate_matches_existing(candidate, venue_rows)
    ]

    kind_counts = Counter(candidate.kind for candidate in candidates)
    missing_counts = Counter(candidate.kind for candidate in missing)

    print("=" * 72)
    print("Yonder Public-Land Coverage Probe")
    print("=" * 72)
    print("Source readiness:")
    for line in source_status_summary():
        print(line)
    print("")
    print(f"Georgia venue rows checked: {len(venue_rows)}")
    print(f"Public-land candidates from Overpass: {len(candidates)}")
    print("Candidate counts by kind:")
    for kind, count in sorted(kind_counts.items()):
        print(f"- {kind}: {count}")
    print("")
    print(f"Missing against current GA venue graph: {len(missing)}")
    for kind, count in sorted(missing_counts.items()):
        print(f"- missing {kind}: {count}")

    if missing:
        print("")
        print("Top missing candidates:")
        for candidate in sorted(missing, key=rank_missing)[:25]:
            extras = []
            if candidate.operator:
                extras.append(candidate.operator)
            if candidate.website:
                extras.append(candidate.website)
            extra_text = f" | {' | '.join(extras)}" if extras else ""
            print(f"- [{candidate.kind}] {candidate.name}{extra_text}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
