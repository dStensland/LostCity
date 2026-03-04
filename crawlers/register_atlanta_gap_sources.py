#!/usr/bin/env python3
"""
Register Atlanta gap-source profiles in the sources table.

This script upserts source records for newly identified Atlanta coverage gaps
and binds them to the Atlanta portal owner.
"""

from __future__ import annotations

from db import get_client, get_portal_id_by_slug


ATLANTA_PORTAL_SLUG = "atlanta"


SOURCES = [
    {
        "slug": "the-works-atl",
        "name": "The Works ATL",
        "url": "https://theworksatl.com/events/",
        "source_type": "scrape",
        "integration_method": "llm_crawler",
        "crawl_frequency": "daily",
    },
    {
        "slug": "the-interlock",
        "name": "The Interlock",
        "url": "https://theinterlockatl.com/events/",
        "source_type": "scrape",
        "integration_method": "llm_crawler",
        "crawl_frequency": "daily",
    },
    {
        "slug": "colony-square",
        "name": "Colony Square",
        "url": "https://colonysquare.com/events/",
        "source_type": "scrape",
        "integration_method": "llm_crawler",
        "crawl_frequency": "daily",
    },
    {
        "slug": "westside-motor-lounge",
        "name": "Westside Motor Lounge",
        "url": "https://www.westsidemotorlounge.com/events",
        "source_type": "venue",
        "integration_method": "llm_crawler",
        "crawl_frequency": "daily",
    },
    {
        "slug": "chattahoochee-food-works",
        "name": "Chattahoochee Food Works",
        "url": "https://chattahoocheefoodworks.com/events/",
        "source_type": "venue",
        "integration_method": "llm_crawler",
        "crawl_frequency": "daily",
    },
    {
        "slug": "underground-atlanta",
        "name": "Underground Atlanta",
        "url": "https://www.undergroundatl.com/events",
        "source_type": "venue",
        "integration_method": "llm_crawler",
        "crawl_frequency": "daily",
    },
    {
        "slug": "sweet-georgias-juke-joint",
        "name": "Sweet Georgia's Juke Joint",
        "url": "https://www.sweetgeorgiasjukejoint.com/events",
        "source_type": "venue",
        "integration_method": "llm_crawler",
        "crawl_frequency": "weekly",
    },
    {
        "slug": "blue-martini-atlanta",
        "name": "Blue Martini Atlanta",
        "url": "http://bluemartini.com/",
        "source_type": "venue",
        "integration_method": "llm_crawler",
        "crawl_frequency": "weekly",
    },
    {
        "slug": "eclipse-di-luna",
        "name": "Eclipse di Luna",
        "url": "https://eclipsediluna.com/",
        "source_type": "venue",
        "integration_method": "llm_crawler",
        "crawl_frequency": "weekly",
    },
]


def upsert_source(source: dict, owner_portal_id: str) -> tuple[str, int | None]:
    client = get_client()
    existing = client.table("sources").select("id, slug").eq("slug", source["slug"]).limit(1).execute()

    payload = {
        "name": source["name"],
        "slug": source["slug"],
        "url": source["url"],
        "source_type": source["source_type"],
        "integration_method": source["integration_method"],
        "crawl_frequency": source["crawl_frequency"],
        "is_active": True,
        "owner_portal_id": owner_portal_id,
    }

    if existing.data:
        source_id = existing.data[0]["id"]
        client.table("sources").update(payload).eq("id", source_id).execute()
        return "updated", source_id

    result = client.table("sources").insert(payload).execute()
    source_id = result.data[0]["id"] if result.data else None
    return "created", source_id


def main() -> None:
    owner_portal_id = get_portal_id_by_slug(ATLANTA_PORTAL_SLUG)
    if not owner_portal_id:
        raise RuntimeError("Atlanta portal not found; cannot register gap sources.")

    created = 0
    updated = 0
    for source in SOURCES:
        action, source_id = upsert_source(source, owner_portal_id)
        if action == "created":
            created += 1
            print(f"created: {source['slug']} (id={source_id})")
        else:
            updated += 1
            print(f"updated: {source['slug']} (id={source_id})")

    print("")
    print(f"done: created={created} updated={updated} total={len(SOURCES)}")


if __name__ == "__main__":
    main()
