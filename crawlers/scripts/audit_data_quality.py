"""
Comprehensive data quality audit for LostCity events database.
Identifies garbage events, duplicates, and data quality issues.
"""

import re
from datetime import datetime, date
from collections import defaultdict
from supabase import create_client
from config import get_config

config = get_config()
supabase = create_client(config.database.supabase_url, config.database.supabase_service_key)

# Valid categories from the codebase
VALID_CATEGORIES = {
    "music", "film", "comedy", "theater", "art", "sports", "food_drink", 
    "nightlife", "community", "fitness", "family", "learning", "dance", 
    "tours", "meetup", "words", "religious", "markets", "wellness", 
    "support_group", "gaming", "outdoors", "other"
}

def print_section(title):
    """Print a section header."""
    print("\n" + "=" * 80)
    print(f" {title}")
    print("=" * 80 + "\n")

def print_examples(items, limit=5):
    """Print a limited number of example items."""
    for i, item in enumerate(items[:limit]):
        if isinstance(item, dict):
            print(f"  {i+1}. ID {item.get('id')}: {item.get('title')} @ {item.get('venue_name')} on {item.get('start_date')}")
            if item.get('source_name'):
                print(f"     Source: {item['source_name']}")
        else:
            print(f"  {i+1}. {item}")
    if len(items) > limit:
        print(f"  ... and {len(items) - limit} more")

# ===== 1. GARBAGE TITLES =====
print_section("1. GARBAGE TITLES AUDIT")

# 1a. Titles that are just dates
print("1a. Titles that are just dates (e.g. 'February 21, 2026', 'Sat Feb 21')...")
date_patterns = [
    r'^[A-Z][a-z]+ \d{1,2},? \d{4}$',  # "February 21, 2026"
    r'^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2}$',  # "Sat Feb 21"
    r'^\d{1,2}/\d{1,2}/\d{2,4}$',  # "2/21/2026"
    r'^[A-Z][a-z]{2} \d{1,2}$',  # "Feb 21"
    r'^\d{1,2}-\d{1,2}-\d{2,4}$',  # "2-21-2026"
]
date_title_events = []
for pattern in date_patterns:
    result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").execute()
    for event in result.data:
        if re.match(pattern, event['title']):
            date_title_events.append({
                'id': event['id'],
                'title': event['title'],
                'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
                'start_date': event['start_date']
            })

print(f"Found {len(date_title_events)} events with date-like titles")
print_examples(date_title_events)

# 1b. Titles that are day+number (e.g. "Mon16", "Tue17")
print("\n1b. Titles like 'Mon16', 'Tue17'...")
result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").execute()
day_num_events = []
for event in result.data:
    if re.match(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\d{1,2}$', event['title']):
        day_num_events.append({
            'id': event['id'],
            'title': event['title'],
            'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
            'start_date': event['start_date']
        })

print(f"Found {len(day_num_events)} events with day+number titles")
print_examples(day_num_events)

# 1c. Generic nav words
print("\n1c. Generic navigation words as titles...")
nav_words = [
    "Events", "Calendar", "Add To Calendar", "View Details", "Schedule",
    "More Info", "Details", "RSVP", "Register", "Book Now", "Tickets",
    "Event", "Show", "Performance", "Program"
]
nav_word_events = []
result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name), sources!inner(name)").execute()
for event in result.data:
    if event['title'] in nav_words:
        nav_word_events.append({
            'id': event['id'],
            'title': event['title'],
            'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
            'start_date': event['start_date'],
            'source_name': event['sources']['name'] if event.get('sources') else 'Unknown'
        })

print(f"Found {len(nav_word_events)} events with generic nav word titles")
print_examples(nav_word_events)

# 1d. Titles that are just numbers
print("\n1d. Titles that are just numbers...")
result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").execute()
number_events = []
for event in result.data:
    if re.match(r'^\d+$', event['title']):
        number_events.append({
            'id': event['id'],
            'title': event['title'],
            'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
            'start_date': event['start_date']
        })

print(f"Found {len(number_events)} events with numeric-only titles")
print_examples(number_events)

# 1e. Titles shorter than 3 characters
print("\n1e. Titles shorter than 3 characters...")
result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").execute()
short_events = []
for event in result.data:
    if len(event['title']) < 3:
        short_events.append({
            'id': event['id'],
            'title': event['title'],
            'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
            'start_date': event['start_date']
        })

print(f"Found {len(short_events)} events with titles < 3 characters")
print_examples(short_events)

# 1f. Month headers (e.g. "FEBRUARY 2026")
print("\n1f. Month header titles...")
result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").execute()
month_header_events = []
for event in result.data:
    if re.match(r'^[A-Z]{3,} \d{4}$', event['title']):
        month_header_events.append({
            'id': event['id'],
            'title': event['title'],
            'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
            'start_date': event['start_date']
        })

print(f"Found {len(month_header_events)} events with month header titles")
print_examples(month_header_events)

# 1g. Phone numbers as titles
print("\n1g. Phone numbers as titles...")
result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").execute()
phone_events = []
for event in result.data:
    # Match patterns like (404) 555-1234, 404-555-1234, 404.555.1234
    if re.match(r'^[\(\)0-9\-\.\s]{10,}$', event['title']) and any(c.isdigit() for c in event['title']):
        phone_events.append({
            'id': event['id'],
            'title': event['title'],
            'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
            'start_date': event['start_date']
        })

print(f"Found {len(phone_events)} events with phone number titles")
print_examples(phone_events)

# ===== 2. NULL OR EMPTY TITLES =====
print_section("2. NULL OR EMPTY TITLES")

result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").is_("title", "null").execute()
null_title_count = len(result.data)
print(f"Events with NULL title: {null_title_count}")
print_examples(result.data)

