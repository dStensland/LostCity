#!/usr/bin/env python3
"""
Backfill short Eventbrite event descriptions with detail-page FAQ enrichment.

Default mode is dry-run.
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from sources.eventbrite import enrich_description_from_detail_page


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrich short Eventbrite descriptions from detail pages."
    )
    parser.add_argument(
        "--start-date",
        default=date.today().isoformat(),
        help="Lower bound start_date (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=400,
        help="Maximum candidate events to process. Default: 400.",
    )
    parser.add_argument(
        "--min-length",
        type=int,
        default=260,
        help="Only enrich descriptions shorter than this length. Default: 260.",
    )
    parser.add_argument(
        "--source-slug",
        default="eventbrite",
        help="Source slug or prefix to target. Default: eventbrite.",
    )
    parser.add_argument(
        "--portal",
        help=(
            "Optional portal slug scope. When set, process events where portal_id is NULL "
            "or matches the resolved portal UUID."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write updates to DB (default is dry-run).",
    )
    return parser.parse_args()


def fetch_source_ids(client, slug_prefix: str) -> list[int]:
    rows = (
        client.table("sources")
        .select("id,slug")
        .ilike("slug", f"{slug_prefix}%")
        .execute()
        .data
        or []
    )
    return [int(row["id"]) for row in rows if row.get("id") is not None]


def resolve_portal_id(client, portal_slug: str | None) -> str | None:
    slug = clean_text(portal_slug)
    if not slug:
        return None
    rows = (
        client.table("portals")
        .select("id,slug")
        .eq("slug", slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise ValueError(f"Portal slug not found: {slug}")
    portal_id = clean_text(rows[0].get("id"))
    if not portal_id:
        raise ValueError(f"Portal slug resolved without id: {slug}")
    return portal_id


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).split()).strip()



def main() -> int:
    args = parse_args()
    client = get_client()
    try:
        portal_id = resolve_portal_id(client, args.portal)
    except ValueError as exc:
        print(str(exc))
        return 1

    source_ids = fetch_source_ids(client, args.source_slug)
    if not source_ids:
        print(f"No sources found for slug prefix: {args.source_slug}")
        return 1

    query = (
        client.table("events")
        .select("id,title,description,source_url,start_date,source_id")
        .in_("source_id", source_ids)
        .gte("start_date", args.start_date)
        .is_("canonical_event_id", "null")
    )
    if portal_id:
        query = query.or_(f"portal_id.is.null,portal_id.eq.{portal_id}")
    candidates = (
        query.order("start_date")
        .limit(args.limit)
        .execute()
        .data
        or []
    )
    scanned = 0
    updated = 0
    improved = 0
    skipped = 0

    for event in candidates:
        scanned += 1
        event_id = int(event["id"])
        title = str(event.get("title") or "").strip()
        source_url = str(event.get("source_url") or "").strip()
        current_desc = (event.get("description") or "").strip()

        if not source_url:
            skipped += 1
            continue
        if len(current_desc) >= args.min_length:
            skipped += 1
            continue

        enriched_desc = enrich_description_from_detail_page(current_desc, source_url).strip()
        if not enriched_desc or enriched_desc == current_desc:
            skipped += 1
            continue

        delta = len(enriched_desc) - len(current_desc)
        if delta < 20:
            skipped += 1
            continue

        improved += 1
        print(
            f"[improved] id={event_id} len {len(current_desc)} -> {len(enriched_desc)} "
            f"title={title[:90]}"
        )

        if args.apply:
            client.table("events").update({"description": enriched_desc}).eq("id", event_id).execute()
            updated += 1

    mode = "apply" if args.apply else "dry-run"
    print(
        f"\nDone ({mode}): scanned={scanned} improved={improved} updated={updated} skipped={skipped}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
