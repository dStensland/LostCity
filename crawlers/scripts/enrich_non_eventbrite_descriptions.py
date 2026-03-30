#!/usr/bin/env python3
"""
Backfill short descriptions for non-Eventbrite events by extracting real content
from each event's source URL via JSON-LD and OpenGraph.

Default mode is dry-run.
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path
import sys
import time
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from extractors.structured import extract_jsonld_event_fields, extract_open_graph_fields

DEFAULT_SOURCE_SLUGS = [
    "ticketmaster",
    "ticketmaster-nashville",
    "gsu-athletics",
    "emory-healthcare-community",
    "atlanta-recurring-social",
    "team-trivia",
    "meetup",
    "amc-atlanta",
    "fulton-library",
    "truist-park",
    "laughing-skull",
    "lore-atlanta",
    "cooks-warehouse",
    "big-peach-running",
    "terminal-west",
    "aisle5",
    "ksu-athletics",
    "painting-with-a-twist",
]

DETAIL_TIMEOUT = 15
DETAIL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrich short non-Eventbrite event descriptions."
    )
    parser.add_argument(
        "--start-date",
        default=date.today().isoformat(),
        help="Lower bound start_date (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=600,
        help="Maximum candidate events to process. Default: 600.",
    )
    parser.add_argument(
        "--min-length",
        type=int,
        default=220,
        help="Only process descriptions shorter than this length. Default: 220.",
    )
    parser.add_argument(
        "--min-delta",
        type=int,
        default=30,
        help="Minimum character increase required before updating. Default: 30.",
    )
    parser.add_argument(
        "--source-slugs",
        default=",".join(DEFAULT_SOURCE_SLUGS),
        help=(
            "Comma-separated source slugs. Default: "
            "ticketmaster,ticketmaster-nashville,gsu-athletics,emory-healthcare-community,"
            "atlanta-recurring-social,team-trivia,meetup,amc-atlanta,fulton-library,"
            "truist-park,laughing-skull,lore-atlanta,cooks-warehouse,big-peach-running,"
            "terminal-west,aisle5,ksu-athletics,painting-with-a-twist."
        ),
    )
    parser.add_argument(
        "--all-sources",
        action="store_true",
        help="Ignore --source-slugs and process all sources in scope.",
    )
    parser.add_argument(
        "--exclude-source-slugs",
        default="eventbrite",
        help=(
            "Comma-separated source slugs to skip. Default: eventbrite "
            "(handled by dedicated Eventbrite enrichment script)."
        ),
    )
    parser.add_argument(
        "--festival-only",
        action="store_true",
        help="Only process events linked to a festival (festival_id is not null).",
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
    parser.add_argument(
        "--page-size",
        type=int,
        default=1000,
        help="Page size for candidate fetch pagination. Default: 1000.",
    )
    parser.add_argument(
        "--update-retries",
        type=int,
        default=3,
        help="Retry attempts for DB updates when --apply is set. Default: 3.",
    )
    parser.add_argument(
        "--update-retry-delay",
        type=float,
        default=1.5,
        help="Base retry delay in seconds for DB updates. Default: 1.5.",
    )
    return parser.parse_args()


def clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(str(value).split()).strip()


def fetch_detail_description(url: str) -> Optional[str]:
    if not url:
        return None
    try:
        resp = requests.get(url, headers={"User-Agent": DETAIL_UA}, timeout=DETAIL_TIMEOUT)
        if not resp.ok:
            return None
        html = resp.text
        jsonld = extract_jsonld_event_fields(html)
        description = clean_text(jsonld.get("description"))
        if description:
            return description
        og = extract_open_graph_fields(html)
        return clean_text(og.get("description")) or None
    except Exception:
        return None


def merge_descriptions(current: str, incoming: str, max_len: int = 1400) -> str:
    current = clean_text(current)
    incoming = clean_text(incoming)
    if not incoming:
        return current
    if not current:
        return incoming[:max_len]

    current_lower = current.lower()
    incoming_lower = incoming.lower()
    if incoming_lower in current_lower:
        return current[:max_len]
    if current_lower in incoming_lower:
        return incoming[:max_len]
    return f"{current}\n\n{incoming}"[:max_len]


# Sources that have dedicated crawlers fetching real descriptions — never overwrite
# what those crawlers produce.
_NEVER_OVERWRITE_SOURCES: frozenset[str] = frozenset(
    {
        "eddies-attic",
        "terminal-west",
        "aisle5",
        "blind-willies",
        "the-earl",
        "punchline",
        "laughing-skull",
        "city-winery",
        "the-masquerade",
        "state-farm-arena",
        "truist-park",
        "star-community-bar",
        "ameris-bank-amphitheatre",
        "tabernacle",
        "chastain-park-amphitheatre",
        "fox-theatre",
        "variety-playhouse",
        "center-stage",
        "coca-cola-roxy",
        "uptown-comedy",
        "dads-garage",
        "whole-world-improv",
        "smiths-olde-bar",
        "lore-atlanta",
    }
)


def enrich_event(event: dict, source_slug: str) -> Optional[str]:
    """Enrich an event description using real extraction from the source URL.

    Previously dispatched to 18 source-specific template builders that assembled
    metadata into synthetic prose. Now uses fetch_detail_description() which
    extracts real descriptions via JSON-LD and OpenGraph from the source page.
    """
    if source_slug in _NEVER_OVERWRITE_SOURCES:
        return None

    source_url = clean_text(event.get("source_url"))
    if not source_url:
        return None

    current = clean_text(event.get("description"))
    extracted = fetch_detail_description(source_url)
    if not extracted:
        return None

    # Don't replace if extracted is shorter than what we already have
    if len(extracted) < len(current) + 30 and len(current) >= 150:
        return None

    if extracted == current:
        return None

    return merge_descriptions(current, extracted)


def fetch_source_rows(client, slugs: list[str]) -> list[dict]:
    source_rows = (
        client.table("sources")
        .select("id,slug")
        .in_("slug", slugs)
        .execute()
        .data
        or []
    )
    return [row for row in source_rows if row.get("id") and row.get("slug")]


def fetch_all_source_rows(client) -> list[dict]:
    source_rows = (
        client.table("sources")
        .select("id,slug")
        .execute()
        .data
        or []
    )
    return [row for row in source_rows if row.get("id") and row.get("slug")]


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


def fetch_candidate_events(
    client,
    *,
    source_ids: list[int],
    start_date: str,
    festival_only: bool,
    portal_id: Optional[str],
    limit: int,
    page_size: int,
) -> list[dict]:
    candidates: list[dict] = []
    offset = 0
    remaining = max(1, int(limit))
    chunk_size = max(1, int(page_size))

    while remaining > 0:
        batch_size = min(chunk_size, remaining)
        query = (
            client.table("events")
            .select(
                "id,title,description,source_url,start_date,source_id,festival_id"
            )
            .gte("start_date", start_date)
            .is_("canonical_event_id", "null")
        )
        if source_ids:
            query = query.in_("source_id", source_ids)
        if festival_only:
            query = query.not_.is_("festival_id", "null")
        if portal_id:
            query = query.or_(f"portal_id.is.null,portal_id.eq.{portal_id}")

        batch = (
            query.order("start_date")
            .order("id")
            .range(offset, offset + batch_size - 1)
            .execute()
            .data
            or []
        )
        if not batch:
            break

        candidates.extend(batch)
        fetched = len(batch)
        remaining -= fetched
        if fetched < batch_size:
            break
        offset += fetched

    return candidates


def update_description_with_retry(
    client,
    event_id: int,
    description: str,
    *,
    retries: int,
    retry_delay: float,
) -> bool:
    attempts = max(1, int(retries))
    base_delay = max(0.0, float(retry_delay))

    for attempt in range(1, attempts + 1):
        try:
            client.table("events").update({"description": description}).eq("id", event_id).execute()
            return True
        except Exception as exc:
            if attempt >= attempts:
                print(f"[error] update failed id={event_id} attempts={attempts} err={exc}")
                return False
            delay = base_delay * (2 ** (attempt - 1))
            print(
                f"[warn] retrying update id={event_id} attempt={attempt}/{attempts} "
                f"delay={delay:.1f}s err={exc}"
            )
            if delay > 0:
                time.sleep(delay)
    return False


def main() -> int:
    args = parse_args()
    source_slugs = [s.strip() for s in args.source_slugs.split(",") if s.strip()]
    excluded_slugs = {
        s.strip().lower() for s in args.exclude_source_slugs.split(",") if s.strip()
    }
    client = get_client()
    try:
        portal_id = resolve_portal_id(client, args.portal)
    except ValueError as exc:
        print(str(exc))
        return 1

    if args.all_sources:
        source_rows = fetch_all_source_rows(client)
    else:
        source_rows = fetch_source_rows(client, source_slugs)
    if not source_rows:
        if args.all_sources:
            print("No sources found.")
        else:
            print(f"No sources found for slugs: {source_slugs}")
        return 1

    source_id_to_slug = {int(row["id"]): str(row["slug"]) for row in source_rows}
    source_ids = list(source_id_to_slug.keys())

    candidates = fetch_candidate_events(
        client,
        source_ids=source_ids,
        start_date=args.start_date,
        festival_only=bool(args.festival_only),
        portal_id=portal_id,
        limit=args.limit,
        page_size=args.page_size,
    )

    scanned = 0
    updated = 0
    improved = 0
    skipped = 0
    failed_updates = 0

    for event in candidates:
        scanned += 1
        event_id = int(event["id"])
        source_slug = source_id_to_slug.get(int(event["source_id"]), "unknown")
        if source_slug.lower() in excluded_slugs:
            skipped += 1
            continue
        current_desc = clean_text(event.get("description"))

        if len(current_desc) >= args.min_length:
            skipped += 1
            continue

        enriched_desc = enrich_event(event, source_slug)
        if not enriched_desc:
            skipped += 1
            continue

        delta = len(enriched_desc) - len(current_desc)
        if delta < args.min_delta:
            skipped += 1
            continue

        improved += 1
        title = clean_text(event.get("title"))
        print(
            f"[improved] source={source_slug} id={event_id} "
            f"len {len(current_desc)} -> {len(enriched_desc)} title={title[:90]}"
        )

        if args.apply:
            ok = update_description_with_retry(
                client,
                event_id,
                enriched_desc,
                retries=args.update_retries,
                retry_delay=args.update_retry_delay,
            )
            if ok:
                updated += 1
            else:
                failed_updates += 1

    mode = "apply" if args.apply else "dry-run"
    print(
        f"\nDone ({mode}): scanned={scanned} improved={improved} updated={updated} "
        f"skipped={skipped} failed_updates={failed_updates}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
