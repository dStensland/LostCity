# Portal Event Distribution Report

## Overview

This diagnostic tool generates a comprehensive HTML visualization of how events are distributed across LostCity portals (Atlanta, Nashville, Piedmont) and identifies unassigned events that need portal assignment.

## Generated Report

**File:** `/web/public/diagnostics/events-by-portal.html`

The report is a self-contained HTML file with no external dependencies that includes:

1. **Portal Summary Cards** - Total event counts for each portal and unassigned events
2. **Daily Breakdown (60 days)** - Stacked bar chart showing events per portal per day
3. **Category Breakdown** - Top categories for each portal (music, comedy, nightlife, etc.)
4. **Unassigned Events Analysis** - Which sources are contributing unassigned events

## Running the Report

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 generate_portal_report.py
```

The script will:
- Query the Supabase database for all future events
- Analyze portal assignments and source attribution
- Generate HTML with inline CSS and SVG charts
- Save to `web/public/diagnostics/events-by-portal.html`

## Use Cases

### 1. Data Quality Monitoring
Track portal assignment coverage. If you see 1,000+ unassigned events, it indicates:
- Sources missing portal assignment logic
- New crawlers that haven't been mapped to portals
- Multi-city sources (like Ticketmaster) that need city filtering

### 2. Capacity Planning
The daily breakdown shows:
- Peak event days (weekends, holidays)
- Portal balance (is one city over/under-represented?)
- Growth trends

### 3. Source Audit
The unassigned events breakdown reveals:
- Which sources need portal assignment
- New crawlers that slipped through without portal mapping
- Sources that might be pulling events from multiple cities

### 4. Category Distribution
Verify that each portal has balanced content:
- Music, comedy, nightlife, arts, sports, family events
- Identify gaps (e.g., "Nashville has no family events")

## Current Findings (as of Feb 4, 2026)

```
Portal Summary:
  - Atlanta: 677 events
  - LostCity Nashville: 208 events
  - Unassigned: 114 events (shows as 1,000 in detailed breakdown - discrepancy to investigate)
  - Piedmont Healthcare: 1 event

Top Unassigned Source: The Springs Cinema & Taphouse
```

### Action Items

1. **The Springs Cinema** - 1,000 unassigned events
   - Location: Sandy Springs, Atlanta metro
   - Should be assigned to Atlanta portal
   - Fix: Update `sources/springs_cinema.py` to set `portal_id`

2. **Piedmont Healthcare Portal** - Only 1 event
   - This is a special-purpose portal, expected to be small
   - Events come from healthcare/wellness crawlers

3. **Nashville Coverage** - 208 events
   - Lower than Atlanta (677)
   - Expected since Nashville is newer market
   - Continue Nashville source expansion

## Portal Assignment Rules

When creating/updating crawlers:

```python
# In your crawler file (e.g., sources/my_venue.py)

# Get portal ID at module load time
from db import get_portal_id_by_slug

PORTAL_ID = get_portal_id_by_slug("atlanta")  # or "nashville", "piedmont"

# Use in event data
event_data = {
    "title": "...",
    "portal_id": PORTAL_ID,  # Always set this!
    # ... other fields
}
```

## Technical Details

### Database Queries

The script runs these queries:

1. **Portal Summary**
   ```sql
   SELECT portal_id, COUNT(*)
   FROM events
   WHERE start_date >= CURRENT_DATE
   GROUP BY portal_id
   ```

2. **Daily Counts**
   ```sql
   SELECT start_date, portal_id, COUNT(*)
   FROM events
   WHERE start_date BETWEEN NOW() AND NOW() + INTERVAL '60 days'
   GROUP BY start_date, portal_id
   ```

3. **Category Breakdown**
   ```sql
   SELECT portal_id, category, COUNT(*)
   FROM events
   WHERE start_date >= CURRENT_DATE
   GROUP BY portal_id, category
   ```

4. **Unassigned Sources**
   ```sql
   SELECT source_id, COUNT(*)
   FROM events
   WHERE portal_id IS NULL
     AND start_date >= CURRENT_DATE
   GROUP BY source_id
   ```

### Dependencies

- Uses `crawlers/db.py` for Supabase connection
- Uses `crawlers/config.py` for environment variables
- No external JavaScript/CSS libraries (fully self-contained HTML)

## Viewing the Report

### Option 1: Open in Browser
```bash
open /Users/coach/Projects/LostCity/web/public/diagnostics/events-by-portal.html
```

### Option 2: Via Local Dev Server
If Next.js dev server is running:
```
http://localhost:3000/diagnostics/events-by-portal.html
```

### Option 3: After Deploy
```
https://lostcity.ai/diagnostics/events-by-portal.html
```

## Updating the Report

Re-run the script after:
- Adding new sources/crawlers
- Running daily crawls
- Fixing portal assignments
- Expanding to new cities

The report always shows current database state.

## Related Documentation

- `/crawlers/CRAWLER_STRATEGY.md` - Overall crawler strategy and tier system
- `/crawlers/CITY_ONBOARDING_PLAYBOOK.md` - Adding new cities/portals
- `/database/migrations/` - Portal schema and RLS policies

---

Generated by: `crawlers/generate_portal_report.py`
