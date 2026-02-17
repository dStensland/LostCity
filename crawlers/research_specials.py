"""
Research current state of happy hour and specials data in LostCity.
Generates a comprehensive diagnostic report.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import json

# Load environment
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def run_query(description, query_func):
    print(f"\n{description}")
    print("-" * 80)
    try:
        result = query_func()
        # Handle Supabase APIResponse object
        if hasattr(result, 'data'):
            data = result.data
            print(f"Results: {len(data) if data else 0} records")
            return data
        elif isinstance(result, dict) and 'data' in result:
            data = result['data']
            print(f"Results: {len(data) if data else 0} records")
            return data
        return result
    except Exception as e:
        print(f"ERROR: {e}")
        return None

# ============================================================================
# 1. DATABASE SCHEMA ANALYSIS
# ============================================================================

print_section("1. DATABASE SCHEMA ANALYSIS")

# Check venue_specials table
print("\n[A] Checking if venue_specials table exists and structure...")
try:
    result = supabase.table('venue_specials').select('*').limit(1).execute()
    print("✓ venue_specials table EXISTS")
    print(f"  Sample record count: {len(result.data)}")
    if result.data:
        print(f"  Columns: {list(result.data[0].keys())}")
except Exception as e:
    print(f"✗ venue_specials table error: {e}")

# Check venues table for specials-related columns
print("\n[B] Checking venues table for specials/hours columns...")
try:
    result = supabase.table('venues').select('*').limit(1).execute()
    if result.data:
        columns = list(result.data[0].keys())
        specials_cols = [c for c in columns if 'special' in c.lower() or 'hour' in c.lower()]
        print(f"  Specials-related columns: {specials_cols if specials_cols else 'None'}")
        print(f"  All columns: {columns}")
except Exception as e:
    print(f"  ERROR: {e}")

# ============================================================================
# 2. EVENT DATA ANALYSIS
# ============================================================================

print_section("2. EVENT DATA ANALYSIS - Specials Keywords")

# Search event titles for specials keywords
specials_keywords = [
    'happy hour', 'drink special', 'food special', 'taco tuesday', 'wing night',
    'ladies night', 'industry night', 'brunch', 'bottomless', 'half off', 'half-price',
    'half price', 'trivia', 'wing wednesday', 'thirsty thursday', 'oyster night',
    'crab night', 'burger night', 'prix fixe', 'all you can'
]

for keyword in specials_keywords:
    result = run_query(
        f"Events with '{keyword}' in title:",
        lambda k=keyword: supabase.table('events')
            .select('id, title, start_date, category, venue_id')
            .ilike('title', f'%{k}%')
            .limit(5)
            .execute()
    )
    if result and len(result) > 0:
        for event in result[:3]:
            print(f"    • {event.get('title')} ({event.get('start_date')})")

# ============================================================================
# 3. CATEGORY & SUBCATEGORY ANALYSIS
# ============================================================================

print_section("3. CATEGORY & SUBCATEGORY ANALYSIS")

# Count events by category
print("\n[A] Event count by category (top 15):")
try:
    result = supabase.rpc('get_category_counts').execute()
    if result.data:
        for i, row in enumerate(result.data[:15], 1):
            print(f"  {i:2}. {row.get('category', 'null'):15} : {row.get('count', 0):5} events")
except:
    # Fallback to direct query
    result = supabase.table('events').select('category').execute()
    if result.data:
        from collections import Counter
        counts = Counter([e.get('category') for e in result.data if e.get('category')])
        for cat, count in counts.most_common(15):
            print(f"    {cat:15} : {count:5} events")

# Nightlife subcategory breakdown
print("\n[B] Nightlife events by genre/subcategory:")
try:
    result = supabase.table('events').select('id, title, genres').eq('category', 'nightlife').limit(100).execute()
    if result.data:
        print(f"  Total nightlife events: {len(result.data)}")
        # Count genres
        from collections import Counter
        genre_counts = Counter()
        for event in result.data:
            genres = event.get('genres') or []
            for genre in genres:
                genre_counts[genre] += 1
        print("\n  Top nightlife genres:")
        for genre, count in genre_counts.most_common(15):
            print(f"    {genre:20} : {count:4} events")
except Exception as e:
    print(f"  ERROR: {e}")

# Check for nightlife.specials subcategory
print("\n[C] Events with 'specials' genre:")
try:
    result = supabase.table('events').select('id, title, category, genres').contains('genres', ['specials']).limit(10).execute()
    print(f"  Count: {len(result.data) if result.data else 0}")
    if result.data:
        for event in result.data[:5]:
            print(f"    • {event.get('title')} - {event.get('genres')}")
except Exception as e:
    print(f"  ERROR: {e}")

# ============================================================================
# 4. VENUE TYPE ANALYSIS
# ============================================================================

print_section("4. VENUE TYPE ANALYSIS - Bars, Restaurants, Nightclubs")

venue_types = ['bar', 'restaurant', 'nightclub', 'brewery', 'distillery', 'wine_bar', 
               'cocktail_bar', 'sports_bar', 'lounge', 'pub', 'food_hall']

print("\n[A] Venue count by type:")
for vtype in venue_types:
    result = supabase.table('venues').select('id', count='exact').eq('venue_type', vtype).execute()
    count = result.count if result.count else 0
    print(f"  {vtype:20} : {count:4} venues")

# ============================================================================
# 5. VIBES ANALYSIS
# ============================================================================

print_section("5. VIBES ANALYSIS - Specials-related Tags")

print("\n[A] Checking vibes column for specials-related tags:")
try:
    result = supabase.table('venues').select('id, name, vibes').not_.is_('vibes', 'null').limit(500).execute()
    if result.data:
        from collections import Counter
        vibe_counts = Counter()
        for venue in result.data:
            vibes = venue.get('vibes') or []
            for vibe in vibes:
                vibe_counts[vibe] += 1
        
        print(f"\n  Total venues with vibes: {len(result.data)}")
        print(f"\n  All vibes (top 30):")
        for vibe, count in vibe_counts.most_common(30):
            print(f"    {vibe:30} : {count:4} venues")
        
        # Check for specials-related vibes
        specials_vibes = [v for v, c in vibe_counts.items() if any(kw in v.lower() for kw in ['happy', 'special', 'deal', 'trivia', 'brunch'])]
        if specials_vibes:
            print(f"\n  Specials-related vibes found: {specials_vibes}")
except Exception as e:
    print(f"  ERROR: {e}")

# ============================================================================
# 6. SERIES ANALYSIS
# ============================================================================

print_section("6. SERIES ANALYSIS - Recurring Events")

print("\n[A] Event series that might be specials/happy hours:")
try:
    result = supabase.table('series').select('*').execute()
    if result.data:
        print(f"  Total series: {len(result.data)}")
        
        # Check series titles for keywords
        specials_series = []
        for series in result.data:
            title = (series.get('name') or series.get('title') or '').lower()
            if any(kw in title for kw in ['happy', 'special', 'trivia', 'tuesday', 'wednesday', 'thursday', 'night', 'brunch']):
                specials_series.append(series)
        
        print(f"  Series with specials keywords: {len(specials_series)}")
        for series in specials_series[:10]:
            print(f"    • {series.get('name') or series.get('title')} (ID: {series.get('id')})")
    else:
        print("  No series table or no records")
except Exception as e:
    print(f"  ERROR: {e}")

# ============================================================================
# 7. SOURCE ANALYSIS
# ============================================================================

print_section("7. SOURCE ANALYSIS - Crawlers with Specials Data")

print("\n[A] Active sources (crawlers):")
try:
    result = supabase.table('sources').select('id, name, slug, is_active').eq('is_active', True).execute()
    if result.data:
        print(f"  Total active sources: {len(result.data)}")
        
        # Check which sources produce nightlife or food_drink events
        print("\n[B] Sources producing nightlife events:")
        nightlife_sources = {}
        result = supabase.table('events').select('source_id').eq('category', 'nightlife').execute()
        if result.data:
            from collections import Counter
            source_counts = Counter([e.get('source_id') for e in result.data])
            for source_id, count in source_counts.most_common(10):
                source = supabase.table('sources').select('name, slug').eq('id', source_id).single().execute()
                if source.data:
                    print(f"    {source.data.get('name'):40} : {count:4} events")
except Exception as e:
    print(f"  ERROR: {e}")

# ============================================================================
# 8. SPECIFIC EXAMPLES
# ============================================================================

print_section("8. SPECIFIC EXAMPLES - Recent Specials Events")

print("\n[A] Recent events with 'happy hour' or 'special' in title:")
try:
    result = supabase.table('events')\
        .select('id, title, start_date, category, venue_id')\
        .or_('title.ilike.%happy hour%,title.ilike.%special%,title.ilike.%trivia%')\
        .order('start_date', desc=True)\
        .limit(15)\
        .execute()
    
    if result.data:
        for event in result.data:
            print(f"    • {event.get('start_date')} | {event.get('title')[:60]}")
except Exception as e:
    print(f"  ERROR: {e}")

# ============================================================================
# SUMMARY
# ============================================================================

print_section("SUMMARY & RECOMMENDATIONS")

print("""
FINDINGS:
---------
1. venue_specials table status: [See section 1A above]
2. Events with specials keywords: [See section 2 above]
3. Nightlife subcategory 'specials' exists in taxonomy: YES (search-constants.ts line 71)
4. Current genre coverage: [See section 3B above]
5. Venue types for bars/restaurants: [See section 4A above]
6. Vibes related to specials: [See section 5A above]
7. Series data: [See section 6 above]

INFRASTRUCTURE STATUS:
---------------------
✓ Database schema: venue_specials table exists (migration 167)
✓ Frontend taxonomy: nightlife.specials subcategory defined
✓ Tag inference: Pattern matching for specials keywords (tag_inference.py lines 1160-1165)
? Crawler coverage: Unknown which sources capture specials
? Data population: Unknown if venue_specials table has records
? UI components: Unknown if specials are displayed in feeds

RECOMMENDATIONS:
----------------
1. Check if any crawlers populate venue_specials table
2. Search codebase for components that render specials
3. Identify gaps in crawler coverage for bars with known happy hours
4. Determine if specials should be events or venue attributes
""")

print("\n" + "="*80 + "\n")
