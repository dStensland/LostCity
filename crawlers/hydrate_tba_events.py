#!/usr/bin/env python3
"""
Hydrate TBA events — enrich future events that are hidden due to missing start_time.

These events are active but invisible to users because the feed/search API filters
out events where start_time IS NULL and is_all_day = FALSE.

This script:
  1. Finds all future active TBA events (no start_time, not all-day)
  2. For each, fetches the source_url (or ticket_url fallback) detail page
  3. Extracts start_time, description, image_url, price via the enrichment pipeline
  4. Updates the event in the database

Usage:
  cd /Users/coach/Projects/LostCity/crawlers

  # Dry run — preview what would be updated
  python3 hydrate_tba_events.py

  # Apply changes
  python3 hydrate_tba_events.py --apply

  # Limit to N events (for testing)
  python3 hydrate_tba_events.py --apply --limit 20

  # Target a specific source domain
  python3 hydrate_tba_events.py --apply --domain punchline.com
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Optional
from urllib.parse import urlparse

from db import get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def fetch_tba_events(
    domain_filter: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    """Fetch future active TBA events from the database."""
    sb = get_client()
    today = date.today().isoformat()

    query = (
        sb.table("events")
        .select("id, title, category_id, start_date, source_url, ticket_url, description, image_url, price_min, is_free, start_time, is_all_day")
        .gte("start_date", today)
        .eq("is_active", True)
        .is_("start_time", "null")
        .eq("is_all_day", False)
        .order("start_date")
    )

    if limit:
        query = query.limit(limit)

    result = query.execute()
    events = result.data

    if domain_filter:
        events = [
            e for e in events
            if domain_filter in (urlparse(e.get("source_url") or "").netloc or "")
            or domain_filter in (urlparse(e.get("ticket_url") or "").netloc or "")
        ]

    return events


def enrich_single_event(event: dict) -> dict:
    """Try to enrich a single event from its detail page.

    Returns dict of fields that were successfully enriched (only new values).
    """
    from pipeline.fetch import fetch_html
    from pipeline.detail_enrich import enrich_from_detail
    from pipeline.models import DetailConfig

    # Try source_url first, fall back to ticket_url
    detail_url = event.get("source_url") or event.get("ticket_url")
    if not detail_url or not detail_url.startswith("http"):
        return {}

    # Skip known calendar/listing pages that won't have individual event data
    skip_patterns = [
        "/calendar/$",
        "/events/$",
        "/schedule/$",
        "instagram.com",
    ]
    for pattern in skip_patterns:
        if re.search(pattern, detail_url):
            # Try ticket_url as fallback
            fallback = event.get("ticket_url")
            if fallback and fallback != detail_url and fallback.startswith("http"):
                detail_url = fallback
            else:
                return {}

    try:
        html, error = fetch_html(detail_url)
        if error or not html:
            return {}

        config = DetailConfig(
            enabled=True,
            use_jsonld=True,
            use_open_graph=True,
            use_heuristic=True,
            use_llm=False,  # Skip LLM for batch — too slow/expensive
        )
        enriched = enrich_from_detail(html, detail_url, "", config)
    except Exception as e:
        logger.debug(f"Enrichment failed for {detail_url}: {e}")
        return {}

    # Build update dict — only include fields that are currently missing
    updates: dict = {}

    if enriched.get("start_time") and not event.get("start_time"):
        updates["start_time"] = enriched["start_time"]

    if enriched.get("end_time"):
        updates["end_time"] = enriched["end_time"]

    desc = enriched.get("description") or ""
    if desc and len(desc) > 30 and not event.get("description"):
        updates["description"] = desc[:2000]

    if enriched.get("image_url") and not event.get("image_url"):
        updates["image_url"] = enriched["image_url"]

    if enriched.get("price_min") is not None and event.get("price_min") is None:
        updates["price_min"] = enriched["price_min"]

    if enriched.get("price_max") is not None:
        updates["price_max"] = enriched["price_max"]

    if enriched.get("is_free") is not None and event.get("is_free") is None:
        updates["is_free"] = enriched["is_free"]

    if enriched.get("ticket_url") and not event.get("ticket_url"):
        updates["ticket_url"] = enriched["ticket_url"]

    return updates


def _group_by_domain(events: list[dict]) -> dict[str, list[dict]]:
    """Group events by their source URL domain."""
    groups: dict[str, list[dict]] = {}
    for event in events:
        url = event.get("source_url", "")
        try:
            domain = urlparse(url).netloc or "unknown"
        except Exception:
            domain = "unknown"
        groups.setdefault(domain, []).append(event)
    return groups


def _hydrate_domain_group(
    domain: str,
    events: list[dict],
    apply: bool,
    verbose: bool,
) -> list[dict]:
    """Hydrate all events for a single domain with per-domain rate limiting.

    Returns a list of result dicts — one per event — with keys:
        eid, updates, error, deduped
    Accumulation of stats is done by the caller.
    """
    sb = get_client()
    results = []

    for event in events:
        eid = event["id"]
        title = event["title"][:50]
        source_domain = urlparse(event.get("source_url") or "").netloc.replace("www.", "")
        result: dict = {"eid": eid, "title": title, "source_domain": source_domain,
                        "updates": {}, "error": False, "deduped": False}

        updates = enrich_single_event(event)
        result["updates"] = updates

        if updates:
            fields = ", ".join(
                f"{k}={v!r:.40}" if k != "description" else f"{k}=({len(v)} chars)"
                for k, v in updates.items()
            )

            if apply:
                try:
                    sb.table("events").update(updates).eq("id", eid).execute()
                    logger.info(f"[{domain}] Updated [{eid}] {title} — {fields}")
                except Exception as e:
                    err_msg = str(e)
                    if "duplicate key" in err_msg or "23505" in err_msg:
                        sb.table("events").update({"is_active": False}).eq("id", eid).execute()
                        result["deduped"] = True
                        logger.info(f"[{domain}] Deactivated duplicate [{eid}] {title}")
                    else:
                        result["error"] = True
                        logger.warning(f"[{domain}] Failed [{eid}] {title}: {e}")
            else:
                logger.info(f"[{domain}] Would update [{eid}] {title} — {fields}")
        else:
            if verbose:
                logger.debug(f"[{domain}] No enrichment: [{eid}] {title} ({source_domain})")

        results.append(result)

        # Per-domain rate limit: 1s between requests to the same host
        if len(events) > 1:
            time.sleep(1.0)

    return results


def hydrate_tba_events(
    *,
    apply: bool = True,
    limit: Optional[int] = None,
    domain_filter: Optional[str] = None,
    verbose: bool = False,
) -> dict:
    """Hydrate TBA events by enriching from source URLs.

    Callable from main.py post-crawl pipeline or standalone CLI.
    Processes domain groups concurrently (up to 5 threads), with a 1s
    per-domain delay between requests to the same host.

    Returns:
        Dict with stats: total, enriched, time_filled, desc_filled,
        image_filled, deduped, errors, no_change.
    """
    events = fetch_tba_events(domain_filter=domain_filter, limit=limit)
    logger.info(f"Found {len(events)} TBA events to process")

    stats: Counter = Counter()
    if not events:
        return dict(stats)

    domain_groups = _group_by_domain(events)
    logger.info(
        f"Processing {len(domain_groups)} domain(s) concurrently: "
        + ", ".join(f"{d}({len(g)})" for d, g in sorted(domain_groups.items()))
    )

    all_results: list[dict] = []

    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {
            pool.submit(_hydrate_domain_group, domain, group, apply, verbose): domain
            for domain, group in domain_groups.items()
        }
        for future in as_completed(futures):
            domain = futures[future]
            try:
                all_results.extend(future.result())
            except Exception as e:
                logger.error(f"Domain group '{domain}' raised an unexpected error: {e}")

    # Accumulate stats from all results in the main thread
    domain_stats: Counter = Counter()
    for r in all_results:
        updates = r["updates"]
        if r["deduped"]:
            stats["deduped"] += 1
        elif r["error"]:
            stats["errors"] += 1
        elif updates:
            stats["enriched"] += 1
            domain_stats[r["source_domain"]] += 1
            if "start_time" in updates:
                stats["time_filled"] += 1
            if "description" in updates:
                stats["desc_filled"] += 1
            if "image_url" in updates:
                stats["image_filled"] += 1
        else:
            stats["no_change"] += 1

    stats["total"] = len(events)
    return dict(stats)


def run(args: argparse.Namespace) -> None:
    stats = hydrate_tba_events(
        apply=args.apply,
        limit=args.limit,
        domain_filter=args.domain,
        verbose=args.verbose,
    )

    total = stats.get("total", 0)
    if not total:
        print("No TBA events found.")
        return

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  TBA Hydration {'APPLIED' if args.apply else 'DRY RUN'}")
    print(f"{'=' * 60}")
    print(f"  Total processed:    {total}")
    print(f"  Enriched:           {stats.get('enriched', 0)}")
    print(f"    start_time found: {stats.get('time_filled', 0)}")
    print(f"    description:      {stats.get('desc_filled', 0)}")
    print(f"    image:            {stats.get('image_filled', 0)}")
    print(f"  No change:          {stats.get('no_change', 0)}")
    if stats.get("deduped"):
        print(f"  Deduped (deactivated): {stats['deduped']}")
    if stats.get("errors"):
        print(f"  Errors:             {stats['errors']}")

    remaining = total - stats.get("time_filled", 0)
    print(f"\n  Still TBA after enrichment: {remaining}")
    if not args.apply and stats.get("enriched"):
        print(f"\n  Run with --apply to write changes to DB")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Hydrate TBA events by enriching from source URLs."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to database. Default is dry-run.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max events to process.",
    )
    parser.add_argument(
        "--domain",
        type=str,
        default=None,
        help="Only process events from this source domain (e.g. punchline.com).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show events that couldn't be enriched.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(args)
