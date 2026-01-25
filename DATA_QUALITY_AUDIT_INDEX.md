# Data Quality Audit - Complete Documentation

**Audit Date:** January 24, 2026  
**Auditor:** Data Quality Specialist  
**Database:** Lost City Events (1,000 events, 50+ sources)

---

## Quick Start

**If you want to:**
- 🎯 **Get the big picture** → Read [DATA_QUALITY_SUMMARY.md](DATA_QUALITY_SUMMARY.md)
- 🔧 **Start fixing issues** → Follow [FIXES_PRIORITY_LIST.md](FIXES_PRIORITY_LIST.md)
- 📊 **Understand root causes** → See [DATA_QUALITY_REPORT.md](DATA_QUALITY_REPORT.md)
- 🔍 **Visualize the problems** → Check [DATA_PIPELINE_ISSUES.md](DATA_PIPELINE_ISSUES.md)

---

## Documents Overview

### 1. Executive Summary (Start Here)
**File:** [DATA_QUALITY_SUMMARY.md](DATA_QUALITY_SUMMARY.md)  
**Read Time:** 3 minutes  
**Contents:**
- Issues found (table format)
- Top problem sources
- Fix implementation phases
- Success metrics (before/after)
- Key takeaways

**Best for:** Stakeholders, project managers, quick overview

---

### 2. Priority Fix List (For Developers)
**File:** [FIXES_PRIORITY_LIST.md](FIXES_PRIORITY_LIST.md)  
**Read Time:** 5 minutes  
**Contents:**
- Immediate fixes (25 min)
- High priority fixes (2 hours)
- Medium priority fixes (next week)
- Verification checklist
- File paths and line numbers

**Best for:** Developers ready to implement fixes

---

### 3. Full Diagnostic Report (Technical Deep Dive)
**File:** [DATA_QUALITY_REPORT.md](DATA_QUALITY_REPORT.md)  
**Read Time:** 15 minutes  
**Contents:**
- Detailed analysis of each issue
- Sample problematic records
- Root cause analysis
- Recommended code changes (with examples)
- Validation queries
- Prevention strategies

**Best for:** Technical leads, architects, documentation

---

### 4. Pipeline Visualization (Visual Learners)
**File:** [DATA_PIPELINE_ISSUES.md](DATA_PIPELINE_ISSUES.md)  
**Read Time:** 10 minutes  
**Contents:**
- ASCII diagrams of data flow
- Where each issue occurs in pipeline
- Bottleneck analysis
- Recommended validation guards
- Future monitoring setup

**Best for:** Visual thinkers, onboarding new devs

---

## Audit Scripts

### Main Audit Script
**File:** `/Users/coach/Projects/LostCity/crawlers/data_quality_audit.py`  
**Purpose:** Run comprehensive health checks on database

**Usage:**
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python data_quality_audit.py
```

**Output:** Console report with 8 diagnostic sections:
1. Events missing critical fields
2. Venues without coordinates
3. Price inconsistencies
4. Recent crawl errors (7 days)
5. Suspicious midnight times
6. Events missing category
7. Low confidence extractions
8. Source statistics

**Schedule:** Run after implementing fixes, then weekly

---

### Detailed Diagnostics Script
**File:** `/Users/coach/Projects/LostCity/crawlers/detailed_diagnostics.py`  
**Purpose:** Deep dive into specific issues with sample records

**Usage:**
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python detailed_diagnostics.py
```

**Output:** Sample records showing:
- Missing field patterns
- Crawl error details
- Venue quality issues
- Time extraction problems

**Use when:** Investigating a specific issue in depth

---

## Key Findings Summary

### Critical Issues (Fix Immediately)
1. **357 events (36%)** missing venue_id → unfilterable by location
2. **5 crawlers (10%)** failing with 'soup' NameError → 0 events collected
3. **3 sources** returning 404 → crawlers fail every run
4. **20 venues** missing coordinates → not shown on map

### Impact Assessment
- **User Impact:** 36% of events can't be found via map/location search
- **Crawler Impact:** 10% of sources failing every run
- **Data Completeness:** 64% quality score (should be >95%)

### Root Causes
1. No fallback for online/virtual events → NULL venue_id
2. Copy-paste errors from scraper templates → undefined variables
3. Website URLs changed → 404 errors
4. Geocoding not automated → missing coordinates

---

## Implementation Roadmap

### ✅ Phase 1: Immediate (Today - 25 min)
**Goal:** Stop error spam, prevent failed crawls

**Tasks:**
- Fix 5 'soup' NameErrors (5 min each)
- Mark 3 404 sources as inactive

**Verification:**
```bash
python main.py -s bookish-atlanta  # Should succeed
python data_quality_audit.py       # Should show 0 soup errors
```

---

### ✅ Phase 2: High Priority (This Week - 2 hours)
**Goal:** Fix 357 events missing venue_id, enable map for all venues

