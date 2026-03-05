#!/usr/bin/env python3
"""
Add City of College Park source to the database.
Run from crawlers directory: python3 add_college_park_source.py
"""

from db import get_client

def main():
    client = get_client()

    source = {
        "name": "City of College Park",
        "slug": "college-park-city",
        "url": "https://www.collegeparkga.gov/calendar.aspx",
        "source_type": "scrape",
        "crawl_frequency": "daily",
    }

    # Check if source already exists
    existing = client.table("sources").select("id").eq("slug", source["slug"]).execute()
    if existing.data and len(existing.data) > 0:
        print(f"Source already exists: {source['name']}")
        return

    # Insert new source
    try:
        result = client.table("sources").insert(source).execute()
        print(f"Successfully added source: {source['name']}")
        print(f"Source ID: {result.data[0]['id']}")
    except Exception as e:
        print(f"Error adding source: {e}")

if __name__ == "__main__":
    main()
