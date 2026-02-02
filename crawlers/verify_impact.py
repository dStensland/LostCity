#!/usr/bin/env python3
"""Verify the impact of the neighborhood fix on events."""

from db import get_client
from collections import Counter

client = get_client()

print("="*80)
print("NEIGHBORHOOD FIX IMPACT ANALYSIS")
print("="*80)
print()

# Get all events with their venue data
result = client.table('events').select('id, title, start_date, venue:venues(id, name, neighborhood)').execute()
events = result.data

total_events = len(events)
events_with_neighborhood = [e for e in events if e.get('venue') and e['venue'].get('neighborhood')]
events_without_neighborhood = [e for e in events if not e.get('venue') or not e['venue'].get('neighborhood')]

print(f"Total events: {total_events}")
print(f"Events with neighborhood: {len(events_with_neighborhood)} ({len(events_with_neighborhood)/total_events*100:.1f}%)")
print(f"Events without neighborhood: {len(events_without_neighborhood)} ({len(events_without_neighborhood)/total_events*100:.1f}%)")
print()

# Count by neighborhood
neighborhood_counts = Counter()
for event in events_with_neighborhood:
    hood = event['venue']['neighborhood']
    neighborhood_counts[hood] += 1

print("Top 15 neighborhoods by event count:")
print("-" * 80)
for hood, count in neighborhood_counts.most_common(15):
    print(f"  {hood:30} {count:4} events ({count/total_events*100:5.1f}%)")

print()
print("Total unique neighborhoods: ", len(neighborhood_counts))
print()

# Sample events without neighborhoods
print("Sample events without neighborhoods (first 10):")
print("-" * 80)
for i, event in enumerate(events_without_neighborhood[:10], 1):
    title = event.get('title', 'Unknown')[:50]
    venue_name = event.get('venue', {}).get('name', 'No venue') if event.get('venue') else 'No venue'
    print(f"{i:2}. {title:50} @ {venue_name}")
