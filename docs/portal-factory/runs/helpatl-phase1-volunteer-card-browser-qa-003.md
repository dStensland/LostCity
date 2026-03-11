# HelpATL Phase 1 Volunteer Card Browser QA 003

- Date: 2026-03-10
- Portal: `helpatl`
- Scope: browser verification for the `Volunteer This Week` week-pool fix
- Decision: `go`

## 1) What Happened

The first implementation of the week-pool swap introduced a client render loop in [CivicFeedShell.tsx](/Users/coach/Projects/LostCity/web/components/feed/CivicFeedShell.tsx#L1).

Root cause:

1. `lineupSections` was being copied into state on every render cycle.
2. That state update retriggered render and re-fired the effect.
3. The browser surfaced repeated `Maximum update depth exceeded` errors and the volunteer card stayed on the initial partial feed slice.

## 2) Fix

Reworked the flow in [CivicFeedShell.tsx](/Users/coach/Projects/LostCity/web/components/feed/CivicFeedShell.tsx#L1):

1. keep `lineupSections` as derived data
2. store only the fetched `this_week` override in state
3. compose the final volunteer-card sections with `useMemo`

This removed the render loop and allowed the card to adopt the live `this_week` tab pool.

## 3) Verification

Lint:

```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- 'components/feed/CivicFeedShell.tsx' 'components/feed/civic/VolunteerThisWeekCard.tsx' 'components/feed/civic/VolunteerThisWeekCard.test.ts'
```

Browser QA:

1. opened `http://127.0.0.1:3000/helpatl`
2. waited for hydration plus the background `this_week` fetch
3. checked the rendered volunteer card text on desktop and mobile
4. captured screenshots

Rendered result on both desktop and mobile:

- `Volunteer This Week`
- `61 this week`

## 4) Evidence

Screenshots saved to:

1. [helpatl-home-volunteer-card-desktop-qa-fixed.png](/Users/coach/Projects/LostCity/output/playwright/helpatl-home-volunteer-card-desktop-qa-fixed.png)
2. [helpatl-home-volunteer-card-mobile-qa-fixed.png](/Users/coach/Projects/LostCity/output/playwright/helpatl-home-volunteer-card-mobile-qa-fixed.png)

## 5) Read

This closes the main product-side volume defect for the volunteer action hub.

The card now:

1. uses the truthful week inventory
2. keeps the tighter quality filter
3. clears the `25+` execution-board bar with `61`

## 6) Next Quality Queue

The next best Phase 1 move is not more feed plumbing. It is a targeted long-tail quality pass on the newly surfaced week-pool results.

Examples already worth auditing:

1. generic titles like `Volunteer Session - Wednesday 09:00 AM`
2. any long-tail sources newly exposed by the week-pool fetch

This run counts as successful because it confirms the fixed browser behavior, not just the synthetic merged payload.
