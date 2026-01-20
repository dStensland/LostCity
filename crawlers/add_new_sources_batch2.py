#!/usr/bin/env python3
"""Add new crawlers batch 2 to sources table."""

from db import get_client

NEW_SOURCES = [
    # LGBTQ+ Venues
    {
        "name": "Blake's on the Park",
        "slug": "blakes-on-park",
        "url": "https://www.blakesonthepark.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "The Heretic",
        "slug": "the-heretic",
        "url": "https://www.hereticatl.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "My Sister's Room",
        "slug": "my-sisters-room",
        "url": "https://www.mysistersroom.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Mary's Bar",
        "slug": "marys-bar",
        "url": "https://www.marysatlanta.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Atlanta Eagle",
        "slug": "atlanta-eagle",
        "url": "https://www.atlantaeagle.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Future Atlanta",
        "slug": "future-atlanta",
        "url": "https://www.futureatl.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Bulldogs Atlanta",
        "slug": "bulldogs-atlanta",
        "url": "https://www.bulldogsatl.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Lips Atlanta",
        "slug": "lips-atlanta",
        "url": "https://www.lipsatl.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Joystick Gamebar",
        "slug": "joystick-gamebar",
        "url": "https://www.joystickgamebar.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Southern Fried Queer Pride",
        "slug": "southern-fried-queer-pride",
        "url": "https://www.southernfriedqueerpride.com",
        "source_type": "organization",
        "is_active": True,
    },
    # Additional Nightclubs
    {
        "name": "Tongue & Groove",
        "slug": "tongue-and-groove",
        "url": "https://www.tongueandgroove.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Believe Music Hall",
        "slug": "believe-music-hall",
        "url": "https://www.believemusichall.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Gold Room",
        "slug": "gold-room",
        "url": "https://www.goldroomatlanta.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Domaine Atlanta",
        "slug": "domaine-atlanta",
        "url": "https://www.domaineatlanta.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "LYFE Atlanta",
        "slug": "lyfe-atlanta",
        "url": "https://www.lyfeatl.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "The Church",
        "slug": "church-atlanta",
        "url": "https://www.thechurchatl.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Additional Theaters
    {
        "name": "7 Stages",
        "slug": "seven-stages",
        "url": "https://www.7stages.org",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Theatrical Outfit",
        "slug": "theatrical-outfit",
        "url": "https://www.theatricaloutfit.org",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "True Colors Theatre",
        "slug": "true-colors-theatre",
        "url": "https://www.truecolorstheatre.org",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Synchronicity Theatre",
        "slug": "synchronicity-theatre",
        "url": "https://www.synchrotheatre.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Atlanta Lyric Theatre",
        "slug": "atlanta-lyric-theatre",
        "url": "https://www.atlantalyrictheatre.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Art Galleries
    {
        "name": "Whitespace Gallery",
        "slug": "whitespace-gallery",
        "url": "https://www.whitespace814.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "ABV Gallery",
        "slug": "abv-gallery",
        "url": "https://www.abvgallery.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Atlanta Contemporary",
        "slug": "atlanta-contemporary",
        "url": "https://www.atlantacontemporary.org",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "MOCA GA",
        "slug": "moca-ga",
        "url": "https://www.mocaga.org",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Zucot Gallery",
        "slug": "zucot-gallery",
        "url": "https://www.zucotgallery.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Gaming & Eatertainment
    {
        "name": "Battle & Brew",
        "slug": "battle-and-brew",
        "url": "https://www.battleandbrew.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Puttshack",
        "slug": "puttshack",
        "url": "https://www.puttshack.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "The Painted Pin",
        "slug": "painted-pin",
        "url": "https://www.thepaintedpin.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Haunted Attractions
    {
        "name": "Netherworld Haunted House",
        "slug": "netherworld",
        "url": "https://www.fearworld.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Record Stores
    {
        "name": "Criminal Records",
        "slug": "criminal-records",
        "url": "https://www.criminalatl.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "name": "Wax n Facts",
        "slug": "wax-n-facts",
        "url": "https://www.waxnfacts.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Yoga & Wellness
    {
        "name": "Highland Yoga",
        "slug": "highland-yoga",
        "url": "https://www.highland-yoga.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Sports Bars
    {
        "name": "Brewhouse Cafe",
        "slug": "brewhouse-cafe",
        "url": "https://www.brewhousecafe.com",
        "source_type": "venue",
        "is_active": True,
    },
    # Community Centers
    {
        "name": "Little Five Points Community Center",
        "slug": "l5p-community-center",
        "url": "https://www.l5pcc.org",
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
