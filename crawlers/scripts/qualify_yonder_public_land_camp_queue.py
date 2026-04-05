#!/usr/bin/env python3
"""
Qualify the remaining Yonder public-land campground queue.

The Overpass camp-site backlog mixes together:
  - official public-land campgrounds
  - group camps and scout camps
  - special-permit / reserve-a-slot campsites
  - private RV and operator inventory
  - low-signal rows that should never be seeded directly

This script classifies the remaining missing camp queue into those buckets so
the next seed waves stay disciplined.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/qualify_yonder_public_land_camp_queue.py
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client
from utils import slugify


CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "yonder-public-land-camp_sites.json"
LOW_SIGNAL_CAMP_NAME_RE = re.compile(
    r"^\d+$|^ac\s*\d+$|^backcountry(?: campsite)?\s*#?\d+$|^campsite\s*#?\d+$|"
    r"^camping area \d+$|^campground$|^primitive \d+$|^walk-in \d+$|^yurt \d+$|"
    r"^pioneer \d+$|^primitive campsite \d+$|^group camp area$",
    re.IGNORECASE,
)

MANUAL_CLASS_OVERRIDES = {
    "van pug south campground": "needs_review",
}

CAMP_NAME_ALIASES = {
    "lake blackshear campgrounds": "georgia veterans state park campground",
    "mulberry gap mountain bike getaway": "mulberry gap adventure basecamp",
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
    ("pioneer camping", "stephen c foster state park"): "stephen c foster state park pioneer campground",
}


def fetch_venue_presence() -> tuple[set[str], set[str]]:
    client = get_client()
    rows = []
    offset = 0
    while True:
        batch = (
            client.table("places")
            .select("name,slug,state,active")
            .order("id")
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000

    slugs = {
        row.get("slug")
        for row in rows
        if row.get("is_active", True) is not False and row.get("state") == "GA" and row.get("slug")
    }
    names = {
        (row.get("name") or "").strip().lower()
        for row in rows
        if row.get("is_active", True) is not False and row.get("state") == "GA" and row.get("name")
    }
    return slugs, names


def normalize_name(value: str) -> str:
    normalized = " ".join(re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).split())
    return CAMP_NAME_ALIASES.get(normalized, normalized)


def candidate_present(
    name: str,
    slug: str,
    venue_rows: list[dict[str, str | bool | None]],
    operator: str | None = None,
) -> bool:
    candidate_norm = normalize_name(name)
    operator_norm = normalize_name(operator or "")
    candidate_variants = {candidate_norm}
    alias = CAMP_OPERATOR_ALIASES.get((candidate_norm, operator_norm))
    if alias:
        candidate_variants.add(alias)
    for row in venue_rows:
        existing_slug = row.get("slug") or ""
        if existing_slug == slug:
            return True
        existing_name = row.get("name") or ""
        existing_norm = normalize_name(str(existing_name))
        if not existing_norm:
            continue
        if existing_norm in candidate_variants:
            return True
        if any(len(variant) >= 8 and variant in existing_norm for variant in candidate_variants):
            return True
        if len(existing_norm) >= 8 and existing_norm in candidate_norm:
            return True
    return False


def classify_candidate(name: str, operator: str | None, website: str | None) -> str:
    lowered = name.lower().strip()
    operator_l = (operator or "").lower().strip()
    domain = urlparse(website or "").netloc.lower().replace("www.", "")

    manual = MANUAL_CLASS_OVERRIDES.get(lowered)
    if manual:
        return manual

    if LOW_SIGNAL_CAMP_NAME_RE.match(lowered):
        return "low_signal"

    if domain in {
        "fs.usda.gov",
        "recreation.gov",
        "glynncounty.org",
        "georgiawildlife.com",
        "nps.gov",
        "gastateparks.org",
    }:
        return "official_public_land"

    if any(token in operator_l for token in ["forest service", "georgia state parks", "nps", "wildlife", "county"]):
        return "official_public_land"

    if "signupgenius.com" in domain or "lula lake" in operator_l:
        return "special_permit"

    if any(token in operator_l for token in ["boy scouts", "scouting", "ymca", "young life", "life teen"]):
        return "group_camp"

    if "group camp" in lowered:
        return "group_camp"

    if any(token in lowered for token in ["wma", "primitive camp", "backcountry", "campsite"]):
        return "special_permit"

    if any(
        token in domain
        for token in [
            "stonemountainpark.com",
            "atlantamotorspeedway.com",
            "rv",
            "campground.com",
            "resort",
            "club",
        ]
    ):
        return "private_operator"

    if any(token in lowered for token in ["rv", "resort", "motor speedway", "premium camping", "tent camping"]):
        return "private_operator"

    return "needs_review"


def main() -> int:
    if not CACHE_PATH.exists():
        raise FileNotFoundError(
            f"Missing cache at {CACHE_PATH}. Run probe_yonder_public_land_coverage.py first."
        )

    raw_rows = json.loads(CACHE_PATH.read_text())
    existing_slugs, existing_names = fetch_venue_presence()
    client = get_client()
    venue_rows = []
    offset = 0
    while True:
        batch = (
            client.table("places")
            .select("name,slug,state,active")
            .order("id")
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        if not batch:
            break
        venue_rows.extend(
            row for row in batch if row.get("is_active", True) is not False and row.get("state") == "GA"
        )
        if len(batch) < 1000:
            break
        offset += 1000

    remaining = []
    seen_names: set[str] = set()
    for row in raw_rows:
        tags = row.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name or LOW_SIGNAL_CAMP_NAME_RE.match(name):
            continue
        slug = slugify(name)
        if (
            slug in existing_slugs
            or name.lower() in existing_names
            or name.lower() in seen_names
            or candidate_present(name, slug, venue_rows, tags.get("operator"))
        ):
            continue
        seen_names.add(name.lower())
        remaining.append(
            {
                "name": name,
                "operator": tags.get("operator"),
                "website": tags.get("website"),
            }
        )

    grouped: dict[str, list[dict[str, str | None]]] = defaultdict(list)
    for row in remaining:
        grouped[classify_candidate(row["name"], row["operator"], row["website"])].append(row)

    print("=" * 72)
    print("Yonder Remaining Camp Queue Qualification")
    print("=" * 72)
    print(f"Remaining missing camp candidates: {len(remaining)}")
    for label, count in sorted(((k, len(v)) for k, v in grouped.items()), key=lambda item: (-item[1], item[0])):
        print(f"- {label}: {count}")

    for label in [
        "official_public_land",
        "special_permit",
        "group_camp",
        "private_operator",
        "needs_review",
    ]:
        rows = grouped.get(label) or []
        if not rows:
            continue
        print("")
        print(f"{label}:")
        for row in rows[:25]:
            extras = " | ".join([x for x in [row.get("operator"), row.get("website")] if x])
            print(f"- {row['name']}{(' | ' + extras) if extras else ''}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
