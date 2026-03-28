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
from datetime import datetime

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


def format_time_label(value: str | None) -> str | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def fetch_venue_map(client, venue_ids: list[int]) -> dict[int, dict]:
    if not venue_ids:
        return {}
    rows = (
        client.table("places")
        .select("id,name,neighborhood,city,state")
        .in_("id", venue_ids)
        .execute()
        .data
        or []
    )
    result: dict[int, dict] = {}
    for row in rows:
        if row.get("id") is None:
            continue
        result[int(row["id"])] = row
    return result


def build_eventbrite_fallback(event: dict, venue: dict | None, base_desc: str) -> str:
    title = clean_text(event.get("title"))
    source_url = clean_text(event.get("source_url"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    is_free = bool(event.get("is_free"))
    venue_name = clean_text((venue or {}).get("name"))
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    current = clean_text(base_desc)
    if current:
        parts.append(current if current.endswith(".") else f"{current}.")
    else:
        parts.append(f"{title} is an Eventbrite event.")

    if venue_name:
        if neighborhood:
            parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
        else:
            parts.append(f"Location: {venue_name}, {city}, {state}.")
    else:
        parts.append("Location details are listed on the event page.")

    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    parts.append("Free registration." if is_free else "Paid ticketing; tiers and availability may change.")

    if source_url:
        parts.append(f"Check Eventbrite for full agenda details, policy updates, and current ticket availability ({source_url}).")
    else:
        parts.append("Check Eventbrite for full agenda details, policy updates, and current ticket availability.")
    return " ".join(parts)[:1600]


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
        .select("id,title,description,source_url,start_date,start_time,source_id,is_free,venue_id")
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
    venue_ids = sorted({int(row["venue_id"]) for row in candidates if row.get("venue_id") is not None})
    venue_map = fetch_venue_map(client, venue_ids)

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
        venue = venue_map.get(int(event["venue_id"])) if event.get("venue_id") is not None else None

        if not source_url:
            skipped += 1
            continue
        if len(current_desc) >= args.min_length:
            skipped += 1
            continue

        enriched_desc = enrich_description_from_detail_page(current_desc, source_url).strip()
        if len(enriched_desc) < args.min_length:
            fallback_desc = build_eventbrite_fallback(event, venue, enriched_desc or current_desc)
            if len(fallback_desc) > len(enriched_desc):
                enriched_desc = fallback_desc
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
