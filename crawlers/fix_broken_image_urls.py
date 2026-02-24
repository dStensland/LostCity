#!/usr/bin/env python3
"""
Fix broken event image URLs in the database.

Applies the following fixes:
1. Empty strings -> NULL
2. Protocol-relative URLs -> HTTPS
3. /_next/image paths -> extract real URL from query param
4. Data URIs -> NULL
5. JSON-LD blob (id 63546) -> NULL
6. Bare relative path (id 21769) -> NULL
7. Google Maps static images -> NULL
"""

import sys
from urllib.parse import urlparse, parse_qs, unquote

# Ensure crawlers dir is on sys.path so imports work
sys.path.insert(0, __file__.rsplit("/", 1)[0])

from db import get_client


def fix_empty_strings(client) -> int:
    """Fix 1: Empty string image_url -> NULL."""
    result = (
        client.table("events")
        .select("id")
        .eq("image_url", "")
        .execute()
    )
    ids = [r["id"] for r in result.data]
    if not ids:
        return 0
    for eid in ids:
        client.table("events").update({"image_url": None}).eq("id", eid).execute()
    return len(ids)


def fix_protocol_relative(client) -> int:
    """Fix 2: Protocol-relative URLs (//...) -> https://..."""
    result = (
        client.table("events")
        .select("id, image_url")
        .like("image_url", "//%")
        .execute()
    )
    rows = result.data
    if not rows:
        return 0
    for row in rows:
        new_url = "https:" + row["image_url"]
        client.table("events").update({"image_url": new_url}).eq("id", row["id"]).execute()
    return len(rows)


def fix_next_image_paths(client) -> int:
    """Fix 3: /_next/image?url=... -> extract and decode the real URL."""
    result = (
        client.table("events")
        .select("id, image_url")
        .like("image_url", "/_next/image%")
        .execute()
    )
    rows = result.data
    if not rows:
        return 0
    count = 0
    for row in rows:
        url = row["image_url"]
        # Parse the query string from the path
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        real_url = params.get("url", [None])[0]
        if real_url:
            decoded_url = unquote(real_url)
            client.table("events").update({"image_url": decoded_url}).eq("id", row["id"]).execute()
            count += 1
            print(f"  Event {row['id']}: {url[:80]}... -> {decoded_url[:80]}")
        else:
            # No url param found, null it out
            client.table("events").update({"image_url": None}).eq("id", row["id"]).execute()
            count += 1
            print(f"  Event {row['id']}: No url param found, set to NULL")
    return count


def fix_data_uris(client) -> int:
    """Fix 4: Data URIs -> NULL."""
    result = (
        client.table("events")
        .select("id")
        .like("image_url", "data:%")
        .execute()
    )
    ids = [r["id"] for r in result.data]
    if not ids:
        return 0
    for eid in ids:
        client.table("events").update({"image_url": None}).eq("id", eid).execute()
    return len(ids)


def fix_json_blob(client) -> int:
    """Fix 5: JSON-LD blob on event 63546 -> NULL."""
    result = (
        client.table("events")
        .select("id, image_url")
        .eq("id", 63546)
        .execute()
    )
    if not result.data:
        return 0
    row = result.data[0]
    if row["image_url"] and row["image_url"].startswith("{"):
        client.table("events").update({"image_url": None}).eq("id", 63546).execute()
        return 1
    return 0


def fix_bare_relative_path(client) -> int:
    """Fix 6: Bare relative path on event 21769 -> NULL."""
    result = (
        client.table("events")
        .select("id, image_url")
        .eq("id", 21769)
        .execute()
    )
    if not result.data:
        return 0
    row = result.data[0]
    if row["image_url"] and not row["image_url"].startswith("http"):
        client.table("events").update({"image_url": None}).eq("id", 21769).execute()
        return 1
    return 0


def fix_google_maps_static(client) -> int:
    """Fix 7: Google Maps static map images -> NULL."""
    result = (
        client.table("events")
        .select("id")
        .like("image_url", "%maps.google.com/maps/api/staticmap%")
        .execute()
    )
    ids = [r["id"] for r in result.data]
    if not ids:
        return 0
    for eid in ids:
        client.table("events").update({"image_url": None}).eq("id", eid).execute()
    return len(ids)


def main():
    print("Connecting to Supabase...")
    client = get_client()
    print("Connected.\n")

    fixes = [
        ("1. Empty strings -> NULL", fix_empty_strings),
        ("2. Protocol-relative URLs -> HTTPS", fix_protocol_relative),
        ("3. /_next/image paths -> extract real URL", fix_next_image_paths),
        ("4. Data URIs -> NULL", fix_data_uris),
        ("5. JSON-LD blob (id 63546) -> NULL", fix_json_blob),
        ("6. Bare relative path (id 21769) -> NULL", fix_bare_relative_path),
        ("7. Google Maps static images -> NULL", fix_google_maps_static),
    ]

    results = {}
    total = 0

    for label, fix_fn in fixes:
        print(f"Applying: {label}")
        count = fix_fn(client)
        results[label] = count
        total += count
        print(f"  -> {count} rows affected\n")

    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for label, count in results.items():
        print(f"  {label}: {count} rows")
    print(f"\n  TOTAL: {total} rows fixed")
    print("=" * 60)


if __name__ == "__main__":
    main()
