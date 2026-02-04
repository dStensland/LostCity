# Data Quality Reports

This directory contains diagnostic reports and analyses of LostCity's event data pipeline.

## Latest Reports

### [EVENT_COUNT_GAP_DIAGNOSTIC_2026-02-03.md](./EVENT_COUNT_GAP_DIAGNOSTIC_2026-02-03.md)
**Issue:** Why ~8,000 total events only show ~1,000 in category views  
**Verdict:** Working as designed — portal isolation is the primary filter  
**Key Finding:** 848 events expected for Atlanta portal (after portal filter + dedup)

### [ALL_DAY_EVENTS_DIAGNOSTIC_2026-02-03.md](./ALL_DAY_EVENTS_DIAGNOSTIC_2026-02-03.md)
**Issue:** Analysis of all-day events and time data quality  
**Quick Fix:** [ALL_DAY_EVENTS_QUICK_FIX_GUIDE.md](./ALL_DAY_EVENTS_QUICK_FIX_GUIDE.md)

## Running Diagnostics

```bash
# Event count and filtering analysis
cd /Users/coach/Projects/LostCity/crawlers
python3 diagnose_event_gap.py
python3 diagnose_portal_filtering.py
python3 diagnose_final_filters_v2.py

# All-day events analysis
python3 analyze_all_day_events.py
```

## Common Issues & Explanations

### "Why are only 1,000 events showing?"

This is expected behavior due to:
1. **Portal isolation** — Atlanta events != Nashville events
2. **Deduplication** — Removes duplicate event listings
3. **Personalization** — Filters to user interests/follows
4. **Time window** — Next 30 days only

See [EVENT_COUNT_GAP_DIAGNOSTIC_2026-02-03.md](./EVENT_COUNT_GAP_DIAGNOSTIC_2026-02-03.md) for full analysis.

### "Events missing categories?"

As of 2026-02-03: **100% of future events have categories assigned.** No issue.

### "Missing venue_id?"

98% of events have venue_id. The 2% without are typically:
- Virtual/online events
- TBD venue events (announced but venue not confirmed)
- Multi-location events

## Data Quality Metrics (as of 2026-02-03)

| Metric | Status | Count |
|--------|--------|-------|
| Total events | ✅ | 11,231 |
| Events next 30 days | ✅ | 4,070 |
| Events with category | ✅ 100% | 4,070 / 4,070 |
| Events with venue_id | ✅ 98% | 3,794 / 3,862 |
| Events with start_time | ✅ 85% | ~3,200 / 3,862 |
| Duplicate events | ✅ Filtered | 208 removed |
| Portal isolation | ✅ Working | 848 Atlanta events |

## Known Issues

1. **762 events with NULL portal_id** — Need portal assignment (see Priority 1 in diagnostic)
2. **Chain venue filtering not implemented** — `is_chain` column missing (see Priority 2)
3. **15% of events have NULL start_time** — Mostly all-day events (acceptable)

## Contact

For data quality issues, run the diagnostic scripts and attach the output to your issue report.
