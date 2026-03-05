#!/usr/bin/env python3
"""
Fix Spelman College Museum of Fine Art exhibition data.

Task 1: Add "Repossessions" exhibition
Task 2: Fix "Calida Rawles: Away with the Tides" end_date to 2026-09-05
"""

import sys
from supabase import create_client
from config import get_config
from db import insert_event
from dedupe import generate_content_hash

# Constants
VENUE_ID = 852
SOURCE_ID = 261
VENUE_NAME = "Spelman College Museum of Fine Art"


def task1_add_repossessions():
    """Add the Repossessions exhibition event."""
    print("\n=== Task 1: Adding 'Repossessions' exhibition ===")

    # Generate content hash
    content_hash = generate_content_hash(
        "Repossessions",
        VENUE_NAME,
        "2025-10-17"
    )
    print(f"Generated content_hash: {content_hash}")

    # Prepare event data
    event_data = {
        "title": "Repossessions",
        "description": "Six Black artists, commissioned by The Reparations Project, created works drawing from objects and documents tied to enslavement and the Jim Crow era in the U.S.",
        "start_date": "2025-10-17",
        "end_date": "2026-05-01",
        "venue_id": VENUE_ID,
        "source_id": SOURCE_ID,
        "category": "art",
        "tags": ["art", "exhibition", "spelman", "hbcu"],
        "is_free": True,
        "is_all_day": True,
        "source_url": "https://www.spelman.edu/museum-of-fine-art/art-and-events/exhibitions/index.html",
        "content_hash": content_hash,
        "extraction_confidence": 0.95,
    }

    # Note: No series_hint for exhibitions - they're typically one-time events
    # Valid series types are: film, recurring_show, class_series, festival_program

    try:
        event_id = insert_event(event_data)
        print(f"✅ Successfully inserted 'Repossessions' exhibition with event_id: {event_id}")
        return event_id
    except Exception as e:
        print(f"❌ Error inserting Repossessions: {e}")
        return None


def task2_fix_calida_rawles_end_date():
    """Fix the end_date for Calida Rawles exhibition."""
    print("\n=== Task 2: Fixing 'Calida Rawles: Away with the Tides' end_date ===")

    config = get_config()
    client = create_client(config.database.supabase_url, config.database.supabase_service_key)

    # Find the event
    print(f"Searching for Calida Rawles exhibition at venue_id {VENUE_ID}...")
    result = client.table("events").select("*").eq("venue_id", VENUE_ID).ilike("title", "%Calida Rawles%").execute()

    if not result.data:
        print("❌ No Calida Rawles event found at venue_id 852")
        return None

    if len(result.data) > 1:
        print(f"⚠️ Warning: Found {len(result.data)} matching events. Using first one.")

    event = result.data[0]
    event_id = event["id"]
    old_end_date = event.get("end_date")

    print(f"Found event_id: {event_id}")
    print(f"  Title: {event['title']}")
    print(f"  Current end_date: {old_end_date}")

    # Update end_date
    try:
        update_result = client.table("events").update({
            "end_date": "2026-09-05"
        }).eq("id", event_id).execute()

        print(f"✅ Successfully updated end_date from {old_end_date} to 2026-09-05")
        return event_id
    except Exception as e:
        print(f"❌ Error updating end_date: {e}")
        return None


def main():
    print("=" * 60)
    print("Spelman Museum Exhibition Data Fix")
    print("=" * 60)

    # Task 1: Add Repossessions
    repossessions_id = task1_add_repossessions()

    # Task 2: Fix Calida Rawles end_date
    calida_id = task2_fix_calida_rawles_end_date()

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    if repossessions_id:
        print(f"✅ Task 1: Repossessions exhibition added (event_id: {repossessions_id})")
    else:
        print("❌ Task 1: Failed to add Repossessions exhibition")

    if calida_id:
        print(f"✅ Task 2: Calida Rawles end_date updated (event_id: {calida_id})")
    else:
        print("❌ Task 2: Failed to update Calida Rawles end_date")

    print("=" * 60)

    # Exit with appropriate code
    if repossessions_id and calida_id:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
