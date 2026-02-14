#!/usr/bin/env python3
"""
Import healthcare support and wellness venues near Emory Healthcare campuses.

Includes Emory facilities, fitness centers, mental health resources, and labs/imaging
centers serving patients, caregivers, and the community.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_emory_wellness_support.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

EMORY_SUPPORT_FACILITIES = [
    {
        "name": "Winship Cancer Institute of Emory University",
        "slug": "winship-cancer-institute",
        "address": "1365 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7925,
        "lng": -84.3210,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://winshipcancer.emory.edu",
    },
    {
        "name": "Emory Clinic Building A",
        "slug": "emory-clinic-building-a",
        "address": "1365 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7920,
        "lng": -84.3200,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.emoryhealthcare.org",
    },
    {
        "name": "Emory Brain Health Center",
        "slug": "emory-brain-health-center",
        "address": "12 Executive Park Dr NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.7985,
        "lng": -84.3315,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.emoryhealthcare.org/centers-programs/brain-health/index.html",
    },
    {
        "name": "Emory Rehabilitation Hospital",
        "slug": "emory-rehabilitation-hospital",
        "address": "1441 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7935,
        "lng": -84.3195,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.emoryhealthcare.org/locations/hospitals/emory-rehabilitation-hospital/index.html",
    },
    {
        "name": "Emory Eye Center",
        "slug": "emory-eye-center",
        "address": "1365B Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7922,
        "lng": -84.3205,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.emoryhealthcare.org/centers-programs/eye-center/index.html",
    },
]

FITNESS_CENTERS = [
    {
        "name": "Emory Wellness Center",
        "slug": "emory-wellness-center",
        "address": "1525 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7940,
        "lng": -84.3180,
        "venue_type": "fitness_center",
        "spot_type": "fitness_center",
        "website": "https://campuslife.emory.edu/support/wellness/index.html",
    },
    {
        "name": "WoodPEC (Woodruff Physical Education Center)",
        "slug": "woodpec",
        "address": "26 Eagle Row",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7905,
        "lng": -84.3175,
        "venue_type": "fitness_center",
        "spot_type": "fitness_center",
        "website": "https://campuslife.emory.edu/programs_services/woodpec/index.html",
    },
    {
        "name": "LA Fitness Toco Hills",
        "slug": "la-fitness-toco-hills",
        "address": "2911 N Druid Hills Rd",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8145,
        "lng": -84.3135,
        "venue_type": "fitness_center",
        "spot_type": "fitness_center",
        "website": "https://www.lafitness.com",
    },
    {
        "name": "YMCA Decatur",
        "slug": "ymca-decatur",
        "address": "1100 Clairemont Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7815,
        "lng": -84.2880,
        "venue_type": "fitness_center",
        "spot_type": "fitness_center",
        "website": "https://www.ymcaatlanta.org/locations/decatur-family-ymca",
    },
    {
        "name": "Lifetime Fitness Sandy Springs",
        "slug": "lifetime-fitness-sandy-springs",
        "address": "600 Mt Vernon Hwy",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9250,
        "lng": -84.3580,
        "venue_type": "fitness_center",
        "spot_type": "fitness_center",
        "website": "https://www.lifetime.life/life-time-locations/ga-sandy-springs.html",
    },
    {
        "name": "Orangetheory Fitness Johns Creek",
        "slug": "orangetheory-fitness-johns-creek",
        "address": "10900 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0530,
        "lng": -84.1680,
        "venue_type": "fitness_center",
        "spot_type": "fitness_center",
        "website": "https://www.orangetheory.com",
    },
]

MENTAL_HEALTH_RESOURCES = [
    {
        "name": "Emory Student Counseling Center",
        "slug": "emory-student-counseling-center",
        "address": "1462 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7930,
        "lng": -84.3190,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://counseling.emory.edu",
    },
    {
        "name": "NAMI Georgia Office",
        "slug": "nami-georgia-office",
        "address": "3050 Presidential Dr",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30340",
        "lat": 33.8800,
        "lng": -84.2650,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.namiga.org",
    },
    {
        "name": "Ridgeview Institute",
        "slug": "ridgeview-institute",
        "address": "3995 S Cobb Dr",
        "neighborhood": "Smyrna",
        "city": "Smyrna",
        "state": "GA",
        "zip": "30080",
        "lat": 33.8545,
        "lng": -84.5190,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.ridgeviewinstitute.com",
    },
]

LABS_IMAGING = [
    {
        "name": "Quest Diagnostics Druid Hills",
        "slug": "quest-diagnostics-druid-hills",
        "address": "1945 Cliff Valley Way",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8020,
        "lng": -84.3230,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.questdiagnostics.com",
    },
    {
        "name": "LabCorp N Decatur",
        "slug": "labcorp-n-decatur",
        "address": "2801 N Decatur Rd",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.8015,
        "lng": -84.2945,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.labcorp.com",
    },
    {
        "name": "Quest Diagnostics Sandy Springs",
        "slug": "quest-diagnostics-sandy-springs",
        "address": "5673 Peachtree Dunwoody Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30342",
        "lat": 33.9078,
        "lng": -84.3520,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.questdiagnostics.com",
    },
    {
        "name": "Quest Diagnostics Johns Creek",
        "slug": "quest-diagnostics-johns-creek",
        "address": "10700 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0512,
        "lng": -84.1648,
        "venue_type": "venue",
        "spot_type": "essentials",
        "website": "https://www.questdiagnostics.com",
    },
]

ALL_VENUES = (
    EMORY_SUPPORT_FACILITIES
    + FITNESS_CENTERS
    + MENTAL_HEALTH_RESOURCES
    + LABS_IMAGING
)


def main():
    """Import Emory wellness and support venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Emory Healthcare Wellness & Support Venues")
    logger.info("=" * 60)
    logger.info(f"Processing {len(ALL_VENUES)} venues...")
    logger.info("")

    for venue in ALL_VENUES:
        existing = get_venue_by_slug(venue["slug"])
        if existing:
            logger.info(f"  SKIP: {venue['name']} (already exists)")
            skipped += 1
            continue

        try:
            venue_id = get_or_create_venue(venue)
            logger.info(f"  ADD:  {venue['name']} -> ID {venue_id}")
            added += 1
        except Exception as e:
            logger.error(f"  ERROR: {venue['name']}: {e}")

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Done! Added {added} venues, skipped {skipped} existing.")
    logger.info(f"Total: {len(ALL_VENUES)} wellness & support venues")
    logger.info("")
    logger.info("Categories:")
    logger.info(f"  - Emory Support Facilities: {len(EMORY_SUPPORT_FACILITIES)}")
    logger.info(f"  - Fitness Centers: {len(FITNESS_CENTERS)}")
    logger.info(f"  - Mental Health Resources: {len(MENTAL_HEALTH_RESOURCES)}")
    logger.info(f"  - Labs & Imaging: {len(LABS_IMAGING)}")


if __name__ == "__main__":
    main()
