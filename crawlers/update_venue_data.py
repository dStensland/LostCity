"""
Update venue records with better coordinates and vibes data.
"""

import logging
from db import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Venue updates - only update fields that are missing or need improvement
VENUE_UPDATES = {
    "the-porter-beer-bar": {
        "lat": 33.7636,
        "lng": -84.3485,
        "vibes": ["craft-beer", "beer-bar", "late-night", "little-five-points"],
    },
    "painted-duck": {
        "vibes": ["bowling", "games", "cocktails", "date-night", "west-midtown", "trendy", "late-night"],
    },
    "northside-tavern": {
        "lat": 33.7833,
        "lng": -84.4101,
        "vibes": ["blues", "live-music", "dive-bar", "legendary", "west-midtown"],
    },
    "wrecking-bar-brewpub": {
        "vibes": ["craft-beer", "brewery", "gastropub", "historic", "inman-park"],
        "neighborhood": "Inman Park",
    },
    "midway-pub": {
        "lat": 33.7415,
        "lng": -84.3419,
        "vibes": ["neighborhood-bar", "dive-bar", "patio", "east-atlanta"],
    },
    "argosy": {
        "lat": 33.7419,
        "lng": -84.3422,
        "vibes": ["cocktails", "games", "patio", "east-atlanta", "chill", "neighborhood"],
    },
    "monday-night-garage": {
        "vibes": ["craft-beer", "brewery", "taproom", "west-end", "patio"],
        "neighborhood": "West End",
    },
    "wild-heaven-beer": {
        "neighborhood": "Decatur",
        "vibes": ["craft-beer", "brewery", "taproom", "decatur", "patio", "chill"],
    },
}

def update_venues():
    """Update venue records in the database."""
    client = get_client()
    
    logger.info("\n=== UPDATING VENUE DATA ===\n")
    
    for slug, updates in VENUE_UPDATES.items():
        # Get current venue data
        result = client.table("venues").select("id, name, lat, lng, vibes, neighborhood").eq("slug", slug).execute()
        
        if not result.data or len(result.data) == 0:
            logger.warning(f"Venue '{slug}' not found, skipping")
            continue
        
        venue = result.data[0]
        
        # Only update fields that need updating
        updates_to_apply = {}
        
        for key, value in updates.items():
            current_value = venue.get(key)
            if current_value is None or (key == "vibes" and not current_value):
                updates_to_apply[key] = value
                logger.info(f"  Setting {key}: {value}")
            elif key == "vibes" and current_value:
                # Merge vibes, keeping unique values
                merged_vibes = list(set(current_value + value))
                if merged_vibes != current_value:
                    updates_to_apply[key] = merged_vibes
                    logger.info(f"  Merging {key}: {merged_vibes}")
        
        if updates_to_apply:
            client.table("venues").update(updates_to_apply).eq("slug", slug).execute()
            logger.info(f"✓ Updated {venue['name']} (ID: {venue['id']})\n")
        else:
            logger.info(f"✓ {venue['name']} already has all data\n")

if __name__ == "__main__":
    update_venues()
