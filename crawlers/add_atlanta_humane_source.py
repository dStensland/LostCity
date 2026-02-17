"""
Add Atlanta Humane Society crawler to the sources table.
Fetches events from Eventbrite organizer ID 12003007997.
"""

from db import get_client

client = get_client()

source = {
    "slug": "atlanta-humane-society",
    "name": "Atlanta Humane Society",
    "url": "https://atlantahumane.org",
    "source_type": "venue",
    "is_active": True,
    "is_sensitive": False,
}

print(f"Adding source: {source['slug']}")
try:
    # Check if it already exists
    existing = client.table("sources").select("*").eq("slug", source["slug"]).execute()
    if existing.data:
        print(f"  ℹ Source already exists with ID: {existing.data[0]['id']}")
        print(f"  Current is_active: {existing.data[0]['is_active']}")
        if not existing.data[0]['is_active']:
            print("  Activating source...")
            client.table("sources").update({"is_active": True}).eq("slug", source["slug"]).execute()
            print("  ✓ Source activated")
    else:
        result = client.table("sources").insert(source).execute()
        print(f"  ✓ Created: {result.data[0]['id']}")
except Exception as e:
    print(f"  ✗ Error: {e}")
