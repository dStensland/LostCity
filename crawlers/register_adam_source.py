#!/usr/bin/env python3
"""
Register the ADAM ATL source in the database.
"""

from config import get_config
from supabase import create_client

config = get_config()
supabase = create_client(config.database.supabase_url, config.database.supabase_service_key)

# Check if source already exists
result = supabase.table('sources').select('id, slug').eq('slug', 'adam-atl').execute()

if result.data:
    print(f"Source already exists: {result.data[0]}")
    source_id = result.data[0]['id']
else:
    # Get the venue ID for ADAM ATL
    venue_result = supabase.table('venues').select('id').eq('id', 2433).execute()
    if not venue_result.data:
        print("ERROR: Venue ID 2433 (ADAM ATL) not found!")
        exit(1)

    venue_id = venue_result.data[0]['id']

    # Get Atlanta portal UUID
    portal_result = supabase.table('portals').select('id').eq('slug', 'atlanta').execute()
    if not portal_result.data:
        print("ERROR: Atlanta portal not found!")
        exit(1)

    atlanta_portal_id = portal_result.data[0]['id']

    # Insert new source
    source_data = {
        "name": "ADAM ATL",
        "slug": "adam-atl",
        "url": "https://www.adamatl.org/events",
        "organization_id": None,  # Only set for non-venue sources
        "source_type": "scrape",
        "is_active": True,
        "crawl_frequency": "daily",
        "owner_portal_id": atlanta_portal_id,
    }

    result = supabase.table('sources').insert(source_data).execute()
    source_id = result.data[0]['id']
    print(f"Created new source: {result.data[0]}")

print(f"\nSource registered with ID: {source_id}")
print("Run with: python main.py --source adam-atl")
