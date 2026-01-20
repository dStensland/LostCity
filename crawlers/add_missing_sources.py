#!/usr/bin/env python3
"""
Add missing sources for Lost City crawlers.
"""

from db import get_client

MISSING_SOURCES = [
    # Major Venues
    {"name": "The Masquerade", "slug": "the-masquerade", "url": "https://www.masqueradeatlanta.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Fox Theatre", "slug": "fox-theatre", "url": "https://www.foxtheatre.org", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Monday Night Brewing", "slug": "monday-night", "url": "https://www.mondaynightbrewing.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Atlanta Pride", "slug": "atlanta-pride", "url": "https://www.atlantapride.org", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Alliance Theatre", "slug": "alliance-theatre", "url": "https://www.alliancetheatre.org", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Tabernacle", "slug": "tabernacle", "url": "https://www.tabernacleatl.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # Major Arenas & Convention Centers
    {"name": "State Farm Arena", "slug": "state-farm-arena", "url": "https://www.statefarmarena.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Mercedes-Benz Stadium", "slug": "mercedes-benz-stadium", "url": "https://www.mercedesbenzstadium.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Cobb Energy Performing Arts Centre", "slug": "cobb-energy", "url": "https://www.cobbenergycentre.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Gas South Arena", "slug": "gas-south", "url": "https://www.gassoutharena.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Cobb Galleria Centre", "slug": "cobb-galleria", "url": "https://www.cobbgalleria.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Georgia International Convention Center", "slug": "gicc", "url": "https://www.gicc.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # Music Venues
    {"name": "Aisle 5", "slug": "aisle5", "url": "https://www.aaborhood.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Wild Heaven Beer", "slug": "wild-heaven", "url": "https://www.wildheavenbeer.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Coca-Cola Roxy", "slug": "coca-cola-roxy", "url": "https://www.roxyatlanta.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Blind Willie's", "slug": "blind-willies", "url": "https://www.blindwilliesblues.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "The Loft", "slug": "the-loft", "url": "https://www.theloftatl.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Center Stage", "slug": "center-stage", "url": "https://www.centerstage-atlanta.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Buckhead Theatre", "slug": "buckhead-theatre", "url": "https://www.buckheadtheatre.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # Comedy Venues
    {"name": "Helium Comedy Club", "slug": "helium-comedy", "url": "https://atlanta.heliumcomedy.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Uptown Comedy Corner", "slug": "uptown-comedy", "url": "https://www.uptowncomedycorner.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Whole World Improv Theatre", "slug": "whole-world-improv", "url": "https://www.wholeworldtheatre.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Atlanta Comedy Theater", "slug": "atlanta-comedy-theater", "url": "https://www.atlantacomedytheater.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # Suburban Venues
    {"name": "Ameris Bank Amphitheatre", "slug": "ameris-bank-amphitheatre", "url": "https://www.amerisbankamphitheatre.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Earl Smith Strand Theatre", "slug": "strand-theatre", "url": "https://www.earlsmithstrand.org", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Roswell Cultural Arts Center", "slug": "roswell-cultural-arts", "url": "https://www.roswellgov.com/government/departments/recreation-parks-historic-cultural-affairs/cultural-arts", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Sandy Springs Performing Arts Center", "slug": "sandy-springs-pac", "url": "https://www.sandyspringsperformingarts.org", "source_type": "scrape", "crawl_frequency": "daily"},

    # Museums
    {"name": "Fernbank Museum of Natural History", "slug": "fernbank", "url": "https://www.fernbankmuseum.org", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Atlanta History Center", "slug": "atlanta-history-center", "url": "https://www.atlantahistorycenter.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Michael C. Carlos Museum", "slug": "carlos-museum", "url": "https://carlos.emory.edu", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Children's Museum of Atlanta", "slug": "childrens-museum", "url": "https://www.childrensmuseumatlanta.org", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "National Center for Civil and Human Rights", "slug": "civil-rights-center", "url": "https://www.civilandhumanrights.org", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "College Football Hall of Fame", "slug": "college-football-hof", "url": "https://www.cfbhall.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "World of Coca-Cola", "slug": "world-of-coca-cola", "url": "https://www.worldofcoca-cola.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # Food Halls & Markets
    {"name": "Ponce City Market", "slug": "ponce-city-market", "url": "https://www.poncecitymarket.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Krog Street Market", "slug": "krog-street-market", "url": "https://www.krogstreetmarket.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Sweet Auburn Curb Market", "slug": "sweet-auburn-market", "url": "https://www.sweetauburncurbmarket.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # Breweries & Distilleries
    {"name": "SweetWater Brewing Company", "slug": "sweetwater", "url": "https://www.sweetwaterbrew.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Orpheus Brewing", "slug": "orpheus-brewing", "url": "https://www.orpheusbrewing.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Three Taverns Craft Brewery", "slug": "three-taverns", "url": "https://www.threetavernsbrewery.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Pontoon Brewing", "slug": "pontoon-brewing", "url": "https://www.pontoonbrewing.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "ASW Distillery", "slug": "asw-distillery", "url": "https://www.aswdistillery.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # Sports & Entertainment
    {"name": "Truist Park", "slug": "truist-park", "url": "https://www.mlb.com/braves/ballpark", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "The Battery Atlanta", "slug": "live-at-battery", "url": "https://www.batteryatl.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Atlanta Motor Speedway", "slug": "atlanta-motor-speedway", "url": "https://www.atlantamotorspeedway.com", "source_type": "scrape", "crawl_frequency": "daily"},

    # Tech & Community Organizations
    {"name": "Atlanta Tech Village", "slug": "atlanta-tech-village", "url": "https://www.atlantatechvillage.com", "source_type": "scrape", "crawl_frequency": "daily"},
    {"name": "Render ATL", "slug": "render-atl", "url": "https://www.renderatl.com", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Atlanta Tech Week", "slug": "atlanta-tech-week", "url": "https://www.atlantatechweek.com", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Young Professionals of Atlanta", "slug": "ypa-atlanta", "url": "https://www.ypatl.org", "source_type": "scrape", "crawl_frequency": "daily"},

    # Festivals & Conventions
    {"name": "Dragon Con", "slug": "dragon-con", "url": "https://www.dragoncon.org", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "MomoCon", "slug": "momocon", "url": "https://www.momocon.com", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Atlanta Dogwood Festival", "slug": "atlanta-dogwood", "url": "https://www.dogwood.org", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Inman Park Festival", "slug": "inman-park-festival", "url": "https://www.inmanparkfestival.org", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Shaky Knees Festival", "slug": "shaky-knees", "url": "https://www.shakykneesfestival.com", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Atlanta Jazz Festival", "slug": "atlanta-jazz-festival", "url": "https://www.atlantafestivals.com/atlanta-jazz-festival", "source_type": "scrape", "crawl_frequency": "weekly"},
    {"name": "Decatur Arts Festival", "slug": "decatur-arts-festival", "url": "https://www.decaturartsfestival.com", "source_type": "scrape", "crawl_frequency": "weekly"},
]


def main():
    client = get_client()
    added = 0
    skipped = 0

    for source in MISSING_SOURCES:
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
