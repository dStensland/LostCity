#!/usr/bin/env python3
"""
Targeted in-place repair for non-zero source data-goal gaps.

Focuses only on sources that currently have future events but still fail goals:
- images: backfill event.image_url from venue.image_url when missing
- tickets: backfill event.ticket_url from non-root source_url when missing
- lineup: backfill sports matchup participants into event_artists

Usage:
  python scripts/repair_nonzero_quality_gaps.py --report reports/source_data_goals_audit_atlanta_2026-02-19_wave6.json
  python scripts/repair_nonzero_quality_gaps.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLERS_ROOT = os.path.dirname(SCRIPT_DIR)
if CRAWLERS_ROOT not in sys.path:
    sys.path.insert(0, CRAWLERS_ROOT)

from db import get_client, upsert_event_artists


def _is_non_root_url(url: str | None) -> bool:
    if not url:
        return False
    try:
        parsed = urlparse(url)
        path = (parsed.path or "").strip("/")
        return bool(path or parsed.query)
    except Exception:
        return False


def _extract_og_image(
    session: requests.Session, cache: dict[str, str | None], page_url: str | None
) -> str | None:
    if not page_url:
        return None
    url = str(page_url).strip()
    if not url:
        return None
    if url in cache:
        return cache[url]

    image: str | None = None
    try:
        resp = session.get(url, timeout=12, allow_redirects=True)
        if resp.ok and resp.text:
            soup = BeautifulSoup(resp.text, "html.parser")
            meta = soup.select_one('meta[property="og:image"]')
            if not meta:
                meta = soup.select_one('meta[name="twitter:image"]')
            if meta:
                candidate = (meta.get("content") or "").strip()
                if candidate and not candidate.startswith("data:"):
                    image = urljoin(resp.url, candidate)
            if not image:
                img = soup.select_one("article img, main img, .event img, img")
                if img:
                    candidate = (img.get("src") or img.get("data-src") or "").strip()
                    if candidate and not candidate.startswith("data:"):
                        image = urljoin(resp.url, candidate)
    except Exception:
        image = None

    cache[url] = image
    return image


def _clean_team_name(name: str) -> str:
    cleaned = " ".join((name or "").split()).strip(" -\u2013\u2014")
    # If prefixed by event label (e.g. "FIFA ... - Spain"), keep the trailing team token.
    if " - " in cleaned:
        cleaned = cleaned.split(" - ")[-1].strip()
    return cleaned


def _parse_matchup(title: str | None) -> tuple[str, str] | None:
    raw = " ".join((title or "").split()).strip()
    if not raw:
        return None

    candidates = [raw]
    if " - " in raw:
        candidates.append(raw.split(" - ")[-1].strip())

    patterns = (
        r"^(?P<a>.+?)\s+(?:vs\.?|v\.?|versus)\s+(?P<b>.+)$",
        r"^(?P<a>.+?)\s+@\s+(?P<b>.+)$",
        r"^(?P<a>.+?)\s+at\s+(?P<b>.+)$",
    )

    for candidate in candidates:
        for pattern in patterns:
            match = re.match(pattern, candidate, flags=re.IGNORECASE)
            if not match:
                continue
            team_a = _clean_team_name(match.group("a"))
            team_b = _clean_team_name(match.group("b"))
            if not team_a or not team_b:
                continue
            if team_a.lower() == team_b.lower():
                continue
            return (team_a, team_b)
    return None


def _load_report(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "rows" not in payload:
        raise ValueError(f"Unexpected report payload: {path}")
    return payload


def _failed_goals_for_nonzero_sources(report: dict[str, Any]) -> dict[str, set[str]]:
    failed_by_slug: dict[str, set[str]] = {}
    for row in report.get("rows", []):
        if row.get("all_goals_passed") is True:
            continue
        if int(row.get("events") or 0) <= 0:
            continue
        slug = str(row.get("slug") or "").strip()
        if not slug:
            continue
        goals = {
            str(goal.get("goal"))
            for goal in (row.get("goal_results") or [])
            if goal.get("ok") is False
        }
        if goals:
            failed_by_slug[slug] = goals
    return failed_by_slug


def _fetch_events_for_sources(source_ids: list[int], start: str, end: str) -> list[dict[str, Any]]:
    client = get_client()
    rows: list[dict[str, Any]] = []
    batch_size = 75
    for idx in range(0, len(source_ids), batch_size):
        batch = source_ids[idx : idx + batch_size]
        chunk = (
            client.table("events")
            .select(
                "id,source_id,venue_id,title,category,start_date,"
                "image_url,ticket_url,source_url,is_free"
            )
            .in_("source_id", batch)
            .gte("start_date", start)
            .lte("start_date", end)
            .execute()
            .data
            or []
        )
        rows.extend(chunk)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair non-zero data-goal quality gaps")
    parser.add_argument(
        "--report",
        default="reports/source_data_goals_audit_atlanta_2026-02-19_wave6.json",
        help="Path to source-data-goals audit report JSON",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=120,
        help="Future event window to repair",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes. Default is dry-run.",
    )
    args = parser.parse_args()

    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = Path(CRAWLERS_ROOT) / report_path
    report = _load_report(report_path)
    failed_by_slug = _failed_goals_for_nonzero_sources(report)
    if not failed_by_slug:
        print("No non-zero failing sources found in report.")
        return 0

    client = get_client()
    source_rows = (
        client.table("sources")
        .select("id,slug")
        .in_("slug", sorted(failed_by_slug.keys()))
        .execute()
        .data
        or []
    )
    if not source_rows:
        print("No matching source rows found.")
        return 0

    source_id_to_slug = {int(row["id"]): str(row["slug"]) for row in source_rows}
    source_ids = sorted(source_id_to_slug.keys())

    start = date.today().isoformat()
    end = (date.today() + timedelta(days=args.days)).isoformat()
    events = _fetch_events_for_sources(source_ids, start, end)
    if not events:
        print("No events found in window.")
        return 0

    event_ids = [int(event["id"]) for event in events if event.get("id")]
    event_ids_with_artists: set[int] = set()
    for idx in range(0, len(event_ids), 200):
        batch = event_ids[idx : idx + 200]
        rows = (
            client.table("event_artists")
            .select("event_id")
            .in_("event_id", batch)
            .execute()
            .data
            or []
        )
        for row in rows:
            if row.get("event_id"):
                event_ids_with_artists.add(int(row["event_id"]))

    venue_ids = sorted({int(e["venue_id"]) for e in events if e.get("venue_id")})
    venue_image_by_id: dict[int, str] = {}
    for idx in range(0, len(venue_ids), 150):
        batch = venue_ids[idx : idx + 150]
        rows = (
            client.table("venues")
            .select("id,image_url")
            .in_("id", batch)
            .execute()
            .data
            or []
        )
        for row in rows:
            venue_id = row.get("id")
            image_url = row.get("image_url")
            if venue_id and image_url:
                venue_image_by_id[int(venue_id)] = str(image_url)

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"Mode: {mode}")
    print(f"Window: {start} -> {end}")
    print(f"Candidate sources: {len(failed_by_slug)}")
    print(f"Candidate events: {len(events)}")

    counts = Counter()
    by_source = defaultdict(Counter)
    http = requests.Session()
    http.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0 Safari/537.36"
            )
        }
    )
    image_cache: dict[str, str | None] = {}

    for event in events:
        event_id = int(event["id"])
        source_id = int(event["source_id"])
        slug = source_id_to_slug.get(source_id)
        if not slug:
            continue

        failed_goals = failed_by_slug.get(slug, set())
        venue_id = int(event["venue_id"]) if event.get("venue_id") else None
        category = str(event.get("category") or "").strip().lower()
        source_url = str(event.get("source_url") or "").strip()
        is_free = event.get("is_free")

        # images: event-level fallback from venue image (matches insert-time fallback behavior).
        if "images" in failed_goals and not event.get("image_url") and venue_id:
            venue_image = venue_image_by_id.get(venue_id)
            if venue_image:
                if args.apply:
                    client.table("events").update({"image_url": venue_image}).eq(
                        "id", event_id
                    ).execute()
                counts["image_backfills"] += 1
                by_source[slug]["image_backfills"] += 1

        # images: source/detail page fallback (og:image/twitter:image/main image).
        if "images" in failed_goals and not event.get("image_url"):
            page_image = _extract_og_image(http, image_cache, source_url)
            if page_image:
                if args.apply:
                    client.table("events").update({"image_url": page_image}).eq(
                        "id", event_id
                    ).execute()
                counts["image_backfills"] += 1
                by_source[slug]["image_backfills"] += 1

        # tickets: use detail/source page when it's clearly not a bare homepage URL.
        if "tickets" in failed_goals and not event.get("ticket_url") and source_url:
            if _is_non_root_url(source_url) or is_free is False:
                if args.apply:
                    client.table("events").update({"ticket_url": source_url}).eq(
                        "id", event_id
                    ).execute()
                counts["ticket_backfills"] += 1
                by_source[slug]["ticket_backfills"] += 1

        # lineup: backfill sports matchups into event_artists when missing.
        if "lineup" in failed_goals and event_id not in event_ids_with_artists:
            matchup = _parse_matchup(event.get("title"))
            if matchup and category in {"sports", "community"}:
                payload = [
                    {
                        "name": matchup[0],
                        "role": "home",
                        "billing_order": 1,
                        "is_headliner": True,
                    },
                    {
                        "name": matchup[1],
                        "role": "away",
                        "billing_order": 2,
                        "is_headliner": False,
                    },
                ]
                if args.apply:
                    upsert_event_artists(event_id, payload, link_canonical=True)
                counts["lineup_backfills"] += 1
                by_source[slug]["lineup_backfills"] += 1

    print("\nRepairs")
    print(f"- image_backfills: {counts['image_backfills']}")
    print(f"- ticket_backfills: {counts['ticket_backfills']}")
    print(f"- lineup_backfills: {counts['lineup_backfills']}")

    if by_source:
        print("\nBy source")
        for slug, stat in sorted(by_source.items(), key=lambda x: x[0]):
            items = ", ".join(f"{k}={v}" for k, v in sorted(stat.items()))
            print(f"- {slug}: {items}")

    if not args.apply:
        print("\nDry run only. Re-run with --apply to persist.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
