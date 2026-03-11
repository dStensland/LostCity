# HelpATL Atlanta City Crossover Expression Rule 001

Date: 2026-03-10 16:07:49 EDT
Portal: `helpatl`
Surface: `consumer`

## Why this pass

After closing the Fulton crossover case, there was one remaining justified city-level activist crossover:

- `Support Neighbors in Atlanta City District 2 with Kelsea Bond`

The event description explicitly ties it to a councilmember-led district workshop, so it belongs in `atlanta-city-government` in addition to the activist lanes.

## What changed

Added:

- [`database/migrations/350_helpatl_atlanta_city_expression_rule.sql`](/Users/coach/Projects/LostCity/database/migrations/350_helpatl_atlanta_city_expression_rule.sql)
- [`supabase/migrations/20260310021000_helpatl_atlanta_city_expression_rule.sql`](/Users/coach/Projects/LostCity/supabase/migrations/20260310021000_helpatl_atlanta_city_expression_rule.sql)

Rule shape:

- required tags: `government`, `public-meeting`
- title terms:
  - `city district`
  - `councilmember`
  - `city council`
  - `atlanta city hall`

This reuses the new shared `expression` matcher instead of adding more portal-specific code.

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity
set -a && source .env >/dev/null 2>&1
psql "$DATABASE_URL" -f database/migrations/350_helpatl_atlanta_city_expression_rule.sql

cd /Users/coach/Projects/LostCity/web
set -a && source ../.env >/dev/null 2>&1
export SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_KEY"
npx tsx <<'TS'
import { createClient } from '@supabase/supabase-js'
import * as matches from './lib/interest-channel-matches'
const fn = (matches as any).default?.refreshEventChannelMatchesForPortal ?? (matches as any).refreshEventChannelMatchesForPortal
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const { data: portal } = await db.from('portals').select('id').eq('slug', 'helpatl').maybeSingle()
const result = await fn(db, portal.id)
console.log(JSON.stringify(result, null, 2))
TS
```

Match refresh result:

```json
{
  "portalId": "8d479b53-bab7-433f-8df6-b26cf412cd1d",
  "startDate": "2026-03-10",
  "endDate": "2026-07-08",
  "channelsConsidered": 19,
  "eventsScanned": 1737,
  "matchesWritten": 3554
}
```

## Measured outcome

Target event:

- `Support Neighbors in Atlanta City District 2 with Kelsea Bond`

Matched channels after refresh:

- `atlanta-city-government`
- `civic-engagement`
- `civic-training-action-atl`
- `education`

Channel totals:

- `atlanta-city-government`: `54`
- HelpATL total event-channel matches: `3554`

## Boundary

No DeKalb crossover rule was added in this pass because there is still no justified live activist-hosted DeKalb public-meeting example in the current HelpATL inventory.
