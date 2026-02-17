# Remaining Duplicates Issue - Foreign Key Constraints

**Status:** 82 duplicate event groups remaining (85 duplicate events)
**Cause:** Foreign key constraint `events_canonical_event_id_fkey`
**Blocker:** These events are referenced by other events' `canonical_event_id` field

---

## The Problem

When trying to delete duplicate events, 43 events failed with this error:

```
update or delete on table "events" violates foreign key constraint
"events_canonical_event_id_fkey" on table "events"
```

This means other events are pointing to these "duplicate" events via their `canonical_event_id` column, likely as part of the event series/canonicalization system.

---

## Failed Event IDs (Sample)

17636, 20291, 13916, 6273, 6282, 13915, 20686, 17519, 18460, 17612, 20690, 6287, 17714, 13909, 6270, and 28 more...

---

## Example Duplicate Groups Still Present

1. "The Monster Energy Outbreak Tour Presents Joey Valence & Brae" at venue 112 on 2026-02-17: 2 instances
2. "Club 90's - Heated Rivalry Night | 18+" at venue 112 on 2026-02-20: 2 instances
3. "Aurelio Voltaire - Between The Devil & The Demonatrix Tour" at venue 128 on 2026-02-21: 2 instances
4. "Club 90's - Heated Rivalry Night | 18+" at venue 112 on 2026-02-21: 2 instances
5. "Rozwell Rave | 18+" at venue 128 on 2026-02-27: 2 instances

---

## Resolution Steps

### Step 1: Find Child Events

Find all events that reference the duplicate canonical events:

```sql
SELECT e.id, e.title, e.start_date, e.canonical_event_id
FROM events e
WHERE e.canonical_event_id IN (
    6273, 6282, 13915, 20686, 17519, 18460, 17612, 20690,
    6287, 17714, 13909, 6270, 17636, 20291, 13916
    -- Add all failed IDs
)
ORDER BY e.canonical_event_id, e.start_date;
```

### Step 2: Analyze Canonical Relationships

Determine if the canonical event is:
- **A legitimate canonical event** → Keep it, delete the other duplicate
- **Itself a duplicate** → Point children to the "real" canonical event, then delete it

### Step 3: Update Child Events

For each duplicate canonical event that should be deleted:

```sql
-- Option A: Point children to the correct canonical event
UPDATE events
SET canonical_event_id = <correct_canonical_id>
WHERE canonical_event_id = <duplicate_canonical_id>;

-- Option B: Set to NULL if no other canonical exists
UPDATE events
SET canonical_event_id = NULL
WHERE canonical_event_id = <duplicate_canonical_id>;
```

### Step 4: Delete Duplicate Canonical Events

Once nothing references them:

```sql
DELETE FROM events
WHERE id IN (6273, 6282, 13915, ...);
```

---

## Why This Happened

The `canonical_event_id` system is designed to group related events (e.g., recurring series, multi-date events). When duplicates are created, they can become canonical events themselves, creating a chain of references that prevents deletion.

This likely happened because:
1. Crawlers ran multiple times on the same source data
2. Aggregator sources (Ticketmaster/Eventbrite) duplicated single-venue sources
3. The deduplication logic (`find_event_by_hash`) wasn't consistently applied

---

## Prevention

1. **Always call `find_event_by_hash()` before `insert_event()`** in all crawlers
2. **Review aggregator sources** — Per CLAUDE.md, aggregators should only cover venues without their own calendars
3. **Consider a unique constraint** on `(title, venue_id, start_date)` at the database level to prevent duplicates at insert time
4. **Add duplicate detection to CI** — Fail builds if duplicates are detected in staging

---

## Next Steps

1. Run the SQL queries above to understand the canonical relationships
2. Create a script to automatically fix common patterns (e.g., pointing children to the oldest canonical event)
3. Manually review edge cases
4. Re-run the cleanup script to verify all duplicates are gone
