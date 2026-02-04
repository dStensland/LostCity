"""
Verify that all new bar venues exist in the database.
"""

import logging
from db import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VENUES_TO_CHECK = [
    ("the-porter", "The Porter Beer Bar"),
    ("the-painted-duck", "The Painted Duck"),
    ("johnnys-hideaway", "Johnny's Hideaway"),
    ("the-earl", "The EARL"),
    ("northside-tavern", "Northside Tavern"),
    ("torched-hop", "Torched Hop Brewing"),
    ("wrecking-bar", "Wrecking Bar Brewpub"),
    ("manuels-tavern", "Manuel's Tavern"),
    ("midway-pub", "Midway Pub"),
    ("argosy", "Argosy"),
    ("monday-night-garage", "Monday Night Garage"),
    ("wild-heaven", "Wild Heaven Beer"),
]

def verify_venues():
    """Check that all venues exist in the database."""
    client = get_client()
    
    logger.info("\n=== VENUE VERIFICATION ===\n")
    
    for slug, name in VENUES_TO_CHECK:
        result = client.table("venues").select("id, name, slug, neighborhood, lat, lng, vibes").eq("slug", slug).execute()
        
        if result.data and len(result.data) > 0:
            venue = result.data[0]
            vibes = venue.get('vibes', [])
            vibes_str = ', '.join(vibes) if vibes and isinstance(vibes, list) else 'None'
            logger.info(f"✓ {name} (ID: {venue['id']}, slug: {venue['slug']})")
            logger.info(f"  Neighborhood: {venue.get('neighborhood', 'N/A')}")
            logger.info(f"  Coordinates: {venue.get('lat', 'N/A')}, {venue.get('lng', 'N/A')}")
            logger.info(f"  Vibes: {vibes_str}\n")
        else:
            # Try finding by name
            result = client.table("venues").select("id, name, slug, neighborhood, lat, lng, vibes").eq("name", name).execute()
            if result.data and len(result.data) > 0:
                venue = result.data[0]
                vibes = venue.get('vibes', [])
                vibes_str = ', '.join(vibes) if vibes and isinstance(vibes, list) else 'None'
                logger.warning(f"⚠ {name} found but with different slug: '{venue['slug']}' (ID: {venue['id']})")
                logger.info(f"  Neighborhood: {venue.get('neighborhood', 'N/A')}")
                logger.info(f"  Coordinates: {venue.get('lat', 'N/A')}, {venue.get('lng', 'N/A')}")
                logger.info(f"  Vibes: {vibes_str}\n")
            else:
                logger.error(f"✗ {name} - NOT FOUND\n")

if __name__ == "__main__":
    verify_venues()
