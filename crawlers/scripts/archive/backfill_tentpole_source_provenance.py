#!/usr/bin/env python3
"""
Backfill source provenance on upcoming tentpole rows.

Conservative behavior:
1) For active upcoming tentpole events with source_id=NULL, set source_id only when
   exactly one source can be confidently resolved.
2) If a source_id=NULL tentpole row duplicates an active source-backed tentpole row
   by (normalized title, start_date), deactivate the null-source duplicate.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client


# High-confidence manual aliases for known tentpole naming variants.
TITLE_TO_SOURCE_SLUG_HINTS: dict[str, tuple[str, ...]] = {
    "atlanta beltline lantern parade": ("beltline-lantern-parade", "atlanta-beltline", "beltline"),
    "ajc peachtree road race": ("peachtree-road-race", "atlanta-track-club"),
    "publix atlanta marathon": ("atlanta-track-club",),
    "atlanta jazz festival": ("atlanta-jazz-fest",),
    "atlanta food & wine festival": ("atlanta-food-wine",),
    "inman park festival": ("inman-park-festival",),
    "dragon con": ("dragon-con",),
    "shaky knees": ("shaky-knees",),
    "momocon": ("momocon",),
    "southern-fried gaming expo": ("southern-fried-gaming-expo",),
    "buried alive film festival": ("buried-alive",),
    "anime weekend atlanta": ("anime-weekend-atlanta",),
    "atlanta science festival": ("atlanta-science-festival",),
    "atlanta tech week": ("atlanta-tech-week",),
    "render atl": ("render-atl",),
    "sweetwater 420 fest": ("sweetwater-420-fest",),
    "sweet auburn springfest": ("sweet-auburn-springfest",),
    "furry weekend atlanta": ("furry-weekend-atlanta",),
    "atlanta dogwood festival": ("atlanta-dogwood",),
    "east atlanta strut": ("east-atlanta-strut",),
    "decatur book festival": ("decatur-book-festival",),
    "georgia renaissance festival": ("ga-renaissance-festival",),
    "blue ridge trout outdoor adventures festival": ("blue-ridge-trout-fest",),
    "221b con": ("221b-con",),
    "fifa fan festival atlanta": ("fifa-fan-festival-atlanta",),
    "esfna ethiopian sports cultural festival": ("esfna-atlanta",),
    "breakaway music festival atlanta": ("breakaway-atlanta",),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill source provenance on tentpole rows")
    parser.add_argument("--apply", action="store_true", help="Apply updates (default dry-run)")
    parser.add_argument(
        "--report-out",
        help=(
            "Optional report path. "
            "Default: ../reports/tentpole-source-provenance-YYYY-MM-DD.json"
        ),
    )
    return parser.parse_args()


def default_report_path() -> Path:
    return ROOT.parent / "reports" / f"tentpole-source-provenance-{date.today().isoformat()}.json"


def _norm(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", (text or "").lower())
    return " ".join(cleaned.split())


def _slugify(text: str) -> str:
    return _norm(text).replace(" ", "-")


def _chunked(values: list[int], size: int = 200) -> list[list[int]]:
    return [values[idx : idx + size] for idx in range(0, len(values), size)]


def _fetch_rows(client, table: str, fields: str, *, page_size: int = 1000) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        result = (
            client.table(table)
            .select(fields)
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def main() -> int:
    args = parse_args()
    apply = bool(args.apply)
    report_path = Path(args.report_out) if args.report_out else default_report_path()
    report_path.parent.mkdir(parents=True, exist_ok=True)

    client = get_client()

    rows = (
        client.table("events")
        .select("id,title,start_date,source_id,is_tentpole,is_active,festival_id,canonical_event_id")
        .eq("is_tentpole", True)
        .gte("start_date", date.today().isoformat())
        .is_("canonical_event_id", "null")
        .execute()
        .data
        or []
    )
    rows = [row for row in rows if row.get("is_active") is not False]

    sources = _fetch_rows(client, "sources", "id,slug,name,is_active")
    source_by_slug = {str(row.get("slug") or ""): row for row in sources if row.get("slug")}

    festivals = _fetch_rows(client, "festivals", "id,slug,name")
    festival_by_id = {row.get("id"): row for row in festivals}

    # 1) Deactivate null-source duplicates when an active source-backed row exists.
    by_key: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = (_norm(str(row.get("title") or "")), str(row.get("start_date") or "")[:10])
        by_key[key].append(row)

    duplicate_null_ids: list[int] = []
    duplicate_groups: list[dict[str, Any]] = []

    for (title_key, start_date), group in by_key.items():
        null_rows = [row for row in group if row.get("source_id") is None]
        source_rows = [row for row in group if row.get("source_id") is not None]
        if not null_rows or not source_rows:
            continue
        duplicate_null_ids.extend(int(row["id"]) for row in null_rows if row.get("id") is not None)
        duplicate_groups.append(
            {
                "title_key": title_key,
                "start_date": start_date,
                "null_event_ids": [row.get("id") for row in null_rows],
                "source_event_ids": [row.get("id") for row in source_rows],
            }
        )

    duplicate_null_ids = sorted(set(duplicate_null_ids))
    duplicate_deactivated = 0
    if apply and duplicate_null_ids:
        for bucket in _chunked(duplicate_null_ids):
            result = (
                client.table("events")
                .update({"is_active": False, "is_tentpole": False})
                .in_("id", bucket)
                .execute()
            )
            duplicate_deactivated += len(result.data or [])

    # 2) Backfill source_id for remaining null-source rows.
    active_rows = (
        client.table("events")
        .select("id,title,start_date,source_id,is_tentpole,is_active,festival_id,canonical_event_id")
        .eq("is_tentpole", True)
        .gte("start_date", date.today().isoformat())
        .is_("canonical_event_id", "null")
        .execute()
        .data
        or []
    )
    active_rows = [row for row in active_rows if row.get("is_active") is not False and row.get("source_id") is None]

    backfill_candidates: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    for row in active_rows:
        event_id = row.get("id")
        title = str(row.get("title") or "").strip()
        title_norm = _norm(title)
        title_slug = _slugify(title)
        festival_id = row.get("festival_id")

        candidate_slugs: list[str] = []
        hints = TITLE_TO_SOURCE_SLUG_HINTS.get(title_norm)
        if hints:
            candidate_slugs.extend(hints)

        if title_slug:
            candidate_slugs.append(title_slug)

        if festival_id and festival_id in festival_by_id:
            festival_row = festival_by_id[festival_id]
            festival_slug = str(festival_row.get("slug") or "").strip()
            if festival_slug:
                candidate_slugs.append(festival_slug)
            festival_name_slug = _slugify(str(festival_row.get("name") or ""))
            if festival_name_slug:
                candidate_slugs.append(festival_name_slug)

        # Conservative fuzzy hint: source slug contains event title slug or vice-versa.
        for source in sources:
            slug = str(source.get("slug") or "")
            if not slug:
                continue
            if title_slug and (title_slug in slug or slug in title_slug):
                candidate_slugs.append(slug)

        deduped = []
        seen = set()
        for slug in candidate_slugs:
            if not slug or slug in seen:
                continue
            seen.add(slug)
            deduped.append(slug)

        matched_sources = [source_by_slug[slug] for slug in deduped if slug in source_by_slug]
        unique_source_ids = sorted({int(source["id"]) for source in matched_sources if source.get("id") is not None})
        active_source_ids = sorted(
            {
                int(source["id"])
                for source in matched_sources
                if source.get("id") is not None and bool(source.get("is_active"))
            }
        )

        resolved_source_id: int | None = None
        if len(active_source_ids) == 1:
            resolved_source_id = active_source_ids[0]
        elif len(unique_source_ids) == 1:
            resolved_source_id = unique_source_ids[0]

        if resolved_source_id is not None:
            backfill_candidates.append(
                {
                    "event_id": int(event_id),
                    "title": title,
                    "start_date": row.get("start_date"),
                    "resolved_source_id": resolved_source_id,
                    "resolved_source_slug": next(
                        (source.get("slug") for source in matched_sources if int(source.get("id")) == resolved_source_id),
                        None,
                    ),
                    "matched_source_slugs": [source.get("slug") for source in matched_sources],
                }
            )
        else:
            unresolved.append(
                {
                    "event_id": event_id,
                    "title": title,
                    "start_date": row.get("start_date"),
                    "candidate_source_slugs": [source.get("slug") for source in matched_sources],
                }
            )

    backfilled = 0
    if apply and backfill_candidates:
        for row in backfill_candidates:
            result = (
                client.table("events")
                .update({"source_id": row["resolved_source_id"]})
                .eq("id", row["event_id"])
                .execute()
            )
            backfilled += len(result.data or [])

    payload = {
        "snapshot_date": date.today().isoformat(),
        "mode": "apply" if apply else "dry-run",
        "upcoming_tentpole_rows_scanned": len(rows),
        "duplicate_null_source_groups": len(duplicate_groups),
        "duplicate_null_source_ids": duplicate_null_ids,
        "duplicate_null_rows_deactivated": duplicate_deactivated,
        "source_backfill_candidates": len(backfill_candidates),
        "source_backfilled": backfilled,
        "unresolved_null_source_rows": len(unresolved),
        "backfill_sample": backfill_candidates[:40],
        "unresolved_sample": unresolved[:40],
    }

    report_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote: {report_path}")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
