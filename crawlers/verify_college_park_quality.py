#!/usr/bin/env python3
"""
Verify data quality for College Park area venues.
Checks for duplicates, validates coordinates, and identifies venues needing enrichment.
"""

import logging
from db import get_client
from typing import Dict, List

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_duplicate_venues(venues: List[Dict]) -> List[tuple]:
    """Find potential duplicate venues based on name and location similarity."""
    duplicates = []
    
    for i, v1 in enumerate(venues):
        for v2 in venues[i+1:]:
            # Check name similarity
            name1 = v1.get('name', '').lower().strip()
            name2 = v2.get('name', '').lower().strip()
            
            # Exact match
            if name1 == name2:
                duplicates.append((v1, v2, 'exact_name'))
                continue
            
            # One name contains the other
            if name1 in name2 or name2 in name1:
                # Check if coordinates are close (within ~100m)
                if v1.get('lat') and v2.get('lat'):
                    lat_diff = abs(v1['lat'] - v2['lat'])
                    lng_diff = abs(v1['lng'] - v2['lng'])
                    
                    # ~0.001 degrees = ~100m
                    if lat_diff < 0.002 and lng_diff < 0.002:
                        duplicates.append((v1, v2, 'similar_name_close_coords'))
    
    return duplicates


def check_venue_completeness(venues: List[Dict]) -> Dict:
    """Check data completeness for each venue."""
    stats = {
        'total': len(venues),
        'missing_fields': {
            'address': 0,
            'website': 0,
            'hours': 0,
            'image_url': 0,
            'neighborhood': 0,
            'venue_type': 0,
        },
        'generic_addresses': [],
    }
    
    for venue in venues:
        # Check for missing fields
        if not venue.get('address') or venue['address'] in ['Main Street', 'Main St']:
            stats['missing_fields']['address'] += 1
            stats['generic_addresses'].append(venue['name'])
        
        if not venue.get('website'):
            stats['missing_fields']['website'] += 1
        
        if not venue.get('hours'):
            stats['missing_fields']['hours'] += 1
        
        if not venue.get('image_url'):
            stats['missing_fields']['image_url'] += 1
        
        if not venue.get('neighborhood'):
            stats['missing_fields']['neighborhood'] += 1
        
        if not venue.get('venue_type'):
            stats['missing_fields']['venue_type'] += 1
    
    return stats


def main():
    client = get_client()
    
    logger.info("=" * 70)
    logger.info("College Park Area - Data Quality Verification")
    logger.info("=" * 70)
    logger.info("")
    
    # Get all venues
    cities = ["College Park", "East Point", "Hapeville"]
    all_venues = []
    
    for city in cities:
        result = client.table("venues").select("*").eq("city", city).execute()
        all_venues.extend(result.data or [])
    
    logger.info(f"Analyzing {len(all_venues)} venues...")
    logger.info("")
    
    # Check for duplicates
    logger.info("Checking for Duplicate Venues:")
    logger.info("-" * 70)
    duplicates = check_duplicate_venues(all_venues)
    
    if duplicates:
        for v1, v2, reason in duplicates:
            logger.info(f"POTENTIAL DUPLICATE ({reason}):")
            logger.info(f"  1. {v1['name']} (ID: {v1['id']})")
            logger.info(f"     {v1.get('address', 'No address')}")
            if v1.get('lat'):
                logger.info(f"     Coords: {v1['lat']}, {v1['lng']}")
            logger.info(f"  2. {v2['name']} (ID: {v2['id']})")
            logger.info(f"     {v2.get('address', 'No address')}")
            if v2.get('lat'):
                logger.info(f"     Coords: {v2['lat']}, {v2['lng']}")
            logger.info("")
    else:
        logger.info("  No duplicates found!")
        logger.info("")
    
    # Check completeness
    logger.info("Data Completeness Analysis:")
    logger.info("-" * 70)
    stats = check_venue_completeness(all_venues)
    
    logger.info(f"Total Venues: {stats['total']}")
    logger.info("")
    logger.info("Missing Data:")
    for field, count in stats['missing_fields'].items():
        percentage = (count / stats['total']) * 100
        logger.info(f"  {field:15} : {count:3} venues ({percentage:5.1f}%)")
    
    if stats['generic_addresses']:
        logger.info("")
        logger.info("Venues with Generic/Missing Addresses:")
        for name in stats['generic_addresses']:
            logger.info(f"  - {name}")
    
    logger.info("")
    
    # List venues by type
    logger.info("Venues by Type:")
    logger.info("-" * 70)
    type_counts = {}
    for venue in all_venues:
        vtype = venue.get('venue_type') or 'unknown'
        type_counts[vtype] = type_counts.get(vtype, 0) + 1
    
    for vtype, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
        logger.info(f"  {vtype:20} : {count:3} venues")
    
    logger.info("")
    
    # Enrichment recommendations
    logger.info("Enrichment Recommendations:")
    logger.info("-" * 70)
    
    missing_website = [v for v in all_venues if not v.get('website')]
    logger.info(f"1. Run Foursquare hydration for {len(missing_website)} venues missing website/hours")
    logger.info(f"   Command: cd /Users/coach/Projects/LostCity/crawlers && python3 hydrate_venues_foursquare.py --limit {len(missing_website)}")
    logger.info("")
    
    missing_neighborhood = [v for v in all_venues if not v.get('neighborhood')]
    if missing_neighborhood:
        logger.info(f"2. Assign neighborhoods to {len(missing_neighborhood)} venues")
        logger.info(f"   Use: fix_neighborhoods.py or manual assignment")
        logger.info("")
    
    # Check for venues with events
    logger.info("Event Activity:")
    logger.info("-" * 70)

    venue_event_counts = {}
    for venue in all_venues:
        event_result = client.table("events").select("id", count="exact").eq("venue_id", venue['id']).execute()
        event_count = event_result.count or 0
        if event_count > 0:
            venue_event_counts[venue['name']] = event_count
    
    if venue_event_counts:
        logger.info("Venues with Events (sorted by count):")
        for name, count in sorted(venue_event_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            logger.info(f"  {name:40} : {count:3} events")
    else:
        logger.info("  No venues in this area have events yet")
    
    logger.info("")
    logger.info("=" * 70)
    logger.info("Verification Complete")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
