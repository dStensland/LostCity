# Portal Distribution Diagnostics - File Index

## Complete Set of Diagnostic Deliverables

Generated: February 4, 2026
Total Files: 5 (3 documents + 2 scripts)
Total Size: ~42 KB

---

## Analysis Documents

### 1. Main Diagnostic Report
**Path:** `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md`
**Size:** 9.8 KB
**Purpose:** Comprehensive data quality assessment
**Contains:**
- Executive summary with key metrics
- 5 detailed query results with formatted tables
- 3 prioritized data quality issues with root cause analysis
- 4-phase recommended action plan (immediate to ongoing)
- SQL validation queries for verification
- Monitoring metrics and KPI recommendations

**Best For:** Deep understanding of all issues and comprehensive fix strategy

---

### 2. Diagnostic Tools Guide
**Path:** `/Users/coach/Projects/LostCity/DIAGNOSTIC_TOOLS_README.md`
**Size:** 7.2 KB
**Purpose:** Technical reference for running diagnostics
**Contains:**
- How to run both diagnostic scripts
- Complete database schema documentation
- Configuration and connection details
- Data quality issues explained technically
- Recommended fixes prioritized
- Environment setup instructions
- Monitoring dashboard metrics

**Best For:** Technical implementation and integration with crawler pipeline

---

### 3. Quick Start Guide
**Path:** `/Users/coach/Projects/LostCity/PORTAL_DIAGNOSTICS_QUICK_START.txt`
**Size:** 8.9 KB
**Purpose:** Quick reference for key findings
**Contains:**
- Executive summary formatted for quick scanning
- Critical issue at a glance
- Top venues and contributors listed
- Prioritized action plan with checkboxes
- Quick validation queries (copy-paste ready)
- Database connection details
- Next steps summary

**Best For:** Executive summary, quick implementation checklist

---

### 4. Diagnostics Summary (This File's Parent)
**Path:** `/Users/coach/Projects/LostCity/DIAGNOSTICS_SUMMARY.md`
**Size:** 9.3 KB
**Purpose:** Overview of all deliverables
**Contains:**
- Summary of each document and script
- Key findings extracted from all queries
- Query result summaries with tables
- Complete action plan
- All locations with absolute paths
- How to use guide

**Best For:** Understanding what's available and where to start

---

## Diagnostic Scripts

### 1. Core Diagnostics Script
**Path:** `/Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py`
**Size:** 6.8 KB
**Language:** Python 3.9+
**Dependencies:** supabase-py, python-dotenv, pydantic

**Executes 4 Core Queries:**
1. Future events by portal (grouped, with names)
2. Count of events with NULL portal_id
3. 30-day event distribution by portal
4. Atlanta portal 30-day events by category

**Usage:**
```bash
/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py
```

**Output:**
- ~200 lines of formatted tables
- Organized by query
- CSV-compatible formatting

---

### 2. Extended Diagnostics Script
**Path:** `/Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py`
**Size:** 8.1 KB
**Language:** Python 3.9+
**Dependencies:** supabase-py, python-dotenv, pydantic

**Executes 4 Extended Queries:**
1. ALL future events by portal (unrestricted, full count)
2. Top sources contributing unassigned events (top 20)
3. Portal coverage statistics (% of platform)
4. Atlanta top 15 venues by event count (30-day)

**Usage:**
```bash
/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py
```

**Output:**
- ~150 lines of formatted tables
- Grand totals and percentages
- Source-level breakdown

---

## Quick Start by Role

### For Product Manager
1. Read: **Quick Start Guide** (5 min) - `/Users/coach/Projects/LostCity/PORTAL_DIAGNOSTICS_QUICK_START.txt`
2. Review: **Diagnostics Summary** (5 min) - `/Users/coach/Projects/LostCity/DIAGNOSTICS_SUMMARY.md`
3. Action: Implement checklist from Quick Start

### For Backend Engineer
1. Review: **Tools Guide** (10 min) - `/Users/coach/Projects/LostCity/DIAGNOSTIC_TOOLS_README.md`
2. Read: **Main Report** (15 min) - `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md`
3. Run: Both diagnostic scripts (5 min)
4. Implement: Phase 1 crawler fixes
5. Validate: Using SQL queries from main report

### For Data Analyst
1. Run: Both diagnostic scripts (2 min) - get fresh data
2. Review: **Main Report** (15 min) - understand context
3. Execute: Validation queries (5 min) - verify findings
4. Create: Dashboard from suggested metrics

### For DevOps/Infrastructure
1. Review: **Tools Guide** (10 min) - environment setup
2. Check: Database connection configuration
3. Setup: Monitoring dashboard
4. Configure: Scheduled diagnostic runs

---

## Key Metrics at a Glance

| Metric | Value | Status |
|---|---|---|
| Total future events | 8,160 | OK |
| Properly assigned | 7,108 (87.1%) | WARNING |
| Unassigned (NULL) | 1,052 (11.4%) | **CRITICAL** |
| Atlanta concentration | 69.2% | CONCENTRATION |
| Nashville vs Atlanta | 1:4.2 | LOW |
| Inactive portals | 3 | LOW |

---

## Data Quality Issues (Priority Order)

