# Portal Distribution Diagnostics - Summary

## Deliverables Created

Successfully completed comprehensive diagnostic analysis of the LostCity event portal distribution. Three analysis documents and two executable diagnostic scripts have been created.

### Analysis Documents (3 files)

#### 1. Main Diagnostic Report
**File:** `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md` (9.8 KB)

Complete data quality assessment including:
- 5 detailed query results with formatted tables
- 3 identified data quality issues with root cause analysis
- 4-phase recommended action plan
- SQL validation queries for follow-up verification
- Monitoring metrics and KPIs

**Key Findings:**
- Total platform events: 8,160 future events
- Unassigned events: 1,052 (11.4%) - **CRITICAL ISSUE**
- Portal concentration: 69.2% in Atlanta (69% vs 16.5% Nashville vs 1.4% Piedmont)
- Top unassigned sources: Cinema crawlers (458 events) + Ticketmaster (126 events)

#### 2. Diagnostic Tools Guide
**File:** `/Users/coach/Projects/LostCity/DIAGNOSTIC_TOOLS_README.md` (7.2 KB)

Technical documentation for using the diagnostic tools:
- How to run both diagnostic scripts
- Database schema reference
- Connection configuration details
- Data quality issues explained
- Recommended fixes prioritized
- Environment setup instructions

#### 3. Quick Start Guide
**File:** `/Users/coach/Projects/LostCity/PORTAL_DIAGNOSTICS_QUICK_START.txt` (7.5 KB)

Quick reference card with:
- Executive summary of all findings
- Critical issue at a glance
- Top venues ranked by event count
- Prioritized action plan with checkboxes
- Quick validation queries
- Contact information

### Diagnostic Scripts (2 executable Python files)

#### 1. Core Diagnostics Script
**File:** `/Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py` (6.8 KB)

Runs 4 core diagnostic queries:
1. Future events by portal with names
2. Count of NULL portal_id events
3. 30-day event distribution by portal
4. Atlanta portal events by category

**Usage:** `/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py`

Output: ~200 lines formatted tables

#### 2. Extended Diagnostics Script
**File:** `/Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py` (8.1 KB)

Runs 4 extended diagnostic queries:
1. ALL future events by portal (unrestricted)
2. Top sources contributing unassigned events
3. Portal coverage statistics (% of total)
4. Atlanta top 15 venues by event count

**Usage:** `/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py`

Output: ~150 lines formatted tables

---

## Key Findings

### Query Results Summary

| Metric | Value | Status |
|---|---|---|
| **Total future events** | 8,160 | OK |
| **Atlanta events** | 5,647 (69.2%) | CONCENTRATION |
| **Nashville events** | 1,349 (16.5%) | LOW |
| **Piedmont events** | 112 (1.4%) | VERY LOW |
| **Unassigned events** | 1,052 (11.4%) | **CRITICAL** |
| **Properly assigned** | 7,108 (87.1%) | WARNING |

### Data Quality Issues (Prioritized)

#### CRITICAL: Portal Assignment Gap
- **Count:** 1,052 events with NULL portal_id
- **Impact:** Events invisible in portal-scoped queries
- **Root cause:** Crawlers not setting portal_id during insert
- **Top contributors:** Springs Cinema (211), Ticketmaster (126), Tara Theatre (117)
- **Fix:** Update cinema crawlers + Ticketmaster to assign portal_id
- **Timeline:** Day 1

#### WARNING: Event Concentration
- **Count:** 69.2% of events in Atlanta portal
- **Impact:** Nashville users see 3.8x fewer events than Atlanta
- **Root cause:** Limited source activation for Nashville/Piedmont
- **Fix:** Activate additional sources
- **Timeline:** Week 1

#### LOW: Inactive Portals
- **Count:** 3 portals with 0 events
- **Impact:** Schema clutter
- **Root cause:** Created but not configured
- **Fix:** Archive unused test portals
- **Timeline:** Week 1

### Atlanta Portal Deep Dive (Next 30 Days)

**Total events sampled:** 1,000

**Category distribution:**
- Music: 167 (16.7%)
- Community: 155 (15.5%)
- Nightlife: 148 (14.8%)
- Theater: 137 (13.7%)
- Sports: 112 (11.2%)
- Comedy: 111 (11.1%)
- Film: 50 (5.0%)
- Other: 120 (12.0%)

**Top 10 venues:**
1. Dad's Garage Theatre - 52 events
2. Fox Theatre - 28 events
3. Gas South Arena - 27 events
4. Tara Theatre - 27 events
5. State Farm Arena - 27 events
6. Alliance Theatre - 26 events
7. Laughing Skull Lounge - 25 events
8. 7 Stages - 23 events
9. TEN ATL - 22 events
10. Lore Atlanta - 22 events

### 30-Day Event Distribution

| Portal | 30-Day Events | % of 30-Day Total |
|---|---:|---:|
| Atlanta | 2,523 | 76.2% |
| Nashville | 742 | 22.4% |
| Piedmont | 43 | 1.3% |
| **Total** | **3,308** | **100%** |

