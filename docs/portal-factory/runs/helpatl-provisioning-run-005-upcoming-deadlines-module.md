# HelpATL Provisioning Run 005 — Upcoming Deadlines Module

- Date: 2026-03-07
- Operator: Codex
- Goal: add a HelpATL-specific "Upcoming Deadlines" feed module to surface near-term civic actions.

## Change Summary

1. Added a `helpatl`-gated `Upcoming Deadlines` card in:
   - `web/components/feed/CityPulseShell.tsx`
2. Module behavior:
   - derives from already-fetched lineup event items
   - deduplicates by event id
   - sorts by event start timestamp
   - shows next 3 items with date/time labels and direct event links
3. No API contract changes required; computed client-side from existing feed payload.

## Validation

1. Lint:
```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- components/feed/CityPulseShell.tsx
```

2. Related nav-label regression check:
```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/nav-labels.test.ts
```

Result:
- lint passed
- tests passed
