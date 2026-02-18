"""
Register government meeting sources in the database.

Creates source records for:
- Fulton County Government Meetings
- DeKalb County Government Meetings
- City of Atlanta Government Meetings
"""

import sys
from supabase import create_client
from config import get_config

config = get_config()
supabase = create_client(config.database.supabase_url, config.database.supabase_service_key)

portal_result = supabase.table("portals").select("id").eq("slug", "atlanta").limit(1).execute()
ATLANTA_PORTAL_ID = portal_result.data[0]["id"] if portal_result.data else None
if ATLANTA_PORTAL_ID is None:
    raise RuntimeError("Atlanta portal not found; cannot register government sources with owner_portal_id.")


def register_source(slug: str, name: str, url: str):
    """Register a source in the database."""
    # Check if source already exists
    existing = supabase.table("sources").select("*").eq("slug", slug).execute()

    if existing.data:
        print(f"✓ Source '{slug}' already exists (ID: {existing.data[0]['id']})")

        # Update to ensure it's active
        supabase.table("sources").update({
            "is_active": True,
            "url": url,
            "owner_portal_id": ATLANTA_PORTAL_ID,
        }).eq("slug", slug).execute()

        print(f"  → Updated source to active")
        return existing.data[0]['id']

    # Create new source
    source_data = {
        "slug": slug,
        "name": name,
        "url": url,
        "is_active": True,
        "source_type": "government",
        "owner_portal_id": ATLANTA_PORTAL_ID,
    }

    result = supabase.table("sources").insert(source_data).execute()

    if result.data:
        print(f"✓ Created source '{slug}' (ID: {result.data[0]['id']})")
        return result.data[0]['id']
    else:
        print(f"✗ Failed to create source '{slug}'")
        return None


def main():
    """Register all government meeting sources."""
    print("Registering government meeting sources...\n")

    sources = [
        {
            "slug": "fulton-county-meetings",
            "name": "Fulton County Government Meetings",
            "url": "https://fulton.legistar.com/Calendar.aspx",
        },
        {
            "slug": "dekalb-county-meetings",
            "name": "DeKalb County Government Meetings",
            "url": "https://dekalbcountyga.legistar.com/Calendar.aspx",
        },
        {
            "slug": "atlanta-city-meetings",
            "name": "City of Atlanta Government Meetings",
            "url": "https://atlanta.legistar.com/Calendar.aspx",
        },
    ]

    for source in sources:
        register_source(**source)
        print()

    print("Done! You can now run the crawlers with:")
    print("  python main.py --source fulton-county-meetings")
    print("  python main.py --source dekalb-county-meetings")
    print("  python main.py --source atlanta-city-meetings")


if __name__ == "__main__":
    main()
