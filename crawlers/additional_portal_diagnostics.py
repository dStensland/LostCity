"""
Additional portal diagnostics - future events (all) and additional details.
"""

import sys
sys.path.insert(0, '/Users/coach/Projects/LostCity/crawlers')

from db import get_client
from datetime import datetime

def format_results(title, results):
    """Pretty print query results."""
    print(f"\n{'='*80}")
    print(f"{title}")
    print(f"{'='*80}")
    if not results:
        print("(No results)")
        return
    
    if isinstance(results, list) and len(results) > 0:
        headers = list(results[0].keys())
        col_widths = [max(len(str(h)), max(len(str(row.get(h, ""))) for row in results)) for h in headers]
        
        header_row = " | ".join(f"{h:<{col_widths[i]}}" for i, h in enumerate(headers))
        print(header_row)
        print("-" * len(header_row))
        
        for row in results:
            row_vals = [str(row.get(h, "")).ljust(col_widths[i]) for i, h in enumerate(headers)]
            print(" | ".join(row_vals))
        
        print(f"\nTotal rows: {len(results)}")

def run_diagnostics():
    """Run additional diagnostic queries."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Query 1: All future events by portal
    print("\n[Query 1] ALL FUTURE EVENTS (start_date >= TODAY) grouped by portal")
    try:
        portals = client.table("portals").select("id, name, slug").execute().data or []
        query_results = []
        
        for portal in portals:
            events_result = (
                client.table("events")
                .select("id", count="exact")
                .eq("portal_id", portal["id"])
                .gte("start_date", today)
                .execute()
            )
            count = events_result.count or 0
            query_results.append({
                "portal_id": portal["id"][:8] + "...",
                "portal_name": portal["name"],
                "portal_slug": portal["slug"],
                "all_future_events": count
            })
        
        query_results.sort(key=lambda x: x["all_future_events"], reverse=True)
        format_results("Query 1: ALL Future Events by Portal", query_results)
        
        # Summary stats
        total_future = sum(row["all_future_events"] for row in query_results)
        print(f"\nGrand total of all future events across all portals: {total_future}")
        
    except Exception as e:
        print(f"Error in Query 1: {e}")
    
    # Query 2: Events with source info for unassigned events
    print("\n[Query 2] NULL portal events - top sources contributing to unassignment")
    try:
        events = (
            client.table("events")
            .select("source_id")
            .is_("portal_id", "null")
            .gte("start_date", today)
            .execute()
        ).data or []
        
        source_counts = {}
        for event in events:
            source_id = event.get("source_id")
            source_counts[source_id] = source_counts.get(source_id, 0) + 1
        
        # Get source names
        source_ids = list(source_counts.keys())
        if source_ids:
            sources_data = (
                client.table("sources")
                .select("id, name, slug")
                .in_("id", source_ids[:50])  # Limit to first 50 to avoid query size issues
                .execute()
            ).data or []
            
            source_map = {s["id"]: s for s in sources_data}
            
            query_results = []
            for source_id, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
                source = source_map.get(source_id)
                query_results.append({
                    "source_id": source_id,
                    "source_name": source["name"] if source else "UNKNOWN",
                    "source_slug": source["slug"] if source else "unknown",
                    "unassigned_event_count": count
                })
            
            format_results("Query 2: Sources Contributing Unassigned Events (Top 20)", query_results)
        else:
            print("No unassigned future events found")
            
    except Exception as e:
        print(f"Error in Query 2: {e}")
    
    # Query 3: Portal coverage statistics
    print("\n[Query 3] Portal coverage - % of events by portal")
    try:
        portals = client.table("portals").select("id, name, slug").execute().data or []
        query_results = []
        
        # Get total future events
        total_result = (
            client.table("events")
            .select("id", count="exact")
            .gte("start_date", today)
            .execute()
        )
        total_events = total_result.count or 0
        
        for portal in portals:
            events_result = (
                client.table("events")
                .select("id", count="exact")
                .eq("portal_id", portal["id"])
                .gte("start_date", today)
                .execute()
            )
            count = events_result.count or 0
            pct = (count / total_events * 100) if total_events > 0 else 0
            query_results.append({
                "portal_name": portal["name"],
                "portal_slug": portal["slug"],
                "events": count,
                "percent_of_total": f"{pct:.1f}%"
            })
        
        query_results.sort(key=lambda x: x["events"], reverse=True)
        query_results.append({
            "portal_name": "TOTAL",
            "portal_slug": "-",
            "events": total_events,
            "percent_of_total": "100.0%"
        })
        
        format_results("Query 3: Portal Coverage Statistics", query_results)
        
    except Exception as e:
        print(f"Error in Query 3: {e}")
    
    # Query 4: Venue distribution for Atlanta portal
    print("\n[Query 4] Atlanta portal - top 15 venues by event count (next 30 days)")
    try:
        atlanta_portal = (
            client.table("portals")
            .select("id")
            .eq("slug", "atlanta")
            .single()
            .execute()
        ).data
        
        if atlanta_portal:
            from datetime import timedelta
            atlanta_id = atlanta_portal["id"]
            in_30_days = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
            
            events = (
                client.table("events")
                .select("venue_id")
                .eq("portal_id", atlanta_id)
                .gte("start_date", today)
                .lte("start_date", in_30_days)
                .execute()
            ).data or []
            
            venue_counts = {}
            for event in events:
                venue_id = event.get("venue_id")
                venue_counts[venue_id] = venue_counts.get(venue_id, 0) + 1
            
            # Get venue names for top venues
            venue_ids = sorted(venue_counts.keys(), key=lambda v: venue_counts[v], reverse=True)[:20]
            
            if venue_ids:
                venues_data = (
                    client.table("venues")
                    .select("id, name, neighborhood, venue_type")
                    .in_("id", venue_ids)
                    .execute()
                ).data or []
                
                venue_map = {v["id"]: v for v in venues_data}
                
                query_results = []
                for venue_id in venue_ids[:15]:
                    count = venue_counts[venue_id]
                    venue = venue_map.get(venue_id)
                    query_results.append({
                        "venue_name": venue["name"] if venue else "UNKNOWN",
                        "neighborhood": venue.get("neighborhood", "") if venue else "",
                        "venue_type": venue.get("venue_type", "") if venue else "",
                        "event_count": count
                    })
                
                format_results("Query 4: Top 15 Venues in Atlanta (Next 30 Days)", query_results)
            else:
                print("No venue data found")
        else:
            print("Atlanta portal not found")
            
    except Exception as e:
        print(f"Error in Query 4: {e}")
    
    print(f"\n{'='*80}")
    print("Additional diagnostics complete")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    run_diagnostics()
