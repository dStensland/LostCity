"""
Quick visual dashboard for data quality metrics.
Run this weekly to track progress.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import get_config
import psycopg2

def get_db_connection():
    cfg = get_config()
    conn = psycopg2.connect(cfg.database.database_url)
    conn.set_session(autocommit=True)
    return conn

def progress_bar(percentage, width=50):
    """Generate ASCII progress bar."""
    filled = int(width * percentage / 100)
    bar = '█' * filled + '░' * (width - filled)
    return f"|{bar}| {percentage:.1f}%"

def grade(percentage):
    """Convert percentage to letter grade."""
    if percentage >= 95: return "A+"
    if percentage >= 90: return "A"
    if percentage >= 85: return "A-"
    if percentage >= 80: return "B+"
    if percentage >= 75: return "B"
    if percentage >= 70: return "B-"
    if percentage >= 65: return "C+"
    if percentage >= 60: return "C"
    if percentage >= 55: return "C-"
    if percentage >= 50: return "D"
    return "F"

def main():
    conn = get_db_connection()
    cur = conn.cursor()
    
    print()
    print("╔════════════════════════════════════════════════════════════════════════════╗")
    print("║                    LOSTCITY DATA QUALITY DASHBOARD                         ║")
    print("╚════════════════════════════════════════════════════════════════════════════╝")
    print()
    
    # Get total events
    cur.execute("SELECT COUNT(*) FROM events")
    total_events = cur.fetchone()[0]
    
    # Get enrichment metrics
    cur.execute("""
        SELECT 
            ROUND(100.0 * COUNT(CASE WHEN category IS NOT NULL THEN 1 END) / COUNT(*), 1) as category_pct,
            ROUND(100.0 * COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) / COUNT(*), 1) as time_pct,
            ROUND(100.0 * COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) / COUNT(*), 1) as img_pct,
            ROUND(100.0 * COUNT(CASE WHEN ticket_url IS NOT NULL AND ticket_url != '' THEN 1 END) / COUNT(*), 1) as ticket_pct,
            ROUND(100.0 * COUNT(CASE WHEN LENGTH(description) > 50 THEN 1 END) / COUNT(*), 1) as desc_pct,
            ROUND(100.0 * COUNT(CASE WHEN field_provenance IS NOT NULL AND field_provenance::text != '{}' THEN 1 END) / COUNT(*), 1) as prov_pct
        FROM events
    """)
    
    category_pct, time_pct, img_pct, ticket_pct, desc_pct, prov_pct = cur.fetchone()
    
    print("📊 ENRICHMENT QUALITY")
    print("─" * 80)
    print(f"Category:     {progress_bar(category_pct)} {grade(category_pct)}")
    print(f"Start Time:   {progress_bar(time_pct)} {grade(time_pct)}")
    print(f"Image URL:    {progress_bar(img_pct)} {grade(img_pct)}")
    print(f"Ticket URL:   {progress_bar(ticket_pct)} {grade(ticket_pct)}")
    print(f"Description:  {progress_bar(desc_pct)} {grade(desc_pct)}")
    print(f"Provenance:   {progress_bar(prov_pct)} {grade(prov_pct)}")
    print()
    
    # Fully rich events
    cur.execute("""
        SELECT ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM events), 1)
        FROM events
        WHERE description IS NOT NULL AND LENGTH(description) > 50
        AND start_time IS NOT NULL
        AND image_url IS NOT NULL AND image_url != ''
        AND ticket_url IS NOT NULL AND ticket_url != ''
    """)
    rich_pct = cur.fetchone()[0]
    
    print(f"🌟 FULLY RICH (4/4): {progress_bar(rich_pct)} {grade(rich_pct)}")
    print()
    
    # Source health
    cur.execute("""
        WITH source_health AS (
            SELECT
                s.id,
                MAX(e.updated_at) as last_event
            FROM sources s
            LEFT JOIN events e ON e.source_id = s.id
            WHERE s.is_active = true
            GROUP BY s.id
        )
        SELECT
            COUNT(CASE WHEN last_event > NOW() - INTERVAL '7 days' THEN 1 END) as tier1,
            COUNT(CASE WHEN last_event > NOW() - INTERVAL '30 days' AND last_event <= NOW() - INTERVAL '7 days' THEN 1 END) as tier2,
            COUNT(CASE WHEN last_event IS NOT NULL AND last_event <= NOW() - INTERVAL '30 days' THEN 1 END) as tier3,
            COUNT(CASE WHEN last_event IS NULL THEN 1 END) as tier4
        FROM source_health
    """)

    tier1, tier2, tier3, tier4 = cur.fetchone()
    
    cur.execute("SELECT COUNT(*) FROM sources WHERE is_active = true")
    total_sources = cur.fetchone()[0]
    
    tier1_pct = (tier1 / total_sources * 100) if total_sources > 0 else 0
    tier2_pct = (tier2 / total_sources * 100) if total_sources > 0 else 0
    tier3_pct = (tier3 / total_sources * 100) if total_sources > 0 else 0
    tier4_pct = (tier4 / total_sources * 100) if total_sources > 0 else 0
    
    print("🔧 SOURCE HEALTH")
    print("─" * 80)
    print(f"Tier 1 (Healthy):      {progress_bar(tier1_pct, 40)} {tier1}/{total_sources}")
    print(f"Tier 2 (Warning):      {progress_bar(tier2_pct, 40)} {tier2}/{total_sources}")
    print(f"Tier 3 (Stale):        {progress_bar(tier3_pct, 40)} {tier3}/{total_sources}")
    print(f"Tier 4 (Never Active): {progress_bar(tier4_pct, 40)} {tier4}/{total_sources}")
    print()
    
    # Venue completeness
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            ROUND(100.0 * COUNT(CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 1 END) / COUNT(*), 1) as coords_pct,
            ROUND(100.0 * COUNT(CASE WHEN hours IS NOT NULL AND hours::text != '{}' THEN 1 END) / COUNT(*), 1) as hours_pct,
            ROUND(100.0 * COUNT(CASE WHEN vibes IS NOT NULL AND vibes::text NOT IN ('{}', '[]') THEN 1 END) / COUNT(*), 1) as vibes_pct
        FROM venues
    """)
    
    total_venues, coords_pct, hours_pct, vibes_pct = cur.fetchone()
    
    print("📍 VENUE COMPLETENESS")
    print("─" * 80)
    print(f"Coordinates:  {progress_bar(coords_pct)} {grade(coords_pct)}")
    print(f"Hours:        {progress_bar(hours_pct)} {grade(hours_pct)}")
    print(f"Vibes:        {progress_bar(vibes_pct)} {grade(vibes_pct)}")
    print()
    
    # Overall grade
    overall = (category_pct + time_pct + img_pct + ticket_pct + desc_pct + coords_pct + hours_pct) / 7
    
    print("╔════════════════════════════════════════════════════════════════════════════╗")
    print(f"║  OVERALL DATA QUALITY: {progress_bar(overall, 50)} {grade(overall):>4s}  ║")
    print("╚════════════════════════════════════════════════════════════════════════════╝")
    print()
    print(f"Database: {total_events:,} events across {total_venues:,} venues from {total_sources} sources")
    print()
    
    conn.close()

if __name__ == "__main__":
    main()
