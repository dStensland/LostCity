# Crawl Readiness Assessment - Executive Summary

**Date:** February 9, 2026  
**Database:** LostCity Production  
**Assessed By:** Data Quality Specialist

---

## Overall Status: MODERATE - Immediate Action Required

### Critical Issues Identified

1. **Year Parsing Bug (HIGH SEVERITY)**
   - 265 events incorrectly dated in 2027 (should be 2026)
   - 41 sources affected
   - Users cannot see these events
   - **Action:** Delete 2027 events, add validation, fix top 6 sources

2. **Zero-Event Sources (MODERATE SEVERITY)**
   - 302 sources (74%) have no future events
   - Many are seasonal/annual (should be deactivated)
   - Some are active venues that should have events
   - **Action:** Categorize and triage, deactivate seasonal sources

3. **Network Connection Issues (MODERATE SEVERITY)**
   - 10+ sources failing with "[Errno 35] Resource temporarily unavailable"
   - Socket exhaustion from concurrent connections
   - **Action:** Reduce max_workers, add connection pooling

---

## Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Active Sources | 409 | ✅ Good |
| Future Events | 11,055 | ✅ Good |
| Events Next 7 Days | 1,000 | ⚠️ Low (should be 2-3K) |
| Sources Not Crawled in 3+ Days | 1 | ✅ Excellent |
| Recent Errors (2 days) | 20+ | ⚠️ Needs Attention |
| Sources With Zero Future Events | 302 (74%) | ❌ Critical |
| Events Misdated to 2027 | 265 | ❌ Critical |

---

## Immediate Actions (Today)

### 1. Fix Year Parsing Bug
```bash
# Delete incorrect 2027 events
python3 -c "from db import get_client; supabase = get_client(); supabase.table('events').delete().gte('start_date', '2027-01-01').execute()"

# Add validation to db.py (see detailed report)
# Fix top 6 sources: dekalb-library, pullman-yards, dads-garage, mjq-concourse, southeastern-stamp-expo, battery-atlanta
```

### 2. Fix Network Issues
- Reduce ThreadPoolExecutor max_workers in main.py
- Add connection pooling limits
- Increase delay between requests

### 3. Test Never-Crawled Source
```bash
python main.py --source second-self-brewing --verbose
```

---

## Short Term Actions (This Week)

1. **Triage Zero-Event Sources**
   - Deactivate 50+ seasonal/annual festival sources
   - Manual spot-check 20 active venues
   - Check crawl_logs for validation rejection patterns

2. **Fix Specific Crawler Errors**
   - new-realm-brewing, ajff, moca-ga: Add null checks
   - one-musicfest: Fix date parsing ("day is out of range")
   - hawks-bars: HTTP/2 protocol error
   - freeside-atlanta: SSL cert issue
   - scad-atlanta: 403 Forbidden

3. **Monitor After Fixes**
   - Run full crawl: `python main.py`
   - Re-run assessment
   - Verify 0 events in 2027
   - Verify 2,000-3,000 events in next 7 days

---

## Detailed Reports

1. **Main Assessment Report**
   - `/Users/coach/Projects/LostCity/crawlers/tmp/crawl_readiness_assessment_2026-02-09.md`
   - Full analysis of all 5 queries
   - Breakdown of errors by pattern
   - Recommendations for each issue

2. **Year Parsing Bug Diagnostic**
   - `/Users/coach/Projects/LostCity/crawlers/tmp/year_parsing_bug_diagnostic.md`
   - All 41 affected sources listed
   - Root cause analysis
   - Step-by-step fix instructions
   - Validation queries

---

## Files Referenced

- `/Users/coach/Projects/LostCity/crawlers/db.py` - Database operations, needs validation added
- `/Users/coach/Projects/LostCity/crawlers/main.py` - Orchestration, may need connection tuning
- `/Users/coach/Projects/LostCity/crawlers/sources/*.py` - Individual crawlers needing fixes

---

## Success Criteria

After fixes are implemented:

- [ ] Zero events dated in 2027
- [ ] 2,000-3,000 events in next 7 days (up from 1,000)
- [ ] Network errors reduced by 80%
- [ ] Zero-event source count below 150 (down from 302)
- [ ] All crawlers running successfully in last 24 hours
- [ ] Event calendar showing full coverage through March+

---

## Next Assessment

**When:** After implementing immediate fixes (24-48 hours)  
**Command:** Re-run the assessment queries  
**Expected:** GREEN status across all metrics

---

For questions or clarification, refer to the detailed diagnostic reports above.
