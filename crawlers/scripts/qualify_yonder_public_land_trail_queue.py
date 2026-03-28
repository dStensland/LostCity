#!/usr/bin/env python3
"""
Qualify the remaining Yonder public-land trail queue.

The remaining hiking-route backlog mixes together:
  - official/public-land named trails
  - conservation / institutional trails
  - map-mirror noise with weak source quality
  - connector paths and ambiguous local names

This classifier keeps future trail waves focused on high-signal named routes.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/qualify_yonder_public_land_trail_queue.py
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


CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "yonder-public-land-hiking_routes.json"
LOW_SIGNAL_TRAIL_RE = re.compile(
    r"\b(path|connector|roadwalk|road and trail|abandoned track|mill road|tobacco pouch road)\b",
    re.IGNORECASE,
)
TRAIL_NAME_ALIASES = {
    "gahuti": "gahuti trail",
    "pine moutain trail": "pine mountain trail",
    "pine mountain trail": "pine mountain trail",
    "upper terrora natura trail": "upper terrora nature trail",
    "upper terrora nature trail": "upper terrora nature trail",
    "terrora lake loop trail": "terrora trail",
    "terrora trail": "terrora trail",
}


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


def candidate_present(name: str, slug: str, venue_rows: list[dict[str, str | bool | None]]) -> bool:
    candidate_norm = normalize_name(name)
    candidate_variants = name_variants(name)
    for row in venue_rows:
        existing_slug = row.get("slug") or ""
        if existing_slug == slug:
            return True
        existing_name = row.get("name") or ""
        existing_norm = normalize_name(str(existing_name))
        if not existing_norm:
            continue
        existing_variants = name_variants(str(existing_name))
        if candidate_norm == existing_norm:
            return True
        if candidate_variants & existing_variants:
            return True
        if len(candidate_norm) >= 8 and candidate_norm in existing_norm:
            return True
        if len(existing_norm) >= 8 and existing_norm in candidate_norm:
            return True
    return False


def classify_candidate(name: str, operator: str | None, website: str | None) -> str:
    lowered = name.lower().strip()
    operator_l = (operator or "").lower().strip()
    domain = urlparse(website or "").netloc.lower().replace("www.", "")

    if domain == "outdoor.rocks":
        return "map_mirror_noise"

    if LOW_SIGNAL_TRAIL_RE.search(lowered):
        return "connector_or_low_signal"

    if domain in {
        "fs.usda.gov",
        "sam.usace.army.mil",
        "gastateparks.org",
        "georgiawildlife.com",
        "nps.gov",
    }:
        return "official_public_land"

    if "nature.org" in domain:
        return "conservation_land"

    if any(token in operator_l for token in ["forest service", "state park", "us army corps", "oconee ranger", "conasauga ranger"]):
        return "official_public_land"

    if any(token in lowered for token in ["trail", "loop"]):
        return "needs_review"

    return "connector_or_low_signal"


def main() -> int:
    if not CACHE_PATH.exists():
        raise FileNotFoundError(
            f"Missing cache at {CACHE_PATH}. Run probe_yonder_public_land_coverage.py first."
        )

    raw_rows = json.loads(CACHE_PATH.read_text())
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
        if not name:
            continue
        slug = slugify(name)
        if not slug or name.lower() in seen_names or candidate_present(name, slug, venue_rows):
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
    print("Yonder Remaining Trail Queue Qualification")
    print("=" * 72)
    print(f"Remaining missing trail candidates: {len(remaining)}")
    for label, rows in sorted(grouped.items(), key=lambda item: (-len(item[1]), item[0])):
        print(f"- {label}: {len(rows)}")

    for label in [
        "official_public_land",
        "conservation_land",
        "needs_review",
        "connector_or_low_signal",
        "map_mirror_noise",
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
