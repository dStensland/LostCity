# Portal Event Distribution - Summary Report

**Generated:** February 4, 2026 12:13 AM  
**Interactive Report:** `/web/public/diagnostics/events-by-portal.html`

## Quick Access

```bash
# Regenerate the report
cd /Users/coach/Projects/LostCity/crawlers
python3 generate_portal_report.py

# Open in browser
open /Users/coach/Projects/LostCity/web/public/diagnostics/events-by-portal.html

# View detailed diagnostic
cat /Users/coach/Projects/LostCity/crawlers/reports/portal_distribution_diagnostic.md
```

## Overview

The portal distribution report visualizes 1,000 upcoming events across LostCity's multi-portal system. It provides:

1. **Portal Summary** - Event counts per portal (Atlanta, Nashville, Piedmont, Unassigned)
2. **Daily Breakdown** - 60-day forecast showing events per portal per day
3. **Category Distribution** - Content mix analysis (music, comedy, nightlife, arts, etc.)
4. **Unassigned Events** - Sources requiring portal assignment

## Current State (Feb 4, 2026)

```
┌─────────────────────┬────────────┬─────────┐
│ Portal              │ Events     │ % Share │
├─────────────────────┼────────────┼─────────┤
│ Atlanta             │ 677        │ 67.7%   │
│ LostCity Nashville  │ 208        │ 20.8%   │
│ Unassigned          │ 114        │ 11.4%   │
│ Piedmont Healthcare │ 1          │  0.1%   │
├─────────────────────┼────────────┼─────────┤
│ TOTAL               │ 1,000      │ 100%    │
└─────────────────────┴────────────┴─────────┘
```

## Key Findings

### 1. Atlanta Dominance (Expected)
- 67.7% of all events
- Mature crawler coverage with 50+ active sources
- Well-balanced category distribution

### 2. Nashville Growing (On Track)
- 20.8% of events (208 total)
- Newer market launched in late 2025
- Music-heavy (appropriate for Nashville)
- Need to expand family and arts sources

### 3. Unassigned Events (Needs Attention)
- 114 events (11.4%) lack portal assignment
- 23 sources need portal_id configuration
- All appear to be Atlanta-area venues
- Easy fix: add portal_id to source files

### 4. Piedmont Portal (As Expected)
- 1 event (wellness/health-focused portal)
- Low volume is intentional
- Specialty portal for healthcare events

## Action Items

### High Priority: Fix Unassigned Sources

Top 5 sources to fix (covers 59 of 114 unassigned events):

```python
# 1. Ferst Center for the Arts (16 events)
# File: crawlers/sources/ferst_center.py
from db import get_portal_id_by_slug
PORTAL_ID = get_portal_id_by_slug("atlanta")

# 2. Zoo Atlanta (14 events)
# File: crawlers/sources/zoo_atlanta.py
PORTAL_ID = get_portal_id_by_slug("atlanta")

# 3. City of College Park (10 events)
# File: crawlers/sources/college_park.py
PORTAL_ID = get_portal_id_by_slug("atlanta")

# 4. Ebenezer Baptist Church (10 events)
# File: crawlers/sources/ebenezer_baptist.py
PORTAL_ID = get_portal_id_by_slug("atlanta")

# 5. Fernbank Museum (9 events)
# File: crawlers/sources/fernbank.py
PORTAL_ID = get_portal_id_by_slug("atlanta")
```

Then add to each event:
```python
event_data["portal_id"] = PORTAL_ID
```

### Medium Priority: Validation & Monitoring

1. **Add Portal Validation**
   - Update `crawlers/db.py::insert_event()` to require portal_id
   - Log warning when portal_id is missing
   - Prevent future unassigned events

2. **Weekly Monitoring**
   - Re-run report weekly
   - Alert if unassigned > 5%
   - Track portal growth trends

### Low Priority: Nashville Expansion

- Goal: 500+ Nashville events (parity with Atlanta)
- Add more Nashville-specific sources
- Expand beyond music to family/arts/sports

## Data Quality Assessment