**Tasks:**
1. Add `get_or_create_virtual_venue()` to db.py (30 min)
2. Update Eventbrite crawler with fallback (30 min)
3. Update Meetup crawler with fallback (30 min)
4. Run geocoding script (15 min)

**Verification:**
```sql
-- Should return 0
SELECT COUNT(*) FROM events WHERE venue_id IS NULL;

-- Should show virtual venue used for online events
SELECT COUNT(*) FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.slug = 'online-virtual';
```

---

### ✅ Phase 3: Medium Priority (Next Week - 2 hours)
**Goal:** Restore broken sources, improve data quality

**Tasks:**
- Investigate 404 sources, update URLs or mark inactive (1 hour)
- Fix Georgia State Athletics away games (30 min)
- Fix Access Atlanta midnight times (30 min)

**Verification:**
```bash
python data_quality_audit.py
# Should show:
# - 0 critical field issues
# - 0 crawl errors
# - 0 coordinate issues
```

---

## Success Criteria

### Before Fixes
- ❌ 357/1000 events (36%) missing venue_id
- ❌ 5/50 sources (10%) failing every run
- ❌ 20 venues not mappable
- ❌ 50 errors in last 7 days
- ❌ Quality Score: **64%**

### After Fixes
- ✅ 0/1000 events (0%) missing venue_id
- ✅ 0/50 sources (0%) failing
- ✅ 0 active venues without coordinates
- ✅ <5 errors in last 7 days (transient only)
- ✅ Quality Score: **100%**

---

## Files Changed (Implementation Checklist)

### New Files Created
- ✅ `/Users/coach/Projects/LostCity/crawlers/data_quality_audit.py`
- ✅ `/Users/coach/Projects/LostCity/crawlers/detailed_diagnostics.py`
- ✅ `/Users/coach/Projects/LostCity/DATA_QUALITY_REPORT.md`
- ✅ `/Users/coach/Projects/LostCity/FIXES_PRIORITY_LIST.md`
- ✅ `/Users/coach/Projects/LostCity/DATA_QUALITY_SUMMARY.md`
- ✅ `/Users/coach/Projects/LostCity/DATA_PIPELINE_ISSUES.md`
- ✅ `/Users/coach/Projects/LostCity/DATA_QUALITY_AUDIT_INDEX.md` (this file)

### Files to Modify
- ⏳ `/Users/coach/Projects/LostCity/crawlers/db.py` - Add virtual venue function
- ⏳ `/Users/coach/Projects/LostCity/crawlers/sources/eventbrite.py` - Fix venue fallback
- ⏳ `/Users/coach/Projects/LostCity/crawlers/sources/meetup.py` - Fix venue fallback
- ⏳ `/Users/coach/Projects/LostCity/crawlers/sources/bookish_atlanta.py` - Remove soup ref
- ⏳ `/Users/coach/Projects/LostCity/crawlers/sources/atlanta_cultural_affairs.py` - Remove soup
- ⏳ `/Users/coach/Projects/LostCity/crawlers/sources/wild_aster_books.py` - Remove soup
- ⏳ `/Users/coach/Projects/LostCity/crawlers/sources/sun_dial_restaurant.py` - Remove soup
- ⏳ `/Users/coach/Projects/LostCity/crawlers/sources/kats_cafe.py` - Remove soup

Legend: ✅ Done | ⏳ To Do

---

## Questions & Support

### Common Questions

**Q: Why are so many events missing venue_id?**  
A: Many events are online/virtual (Meetup, Eventbrite webinars), and we had no fallback venue for them. Also, away games (Georgia State Athletics) have no venue data in source JSON-LD.

**Q: Can I just delete events with NULL venue_id?**  
A: No! These are valid events, users want to see them. We need to assign them to an "Online/Virtual" venue so they're still searchable.

**Q: Why do some crawlers reference 'soup' without defining it?**  
A: Copy-paste error. These crawlers generate events from hardcoded data (recurring book clubs, annual festivals) and don't actually scrape HTML, but the template code was left in.

**Q: How often should we run the audit?**  
A: Weekly after fixes are implemented. Can be automated via cron job.

**Q: What's the priority order for fixes?**  
A: 
1. Fix 'soup' errors (25 min) - prevents ongoing failures
2. Create virtual venue system (2 hours) - fixes 357 events
3. Fix 404s and other issues (next week)

---

## Next Steps

1. **Review** this index and choose your starting document
2. **Run** the audit script to see current state
3. **Implement** fixes following priority list
4. **Verify** after each phase with audit script
5. **Automate** weekly audit runs

---

## Contact

**Data Quality Specialist:** Available for questions  
**Slack:** #data-quality  
**Email:** data-quality@lostcity.com

**Repository:** `/Users/coach/Projects/LostCity`  
**Last Updated:** 2026-01-24
