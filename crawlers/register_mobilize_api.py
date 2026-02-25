#!/usr/bin/env python3
"""
Register the new mobilize-api source in the database.
This source replaces the slow per-org Playwright crawlers with a single API aggregator.
"""

from db import get_client, get_portal_id_by_slug

def register_mobilize_api_source():
    """Register mobilize-api source in the sources table."""
    client = get_client()
    atlanta_portal_id = get_portal_id_by_slug("atlanta")
    if not atlanta_portal_id:
        raise RuntimeError("Atlanta portal not found; cannot set owner_portal_id for mobilize-api")

    # Check if source already exists
    existing = client.table("sources").select("*").eq("slug", "mobilize-api").execute()

    if existing.data:
        print(f"Source 'mobilize-api' already exists (ID: {existing.data[0]['id']})")
        print("Updating to ensure it's active...")
        client.table("sources").update({
            "is_active": True,
            "url": "https://api.mobilize.us/v1/events",
            "source_type": "aggregator",
            "integration_method": "api",
            "crawl_frequency": "daily",
            "owner_portal_id": atlanta_portal_id,
        }).eq("slug", "mobilize-api").execute()
        print("✓ Updated mobilize-api source")
    else:
        # Insert new source
        result = client.table("sources").insert({
            "name": "Mobilize (API)",
            "slug": "mobilize-api",
            "url": "https://api.mobilize.us/v1/events",
            "source_type": "aggregator",
            "integration_method": "api",
            "crawl_frequency": "daily",
            "is_active": True,
            "owner_portal_id": atlanta_portal_id,
        }).execute()

        print(f"✓ Registered new source 'mobilize-api' (ID: {result.data[0]['id']})")

    print("\nYou can now run the crawler with:")
    print("  python main.py --source mobilize-api --verbose")

if __name__ == "__main__":
    register_mobilize_api_source()
