"""
Add Barnes & Noble Atlanta source to database.
"""

from db import get_client, get_source_by_slug

def add_barnes_noble_source():
    """Add Barnes & Noble Atlanta as a source."""
    client = get_client()

    slug = "barnes-noble-atlanta"

    # Check if source already exists
    try:
        existing = get_source_by_slug(slug)
        if existing:
            print(f"Source with slug '{slug}' already exists: {existing}")
            return
    except Exception:
        # Source doesn't exist, continue to create it
        pass

    # Insert new source
    print("Creating new Barnes & Noble Atlanta source")
    result = client.table("sources").insert({
        "name": "Barnes & Noble Atlanta",
        "slug": slug,
        "url": "https://stores.barnesandnoble.com",
        "source_type": "scrape",
        "is_active": True,
        "crawl_frequency": "daily"
    }).execute()

    source_id = result.data[0]["id"]
    print(f"Created source ID {source_id}")

if __name__ == "__main__":
    add_barnes_noble_source()
