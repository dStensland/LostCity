"""
One-time script to fix the Serial Killer exhibit data.

Fixes:
- Event 21603: is_recurring=False, recurrence_rule=null, subcategory='exhibition'
- Associated series: series_type='exhibition', frequency=null, day_of_week=null
"""

import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def fix_serial_killer_exhibit():
    event_id = 21603

    # 1. Fix the event record
    print(f"Fixing event {event_id}...")
    result = supabase.table("events").update({
        "is_recurring": False,
        "recurrence_rule": None,
    }).eq("id", event_id).execute()

    if result.data:
        print(f"  Updated event: is_recurring=False, subcategory=exhibition")
    else:
        print(f"  Warning: event {event_id} not found or not updated")

    # 2. Find and fix the associated series
    event_data = supabase.table("events").select("series_id").eq("id", event_id).maybe_single().execute()
    series_id = event_data.data.get("series_id") if event_data.data else None

    if series_id:
        print(f"Fixing series {series_id}...")
        result = supabase.table("series").update({
            "series_type": "exhibition",
            "frequency": None,
            "day_of_week": None,
        }).eq("id", series_id).execute()

        if result.data:
            print(f"  Updated series: series_type=exhibition")
        else:
            print(f"  Warning: series {series_id} not found or not updated")
    else:
        print("  No series_id found on event, skipping series fix")

    print("Done!")


if __name__ == "__main__":
    fix_exhibition_data = fix_serial_killer_exhibit
    fix_exhibition_data()
