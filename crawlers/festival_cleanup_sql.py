"""
Generate SQL cleanup queries for festival series consolidation.
"""

from db import get_client
from collections import defaultdict


def generate_cleanup_sql():
    client = get_client()
    
    print("-- " + "=" * 76)
    print("-- FESTIVAL SERIES CONSOLIDATION - SQL CLEANUP")
    print("-- Generated:", "2026-02-14")
    print("-- " + "=" * 76)
    print()
    
    # Get problematic sources
    problematic_sources = [
        ("atlanta-supercross", "Monster Energy AMA Supercross", "recurring_show"),
        ("pigs-and-peaches-bbq", "Pigs & Peaches BBQ Festival", "festival"),
        ("nascar-atlanta", "NASCAR at Atlanta Motor Speedway", "recurring_show"),
        ("rk-gun-show-atlanta", None, None),  # Need location-specific series
    ]
    
    for source_slug, consolidated_title, consolidated_type in problematic_sources:
        print(f"\n-- {'-' * 76}")
        print(f"-- SOURCE: {source_slug}")
        print(f"-- {'-' * 76}\n")
        
        # Get source ID
        source_result = client.table("sources")\
            .select("id, name")\
            .eq("slug", source_slug)\
            .execute()
        
        if not source_result.data:
            print(f"-- WARNING: Source '{source_slug}' not found\n")
            continue
        
        source_id = source_result.data[0]["id"]
        source_name = source_result.data[0]["name"]
        
        # Get all events from this source with series links
        events_result = client.table("events")\
            .select("id, title, series_id, start_date")\
            .eq("source_id", source_id)\
            .not_.is_("series_id", "null")\
            .execute()
        
        events = events_result.data or []
        
        if not events:
            print(f"-- No events with series links for source '{source_slug}'\n")
            continue
        
        # Get unique series IDs
        series_ids = list(set(e["series_id"] for e in events if e.get("series_id")))
        
        # Get series info
        series_info = []
        for series_id in series_ids:
            series_result = client.table("series")\
                .select("id, title, series_type")\
                .eq("id", series_id)\
                .execute()
            
            if series_result.data:
                series_info.append(series_result.data[0])
        
        print(f"-- Source: {source_name} ({source_slug})")
        print(f"-- Events: {len(events)}")
        print(f"-- Current fragmented series: {len(series_info)}")
        print()
        
        for series in series_info:
            event_count = sum(1 for e in events if e.get("series_id") == series["id"])
            print(f"--   - {series['title']} ({series['series_type']}): {event_count} events")
        print()
        
        if source_slug == "rk-gun-show-atlanta":
            # Special case: need location-specific series
            print("-- MANUAL REVIEW NEEDED: Each location should be a separate recurring_show")
            print("-- Example:")
            print("--   'Marietta, GA – Gun Show' -> series_type: recurring_show")
            print("--   'Waycross, GA – Gun Show' -> series_type: recurring_show")
            print()
            continue
        
        # Generate consolidation SQL
        print("-- Step 1: Create consolidated series")
        print(f"-- (Skip if series already exists)")
        print()
        print("BEGIN;")
        print()
        print("-- Check if consolidated series exists")
        print(f"SELECT id, title FROM series WHERE slug = '{source_slug}';")
        print()
        print("-- If NOT exists, create it:")
        print("INSERT INTO series (title, series_type, slug)")
        print(f"VALUES ('{consolidated_title}', '{consolidated_type}', '{source_slug}')")
        print("ON CONFLICT (slug) DO NOTHING")
        print("RETURNING id;")
        print("-- Save the returned id as <new-series-id>")
        print()
        
        print("-- Step 2: Relink all events to consolidated series")
        print(f"UPDATE events")
        print(f"SET series_id = '<new-series-id>'")
        print(f"WHERE source_id = {source_id}")
        print(f"  AND series_id IN ({', '.join(repr(s['id']) for s in series_info)});")
        print()
        
        print("-- Step 3: Delete old fragmented series")
        print(f"DELETE FROM series")
        print(f"WHERE id IN ({', '.join(repr(s['id']) for s in series_info)});")
        print()
        
        print("-- Verify cleanup")
        print(f"SELECT s.title, s.series_type, COUNT(e.id) as event_count")
        print(f"FROM series s")
        print(f"LEFT JOIN events e ON e.series_id = s.id")
        print(f"WHERE s.slug = '{source_slug}'")
        print(f"GROUP BY s.id, s.title, s.series_type;")
        print()
        print("COMMIT;")
        print()


def main():
    generate_cleanup_sql()
    
    print("\n-- " + "=" * 76)
    print("-- VALIDATION QUERIES")
    print("-- " + "=" * 76)
    print()
    
    print("-- Check for sources creating 10+ festival_program series:")
    print("""
SELECT so.slug, so.name, COUNT(DISTINCT se.id) as program_count
FROM sources so
JOIN events e ON e.source_id = so.id
JOIN series se ON e.series_id = se.id
WHERE se.series_type = 'festival_program'
GROUP BY so.id, so.slug, so.name
HAVING COUNT(DISTINCT se.id) >= 10
ORDER BY program_count DESC;
""")
    
    print("-- Check for festival series spanning 8+ venues:")
    print("""
SELECT s.title, s.series_type, COUNT(DISTINCT e.venue_id) as venue_count,
       COUNT(e.id) as event_count
FROM series s
JOIN events e ON e.series_id = s.id
WHERE s.series_type IN ('festival', 'festival_program')
GROUP BY s.id, s.title, s.series_type
HAVING COUNT(DISTINCT e.venue_id) >= 8
ORDER BY venue_count DESC;
""")


if __name__ == "__main__":
    main()
