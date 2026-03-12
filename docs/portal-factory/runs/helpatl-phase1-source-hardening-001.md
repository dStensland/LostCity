# HelpATL Phase 1 Source Hardening 001

- Date: 2026-03-10
- Portal: `helpatl`
- Scope: first Phase 1 hardening pass on the live volunteer top surface
- Decision: `go`, with remaining work on volume and source-truth cleanup

## 1) Work Completed

1. Tightened the volunteer-card matcher in [VolunteerThisWeekCard.tsx](/Users/coach/Projects/LostCity/web/components/feed/civic/VolunteerThisWeekCard.tsx#L1):
   - removed generic `support` as a volunteer signal
   - added hard civic exclusions for:
     - `government`
     - `public-meeting`
     - `public-comment`
     - `civic-engagement`
     - `school-board`
     - `npu`
     - `zoning`
     - `land-use`
   - added title-based exclusions for obvious civic meeting nouns:
     - `meeting`
     - `committee`
     - `board`
     - `council`
     - `hearing`
     - `agenda`
     - `commission`
2. Added regression coverage in [VolunteerThisWeekCard.test.ts](/Users/coach/Projects/LostCity/web/components/feed/civic/VolunteerThisWeekCard.test.ts#L1) for the leaked `Community Development/Human Services Committee — Regular Committee Meeting` case.
3. Re-ran `trees-atlanta` in production, which:
   - removed stale event `99668`
   - added/retained the current `Tree Care in Downtown` event as `99677` on `2026-03-12`
   - removed `1` stale Trees Atlanta event after refresh

## 2) Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- 'components/feed/civic/VolunteerThisWeekCard.tsx' 'components/feed/civic/VolunteerThisWeekCard.test.ts'
npm run test -- components/feed/civic/VolunteerThisWeekCard.test.ts
```

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source trees-atlanta --allow-production-writes --skip-launch-maintenance
```

Observed results:

1. `VolunteerThisWeekCard` tests passed.
2. `trees-atlanta` crawl completed with:
   - `20 found`
   - `1 new`
   - `19 updated`
   - `1` stale event removed

## 3) Measurable Impact

## Before

- distinct top-surface volunteer count: `14`
- duplicate rate: `0.0%`
- top-surface URL health sample:
  - `13/14` clean `200`
  - `1/14` broken `404`

## After

- distinct top-surface volunteer count: `12`
- duplicate rate: `0.0%`
- current top-surface URL health sample:
  - `12/12` clean `200`
  - `0/12` broken `404`

Interpretation:

1. The top volunteer surface is cleaner and more trustworthy.
2. The cleanup removed one false-positive civic meeting and one stale/broken Trees Atlanta event.
3. Quality improved, but volume dropped further below the execution-board target of `25+` distinct next-7-day opportunities.

## 4) Defects Resolved

1. `Volunteer This Week` no longer surfaces `Community Development/Human Services Committee — Regular Committee Meeting`.
2. The broken Trees Atlanta URL no longer appears in the live top-surface event sample.

## 5) Remaining Gaps

1. The top volunteer surface is still too thin at `12` distinct next-7-day items.
2. Hands On Atlanta still dominates the top sample.
3. The upstream event metadata bug still exists for at least one civic meeting:
   - the meeting carried `genres: ["volunteer"]`
   - the surfacing issue is fixed, but the source-truth issue remains upstream

## 6) Next Queue

Immediate next moves:

1. Audit why the volunteer top surface is only surfacing `12` distinct items despite broader underlying volunteer inventory.
2. Check whether the city-pulse payload is under-sampling volunteer events that exist in the database.
3. Continue source-quality hardening in this order:
   - `hands-on-atlanta`
   - `atlanta-community-food-bank`
   - `open-hand-atlanta`
   - `united-way-atlanta`

This run counts as a successful Phase 1 move because it removed two live user-facing quality defects from a high-traffic HelpATL surface.
