#!/usr/bin/env python3
"""
Add 30 new sources for Lost City crawlers.
Run from crawlers directory: python add_sources.py
"""

from db import get_client

NEW_SOURCES = [
    # ===== Additional Theaters =====
    {"name": "Aurora Theatre", "slug": "aurora-theatre", "url": "https://www.auroratheatre.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Horizon Theatre", "slug": "horizon-theatre", "url": "https://www.horizontheatre.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Actor's Express", "slug": "actors-express", "url": "https://www.actorsexpress.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Out of Box Theatre", "slug": "out-of-box-theatre", "url": "https://www.outofboxtheatre.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Stage Door Players", "slug": "stage-door-players", "url": "https://www.stagedoorplayers.net", "source_type": "scrape", "crawl_frequency": "daily"},

    # ===== Additional Music Venues =====
    {"name": "The Eastern", "slug": "the-eastern", "url": "https://www.easternatl.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Venkman's", "slug": "venkmans", "url": "https://www.venkmans.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Northside Tavern", "slug": "northside-tavern", "url": "https://www.northsidetavern.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Red Light Cafe", "slug": "red-light-cafe", "url": "https://www.redlightcafe.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # ===== Additional Breweries =====
    {"name": "Scofflaw Brewing", "slug": "scofflaw-brewing", "url": "https://www.scofflawbeer.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Second Self Beer Company", "slug": "second-self-brewing", "url": "https://www.secondselfbeer.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Bold Monk Brewing", "slug": "bold-monk-brewing", "url": "https://www.boldmonkbrewing.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Reformation Brewery", "slug": "reformation-brewery", "url": "https://www.reformationbrewery.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # ===== University Venues =====
    {"name": "Ferst Center for the Arts", "slug": "ferst-center", "url": "https://arts.gatech.edu", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Schwartz Center for Performing Arts", "slug": "schwartz-center", "url": "https://arts.emory.edu", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Rialto Center for the Arts", "slug": "rialto-center", "url": "https://rfrialto.gsu.edu", "source_type": "scrape", "crawl_frequency": "daily"},

    # ===== Additional Festivals =====
    {"name": "Atlanta Food & Wine Festival", "slug": "atlanta-food-wine", "url": "https://www.atlantafoodandwinefestival.com", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Peachtree Road Race", "slug": "peachtree-road-race", "url": "https://www.atlantatrackclub.org/peachtree", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Decatur Book Festival", "slug": "decatur-book-festival", "url": "https://www.decaturbookfestival.com", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Sweet Auburn Springfest", "slug": "sweet-auburn-springfest", "url": "https://www.sweetauburn.com", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Grant Park Summer Shade Festival", "slug": "grant-park-festival", "url": "https://www.grantparkfestival.org", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Candler Park Fall Fest", "slug": "candler-park-fest", "url": "https://www.candlerparkfest.org", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "East Atlanta Strut", "slug": "east-atlanta-strut", "url": "https://www.eastatlantastrut.com", "source_type": "scrape", "crawl_frequency": "weekly"},

    # ===== Attractions =====
    {"name": "Georgia Aquarium", "slug": "georgia-aquarium", "url": "https://www.georgiaaquarium.org", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Zoo Atlanta", "slug": "zoo-atlanta", "url": "https://www.zooatlanta.org", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Chattahoochee Nature Center", "slug": "chattahoochee-nature", "url": "https://www.chattnaturecenter.org", "source_type": "scrape", "crawl_frequency": "daily"},

    # ===== Nightlife =====
    {"name": "Opera Nightclub", "slug": "opera-nightclub", "url": "https://www.operaatlanta.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "District Atlanta", "slug": "district-atlanta", "url": "https://www.districtatlanta.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Ravine Atlanta", "slug": "ravine-atlanta", "url": "https://www.ravineatlanta.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # ===== Trade & Convention =====
    {"name": "AmericasMart Atlanta", "slug": "americasmart", "url": "https://www.americasmart.com", "source_type": "scrape", "crawl_frequency": "daily"},
]


def main():
    client = get_client()
    added = 0
    skipped = 0

    for source in NEW_SOURCES:
        # Check if source already exists
        existing = client.table("sources").select("id").eq("slug", source["slug"]).execute()
        if existing.data and len(existing.data) > 0:
            print(f"  Skipped (exists): {source['name']}")
            skipped += 1
            continue

        # Insert new source
        try:
            client.table("sources").insert(source).execute()
            print(f"  Added: {source['name']}")
            added += 1
        except Exception as e:
            print(f"  Error adding {source['name']}: {e}")

    print(f"\nDone! Added {added} new sources, skipped {skipped} existing.")


if __name__ == "__main__":
    main()
