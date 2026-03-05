"""
Add Sandler Hudson Gallery as a source.
"""

from supabase import create_client
from config import get_config

config = get_config()
db_config = config.database
supabase = create_client(db_config.supabase_url, db_config.supabase_service_key)

# Get the venue ID
venue_result = supabase.table('venues').select('id').eq('slug', 'sandler-hudson-gallery').execute()
if not venue_result.data:
    print("ERROR: Venue 'sandler-hudson-gallery' not found")
    exit(1)

venue_id = venue_result.data[0]['id']
print(f"Found venue ID: {venue_id}")

# Check if source already exists
existing = supabase.table('sources').select('id,slug').eq('slug', 'sandler-hudson-gallery').execute()
if existing.data:
    print(f"Source already exists: {existing.data[0]}")
    exit(0)

# Get Atlanta portal ID
portal_result = supabase.table('portals').select('id').eq('slug', 'atlanta').execute()
if not portal_result.data:
    print("ERROR: Atlanta portal not found")
    exit(1)

portal_id = portal_result.data[0]['id']

# Create the source
source_data = {
    'name': 'Sandler Hudson Gallery',
    'slug': 'sandler-hudson-gallery',
    'url': 'http://www.sandlerhudson.com/exhibitions-2',
    'owner_portal_id': portal_id,
    'is_active': True,
    'source_type': 'scrape',
    'integration_method': 'html',
    'crawl_frequency': 'weekly',
}

result = supabase.table('sources').insert(source_data).execute()

if result.data:
    print(f"\nSuccessfully created source:")
    print(f"  ID: {result.data[0]['id']}")
    print(f"  Name: {result.data[0]['name']}")
    print(f"  Slug: {result.data[0]['slug']}")
    print(f"  Active: {result.data[0]['is_active']}")
    print(f"\nRun: python main.py --source sandler-hudson-gallery")
else:
    print("ERROR: Failed to create source")
    exit(1)
