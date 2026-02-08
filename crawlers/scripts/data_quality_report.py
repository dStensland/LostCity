"""
Comprehensive post-crawl data quality analysis.
Run after a full crawl to assess enrichment coverage and identify issues.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import get_config
import psycopg2
from datetime import datetime

def get_db_connection():
    """Get direct PostgreSQL connection."""
    cfg = get_config()
    conn = psycopg2.connect(cfg.database.database_url)
    conn.set_session(autocommit=True)  # Use autocommit to avoid transaction issues
    return conn

def run_query(conn, query, description):
    """Execute query and return results with error handling."""
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            result = cur.fetchall()
            return result
    except Exception as e:
        print(f"ERROR in {description}: {e}")
        return None

def format_percentage(part, total):
    """Format percentage with absolute count."""
    if total == 0:
        return "0 (0%)"
    pct = (part / total) * 100
    return f"{part:,} ({pct:.1f}%)"

def main():
    print("=" * 80)
    print("LOSTCITY DATA QUALITY REPORT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    conn = get_db_connection()
    
    # ===== OVERVIEW METRICS =====
    print("OVERVIEW METRICS")
    print("-" * 80)
    
    # Total events
    result = run_query(conn, "SELECT COUNT(*) FROM events", "Total events")
    total_events = result[0][0] if result else 0
    print(f"Total events in database: {total_events:,}")
    
    # Total venues
    result = run_query(conn, "SELECT COUNT(*) FROM venues", "Total venues")
    total_venues = result[0][0] if result else 0
    print(f"Total venues in database: {total_venues:,}")
    
    # Total active sources
    result = run_query(conn, "SELECT COUNT(*) FROM sources WHERE is_active = true", "Active sources")
    active_sources = result[0][0] if result else 0
    print(f"Active sources: {active_sources:,}")
    
    # Events updated today
    result = run_query(conn, "SELECT COUNT(*) FROM events WHERE updated_at::date = CURRENT_DATE", "Events updated today")
    events_today = result[0][0] if result else 0
    print(f"Events updated today: {events_today:,}")
    
    print()
    
    # ===== ENRICHMENT COVERAGE =====
    print("ENRICHMENT COVERAGE")
    print("-" * 80)
    
    # Descriptions
    result = run_query(conn, "SELECT COUNT(*) FROM events WHERE description IS NOT NULL AND LENGTH(description) > 50", "Events with descriptions")
    desc_count = result[0][0] if result else 0
    print(f"Events with description (>50 chars): {format_percentage(desc_count, total_events)}")
    
    # Start time
    result = run_query(conn, "SELECT COUNT(*) FROM events WHERE start_time IS NOT NULL", "Events with start_time")
    time_count = result[0][0] if result else 0
    print(f"Events with start_time: {format_percentage(time_count, total_events)}")
    
    # Image URL (direct field)
    result = run_query(conn, "SELECT COUNT(*) FROM events WHERE image_url IS NOT NULL AND image_url != ''", "Events with image_url")
    img_count = result[0][0] if result else 0
    print(f"Events with image_url: {format_percentage(img_count, total_events)}")
    
    # Ticket URL
    result = run_query(conn, "SELECT COUNT(*) FROM events WHERE ticket_url IS NOT NULL AND ticket_url != ''", "Events with ticket_url")
    ticket_count = result[0][0] if result else 0
    print(f"Events with ticket_url: {format_percentage(ticket_count, total_events)}")
    
    # Category
    result = run_query(conn, "SELECT COUNT(*) FROM events WHERE category IS NOT NULL", "Events with category")
    cat_count = result[0][0] if result else 0
    print(f"Events with category: {format_percentage(cat_count, total_events)}")
    
    # Provenance tracking
    result = run_query(conn, "SELECT COUNT(*) FROM events WHERE field_provenance IS NOT NULL AND field_provenance::text != '{}'", "Events with provenance")
    prov_count = result[0][0] if result else 0
    print(f"Events with provenance data: {format_percentage(prov_count, total_events)}")
    
    # Fully rich events (4/4: description, time, image, ticket)
    result = run_query(conn, """
        SELECT COUNT(*) FROM events
        WHERE description IS NOT NULL AND LENGTH(description) > 50
        AND start_time IS NOT NULL
        AND image_url IS NOT NULL AND image_url != ''
        AND ticket_url IS NOT NULL AND ticket_url != ''
    """, "Fully rich events")
    rich_count = result[0][0] if result else 0
    print(f"Fully rich events (4/4 fields): {format_percentage(rich_count, total_events)}")
    
    # Minimally viable events (title + date + venue)
    result = run_query(conn, """
        SELECT COUNT(*) FROM events
        WHERE title IS NOT NULL AND title != ''
        AND start_date IS NOT NULL
        AND venue_id IS NOT NULL
    """, "Minimally viable events")
    viable_count = result[0][0] if result else 0
    print(f"Minimally viable events: {format_percentage(viable_count, total_events)}")
    
    print()
    
    # ===== RELATIONAL DATA =====
    print("RELATIONAL DATA")
    print("-" * 80)
    
    # Event images (many-to-many)
    result = run_query(conn, "SELECT COUNT(DISTINCT event_id) FROM event_images", "Events with images table")
    event_imgs = result[0][0] if result else 0
    print(f"Events with entries in event_images: {format_percentage(event_imgs, total_events)}")
    
    # Event links (many-to-many)
    result = run_query(conn, "SELECT COUNT(DISTINCT event_id) FROM event_links", "Events with links table")
    event_links = result[0][0] if result else 0
    print(f"Events with entries in event_links: {format_percentage(event_links, total_events)}")
    
    print()
    
    # ===== CATEGORY DISTRIBUTION =====
    print("CATEGORY DISTRIBUTION (Top 15)")
    print("-" * 80)
    
    result = run_query(conn, """
        SELECT category, COUNT(*) as cnt 
        FROM events 
        GROUP BY category 
        ORDER BY cnt DESC 
        LIMIT 15
    """, "Category distribution")
    
    if result:
        for category, count in result:
            cat_name = category if category else "(null)"
            print(f"  {cat_name:30s} {format_percentage(count, total_events)}")
    
    print()
    
    # ===== SOURCE PERFORMANCE TODAY =====
    print("SOURCE PERFORMANCE (Today's Crawl - Top 20)")
    print("-" * 80)
    
    result = run_query(conn, """
        SELECT s.slug, COUNT(e.id) as event_count
        FROM events e
        JOIN sources s ON e.source_id = s.id
        WHERE e.updated_at::date = CURRENT_DATE
        GROUP BY s.slug
        ORDER BY event_count DESC
        LIMIT 20
    """, "Top sources today")
    
    if result:
        for slug, count in result:
            print(f"  {slug:50s} {count:,} events")
    
    print()
    
    # ===== ZERO-EVENT SOURCES =====
    print("ACTIVE SOURCES WITH ZERO EVENTS TODAY")
    print("-" * 80)
    
    result = run_query(conn, """
        SELECT COUNT(DISTINCT s.slug) as zero_sources
        FROM sources s
        LEFT JOIN events e ON e.source_id = s.id AND e.updated_at::date = CURRENT_DATE
        WHERE s.is_active = true AND e.id IS NULL
    """, "Zero-event sources")
    
    zero_sources = result[0][0] if result and result[0] else 0
    pct = (zero_sources/active_sources*100) if active_sources > 0 else 0
    print(f"Active sources with 0 events today: {zero_sources} / {active_sources} ({pct:.1f}%)")
    
    # List some examples
    result = run_query(conn, """
        SELECT s.slug
        FROM sources s
        LEFT JOIN events e ON e.source_id = s.id AND e.updated_at::date = CURRENT_DATE
        WHERE s.is_active = true AND e.id IS NULL
        ORDER BY s.slug
        LIMIT 30
    """, "Zero-event source examples")
    
    if result and len(result) > 0:
        print("\nExamples (first 30):")
        for (slug,) in result:
            print(f"  - {slug}")
    
    print()
    
    # ===== DATA QUALITY ISSUES =====
    print("DATA QUALITY ISSUES")
    print("-" * 80)
    
    # Missing critical fields
    result = run_query(conn, """
        SELECT COUNT(*) FROM events
        WHERE title IS NULL OR title = '' OR start_date IS NULL OR venue_id IS NULL
    """, "Events missing critical fields")
    critical_missing = result[0][0] if result else 0
    print(f"Events missing critical fields (title/date/venue): {format_percentage(critical_missing, total_events)}")
    
    # Price inconsistencies
    result = run_query(conn, """
        SELECT COUNT(*) FROM events
        WHERE (price_min IS NOT NULL AND price_max IS NOT NULL AND price_min > price_max)
        OR (is_free = true AND price_min > 0)
    """, "Price inconsistencies")
    price_issues = result[0][0] if result else 0
    print(f"Events with price inconsistencies: {format_percentage(price_issues, total_events)}")
    
    # Events with generic titles
    result = run_query(conn, """
        SELECT COUNT(*) FROM events
        WHERE LOWER(title) IN ('event', 'tba', 'to be announced', 'untitled', 'n/a')
    """, "Generic titles")
    generic_titles = result[0][0] if result else 0
    print(f"Events with generic titles: {format_percentage(generic_titles, total_events)}")
    
    # Very short descriptions (likely low quality)
    result = run_query(conn, """
        SELECT COUNT(*) FROM events
        WHERE description IS NOT NULL AND LENGTH(description) > 0 AND LENGTH(description) <= 20
    """, "Very short descriptions")
    short_desc = result[0][0] if result else 0
    print(f"Events with very short descriptions (1-20 chars): {format_percentage(short_desc, total_events)}")
    
    # Null descriptions
    result = run_query(conn, """
        SELECT COUNT(*) FROM events
        WHERE description IS NULL OR description = ''
    """, "Missing descriptions")
    no_desc = result[0][0] if result else 0
    print(f"Events with no description: {format_percentage(no_desc, total_events)}")
    
    print()
    
    # ===== VENUE DATA QUALITY =====
    print("VENUE DATA QUALITY")
    print("-" * 80)
    
    # Venues without coordinates
    result = run_query(conn, "SELECT COUNT(*) FROM venues WHERE lat IS NULL OR lng IS NULL", "Venues without coordinates")
    no_coords = result[0][0] if result else 0
    print(f"Venues without lat/lng: {format_percentage(no_coords, total_venues)}")
    
    # Venues without addresses
    result = run_query(conn, "SELECT COUNT(*) FROM venues WHERE address IS NULL OR address = ''", "Venues without address")
    no_address = result[0][0] if result else 0
    print(f"Venues without address: {format_percentage(no_address, total_venues)}")
    
    # Venues without neighborhood
    result = run_query(conn, "SELECT COUNT(*) FROM venues WHERE neighborhood IS NULL OR neighborhood = ''", "Venues without neighborhood")
    no_hood = result[0][0] if result else 0
    print(f"Venues without neighborhood: {format_percentage(no_hood, total_venues)}")
    
    # Venues without hours
    result = run_query(conn, "SELECT COUNT(*) FROM venues WHERE hours IS NULL OR hours::text = '{}'", "Venues without hours")
    no_hours = result[0][0] if result else 0
    print(f"Venues without hours data: {format_percentage(no_hours, total_venues)}")
    
    # Venues without vibes
    result = run_query(conn, "SELECT COUNT(*) FROM venues WHERE vibes IS NULL OR vibes::text = '{}' OR vibes::text = '[]'", "Venues without vibes")
    no_vibes = result[0][0] if result else 0
    print(f"Venues without vibes: {format_percentage(no_vibes, total_venues)}")
    
    print()
    
    # ===== RECENT CRAWL ERRORS =====
    print("RECENT CRAWL ERRORS (Last 7 Days)")
    print("-" * 80)
    
    result = run_query(conn, """
        SELECT s.slug, cl.error_message, COUNT(*) as error_count
        FROM crawl_logs cl
        JOIN sources s ON cl.source_id = s.id
        WHERE cl.status = 'error' AND cl.started_at > NOW() - INTERVAL '7 days'
        GROUP BY s.slug, cl.error_message
        ORDER BY error_count DESC
        LIMIT 15
    """, "Recent crawl errors")
    
    if result and len(result) > 0:
        for slug, error_msg, count in result:
            error_preview = error_msg[:80] if error_msg else "(no message)"
            print(f"  {slug:30s} x{count} - {error_preview}")
    else:
        print("  No errors in last 7 days")
    
    print()
    
    # ===== ENRICHMENT BY SOURCE TYPE =====
    print("ENRICHMENT RATES BY TODAY'S TOP 10 SOURCES")
    print("-" * 80)
    
    result = run_query(conn, """
        WITH top_sources AS (
            SELECT s.slug, s.id, COUNT(e.id) as event_count
            FROM events e
            JOIN sources s ON e.source_id = s.id
            WHERE e.updated_at::date = CURRENT_DATE
            GROUP BY s.slug, s.id
            ORDER BY event_count DESC
            LIMIT 10
        )
        SELECT 
            ts.slug,
            ts.event_count,
            COUNT(CASE WHEN LENGTH(e.description) > 50 THEN 1 END) as with_desc,
            COUNT(CASE WHEN e.start_time IS NOT NULL THEN 1 END) as with_time,
            COUNT(CASE WHEN e.image_url IS NOT NULL AND e.image_url != '' THEN 1 END) as with_image,
            COUNT(CASE WHEN e.ticket_url IS NOT NULL AND e.ticket_url != '' THEN 1 END) as with_ticket
        FROM top_sources ts
        JOIN events e ON e.source_id = ts.id AND e.updated_at::date = CURRENT_DATE
        GROUP BY ts.slug, ts.event_count
        ORDER BY ts.event_count DESC
    """, "Enrichment by source")
    
    if result:
        print(f"{'Source':30s} {'Events':>7s} {'Desc':>6s} {'Time':>6s} {'Image':>6s} {'Ticket':>6s}")
        print("-" * 80)
        for slug, total, desc, time, img, ticket in result:
            desc_pct = f"{(desc/total*100):.0f}%" if total > 0 else "0%"
            time_pct = f"{(time/total*100):.0f}%" if total > 0 else "0%"
            img_pct = f"{(img/total*100):.0f}%" if total > 0 else "0%"
            ticket_pct = f"{(ticket/total*100):.0f}%" if total > 0 else "0%"
            print(f"{slug:30s} {total:7d} {desc_pct:>6s} {time_pct:>6s} {img_pct:>6s} {ticket_pct:>6s}")
    
    print()
    print("=" * 80)
    print("END OF REPORT")
    print("=" * 80)
    
    conn.close()

if __name__ == "__main__":
    main()
