# Data Quality Audit - Executive Summary
**Date:** February 16, 2026  
**Status:** NEEDS ATTENTION - 5 P0 Issues Identified

---

## Database State
- **Total Events:** 18,773
- **Total Venues:** 3,905
- **Active Sources:** 547
- **Data Completeness:** 98.7% (230 events missing venue_id)

---

## Critical Issues (P0)

| Issue | Count | Fix Time | Action |
|-------|-------|----------|--------|
| Invalid categories | 1 | 1 min | Run SQL UPDATE |
| Duplicate events | 123 | 5 min | Run SQL DELETE |
| Permanent attractions | 288 | 5 min + 4-6 hrs | SQL DELETE + crawler fixes |
| NULL venue_id | 230 | 30 min | Fix crawlers |
| Missing coordinates | 466 | 15 min | Run enrichment script |

**Total Fix Time:** 30 min immediate + 4-6 hours crawler work

---

## Quick Start

### Immediate Fixes (30 minutes)

```bash
cd /Users/coach/Projects/LostCity

# 1. Run SQL fixes
psql [connection] -f QUICK_FIXES.sql

# 2. Run venue enrichment
cd crawlers
python3 venue_enrich.py

# 3. Verify
psql [connection] << EOF
SELECT 
    COUNT(*) as total_events,
    COUNT(CASE WHEN venue_id IS NULL THEN 1 END) as null_venue,
    COUNT(CASE WHEN category IS NULL THEN 1 END) as null_category
FROM events;
EOF
```

**Expected Result:**
- Total events: ~17,800 (down from 18,773)
- NULL venue: ~155 (only GSU Sports + Eventbrite - acceptable)
- NULL category: 0

---

## Crawler Fixes Needed (4-6 hours)

10 crawlers need fixes to properly use series grouping:

1. sources/stone_mountain_park.py - Skip permanent exhibitions
2. sources/third_and_lindsley.py - Series for weekly shows
3. sources/atlanta_recurring_social.py - Verify series
4. sources/aa_atlanta.py - Series for meetings
5. sources/na_georgia.py - Series for meetings
6. sources/callanwolde.py - Series for classes
7. sources/atlanta_fulton_library.py - Series for classes
8. sources/shepherd_center.py - Series for programs
9. sources/mobilize.py - Verify volunteer shift series
10. sources/ticketmaster.py - Enhance Opry titles

See CRAWLER_FIXES_NEEDED.md for detailed instructions.

---

## Data Health Highlights

### Good
- No far future events (>365 days)
- No orphaned events from deleted sources
- All events have valid categories (after fix)
- Only 20 past events (within 7 days - acceptable)
- 3,168 "dead" venues are OK per CLAUDE.md philosophy

### Needs Attention
- 28.87% of events are support_group (AA/NA) - should be series
- Nightlife only 2.77% - undercovered, needs more crawlers
- 193 active sources have 0 events - need health check

---

## Category Distribution

```
support_group    28.87%  (Convert to series to reduce feed spam)
community        15.67%
music            14.06%
learning          9.84%
sports            6.30%
art               4.60%
family            4.14%
nightlife         2.77%  (Needs more coverage)
[others]         13.75%
```

---

## Post-Fix Expected State

After running all fixes:

- ~17,800 events (stable, clean)
- All events have venues (except ~155 online/away games)
- No duplicates
- No permanent attractions masquerading as events
- All venues geocoded (except virtual venues)
- Support group events properly grouped in series
- Ready for production crawl

---

## Files Generated

1. DATA_QUALITY_AUDIT_2026-02-16.md - Full detailed report
2. QUICK_FIXES.sql - Immediate SQL fixes
3. CRAWLER_FIXES_NEEDED.md - Crawler work checklist
4. DATA_QUALITY_EXECUTIVE_SUMMARY.md - This file

---

## Validation After Fixes

```sql
-- Run this to verify database is clean
SELECT 
    'Total Events' as metric, 
    COUNT(*)::text as value 
FROM events
UNION ALL
SELECT 
    'Missing Venue', 
    COUNT(*)::text 
FROM events 
WHERE venue_id IS NULL
UNION ALL
SELECT 
    'Invalid Category', 
    COUNT(*)::text 
FROM events 
WHERE category NOT IN ('music', 'film', 'comedy', 'theater', 'art', 'sports', 'food_drink', 'nightlife', 'community', 'fitness', 'family', 'learning', 'dance', 'tours', 'meetup', 'words', 'religious', 'markets', 'wellness', 'support_group', 'gaming', 'outdoors', 'other')
UNION ALL
SELECT 
    'Duplicate Groups', 
    COUNT(*)::text 
FROM (
    SELECT title, venue_id, start_date 
    FROM events 
    GROUP BY title, venue_id, start_date 
    HAVING COUNT(*) > 1
) dup
UNION ALL
SELECT 
    'Venues Missing Coords', 
    COUNT(*)::text 
FROM venues 
WHERE lat IS NULL OR lng IS NULL;
```

**Expected Results:**
- Total Events: ~17,800
- Missing Venue: <200
- Invalid Category: 0
- Duplicate Groups: 0
- Venues Missing Coords: <50

---

## Next Steps

1. **Immediate (30 min):** Run QUICK_FIXES.sql + venue_enrich.py
2. **Short-term (4-6 hrs):** Fix 10 crawlers per CRAWLER_FIXES_NEEDED.md
3. **Ongoing:** 
   - Monitor 193 sources with 0 events
   - Add nightlife crawlers (only 2.77% coverage)
   - Consider filtering AA/NA from default feed (28.87% of events)

---

## Contact

For questions about:
- **SQL fixes:** See QUICK_FIXES.sql
- **Crawler fixes:** See CRAWLER_FIXES_NEEDED.md
- **Full details:** See DATA_QUALITY_AUDIT_2026-02-16.md

---

**Bottom Line:** Database is 98.7% healthy. Run 30 minutes of quick fixes, then schedule 4-6 hours for crawler improvements. After that, we're ready for production crawl.
