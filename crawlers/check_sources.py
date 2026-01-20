#!/usr/bin/env python3
"""Check for crawlers missing from sources table."""

from db import get_client

# All slugs from SOURCE_MODULES in main.py
SOURCE_MODULES = [
    "eventbrite", "terminal-west", "the-earl", "dads-garage", "atlanta-botanical-garden",
    "high-museum", "ticketmaster", "gwcc", "hands-on-atlanta", "discover-atlanta",
    "access-atlanta", "fancons", "10times", "beltline", "eddies-attic", "smiths-olde-bar",
    "city-winery-atlanta", "laughing-skull", "punchline", "atlanta-ballet", "atlanta-opera",
    "puppetry-arts", "plaza-theatre", "tara-theatre", "landmark-midtown", "atlanta-film-festival",
    "out-on-film", "ajff", "atlanta-film-society", "atlanta-film-series", "buried-alive",
    "529", "meetup", "a-cappella-books", "charis-books", "little-shop-of-stories",
    "eagle-eye-books", "foxtale-books", "fulton-library", "dekalb-library", "resident-advisor",
    "farmers-markets", "the-masquerade", "fox-theatre", "monday-night", "atlanta-pride",
    "alliance-theatre", "creative-loafing", "variety-playhouse", "tabernacle",
    # Major Arenas & Convention Centers
    "state-farm-arena", "mercedes-benz-stadium", "cobb-energy", "gas-south", "cobb-galleria", "gicc",
    # Music Venues
    "aisle5", "wild-heaven", "coca-cola-roxy", "blind-willies", "the-loft", "center-stage", "buckhead-theatre",
    # Comedy Venues
    "helium-comedy", "uptown-comedy", "whole-world-improv", "atlanta-comedy-theater",
    # Suburban Venues
    "ameris-bank-amphitheatre", "strand-theatre", "roswell-cultural-arts", "sandy-springs-pac",
    # Museums
    "fernbank", "atlanta-history-center", "carlos-museum", "childrens-museum", "civil-rights-center",
    "college-football-hof", "world-of-coca-cola",
    # Food Halls & Markets
    "ponce-city-market", "krog-street-market", "sweet-auburn-market",
    # Breweries & Distilleries
    "sweetwater", "orpheus-brewing", "three-taverns", "pontoon-brewing", "asw-distillery",
    # Sports & Entertainment
    "truist-park", "live-at-battery", "atlanta-motor-speedway",
    # Tech & Community
    "atlanta-tech-village", "render-atl", "atlanta-tech-week", "ypa-atlanta",
    # Festivals & Conventions
    "dragon-con", "momocon", "atlanta-dogwood", "inman-park-festival", "shaky-knees",
    "atlanta-jazz-festival", "decatur-arts-festival",
    # New 30 crawlers
    "aurora-theatre", "horizon-theatre", "actors-express", "out-of-box-theatre", "stage-door-players",
    "the-eastern", "venkmans", "northside-tavern", "red-light-cafe",
    "scofflaw-brewing", "second-self-brewing", "bold-monk-brewing", "reformation-brewery",
    "ferst-center", "schwartz-center", "rialto-center",
    "atlanta-food-wine", "peachtree-road-race", "decatur-book-festival", "sweet-auburn-springfest",
    "grant-park-festival", "candler-park-fest", "east-atlanta-strut",
    "georgia-aquarium", "zoo-atlanta", "chattahoochee-nature",
    "opera-nightclub", "district-atlanta", "ravine-atlanta", "americasmart",
]

def main():
    client = get_client()
    result = client.table("sources").select("slug").execute()
    existing_slugs = {s["slug"] for s in result.data} if result.data else set()

    missing = []
    for slug in SOURCE_MODULES:
        if slug not in existing_slugs:
            missing.append(slug)

    if missing:
        print(f"Missing from sources table ({len(missing)}):")
        for slug in missing:
            print(f"  - {slug}")
    else:
        print("All crawlers have corresponding source records!")

    print(f"\nTotal crawlers: {len(SOURCE_MODULES)}")
    print(f"Total sources in DB: {len(existing_slugs)}")

if __name__ == "__main__":
    main()
