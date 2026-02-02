#!/usr/bin/env python3
"""Quick check of category data."""
from db import get_client
from collections import Counter

client = get_client()
result = client.table('events').select('category, tags').execute()

print("Category distribution:")
cats = Counter(e.get('category') or 'none' for e in result.data)
for cat, count in cats.most_common(20):
    print(f"  {cat}: {count}")

print("\nTag distribution:")
all_tags = []
for e in result.data:
    if e.get('tags'):
        all_tags.extend(e['tags'])
tag_counts = Counter(all_tags)
for tag, count in tag_counts.most_common(20):
    print(f"  {tag}: {count}")
