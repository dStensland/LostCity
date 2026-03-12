"""
Register Delta Flight Museum as a source in the database.
"""

from db import get_client


ATLANTA_PORTAL_ID = "74c2f211-ee11-453d-8386-ac2861705695"


def main() -> None:
    supabase = get_client()

    venue = supabase.table("venues").select("id,name").eq("slug", "delta-flight-museum").execute()
    if not venue.data:
        print("Venue missing; crawler can still create it on first run.")

    existing = supabase.table("sources").select("*").eq("slug", "delta-flight-museum").execute()
    if existing.data:
        row = existing.data[0]
        print(f"Source already exists with ID: {row['id']}")
        print(f"Active: {row.get('is_active')}")
        return

    source_data = {
        "name": "Delta Flight Museum",
        "slug": "delta-flight-museum",
        "url": "https://www.deltamuseum.org/visit/whats-on/upcoming-events",
        "source_type": "venue",
        "is_active": True,
        "owner_portal_id": ATLANTA_PORTAL_ID,
        "crawl_frequency": "daily",
        "integration_method": "python_crawler",
    }

    result = supabase.table("sources").insert(source_data).execute()
    if result.data:
        row = result.data[0]
        print(f"Registered source: {row['name']} (ID: {row['id']})")
    else:
        print("Failed to register source")


if __name__ == "__main__":
    main()
