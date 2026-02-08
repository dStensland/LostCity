"""
Generate actionable data exports for fixing identified quality issues.
Run after data_quality_report.py to get specific fix lists.
"""

import sys
from pathlib import Path
import csv

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import get_config
import psycopg2
from datetime import datetime

def get_db_connection():
    """Get direct PostgreSQL connection."""
    cfg = get_config()
    conn = psycopg2.connect(cfg.database.database_url)
    conn.set_session(autocommit=True)
    return conn

def main():
    conn = get_db_connection()
    cur = conn.cursor()
    
    print("Generating actionable data exports...")
    print()
    
    # ===== 1. ZERO-EVENT SOURCES =====
    print("1. Exporting sources with zero events in last 30 days...")
    cur.execute("""
        SELECT s.slug, s.name, s.url, MAX(e.updated_at) as last_event
        FROM sources s
        LEFT JOIN events e ON e.source_id = s.id
        WHERE s.is_active = true
        GROUP BY s.slug, s.name, s.url
        HAVING MAX(e.updated_at) < NOW() - INTERVAL '30 days' OR MAX(e.updated_at) IS NULL
        ORDER BY last_event ASC NULLS FIRST
    """)

    results = cur.fetchall()
    with open('tmp/zero_event_sources.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['slug', 'name', 'url', 'last_event_date'])
        for row in results:
            writer.writerow(row)

    print(f"   Exported {len(results)} sources to tmp/zero_event_sources.csv")

    # ===== 2. VENUES MISSING COORDINATES =====
    print("2. Exporting venues missing coordinates...")
    cur.execute("""
        SELECT id, name, address, city, state, zip
        FROM venues
        WHERE lat IS NULL OR lng IS NULL
        ORDER BY name
    """)

    results = cur.fetchall()
    with open('tmp/venues_need_geocoding.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'name', 'address', 'city', 'state', 'zip'])
        for row in results:
            writer.writerow(row)

    print(f"   Exported {len(results)} venues to tmp/venues_need_geocoding.csv")

    # ===== 3. VENUES MISSING HOURS =====
    print("3. Exporting venues missing hours data...")
    cur.execute("""
        SELECT id, name, address, city, state, lat, lng
        FROM venues
        WHERE (hours IS NULL OR hours::text = '{}')
        AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY name
    """)

    results = cur.fetchall()
    with open('tmp/venues_need_hours.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'name', 'address', 'city', 'state', 'lat', 'lng'])
        for row in results:
            writer.writerow(row)
    
    print(f"   Exported {len(results)} venues to tmp/venues_need_hours.csv")
    
    # ===== 4. SOURCES WITH POOR DESCRIPTION COVERAGE =====
    print("4. Identifying sources with poor description coverage...")
    cur.execute("""
        SELECT s.slug, 
               COUNT(*) as total_events,
               COUNT(CASE WHEN e.description IS NULL OR e.description = '' THEN 1 END) as no_desc,
               ROUND(COUNT(CASE WHEN e.description IS NULL OR e.description = '' THEN 1 END) * 100.0 / COUNT(*), 1) as pct_missing
        FROM events e
        JOIN sources s ON e.source_id = s.id
        WHERE e.updated_at::date = CURRENT_DATE
        GROUP BY s.slug
        HAVING COUNT(*) > 10 AND COUNT(CASE WHEN e.description IS NULL OR e.description = '' THEN 1 END) * 100.0 / COUNT(*) > 50
        ORDER BY pct_missing DESC
    """)
    
    results = cur.fetchall()
    with open('tmp/sources_poor_descriptions.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['slug', 'total_events', 'no_description_count', 'percent_missing'])
        for row in results:
            writer.writerow(row)
    
    print(f"   Exported {len(results)} sources to tmp/sources_poor_descriptions.csv")
    
    # ===== 5. EVENTS MISSING CRITICAL FIELDS =====
    print("5. Exporting events missing critical fields...")
    cur.execute("""
        SELECT e.id, e.title, e.start_date, s.slug as source_slug, v.name as venue_name
        FROM events e
        LEFT JOIN sources s ON e.source_id = s.id
        LEFT JOIN venues v ON e.venue_id = v.id
        WHERE e.title IS NULL OR e.title = '' OR e.start_date IS NULL OR e.venue_id IS NULL
        LIMIT 500
    """)
    
    results = cur.fetchall()
    with open('tmp/events_missing_critical_fields.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['event_id', 'title', 'start_date', 'source_slug', 'venue_name'])
        for row in results:
            writer.writerow(row)
    
    print(f"   Exported {len(results)} events to tmp/events_missing_critical_fields.csv")
    
    # ===== 6. PRICE INCONSISTENCIES =====
    print("6. Exporting events with price inconsistencies...")
    cur.execute("""
        SELECT e.id, e.title, e.price_min, e.price_max, e.is_free, s.slug as source_slug
        FROM events e
        JOIN sources s ON e.source_id = s.id
        WHERE (e.price_min IS NOT NULL AND e.price_max IS NOT NULL AND e.price_min > e.price_max)
        OR (e.is_free = true AND e.price_min > 0)
    """)
    
    results = cur.fetchall()
    with open('tmp/events_price_inconsistencies.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['event_id', 'title', 'price_min', 'price_max', 'is_free', 'source_slug'])
        for row in results:
            writer.writerow(row)
    
    print(f"   Exported {len(results)} events to tmp/events_price_inconsistencies.csv")
    
    # ===== 7. SOURCE HEALTH TIERS =====
    print("7. Generating source health tier report...")
    cur.execute("""
        SELECT 
            s.slug,
            s.name,
            COUNT(e.id) as total_events_all_time,
            MAX(e.updated_at) as last_event_date,
            CASE 
                WHEN MAX(e.updated_at) > NOW() - INTERVAL '7 days' THEN 'Tier 1: Healthy'
                WHEN MAX(e.updated_at) > NOW() - INTERVAL '30 days' THEN 'Tier 2: Warning'
                WHEN MAX(e.updated_at) IS NOT NULL THEN 'Tier 3: Stale (30+ days)'
                ELSE 'Tier 4: Never Active'
            END as health_tier
        FROM sources s
        LEFT JOIN events e ON e.source_id = s.id
        WHERE s.is_active = true
        GROUP BY s.slug, s.name
        ORDER BY health_tier, s.slug
    """)
    
    results = cur.fetchall()
    with open('tmp/source_health_tiers.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['slug', 'name', 'total_events_all_time', 'last_event_date', 'health_tier'])
        for row in results:
            writer.writerow(row)
    
    print(f"   Exported {len(results)} sources to tmp/source_health_tiers.csv")
    
    # ===== 8. RECENT CRAWL FAILURES =====
    print("8. Exporting recent crawl failures...")
    cur.execute("""
        SELECT s.slug, cl.started_at, cl.error_message, cl.events_found, cl.events_new
        FROM crawl_logs cl
        JOIN sources s ON cl.source_id = s.id
        WHERE cl.status = 'error' 
        AND cl.started_at > NOW() - INTERVAL '7 days'
        ORDER BY cl.started_at DESC
        LIMIT 200
    """)
    
    results = cur.fetchall()
    with open('tmp/recent_crawl_failures.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['slug', 'started_at', 'error_message', 'events_found', 'events_new'])
        for row in results:
            writer.writerow(row)
    
    print(f"   Exported {len(results)} failures to tmp/recent_crawl_failures.csv")
    
    # ===== SUMMARY =====
    print()
    print("=" * 80)
    print("ACTION ITEMS GENERATED")
    print("=" * 80)
    print()
    print("Review the following files in tmp/ directory:")
    print("  1. zero_event_sources.csv - Sources to deactivate or investigate")
    print("  2. venues_need_geocoding.csv - Venues to geocode (run backfill script)")
    print("  3. venues_need_hours.csv - Venues to fetch hours from Google Places")
    print("  4. sources_poor_descriptions.csv - Sources needing better extraction")
    print("  5. events_missing_critical_fields.csv - Events to fix or delete")
    print("  6. events_price_inconsistencies.csv - Price data to correct")
    print("  7. source_health_tiers.csv - Overall source health audit")
    print("  8. recent_crawl_failures.csv - Recent errors to investigate")
    print()
    
    conn.close()

if __name__ == "__main__":
    main()
