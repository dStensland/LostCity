"""Register and activate venue-features sources for The Tabernacle and Variety Playhouse."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client

PORTAL_SLUG = "atlanta"

SOURCES = (
    {
        "slug": "tabernacle-features",
        "name": "The Tabernacle — Venue Features",
        "url": "https://www.tabernacleatl.com",
        "source_type": "scrape",
        "crawl_frequency": "monthly",
        "integration_method": "html",
    },
    {
        "slug": "variety-playhouse-features",
        "name": "Variety Playhouse — Venue Features",
        "url": "https://www.variety-playhouse.com",
        "source_type": "scrape",
        "crawl_frequency": "monthly",
        "integration_method": "html",
    },
)

STALE_HEALTH_TAGS = {
    "zero-events-deactivated",
    "profile-hardened-zero-signal",
    "no-standalone-crawler",
}


def main() -> int:
    client = get_client()

    portal = (
        client.table("portals")
        .select("id")
        .eq("slug", PORTAL_SLUG)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not portal:
        raise RuntimeError(f"Portal not found: {PORTAL_SLUG}")
    portal_id = portal[0]["id"]

    for spec in SOURCES:
        existing_rows = (
            client.table("sources")
            .select("*")
            .eq("slug", spec["slug"])
            .limit(1)
            .execute()
            .data
            or []
        )

        if existing_rows:
            existing = existing_rows[0]
            health_tags = [
                tag
                for tag in (existing.get("health_tags") or [])
                if tag not in STALE_HEALTH_TAGS
            ]
            payload = {
                "name": spec["name"],
                "url": spec["url"],
                "source_type": spec["source_type"],
                "crawl_frequency": spec["crawl_frequency"],
                "integration_method": spec["integration_method"],
                "owner_portal_id": portal_id,
                "is_active": True,
                "health_tags": health_tags,
            }
            client.table("sources").update(payload).eq("id", existing["id"]).execute()
            source_id = existing["id"]
            print(f"Updated source: {spec['slug']} ({source_id})")
        else:
            payload = {
                "slug": spec["slug"],
                "name": spec["name"],
                "url": spec["url"],
                "source_type": spec["source_type"],
                "crawl_frequency": spec["crawl_frequency"],
                "integration_method": spec["integration_method"],
                "owner_portal_id": portal_id,
                "is_active": True,
                "is_sensitive": False,
                "rollup_behavior": "normal",
            }
            inserted = client.table("sources").insert(payload).execute().data or []
            if not inserted:
                raise RuntimeError(f"Failed to insert source: {spec['slug']}")
            source_id = inserted[0]["id"]
            print(f"Inserted source: {spec['slug']} ({source_id})")

        access_rows = (
            client.table("portal_source_access")
            .select("*")
            .eq("portal_id", portal_id)
            .eq("source_id", source_id)
            .execute()
            .data
            or []
        )
        if not access_rows:
            client.table("portal_source_access").insert(
                {
                    "portal_id": portal_id,
                    "source_id": source_id,
                    "source_name": spec["name"],
                    "accessible_categories": None,
                    "access_type": "owner",
                }
            ).execute()
            print(f"Granted portal access: {spec['slug']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
