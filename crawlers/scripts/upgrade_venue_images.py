#!/usr/bin/env python3
"""
Upgrade venue images by replacing broken or low-quality logo/icon URLs.

Selection strategy:
1) Active venues whose image_url appears in global image audit failures.
2) Active venues whose image_url looks logo/icon-like (e.g. contains "logo", ".svg").
3) Optional: active venues missing image_url.

Replacement strategy (reuses existing image-repair logic):
1) Venue website OG/hero image
2) Google Places photo
3) Wikimedia fallback (for configured overrides)

Usage:
  python scripts/upgrade_venue_images.py --dry-run
  python scripts/upgrade_venue_images.py --city Atlanta --limit 80
  python scripts/upgrade_venue_images.py --include-missing --limit 120
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
GLOBAL_AUDIT_PATH = PROJECT_ROOT / "web" / "content" / "global_image_audit.json"
REPORT_DIR = ROOT / "reports"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from repair_bad_track_images import find_best_replacement, update_venue_image

LOW_QUALITY_PATTERN_RE = re.compile(
    r"(logo|icon|favicon|placeholder|spacer|pixel|sprite|thumbnail|avatar|\.svg(?:\?|$))",
    re.IGNORECASE,
)


def _load_broken_venue_failures(audit_path: Path) -> tuple[set[int], set[str]]:
    if not audit_path.exists():
        return set(), set()

    payload = json.loads(audit_path.read_text(encoding="utf-8"))
    rows = payload.get("failing_urls") or []
    ids: set[int] = set()
    urls: set[str] = set()
    for row in rows:
        url = (row.get("url") or "").strip()
        refs = row.get("references") or []
        saw_venue_image_ref = False
        for ref in refs:
            if ref.get("source_table") != "venues":
                continue
            if ref.get("source_column") != "image_url":
                continue
            saw_venue_image_ref = True
            try:
                ids.add(int(ref.get("record_id")))
            except (TypeError, ValueError):
                continue
        if saw_venue_image_ref and url:
            urls.add(url)
    return ids, urls


def _fetch_active_venues(city: str | None) -> list[dict[str, Any]]:
    client = get_client()
    query = client.table("venues").select(
        "id,name,slug,address,city,state,website,image_url,hero_image_url,active"
    ).eq("active", True)
    if city:
        query = query.eq("city", city)
    rows = query.execute().data or []
    return rows


def _target_venues(
    venues: list[dict[str, Any]],
    broken_urls: set[str],
    include_missing: bool,
) -> tuple[list[dict[str, Any]], dict[int, list[str]]]:
    reasons: dict[int, list[str]] = defaultdict(list)
    targets: list[dict[str, Any]] = []

    for venue in venues:
        vid = int(venue["id"])
        image_url = (venue.get("image_url") or "").strip()
        has_reason = False

        # Key off the current URL state, not historical venue IDs from a stale audit.
        if image_url and image_url in broken_urls:
            reasons[vid].append("broken_in_global_audit")
            has_reason = True

        if image_url and LOW_QUALITY_PATTERN_RE.search(image_url):
            reasons[vid].append("low_quality_pattern_image_url")
            has_reason = True

        if include_missing and not image_url:
            reasons[vid].append("missing_image_url")
            has_reason = True

        if has_reason:
            targets.append(venue)

    # Prioritize harder failures first.
    targets.sort(
        key=lambda v: (
            0 if "broken_in_global_audit" in reasons[int(v["id"])] else 1,
            0 if "low_quality_pattern_image_url" in reasons[int(v["id"])] else 1,
            v.get("name") or "",
        )
    )
    return targets, reasons


def _write_report(payload: dict[str, Any]) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out = REPORT_DIR / f"venue_image_upgrade_{ts}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return out


def run(city: str | None, limit: int, include_missing: bool, dry_run: bool) -> int:
    broken_ids, broken_urls = _load_broken_venue_failures(GLOBAL_AUDIT_PATH)
    venues = _fetch_active_venues(city)
    targets, reasons = _target_venues(venues, broken_urls, include_missing)

    if limit > 0:
        targets = targets[:limit]

    google_api_key = (os.environ.get("GOOGLE_PLACES_API_KEY") or "").strip()
    google_api_available = bool(google_api_key)

    print(f"City filter: {city or 'ALL'}")
    print(f"Active venues scanned: {len(venues)}")
    print(f"Broken venue IDs from global audit: {len(broken_ids)}")
    print(f"Broken venue image URLs from global audit: {len(broken_urls)}")
    print(f"Target venues: {len(targets)}")
    print(f"Google Places fallback: {'enabled' if google_api_available else 'disabled'}")
    print("")

    upgraded = 0
    unresolved = 0
    rows: list[dict[str, Any]] = []

    for idx, venue in enumerate(targets, start=1):
        vid = int(venue["id"])
        slug = venue.get("slug") or ""
        venue_reasons = reasons[vid]
        print(f"[{idx}/{len(targets)}] {venue.get('name')} ({slug}) -> {', '.join(venue_reasons)}")

        candidate, source, checked = find_best_replacement(venue, google_api_key)
        if candidate:
            update_venue_image(vid, candidate, dry_run=dry_run)
            upgraded += 1
            print(f"  UPGRADED via {source}: {candidate[:90]}...")
            rows.append(
                {
                    "venue_id": vid,
                    "slug": slug,
                    "name": venue.get("name"),
                    "status": "would_upgrade" if dry_run else "upgraded",
                    "reasons": venue_reasons,
                    "source": source,
                    "old_image_url": venue.get("image_url"),
                    "old_hero_image_url": venue.get("hero_image_url"),
                    "new_image_url": candidate,
                    "candidates_checked": checked,
                }
            )
        else:
            unresolved += 1
            print("  UNRESOLVED: no valid replacement candidate")
            rows.append(
                {
                    "venue_id": vid,
                    "slug": slug,
                    "name": venue.get("name"),
                    "status": "unresolved",
                    "reasons": venue_reasons,
                    "old_image_url": venue.get("image_url"),
                    "old_hero_image_url": venue.get("hero_image_url"),
                    "candidates_checked": checked,
                }
            )

        time.sleep(0.35)

    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "dry_run": dry_run,
        "params": {
            "city": city,
            "limit": limit,
            "include_missing": include_missing,
            "global_audit_path": str(GLOBAL_AUDIT_PATH),
        },
        "totals": {
            "venues_scanned": len(venues),
            "targets": len(targets),
            "upgraded": upgraded,
            "unresolved": unresolved,
        },
        "rows": rows,
    }
    report_path = _write_report(report)

    print("\nResults")
    print("-------")
    print(f"Upgraded:   {upgraded}")
    print(f"Unresolved: {unresolved}")
    print(f"Report:     {report_path}")
    return 0


def main() -> int:
    load_dotenv(PROJECT_ROOT / ".env", override=False)
    load_dotenv(PROJECT_ROOT / "crawlers" / ".env", override=False)
    load_dotenv(PROJECT_ROOT / "web" / ".env.local", override=False)

    parser = argparse.ArgumentParser(description="Upgrade venue images (quality + broken URL repair)")
    parser.add_argument("--city", type=str, default="Atlanta", help="City filter (use '' for all)")
    parser.add_argument("--limit", type=int, default=80, help="Max venues to process")
    parser.add_argument("--include-missing", action="store_true", help="Also target venues missing image_url")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no DB writes")
    args = parser.parse_args()

    city = args.city.strip() if args.city is not None else None
    if city == "":
        city = None
    return run(city=city, limit=args.limit, include_missing=args.include_missing, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
