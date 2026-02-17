#!/usr/bin/env python3
"""
Query explore tracks data for content migration work.
Runs 7 diagnostic queries and outputs full results.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from config import get_config

config = get_config()

def run_query(conn, title: str, sql: str):
    """Execute a SQL query and print formatted results."""
    print(f"\n{'='*80}")
    print(f"QUERY: {title}")
    print(f"{'='*80}\n")
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            
            if not rows:
                print("(No results)")
                return
            
            # Print header
            headers = list(rows[0].keys())
            col_widths = {}
            for h in headers:
                col_widths[h] = max(len(str(h)), max(len(str(row[h])) if row[h] is not None else 4 for row in rows))
                col_widths[h] = min(col_widths[h], 60)  # Cap at 60 chars
            
            header_line = " | ".join(str(h).ljust(col_widths[h]) for h in headers)
            print(header_line)
            print("-" * len(header_line))
            
            # Print rows
            for row in rows:
                values = []
                for h in headers:
                    val = str(row[h]) if row[h] is not None else "NULL"
                    if len(val) > col_widths[h]:
                        val = val[:col_widths[h]-3] + "..."
                    values.append(val.ljust(col_widths[h]))
                print(" | ".join(values))
            
            print(f"\nTotal rows: {len(rows)}")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

# Connect to database
print("Connecting to database...")
conn = psycopg2.connect(config.database.database_url)

try:
    # Query 1: All tracks with venue counts
    run_query(
        conn,
        "1. All tracks with venue counts",
        """
        SELECT t.id, t.slug, t.name, COUNT(tv.id) as venue_count 
        FROM explore_tracks t 
        LEFT JOIN explore_track_venues tv ON tv.track_id = t.id AND tv.status = 'approved'
        GROUP BY t.id ORDER BY t.sort_order;
        """
    )

    # Query 2: Venues missing blurbs
    run_query(
        conn,
        "2. Venues missing editorial blurbs",
        """
        SELECT tv.id as tv_id, tv.is_featured, tv.editorial_blurb, t.slug as track_slug, 
               v.name, v.slug as venue_slug, v.neighborhood, v.venue_type, 
               v.data_quality, v.image_url IS NOT NULL as has_image
        FROM explore_track_venues tv
        JOIN explore_tracks t ON t.id = tv.track_id
        JOIN venues v ON v.id = tv.venue_id
        WHERE tv.status = 'approved' AND tv.editorial_blurb IS NULL
        ORDER BY tv.is_featured DESC, t.slug, v.name;
        """
    )

    # Query 3: Busy Bee Cafe duplicate
    run_query(
        conn,
        "3. Busy Bee Cafe duplicate in The Itis",
        """
        SELECT tv.id, tv.editorial_blurb, tv.is_featured, tv.sort_order, 
               v.name, v.slug, v.id as venue_id
        FROM explore_track_venues tv
        JOIN venues v ON v.id = tv.venue_id
        JOIN explore_tracks t ON t.id = tv.track_id
        WHERE t.slug = 'the-itis' AND v.name ILIKE '%busy bee%';
        """
    )

    # Query 4: Bloated tracks
    run_query(
        conn,
        "4. Bloated tracks - venues to potentially trim",
        """
        SELECT t.slug as track_slug, tv.id as tv_id, v.name, v.slug as venue_slug, 
               v.neighborhood, v.data_quality, v.image_url IS NOT NULL as has_image, 
               tv.editorial_blurb IS NOT NULL as has_blurb, tv.is_featured, tv.upvote_count
        FROM explore_track_venues tv
        JOIN explore_tracks t ON t.id = tv.track_id
        JOIN venues v ON v.id = tv.venue_id
        WHERE tv.status = 'approved' AND t.slug IN ('a-beautiful-mosaic', 'artefacts-of-the-lost-city', 'the-itis', 'up-on-the-roof')
        ORDER BY t.slug, tv.is_featured DESC, tv.upvote_count DESC, v.data_quality DESC NULLS LAST;
        """
    )

    # Query 5: Venues missing short_description
    run_query(
        conn,
        "5. Venues missing short_description that are in tracks",
        """
        SELECT DISTINCT v.id, v.slug, v.name, v.venue_type, v.neighborhood
        FROM venues v
        JOIN explore_track_venues tv ON tv.venue_id = v.id AND tv.status = 'approved'
        WHERE v.short_description IS NULL
        ORDER BY v.name;
        """
    )

    # Query 6: Highlight coverage per track
    run_query(
        conn,
        "6. Highlight coverage per track",
        """
        SELECT t.slug, COUNT(DISTINCT tv.venue_id) as total_venues,
               COUNT(DISTINCT vh.venue_id) as venues_with_highlights,
               ROUND(100.0 * COUNT(DISTINCT vh.venue_id) / NULLIF(COUNT(DISTINCT tv.venue_id), 0)) as pct
        FROM explore_tracks t
        JOIN explore_track_venues tv ON tv.track_id = t.id AND tv.status = 'approved'
        LEFT JOIN venue_highlights vh ON vh.venue_id = tv.venue_id
        GROUP BY t.slug
        ORDER BY pct NULLS FIRST;
        """
    )

    # Query 7: All track venues with full details
    run_query(
        conn,
        "7. All track venues with full details for source URL research",
        """
        SELECT t.slug as track_slug, v.name, v.slug as venue_slug, v.venue_type, 
               v.website, v.neighborhood, tv.id as tv_id
        FROM explore_track_venues tv
        JOIN explore_tracks t ON t.id = tv.track_id
        JOIN venues v ON v.id = tv.venue_id
        WHERE tv.status = 'approved'
        ORDER BY t.slug, v.name;
        """
    )

    print(f"\n{'='*80}")
    print("All queries complete")
    print(f"{'='*80}\n")

finally:
    conn.close()
