# Family Content Plan A: Fix & Unlock + Data Quality

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 6,000+ invisible events/programs visible, fix nightlife leak, and add age tag inference so filtering works.

**Architecture:** All migrations + one web query fix + one Python inference script. No new crawlers. Each task is independent — can be dispatched in parallel.

**Tech Stack:** SQL migrations (Supabase), Next.js API routes, Python

---

### Task 1: Subscribe 17 missing sources to family portal

**Files:**
- Create: `supabase/migrations/20260322900000_family_source_subscriptions_batch.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Subscribe program sources that produce family content but aren't subscribed to the family portal.
-- These sources have events/programs attributed to atlanta-families but their events
-- can't surface through the portal's federation system without source_subscriptions rows.

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT p.id, s.id, 'all', true
FROM portals p
CROSS JOIN (
    SELECT id FROM sources WHERE slug IN (
        'atlanta-family-programs',
        'dekalb-family-programs',
        'club-scikidz-atlanta',
        'gwinnett-family-programs',
        'woodward-summer-camps',
        'mjcca-day-camps',
        'walker-summer-programs',
        'pace-summer-programs',
        'lovett-summer-programs',
        'gwinnett-ehc',
        'girl-scouts-greater-atlanta-camps',
        'cobb-family-programs',
        'wesleyan-summer-camps',
        'marist-school',
        'callanwolde-fine-arts-center',
        'trinity-summer-camps',
        'gwinnett-adult-swim-lessons'
    )
) s
WHERE p.slug = 'atlanta-families'
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
```

- [ ] **Step 2: Push the migration**

```bash
cd /Users/coach/Projects/LostCity && npx supabase db push
```

- [ ] **Step 3: Verify events are now visible**

```bash
cd crawlers && python3 -c "
from db.client import get_client
sb = get_client()
portal = sb.table('portals').select('id').eq('slug', 'atlanta-families').single().execute()
subs = sb.table('source_subscriptions').select('source_id', count='exact').eq('subscriber_portal_id', portal.data['id']).execute()
print(f'Family portal now has {subs.count} subscribed sources')
"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260322900000_family_source_subscriptions_batch.sql
git commit -m "feat(data): subscribe 17 program sources to family portal — +3,400 events, +2,622 programs"
```

---

### Task 2: Fix nightlife content gate

**Files:**
- Modify: `web/app/api/timeline/route.ts` (add exclude_categories passthrough)
- Modify: `web/app/api/events/route.ts` (add exclude_categories passthrough)
- Reference: `web/lib/portal-query-context.ts:78-81` (parses exclude_categories)
- Reference: `web/lib/event-search.ts` (applies .neq filter; formerly `web/lib/search.ts`)

**Context:** Portal config has `exclude_categories: ['nightlife']` but the timeline and events API routes don't pass this through to the SearchFilters object. The exclusion logic exists in `event-search.ts` but never fires because the field isn't populated.

- [ ] **Step 1: Read timeline/route.ts to find where SearchFilters are built**

Find where the `filters` object is constructed and passed to the search/query function. Add `exclude_categories` from `portalContext.filters`.

- [ ] **Step 2: Add exclude_categories to timeline API filters**

In the filters object construction, add:
```typescript
exclude_categories: portalContext?.filters?.exclude_categories,
```

- [ ] **Step 3: Add exclude_categories to events API filters**

Same change in `web/app/api/events/route.ts`.

- [ ] **Step 4: Verify the nightlife events are excluded**

```bash
curl -s "http://localhost:3000/api/events?portal=atlanta-families&limit=200" | python3 -c "
import json,sys
data = json.load(sys.stdin)
events = data.get('events', data.get('data', []))
nightlife = [e for e in events if e.get('category_id') == 'nightlife' or e.get('category') == 'nightlife']
print(f'Nightlife events in family portal: {len(nightlife)} (should be 0)')
"
```

- [ ] **Step 5: Type-check and commit**

```bash
cd web && npx tsc --noEmit
git add web/app/api/timeline/route.ts web/app/api/events/route.ts
git commit -m "fix(api): enforce exclude_categories from portal config — removes nightlife from family portal"
```

---

### Task 3: Reactivate dormant family sources

**Files:**
- Create: `supabase/migrations/20260322900001_reactivate_family_sources.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Reactivate family-relevant sources that were deactivated but have crawlable content.
UPDATE sources SET is_active = true
WHERE slug IN ('sky-zone-atlanta', 'gigis-playhouse-atlanta', 'decatur-recreation')
  AND is_active = false;
```

- [ ] **Step 2: Push and commit**

```bash
npx supabase db push
git add supabase/migrations/20260322900001_reactivate_family_sources.sql
git commit -m "feat(data): reactivate Sky Zone, Gigi's Playhouse, Decatur Rec for family portal"
```

---

### Task 4: Age tag inference engine

**Files:**
- Create: `crawlers/age_inference.py`
- Reference: `crawlers/sources/_activecommunities_family_filter.py:149-186` (age patterns to reuse)

**Context:** 85% of family portal events have no age_min/age_max. Build a batch inference script that tags events from title patterns, venue type, and source defaults.

- [ ] **Step 1: Create the inference script**

