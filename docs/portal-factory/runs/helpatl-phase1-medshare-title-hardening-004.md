# HelpATL Phase 1: MedShare Title Hardening 004

Date: 2026-03-10 13:10 EDT

## Goal

Clean up low-signal MedShare volunteer titles that were surfacing in HelpATL's top-of-feed `Volunteer This Week` experience.

## Problem

MedShare recurring shifts were being stored as generic titles like:

- `Volunteer Session - Wednesday 09:00 AM`
- `Volunteer Session - Thursday 13:00 PM`

Those titles weakened the trustworthiness of the top volunteer surface after the week-pool expansion.

## Root Cause

Two source-level issues were present in `crawlers/sources/medshare.py`:

1. The crawler generated generic `Volunteer Session - ...` titles instead of descriptive user-facing titles.
2. On hash hits, it called `smart_update_existing_event(existing, event_record)` before the volunteer `event_record` had been constructed, so the update path reused stale data.

## Fix

Updated `crawlers/sources/medshare.py` to:

- generate descriptive titles like `Medical Supply Volunteer Session - Thursday 1:00 PM`
- preserve the legacy content-hash input so existing MedShare rows are updated instead of duplicated
- apply a MedShare-specific title sync before the shared smart-update path

Added regression coverage in `crawlers/tests/test_medshare.py` for:

- descriptive title formatting
- legacy hash continuity
- title sync behavior for existing rows

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_medshare.py
python3 -m py_compile sources/medshare.py tests/test_medshare.py
python3 main.py --source medshare --allow-production-writes --skip-launch-maintenance
```

Measured live outcome:

- MedShare crawl completed: `1 found, 0 new, 49 updated`
- future MedShare generic-title rows remaining: `0`

Example corrected live rows:

- `Medical Supply Volunteer Session - Wednesday 9:00 AM`
- `Medical Supply Volunteer Session - Thursday 1:00 PM`
- `Medical Supply Volunteer Session - Saturday 9:00 AM`

## Effect On Execution Board

This closes one of the highest-signal title-quality defects in the expanded week pool without changing HelpATL's volunteer volume.

Phase 1 status after this pass:

- `Volunteer This Week` week-pool volume remains above target
- false-positive civic meeting removed
- stale Trees Atlanta broken URL removed
- MedShare generic volunteer titles cleaned up at the source and in live data
