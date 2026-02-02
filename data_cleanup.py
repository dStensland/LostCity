#!/usr/bin/env python3
"""
Data cleanup script for LostCity database.
Executes cleanup operations and reports results.
"""

import sys
from pathlib import Path

# Add crawlers directory to path for imports
sys.path.insert(0, str(Path(__file__).parent / "crawlers"))

from supabase import create_client
from config import get_config

def main():
    cfg = get_config()
    client = create_client(
        cfg.database.supabase_url,
        cfg.database.supabase_service_key
    )
    
    print("=" * 80)
    print("LostCity Database Cleanup Operations")
    print("=" * 80)
    print()
    
    # Get initial count
    initial_result = client.table("events").select("id", count="exact").execute()
    initial_count = initial_result.count
    print(f"Initial event count: {initial_count:,}")
    print()
    
    # Operation 1: Delete past events (older than 30 days)
    print("1. Deleting events older than 30 days...")
    try:
        # First count how many will be deleted
        count_result = client.rpc("count_old_events").execute()
        if hasattr(count_result, 'data') and count_result.data is not None:
            old_count = count_result.data
        else:
            # Fallback: try to query directly
            old_result = client.table("events").select("id", count="exact").lt("start_date", "CURRENT_DATE - INTERVAL '30 days'").execute()
            old_count = old_result.count if hasattr(old_result, 'count') else 0
        
        # Delete old events
        delete_result = client.table("events").delete().lt("start_date", "CURRENT_DATE - INTERVAL '30 days'").execute()
        deleted_count = len(delete_result.data) if delete_result.data else old_count
        print(f"   ✓ Deleted {deleted_count:,} past events")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        deleted_count = 0
    
    # Operation 2: Delete Meetup events (source_id = 2)
    print("\n2. Deleting Meetup events (source_id = 2)...")
    try:
        # Count first
        meetup_result = client.table("events").select("id", count="exact").eq("source_id", 2).execute()
        meetup_count = meetup_result.count
        
        # Delete
        if meetup_count > 0:
            delete_result = client.table("events").delete().eq("source_id", 2).execute()
            print(f"   ✓ Deleted {meetup_count:,} Meetup events")
        else:
            print(f"   ✓ No Meetup events to delete")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Operation 3: Deactivate Generic Venue Crawler and delete its events
    print("\n3. Deactivating Generic Venue Crawler and deleting its events...")
    try:
        # Count events from source 319
        generic_result = client.table("events").select("id", count="exact").eq("source_id", 319).execute()
        generic_count = generic_result.count
        
        # Deactivate source
        client.table("sources").update({"is_active": False}).eq("slug", "generic-venue-crawler").execute()
        
        # Delete events
        if generic_count > 0:
            delete_result = client.table("events").delete().eq("source_id", 319).execute()
            print(f"   ✓ Deactivated source and deleted {generic_count:,} events")
        else:
            print(f"   ✓ Source deactivated, no events to delete")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Operation 4: Deduplicate Landmark Midtown (venue_id = 199)
    print("\n4. Deduplicating Landmark Midtown events (venue_id = 199)...")
    try:
        # First, get all events at this venue
        landmark_events = client.table("events").select("id, title, start_date").eq("venue_id", 199).order("id").execute()
        
        if not landmark_events.data:
            print(f"   ✓ No events found at venue_id 199")
        else:
            # Group by title + start_date
            seen = {}
            duplicates_to_delete = []
            
            for event in landmark_events.data:
                key = (event["title"], event["start_date"])
                if key in seen:
                    # This is a duplicate, mark for deletion
                    duplicates_to_delete.append(event["id"])
                else:
                    # First occurrence, keep it
                    seen[key] = event["id"]
            
            if duplicates_to_delete:
                # Delete duplicates in batches
                batch_size = 100
                total_deleted = 0
                for i in range(0, len(duplicates_to_delete), batch_size):
                    batch = duplicates_to_delete[i:i+batch_size]
                    client.table("events").delete().in_("id", batch).execute()
                    total_deleted += len(batch)
                
                print(f"   ✓ Deleted {total_deleted:,} duplicate events (kept {len(seen):,} unique events)")
            else:
                print(f"   ✓ No duplicates found (all {len(seen):,} events are unique)")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Operation 5: Verify source_url coverage
    print("\n5. Verifying source_url coverage...")
    try:
        # Count events missing source_url
        missing_result = client.table("events").select("id", count="exact").is_("source_url", "null").execute()
        missing_count = missing_result.count
        
        # Get top sources with missing source_urls
        missing_by_source = client.table("events").select(
            "source_id, sources(name)"
        ).is_("source_url", "null").execute()
        
        # Count by source
        source_counts = {}
        for event in (missing_by_source.data or []):
            source_id = event.get("source_id")
            source_name = event.get("sources", {}).get("name", f"Source {source_id}") if event.get("sources") else f"Source {source_id}"
            source_counts[source_name] = source_counts.get(source_name, 0) + 1
        
        print(f"   Events missing source_url: {missing_count:,}")
        if source_counts:
            print(f"   Top sources missing source_url:")
            sorted_sources = sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            for source_name, count in sorted_sources:
                print(f"     - {source_name}: {count:,} events")
        else:
            print(f"   All events have source_url!")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Final count
    print("\n" + "=" * 80)
    final_result = client.table("events").select("id", count="exact").execute()
    final_count = final_result.count
    total_deleted = initial_count - final_count
    print(f"Final event count: {final_count:,}")
    print(f"Total events deleted: {total_deleted:,}")
    print("=" * 80)

if __name__ == "__main__":
    main()
