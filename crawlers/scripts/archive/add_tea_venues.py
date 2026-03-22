#!/usr/bin/env python3
"""
Add tea room venues and source stubs to the database.

These are DESTINATION venues — places people would want to visit in Atlanta
for tea services, afternoon tea, and tea culture experiences. We want them
in the database even if they don't have crawlable event calendars yet.

Sources include dedicated tea rooms, tea houses, and hotels/museums offering
traditional afternoon tea services across the Atlanta metro area.
"""

import logging
from db import get_or_create_venue, get_venue_by_slug, get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Tea rooms use "restaurant" as venue_type (closest match in taxonomy)
# Some venues like museums/hotels may already exist, so we check first
TEA_VENUES = [
    # === Dedicated Tea Rooms (ITP) ===
    {
        "name": "Dr. Bombay's Underwater Tea Party",
        "slug": "dr-bombays-tea",
        "address": "753 Cherokee Ave SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7334,
        "lng": -84.3717,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.drbombays.com/",
        "vibes": ["whimsical", "cozy", "literary"],
    },
    {
        "name": "The Dirty Tea",
        "slug": "the-dirty-tea",
        "address": "1056 St Charles Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7873,
        "lng": -84.3536,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.thedirtytea.com/",
        "vibes": ["upscale", "date-night", "instagrammable"],
    },
    {
        "name": "A Queens Tea Party",
        "slug": "a-queens-tea-party",
        "address": "621 North Avenue",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7700,
        "lng": -84.3750,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.aqueensteapartyatl.com/",
        "vibes": ["elegant", "instagrammable", "black-owned"],
    },
    {
        "name": "Just Add Honey Tea Company",
        "slug": "just-add-honey-tea",
        "address": "684 John Wesley Dobbs Ave, Unit E",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7588,
        "lng": -84.3725,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://justaddhoney.net/",
        "vibes": ["beltline", "cozy", "wellness", "local"],
    },
    {
        "name": "Wai's Gong Fu Tea House",
        "slug": "wais-gong-fu-tea",
        "address": "1385 English St NW, Building A",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7930,
        "lng": -84.4310,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.waisgongfutea.com/",
        "vibes": ["zen", "wellness"],
    },

    # === Dedicated Tea Rooms (OTP / Suburbs) ===
    {
        "name": "The Ginger Room",
        "slug": "the-ginger-room",
        "address": "61 Roswell St",
        "neighborhood": "Downtown Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 33.5761,
        "lng": -84.2941,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://the-gingerroom.com/",
        "vibes": ["british", "elegant", "historic"],
    },
    {
        "name": "Jessa's Tea Parlor",
        "slug": "jessas-tea-parlor",
        "address": "3333 Trickum Rd #101",
        "neighborhood": "Woodstock",
        "city": "Woodstock",
        "state": "GA",
        "zip": "30188",
        "lat": 34.1015,
        "lng": -84.4894,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.jessasteaparlor.com/",
        "vibes": ["southern", "cozy", "classic"],
    },
    {
        "name": "Rose Valley Sweets",
        "slug": "rose-valley-sweets",
        "address": "6000 Medlock Bridge Pkwy, Suite B100",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30022",
        "lat": 34.0259,
        "lng": -84.1764,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "vibes": ["elegant", "instagrammable"],
    },
    {
        "name": "The Grande Event Tea Room",
        "slug": "the-grande-event-tea-room",
        "address": "5360 Ball Ground Hwy",
        "neighborhood": "Ball Ground",
        "city": "Ball Ground",
        "state": "GA",
        "zip": "30107",
        "lat": 34.3376,
        "lng": -84.3749,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "http://www.thegrandeevent.com",
        "vibes": ["southern", "historic", "elegant"],
    },
    {
        "name": "Fergusson's on the Square",
        "slug": "fergussons-on-the-square",
        "address": "39 City Square",
        "neighborhood": "Hoschton",
        "city": "Hoschton",
        "state": "GA",
        "zip": "30548",
        "lat": 34.0965,
        "lng": -83.7613,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.fergussonsonthesquare.com",
        "vibes": ["affordable", "historic", "cozy", "southern"],
    },
    {
        "name": "Besties",
        "slug": "besties-alpharetta",
        "address": "5238 McGinnis Ferry Road",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30005",
        "lat": 34.0841,
        "lng": -84.1366,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://bestiesempanadas.com",
        "vibes": ["cozy", "european"],
    },
    {
        "name": "ZenTea",
        "slug": "zentea-chamblee",
        "address": "5356 Peachtree Rd",
        "neighborhood": "Chamblee",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30341",
        "lat": 33.8876,
        "lng": -84.3085,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://zentea.com/",
        "vibes": ["zen", "wellness", "patio"],
    },
    {
        "name": "Ark Coffeehaus",
        "slug": "ark-coffeehaus",
        "address": "4448 Tilly Mill Rd, Ste G",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30360",
        "lat": 33.9325,
        "lng": -84.2978,
        "venue_type": "coffee_shop",
        "spot_type": "coffee_shop",
        "website": "https://www.arkcoffeehaus.com/",
        "vibes": ["organic", "cozy"],
    },

    # === Hotel/Museum Tea Services ===
    # These may already exist as venues, so we check first
    {
        "name": "Swan Coach House",
        "slug": "swan-coach-house",
        "address": "3130 Slaton Dr NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8420,
        "lng": -84.3880,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.swancoachhouse.com/",
        "vibes": ["historic", "elegant", "garden", "classic"],
    },
    {
        "name": "Millennium Gate Museum",
        "slug": "millennium-gate-museum",
        "address": "395 17th Street NW",
        "neighborhood": "Atlantic Station",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30363",
        "lat": 33.7910,
        "lng": -84.3950,
        "venue_type": "museum",
        "spot_type": "museum",
        "website": "https://www.thegatemuseum.org/",
        "vibes": ["historic", "architecture", "rooftop"],
    },
    {
        "name": "Bulloch Hall",
        "slug": "bulloch-hall",
        "address": "180 Bulloch Ave",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30075",
        "lat": 34.0233,
        "lng": -84.3536,
        "venue_type": "museum",
        "spot_type": "museum",
        "website": "https://www.bullochhall.org/",
        "vibes": ["historic", "holiday"],
    },
    {
        "name": "Donaldson-Bannister Farm",
        "slug": "donaldson-bannister-farm",
        "address": "4831 Chamblee-Dunwoody Road",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9280,
        "lng": -84.3147,
        "venue_type": "venue",
        "spot_type": "venue",
        "website": "https://dunwoodypreservationtrust.org/donaldson-bannister-farm/",
        "vibes": ["historic", "garden", "farm", "community"],
    },
]