### Unassigned Events - Top Sources

| Source | Unassigned Events | % of Unassigned |
|---|---:|---:|
| Springs Cinema | 211 | 20.1% |
| Ticketmaster | 126 | 12.0% |
| Tara Theatre | 117 | 11.1% |
| Plaza Theatre | 55 | 5.2% |
| Starlight Drive-In | 36 | 3.4% |
| Landmark Midtown | 35 | 3.3% |
| Red Light Cafe | 30 | 2.9% |
| **Cinema total** | **458** | **43.6%** |

---

## Action Plan

### Phase 1: Immediate Fixes (Day 1)
- [ ] Update cinema crawlers to set portal_id = Atlanta UUID
  - springs_cinema.py, tara_theatre.py, plaza_theatre.py, starlight_drive_in.py, landmark_midtown.py
- [ ] Update Ticketmaster crawler for portal assignment
- [ ] Backfill NULL portal_id using geo-matching
- [ ] Document portal assignment in CLAUDE.md

### Phase 2: Data Integrity (Days 2-3)
- [ ] Add NOT NULL constraint to events.portal_id
- [ ] Add foreign key validation
- [ ] Audit all active sources
- [ ] Create validation test suite

### Phase 3: Feature Parity (Week 1)
- [ ] Activate Nashville sources
- [ ] Activate Piedmont sources
- [ ] Archive unused test portals
- [ ] Document portal provisioning

### Phase 4: Monitoring (Ongoing)
- [ ] Dashboard metric: % events with valid portal_id
- [ ] Crawl log warnings for NULL portal_id
- [ ] Weekly source audit
- [ ] Portal concentration tracking

---

## Database Details

**Database:** Supabase PostgreSQL
**Tables queried:** events, portals, sources, venues
**Date range:** February 4, 2026 (all future events)

**Configuration files:**
- `/Users/coach/Projects/LostCity/crawlers/config.py` - Configuration management
- `/Users/coach/Projects/LostCity/crawlers/db.py` - Database operations

**Environment variables required:**
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- ANTHROPIC_API_KEY

---

## How to Use

### 1. Read the Main Report
Start with: `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md`

Provides complete context on all issues, recommended fixes, and validation queries.

### 2. Run the Diagnostics
Execute the Python scripts to verify current state:

```bash
/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py
/usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py
```

### 3. Review the Quick Start
Check: `/Users/coach/Projects/LostCity/PORTAL_DIAGNOSTICS_QUICK_START.txt`

Quick reference for implementation plan and key findings.

### 4. Run Validation Queries
Execute SQL queries from the main report to verify fixes after implementation.

### 5. Monitor Going Forward
Suggested dashboard metrics and ongoing checks are documented in the main report.

---

## Validation Queries (Quick Copy-Paste)

### Find all unassigned future events:
```sql
SELECT COUNT(*) as unassigned_count, COUNT(DISTINCT source_id) as source_count
FROM events WHERE portal_id IS NULL AND start_date >= CURRENT_DATE;
```

Expected current result: 1,052 unassigned events

### Check cinema source status:
```sql
SELECT source_id, COUNT(*) as event_count, COUNT(DISTINCT portal_id) as portal_count
FROM events WHERE source_id IN (548, 28, 27, 547, 29)
AND start_date >= CURRENT_DATE GROUP BY source_id;
```

### Verify portal distribution:
```sql
SELECT portal_id, COUNT(*) as event_count
FROM events WHERE start_date >= CURRENT_DATE
GROUP BY portal_id ORDER BY event_count DESC;
```

---

## Files Generated

```
/Users/coach/Projects/LostCity/
├── PORTAL_DISTRIBUTION_DIAGNOSTIC.md          [MAIN REPORT]
├── DIAGNOSTIC_TOOLS_README.md                 [TOOLS GUIDE]
├── PORTAL_DIAGNOSTICS_QUICK_START.txt         [QUICK REF]
└── crawlers/
    ├── portal_distribution_diagnostics.py     [SCRIPT 1]
    └── additional_portal_diagnostics.py       [SCRIPT 2]
```

Total: 3 documents + 2 scripts = 5 files created

---

## Next Steps

1. **Review** the main diagnostic report (15 min read)
2. **Run** the diagnostic scripts to verify findings (5 min)
3. **Implement** Phase 1 fixes (cinema crawler updates)
4. **Backfill** NULL portal_id for existing events
5. **Validate** using SQL queries from the report
6. **Monitor** going forward with suggested dashboard metrics

---

## Document Locations (Absolute Paths)

- Main Report: `/Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md`
- Tools Guide: `/Users/coach/Projects/LostCity/DIAGNOSTIC_TOOLS_README.md`
- Quick Start: `/Users/coach/Projects/LostCity/PORTAL_DIAGNOSTICS_QUICK_START.txt`
- Script 1: `/Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py`
- Script 2: `/Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py`

---

**Report Generated:** February 4, 2026
**Database Snapshot:** Current (live data as of execution)
**Status:** Complete and ready for implementation

