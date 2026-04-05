#!/usr/bin/env python3
"""
Repair event image quality by replacing broken/missing images with safe fallbacks.

Priority order per event:
1) Keep current event image if valid and reachable
2) Use venue.image_url if valid and reachable
3) Use source/detail page og:image/twitter:image/main image if valid and reachable
4) If current image is broken and no fallback found, clear event.image_url to NULL

This ensures we do not serve obviously broken image URLs while preserving best
available imagery.

Usage:
  python3 scripts/repair_event_images.py --dry-run
  python3 scripts/repair_event_images.py --apply
  python3 scripts/repair_event_images.py --apply --from-date 2026-01-01
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLERS_ROOT = os.path.dirname(SCRIPT_DIR)
if CRAWLERS_ROOT not in sys.path:
    sys.path.insert(0, CRAWLERS_ROOT)

from db import get_client
from utils import is_likely_non_event_image


# Extra non-event patterns seen in audits.
_EXTRA_SKIP_RE = re.compile(
    r"(maps\.google|maps\.googleapis|streetview|staticmap|gravatar|avatar|favicon|logo)",
    re.IGNORECASE,
)


def normalize_url(url: Optional[str]) -> Optional[str]:
    """Normalize image URL; return None when clearly invalid."""
    if not url:
        return None
    value = str(url).strip()
    if not value:
        return None

    if value.startswith("//"):
        value = "https:" + value

    if " " in value:
        return None

    if not value.startswith(("http://", "https://")):
        return None

    lowered = value.lower()
    if lowered.startswith("data:"):
        return None

    return value


def is_bad_image_pattern(url: Optional[str]) -> bool:
    """Heuristic for low-quality/non-event image URLs."""
    if not url:
        return True
    lowered = url.lower().strip()
    if not lowered:
        return True

    if _EXTRA_SKIP_RE.search(lowered):
        return True

    return is_likely_non_event_image(url)


def fetch_all_events(from_date: Optional[str]) -> list[dict]:
    """Load all events in scope with image-repair fields."""
    client = get_client()
    rows: list[dict] = []
    page_size = 1000
    offset = 0

    while True:
        query = (
            client.table("events")
            .select("id,title,start_date,place_id,image_url,source_url")
            .order("id")
            .range(offset, offset + page_size - 1)
        )
        if from_date:
            query = query.gte("start_date", from_date)

        chunk = query.execute().data or []
        if not chunk:
            break

        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size

    return rows


def fetch_venue_images(venue_ids: set[int]) -> dict[int, str]:
    """Load venue image URLs for known venue IDs."""
    if not venue_ids:
        return {}

    client = get_client()
    result: dict[int, str] = {}
    ids = sorted(venue_ids)
    batch = 200

    for i in range(0, len(ids), batch):
        chunk_ids = ids[i : i + batch]
        rows = (
            client.table("places")
            .select("id,image_url")
            .in_("id", chunk_ids)
            .execute()
            .data
            or []
        )
        for row in rows:
            vid = row.get("id")
            img = normalize_url(row.get("image_url"))
            if vid and img:
                result[int(vid)] = img

    return result


def check_url_ok(session: requests.Session, url: str, timeout: int) -> bool:
    """URL reachability check using HEAD then GET fallback."""
    try:
        resp = session.head(url, timeout=timeout, allow_redirects=True)
        if 200 <= resp.status_code < 300:
            return True
        # Some CDNs block HEAD; retry with GET.
        if resp.status_code in (401, 403, 405):
            get_resp = session.get(
                url,
                timeout=timeout,
                allow_redirects=True,
                stream=True,
                headers={"Range": "bytes=0-0"},
            )
            ok = 200 <= get_resp.status_code < 300
            get_resp.close()
            return ok
        # Don't treat throttling as definitely broken.
        if resp.status_code == 429:
            return True
        return False
    except requests.exceptions.Timeout:
        return False
    except requests.exceptions.RequestException:
        return False


def check_urls_parallel(urls: set[str], timeout: int, workers: int) -> dict[str, bool]:
    """Parallel reachability check for unique URLs."""
    if not urls:
        return {}

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0 Safari/537.36 LostCity-ImageRepair/1.0"
            )
        }
    )

    result: dict[str, bool] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(check_url_ok, session, url, timeout): url for url in urls}
        for future in as_completed(futures):
            url = futures[future]
            try:
                result[url] = bool(future.result())
            except Exception:
                result[url] = False

    return result


def extract_page_image(session: requests.Session, source_url: Optional[str]) -> Optional[str]:
    """Extract a candidate image URL from source/detail page metadata."""
    normalized_source = normalize_url(source_url)
    if not normalized_source:
        return None

    try:
        resp = session.get(normalized_source, timeout=12, allow_redirects=True)
        if not resp.ok or not resp.text:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        for selector, attr in (
            ('meta[property="og:image"]', "content"),
            ('meta[name="twitter:image"]', "content"),
        ):
            tag = soup.select_one(selector)
            if tag:
                candidate = normalize_url(tag.get(attr))
                if candidate:
                    return candidate

        img = soup.select_one("article img, main img, .event img, img")
        if img:
            raw = (img.get("src") or img.get("data-src") or "").strip()
            if raw:
                candidate = normalize_url(urljoin(resp.url, raw))
                if candidate:
                    return candidate
    except requests.exceptions.RequestException:
        return None

    return None


def apply_updates(updates: list[tuple[int, Optional[str]]]) -> None:
    """Write per-event image updates."""
    if not updates:
        return

    client = get_client()
    for event_id, image_url in updates:
        client.table("events").update({"image_url": image_url}).eq("id", event_id).execute()


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair event images using venue/source fallbacks")
    parser.add_argument("--apply", action="store_true", help="Persist updates")
    parser.add_argument("--dry-run", action="store_true", help="Preview only (default)")
    parser.add_argument(
        "--from-date",
        default=None,
        help="Optional YYYY-MM-DD lower bound on events.start_date",
    )
    parser.add_argument("--timeout", type=int, default=10, help="HTTP timeout seconds")
    parser.add_argument("--workers", type=int, default=24, help="Parallel URL-check workers")
    parser.add_argument(
        "--use-source-fallback",
        action="store_true",
        help="Also fetch source/detail pages for og:image fallback (slower)",
    )
    parser.add_argument(
        "--report",
        default="",
        help="Optional explicit report path (JSON). Defaults to reports/repair_event_images_YYYY-MM-DD.json",
    )
    args = parser.parse_args()

    apply = bool(args.apply and not args.dry_run)
    if not args.apply:
        apply = False

    events = fetch_all_events(args.from_date)
    if not events:
        print("No events found in selected scope.")
        return 0

    venue_ids = {int(e["venue_id"]) for e in events if e.get("place_id")}
    venue_images = fetch_venue_images(venue_ids)

    # Build URL pools that need reachability checks.
    current_urls: set[str] = set()
    venue_urls: set[str] = set()

    for event in events:
        current = normalize_url(event.get("image_url"))
        if current and not is_bad_image_pattern(current):
            current_urls.add(current)

        venue_id = event.get("place_id")
        if venue_id:
            venue_img = venue_images.get(int(venue_id))
            if venue_img and not is_bad_image_pattern(venue_img):
                venue_urls.add(venue_img)

    print(f"Events scanned: {len(events)}")
    print(f"Unique current image URLs to check: {len(current_urls)}")
    print(f"Unique venue fallback URLs to check: {len(venue_urls)}")

    current_status = check_urls_parallel(current_urls, timeout=args.timeout, workers=args.workers)
    venue_status = check_urls_parallel(venue_urls, timeout=args.timeout, workers=args.workers)

    page_session = requests.Session()
    page_session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0 Safari/537.36 LostCity-ImageRepair/1.0"
            )
        }
    )

    page_image_cache: dict[str, Optional[str]] = {}
    page_image_status: dict[str, bool] = {}

    stats = Counter()
    updates: list[tuple[int, Optional[str]]] = []

    for event in events:
        stats["events_total"] += 1

        event_id = int(event["id"])
        raw_current = str(event.get("image_url") or "").strip()
        has_raw_current = bool(raw_current)
        current = normalize_url(event.get("image_url"))
        current_bad_pattern = is_bad_image_pattern(current)
        current_ok = bool(current and not current_bad_pattern and current_status.get(current, False))

        if current_ok:
            stats["kept_current_good"] += 1
            continue

        replacement: Optional[str] = None

        # Venue fallback first.
        venue_id = event.get("place_id")
        if venue_id:
            venue_img = venue_images.get(int(venue_id))
            if venue_img and not is_bad_image_pattern(venue_img) and venue_status.get(venue_img, False):
                replacement = venue_img
                stats["repair_from_venue"] += 1

        # Optional source page fallback (disabled by default for speed).
        if args.use_source_fallback and not replacement:
            source_url = normalize_url(event.get("source_url"))
            if source_url:
                if source_url not in page_image_cache:
                    page_image_cache[source_url] = extract_page_image(page_session, source_url)
                page_img = page_image_cache[source_url]

                if page_img and not is_bad_image_pattern(page_img):
                    if page_img not in page_image_status:
                        page_image_status[page_img] = check_url_ok(page_session, page_img, timeout=args.timeout)
                    if page_image_status[page_img]:
                        replacement = page_img
                        stats["repair_from_source_page"] += 1

        # Decide update action.
        if replacement:
            if replacement != current:
                updates.append((event_id, replacement))
                stats["events_updated"] += 1
            else:
                # Current was bad/unchecked but resolved to same URL; treat as unresolved safety.
                stats["unresolved"] += 1
        else:
            if has_raw_current:
                # Broken/invalid current image with no fallback -> clear it.
                updates.append((event_id, None))
                stats["cleared_broken"] += 1
                stats["events_updated"] += 1
            else:
                stats["unresolved"] += 1

    if apply:
        apply_updates(updates)

    report = {
        "mode": "apply" if apply else "dry_run",
        "from_date": args.from_date,
        "events_scanned": stats["events_total"],
        "kept_current_good": stats["kept_current_good"],
        "repair_from_venue": stats["repair_from_venue"],
        "repair_from_source_page": stats["repair_from_source_page"],
        "cleared_broken": stats["cleared_broken"],
        "events_updated": stats["events_updated"],
        "unresolved": stats["unresolved"],
        "checked_current_url_count": len(current_urls),
        "checked_venue_url_count": len(venue_urls),
        "checked_source_image_count": len(page_image_status),
        "use_source_fallback": bool(args.use_source_fallback),
    }

    report_path = Path(args.report) if args.report else Path(CRAWLERS_ROOT) / "reports" / f"repair_event_images_{date.today().isoformat()}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("\nEvent image repair summary")
    for key in (
        "events_scanned",
        "kept_current_good",
        "repair_from_venue",
        "repair_from_source_page",
        "cleared_broken",
        "events_updated",
        "unresolved",
    ):
        print(f"- {key}: {report[key]}")

    print(f"- report: {report_path}")
    if not apply:
        print("Dry run only. Re-run with --apply to persist updates.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
