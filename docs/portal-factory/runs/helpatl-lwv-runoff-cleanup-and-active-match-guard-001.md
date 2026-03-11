# HelpATL LWV Runoff Cleanup And Active Match Guard 001

Date: 2026-03-10
Portal: `helpatl`
Surface: `consumer`
Scope: source normalization, stale duplicate cleanup, event-channel materialization quality

## Why this run happened

After adding `georgia-democracy-watch`, the live LWV election inventory exposed two quality issues:

1. one statewide election row had a source-side title typo: `Eunoff` instead of `Runoff`
2. a corrected recrawl initially created a duplicate because the legacy row and the new row disagreed on both title and `www` URL normalization

While cleaning that up, a more important platform issue surfaced:

- `refreshEventChannelMatchesForPortal(...)` was materializing future events without filtering `is_active = true`

That meant deactivated duplicates could still be eligible for channel materialization.

## Changes shipped

### 1. Fixed LWV title normalization upstream

Updated:

- `/Users/coach/Projects/LostCity/crawlers/sources/lwv_atlanta.py`
- `/Users/coach/Projects/LostCity/crawlers/tests/test_lwv_atlanta.py`

Behavior:

- normalizes `Eunoff` → `Runoff`
- adds a source-specific normalized-detail-URL fallback match
- upgrades legacy typo rows to the canonical hash instead of inserting fresh duplicates

### 2. Repaired already-polluted LWV runoff data

Added:

- `/Users/coach/Projects/LostCity/database/migrations/354_lwv_runoff_title_cleanup.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260310025000_lwv_runoff_title_cleanup.sql`

Behavior:

- updates the canonical June 16 LWV runoff row to the corrected title/hash
- deactivates the duplicate row created during the first correction pass

### 3. Fixed portal materialization to ignore inactive events

Updated:

- `/Users/coach/Projects/LostCity/web/lib/interest-channel-matches.ts`
- `/Users/coach/Projects/LostCity/web/lib/interest-channel-matches.test.ts`

Behavior:

- `refreshEventChannelMatchesForPortal(...)` now filters `events.is_active = true`
- regression test confirms inactive rows do not materialize into channel matches

## Verification

### Crawler verification

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_lwv_atlanta.py
python3 -m py_compile sources/lwv_atlanta.py tests/test_lwv_atlanta.py
python3 main.py --source lwv-atlanta --allow-production-writes --skip-launch-maintenance
```

Results:

- LWV tests passed
- post-fix live crawl: `5 found, 0 new, 5 updated`

### Web verification

```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- \
  lib/interest-channel-matches.test.ts \
  lib/interest-channels.test.ts \
  lib/portal-scope.test.ts \
  lib/portal-attribution-guard.test.ts \
  lib/portal-query-context.test.ts

npm run lint -- \
  lib/interest-channel-matches.ts \
  lib/interest-channel-matches.test.ts
```

Results:

- `49` tests passed
- lint passed

### Live data confirmation

After cleanup:

- `54437` is now:
  - `General Primary Election/Nonpartisan Runoff`
  - active
  - canonical hash `27715f1df3f2046fe23707889f7d639e`
- `119663` is now inactive

`georgia-democracy-watch` now correctly shows only:

1. `General Primary Election/Nonpartisan Election`
2. `General Primary Election/Nonpartisan Runoff`
3. `Join us at the March 18 State Election Board Meeting`

## Materialization impact

After adding the `is_active` guard and refreshing HelpATL:

- events scanned: `1740 -> 1339`
- matches written: `3568 -> 2783`

This is the correct direction.

The previous numbers were inflated by inactive future rows still being eligible for channel materialization. The lower post-fix total is more trustworthy.

## Current read

This run matters more than the LWV typo itself:

- HelpATL’s institutional civic channels are now being scored against active events only

That improves the quality of every channel metric and every future coverage audit built on `event_channel_matches`.