### Strengths
- No duplicate portal assignments (clean data model)
- No invalid portal_ids (FK constraints working)
- Fast query performance (<5s for 1,000 events)
- Proper NULL handling (no empty strings)

### Weaknesses
- 11.4% unassigned events (should be <5%)
- Nashville category diversity needs work
- Some sources created before portal system existed

### Recommendations
- Require portal_id on all new sources
- Backfill existing unassigned sources
- Add portal_id to source activation checklist

## Report Features

The HTML report includes:

### 1. Interactive Visualizations
- Stacked bar charts (daily breakdown)
- Color-coded portal segments
- Hover tooltips with counts
- Responsive design (mobile-friendly)

### 2. No External Dependencies
- 100% self-contained HTML
- Inline CSS for styling
- No JavaScript libraries
- Works offline

### 3. Portal Legend
- Atlanta: Blue (#667eea)
- Nashville: Pink (#f093fb)
- Piedmont: Teal (#4bc0c8)
- Unassigned: Red (#f5576c)

### 4. Detailed Tables
- Source-level breakdown for unassigned events
- Category counts per portal
- Daily event density

## Technical Details

### Database Queries

The report runs 4 main queries:

1. **Portal Summary** - Aggregate counts by portal
2. **Daily Counts** - Events per portal per day (60 days)
3. **Category Breakdown** - Category distribution per portal
4. **Unassigned Sources** - Source attribution for NULL portal_id

### Known Gotchas

**Supabase `.is_()` Filter Bug:**
```python
# ❌ BROKEN - Returns ALL events, not just NULL
result = client.table('events').select('*').is_('portal_id', 'null')

# ✅ FIXED - Filter in Python after fetching
result = client.table('events').select('*').execute()
unassigned = [e for e in result.data if e.get('portal_id') is None]
```

### File Locations

```
crawlers/
├── generate_portal_report.py           # Main script
├── debug_unassigned.py                 # Debug helper
├── verify_unassigned.py                # Verification script
├── README_PORTAL_REPORT.md             # User guide
└── reports/
    └── portal_distribution_diagnostic.md  # Detailed analysis

web/public/diagnostics/
└── events-by-portal.html               # Generated report
```

## Usage Examples

### Regenerate After Fixing Sources
```bash
# Fix a source
vim crawlers/sources/ferst_center.py
# Add: PORTAL_ID = get_portal_id_by_slug("atlanta")
# Add to events: event_data["portal_id"] = PORTAL_ID

# Re-run crawler
python3 crawlers/main.py --source ferst-center

# Regenerate report
cd crawlers && python3 generate_portal_report.py

# View changes
open /Users/coach/Projects/LostCity/web/public/diagnostics/events-by-portal.html
```

### Debug Specific Source
```bash
# Check which events from a source are unassigned
cd crawlers
python3 -c "
from db import get_client
client = get_client()
result = client.table('events').select('id, title, portal_id, sources(name)').execute()
for e in result.data:
    if e['sources']['name'] == 'Ferst Center for the Arts' and e['portal_id'] is None:
        print(e['title'])
"
```

### Monitor Portal Growth
```bash
# Run weekly and compare totals
cd crawlers
python3 generate_portal_report.py | grep "events"

# Output:
#   - Atlanta: 677 events
#   - LostCity Nashville: 208 events
#   - Unassigned: 114 events
```

## Related Documentation

- **Crawler Strategy:** `/crawlers/CRAWLER_STRATEGY.md`
- **City Onboarding:** `/crawlers/CITY_ONBOARDING_PLAYBOOK.md`
- **Portal RLS Policies:** `/database/migrations/111_fix_nashville_portal_isolation.sql`
- **Detailed Analysis:** `/crawlers/reports/portal_distribution_diagnostic.md`

## Changelog

**v1.0 - Feb 4, 2026**
- Initial release
- Fixed Supabase `.is_()` filter bug
- Added daily breakdown visualization
- Added category distribution analysis
- Added unassigned source tracking

---

**Maintainer:** Data Quality Team  
**Report Generator:** `crawlers/generate_portal_report.py`  
**Update Frequency:** Run on-demand or weekly