### 1. CRITICAL: Portal Assignment Gap
- **Events affected:** 1,052 (11.4% of platform)
- **Root cause:** Crawlers not setting portal_id
- **Top sources:** Springs Cinema (211), Ticketmaster (126), Tara Theatre (117)
- **Fix timeline:** Day 1
- **Validator:** `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md` (Issue 1 section)

### 2. WARNING: Event Concentration
- **Events affected:** 5,647 in Atlanta vs 1,349 in Nashville
- **Root cause:** Limited source activation
- **Fix timeline:** Week 1
- **Validator:** `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md` (Issue 2 section)

### 3. LOW: Inactive Portals
- **Portals affected:** 3 (Sample Conference, Coach's Picks, Atlanta Families)
- **Root cause:** Not configured with sources
- **Fix timeline:** Week 1
- **Validator:** `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md` (Issue 3 section)

---

## Database Information

**Database Type:** Supabase PostgreSQL
**Tables Queried:** events, portals, sources, venues
**Data Snapshot:** February 4, 2026
**Query Method:** Python Supabase client

**Configuration Files Used:**
- `/Users/coach/Projects/LostCity/crawlers/config.py`
- `/Users/coach/Projects/LostCity/crawlers/db.py`

**Environment Variables Required:**
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- ANTHROPIC_API_KEY

---

## How to Re-Run Diagnostics

### Option 1: Run individual scripts
```bash
# Core queries (4 queries, ~200 lines output)
/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py

# Extended queries (4 queries, ~150 lines output)
/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py
```

### Option 2: Integrate into crawler pipeline
Add to `crawlers/main.py`:
```python
from portal_distribution_diagnostics import run_diagnostics

if __name__ == "__main__":
    run_all_crawlers()
    run_diagnostics()  # After each crawl run
```

### Option 3: Schedule periodic runs
```bash
# Add to crontab for daily execution
0 2 * * * /usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py >> /var/log/lostcity-diagnostics.log
```

---

## Validation Queries (Quick Reference)

### Find unassigned events:
```sql
SELECT COUNT(*) FROM events WHERE portal_id IS NULL AND start_date >= CURRENT_DATE;
```
Expected: 1,052 (before fixes)

### Check portal distribution:
```sql
SELECT portal_id, COUNT(*) FROM events WHERE start_date >= CURRENT_DATE GROUP BY portal_id ORDER BY COUNT(*) DESC;
```

### Verify cinema source backfill:
```sql
SELECT source_id, COUNT(*), COUNT(DISTINCT portal_id) FROM events
WHERE source_id IN (548, 28, 27, 547, 29) AND start_date >= CURRENT_DATE
GROUP BY source_id;
```

All validation queries documented in: `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md`

---

## Implementation Checklist

### Phase 1: Immediate (Day 1)
- [ ] Read main diagnostic report
- [ ] Review quick start guide
- [ ] Identify cinema crawler files
- [ ] Update crawler code to set portal_id = Atlanta UUID
- [ ] Update Ticketmaster crawler
- [ ] Test crawler changes
- [ ] Run diagnostics to verify

### Phase 2: Backfill (Day 1-2)
- [ ] Create SQL migration to backfill NULL portal_id
- [ ] Test migration on development database
- [ ] Apply to production
- [ ] Validate with SQL queries

### Phase 3: Integrity (Days 2-3)
- [ ] Add NOT NULL constraint to events.portal_id
- [ ] Add foreign key validation
- [ ] Create test suite for portal assignment
- [ ] Document portal requirements

### Phase 4: Expansion (Week 1)
- [ ] Activate Nashville sources
- [ ] Activate Piedmont sources
- [ ] Archive unused test portals
- [ ] Document portal provisioning

### Phase 5: Monitoring (Ongoing)
- [ ] Set up dashboard metrics
- [ ] Configure alerts
- [ ] Schedule weekly audits
- [ ] Review metrics monthly

---

## Support & References

**For crawler development:** `/Users/coach/Projects/LostCity/crawlers/CLAUDE.md`
**For database questions:** `/Users/coach/Projects/LostCity/database/CLAUDE.md`
**For platform architecture:** `/Users/coach/Projects/LostCity/web/QUICK_START_GUIDE.md` (if available)

---

## File Manifest

```
/Users/coach/Projects/LostCity/
├── PORTAL_DISTRIBUTION_DIAGNOSTIC.md      [9.8 KB] MAIN REPORT
├── DIAGNOSTIC_TOOLS_README.md             [7.2 KB] TOOLS GUIDE
├── PORTAL_DIAGNOSTICS_QUICK_START.txt     [8.9 KB] QUICK REF
├── DIAGNOSTICS_SUMMARY.md                 [9.3 KB] OVERVIEW
├── DIAGNOSTICS_INDEX.md                   [THIS FILE]
└── crawlers/
    ├── portal_distribution_diagnostics.py [6.8 KB] SCRIPT 1
    └── additional_portal_diagnostics.py   [8.1 KB] SCRIPT 2

Total: 5 main deliverables + this index = 6 files
Total Size: ~50 KB
```

---

**Report Status:** Complete and Ready for Implementation
**Last Updated:** February 4, 2026
**Maintainer:** Data Quality & Crawler Development

