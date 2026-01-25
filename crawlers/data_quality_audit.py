"""
Data Quality Audit Script
Runs comprehensive diagnostic queries to identify data quality issues.
"""

import sys
from db import get_client
from datetime import datetime, timedelta

def run_audit():
    """Run all diagnostic queries and generate report."""
    client = get_client()
    
    print("=" * 80)
    print("LOST CITY DATA QUALITY AUDIT")
    print(f"Generated: {datetime.now().isoformat()}")
    print("=" * 80)
    print()
    
    # 1. Events missing critical fields
    print("1. EVENTS MISSING CRITICAL FIELDS")
    print("-" * 80)
    try:
        result = client.table("events") \
            .select("source_id, sources(name)") \
            .or_("title.is.null,start_date.is.null,venue_id.is.null") \
            .execute()
        
        if result.data:
            # Count by source
            source_counts = {}
            for row in result.data:
                source_name = row.get('sources', {}).get('name', 'Unknown')
                source_counts[source_name] = source_counts.get(source_name, 0) + 1
            
            print(f"Total events with missing critical fields: {len(result.data)}")
            print("\nBy source:")
            for source, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"  {source}: {count}")
        else:
            print("No events missing critical fields - GOOD!")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n")
    
    # 2. Venues without coordinates
    print("2. VENUES WITHOUT COORDINATES")
    print("-" * 80)
    try:
        result = client.table("venues") \
            .select("id, name, address") \
            .or_("lat.is.null,lng.is.null") \
            .limit(20) \
            .execute()
        
        if result.data:
            print(f"Total venues missing coordinates: {len(result.data)}")
            print("\nSample venues:")
            for venue in result.data[:10]:
                print(f"  ID {venue['id']}: {venue['name']} - {venue.get('address', 'No address')}")
        else:
            print("All venues have coordinates - GOOD!")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n")
    
    # 3. Price inconsistencies
    print("3. PRICE INCONSISTENCIES")
    print("-" * 80)
    try:
        # Events with price_min > price_max
        result1 = client.table("events") \
            .select("id, title, price_min, price_max, sources(name)") \
            .not_.is_("price_min", "null") \
            .not_.is_("price_max", "null") \
            .execute()
        
        price_issues = [e for e in (result1.data or []) if e['price_min'] > e['price_max']]
        
        # Free events with prices
        result2 = client.table("events") \
            .select("id, title, price_min, is_free, sources(name)") \
            .eq("is_free", True) \
            .not_.is_("price_min", "null") \
            .execute()
        
        free_issues = [e for e in (result2.data or []) if e['price_min'] > 0]
        
        if price_issues or free_issues:
            print(f"Price min > max: {len(price_issues)}")
            if price_issues:
                for event in price_issues[:5]:
                    print(f"  ID {event['id']}: {event['title']} - ${event['price_min']} > ${event['price_max']}")
            
            print(f"\nFree events with prices: {len(free_issues)}")
            if free_issues:
                for event in free_issues[:5]:
                    source = event.get('sources', {}).get('name', 'Unknown')
                    print(f"  ID {event['id']}: {event['title']} - ${event['price_min']} ({source})")
        else:
            print("No price inconsistencies found - GOOD!")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n")
    
    # 4. Recent crawl error patterns
    print("4. RECENT CRAWL ERRORS (Last 7 days)")
    print("-" * 80)
    try:
        cutoff = (datetime.now() - timedelta(days=7)).isoformat()
        result = client.table("crawl_logs") \
            .select("sources(name), error_message, created_at") \
            .eq("status", "error") \
            .gte("started_at", cutoff) \
            .order("started_at", desc=True) \
            .limit(50) \
            .execute()
        
        if result.data:
            print(f"Total errors in last 7 days: {len(result.data)}")
            
            # Group by error message
            error_counts = {}
            for log in result.data:
                source = log.get('sources', {}).get('name', 'Unknown')
                error = log.get('error_message', 'No message')[:100]
                key = f"{source}: {error}"
                error_counts[key] = error_counts.get(key, 0) + 1
            
            print("\nMost common errors:")
            for error, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
                print(f"  [{count}x] {error}")
        else:
            print("No errors in last 7 days - GOOD!")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n")
    
    # 5. Events with suspicious times (midnight when not intentional)
    print("5. SUSPICIOUS MIDNIGHT START TIMES")
    print("-" * 80)
    try:
        result = client.table("events") \
            .select("id, title, start_time, category, sources(name)") \
            .eq("start_time", "00:00:00") \
            .eq("is_all_day", False) \
            .limit(30) \
            .execute()
        
        if result.data:
            # Filter out likely intentional midnight events (nightlife, music)
            suspicious = []
            for event in result.data:
                category = event.get('category', '')
                if category not in ['nightlife', 'music', 'dance']:
                    suspicious.append(event)
            
            print(f"Events at midnight (excluding nightlife/music): {len(suspicious)}")
            if suspicious:
                print("\nSample suspicious midnight events:")
                for event in suspicious[:10]:
                    source = event.get('sources', {}).get('name', 'Unknown')
                    print(f"  ID {event['id']}: {event['title']} ({event.get('category', 'no category')}) - {source}")
        else:
            print("No midnight events found")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n")
    
    # 6. Events missing category
    print("6. EVENTS MISSING CATEGORY")
    print("-" * 80)
    try:
        result = client.table("events") \
            .select("source_id, sources(name)") \
            .or_("category.is.null,category.eq.") \
            .execute()
        
        if result.data:
            source_counts = {}
            for row in result.data:
                source_name = row.get('sources', {}).get('name', 'Unknown')
                source_counts[source_name] = source_counts.get(source_name, 0) + 1
            
            print(f"Total events missing category: {len(result.data)}")
            print("\nBy source:")
            for source, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
                print(f"  {source}: {count}")
        else:
            print("All events have categories - GOOD!")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n")
    
    # 7. Events with low confidence scores
    print("7. LOW CONFIDENCE EXTRACTIONS")
    print("-" * 80)
    try:
        result = client.table("events") \
            .select("id, title, extraction_confidence, sources(name)") \
            .not_.is_("extraction_confidence", "null") \
            .lt("extraction_confidence", 0.7) \
            .limit(20) \
            .execute()
        
        if result.data:
            print(f"Events with confidence < 0.7: {len(result.data)}")
            print("\nSample low-confidence events:")
            for event in result.data[:10]:
                source = event.get('sources', {}).get('name', 'Unknown')
                conf = event.get('extraction_confidence', 0)
                print(f"  ID {event['id']}: {event['title']} (confidence: {conf:.2f}) - {source}")
        else:
            print("No low confidence events found - GOOD!")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n")
    
    # 8. Source statistics
    print("8. SOURCE STATISTICS")
    print("-" * 80)
    try:
        # Get event counts by source
        result = client.table("events") \
            .select("source_id, sources(name, is_active)") \
            .execute()
        
        if result.data:
            source_stats = {}
            for event in result.data:
                source_data = event.get('sources', {})
                source_name = source_data.get('name', 'Unknown')
                is_active = source_data.get('is_active', False)
                
                if source_name not in source_stats:
                    source_stats[source_name] = {'count': 0, 'is_active': is_active}
                source_stats[source_name]['count'] += 1
            
            print(f"Total events in database: {len(result.data)}")
            print("\nTop sources by event count:")
            for source, stats in sorted(source_stats.items(), key=lambda x: x[1]['count'], reverse=True)[:15]:
                active = "ACTIVE" if stats['is_active'] else "INACTIVE"
                print(f"  {source}: {stats['count']} events ({active})")
        else:
            print("No events found in database")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n")
    print("=" * 80)
    print("AUDIT COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    try:
        run_audit()
    except Exception as e:
        print(f"Fatal error running audit: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
