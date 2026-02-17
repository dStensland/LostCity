#!/usr/bin/env python3
"""
Register CDC Museum source in the database.
"""

from supabase import create_client
from config import get_config

def main():
    config = get_config()
    supabase = create_client(config.database.supabase_url, config.database.supabase_key)

    # Check if source exists
    result = supabase.table('sources').select('*').eq('slug', 'cdc-museum').execute()

    if result.data:
        print(f"Source already exists: {result.data[0]}")
        source_id = result.data[0]['id']

        # Update to ensure it's active and has correct metadata
        update_data = {
            'name': 'David J. Sencer CDC Museum',
            'url': 'https://www.cdc.gov/museum',
            'is_active': True,
            'owner_portal_id': '74c2f211-ee11-453d-8386-ac2861705695',  # Atlanta portal
            'source_type': 'venue',
            'crawl_frequency': 'monthly',  # Exhibitions don't change often
        }

        supabase.table('sources').update(update_data).eq('id', source_id).execute()
        print(f"Updated source {source_id}")

    else:
        print("Creating new source...")

        source_data = {
            'slug': 'cdc-museum',
            'name': 'David J. Sencer CDC Museum',
            'url': 'https://www.cdc.gov/museum',
            'is_active': True,
            'owner_portal_id': '74c2f211-ee11-453d-8386-ac2861705695',  # Atlanta portal
            'source_type': 'venue',
            'crawl_frequency': 'monthly',  # Exhibitions don't change often
        }

        result = supabase.table('sources').insert(source_data).execute()
        print(f"Created source: {result.data[0]}")

if __name__ == '__main__':
    main()
