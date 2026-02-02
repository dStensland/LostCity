#!/usr/bin/env python3
"""
Import Eater Nashville Essential 38 venues to the database.
Based on NASHVILLE_METRO_CURATORS_RESEARCH.md data.
"""

import sys
import logging
import re
import db

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def slugify(text):
    """Simple slugify function."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    return text

# All Eater Nashville Essential 38 venues from curator research
EATER_NASHVILLE_VENUES = [
    # EAST NASHVILLE
    {
        'name': "Shotgun Willie's BBQ",
        'address': '4000 Gallatin Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Award-winning brisket, Texas-style BBQ. Featured on Eater Nashville Essential 38.',
        'vibes': ['bbq', 'casual', 'local-favorite']
    },
    {
        'name': 'Bastion',
        'address': '434 Houston St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'James Beard finalist Josh Habiger. Tasting menu and bar. Featured on Eater Nashville Essential 38.',
        'vibes': ['upscale', 'tasting-menu', 'chef-driven', 'award-winning']
    },
    {
        'name': 'Sho Pizza Bar',
        'address': '1309 McGavock Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Sean Brock. Neopolitan-Tokyo fusion pizza. Featured on Eater Nashville Essential 38.',
        'vibes': ['pizza', 'fusion', 'chef-driven']
    },
    {
        'name': 'S.S. Gai',
        'address': '1101 McKennie Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Thai fried chicken at the Wash food hall. Featured on Eater Nashville Essential 38.',
        'vibes': ['thai', 'food-hall', 'casual']
    },
    {
        'name': 'Kisser',
        'address': '747 Douglas Ave, Highland Yards',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Milk bread sandwiches, katsu. Featured on Eater Nashville Essential 38.',
        'vibes': ['asian', 'sandwiches', 'casual']
    },
    {
        'name': 'East Side Banh Mi',
        'address': '1000 Gallatin Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Vietnamese sandwiches. Featured on Eater Nashville Essential 38.',
        'vibes': ['vietnamese', 'sandwiches', 'casual']
    },
    {
        'name': 'FatBelly Pretzel',
        'address': '921 Gallatin Ave Ste 101',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Pretzels and sandwiches. Featured on Eater Nashville Essential 38.',
        'vibes': ['pretzels', 'sandwiches', 'casual']
    },
    {
        'name': 'Xiao Bao',
        'address': '830 Meridian St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Pan-Asian, bao buns, hand-pulled noodles. Featured on Eater Nashville Essential 38.',
        'vibes': ['pan-asian', 'bao', 'noodles']
    },
    {
        'name': 'Folk',
        'address': '823 Meridian St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Philip Krajeck, pizza-focused. Featured on Eater Nashville Essential 38.',
        'vibes': ['pizza', 'chef-driven', 'casual']
    },
    {
        'name': 'Turkey and the Wolf Icehouse',
        'address': '800 Meridian St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'bar',
        'description': 'New Orleans spirit, beer garden. Featured on Eater Nashville Essential 38.',
        'vibes': ['beer-garden', 'new-orleans', 'casual']
    },
    {
        'name': 'Peninsula',
        'address': '1035 West Eastland Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Spanish/Iberian, moody, wine-focused. Featured on Eater Nashville Essential 38.',
        'vibes': ['spanish', 'wine-bar', 'moody']
    },
    {
        'name': 'Noko',
        'address': '701 Porter Rd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Wood-fired Asian, brunch. Featured on Eater Nashville Essential 38.',
        'vibes': ['asian', 'brunch', 'wood-fired']
    },
    {
        'name': 'Maiz De La Vida',
        'address': '1100 Stratton Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Heirloom corn, fresh masa. Also has Gulch location. Featured on Eater Nashville Essential 38.',
        'vibes': ['mexican', 'masa', 'chef-driven']
    },
    {
        'name': "Dino's Bar",
        'address': '411 Gallatin Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'bar',
        'description': "Nashville's oldest dive bar, burgers. Featured on Eater Nashville Essential 38.",
        'vibes': ['dive-bar', 'burgers', 'historic', 'local-favorite']
    },
    {
        'name': "Bolton's Spicy Chicken & Fish",
        'address': '624 Main St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Top hot chicken spot. Featured on Eater Nashville Essential 38.',
        'vibes': ['hot-chicken', 'casual', 'local-favorite']
    },
    {
        'name': 'Lockeland Table',
        'address': '1520 Woodland St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Wood-fired pizza, seasonal. Featured on Eater Nashville Essential 38.',
        'vibes': ['pizza', 'wood-fired', 'seasonal']
    },
    {
        'name': 'Bad Idea',
        'address': '1021 Russell St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'bar',
        'description': 'Wine-focused, former church, late night til 1am. Featured on Eater Nashville Essential 38.',
        'vibes': ['wine-bar', 'late-night', 'unique-space']
    },
    
    # GERMANTOWN
    {
        'name': 'City House',
        'address': '1222 4th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'restaurant',
        'description': 'Tandy Wilson, James Beard winner 2016. Italian and wood-fired pizza. Featured on Eater Nashville Essential 38.',
        'vibes': ['italian', 'pizza', 'award-winning', 'chef-driven']
    },
    {
        'name': 'Little Hats Market',
        'address': '1120 4th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'restaurant',
        'description': 'Italian deli and market. 3 locations. Featured on Eater Nashville Essential 38.',
        'vibes': ['italian', 'deli', 'market']
    },
    
    # SALEMTOWN
    {
        'name': "Big Al's Deli",
        'address': '1828 4th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Salemtown',
        'venue_type': 'restaurant',
        'description': 'Homestyle breakfast/lunch, Southern staples. Featured on Eater Nashville Essential 38.',
        'vibes': ['breakfast', 'lunch', 'southern', 'deli']
    },
    
    # MIDTOWN / 12 SOUTH
    {
        'name': 'Tailor Nashville',
        'address': '620 Taylor St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'restaurant',
        'description': 'Chef Vivek Surti, South Asian American, dinner party style, $130-150. Featured on Eater Nashville Essential 38.',
        'vibes': ['south-asian', 'tasting-menu', 'upscale', 'chef-driven']
    },
    {
        'name': 'The Butter Milk Ranch',
        'address': '2407 12th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': '12 South',
        'venue_type': 'cafe',
        'description': 'Bakehouse, cafe, breakfast. Featured on Eater Nashville Essential 38.',
        'vibes': ['bakery', 'breakfast', 'cafe']
    },
    {
        'name': 'Locust',
        'address': '2305 12th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': '12 South',
        'venue_type': 'restaurant',
        'description': "Chef Trevor Moran, dumplings, kakigori. World's 50 Best North America list. Featured on Eater Nashville Essential 38.",
        'vibes': ['asian', 'award-winning', 'chef-driven', 'dumplings']
    },
    
    # WEDGEWOOD HOUSTON / THE GULCH
    {
        'name': "Iggy's",
        'address': '609 Merritt Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Wedgewood Houston',
        'venue_type': 'restaurant',
        'description': 'Italian, inventive. Featured on Eater Nashville Essential 38.',
        'vibes': ['italian', 'inventive', 'chef-driven']
    },
    {
        'name': 'St. Vito Focacceria',
        'address': '605 Mansion St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Wedgewood Houston',
        'venue_type': 'restaurant',
        'description': 'Sicilian sfincione/focaccia pizza. Featured on Eater Nashville Essential 38.',
        'vibes': ['sicilian', 'pizza', 'focaccia']
    },
    {
        'name': 'Yolan',
        'address': '403 4th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Gulch',
        'venue_type': 'restaurant',
        'description': 'Joseph hotel, Italian fine dining, cheese cave. Featured on Eater Nashville Essential 38.',
        'vibes': ['italian', 'fine-dining', 'upscale', 'hotel']
    },
    
    # WEST NASHVILLE
    {
        'name': 'VN Pho & Deli',
        'address': '5906 Charlotte Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'West Nashville',
        'venue_type': 'restaurant',
        'description': 'Vietnamese, cash-only. Note: moving to Mt. Juliet 2026. Featured on Eater Nashville Essential 38.',
        'vibes': ['vietnamese', 'pho', 'cash-only']
    },
    {
        'name': 'NY Pie',
        'address': '6800 Charlotte Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'West Nashville',
        'venue_type': 'restaurant',
        'description': 'Pizza. 3 locations: West, Hendersonville, Franklin. Featured on Eater Nashville Essential 38.',
        'vibes': ['pizza', 'casual']
    },
    {
        'name': "Wendell Smith's Restaurant",
        'address': '407 53rd Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'West Nashville',
        'venue_type': 'restaurant',
        'description': 'Since 1952, meat-and-three. Featured on Eater Nashville Essential 38.',
        'vibes': ['meat-and-three', 'southern', 'historic']
    },
    
    # BELMONT
    {
        'name': 'International Market',
        'address': '2013 Belmont Blvd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Belmont',
        'venue_type': 'restaurant',
        'description': 'James Beard semifinalist Arnold Myint, Thai. Featured on Eater Nashville Essential 38.',
        'vibes': ['thai', 'award-winning', 'chef-driven']
    },
    
    # BELLE MEADE / GREEN HILLS
    {
        'name': 'Roze Pony',
        'address': '5133 Harding Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Belle Meade',
        'venue_type': 'restaurant',
        'description': "All-day, oysters, Julia Jaksic's West Nashville spot. Featured on Eater Nashville Essential 38.",
        'vibes': ['all-day', 'oysters', 'upscale']
    },
    
    # SOUTH NASHVILLE
    {
        'name': 'Gojo Ethiopian Cafe',
        'address': '415 W Thompson Ln',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'South Nashville',
        'venue_type': 'restaurant',
        'description': 'Ethiopian, coffee service. Featured on Eater Nashville Essential 38.',
        'vibes': ['ethiopian', 'coffee']
    },
    {
        'name': 'Degthai',
        'address': '3025 Nolensville Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'South Nashville',
        'venue_type': 'restaurant',
        'description': 'Thai, from food truck to 2 locations. Featured on Eater Nashville Essential 38.',
        'vibes': ['thai', 'casual']
    },
    {
        'name': "King Tut's",
        'address': '3716 Nolensville Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'South Nashville',
        'venue_type': 'restaurant',
        'description': 'Egyptian/NY flair, falafel. Featured on Eater Nashville Essential 38.',
        'vibes': ['egyptian', 'middle-eastern', 'falafel']
    },
    {
        'name': 'Edessa Restaurant',
        'address': '3802 Nolensville Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'South Nashville',
        'venue_type': 'restaurant',
        'description': 'Kurdish and Turkish, halal. Featured on Eater Nashville Essential 38.',
        'vibes': ['kurdish', 'turkish', 'halal']
    },
    
    # ANTIOCH
    {
        'name': 'Hai Woon Dai',
        'address': '2051 Antioch Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Antioch',
        'venue_type': 'restaurant',
        'description': 'Korean, over a decade. Featured on Eater Nashville Essential 38.',
        'vibes': ['korean', 'casual']
    },
    
    # OTHER NASHVILLE
    {
        'name': "Monell's",
        'address': '1235 6th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'restaurant',
        'description': 'Victorian home, all-you-can-eat family-style, fried chicken. Featured on Eater Nashville Essential 38.',
        'vibes': ['southern', 'family-style', 'fried-chicken', 'unique-space']
    },
    {
        'name': 'Riddim n Spice',
        'address': '2116 Meharry Blvd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Jefferson Street',
        'venue_type': 'restaurant',
        'description': 'Caribbean/Jamaican, near Jefferson St. Featured on Eater Nashville Essential 38.',
        'vibes': ['caribbean', 'jamaican', 'casual']
    },
]


def import_venues():
    """Import all Eater Nashville Essential 38 venues."""
    client = db.get_client()

    total = len(EATER_NASHVILLE_VENUES)
    created = 0
    updated = 0
    skipped = 0

    logger.info(f"Starting import of {total} Eater Nashville Essential 38 venues...")

    for i, venue_data in enumerate(EATER_NASHVILLE_VENUES, 1):
        try:
            # Generate slug
            if 'slug' not in venue_data:
                venue_data['slug'] = slugify(venue_data['name'])

            # Add curator vibe tags (venues use 'vibes' not 'tags')
            existing_vibes = venue_data.get('vibes', [])
            curator_vibes = ['curator-vetted', 'eater-nashville-38']
            venue_data['vibes'] = list(set(existing_vibes + curator_vibes))

            # Check if venue exists
            existing = client.table('venues').select('id, name').eq('slug', venue_data['slug']).execute()

            if existing.data:
                # Update existing venue
                venue_id = existing.data[0]['id']
                result = client.table('venues').update(venue_data).eq('id', venue_id).execute()
                logger.info(f"[{i}/{total}] Updated: {venue_data['name']}")
                updated += 1
            else:
                # Insert new venue
                result = client.table('venues').insert(venue_data).execute()
                logger.info(f"[{i}/{total}] Created: {venue_data['name']}")
                created += 1

        except Exception as e:
            logger.error(f"[{i}/{total}] Error importing {venue_data['name']}: {e}")
            skipped += 1
            continue
    
    logger.info("\n" + "="*60)
    logger.info("Import Complete!")
    logger.info(f"Total venues: {total}")
    logger.info(f"Created: {created}")
    logger.info(f"Updated: {updated}")
    logger.info(f"Skipped (errors): {skipped}")
    logger.info("="*60)


if __name__ == "__main__":
    try:
        import_venues()
    except KeyboardInterrupt:
        logger.info("\nImport interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