# Hotels that likely already exist - we'll just check these
HOTELS_TO_CHECK = [
    "St. Regis Atlanta",
    "Waldorf Astoria Atlanta Buckhead",
    "The Ritz-Carlton Atlanta",
]

# Hotels that need to be added if missing
HOTEL_VENUES_TO_ADD = [
    {
        "name": "Four Seasons Hotel Atlanta",
        "slug": "four-seasons-hotel-atlanta",
        "address": "75 Fourteenth Street NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7862,
        "lng": -84.3854,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.fourseasons.com/atlanta/",
        "vibes": ["luxury", "upscale", "date-night"],
    },
    {
        "name": "The Westin Atlanta Gwinnett",
        "slug": "westin-atlanta-gwinnett",
        "address": "6205 Sugarloaf Pkwy",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30097",
        "lat": 33.9580,
        "lng": -84.0707,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.marriott.com/en-us/hotels/atlwu-the-westin-atlanta-gwinnett/",
        "vibes": ["rooftop", "upscale", "views"],
    },
    {
        "name": "Chateau Elan Winery & Resort",
        "slug": "chateau-elan",
        "address": "100 Rue Charlemagne",
        "neighborhood": "Braselton",
        "city": "Braselton",
        "state": "GA",
        "zip": "30517",
        "lat": 34.1092,
        "lng": -83.8317,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://chateauelan.com/",
        "vibes": ["winery", "luxury", "resort", "spa"],
    },
]


