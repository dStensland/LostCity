"""Quick check of weekend event counts."""
from config import get_config
from db import get_client

config = get_config()
client = get_client()

print("Querying weekend events...")

# Simple count query first
result = client.table("events").select(
    "id", count="exact"
).gte("start_date", "2026-02-13").lte("start_date", "2026-02-15").execute()

print(f"Total events for Feb 13-15: {result.count}")

# Get a sample
sample = client.table("events").select(
    "id, title, start_date, category"
).gte("start_date", "2026-02-13").lte("start_date", "2026-02-15").limit(10).execute()

print("\nSample events:")
for e in sample.data:
    print(f"  {e['start_date']} - {e['title']} ({e.get('category', 'N/A')})")
