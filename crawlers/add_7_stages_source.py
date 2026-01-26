"""
Add or update 7 Stages source in database.
"""

from db import get_client, get_source_by_slug

def add_7_stages_source():
    """Add 7 Stages as a source with the correct slug."""
    client = get_client()

    # Check if source already exists with old slug
    result = client.table("sources").select("*").eq("name", "7 Stages").execute()

    if result.data:
        existing = result.data[0]
        source_id = existing["id"]
        old_slug = existing["slug"]

        if old_slug != "7-stages":
            print(f"Updating slug from '{old_slug}' to '7-stages'")
            client.table("sources").update({
                "slug": "7-stages"
            }).eq("id", source_id).execute()
            print(f"Updated source ID {source_id}")
        else:
            print(f"Source already exists with correct slug: {old_slug} (ID: {source_id})")
    else:
        # Check if 7-stages slug already exists
        existing_slug = get_source_by_slug("7-stages")
        if existing_slug:
            print(f"Source with slug '7-stages' already exists: {existing_slug}")
        else:
            # Insert new source
            print("Creating new 7 Stages source")
            result = client.table("sources").insert({
                "name": "7 Stages",
                "slug": "7-stages",
                "website": "https://www.7stages.org",
                "source_type": "venue",
                "is_active": True,
                "description": "Renowned Atlanta theater company in Little Five Points featuring contemporary and experimental works",
                "crawl_frequency": "daily"
            }).execute()
            source_id = result.data[0]["id"]
            print(f"Created source ID {source_id}")

if __name__ == "__main__":
    add_7_stages_source()
