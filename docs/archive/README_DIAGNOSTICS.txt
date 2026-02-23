================================================================================
PORTAL DISTRIBUTION DIAGNOSTIC REPORT
LostCity Event Discovery Platform
Generated: February 4, 2026
================================================================================

WHAT WAS DONE:
  Comprehensive analysis of event distribution across LostCity portals
  using live queries against the Supabase PostgreSQL database

DATABASE ANALYZED:
  8,160 future events across 6 configured portals
  Covering all events with start_date >= today

CRITICAL FINDINGS:
  - 1,052 events (11.4%) have NULL portal_id (INVISIBLE ISSUE)
  - 69.2% of events concentrated in Atlanta portal
  - Cinema crawlers account for 43.6% of unassigned events
  - 3 inactive portals with 0 events each

================================================================================
DELIVERABLES
================================================================================

START HERE (if reading first time):
  1. Read: PORTAL_DIAGNOSTICS_QUICK_START.txt (10 min)
     - Quick reference card with all key findings
     - Prioritized action plan with checkboxes
     - One-page summary of issues and fixes

THEN READ (for detailed understanding):
  2. Read: PORTAL_DISTRIBUTION_DIAGNOSTIC.md (30 min)
     - Complete data quality assessment
     - 5 query results with formatted tables
     - Root cause analysis for each issue
     - 4-phase recommended action plan
     - SQL validation queries provided

FOR IMPLEMENTATION:
  3. Read: DIAGNOSTIC_TOOLS_README.md (20 min)
     - Technical setup and configuration
     - How to run diagnostic scripts
     - Database schema reference
     - Monitoring dashboard metrics

FOR OVERVIEW:
  4. Read: DIAGNOSTICS_SUMMARY.md (15 min)
     - Summary of all deliverables
     - Key findings condensed
     - File manifest and locations

REFERENCE:
  5. Check: DIAGNOSTICS_INDEX.md
     - Complete file index with descriptions
     - Quick start guide by role
     - Validation queries reference

RUN SCRIPTS (to verify findings):
  6. Execute: crawlers/portal_distribution_diagnostics.py
     - Runs 4 core diagnostic queries
     - Output: ~200 lines of formatted tables

  7. Execute: crawlers/additional_portal_diagnostics.py
     - Runs 4 extended diagnostic queries
     - Output: ~150 lines of formatted tables

================================================================================
KEY STATISTICS
================================================================================

TOTAL EVENTS: 8,160 future events
├─ Atlanta:              5,647 (69.2%)
├─ Nashville:            1,349 (16.5%)
├─ Piedmont:               112 (1.4%)
├─ Inactive portals:         0 (0%)
└─ UNASSIGNED (NULL):    1,052 (11.4%) *** CRITICAL ***

30-DAY DISTRIBUTION: 3,308 events
├─ Atlanta:              2,523 (76.2%)
├─ Nashville:              742 (22.4%)
└─ Piedmont:               43 (1.3%)

ATLANTA NEXT 30 DAYS BY CATEGORY:
├─ Music:                  167 (16.7%)
├─ Community:              155 (15.5%)
├─ Nightlife:              148 (14.8%)
├─ Theater:                137 (13.7%)
├─ Sports:                 112 (11.2%)
├─ Comedy:                 111 (11.1%)
├─ Film:                    50 (5.0%)
└─ Other:                  120 (12.0%)

TOP PROBLEM SOURCES (unassigned events):
├─ Springs Cinema:         211 (20.1%)
├─ Ticketmaster:           126 (12.0%)
├─ Tara Theatre:           117 (11.1%)
├─ Plaza Theatre:           55 (5.2%)
├─ Starlight Drive-In:      36 (3.4%)
└─ [Cinema total]:         458 (43.6%)

TOP VENUES (Atlanta, 30-day):
├─ Dad's Garage Theatre:    52 events
├─ Fox Theatre:             28 events
├─ Gas South Arena:         27 events
├─ Tara Theatre:            27 events
└─ State Farm Arena:        27 events