def create_source_stub(venue_name: str, venue_slug: str, website: str):
    """Create a source stub for future crawler development."""
    client = get_client()

    source_data = {
        "name": venue_name,
        "slug": venue_slug,
        "url": website or f"https://{venue_slug}.com",  # Placeholder if no website
        "source_type": "venue",
        "crawl_frequency": "weekly",
        "is_active": False,  # Spiked for future development
        "integration_method": "crawler",
    }

    # Check if source already exists
    result = client.table("sources").select("id").eq("slug", venue_slug).execute()
    if result.data:
        logger.info(f"      Source already exists (id={result.data[0]['id']})")
        return result.data[0]["id"]

    # Create source
    result = client.table("sources").insert(source_data).execute()
    logger.info(f"      Created source stub (id={result.data[0]['id']})")
    return result.data[0]["id"]


def main():
    """Add all tea venues and create source stubs."""
    added_venues = 0
    skipped_venues = 0
    added_sources = 0

    logger.info("=" * 70)
    logger.info("Adding Atlanta Tea Venues & Source Stubs")
    logger.info("=" * 70)
    logger.info(f"Processing {len(TEA_VENUES)} tea venues...")
    logger.info("")

    for venue in TEA_VENUES:
        # Check if already exists
        existing = get_venue_by_slug(venue["slug"])
        if existing:
            logger.info(f"  SKIP: {venue['name']:40s} (already exists, id={existing['id']})")
            skipped_venues += 1

            # Still try to create source stub if it has a website
            if venue.get("website"):
                try:
                    create_source_stub(
                        venue["name"],
                        venue["slug"],
                        venue["website"]
                    )
                    added_sources += 1
                except Exception as e:
                    logger.info(f"      Source stub failed: {e}")
            continue

        # Add venue
        try:
            venue_id = get_or_create_venue(venue)
            logger.info(f"  ADD:  {venue['name']:40s} -> ID {venue_id}")
            added_venues += 1

            # Create source stub if venue has website
            if venue.get("website"):
                try:
                    create_source_stub(
                        venue["name"],
                        venue["slug"],
                        venue["website"]
                    )
                    added_sources += 1
                except Exception as e:
                    logger.info(f"      Source stub failed: {e}")

        except Exception as e:
            logger.error(f"  ERROR: {venue['name']}: {e}")

    # Check existing hotels
    logger.info("")
    logger.info("=" * 70)
    logger.info("Checking Hotel Venues (these may already exist)")
    logger.info("=" * 70)

    for hotel_name in HOTELS_TO_CHECK:
        result = get_venue_by_slug(hotel_name.lower().replace(" ", "-").replace(".", ""))
        if result:
            logger.info(f"  ✓ {hotel_name:45s} exists (id={result['id']})")
        else:
            alt_slug = hotel_name.lower().replace(" ", "-").replace(",", "").replace(".", "")
            result = get_venue_by_slug(alt_slug)
            if result:
                logger.info(f"  ✓ {hotel_name:45s} exists (id={result['id']})")
            else:
                logger.info(f"  ✗ {hotel_name:45s} NOT FOUND")

    # Add missing hotel venues
    logger.info("")
    logger.info("=" * 70)
    logger.info("Adding Missing Hotel Venues")
    logger.info("=" * 70)

    for venue in HOTEL_VENUES_TO_ADD:
        existing = get_venue_by_slug(venue["slug"])
        if existing:
            logger.info(f"  SKIP: {venue['name']:40s} (already exists, id={existing['id']})")
            skipped_venues += 1
        else:
            try:
                venue_id = get_or_create_venue(venue)
                logger.info(f"  ADD:  {venue['name']:40s} -> ID {venue_id}")
                added_venues += 1
            except Exception as e:
                logger.error(f"  ERROR: {venue['name']}: {e}")

    logger.info("")
    logger.info("=" * 70)
    logger.info(f"Done!")
    logger.info(f"  Venues:  {added_venues} added, {skipped_venues} already existed")
    logger.info(f"  Sources: {added_sources} source stubs created")
    logger.info("=" * 70)
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. Run venue enrichment to fetch descriptions/images from websites")
    logger.info("  2. Build crawlers for venues with event calendars")
    logger.info("  3. Activate sources when crawlers are ready")


if __name__ == "__main__":
    main()
