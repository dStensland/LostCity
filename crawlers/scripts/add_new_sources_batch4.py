#!/usr/bin/env python3
"""Add new crawlers batch 4 to sources table."""

from db import get_client

NEW_SOURCES = [
    # Haunted Attractions
    {
        "name": "Paranoia Haunted House",
        "slug": "paranoia-haunted",
        "url": "https://www.paranoiaquestrooms.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Nightmare's Gate",
        "slug": "nightmares-gate",
        "url": "https://www.nightmaresgate.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Art Events
    {
        "name": "Atlanta Art Fair",
        "slug": "atlanta-art-fair",
        "url": "https://www.atlantaartfair.com",
        "source_type": "organization",
        "is_active": True,
    },
    {
        "name": "Forward Warrior",
        "slug": "forward-warrior",
        "url": "https://www.forwardwarrior.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Gaming Expo
    {
        "name": "Southern-Fried Gaming Expo",
        "slug": "southern-fried-gaming",
        "url": "https://www.southernfriedgamingexpo.com",
        "source_type": "organization",
        "is_active": True,
    },
    # Yoga
    {
        "name": "Evolation Yoga",
        "slug": "evolation-yoga",
        "url": "https://www.evolationyoga.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Cooking Classes
    {
        "name": "Williams Sonoma - Lenox",
        "slug": "williams-sonoma",
        "url": "https://www.williams-sonoma.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Coworking
    {
        "name": "WeWork Atlanta",
        "slug": "wework-atlanta",
        "url": "https://www.wework.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Industrious Atlanta",
        "slug": "industrious-atlanta",
        "url": "https://www.industriousoffice.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Community Centers
    {
        "name": "Decatur Recreation Center",
        "slug": "decatur-recreation",
        "url": "https://www.decaturga.com/recreation",
        "source_type": "venue",
        "is_active": True,
    },
    # Sports Bar Networks
    {
        "name": "Atlanta United Pub Partners",
        "slug": "atlutd-pubs",
        "url": "https://www.atlutd.com/fans/pub-partners",
        "source_type": "organization",
        "is_active": True,
    },
    {
        "name": "Atlanta Hawks Bar Network",
        "slug": "hawks-bars",
        "url": "https://www.nba.com/hawks",
        "source_type": "organization",
        "is_active": True,
    },
]


def main():
    client = get_client()
    added = 0
    skipped = 0

    for source in NEW_SOURCES:
        # Check if exists
        existing = (
            client.table("sources")
            .select("id")
            .eq("slug", source["slug"])
            .execute()
        )

        if existing.data:
            print(f"Skipping (exists): {source['slug']}")
            skipped += 1
            continue

        # Insert
        result = client.table("sources").insert(source).execute()
        if result.data:
            print(f"Added: {source['name']} ({source['slug']})")
            added += 1
        else:
            print(f"Failed: {source['slug']}")

    print(f"\nDone: {added} added, {skipped} skipped")


if __name__ == "__main__":
    main()
