#!/usr/bin/env python3
"""
Import College Park community organizations and event producers.

This script adds key organizations in College Park that host events, community programs,
and activities. Organizations are stored in the organizations table with appropriate
categorization for future crawling.

Usage:
    python import_college_park_orgs.py              # Import all organizations
    python import_college_park_orgs.py --dry-run    # Preview without changes
"""

import argparse
import logging
from typing import Optional
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# College Park Organizations
# These are categorized as event_producers since they host programs and events
COLLEGE_PARK_ORGANIZATIONS = [
    # ============================================
    # KEY EVENT VENUES
    # ============================================
    {
        "id": "college-park-main-street",
        "name": "College Park Main Street Association",
        "slug": "college-park-main-street",
        "org_type": "business_improvement_district",
        "website": "https://www.collegeparkmainstreet.org",
        "categories": ["community", "festival", "art"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Downtown revitalization organization that hosts festivals, farmers markets, and community events on Main Street.",
        "events_url": "https://www.collegeparkmainstreet.org/events",
    },
    {
        "id": "pushpush-arts",
        "name": "PushPush Arts",
        "slug": "pushpush-arts",
        "org_type": "arts_nonprofit",
        "website": "https://www.pushpusharts.com",
        "categories": ["art", "learning", "community"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Artist center and creative space offering workshops, exhibitions, and artist residencies in College Park.",
        "events_url": "https://www.pushpusharts.com/calendar",
    },
    {
        "id": "south-fulton-arts-center",
        "name": "South Fulton Arts Center",
        "slug": "south-fulton-arts-center",
        "org_type": "arts_nonprofit",
        "website": "https://southfultonarts.org",
        "categories": ["art", "learning", "family", "music"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Community arts center offering classes, performances, and cultural programming for all ages in South Fulton.",
        "events_url": "https://southfultonarts.org/events",
    },
    # ============================================
    # CIVIC & COMMUNITY ORGANIZATIONS
    # ============================================
    {
        "id": "historic-college-park-neighborhood",
        "name": "Historic College Park Neighborhood Association",
        "slug": "historic-college-park-neighborhood",
        "org_type": "neighborhood_association",
        "website": "https://www.historiccollegepark.org",
        "categories": ["community", "neighborhood"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Neighborhood association serving College Park residents with community meetings and civic engagement opportunities.",
    },
    {
        "id": "atl-airport-district",
        "name": "ATL Airport District",
        "slug": "atl-airport-district",
        "org_type": "tourism_organization",
        "website": "https://atlairdist.com",
        "categories": ["community", "tours", "learning"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Tri-city tourism organization promoting events and attractions in College Park, East Point, and Hapeville.",
        "events_url": "https://atlairdist.com/events",
    },
    {
        "id": "college-park-historical-society",
        "name": "College Park Historical Society",
        "slug": "college-park-historical-society",
        "org_type": "historical_society",
        "website": None,
        "categories": ["community", "learning", "tours"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Preservation and education organization focused on College Park's history and heritage.",
    },
    # ============================================
    # CITY RECREATION & CULTURAL PROGRAMS
    # ============================================
    {
        "id": "college-park-recreation",
        "name": "City of College Park Recreation & Cultural Arts",
        "slug": "college-park-recreation",
        "org_type": "municipal_recreation",
        "website": "https://collegeparkga.com/departments/recreation",
        "categories": ["community", "fitness", "family", "learning"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "City of College Park's recreation department offering classes, sports leagues, and community programs.",
        "events_url": "https://collegeparkga.com/calendar",
    },
    {
        "id": "brady-recreation-center",
        "name": "Brady Recreation Center",
        "slug": "brady-recreation-center",
        "org_type": "recreation_center",
        "website": "https://collegeparkga.com/facilities/brady-recreation-center",
        "categories": ["fitness", "family", "sports"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Community recreation center in College Park offering fitness classes, sports programs, and family activities.",
    },
    {
        "id": "tracey-wyatt-recreation-complex",
        "name": "Tracey Wyatt Recreation Complex",
        "slug": "tracey-wyatt-recreation-complex",
        "org_type": "recreation_center",
        "website": "https://collegeparkga.com/facilities/tracey-wyatt-recreation-complex",
        "categories": ["fitness", "sports", "family"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Large recreation complex in College Park with athletic fields, fitness facilities, and community programming.",
    },
    # ============================================
    # FAITH-BASED COMMUNITY ORGANIZATIONS
    # ============================================
    {
        "id": "college-park-united-methodist",
        "name": "College Park United Methodist Church",
        "slug": "college-park-united-methodist",
        "org_type": "religious_nonprofit",
        "website": "https://cpumc.net",
        "categories": ["community", "volunteer", "family"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Active United Methodist church hosting community meals, outreach programs, and family events in College Park.",
        "events_url": "https://cpumc.net/calendar",
    },
    {
        "id": "providence-baptist-college-park",
        "name": "Providence Baptist Church",
        "slug": "providence-baptist-college-park",
        "org_type": "religious_nonprofit",
        "website": "https://providencebaptistchurch.net",
        "categories": ["community", "family", "tours"],
        "neighborhood": "College Park",
        "city": "College Park",
        "description": "Baptist church with active community programming including group trips, senior activities, and family events.",
        "events_url": "https://providencebaptistchurch.net/events",
    },
]


def check_table_exists(client, table_name: str) -> bool:
    """Check if a table exists by trying to query it."""
    try:
        client.table(table_name).select("*").limit(1).execute()
        return True
    except Exception:
        return False


def get_or_create_organization(
    org: dict, dry_run: bool = False
) -> tuple[Optional[str], str]:
    """
    Get existing organization or create new one.
    Returns tuple of (organization_id, status) where status is "exists", "added", or "failed".
    """
    client = get_client()

    # Check if exists by id
    try:
        existing = (
            client.table("organizations").select("id").eq("id", org["id"]).execute()
        )
        if existing.data:
            logger.info(f"  [EXISTS] {org['name']}")
            return (org["id"], "exists")
    except Exception as e:
        logger.debug(f"  Error checking for {org['id']}: {e}")

    # Check if exists by slug
    try:
        existing = (
            client.table("organizations").select("id").eq("slug", org["slug"]).execute()
        )
        if existing.data:
            logger.info(f"  [EXISTS] {org['name']} (by slug)")
            return (existing.data[0]["id"], "exists")
    except Exception as e:
        logger.debug(f"  Error checking slug for {org['slug']}: {e}")

    # Create new organization
    if dry_run:
        logger.info(f"  [DRY RUN] Would create: {org['name']}")
        return (org["id"], "added")

    try:
        result = client.table("organizations").insert(org).execute()
        logger.info(f"  [ADDED] {org['name']}")
        return (result.data[0]["id"], "added")
    except Exception as e:
        logger.error(f"  [ERROR] {org['name']}: {e}")
        return (None, "failed")


def import_organizations(dry_run: bool = False) -> dict:
    """Import all College Park organizations."""
    client = get_client()

    # Verify table exists
    if not check_table_exists(client, "organizations"):
        logger.error("\nERROR: organizations table doesn't exist.")
        logger.error(
            "Please run migrations 010_content_expansion.sql and 086_producer_to_organization_rename.sql first."
        )
        return {"added": 0, "existing": 0, "failed": 0}

    logger.info("\n" + "=" * 70)
    logger.info("IMPORTING COLLEGE PARK ORGANIZATIONS")
    logger.info("=" * 70)
    logger.info(f"\nTotal organizations to process: {len(COLLEGE_PARK_ORGANIZATIONS)}")
    if dry_run:
        logger.info("\n*** DRY RUN MODE - No changes will be made ***\n")

    stats = {"added": 0, "existing": 0, "failed": 0}

    # Group by category for organized output
    categories = {
        "Event Venues": [],
        "Civic & Community": [],
        "City Recreation": [],
        "Faith-Based": [],
    }

    for org in COLLEGE_PARK_ORGANIZATIONS:
        if (
            "main-street" in org["slug"]
            or "pushpush" in org["slug"]
            or "arts-center" in org["slug"]
        ):
            categories["Event Venues"].append(org)
        elif "recreation" in org["slug"] or "complex" in org["slug"]:
            categories["City Recreation"].append(org)
        elif (
            "church" in org["slug"]
            or "baptist" in org["slug"]
            or "methodist" in org["slug"]
        ):
            categories["Faith-Based"].append(org)
        else:
            categories["Civic & Community"].append(org)

    # Process each category
    for category_name, orgs in categories.items():
        if not orgs:
            continue

        logger.info(f"\n--- {category_name.upper()} ({len(orgs)}) ---")
        for org in orgs:
            org_id, status = get_or_create_organization(org, dry_run)

            if status == "exists":
                stats["existing"] += 1
            elif status == "added":
                stats["added"] += 1
            else:
                stats["failed"] += 1

    # Summary
    logger.info("\n" + "=" * 70)
    logger.info("IMPORT COMPLETE")
    logger.info("=" * 70)
    logger.info(f"Added:    {stats['added']}")
    logger.info(f"Existing: {stats['existing']}")
    logger.info(f"Failed:   {stats['failed']}")
    logger.info("=" * 70)

    return stats


def link_organizations_to_venues(dry_run: bool = False):
    """
    Link organizations to their physical venue locations where applicable.
    Some organizations have venues associated with them (e.g., PushPush Arts has a venue).
    """
    client = get_client()

    logger.info("\n" + "=" * 70)
    logger.info("LINKING ORGANIZATIONS TO VENUES")
    logger.info("=" * 70)

    # Mappings of organization_id to venue_slug
    organization_venue_links = [
        ("pushpush-arts", "pushpush-theater"),  # PushPush Arts venue already exists
        # Add more as needed
    ]

    linked = 0
    for organization_id, venue_slug in organization_venue_links:
        try:
            # Check if venue exists
            venue = (
                client.table("venues")
                .select("id, name")
                .eq("slug", venue_slug)
                .execute()
            )
            if not venue.data:
                logger.warning(f"  [SKIP] Venue {venue_slug} not found")
                continue

            venue_name = venue.data[0]["name"]

            if dry_run:
                logger.info(f"  [DRY RUN] Would link {organization_id} -> {venue_name}")
                continue

            # Update venue to link to organization
            client.table("venues").update({"organization_id": organization_id}).eq(
                "slug", venue_slug
            ).execute()
            logger.info(f"  [LINKED] {organization_id} -> {venue_name}")
            linked += 1

        except Exception as e:
            logger.error(f"  [ERROR] Failed to link {organization_id}: {e}")

    logger.info(f"\nLinked {linked} venue(s) to organizations")


def main():
    parser = argparse.ArgumentParser(
        description="Import College Park community organizations and event producers"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying the database",
    )
    parser.add_argument(
        "--link-venues",
        action="store_true",
        help="Also link organizations to their venue locations",
    )
    args = parser.parse_args()

    # Import organizations
    import_organizations(dry_run=args.dry_run)

    # Optionally link to venues
    if args.link_venues:
        link_organizations_to_venues(dry_run=args.dry_run)

    logger.info("")


if __name__ == "__main__":
    main()
