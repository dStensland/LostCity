#!/usr/bin/env python3
"""
Register the eater-atlanta-guides source in the sources table.

Run once to activate the crawler:
    cd crawlers && python3 scripts/register_eater_atlanta_guides.py
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_portal_id_by_slug

ATLANTA_PORTAL_SLUG = "atlanta"

SOURCE = {
    "slug": "eater-atlanta-guides",
    "name": "Eater Atlanta Guides",
    "url": "https://atlanta.eater.com/maps",
    "source_type": "scrape",
    "integration_method": "custom",
    "crawl_frequency": "weekly",
    "is_active": True,
}


def main() -> None:
    owner_portal_id = get_portal_id_by_slug(ATLANTA_PORTAL_SLUG)
    if not owner_portal_id:
        raise RuntimeError("Atlanta portal not found; cannot register source.")

    client = get_client()
    existing = (
        client.table("sources")
        .select("id, slug")
        .eq("slug", SOURCE["slug"])
        .limit(1)
        .execute()
    )

    payload = {**SOURCE, "owner_portal_id": owner_portal_id}

    if existing.data:
        source_id = existing.data[0]["id"]
        client.table("sources").update(payload).eq("id", source_id).execute()
        print(f"updated: {SOURCE['slug']} (id={source_id})")
    else:
        result = client.table("sources").insert(payload).execute()
        source_id = result.data[0]["id"] if result.data else None
        print(f"created: {SOURCE['slug']} (id={source_id})")


if __name__ == "__main__":
    main()
