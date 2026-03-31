"""
Register civic engagement organization sources in the database.

These sources fill gaps in activism and civic engagement coverage:
- League of Women Voters of Atlanta-Fulton County
- Center for Civic Innovation
- Georgia Equality

All civic sources are owned by the HelpATL portal.
"""

from supabase import create_client
from config import config
from db import get_portal_id_by_slug

# Get Supabase credentials from config
url = config.database.supabase_url
key = config.database.supabase_service_key

if not url or not key:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    exit(1)

supabase = create_client(url, key)

helpatl_portal_id = get_portal_id_by_slug("helpatl")
if not helpatl_portal_id:
    print("Error: HelpATL portal not found")
    exit(1)

sources = [
    {
        "slug": "lwv-atlanta",
        "name": "League of Women Voters of Atlanta-Fulton County",
        "url": "https://lwvaf.org/calendar",
        "is_active": True,
        "crawl_frequency": "daily",
        "source_type": "civic_organization",
        "integration_method": "playwright",
        "owner_portal_id": helpatl_portal_id,
    },
    {
        "slug": "civic-innovation-atl",
        "name": "Center for Civic Innovation",
        "url": "https://civicatlanta.org/events",
        "is_active": True,
        "crawl_frequency": "daily",
        "source_type": "civic_organization",
        "integration_method": "playwright",
        "owner_portal_id": helpatl_portal_id,
    },
    {
        "slug": "georgia-equality",
        "name": "Georgia Equality",
        "url": "https://georgiaequality.org/communitycalendar/",
        "is_active": True,
        "crawl_frequency": "daily",
        "source_type": "civic_organization",
        "integration_method": "ical",
        "owner_portal_id": helpatl_portal_id,
    },
]

print("Registering civic engagement sources...")

for source in sources:
    # Check if source already exists
    existing = supabase.table("sources").select("*").eq("slug", source["slug"]).execute()

    if existing.data:
        # Update existing
        result = supabase.table("sources").update(source).eq("slug", source["slug"]).execute()
        print(f"✓ Updated: {source['name']}")
    else:
        # Insert new
        result = supabase.table("sources").insert(source).execute()
        print(f"✓ Created: {source['name']}")

print("\nAll civic sources registered successfully!")
print("\nTest crawlers with:")
print("  python3 main.py --source lwv-atlanta")
print("  python3 main.py --source civic-innovation-atl")
print("  python3 main.py --source georgia-equality")
