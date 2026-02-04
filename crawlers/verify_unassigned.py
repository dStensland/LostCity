#!/usr/bin/env python3
"""Verify unassigned events after fixing query."""

from datetime import datetime
from collections import Counter
from db import get_client

def verify_unassigned():
    client = get_client()
    
    # Get all events with source and portal info
    result = client.table('events').select(
        'id, portal_id, source_id, sources(name)'
    ).gte('start_date', datetime.now().strftime('%Y-%m-%d')).execute()
    
    # Filter for NULL portal_id in Python
    unassigned_events = [e for e in result.data if e.get('portal_id') is None]
    
    print(f"Total future events: {len(result.data)}")
    print(f"Unassigned events (portal_id IS NULL): {len(unassigned_events)}")
    print(f"Assigned events: {len(result.data) - len(unassigned_events)}\n")
    
    # Get source breakdown
    source_counts = Counter()
    for event in unassigned_events:
        source = event.get('sources')
        source_name = source['name'] if source else 'Unknown'
        source_counts[source_name] += 1
    
    print("Unassigned events by source:")
    print("-" * 60)
    for source, count in source_counts.most_common():
        print(f"{source:.<50} {count:>4}")
    
    print(f"\nTotal sources with unassigned events: {len(source_counts)}")

if __name__ == "__main__":
    verify_unassigned()
