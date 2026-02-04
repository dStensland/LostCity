#!/usr/bin/env python3
"""Debug script to investigate unassigned event count discrepancy."""

from datetime import datetime
from collections import Counter
from db import get_client

def debug_unassigned():
    client = get_client()
    
    # Query 1: Count via select with portal join
    print("Query 1: Via portals join...")
    result1 = client.table('events').select(
        'id, portal_id, portals(name, slug)'
    ).gte('start_date', datetime.now().strftime('%Y-%m-%d')).execute()
    
    unassigned_with_join = [e for e in result1.data if e.get('portals') is None]
    print(f"  Unassigned (via join): {len(unassigned_with_join)}")
    
    # Query 2: Count via is null filter
    print("\nQuery 2: Via is null filter...")
    result2 = client.table('events').select(
        'id, source_id, sources(name)'
    ).is_('portal_id', 'null').gte(
        'start_date', datetime.now().strftime('%Y-%m-%d')
    ).execute()
    
    print(f"  Unassigned (via is null): {len(result2.data)}")
    
    # Get source breakdown
    source_counts = Counter()
    for event in result2.data:
        source = event.get('sources')
        source_name = source['name'] if source else 'Unknown'
        source_counts[source_name] += 1
    
    print("\nTop 10 sources with unassigned events:")
    for source, count in source_counts.most_common(10):
        print(f"  {source}: {count}")
    
    # Check if there are events with portal_id = '' (empty string) vs NULL
    print("\nQuery 3: Checking for empty string portal_ids...")
    result3 = client.table('events').select(
        'id, portal_id'
    ).gte('start_date', datetime.now().strftime('%Y-%m-%d')).execute()
    
    null_count = 0
    empty_string_count = 0
    has_value_count = 0
    
    for event in result3.data:
        portal_id = event.get('portal_id')
        if portal_id is None:
            null_count += 1
        elif portal_id == '':
            empty_string_count += 1
        else:
            has_value_count += 1
    
    print(f"  NULL portal_id: {null_count}")
    print(f"  Empty string portal_id: {empty_string_count}")
    print(f"  Has portal_id: {has_value_count}")
    print(f"  Total: {null_count + empty_string_count + has_value_count}")

if __name__ == "__main__":
    debug_unassigned()
