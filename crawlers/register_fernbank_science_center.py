"""
Register Fernbank Science Center as a source in the database.
"""

from db import get_client

def main():
    supabase = get_client()

    # Check if venue exists
    venue = supabase.table("venues").select("*").eq("slug", "fernbank-science-center").execute()
    if not venue.data:
        print("ERROR: Venue 'fernbank-science-center' (ID 225) must exist first")
        return

    venue_id = venue.data[0]["id"]
    print(f"Found venue: {venue.data[0]['name']} (ID: {venue_id})")
    print(f"Venue type: {venue.data[0].get('venue_type', 'N/A')}")

    # Check if source already exists
    existing = supabase.table("sources").select("*").eq("slug", "fernbank-science-center").execute()
    if existing.data:
        print(f"Source already exists with ID: {existing.data[0]['id']}")
        print(f"Active: {existing.data[0]['is_active']}")
        return

    # Register the source
    source_data = {
        "name": "Fernbank Science Center",
        "slug": "fernbank-science-center",
        "url": "http://www.fernbank.edu",
        "source_type": "venue",  # Single venue source
        "is_active": True,
        "owner_portal_id": "74c2f211-ee11-453d-8386-ac2861705695",  # Atlanta portal
        "crawl_frequency": "daily",
        "integration_method": "python_crawler",
    }

    result = supabase.table("sources").insert(source_data).execute()

    if result.data:
        print(f"Successfully registered source: {result.data[0]['name']}")
        print(f"Source ID: {result.data[0]['id']}")
        print(f"Active: {result.data[0]['is_active']}")
    else:
        print("Failed to register source")

if __name__ == "__main__":
    main()