================================================================================
THE CRITICAL ISSUE
================================================================================

PROBLEM:
  1,052 future events (11.4% of platform) have portal_id = NULL
  These events are INVISIBLE in portal-scoped queries

ROOT CAUSE:
  Event crawler sources are not setting the portal_id field when inserting
  new events into the database

IMPACT:
  - Events not visible in any portal
  - Cannot be filtered by portal
  - API queries may return inconsistent results
  - User experience degradation

TOP CONTRIBUTORS:
  1. Springs Cinema (211 events)
  2. Ticketmaster (126 events)
  3. Tara Theatre (117 events)
  4. Plaza Theatre (55 events)
  5. Starlight Drive-In (36 events)
  + Other cinema crawlers and sources

FIX (Day 1):
  1. Update cinema crawler sources to set portal_id = Atlanta UUID
  2. Update Ticketmaster crawler to set portal_id
  3. Backfill existing NULL portal_id using geo-matching
  4. Add NOT NULL constraint to prevent future NULL values

================================================================================
SECONDARY ISSUES
================================================================================

ISSUE 2: Event Concentration (WARNING)
  Problem: 69.2% of events in Atlanta portal
  Impact: Nashville users see 3.8x fewer events than Atlanta
  Fix: Activate additional Nashville/Piedmont sources (Week 1)

ISSUE 3: Inactive Portals (LOW)
  Problem: 3 portals with 0 events (test/example portals)
  Impact: Schema clutter, development confusion
  Fix: Archive unused portals (Week 1)

================================================================================
ACTION PLAN
================================================================================

DAY 1 - IMMEDIATE FIXES:
  [ ] Update cinema crawlers (springs_cinema.py, tara_theatre.py, etc.)
  [ ] Update Ticketmaster crawler (ticketmaster.py)
  [ ] Backfill NULL portal_id for existing events
  [ ] Document portal assignment requirements

DAYS 2-3 - DATA INTEGRITY:
  [ ] Add NOT NULL constraint to events.portal_id
  [ ] Add foreign key validation
  [ ] Audit all 500+ active sources
  [ ] Create validation test suite

WEEK 1 - FEATURE PARITY:
  [ ] Activate Nashville source collection
  [ ] Activate Piedmont source collection
  [ ] Archive unused test portals
  [ ] Document portal provisioning workflow

ONGOING - MONITORING:
  [ ] Dashboard metric: % events with valid portal_id
  [ ] Crawl log warnings for NULL portal_id events
  [ ] Weekly source audit
  [ ] Monthly portal concentration tracking

================================================================================
HOW TO RUN DIAGNOSTICS
================================================================================

OPTION 1: Run both scripts now (5 minutes)
  /usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py
  /usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py

OPTION 2: Integrate into crawler pipeline
  Add to crawlers/main.py after each crawl run:
  from portal_distribution_diagnostics import run_diagnostics
  run_diagnostics()

OPTION 3: Schedule periodic runs
  0 2 * * * /usr/bin/python3 /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py

================================================================================
VALIDATION QUERIES (Copy-Paste Ready)
================================================================================

Find all unassigned events:
  SELECT COUNT(*) FROM events WHERE portal_id IS NULL AND start_date >= CURRENT_DATE;
  Expected: 1,052

Check portal distribution:
  SELECT portal_id, COUNT(*) FROM events WHERE start_date >= CURRENT_DATE
  GROUP BY portal_id ORDER BY COUNT(*) DESC;

Verify cinema source backfill:
  SELECT source_id, COUNT(*), COUNT(DISTINCT portal_id) FROM events
  WHERE source_id IN (548, 28, 27, 547, 29) AND start_date >= CURRENT_DATE
  GROUP BY source_id;

More queries in: PORTAL_DISTRIBUTION_DIAGNOSTIC.md

