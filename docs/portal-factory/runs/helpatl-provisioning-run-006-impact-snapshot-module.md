# HelpATL Provisioning Run 006 — Impact Snapshot Module

- Date: 2026-03-08
- Operator: Codex
- Goal: add a HelpATL-specific "Impact Snapshot" module with real channel/match counts.

## Change Summary

1. Added a new consumer API endpoint:
   - `web/app/api/portals/[slug]/impact-snapshot/route.ts`
2. Endpoint metrics (7-day window):
   - `matched_opportunities`
   - `groups_joined`
   - `new_meetings`
3. Added a HelpATL-only feed card in:
   - `web/components/feed/CityPulseShell.tsx`
4. Card placement:
   - under `Join Groups`
   - above `Upcoming Deadlines`

## API Behavior

1. Uses interest-channel data only; no manual heuristics.
2. Uses portal-scoped matches from `event_channel_matches`.
3. Uses user subscriptions when authenticated; otherwise falls back to portal channel totals.
4. `new_meetings` is derived from matched events on `jurisdiction` + `institution` channels.

## Validation

1. Lint:
```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- app/api/portals/[slug]/impact-snapshot/route.ts components/feed/CityPulseShell.tsx
```

2. Interest-channel regression tests:
```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts
```

3. Route smoke test (local invocation):
```bash
cd /Users/coach/Projects/LostCity/web
npx tsx -e "import { GET } from './app/api/portals/[slug]/impact-snapshot/route'; const req = new Request('http://localhost:3000/api/portals/helpatl/impact-snapshot'); GET(req as any, { params: Promise.resolve({ slug: 'helpatl' }) } as any).then(async (res: any) => { console.log('status', res.status); console.log(await res.json()); });"
```

Result:
- lint passed
- tests passed
- smoke test returned `404` when `ENABLE_INTEREST_CHANNELS_V1` is disabled (expected)
- with `ENABLE_INTEREST_CHANNELS_V1=true`, endpoint returns `200` with impact snapshot payload
