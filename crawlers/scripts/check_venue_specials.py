"""Check venue_specials table data"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

print("\n=== VENUE_SPECIALS TABLE DATA ===\n")

# Count total records
result = supabase.table('venue_specials').select('*', count='exact').execute()
print(f"Total venue_specials records: {result.count}\n")

if result.data:
    print("All records:")
    for special in result.data:
        print(f"\n  ID: {special['id']}")
        print(f"  Venue ID: {special['venue_id']}")
        print(f"  Title: {special['title']}")
        print(f"  Type: {special['type']}")
        print(f"  Days: {special.get('days_of_week')}")
        print(f"  Time: {special.get('time_start')} - {special.get('time_end')}")
        print(f"  Price Note: {special.get('price_note')}")
        print(f"  Active: {special.get('is_active')}")
        print(f"  Source: {special.get('source_url')}")
        
        # Get venue name
        venue = supabase.table('venues').select('name').eq('id', special['venue_id']).single().execute()
        if venue.data:
            print(f"  Venue Name: {venue.data['name']}")
else:
    print("No records found")

# Check for specials by type
print("\n\n=== SPECIALS BY TYPE ===\n")
types = ['happy_hour', 'daily_special', 'recurring_deal', 'exhibit', 'seasonal_menu', 'brunch', 'event_night']
for stype in types:
    result = supabase.table('venue_specials').select('id', count='exact').eq('type', stype).execute()
    print(f"{stype:20} : {result.count or 0} records")

print("\n")
