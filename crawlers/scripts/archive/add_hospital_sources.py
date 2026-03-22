"""
Add new hospital system crawlers to the sources table.
"""

from db import get_client

client = get_client()

sources = [
    {
        "slug": "nghs-community-events",
        "name": "Northeast Georgia Health System Community Events",
        "url": "https://events.nghs.com",
        "source_type": "venue",
        "is_active": True,
        "owner_portal_id": "fba590ce-85ca-41fb-a50f-fdd36af2b5b0",  # Emory Healthcare portal
        "is_sensitive": False,
    },
    {
        "slug": "adventhealth-georgia",
        "name": "AdventHealth Georgia Community Events",
        "url": "https://www.adventhealth.com/events",
        "source_type": "venue",
        "is_active": True,
        "owner_portal_id": "fba590ce-85ca-41fb-a50f-fdd36af2b5b0",  # Emory Healthcare portal
        "is_sensitive": False,
    },
]

for source in sources:
    print(f"Adding source: {source['slug']}")
    try:
        result = client.table("sources").insert(source).execute()
        print(f"  ✓ Created: {result.data[0]['id']}")
    except Exception as e:
        print(f"  ✗ Error: {e}")
