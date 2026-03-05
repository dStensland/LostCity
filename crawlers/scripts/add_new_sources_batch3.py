#!/usr/bin/env python3
"""Add new crawlers batch 3 to sources table."""

from db import get_client

NEW_SOURCES = [
    # Additional Haunted Attractions
    {
        "name": "13 Stories Haunted House",
        "slug": "13-stories",
        "url": "https://www.13stories.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Folklore Haunted House",
        "slug": "folklore-haunted",
        "url": "https://www.folklorehh.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Additional Yoga & Wellness
    {
        "name": "Yonder Yoga",
        "slug": "yonder-yoga",
        "url": "https://www.yonderyoga.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Dancing Dogs Yoga",
        "slug": "dancing-dogs-yoga",
        "url": "https://www.dancingdogsyoga.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Vista Yoga",
        "slug": "vista-yoga",
        "url": "https://www.vistayogaatl.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Cooking Schools
    {
        "name": "Sur La Table - Lenox",
        "slug": "sur-la-table",
        "url": "https://www.surlatable.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Publix Aprons Cooking School",
        "slug": "publix-aprons",
        "url": "https://www.publix.com/aprons",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "The Cooking School at Irwin Street",
        "slug": "irwin-street-cooking",
        "url": "https://www.irwinstreet.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Additional Eatertainment
    {
        "name": "The Painted Duck",
        "slug": "painted-duck",
        "url": "https://www.thepaintedduck.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Punch Bowl Social",
        "slug": "punch-bowl-social",
        "url": "https://www.punchbowlsocial.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Fowling Warehouse Atlanta",
        "slug": "fowling-warehouse",
        "url": "https://www.fowlingwarehouse.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Coworking & Community
    {
        "name": "Switchyards",
        "slug": "switchyards",
        "url": "https://www.switchyards.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Piedmont Park Conservancy",
        "slug": "piedmont-park",
        "url": "https://www.piedmontpark.org",
        "source_type": "venue",
        "is_active": True,
    },
    # Additional Record Stores
    {
        "name": "Moods Music",
        "slug": "moods-music",
        "url": "https://www.moodsmusic.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Additional Gaming
    {
        "name": "Activate Games Atlanta",
        "slug": "activate-games",
        "url": "https://www.playactivate.com",
        "source_type": "venue",
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
