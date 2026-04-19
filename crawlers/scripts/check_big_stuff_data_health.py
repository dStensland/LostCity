#!/usr/bin/env python3
"""
Big Stuff data-health diagnostic.

Mirrors the Big Stuff see-all page loader (web/lib/city-pulse/loaders/load-big-stuff-page.ts)
and reports three health signals:

  1. hero_image_health — HEAD-checks every image_url on announced-2026 festivals and
     6-month-forward tentpoles. Anything non-2xx is flagged.
  2. tentpole_cluster_candidates — tentpoles whose titles share a tournament prefix
     (FIFA World Cup, SEC Championship, etc.) that should roll up under one festival.
  3. near_duplicate_pairs — pairs of tentpoles/festivals whose normalized titles
     collide (normalize = lowercase, strip non-alphanumerics).

Output: JSON to stdout (pretty-printed) or to --out <path>.
Read-only: never writes to the database.

Usage:
  python3 crawlers/scripts/check_big_stuff_data_health.py
  python3 crawlers/scripts/check_big_stuff_data_health.py --out reports/big_stuff_health.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLERS_ROOT = os.path.dirname(SCRIPT_DIR)
if CRAWLERS_ROOT not in sys.path:
    sys.path.insert(0, CRAWLERS_ROOT)

from db import configure_write_mode, get_client  # noqa: E402

HORIZON_MONTHS = 6
HEAD_TIMEOUT_SECONDS = 10

TOURNAMENT_PATTERNS = (
    ("fifa-world-cup-26", re.compile(r"\bfifa\b.*\bworld\s*cup\b", re.IGNORECASE)),
    ("sec-championship-2026", re.compile(r"\bsec\s+championship\b", re.IGNORECASE)),
    (
        "college-football-playoff",
        re.compile(r"\bcollege\s+football\s+playoff\b", re.IGNORECASE),
    ),
)


@dataclass
class ImageCheck:
    kind: str  # "festival" | "tentpole"
    id: str | int
    title: str
    source_id: int | None
    image_url: str | None
    status: int | None = None  # HTTP status, or None on connection error
    error: str | None = None


@dataclass
class ClusterBucket:
    cluster_key: str
    pattern: str
    rows: list[dict[str, Any]] = field(default_factory=list)


def _add_months_iso(d: date, months: int) -> date:
    """Add N months to a date, clamping to end-of-month."""
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    day = min(d.day, 28)  # safe clamp — diagnostic only, exact day doesn't matter
    return date(y, m, day)


def _head_check(session: requests.Session, url: str) -> tuple[int | None, str | None]:
    try:
        resp = session.head(url, timeout=HEAD_TIMEOUT_SECONDS, allow_redirects=True)
        if resp.status_code == 405:
            # Some servers reject HEAD — fall back to a tiny ranged GET.
            resp = session.get(
                url,
                timeout=HEAD_TIMEOUT_SECONDS,
                allow_redirects=True,
                headers={"Range": "bytes=0-0"},
            )
        return resp.status_code, None
    except requests.RequestException as exc:
        return None, str(exc)[:200]


def _normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (title or "").lower())


def _fetch_festivals(client: Any, today: str, horizon: str) -> list[dict[str, Any]]:
    rows = (
        client.table("festivals")
        .select("id,name,announced_start,announced_end,image_url,portal_id")
        .eq("announced_2026", True)
        .lte("announced_start", horizon)
        .execute()
        .data
        or []
    )
    # Mirror loader: announced_start > today OR in-progress (start <= today <= end).
    out = []
    for r in rows:
        start = str(r.get("announced_start") or "")[:10]
        end = str(r.get("announced_end") or start)[:10]
        if start > today or (start <= today <= end):
            out.append(r)
    return out


def _fetch_tentpoles(client: Any, today: str, horizon: str) -> list[dict[str, Any]]:
    rows = (
        client.table("events")
        .select(
            "id,title,start_date,end_date,source_id,image_url,category_id,is_tentpole,festival_id,canonical_event_id,is_active"
        )
        .eq("is_tentpole", True)
        .eq("is_active", True)
        .is_("festival_id", "null")
        .is_("canonical_event_id", "null")
        .lte("start_date", horizon)
        .execute()
        .data
        or []
    )
    out = []
    for r in rows:
        start = str(r.get("start_date") or "")[:10]
        end = str(r.get("end_date") or start)[:10]
        if start > today or (start <= today <= end):
            out.append(r)
    return out


def _check_images(
    session: requests.Session,
    festivals: list[dict[str, Any]],
    tentpoles: list[dict[str, Any]],
) -> list[ImageCheck]:
    results: list[ImageCheck] = []

    for f in festivals:
        url = (f.get("image_url") or "").strip() or None
        check = ImageCheck(
            kind="festival",
            id=str(f.get("id")),
            title=str(f.get("name") or ""),
            source_id=None,
            image_url=url,
        )
        if url:
            check.status, check.error = _head_check(session, url)
        results.append(check)

    for e in tentpoles:
        url = (e.get("image_url") or "").strip() or None
        check = ImageCheck(
            kind="tentpole",
            id=int(e.get("id")) if e.get("id") is not None else 0,
            title=str(e.get("title") or ""),
            source_id=(int(e["source_id"]) if e.get("source_id") is not None else None),
            image_url=url,
        )
        if url:
            check.status, check.error = _head_check(session, url)
        results.append(check)

    return results


def _cluster_tentpoles(tentpoles: list[dict[str, Any]]) -> list[ClusterBucket]:
    buckets: dict[str, ClusterBucket] = {}
    for cluster_key, pattern in TOURNAMENT_PATTERNS:
        buckets[cluster_key] = ClusterBucket(
            cluster_key=cluster_key, pattern=pattern.pattern
        )

    for e in tentpoles:
        title = str(e.get("title") or "")
        for cluster_key, pattern in TOURNAMENT_PATTERNS:
            if pattern.search(title):
                buckets[cluster_key].rows.append(
                    {
                        "id": int(e.get("id")) if e.get("id") is not None else None,
                        "title": title,
                        "start_date": str(e.get("start_date") or "")[:10],
                        "source_id": (
                            int(e["source_id"])
                            if e.get("source_id") is not None
                            else None
                        ),
                    }
                )
                break

    # Only report buckets with 2+ rows — a single-match "cluster" isn't a dedup problem.
    return [b for b in buckets.values() if len(b.rows) >= 2]


def _near_duplicates(
    festivals: list[dict[str, Any]], tentpoles: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    by_norm: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for f in festivals:
        norm = _normalize_title(str(f.get("name") or ""))
        if not norm:
            continue
        by_norm[norm].append(
            {"kind": "festival", "id": str(f.get("id")), "title": str(f.get("name"))}
        )
    for e in tentpoles:
        norm = _normalize_title(str(e.get("title") or ""))
        if not norm:
            continue
        by_norm[norm].append(
            {
                "kind": "tentpole",
                "id": int(e.get("id")) if e.get("id") is not None else None,
                "title": str(e.get("title")),
                "start_date": str(e.get("start_date") or "")[:10],
            }
        )

    pairs = []
    for norm, rows in by_norm.items():
        if len(rows) >= 2:
            pairs.append({"normalized_title": norm, "rows": rows})
    return pairs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=str,
        default=None,
        help="Write JSON report here (default: stdout).",
    )
    args = parser.parse_args()

    configure_write_mode(False, "diagnostic — check_big_stuff_data_health")
    client = get_client()

    today_d = date.today()
    today = today_d.isoformat()
    horizon = _add_months_iso(today_d, HORIZON_MONTHS).isoformat()

    festivals = _fetch_festivals(client, today, horizon)
    tentpoles = _fetch_tentpoles(client, today, horizon)

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }
    )
    image_checks = _check_images(session, festivals, tentpoles)
    broken = [
        c
        for c in image_checks
        if c.image_url and (c.status is None or not (200 <= c.status < 400))
    ]
    missing = [c for c in image_checks if not c.image_url]

    clusters = _cluster_tentpoles(tentpoles)
    dupes = _near_duplicates(festivals, tentpoles)

    report = {
        "generated_at": today,
        "window": {"today": today, "horizon": horizon, "months": HORIZON_MONTHS},
        "counts": {
            "festivals": len(festivals),
            "tentpoles": len(tentpoles),
            "images_checked": sum(1 for c in image_checks if c.image_url),
            "images_broken": len(broken),
            "images_missing": len(missing),
            "tournament_clusters": len(clusters),
            "near_duplicate_groups": len(dupes),
        },
        "hero_image_health": {
            "broken": [
                {
                    "kind": c.kind,
                    "id": c.id,
                    "title": c.title,
                    "source_id": c.source_id,
                    "image_url": c.image_url,
                    "status": c.status,
                    "error": c.error,
                }
                for c in broken
            ],
            "missing": [
                {
                    "kind": c.kind,
                    "id": c.id,
                    "title": c.title,
                    "source_id": c.source_id,
                }
                for c in missing
            ],
        },
        "tentpole_cluster_candidates": [
            {"cluster_key": b.cluster_key, "pattern": b.pattern, "rows": b.rows}
            for b in clusters
        ],
        "near_duplicate_pairs": dupes,
    }

    payload = json.dumps(report, indent=2, sort_keys=False)
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(payload + "\n")
        print(f"wrote {args.out} ({len(payload)} bytes)", file=sys.stderr)
    else:
        print(payload)

    # Exit nonzero if there's anything to fix, for CI-style usage.
    has_issues = bool(broken) or bool(clusters) or bool(dupes)
    return 1 if has_issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
