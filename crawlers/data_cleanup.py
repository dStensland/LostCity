#!/usr/bin/env python3
"""
Data cleanup script for LostCity database.
Executes cleanup operations and reports results.

Usage:
    python3 data_cleanup.py
"""

from datetime import datetime, timedelta
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
        cutoff_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        old_result = client.table("events").select("id", count="exact").lt("start_date", cutoff_date).execute()
        old_count = old_result.count if hasattr(old_result, 'count') else 0
        
        if old_count > 0:
            delete_result = client.table("events").delete().lt("start_date", cutoff_date).execute()
            print(f"   ✓ Deleted {old_count:,} past events")
        else:
            print(f"   ✓ No past events to delete")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Operation 2: Delete Meetup events (source_id = 2)
    print("\n2. Deleting Meetup events (source_id = 2)...")
    try:
        meetup_result = client.table("events").select("id", count="exact").eq("source_id", 2).execute()
        meetup_count = meetup_result.count
        
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
        generic_result = client.table("events").select("id", count="exact").eq("source_id", 319).execute()
        generic_count = generic_result.count
        
        client.table("sources").update({"is_active": False}).eq("slug", "generic-venue-crawler").execute()
        
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
        landmark_events = client.table("events").select("id, title, start_date").eq("venue_id", 199).order("id").execute()
        
        if not landmark_events.data:
            print(f"   ✓ No events found at venue_id 199")
        else:
            seen = {}
            duplicates_to_delete = []
            
            for event in landmark_events.data:
                key = (event["title"], event["start_date"])
                if key in seen:
                    duplicates_to_delete.append(event["id"])
                else:
                    seen[key] = event["id"]
            
            if duplicates_to_delete:
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
        missing_result = client.table("events").select("id", count="exact").is_("source_url", "null").execute()
        missing_count = missing_result.count
        
        missing_by_source = client.table("events").select("source_id").is_("source_url", "null").limit(1000).execute()
        
        source_counts = {}
        for event in (missing_by_source.data or []):
            source_id = event.get("source_id")
            source_counts[source_id] = source_counts.get(source_id, 0) + 1
        
        print(f"   Events missing source_url: {missing_count:,}")
        
        if source_counts:
            print(f"   Top sources missing source_url (from sample of 1000):")
            sorted_sources = sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            for source_id, count in sorted_sources:
                try:
                    source_result = client.table("sources").select("name").eq("id", source_id).execute()
                    source_name = source_result.data[0]["name"] if source_result.data else f"Source {source_id}"
                except:
                    source_name = f"Source {source_id}"
                print(f"     - {source_name}: {count:,} events (in sample)")
        else:
            print(f"   ✓ All events have source_url!")
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
