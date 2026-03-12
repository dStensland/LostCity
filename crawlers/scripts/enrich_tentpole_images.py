#!/usr/bin/env python3
"""
Task 3: Enrich missing images on tentpole events in the next 5 weeks.

Strategy per event:
  1. If a higher-quality non-tentpole duplicate has an image, copy it.
  2. If the tentpole's venue has an image and no better source exists, use that.
  3. If neither, scrape the event source_url for og:image.

Events targeted (canonical tentpole IDs):
  66827  ShamRock Fest (Mar 14)         — copy from dupe id=21032
  77113  Atlanta Streets Alive (Mar 22) — handled by Task 1 (skipped here)
  66789  Collect-A-Con Atlanta (Mar 14) — scrape collectaconusa.com
  66854  Atlanta Home Show (Mar 20)     — copy from dupe id=21705
  21986  Wing & Rock Fest (Mar 21)      — use venue image (Etowah River Park)
  77103  National Black Arts Festival (Apr 7) — scrape nbaf.org
  66861  Atlanta Pen Show (Mar 27)      — copy from dupe id=25235
  66834  221B Con (Apr 10)              — scrape 221bcon.com, fallback to venue

Usage:
  cd crawlers
  python scripts/enrich_tentpole_images.py          # dry-run (default)
  python scripts/enrich_tentpole_images.py --apply  # write to production
  python scripts/enrich_tentpole_images.py --apply --event-id 66827  # single event
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install requests beautifulsoup4")
    sys.exit(1)

from db import get_client

# ---------------------------------------------------------------------------
# Target event definitions
# ---------------------------------------------------------------------------
# Each entry: (tentpole_event_id, label, strategy, strategy_value)
#
# strategy = "copy_from_event": copy image_url from another event ID
# strategy = "use_venue_image":  use the venue's image_url
# strategy = "scrape_url":       fetch og:image from a URL
# strategy = "skip":             already handled elsewhere (Streets Alive → Task 1)
# ---------------------------------------------------------------------------
TARGETS = [
    # ShamRock Fest: Park Tavern-sourced dupe has the actual event poster
    (66827,  "ShamRock Fest",            "copy_from_event", 21032),
    # Streets Alive handled by Task 1 — skip here
    (77113,  "Atlanta Streets Alive",    "skip",            None),
    # Collect-A-Con: no dupe with image; scrape official site
    (66789,  "Collect-A-Con Atlanta",    "scrape_url",      "https://www.collectaconusa.com/atlanta"),
    # Atlanta Home Show: copy Google Places photo from dupe
    (66854,  "Atlanta Home Show",        "copy_from_event", 21705),
    # Wing & Rock Fest: venue (Etowah River Park) has a Google Places photo
    (21986,  "Wing & Rock Fest",         "use_venue_image", None),
    # NBAF: no dupe, scrape website
    (77103,  "National Black Arts Festival", "scrape_url",  "https://nbaf.org/"),
    # Atlanta Pen Show: official site image from dupe id=25235
    (66861,  "Atlanta Pen Show",         "copy_from_event", 25235),
    # 221B Con: scrape site, fallback to venue (Marriott)
    (66834,  "221B Con",                 "scrape_url",      "https://www.221bcon.com/"),
]

USER_AGENT = "LostCity/1.0 (https://lostcity.ai; events@lostcity.ai)"
REQUEST_TIMEOUT = 15


def normalize_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    value = str(url).strip()
    if value.startswith("//"):
        value = "https:" + value
    if not value.startswith(("http://", "https://")):
        return None
    if " " in value:
        return None
    return value


def scrape_og_image(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a page and extract og:image or twitter:image."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": USER_AGENT})
        if resp.status_code != 200:
            print(f"    HTTP {resp.status_code} for {url}")
            return None
        soup = BeautifulSoup(resp.text, "html.parser")

        # Try og:image first
        for prop in ("og:image", "twitter:image", "twitter:image:src"):
            tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
            if tag:
                content = tag.get("content") or tag.get("value")
                img = normalize_url(content)
                if img:
                    # Make absolute if relative
                    if not img.startswith("http"):
                        img = urljoin(url, img)
                    return img

        # Fallback: first <img> in the page hero/banner area
        for img_tag in soup.find_all("img", src=True):
            src = normalize_url(img_tag.get("src"))
            if src and src.startswith("http"):
                # Skip icons, logos, tracking pixels
                lower = src.lower()
                if any(skip in lower for skip in ("logo", "icon", "pixel", "tracking", "1x1")):
                    continue
                return urljoin(url, src)

        return None
    except Exception as exc:
        print(f"    Error scraping {url}: {exc}")
        return None


def resolve_image(
    event_id: int,
    label: str,
    strategy: str,
    strategy_value,
    client,
    session: requests.Session,
    dry_run: bool,
) -> tuple[Optional[str], str]:
    """
    Return (image_url, source_description) for the event, or (None, reason).
    """
    if strategy == "skip":
        return None, "SKIP — handled by another task"

    # Fetch current state of the target event
    ev_resp = client.table("events").select(
        "id, title, image_url, venue_id, venues(id, name, image_url)"
    ).eq("id", event_id).execute()
    ev_rows = ev_resp.data or []
    if not ev_rows:
        return None, f"ERROR: event id={event_id} not found"

    ev = ev_rows[0]
    if ev.get("image_url"):
        return None, "already has image — no action needed"

    venue = ev.get("venues") or {}

    if strategy == "copy_from_event":
        donor_id = strategy_value
        donor_resp = client.table("events").select("id, image_url").eq("id", donor_id).execute()
        donor_rows = donor_resp.data or []
        if not donor_rows or not donor_rows[0].get("image_url"):
            return None, f"WARN: donor event id={donor_id} has no image"
        img = normalize_url(donor_rows[0]["image_url"])
        return img, f"copied from event id={donor_id}"

    if strategy == "use_venue_image":
        img = normalize_url(venue.get("image_url"))
        if img:
            return img, f"venue image (venue id={venue.get('id')} {venue.get('name')!r})"
        return None, "venue has no image"

    if strategy == "scrape_url":
        url = strategy_value
        print(f"    Scraping {url} ...")
        img = scrape_og_image(url, session)
        if img:
            return img, f"og:image scraped from {url}"
        # Fallback to venue image
        venue_img = normalize_url(venue.get("image_url"))
        if venue_img:
            return venue_img, f"venue image fallback (scrape returned nothing from {url})"
        return None, f"no image found (scrape of {url} and venue both empty)"

    return None, f"unknown strategy {strategy!r}"


def main(apply: bool, only_event_id: Optional[int]) -> None:
    client = get_client()
    session = requests.Session()

    targets = TARGETS
    if only_event_id is not None:
        targets = [t for t in TARGETS if t[0] == only_event_id]
        if not targets:
            print(f"Event id={only_event_id} not in target list. Available IDs: {[t[0] for t in TARGETS]}")
            sys.exit(1)

    print(f"=== Tentpole Image Enrichment ({'DRY RUN' if not apply else 'LIVE'}) ===\n")

    results = []
    for event_id, label, strategy, strategy_value in targets:
        print(f"[{event_id}] {label}  strategy={strategy}")
        img, source_desc = resolve_image(
            event_id, label, strategy, strategy_value, client, session, dry_run=not apply
        )

        if img:
            print(f"  -> Image: {img[:100]}")
            print(f"     Source: {source_desc}")
        else:
            print(f"  -> {source_desc}")

        results.append({
            "event_id": event_id,
            "label": label,
            "image_url": img,
            "source_desc": source_desc,
        })
        time.sleep(0.5)  # polite crawl rate

    print("\n=== Summary ===")
    actionable = [r for r in results if r["image_url"]]
    skipped = [r for r in results if not r["image_url"]]

    print(f"  Events with image resolved: {len(actionable)}")
    for r in actionable:
        print(f"    id={r['event_id']}  {r['label']!r}  <- {r['source_desc']}")

    print(f"  Events with no image found: {len(skipped)}")
    for r in skipped:
        print(f"    id={r['event_id']}  {r['label']!r}  — {r['source_desc']}")

    if not apply:
        print("\n[DRY RUN] No changes written. Pass --apply to execute.")
        return

    # --- Apply ---
    print("\n=== Applying Updates ===")
    updated = 0
    for r in actionable:
        if not r["image_url"]:
            continue
        resp = (
            client.table("events")
            .update({"image_url": r["image_url"]})
            .eq("id", r["event_id"])
            .execute()
        )
        if resp.data:
            print(f"  [APPLIED] id={r['event_id']} {r['label']!r}")
            updated += 1
        else:
            print(f"  [ERROR] id={r['event_id']} update returned no data: {resp}")

    # --- Verify ---
    print("\n=== Verification ===")
    updated_ids = [r["event_id"] for r in actionable]
    if updated_ids:
        verify_resp = (
            client.table("events")
            .select("id, title, image_url")
            .in_("id", updated_ids)
            .execute()
        )
        all_ok = True
        for row in verify_resp.data or []:
            has_img = bool(row.get("image_url"))
            status = "OK  " if has_img else "FAIL"
            print(f"  [{status}] id={row['id']}  image={'YES' if has_img else 'NO'}  {row['title']}")
            if not has_img:
                all_ok = False
    else:
        all_ok = True  # nothing to verify

    if all_ok and updated == len(actionable):
        print(f"\n  Task 3 COMPLETE — {updated} event(s) updated.")
    else:
        print(f"\n  Task 3 INCOMPLETE — {updated}/{len(actionable)} updated. Check errors above.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich tentpole events with images")
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Write changes to production (default: dry-run)",
    )
    parser.add_argument(
        "--event-id",
        type=int,
        default=None,
        help="Only process a single event by ID (useful for targeted re-runs)",
    )
    args = parser.parse_args()
    main(apply=args.apply, only_event_id=args.event_id)
