# HelpATL Phase 1 Volunteer Card Week Pool 002

- Date: 2026-03-10
- Portal: `helpatl`
- Scope: restore truthful `Volunteer This Week` volume on the HelpATL home feed
- Decision: `go`

## 1) Root Cause

The low top-of-feed volunteer count was not primarily a source-coverage problem.

The real issue was product plumbing:

1. The initial `city-pulse` response only fetches `today` event data plus tab counts.
2. `Volunteer This Week` was being built from `lineupSections`, which on first load only reflected that partial initial event pool.
3. As a result, the volunteer card was competing with a `today-only` slice while claiming to represent the next week.

This was a feed-composition problem, not a crawler-volume problem.

## 2) Fix

Updated [CivicFeedShell.tsx](/Users/coach/Projects/LostCity/web/components/feed/CivicFeedShell.tsx#L1) so that HelpATL now:

1. keeps the initial lineup sections for immediate render
2. fetches the real `this_week` tab pool in the background using the existing `fetchTab("this_week")` path
3. swaps that tab-backed `this_week` section into the volunteer-card input

This keeps the change scoped:

- no new API contract
- no city-pulse route expansion
- no feed-wide payload bloat
- HelpATL gets truthful week inventory for the volunteer card

## 3) Verification

Command run:

```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- 'components/feed/CivicFeedShell.tsx' 'components/feed/civic/VolunteerThisWeekCard.tsx' 'components/feed/civic/VolunteerThisWeekCard.test.ts'
```

Measured check:

1. merged the base `city-pulse` response with the live `?tab=this_week` response
2. applied the current volunteer-card filtering and dedupe logic

## 4) Measured Impact

Before the fix:

- `Volunteer This Week` distinct next-7-day count after cleanup: `12`

After using the real `this_week` tab pool:

- `Volunteer This Week` distinct next-7-day count: `61`

That clears the execution-board target of `25+` by a large margin.

## 5) Strategic Read

This is the right kind of fix:

1. It restores truthful volume without weakening quality filters.
2. It avoids stuffing more data into the default city-pulse payload.
3. It proves the next bottleneck is not “add more sources,” but “make sure the right inventory reaches the right surface.”

## 6) Remaining Follow-Up

Two follow-ups still matter:

1. Browser QA to confirm the card visibly updates from the background week-pool fetch without awkward flicker.
2. Audit some newly surfaced week-pool volunteer items for quality, since higher volume will expose more long-tail metadata issues.

This run counts as successful because it moved a live HelpATL top-surface metric from below target (`12`) to well above target (`61`) through a scoped product fix.
