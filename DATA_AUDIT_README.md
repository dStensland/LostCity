# Data Audit Package - README

Complete data quality analysis for LostCity events database.

---

## What Was Generated

This audit package includes 6 files:

| File | Location | Purpose |
|------|----------|---------|
| **data_audit.py** | `/crawlers/data_audit.py` | Python script to run audits |
| **data_audit_detailed.txt** | `/data_audit_detailed.txt` | Raw data listing all issues |
| **data_audit_diagnostic.md** | `/data_audit_diagnostic.md` | Deep analysis with solutions |
| **089_data_quality_cleanup.sql** | `/database/migrations/089_data_quality_cleanup.sql` | SQL to fix issues |
| **DATA_AUDIT_SUMMARY.md** | `/DATA_AUDIT_SUMMARY.md` | Executive summary (this file's companion) |
| **DATA_QUALITY_MONITORING.md** | `/DATA_QUALITY_MONITORING.md` | Ongoing monitoring guide |

---

## Quick Start

### 1. Review the Results

Start here to understand what was found:
```bash
cat /Users/coach/Projects/LostCity/DATA_AUDIT_SUMMARY.md
```

Key metrics:
- 1,000 events analyzed
- 7 duplicates (0.7%) - Excellent!
- 441 non-standard categories (44%) - High priority fix
- 307 missing genres (31%) - Needs work
- 167 missing descriptions (17%) - Moderate issue

### 2. Apply Immediate Fixes

Run the SQL migration to normalize categories and remove duplicates:

**In Supabase SQL Editor**:
1. Open `/Users/coach/Projects/LostCity/database/migrations/089_data_quality_cleanup.sql`
2. Copy contents
3. Run in Supabase SQL Editor
4. Verify with the queries at the bottom

This will:
- ✅ Normalize 441 events with wrong categories
- ✅ Remove 5 duplicate events
- ✅ Recategorize "other" events
- ✅ Add category validation constraint
- ✅ Create monitoring view

### 3. Verify the Fixes

Re-run the audit to confirm improvements:
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python data_audit.py
```

You should see:
- Non-standard categories: 441 → 0
- Duplicates: 7 → 2 (only false positives remain)

---

## Understanding the Files

### data_audit.py - The Audit Engine

**What it does**:
- Loads events, venues, sources, series from database
- Detects duplicates using hash matching + fuzzy logic
- Identifies missing data (descriptions, images, categories)
- Analyzes categorization quality
- Generates detailed reports

**How to run**:
```bash
# Full audit (all future events)
python data_audit.py

# Limit to 500 events (faster)
python data_audit.py 500

# Redirect to file
python data_audit.py > audit_$(date +%Y%m%d).txt
```

**Output**:
- Console: Summary statistics and recommendations
- File: `data_audit_detailed.txt` with all issues

### data_audit_detailed.txt - Raw Data

**What it contains**:
- Every duplicate pair with IDs
- Every event missing descriptions (167 rows)
- Every event missing images (181 rows)
- All categorization issues

**Use it for**:
- Manual review of specific events
- Bulk operations (grep/awk to extract IDs)
- Verification after fixes

Example:
```bash
# Find all missing descriptions from Eventbrite
grep "Eventbrite" data_audit_detailed.txt | grep "MISSING DESCRIPTIONS"
```

### data_audit_diagnostic.md - The Deep Dive

**What it contains**:
- Root cause analysis for each issue
- Specific code fixes with examples
- SQL queries for verification
- Prioritized action items

**Use it for**:
- Understanding WHY issues exist
- Implementation guidance
- Code review before changes

**Structure**:
- Issue 1: Non-Standard Categories (with mapping table)
- Issue 2: Missing Descriptions (by source analysis)
- Issue 3: Missing Images (with API recommendations)
- Issue 4: Missing Genres (category breakdown)
- Issue 5: Duplicate Events (false positive analysis)
- Issue 6: Missing Subcategories (inference logic)
- Issue 7: Uncategorizable Events (manual review list)

### 089_data_quality_cleanup.sql - Automated Fixes

**What it does**:
1. Normalizes categories: `words`→`community`, `learning`→`community`, etc.
2. Recategorizes "other" events based on keywords
3. Removes 5 duplicate events
4. Adds category validation constraint
5. Creates `event_data_quality` monitoring view

**Safety**:
- All operations are safe (UPDATE/DELETE with specific IDs)
- Includes verification queries at end
- Can be rolled back if needed

**How to apply**:
```sql
-- Copy the entire file contents
-- Paste into Supabase SQL Editor
-- Click "Run"
-- Review output
```

### DATA_AUDIT_SUMMARY.md - Executive Summary

Quick overview with:
- Overall health score (B+ / 85/100)
- Issue breakdown by priority
- Top findings
- Recommended actions in phases

Read this first to understand the big picture.

### DATA_QUALITY_MONITORING.md - Ongoing Health

Reference guide for maintaining quality:
- Weekly SQL health checks
- Red flags to watch for
- Source health monitoring
- When to re-audit

Use this for continuous monitoring after fixes are applied.

---

## Workflow: Using These Files Together

### Initial Review (30 minutes)
1. Read `DATA_AUDIT_SUMMARY.md` - understand scope
2. Skim `data_audit_diagnostic.md` - see recommendations
3. Check `data_audit_detailed.txt` - specific examples

### Immediate Fixes (1 hour)
1. Review `089_data_quality_cleanup.sql`
2. Run migration in Supabase
3. Run `python data_audit.py` to verify
4. Check new stats in `event_data_quality` view

### Short-Term Improvements (1-2 weeks)
1. Follow recommendations in `data_audit_diagnostic.md`
2. Implement code changes to crawlers
3. Test with a few sources
4. Re-run audit to verify

### Ongoing Monitoring (weekly)
1. Use queries from `DATA_QUALITY_MONITORING.md`
2. Watch `event_data_quality` view
3. Run full audit monthly
4. Adjust thresholds as needed

---

## Key Findings At-A-Glance

### ✅ Strengths
- **Excellent deduplication** (99.3% unique)
- **100% category coverage** (though needs normalization)
- **Good source diversity** (367 active sources)

### 🔴 Critical Issues
1. **Non-standard categories** (441 events) - Run SQL migration
2. **Missing genres** (307 events) - Implement inference logic

### ⚠️ Moderate Issues
3. **Missing descriptions** (167 events) - Expand TMDB/template logic
4. **Missing images** (181 events) - Debug API integrations

### ℹ️ Minor Issues
5. **Duplicates** (7 events) - Only 5 are real, 2 false positives
6. **Missing subcategories** (68 events) - Add inference
7. **Uncategorizable** (13 events) - Manual review

---

## Action Items by Priority

### P0 - This Week
- [ ] Run `089_data_quality_cleanup.sql` migration
- [ ] Verify with `python data_audit.py`
- [ ] Review 13 "other" events manually

### P1 - This Sprint (2 weeks)
- [ ] Add category validation to `extract.py`
- [ ] Implement subcategory inference in `tag_inference.py`
- [ ] Create sports genre inference
- [ ] Expand TMDB integration for plots + genres

### P2 - Next Month
- [ ] Series image inheritance
- [ ] Category placeholder images
- [ ] Music genre fallback inference
- [ ] Description templates for recurring events

### P3 - Continuous
- [ ] Weekly monitoring queries
- [ ] Monthly full audits
- [ ] Track metrics over time
- [ ] Adjust thresholds as platform grows

---

## Success Metrics

After implementing fixes, aim for:

| Metric | Current | Target |
|--------|---------|--------|
| Duplicates | 0.7% | < 1% |
| Missing Descriptions | 16.7% | < 10% |
| Missing Images | 18.1% | < 15% |
| Non-Standard Categories | 44.1% | 0% |
| Missing Genres | 30.7% | < 20% |
| Missing Subcategories | 6.8% | < 5% |
| Overall Health | B+ (85) | A (90+) |

---

## Questions?

### Where do I start?
Start with `DATA_AUDIT_SUMMARY.md` for the overview.

### What should I fix first?
Run `089_data_quality_cleanup.sql` - it's automated and fixes the biggest issues.

### How do I prevent these issues?
Use `DATA_QUALITY_MONITORING.md` for weekly checks.

### How do I implement the recommendations?
See `data_audit_diagnostic.md` for detailed code examples.

### Can I re-run the audit?
Yes! `python data_audit.py` can be run anytime. Run monthly or after major changes.

### What if I find new issues?
The audit script can be extended. Add new checks to `data_audit.py`.

---

## Technical Details

### Database Tables Analyzed
- `events` - Core event data (1,000 future events)
- `venues` - Venue records (1,000 loaded)
- `sources` - Crawler configs (367 sources)
- `series` - Recurring event series (148 series)

### Duplication Detection
- **Method 1**: Content hash (title + venue + date)
- **Method 2**: Fuzzy matching (85% similarity threshold)
- **Known issue**: False positives on similar team names

### Category Validation
- **Official list**: 12 categories (music, art, comedy, theater, film, sports, food_drink, nightlife, community, fitness, family, other)
- **Found in DB**: 19 categories (7 non-standard)
- **Solution**: SQL migration + schema constraint

### Genre System
- **Stored on**: `series.genres[]` OR `events.genres[]`
- **Categories**: music, film, theater, sports
- **Status**: 31% missing (needs implementation)

---

## File Locations Reference

All files are in `/Users/coach/Projects/LostCity/`:

```
/Users/coach/Projects/LostCity/
├── crawlers/
│   └── data_audit.py                    # Audit script
├── database/
│   └── migrations/
│       └── 089_data_quality_cleanup.sql # SQL fixes
├── data_audit_detailed.txt              # Raw data
├── data_audit_diagnostic.md             # Analysis
├── DATA_AUDIT_SUMMARY.md                # Executive summary
├── DATA_QUALITY_MONITORING.md           # Monitoring guide
└── DATA_AUDIT_README.md                 # This file
```

---

**Next Step**: Read `DATA_AUDIT_SUMMARY.md` to understand the findings.

**Get Help**: Review `data_audit_diagnostic.md` for detailed solutions.

**Stay Healthy**: Use `DATA_QUALITY_MONITORING.md` for ongoing checks.

---

Generated: 2026-01-30  
Audit Script: `/Users/coach/Projects/LostCity/crawlers/data_audit.py`  
Run Again: `cd crawlers && python data_audit.py`
