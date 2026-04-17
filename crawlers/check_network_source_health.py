#!/usr/bin/env python3
"""Network source health check.

Checks every active network_source and reports:
  - WARN  (yellow) — no posts in 30+ days
  - BROKEN (red)   — no posts in 90+ days
  - DEAD   (red)   — no posts in 365+ days

Ran weekly from cron. The ArtsATL RSS feed was silently frozen on a single
2023 post for 1099 days before anyone noticed; this check exists so the
next broken feed gets flagged in a week instead of three years.

Usage:
    python3 check_network_source_health.py                 # report only
    python3 check_network_source_health.py --write-errors  # also update
                                                             fetch_error
                                                             on stale sources
    python3 check_network_source_health.py --json          # machine-readable
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

env_path = Path(__file__).parent.parent / ".env"
from dotenv import load_dotenv
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

WARN_DAYS = 30
BROKEN_DAYS = 90
DEAD_DAYS = 365


def status_for_age(days: float | None) -> str:
    if days is None:
        return "NEVER"
    if days >= DEAD_DAYS:
        return "DEAD"
    if days >= BROKEN_DAYS:
        return "BROKEN"
    if days >= WARN_DAYS:
        return "WARN"
    return "OK"


def color(status: str) -> str:
    return {
        "OK": "\033[32m",
        "WARN": "\033[33m",
        "BROKEN": "\033[31m",
        "DEAD": "\033[35m",
        "NEVER": "\033[31m",
    }.get(status, "")


RESET = "\033[0m"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-errors", action="store_true",
                        help="Update fetch_error on stale sources (WARN+)")
    parser.add_argument("--json", action="store_true",
                        help="Output JSON instead of table")
    args = parser.parse_args()

    client = get_client()

    sources = (
        client.table("network_sources")
        .select("id, slug, name, feed_url, is_active, last_fetched_at, fetch_error")
        .eq("is_active", True)
        .order("name")
        .execute()
        .data
        or []
    )

    # One query for latest published_at per source.
    latest_by_source: dict[int, str] = {}
    for src in sources:
        r = (
            client.table("network_posts")
            .select("published_at")
            .eq("source_id", src["id"])
            .order("published_at", desc=True)
            .limit(1)
            .execute()
        )
        if r.data:
            latest_by_source[src["id"]] = r.data[0].get("published_at")

    now = datetime.now(timezone.utc)
    rows = []
    for src in sources:
        latest = latest_by_source.get(src["id"])
        age_days: float | None = None
        if latest:
            try:
                dt = datetime.fromisoformat(latest.replace("Z", "+00:00"))
                age_days = (now - dt).total_seconds() / 86400
            except Exception:
                pass
        status = status_for_age(age_days)
        rows.append({
            "id": src["id"],
            "slug": src["slug"],
            "name": src["name"],
            "feed_url": src["feed_url"],
            "last_published_at": latest,
            "age_days": round(age_days, 1) if age_days is not None else None,
            "status": status,
            "fetch_error": src.get("fetch_error"),
        })

    rows.sort(key=lambda r: (
        {"DEAD": 0, "BROKEN": 1, "NEVER": 2, "WARN": 3, "OK": 4}[r["status"]],
        -(r["age_days"] or 0),
    ))

    if args.json:
        print(json.dumps(rows, indent=2))
    else:
        summary = {"OK": 0, "WARN": 0, "BROKEN": 0, "DEAD": 0, "NEVER": 0}
        for r in rows:
            summary[r["status"]] += 1

        print(f"\nNetwork source health — {len(rows)} active sources\n")
        print(f"  {color('DEAD')}DEAD{RESET}: {summary['DEAD']}   "
              f"{color('BROKEN')}BROKEN{RESET}: {summary['BROKEN']}   "
              f"{color('NEVER')}NEVER{RESET}: {summary['NEVER']}   "
              f"{color('WARN')}WARN{RESET}: {summary['WARN']}   "
              f"{color('OK')}OK{RESET}: {summary['OK']}\n")
        print(f"  {'STATUS':8s}  {'AGE':>8s}  {'NAME':35s}  {'SLUG':30s}  LAST PUBLISHED")
        print(f"  {'-' * 8}  {'-' * 8}  {'-' * 35}  {'-' * 30}  {'-' * 20}")
        for r in rows:
            if r["status"] == "OK":
                continue
            age = f"{r['age_days']:.0f}d" if r["age_days"] is not None else "never"
            last = (r["last_published_at"] or "")[:10] or "never"
            print(
                f"  {color(r['status'])}{r['status']:8s}{RESET}  "
                f"{age:>8s}  {r['name'][:35]:35s}  {r['slug'][:30]:30s}  {last}"
            )

    if args.write_errors:
        wrote = 0
        for r in rows:
            if r["status"] in ("OK",):
                continue
            msg = {
                "DEAD": f"No posts in {DEAD_DAYS}+ days (last: {r['last_published_at']})",
                "BROKEN": f"No posts in {BROKEN_DAYS}+ days (last: {r['last_published_at']})",
                "WARN": f"No posts in {WARN_DAYS}+ days (last: {r['last_published_at']})",
                "NEVER": "No posts ever ingested from this source",
            }[r["status"]]
            client.table("network_sources").update({"fetch_error": msg}).eq("id", r["id"]).execute()
            wrote += 1
        print(f"\nWrote fetch_error to {wrote} non-OK sources.")


if __name__ == "__main__":
    main()
