"""
Portal distribution diagnostics for future events.
Runs 4 key queries to understand event coverage across portals.
"""

import sys
sys.path.insert(0, '/Users/coach/Projects/LostCity/crawlers')

from db import get_client
from datetime import datetime, timedelta

def format_results(title, results):
    """Pretty print query results."""
    print(f"\n{'='*80}")
    print(f"{title}")
    print(f"{'='*80}")
    if not results:
        print("(No results)")
        return
    
    if isinstance(results, list) and len(results) > 0:
        # Print column headers
        headers = list(results[0].keys())
        col_widths = [max(len(str(h)), max(len(str(row.get(h, ""))) for row in results)) for h in headers]
        
        header_row = " | ".join(f"{h:<{col_widths[i]}}" for i, h in enumerate(headers))
        print(header_row)
        print("-" * len(header_row))
        
        # Print rows
        for row in results:
            row_vals = [str(row.get(h, "")).ljust(col_widths[i]) for i, h in enumerate(headers)]
            print(" | ".join(row_vals))
        
        print(f"\nTotal rows: {len(results)}")

def run_diagnostics():
    """Run all diagnostic queries."""
    client = get_client()
    
    # Query 1: Future events by portal
    print("\n[Query 1] Future events (start_date >= TODAY) grouped by portal")
    try:
        result = client.rpc(
            "raw_sql",
            {
                "query": """
                SELECT 
                    p.id,
                    p.name as portal_name,
                    p.slug as portal_slug,
                    COUNT(e.id) as event_count
                FROM portals p
                LEFT JOIN events e ON p.id = e.portal_id 
                    AND e.start_date >= CURRENT_DATE
                GROUP BY p.id, p.name, p.slug
                ORDER BY event_count DESC
                """
            }
        ).execute()
        
        # Fallback: Use Supabase client to fetch and calculate
        portals = client.table("portals").select("id, name, slug").execute().data or []
        query_results = []
        
        for portal in portals:
            events_result = (
                client.table("events")
                .select("id", count="exact")
                .eq("portal_id", portal["id"])
                .gte("start_date", datetime.now().strftime("%Y-%m-%d"))
                .execute()
            )
            count = events_result.count or 0
            query_results.append({
                "portal_id": portal["id"],
                "portal_name": portal["name"],
                "portal_slug": portal["slug"],
                "event_count": count
            })
        
        # Sort by count descending
        query_results.sort(key=lambda x: x["event_count"], reverse=True)
        format_results("Query 1: Future Events by Portal", query_results)
        
    except Exception as e:
        print(f"Error in Query 1: {e}")
    
    # Query 2: Future events with NULL portal_id
    print("\n[Query 2] Future events with NULL portal_id")
    try:
        result = (
            client.table("events")
            .select("id", count="exact")
            .is_("portal_id", "null")
            .gte("start_date", datetime.now().strftime("%Y-%m-%d"))
            .execute()
        )
        null_portal_count = result.count or 0
        
        # Get some sample events
        samples = (
            client.table("events")
            .select("id, title, start_date, venue_id, source_id")
            .is_("portal_id", "null")
            .gte("start_date", datetime.now().strftime("%Y-%m-%d"))
            .limit(5)
            .execute()
        ).data or []
        
        print(f"\nTotal future events with NULL portal_id: {null_portal_count}")
        print(f"\nSample records (showing {len(samples)}):")
        format_results("Sample NULL portal events", samples)
        
    except Exception as e:
        print(f"Error in Query 2: {e}")
    
    # Query 3: 30-day distribution by portal
    print("\n[Query 3] Events in next 30 days grouped by portal")
    today = datetime.now().strftime("%Y-%m-%d")
    in_30_days = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    try:
        portals = client.table("portals").select("id, name, slug").execute().data or []
        query_results = []
        
        for portal in portals:
            events_result = (
                client.table("events")
                .select("id", count="exact")
                .eq("portal_id", portal["id"])
                .gte("start_date", today)
                .lte("start_date", in_30_days)
                .execute()
            )
            count = events_result.count or 0
            query_results.append({
                "portal_id": portal["id"],
                "portal_name": portal["name"],
                "portal_slug": portal["slug"],
                "events_next_30_days": count
            })
        
        query_results.sort(key=lambda x: x["events_next_30_days"], reverse=True)
        format_results("Query 3: Events in Next 30 Days by Portal", query_results)
        
    except Exception as e:
        print(f"Error in Query 3: {e}")
    
    # Query 4: Atlanta portal 30-day events by category
    print("\n[Query 4] Atlanta portal events (next 30 days) by category")
    try:
        # Get Atlanta portal ID
        atlanta_portal = (
            client.table("portals")
            .select("id")
            .eq("slug", "atlanta")
            .single()
            .execute()
        ).data
        
        if atlanta_portal:
            atlanta_id = atlanta_portal["id"]
            
            # Get events with their categories
            events = (
                client.table("events")
                .select("id, category")
                .eq("portal_id", atlanta_id)
                .gte("start_date", today)
                .lte("start_date", in_30_days)
                .execute()
            ).data or []
            
            # Count by category
            category_counts = {}
            for event in events:
                cat = event.get("category") or "uncategorized"
                category_counts[cat] = category_counts.get(cat, 0) + 1
            
            query_results = [
                {"category": cat, "event_count": count}
                for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
            ]
            
            total = sum(row["event_count"] for row in query_results)
            query_results.insert(0, {"category": "TOTAL", "event_count": total})
            
            format_results("Query 4: Atlanta Portal 30-Day Events by Category", query_results)
        else:
            print("Atlanta portal not found")
            
    except Exception as e:
        print(f"Error in Query 4: {e}")
    
    print(f"\n{'='*80}")
    print("Diagnostics complete")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    run_diagnostics()
