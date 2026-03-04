#!/usr/bin/env python3
"""
Register + enrich Waiting Room and Commune for Atlanta.

Actions:
1) Upsert enriched venue metadata for canonical venue slugs.
2) Upsert active source records owned by Atlanta portal.
"""

from __future__ import annotations

from db import get_client, get_portal_id_by_slug


ATLANTA_PORTAL_SLUG = "atlanta"


VENUES = [
    {
        "slug": "the-waiting-room",
        "name": "The Waiting Room",
        "address": "674 Myrtle St NE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "neighborhood": "Midtown",
        "website": "https://www.justkeepwaitingroom.com/",
        "lat": 33.7728122,
        "lng": -84.3803674,
        "venue_type": "lounge",
        "spot_type": "lounge",
        "description": "Late-night Midtown cocktail lounge and event space with recurring DJ nights and parties.",
        "active": True,
    },
    {
        "slug": "commune",
        "name": "Commune",
        "address": "6 Olive St #113",
        "city": "Avondale Estates",
        "state": "GA",
        "zip": "30002",
        "neighborhood": "Avondale Estates",
        "website": "https://www.communeatl.com/",
        "lat": 33.7758847,
        "lng": -84.2737868,
        "venue_type": "lounge",
        "spot_type": "lounge",
        "description": "Avondale listening room and bar focused on DJ sets, live performances, and cultural programming.",
        "active": True,
    },
]


SOURCES = [
    {
        "slug": "the-waiting-room",
        "name": "The Waiting Room",
        "url": "https://www.justkeepwaitingroom.com/goings-on",
        "source_type": "venue",
        "integration_method": "llm_crawler",
        "crawl_frequency": "daily",
    },
    {
        "slug": "commune",
        "name": "Commune",
        "url": "https://www.communeatl.com/calendar",
        "source_type": "venue",
        "integration_method": "llm_crawler",
        "crawl_frequency": "daily",
    },
]


def upsert_venue(payload: dict) -> tuple[str, int | None]:
    client = get_client()

    existing = (
        client.table("venues")
        .select("id,slug")
        .eq("slug", payload["slug"])
        .limit(1)
        .execute()
    )

    if existing.data:
        venue_id = existing.data[0]["id"]
        client.table("venues").update(payload).eq("id", venue_id).execute()
        return "updated", venue_id

    inserted = client.table("venues").insert(payload).execute()
    venue_id = inserted.data[0]["id"] if inserted.data else None
    return "created", venue_id


def upsert_source(payload: dict, owner_portal_id: str) -> tuple[str, int | None]:
    client = get_client()

    existing = (
        client.table("sources")
        .select("id,slug")
        .eq("slug", payload["slug"])
        .limit(1)
        .execute()
    )

    source_payload = {
        **payload,
        "is_active": True,
        "owner_portal_id": owner_portal_id,
    }

    if existing.data:
        source_id = existing.data[0]["id"]
        client.table("sources").update(source_payload).eq("id", source_id).execute()
        return "updated", source_id

    inserted = client.table("sources").insert(source_payload).execute()
    source_id = inserted.data[0]["id"] if inserted.data else None
    return "created", source_id


def main() -> None:
    owner_portal_id = get_portal_id_by_slug(ATLANTA_PORTAL_SLUG)
    if not owner_portal_id:
        raise RuntimeError("Atlanta portal not found; cannot register sources.")

    venue_created = 0
    venue_updated = 0
    for venue in VENUES:
        action, venue_id = upsert_venue(venue)
        if action == "created":
            venue_created += 1
        else:
            venue_updated += 1
        print(f"venue {action}: {venue['slug']} (id={venue_id})")

    source_created = 0
    source_updated = 0
    for source in SOURCES:
        action, source_id = upsert_source(source, owner_portal_id)
        if action == "created":
            source_created += 1
        else:
            source_updated += 1
        print(f"source {action}: {source['slug']} (id={source_id})")

    print("")
    print(
        "done: "
        f"venues(created={venue_created}, updated={venue_updated}) "
        f"sources(created={source_created}, updated={source_updated})"
    )


if __name__ == "__main__":
    main()
