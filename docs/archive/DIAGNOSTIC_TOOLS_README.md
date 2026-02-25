# Portal Distribution Diagnostic Tools

## Overview

Two diagnostic scripts have been created to analyze the portal distribution of events in the LostCity platform. These scripts query the Supabase database and provide detailed insights into:

1. Event distribution across portals
2. Unassigned events (NULL portal_id)
3. 30-day event projections
4. Category distribution
5. Top venues and contributing sources

## Files Created

### 1. Main Diagnostic Report
**File:** `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md`

Comprehensive analysis document containing:
- Executive summary of portal distribution
- 5 detailed query results with tables
- 3 identified data quality issues with root causes
- Recommended action plan (4 phases)
- SQL validation queries
- Metrics and monitoring suggestions

**Key Findings:**
- 8,160 total future events across platform
- 1,052 events (11.4%) have NULL portal_id (CRITICAL)
- 69.2% of events in Atlanta portal (concentration)
- Cinema crawlers + Ticketmaster account for 53% of unassigned events

### 2. Initial Diagnostics Script
**File:** `/Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py`

Runs 4 core queries:
1. Future events by portal (with names)
2. Count of events with NULL portal_id
3. 30-day event distribution by portal
4. Atlanta portal 30-day events by category

**Usage:**
```bash
cd /Users/coach/Projects/LostCity/crawlers
/usr/bin/python3 portal_distribution_diagnostics.py
```

**Output Sample:**
```
Query 1: Future events (start_date >= TODAY) grouped by portal
Query 2: Future events with NULL portal_id
Query 3: Events in next 30 days grouped by portal
Query 4: Atlanta portal events (next 30 days) by category
```

### 3. Extended Diagnostics Script
**File:** `/Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py`

Runs 4 extended queries:
1. ALL future events by portal (no date limit)
2. Top sources contributing unassigned events
3. Portal coverage statistics (% of platform)
4. Atlanta top 15 venues by event count

**Usage:**
```bash
cd /Users/coach/Projects/LostCity/crawlers
/usr/bin/python3 additional_portal_diagnostics.py
```

## Database Schema

The diagnostics query these core tables:

### `events`
- `id` (INT): Event unique identifier
- `title` (TEXT): Event name
- `start_date` (DATE): Event date
- `portal_id` (UUID): Portal assignment (nullable - **the issue**)
- `category` (TEXT): Event category
- `venue_id` (INT): Venue reference
- `source_id` (INT): Crawler source reference
- `content_hash` (TEXT): Deduplication hash

### `portals`
- `id` (UUID): Portal unique identifier
- `name` (VARCHAR): Display name
- `slug` (VARCHAR): URL-friendly identifier
- `status` (VARCHAR): 'active', 'draft', 'archived'

### `sources`
- `id` (INT): Source crawler ID
- `name` (VARCHAR): Display name
- `slug` (VARCHAR): Unique identifier
- `is_active` (BOOLEAN): Whether actively crawling

### `venues`
- `id` (INT): Venue unique identifier
- `name` (VARCHAR): Venue name
- `neighborhood` (VARCHAR): Geographic neighborhood
- `venue_type` (VARCHAR): Type (bar, theater, stadium, etc.)

## Connection Details

Both scripts use the Supabase client configured in:

**Config:** `/Users/coach/Projects/LostCity/crawlers/config.py`
- Loads `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from environment
- Configured for Supabase PostgreSQL backend

**Database module:** `/Users/coach/Projects/LostCity/crawlers/db.py`
- Provides `get_client()` function
- All Supabase table operations
- Connection pooling and retry logic

## Data Quality Issues Identified

### CRITICAL: Portal Assignment Gap
- **Count:** 1,052 events (11.4% of platform)
- **Root cause:** Sources not setting portal_id during event insert
- **Top contributors:** Cinema crawlers (211-55 events each), Ticketmaster (126)
- **Impact:** Events invisible in portal-scoped queries

### WARNING: Event Concentration
- **Count:** 69.2% of events in Atlanta portal
- **Root cause:** Limited source activation for other portals
- **Impact:** Unbalanced user experience across portals

### LOW: Inactive Portals
- **Count:** 3 portals with 0 events
- **Root cause:** Created but no sources assigned
- **Impact:** Schema clutter, development confusion

## Recommended Fixes

### Immediate (Day 1)
1. Update cinema crawlers to set `portal_id = atlanta_uuid`
2. Update Ticketmaster crawler for portal assignment
3. Backfill NULL portal_id using geo-matching
4. Document portal assignment requirements

### Short-term (Days 2-3)
1. Add NOT NULL constraint to events.portal_id
2. Add foreign key validation
3. Audit all active sources
4. Create validation test suite

### Medium-term (Week 1)
1. Activate Nashville sources
2. Activate Piedmont sources
3. Archive unused test portals
4. Document portal provisioning

### Ongoing Monitoring
1. Dashboard metric: % events with valid portal_id
2. Crawl log warnings for NULL portal_id
3. Weekly source audit
4. Portal concentration tracking

## Running the Diagnostics

### Option 1: Run both scripts
```bash
/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py
/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py
```

### Option 2: Direct Supabase query
Using the Supabase SQL editor, run the validation queries from the diagnostic report:

```sql
-- Find all unassigned events
SELECT 
    COUNT(*) as unassigned_count,
    COUNT(DISTINCT source_id) as source_count
FROM events
WHERE portal_id IS NULL
AND start_date >= CURRENT_DATE;
```

### Option 3: Integrate into crawler pipeline
Add periodic checks to `crawlers/main.py`:

```python
from portal_distribution_diagnostics import run_diagnostics

if __name__ == "__main__":
    # Run crawlers
    run_all_crawlers()
    
    # Validate portal distribution
    run_diagnostics()
```

## Monitoring Dashboard Metrics

Suggested metrics to track:

| Metric | Target | Current | Status |
|---|---|---|---|
| Portal assignment coverage | 100% | 87.1% | NEEDS FIX |
| Unassigned events | 0 | 1,052 | CRITICAL |
| Atlanta concentration | <75% | 69.2% | OK |
| Source activation rate | 100% | ~80% | WARNING |
| Portal event balance (Nashville:Atlanta) | 1:2 | 1:4.2 | LOW |
| Test portal cleanup | 0 | 3 | INFO |

## SQL Validation Queries

All validation queries are documented in the main diagnostic report (`PORTAL_DISTRIBUTION_DIAGNOSTIC.md`), including:
- Find all events needing portal assignment
- Find event distribution anomalies
- Verify cinema source backfill
- Calculate portal concentration
- Audit source activation

## Environment Requirements

**Python 3.9+**
- `supabase-py` (Supabase Python client)
- `python-dotenv` (environment variable loading)
- `pydantic` (configuration validation)

**Environment variables** (from `.env`):
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
```

## Next Steps

1. Review the diagnostic report: `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md`
2. Implement Phase 1 fixes (crawler updates)
3. Run validation queries to verify fixes
4. Re-run diagnostic scripts to confirm coverage improvement
5. Implement monitoring dashboard

## Contact

For questions about the diagnostics or data quality issues, refer to the crawler development guidelines in `/Users/coach/Projects/LostCity/crawlers/CLAUDE.md`.

