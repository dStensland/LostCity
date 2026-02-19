#!/usr/bin/env python3
"""
Fix exhibit data quality issues in the events table.

Fixes:
1. Events with exhibit signals but content_kind='event' -> 'exhibit'
2. Cookie banner text scraped as descriptions -> NULL
3. Cookie plugin images -> NULL
4. is_all_day=True with start_time (contradictory) -> resolved

Usage:
  python scripts/fix_exhibit_data.py              # Dry run (default)
  python scripts/fix_exhibit_data.py --apply      # Apply fixes
"""

from __future__ import annotations

import argparse
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLERS_ROOT = os.path.dirname(SCRIPT_DIR)
if CRAWLERS_ROOT not in sys.path:
    sys.path.insert(0, CRAWLERS_ROOT)

from db import get_client


EXHIBIT_SIGNAL_TAGS = {"exhibit", "exhibition", "museum", "gallery", "installation", "on-view", "on_view"}

EXHIBIT_TITLE_RE = re.compile(
    r"(exhibit|exhibition|on view|collection|installation|permanent)",
    re.IGNORECASE,
)

COOKIE_BANNER_PHRASES = [
    "we value your privacy",
    "cookie policy",
    "accept all cookies",
    "manage cookie preferences",
    "this website uses cookies",
    "by continuing to browse",
    "we use cookies",
]

COOKIE_IMAGE_PATTERNS = ["cookie-law", "cookie-cdn", "gdpr", "consent-", "privacy-mgmt"]


def fix_content_kind(client, apply: bool) -> int:
    """Fix events that should be content_kind='exhibit' but are 'event'."""
    print("\n=== Fix 1: content_kind misclassification ===")

    # Find events with exhibit signals but content_kind='event'
    resp = (
        client.table("events")
        .select("id, title, content_kind, tags, description")
        .eq("content_kind", "event")
        .execute()
    )

    candidates = []
    for row in resp.data:
        tags = set(row.get("tags") or [])
        title = row.get("title") or ""
        desc = row.get("description") or ""

        has_tag_signal = bool(tags & EXHIBIT_SIGNAL_TAGS)
        has_text_signal = bool(EXHIBIT_TITLE_RE.search(title) or EXHIBIT_TITLE_RE.search(desc))

        if has_tag_signal or has_text_signal:
            candidates.append(row)

    print(f"Found {len(candidates)} events with content_kind='event' but exhibit signals")
    for c in candidates[:20]:
        print(f"  - [{c['id']}] {c['title']}")

    if apply and candidates:
        ids = [c["id"] for c in candidates]
        for eid in ids:
            client.table("events").update({"content_kind": "exhibit"}).eq("id", eid).execute()
        print(f"  Updated {len(ids)} records")

    return len(candidates)


def fix_cookie_descriptions(client, apply: bool) -> int:
    """Fix events with cookie banner text as descriptions."""
    print("\n=== Fix 2: Cookie banner descriptions ===")

    bad = []
    for phrase in COOKIE_BANNER_PHRASES:
        resp = (
            client.table("events")
            .select("id, title, description")
            .ilike("description", f"%{phrase}%")
            .execute()
        )
        seen_ids = {b["id"] for b in bad}
        for row in resp.data:
            if row["id"] not in seen_ids:
                bad.append(row)

    print(f"Found {len(bad)} events with cookie banner descriptions")
    for b in bad:
        snippet = (b["description"] or "")[:80]
        print(f"  - [{b['id']}] {b['title']}: \"{snippet}...\"")

    if apply and bad:
        for row in bad:
            client.table("events").update({"description": None}).eq("id", row["id"]).execute()
        print(f"  Cleared {len(bad)} descriptions")

    return len(bad)


def fix_cookie_images(client, apply: bool) -> int:
    """Fix events with cookie plugin images."""
    print("\n=== Fix 3: Cookie plugin images ===")

    bad = []
    for pat in COOKIE_IMAGE_PATTERNS:
        resp = (
            client.table("events")
            .select("id, title, image_url")
            .ilike("image_url", f"%{pat}%")
            .execute()
        )
        seen_ids = {b["id"] for b in bad}
        for row in resp.data:
            if row["id"] not in seen_ids:
                bad.append(row)

    print(f"Found {len(bad)} events with cookie plugin images")
    for b in bad:
        print(f"  - [{b['id']}] {b['title']}: {b['image_url'][:80]}")

    if apply and bad:
        for row in bad:
            client.table("events").update({"image_url": None}).eq("id", row["id"]).execute()
        print(f"  Cleared {len(bad)} images")

    return len(bad)


def fix_all_day_contradictions(client, apply: bool) -> int:
    """Fix events where is_all_day=True but start_time is set."""
    print("\n=== Fix 4: is_all_day contradictions ===")

    # Supabase: filter for is_all_day=True, then filter in Python for non-null start_time
    resp = (
        client.table("events")
        .select("id, title, is_all_day, start_time, content_kind")
        .eq("is_all_day", True)
        .execute()
    )
    # Filter to only records where start_time is actually set
    resp.data = [r for r in resp.data if r.get("start_time") is not None]

    records = resp.data
    print(f"Found {len(records)} events with is_all_day=True AND start_time set")

    exhibits = [r for r in records if r.get("content_kind") == "exhibit"]
    non_exhibits = [r for r in records if r.get("content_kind") != "exhibit"]

    print(f"  - {len(exhibits)} exhibits: will keep is_all_day=True, clear start_time")
    print(f"  - {len(non_exhibits)} non-exhibits: will set is_all_day=False")

    for r in records[:20]:
        action = "clear start_time" if r.get("content_kind") == "exhibit" else "set is_all_day=False"
        print(f"  - [{r['id']}] {r['title']} ({r['content_kind']}) -> {action}")

    if apply:
        for r in exhibits:
            client.table("events").update({"start_time": None}).eq("id", r["id"]).execute()
        for r in non_exhibits:
            client.table("events").update({"is_all_day": False}).eq("id", r["id"]).execute()
        print(f"  Fixed {len(records)} records")

    return len(records)


def main():
    parser = argparse.ArgumentParser(description="Fix exhibit data quality issues")
    parser.add_argument("--apply", action="store_true", help="Apply fixes (default is dry run)")
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"=== Exhibit Data Cleanup ({mode}) ===")

    client = get_client()
    total = 0

    total += fix_content_kind(client, args.apply)
    total += fix_cookie_descriptions(client, args.apply)
    total += fix_cookie_images(client, args.apply)
    total += fix_all_day_contradictions(client, args.apply)

    print(f"\n=== Summary: {total} total issues found ===")
    if not args.apply:
        print("Run with --apply to fix these issues.")


if __name__ == "__main__":
    main()