result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").eq("title", "").execute()
empty_title_count = len(result.data)
print(f"\nEvents with empty string title: {empty_title_count}")
print_examples(result.data)

# ===== 3. DUPLICATE EVENTS =====
print_section("3. POTENTIAL DUPLICATE EVENTS")

# This is expensive, so we'll do a simple group by title + venue + date
print("Checking for events with same title + venue + date...")
result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").execute()

# Group by (title, venue_id, start_date)
groups = defaultdict(list)
for event in result.data:
    key = (event['title'], event['venue_id'], event['start_date'])
    groups[key].append({
        'id': event['id'],
        'title': event['title'],
        'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
        'start_date': event['start_date']
    })

duplicates = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Found {len(duplicates)} sets of potential duplicates ({sum(len(v) for v in duplicates.values())} total events)")
print("\nExamples:")
for i, (key, events) in enumerate(list(duplicates.items())[:3]):
    print(f"\n  {i+1}. '{key[0]}' on {key[2]}:")
    for event in events:
        print(f"     - ID {event['id']}")

# ===== 4. INVALID CATEGORIES =====
print_section("4. INVALID CATEGORIES")

result = supabase.table("events").select("id, title, category, start_date, venue_id, venues!inner(name)").execute()
invalid_category_events = []
for event in result.data:
    if event.get('category') and event['category'] not in VALID_CATEGORIES:
        invalid_category_events.append({
            'id': event['id'],
            'title': event['title'],
            'category': event['category'],
            'venue_name': event['venues']['name'] if event.get('venues') else 'Unknown',
            'start_date': event['start_date']
        })

print(f"Found {len(invalid_category_events)} events with invalid categories")
if invalid_category_events:
    # Show unique invalid categories
    unique_invalid = set(e['category'] for e in invalid_category_events)
    print(f"Invalid categories: {sorted(unique_invalid)}")
print_examples(invalid_category_events)

# Events with NULL category
result = supabase.table("events").select("id, title, category, start_date, venue_id, venues!inner(name)").is_("category", "null").execute()
null_category_count = len(result.data)
print(f"\nEvents with NULL category: {null_category_count}")
print_examples(result.data)

# ===== 5. SYNTHETIC DESCRIPTIONS =====
print_section("5. SYNTHETIC DESCRIPTIONS (per source)")

print("Counting events with 'Event at [Venue]' or 'Live music at [Venue]' descriptions...")
result = supabase.table("events").select("id, title, description, source_id, sources!inner(name)").execute()

synthetic_by_source = defaultdict(int)
total_synthetic = 0

for event in result.data:
    desc = event.get('description', '')
    if desc and (desc.startswith('Event at ') or desc.startswith('Live music at ') or 
                 desc.startswith('Performance at ') or desc.startswith('Show at ')):
        source_name = event['sources']['name'] if event.get('sources') else 'Unknown'
        synthetic_by_source[source_name] += 1
        total_synthetic += 1

print(f"Total events with synthetic descriptions: {total_synthetic}")
print("\nTop sources with synthetic descriptions:")
for source, count in sorted(synthetic_by_source.items(), key=lambda x: -x[1])[:10]:
    print(f"  - {source}: {count}")

# ===== 6. EVENTS IN THE PAST =====
print_section("6. EVENTS IN THE PAST")

today = date.today().isoformat()
result = supabase.table("events").select("id, title, start_date, venue_id, venues!inner(name)").lt("start_date", today).execute()
past_events_count = len(result.data)

print(f"Total events with start_date < {today}: {past_events_count}")
print("\nExamples of past events:")
print_examples(result.data)

# Count by how far in the past
if result.data:
    from datetime import datetime
    today_dt = datetime.strptime(today, "%Y-%m-%d")
    
    past_30_days = sum(1 for e in result.data if (today_dt - datetime.strptime(e['start_date'], "%Y-%m-%d")).days <= 30)
    past_90_days = sum(1 for e in result.data if (today_dt - datetime.strptime(e['start_date'], "%Y-%m-%d")).days <= 90)
    past_year = sum(1 for e in result.data if (today_dt - datetime.strptime(e['start_date'], "%Y-%m-%d")).days <= 365)
    
    print(f"\nBreakdown:")
    print(f"  - Past 30 days: {past_30_days}")
    print(f"  - Past 90 days: {past_90_days}")
    print(f"  - Past year: {past_year}")
    print(f"  - Older than 1 year: {past_events_count - past_year}")

# ===== SUMMARY =====
print_section("SUMMARY")

total_garbage = (len(date_title_events) + len(day_num_events) + len(nav_word_events) + 
                 len(number_events) + len(short_events) + len(month_header_events) + 
                 len(phone_events) + null_title_count + empty_title_count)

print(f"Total garbage title events: {total_garbage}")
print(f"  - Date-like titles: {len(date_title_events)}")
print(f"  - Day+number titles: {len(day_num_events)}")
print(f"  - Generic nav words: {len(nav_word_events)}")
print(f"  - Numeric-only titles: {len(number_events)}")
print(f"  - Titles < 3 chars: {len(short_events)}")
print(f"  - Month headers: {len(month_header_events)}")
print(f"  - Phone numbers: {len(phone_events)}")
print(f"  - NULL titles: {null_title_count}")
print(f"  - Empty titles: {empty_title_count}")

print(f"\nDuplicate event groups: {len(duplicates)} ({sum(len(v) for v in duplicates.values())} events)")
print(f"Invalid category events: {len(invalid_category_events)}")
print(f"NULL category events: {null_category_count}")
print(f"Synthetic descriptions: {total_synthetic}")
print(f"Past events: {past_events_count}")

print("\n" + "=" * 80)
print("AUDIT COMPLETE")
print("=" * 80)
