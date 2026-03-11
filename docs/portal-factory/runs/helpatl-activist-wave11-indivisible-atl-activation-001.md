# HelpATL Activist Wave 11: Indivisible ATL activation

Date: 2026-03-10 16:07:49 EDT
Portal: `helpatl`
Surface: `consumer`

## Why this wave

`indivisible-atl` already existed in the repo and database, but it was inactive despite having a strong public activist event surface. A direct browser check showed `38` event cards on the live page, including `8` upcoming events with concrete dates.

That made it a better immediate activation candidate than building another net-new crawler.

## What changed

- Added [`database/migrations/347_helpatl_indivisible_atl_source.sql`](/Users/coach/Projects/LostCity/database/migrations/347_helpatl_indivisible_atl_source.sql)
- Added [`supabase/migrations/20260310018000_helpatl_indivisible_atl_source.sql`](/Users/coach/Projects/LostCity/supabase/migrations/20260310018000_helpatl_indivisible_atl_source.sql)
- Added `indivisible-atl` to HelpATL's activist source pack in [`docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`](/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json)
- Ran the live crawler and reprovisioned HelpATL

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity
set -a && source .env >/dev/null 2>&1
psql "$DATABASE_URL" -f database/migrations/347_helpatl_indivisible_atl_source.sql

cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source indivisible-atl --allow-production-writes --skip-launch-maintenance

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Match refresh result:

```json
{
  "portalId": "8d479b53-bab7-433f-8df6-b26cf412cd1d",
  "startDate": "2026-03-10",
  "endDate": "2026-07-08",
  "channelsConsidered": 19,
  "eventsScanned": 1737,
  "matchesWritten": 3549
}
```

## Live outcome

- HelpATL active source subscriptions: `48`
- HelpATL total event-channel matches: `3549`
- `civic-training-action-atl`: `86` matches
- Indivisible ATL future dated events: `7`
- Indivisible ATL matches in `civic-training-action-atl`: `7`

## Product read

This was worth doing. Indivisible ATL is a real activist-volume source with dated public events, and it strengthens the same civic-action lane as ATL DSA, Fair Count, Georgia Equality, and Common Cause without requiring a new product surface.

## Next best move

- Audit the event classification quality for activist sources now landing in `Civic Training & Action`, especially events that may also deserve government-watch or election-admin tags.
