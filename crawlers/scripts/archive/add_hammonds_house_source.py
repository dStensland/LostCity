"""
Add Hammonds House Museum as a source to the database.
"""

from db import get_client

def add_source():
    client = get_client()

    # Check if source already exists
    existing = client.table("sources").select("*").eq("slug", "hammonds-house-museum").execute()

    if existing.data:
        print(f"Source already exists: {existing.data[0]}")
        return existing.data[0]

    # Insert new source
    source_data = {
        "slug": "hammonds-house-museum",
        "name": "Hammonds House Museum",
        "source_type": "scrape",
        "url": "https://www.hammondshousemuseum.org/",
        "is_active": True,
        "owner_portal_id": None,  # Atlanta is the default portal
        "crawl_frequency": "weekly",
        "integration_method": "playwright",
    }

    result = client.table("sources").insert(source_data).execute()

    if result.data:
        print(f"Source created successfully: {result.data[0]}")
        return result.data[0]
    else:
        print(f"Failed to create source")
        return None

if __name__ == "__main__":
    add_source()