```python
"""
Batch age tag inference for family portal events.

Infers age_min/age_max from:
1. Title patterns ("ages 5-12", "for kids", "teen", "preschool", "toddler")
2. Venue type defaults (children's museum → 0-12, library storytime → 0-5)
3. Source-level defaults (family program sources → 0-17)

Only updates events where BOTH age_min AND age_max are NULL.
Never overwrites existing age data.

Usage:
    python3 age_inference.py --dry-run          # Preview what would be tagged
    python3 age_inference.py --apply            # Apply tags to production
    python3 age_inference.py --portal atlanta-families --apply  # Scope to portal
"""

import re
import argparse
import sys
sys.path.insert(0, '.')
from db.client import get_client

# Age patterns from _activecommunities_family_filter.py (proven patterns)
AGE_PATTERNS = [
    re.compile(r"ages?\s+(\d+)\s*[-\u2013to]+\s*(\d+)", re.IGNORECASE),
    re.compile(r"\((\d+)\s*[-\u2013]+\s*(\d+)\s*(?:yrs?|years?|yo)\)", re.IGNORECASE),
    re.compile(r"grades?\s+(\d+)\s*[-\u2013to]+\s*(\d+)", re.IGNORECASE),
    re.compile(r"(\d+)\s*(?:and|&)\s*(?:up|older|above)", re.IGNORECASE),
    re.compile(r"(?:under|below)\s*(\d+)", re.IGNORECASE),
]

# Title keyword → age range defaults
KEYWORD_AGE_DEFAULTS = {
    "toddler": (1, 3),
    "preschool": (3, 5),
    "pre-k": (3, 5),
    "kindergarten": (5, 6),
    "elementary": (5, 10),
    "tween": (10, 13),
    "teen": (13, 17),
    "youth": (5, 17),
    "junior": (6, 12),
    "storytime": (0, 5),
    "story time": (0, 5),
    "mommy and me": (0, 3),
    "mommy & me": (0, 3),
    "baby": (0, 2),
    "infant": (0, 1),
    "kids": (3, 12),
    "children": (3, 12),
}

# Venue type → age range defaults (conservative)
VENUE_TYPE_AGE_DEFAULTS = {
    "children_museum": (0, 12),
    "playground": (2, 10),
    "trampoline_park": (4, 17),
}


def infer_age_from_title(title: str):
    """Extract age range from event title using regex patterns."""
    if not title:
        return None, None

    title_lower = title.lower()

    # Try regex patterns first (most specific)
    for pattern in AGE_PATTERNS:
        m = pattern.search(title_lower)
        if m:
            groups = m.groups()
            if len(groups) == 2:
                a, b = int(groups[0]), int(groups[1])
                # Grade-to-age conversion
                if "grade" in pattern.pattern.lower():
                    a, b = a + 5, b + 5
                if 0 <= a <= 18 and 0 <= b <= 18 and a <= b:
                    return a, b
            elif len(groups) == 1:
                age = int(groups[0])
                if "under" in pattern.pattern.lower() or "below" in pattern.pattern.lower():
                    return 0, age
                else:  # "and up"
                    return age, 17

    # Try keyword defaults (less specific)
    for keyword, (age_min, age_max) in KEYWORD_AGE_DEFAULTS.items():
        if keyword in title_lower:
            return age_min, age_max

    return None, None


def run(dry_run=True, portal_slug=None):
    sb = get_client()

    # Get events with no age tags
    query = sb.table('events').select('id, title, source_id, venue_id').is_('age_min', 'null').is_('age_max', 'null').eq('is_active', True).gte('start_date', '2026-03-22')

    if portal_slug:
        # Scope to portal's subscribed sources
        portal = sb.table('portals').select('id').eq('slug', portal_slug).single().execute()
        subs = sb.table('source_subscriptions').select('source_id').eq('subscriber_portal_id', portal.data['id']).execute()
        source_ids = [s['source_id'] for s in subs.data]
        if source_ids:
            query = query.in_('source_id', source_ids)

    result = query.limit(5000).execute()
    events = result.data

    tagged = 0
    skipped = 0

    for event in events:
        age_min, age_max = infer_age_from_title(event['title'])

        if age_min is not None and age_max is not None:
            tagged += 1
            if not dry_run:
                sb.table('events').update({
                    'age_min': age_min,
                    'age_max': age_max,
                }).eq('id', event['id']).execute()
            else:
                if tagged <= 20:
                    print(f"  Would tag: {event['title'][:60]} → ages {age_min}-{age_max}")
        else:
            skipped += 1

    print(f"\n{'DRY RUN' if dry_run else 'APPLIED'}: {tagged} tagged, {skipped} skipped, {len(events)} total")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--portal", type=str, default=None)
    args = parser.parse_args()

    run(dry_run=not args.apply, portal_slug=args.portal)
```

- [ ] **Step 2: Test with dry-run**

```bash
cd crawlers && python3 age_inference.py --dry-run --portal atlanta-families
```

Expected: Shows 20 sample events that would be tagged, with total count.

- [ ] **Step 3: Apply to production**

```bash
cd crawlers && python3 age_inference.py --apply --portal atlanta-families
```

- [ ] **Step 4: Commit**

```bash
git add crawlers/age_inference.py
git commit -m "feat(crawlers): add age tag inference engine — bulk-tags family events from title patterns"
```
