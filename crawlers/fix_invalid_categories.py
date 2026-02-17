"""
Fix invalid categories in the events database and update crawlers.

Invalid categories to fix:
- outdoor (314 events) → outdoors
- museums (17 events) → art
- shopping (2 events) → community
- Calendar title (1 event) → delete
"""

import logging
from supabase import create_client
from config import get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    cfg = get_config()
    supabase = create_client(cfg.database.supabase_url, cfg.database.supabase_service_key)

    print("=" * 80)
    print("FIXING INVALID CATEGORIES IN DATABASE")
    print("=" * 80)

    # Fix outdoor → outdoors
    print("\n1. Fixing 'outdoor' → 'outdoors'...")
    result = supabase.table("events").update({"category": "outdoors"}).eq("category", "outdoor").execute()
    print(f"   ✓ Fixed outdoor→outdoors: {len(result.data)} events")

    # Fix museums → art
    print("\n2. Fixing 'museums' → 'art'...")
    result = supabase.table("events").update({"category": "art"}).eq("category", "museums").execute()
    print(f"   ✓ Fixed museums→art: {len(result.data)} events")

    # Fix shopping → community
    print("\n3. Fixing 'shopping' → 'community'...")
    result = supabase.table("events").update({"category": "community"}).eq("category", "shopping").execute()
    print(f"   ✓ Fixed shopping→community: {len(result.data)} events")

    # Delete "Calendar" garbage event
    print("\n4. Deleting garbage 'Calendar' events...")
    result = supabase.from_("events").select("id, title, source_id").eq("title", "Calendar").execute()
    deleted_count = 0
    for e in result.data:
        print(f"   Deleting garbage: '{e['title']}' (id={e['id']}, source_id={e['source_id']})")
        supabase.table("events").delete().eq("id", e["id"]).execute()
        deleted_count += 1
    print(f"   ✓ Deleted {deleted_count} garbage events")

    print("\n" + "=" * 80)
    print("DATABASE FIXES COMPLETE")
    print("=" * 80)

    # Verify by checking for any remaining invalid categories
    print("\nVerifying fixes...")
    invalid_check = supabase.table("events").select("category").in_("category", ["outdoor", "museums", "shopping"]).execute()
    if invalid_check.data and len(invalid_check.data) > 0:
        print(f"\n⚠️  WARNING: Still have {len(invalid_check.data)} events with invalid categories")
    else:
        print("\n✓ All invalid categories have been fixed!")

    print("\n" + "=" * 80)
    print("NEXT STEPS:")
    print("=" * 80)
    print("1. Fix crawler files:")
    print("   - sources/spelman_college.py (line 176, 349)")
    print("   - sources/high_museum.py (line 140, 356)")
    print("   - sources/college_football_hof.py (line 223)")
    print("   - sources/civil_rights_center.py (line 176)")
    print("")
    print("2. Fix tag_inference.py (lines 1132, 1332)")
    print("")
    print("3. Add 'calendar' to validate_event_title() junk_exact set in db.py")
    print("=" * 80)

if __name__ == "__main__":
    main()