================================================================================
FILES CREATED (All Absolute Paths)
================================================================================

ANALYSIS DOCUMENTS:
  /Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md
  /Users/coach/Projects/LostCity/DIAGNOSTIC_TOOLS_README.md
  /Users/coach/Projects/LostCity/PORTAL_DIAGNOSTICS_QUICK_START.txt
  /Users/coach/Projects/LostCity/DIAGNOSTICS_SUMMARY.md
  /Users/coach/Projects/LostCity/DIAGNOSTICS_INDEX.md

DIAGNOSTIC SCRIPTS:
  /Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py
  /Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py

THIS FILE:
  /Users/coach/Projects/LostCity/README_DIAGNOSTICS.txt

================================================================================
WHAT TO READ BASED ON YOUR ROLE
================================================================================

PRODUCT MANAGER (15 minutes):
  1. This file (README_DIAGNOSTICS.txt) - you are here
  2. PORTAL_DIAGNOSTICS_QUICK_START.txt
  3. DIAGNOSTICS_SUMMARY.md
  Action: Use checklist to guide engineering team

BACKEND ENGINEER (60 minutes):
  1. DIAGNOSTIC_TOOLS_README.md - understand setup
  2. PORTAL_DISTRIBUTION_DIAGNOSTIC.md - understand issues
  3. Run both diagnostic scripts - verify current state
  4. Execute validation queries - understand database state
  Action: Implement Phase 1 fixes (crawler updates)

DATA ANALYST (45 minutes):
  1. Run both diagnostic scripts - get fresh data
  2. PORTAL_DISTRIBUTION_DIAGNOSTIC.md - understand context
  3. Execute all validation queries - deep dive
  4. Create dashboard using suggested metrics

DEVOPS/INFRASTRUCTURE (30 minutes):
  1. DIAGNOSTIC_TOOLS_README.md - environment setup
  2. Verify database connection configuration
  3. Set up monitoring dashboard
  4. Configure scheduled diagnostic runs

================================================================================
DATABASE CONNECTION DETAILS
================================================================================

Database: Supabase PostgreSQL
URL: Configured in crawlers/config.py
Authentication: SUPABASE_SERVICE_KEY from environment
Client: Python supabase-py library

Connection Module: crawlers/db.py
Configuration Module: crawlers/config.py

Tables Queried:
  - events (8,160 future records)
  - portals (6 configured)
  - sources (500+ crawlers)
  - venues (~3,000 locations)

================================================================================
WHAT'S NEXT
================================================================================

STEP 1: Read the quick start
  File: /Users/coach/Projects/LostCity/PORTAL_DIAGNOSTICS_QUICK_START.txt
  Time: 10 minutes

STEP 2: Review main diagnostic report
  File: /Users/coach/Projects/LostCity/PORTAL_DISTRIBUTION_DIAGNOSTIC.md
  Time: 20 minutes

STEP 3: Run diagnostic scripts
  Scripts: Both Python scripts in crawlers/
  Time: 5 minutes

STEP 4: Understand the issues
  Focus: The 3 data quality issues section
  Time: 10 minutes

STEP 5: Plan implementation
  Use: The 4-phase action plan provided
  Time: 15 minutes

STEP 6: Start implementation
  Priority: Phase 1 (cinema crawler fixes)
  Time: Varies by team size

STEP 7: Monitor progress
  Use: Validation queries provided
  Re-run: Diagnostic scripts after fixes

================================================================================
SUMMARY
================================================================================

Status: Diagnostics complete
Data: 8,160 events analyzed (live, current)
Issues: 3 identified (1 critical, 1 warning, 1 low)
Fixes: 4-phase action plan ready
Timeline: Day 1 to implement critical fix
Impact: Restore 1,052 events to visibility

All documentation, scripts, and validation queries provided.
Ready for implementation.

Questions? See support resources in DIAGNOSTIC_TOOLS_README.md

================================================================================
