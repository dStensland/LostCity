#!/usr/bin/env python3
"""
Backfill thin festival descriptions with structured schedule/context detail.

Default mode is dry-run.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
import sys
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrich short festival descriptions from existing structured data."
    )
    parser.add_argument(
        "--start-date",
        default=date.today().isoformat(),
        help="Lower bound for linked event schedule summary (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Maximum festivals to process. Default: 500.",
    )
    parser.add_argument(
        "--min-length",
        type=int,
        default=220,
        help="Only process descriptions shorter than this length. Default: 220.",
    )
    parser.add_argument(
        "--portal",
        help=(
            "Optional portal slug scope. When set, process festivals where portal_id is NULL "
            "or matches the resolved portal UUID."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write updates to DB (default is dry-run).",
    )
    return parser.parse_args()


def clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(str(value).split()).strip()


def resolve_portal_id(client, portal_slug: Optional[str]) -> Optional[str]:
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


def parse_iso_date(value: Optional[str]) -> Optional[date]:
    raw = clean_text(value)
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw[:10]).date()
    except Exception:
        return None


def fmt_date(value: Optional[str]) -> Optional[str]:
    parsed = parse_iso_date(value)
    if not parsed:
        return None
    return parsed.strftime("%B %-d, %Y")


def format_window(start_value: Optional[str], end_value: Optional[str]) -> Optional[str]:
    start = fmt_date(start_value)
    end = fmt_date(end_value)
    if start and end:
        return f"{start} through {end}"
    if start:
        return f"starting {start}"
    if end:
        return f"through {end}"
    return None


def pick_best_window(festival: dict) -> Optional[str]:
    announced = format_window(
        festival.get("announced_start"),
        festival.get("announced_end"),
    )
    if announced:
        return announced
    pending = format_window(
        festival.get("pending_start"),
        festival.get("pending_end"),
    )
    if pending:
        return pending
    last_year = format_window(
        festival.get("last_year_start"),
        festival.get("last_year_end"),
    )
    if last_year:
        return f"historically held {last_year}"
    return None


def chunked(values: list[str], size: int = 200) -> list[list[str]]:
    return [values[idx : idx + size] for idx in range(0, len(values), size)]


def fetch_linked_events(client, festival_ids: list[str], start_date: str) -> dict[str, list[dict]]:
    events_by_festival: dict[str, list[dict]] = defaultdict(list)
    if not festival_ids:
        return events_by_festival

    for bucket in chunked(festival_ids):
        rows = (
            client.table("events")
            .select(
                "id,title,festival_id,start_date,start_time,category_id,description,"
                "ticket_url,source_url,is_active"
            )
            .in_("festival_id", bucket)
            .gte("start_date", start_date)
            .is_("canonical_event_id", "null")
            .execute()
            .data
            or []
        )
        for row in rows:
            if row.get("is_active") is False:
                continue
            fid = clean_text(row.get("festival_id"))
            if not fid:
                continue
            events_by_festival[fid].append(row)
    return events_by_festival


def summarize_linked_events(events: list[dict]) -> tuple[Optional[str], Optional[str]]:
    if not events:
        return None, None

    dated = [
        (parse_iso_date(event.get("start_date")), event)
        for event in events
        if parse_iso_date(event.get("start_date"))
    ]
    dated.sort(key=lambda item: item[0])
    ordered_events = [item[1] for item in dated]

    count = len(ordered_events)
    first_date = ordered_events[0].get("start_date")
    last_date = ordered_events[-1].get("start_date")
    window = format_window(first_date, last_date)
    schedule_line = (
        f"Current listed schedule includes {count} linked events, {window}."
        if window
        else f"Current listed schedule includes {count} linked events."
    )

    category_counts = Counter(
        clean_text(event.get("category_id")).replace("_", " ").lower()
        for event in ordered_events
        if clean_text(event.get("category_id"))
    )
    top_categories = [name for name, _ in category_counts.most_common(3) if name]

    highlight_titles: list[str] = []
    for event in ordered_events:
        title = clean_text(event.get("title"))
        if not title:
            continue
        if title.lower() in {value.lower() for value in highlight_titles}:
            continue
        highlight_titles.append(title)
        if len(highlight_titles) == 3:
            break

    highlight_parts: list[str] = []
    if top_categories:
        highlight_parts.append(
            "Program mix includes "
            + ", ".join(top_categories[:-1])
            + (", and " + top_categories[-1] if len(top_categories) > 1 else top_categories[0])
            + " programming."
        )
    if highlight_titles:
        highlight_parts.append("Highlighted sessions include " + "; ".join(highlight_titles) + ".")

    return schedule_line, " ".join(highlight_parts) if highlight_parts else None


def build_enriched_description(festival: dict, linked_events: list[dict]) -> Optional[str]:
    current = clean_text(festival.get("description"))
    name = clean_text(festival.get("name"))
    if not name:
        return None

    festival_type = clean_text(festival.get("festival_type")).replace("_", " ").lower()
    primary_type = clean_text(festival.get("primary_type")).replace("_", " ").lower()
    location = clean_text(festival.get("location"))
    neighborhood = clean_text(festival.get("neighborhood"))
    website = clean_text(festival.get("website"))
    ticket_url = clean_text(festival.get("ticket_url"))
    free = festival.get("free")
    price_tier = clean_text(festival.get("price_tier")).replace("_", " ").lower()

    identity_type = festival_type or primary_type or "festival"
    if current and len(current) >= 180:
        intro = current if current.endswith(".") else f"{current}."
    elif current:
        intro = current if current.endswith(".") else f"{current}."
        intro += f" {name} is an Atlanta {identity_type} experience."
    else:
        intro = f"{name} is an Atlanta {identity_type} experience."

    parts: list[str] = [intro]

    window = pick_best_window(festival)
    if window:
        parts.append(f"Timing: {window}.")

    if location and neighborhood:
        parts.append(f"Location: {location} in {neighborhood}.")
    elif location:
        parts.append(f"Location: {location}.")
    elif neighborhood:
        parts.append(f"Location focus: {neighborhood}.")

    schedule_line, highlights = summarize_linked_events(linked_events)
    if schedule_line:
        parts.append(schedule_line)
    if highlights:
        parts.append(highlights)

    if free is True:
        parts.append("Admission: free.")
    elif free is False and price_tier:
        parts.append(f"Pricing: {price_tier}.")
    elif free is False:
        parts.append("Pricing varies by event or ticket tier.")

    if ticket_url:
        parts.append(f"Use the official ticket link for current passes and entry details ({ticket_url}).")
    elif website:
        parts.append(f"Check the official festival site for updates and full schedule details ({website}).")
    else:
        parts.append("Check official organizer channels for the latest schedule and attendance details.")

    enriched = " ".join(clean_text(part) for part in parts if clean_text(part)).strip()[:1800]
    if not enriched:
        return None
    if enriched == current:
        return None
    if len(enriched) < len(current) + 30 and len(current) >= 160:
        return None
    return enriched


def main() -> int:
    args = parse_args()
    client = get_client()
    try:
        portal_id = resolve_portal_id(client, args.portal)
    except ValueError as exc:
        print(str(exc))
        return 1

    query = client.table("festivals").select(
        "id,name,description,announced_start,announced_end,pending_start,pending_end,"
        "last_year_start,last_year_end,location,neighborhood,festival_type,primary_type,"
        "price_tier,free,website,ticket_url"
    )
    if portal_id:
        query = query.or_(f"portal_id.is.null,portal_id.eq.{portal_id}")
    festivals = query.limit(args.limit).execute().data or []

    candidates = [
        row
        for row in festivals
        if len(clean_text(row.get("description"))) < args.min_length
    ]
    festival_ids = [clean_text(row.get("id")) for row in candidates if clean_text(row.get("id"))]
    linked_events = fetch_linked_events(client, festival_ids, args.start_date)

    scanned = 0
    improved = 0
    updated = 0
    skipped = 0

    for festival in candidates:
        scanned += 1
        festival_id = clean_text(festival.get("id"))
        current = clean_text(festival.get("description"))
        enriched = build_enriched_description(
            festival,
            linked_events.get(festival_id, []),
        )
        if not enriched:
            skipped += 1
            continue

        delta = len(enriched) - len(current)
        if delta < 30:
            skipped += 1
            continue

        improved += 1
        print(
            f"[improved] festival={festival_id} len {len(current)} -> {len(enriched)} "
            f"name={clean_text(festival.get('name'))[:90]}"
        )

        if args.apply:
            client.table("festivals").update({"description": enriched}).eq("id", festival_id).execute()
            updated += 1

    mode = "apply" if args.apply else "dry-run"
    print(
        f"\nDone ({mode}): scanned={scanned} improved={improved} updated={updated} skipped={skipped}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
