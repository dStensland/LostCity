# Data Quality Quick Reference

## Current Status (2026-02-16)

### Metrics
- **Total Events**: 18,358
- **Duplicates**: 0 ✓
- **Invalid Categories**: 0 ✓
- **Garbage Titles**: 0 ✓
- **Description Coverage**: 95.2% ✓
- **Start Time Coverage**: 93.3% ✓

### Health Checks (Run These Periodically)

```bash
# Quick verification script
python3 << 'SCRIPT'
from db import get_client
from collections import defaultdict, Counter
import re

supabase = get_client()

# Fetch all events
all_events = []
offset = 0
while True:
    batch = supabase.table("events").select("id, title, venue_id, start_date, category").range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_events.extend(batch.data)
    offset += 1000

print(f"Total events: {len(all_events)}")

# Check duplicates
groups = defaultdict(list)
for e in all_events:
    key = (e["title"], e["venue_id"], e["start_date"])
    groups[key].append(e)
dupes = sum(len(v) - 1 for v in groups.values() if len(v) > 1)
print(f"Duplicates: {dupes} {'✓' if dupes == 0 else '✗'}")

# Check invalid categories
valid_cats = {"music","film","comedy","theater","art","sports","food_drink","nightlife","community","fitness","family","learning","dance","tours","meetup","words","religious","markets","wellness","support_group","gaming","outdoors","other"}
invalid = sum(1 for e in all_events if e.get("category") not in valid_cats)
print(f"Invalid categories: {invalid} {'✓' if invalid == 0 else '✗'}")

# Check garbage titles
garbage = sum(1 for e in all_events if re.match(r'^\d{1,2}/\d{1,2}/\d{2,4}$', e["title"]) or len(e["title"]) < 3)
print(f"Garbage titles: {garbage} {'✓' if garbage == 0 else '✗'}")

# Check frequent titles (potential permanent attractions)
title_counts = Counter(e["title"] for e in all_events)
frequent = sum(1 for c in title_counts.values() if c > 50)
print(f"Titles >50x: {frequent} (review manually)")
SCRIPT
```

### SQL Health Checks

```sql
-- Duplicates (should be 0)
SELECT COUNT(*) FROM (
  SELECT title, venue_id, start_date, COUNT(*) as cnt
  FROM events
  GROUP BY title, venue_id, start_date
  HAVING COUNT(*) > 1
) dupes;

-- Invalid categories (should be 0)
SELECT COUNT(*) FROM events
WHERE category NOT IN (
  'music','film','comedy','theater','art','sports','food_drink','nightlife',
  'community','fitness','family','learning','dance','tours','meetup','words',
  'religious','markets','wellness','support_group','gaming','outdoors','other'
);

-- Garbage titles (should be 0)
SELECT COUNT(*) FROM events
WHERE length(title) < 3
   OR title ~ '^\d{1,2}/\d{1,2}/\d{2,4}$'
   OR title ~ '^https?://';

-- Potential permanent attractions (review list)
SELECT title, COUNT(*) FROM events
WHERE start_date >= CURRENT_DATE
GROUP BY title
HAVING COUNT(*) > 50
ORDER BY COUNT(*) DESC;
```

## Fix Scripts

### Delete Duplicates
```python
from db import get_client
from collections import defaultdict

supabase = get_client()

# Fetch events
all_events = []
offset = 0
while True:
    batch = supabase.table("events").select("id, title, venue_id, start_date, created_at").range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_events.extend(batch.data)
    offset += 1000

# Find duplicates
groups = defaultdict(list)
for e in all_events:
    key = (e["title"], e["venue_id"], e["start_date"])
    groups[key].append(e)

# Delete newer duplicates
for key, events in groups.items():
    if len(events) > 1:
        sorted_events = sorted(events, key=lambda x: x["created_at"])
        for dupe in sorted_events[1:]:
            supabase.table("events").update({"canonical_event_id": None}).eq("canonical_event_id", dupe["id"]).execute()
            supabase.table("events").delete().eq("id", dupe["id"]).execute()
            print(f"Deleted duplicate: {dupe['id']}")
```

### Fix Invalid Categories
```python
from db import get_client

supabase = get_client()

valid_cats = [
    "music","film","comedy","theater","art","sports","food_drink","nightlife",
    "community","fitness","family","learning","dance","tours","meetup","words",
    "religious","markets","wellness","support_group","gaming","outdoors","other"
]

result = supabase.table("events").select("id, title, category").execute()
for e in result.data:
    if e["category"] not in valid_cats:
        # Map to closest valid category or "other"
        if e["category"] == "literary":
            new_cat = "words"
        else:
            new_cat = "other"
        supabase.table("events").update({"category": new_cat}).eq("id", e["id"]).execute()
        print(f"Fixed: {e['title']} - {e['category']} → {new_cat}")
```

### Delete Permanent Attractions
```python
from db import get_client

supabase = get_client()

# Replace with actual title
permanent_title = "Historic Square: A Collection Of Georgia Homes and Antiques"

result = supabase.table("events").select("id").eq("title", permanent_title).execute()
for event in result.data:
    supabase.table("events").update({"canonical_event_id": None}).eq("canonical_event_id", event["id"]).execute()
    supabase.table("events").delete().eq("id", event["id"]).execute()
    print(f"Deleted: {event['id']}")
```

## P1 Tasks

1. **Event Series Grouping** - 115 high-frequency titles need series
2. **GSU Sports Venue Assignment** - Link 100 "Vs" games to Center Parc Stadium
3. **Title Normalization** - Clean up short/all-caps titles

## Reference Files

- `/Users/coach/Projects/LostCity/crawlers/P0_FIXES_COMPLETE_REPORT.md` - Full report
- `/Users/coach/Projects/LostCity/crawlers/fix_data_quality.py` - Main fix script
- `/Users/coach/Projects/LostCity/crawlers/fix_remaining_issues.py` - Additional fixes
- `/Users/coach/Projects/LostCity/crawlers/CLAUDE.md` - Project guidelines
