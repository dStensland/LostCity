# LostCity Production Audit - Index

**Audit Date:** 2026-02-16  
**Overall Health Score:** 90.4/100  
**Status:** READY WITH MINOR ISSUES

---

## Files Generated

| File | Purpose |
|------|---------|
| `PRODUCTION_AUDIT_DASHBOARD.txt` | Visual dashboard with key metrics (start here) |
| `PRODUCTION_AUDIT_SUMMARY.txt` | Quick reference guide with action items |
| `PRODUCTION_AUDIT_REPORT.md` | Full detailed report with root cause analysis and fixes |
| `PRODUCTION_AUDIT_QUERIES.sql` | Diagnostic SQL queries to find specific records |
| `PRODUCTION_AUDIT_INDEX.md` | This file - navigation guide |

---

## Quick Start

### If you have 5 minutes:
Read `PRODUCTION_AUDIT_DASHBOARD.txt` to understand the overall health status.

### If you have 30 minutes:
1. Read the dashboard
2. Scan the top 10 issues
3. Run the "Quick Wins" fixes (< 1 hour total)

### If you have 2-3 hours (Phase 1):
1. Run `venue_enrich.py --missing-coords-only` (343 venues)
2. Add title normalization to `db.py` (30 min code change)
3. Run the dead sources SQL update (copy from audit output)

### If you're fixing a specific issue:
Open `PRODUCTION_AUDIT_QUERIES.sql` and find the relevant query section.

---

## Issue Summary

### Critical (Must Fix)
- **343 venues** missing coordinates (can't show on maps)
- **420 events** with ALL CAPS short titles (poor UX)
- **194 sources** marked active but producing no events

### High Priority
- **971 music events** without genres (can't filter)
- **882 events** with null descriptions
- **105 events** with dates in titles

### Medium Priority
- **159 nightlife events** without genres
- **119 events** with cross-midnight time bug (ten-atlanta)
- **104 events** with synthetic descriptions

### Pass
- **0 duplicate events** (deduplication working)
- **0 orphaned references** (referential integrity intact)

---

## Files in This Directory

```
/Users/coach/Projects/LostCity/
├── PRODUCTION_AUDIT_INDEX.md         (this file)
├── PRODUCTION_AUDIT_DASHBOARD.txt    (visual dashboard)
├── PRODUCTION_AUDIT_SUMMARY.txt      (quick reference)
├── PRODUCTION_AUDIT_REPORT.md        (full report)
└── PRODUCTION_AUDIT_QUERIES.sql      (diagnostic queries)
```

---

## Next Steps

1. **Phase 1 (Critical):** Fix venues, titles, dead sources (2-3 hours)
2. **Re-audit:** Run the audit again to verify score > 95/100
3. **Phase 2 (High Priority):** Fix genres, descriptions, time bugs (4-6 hours)
4. **Phase 3 (Medium Priority):** Polish remaining issues (2-4 hours)

---

## Contact

For questions about this audit or data quality issues, refer to:
- `crawlers/CLAUDE.md` - Crawler development guidelines
- `crawlers/db.py` - Database operations reference
- `crawlers/tag_inference.py` - Tag/genre inference logic

---

**Last Updated:** 2026-02-16 18:02:31
