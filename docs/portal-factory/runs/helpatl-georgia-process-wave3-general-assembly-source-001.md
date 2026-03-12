# HelpATL Georgia Process Wave 3: General Assembly Source 001

- Date: 2026-03-11
- Portal: `helpatl`
- Workstream: `Now / A` statewide process authority
- Goal: close the last official statewide-process gap in `Georgia Democracy Watch`

## What shipped

Added `georgia-general-assembly` as a new official HelpATL live event source and routed it into `Georgia Democracy Watch`.

Files:
- [georgia_general_assembly.py](/Users/coach/Projects/LostCity/crawlers/sources/georgia_general_assembly.py)
- [test_georgia_general_assembly.py](/Users/coach/Projects/LostCity/crawlers/tests/test_georgia_general_assembly.py)
- [444_helpatl_georgia_general_assembly_source.sql](/Users/coach/Projects/LostCity/database/migrations/444_helpatl_georgia_general_assembly_source.sql)
- [20260311150000_helpatl_georgia_general_assembly_source.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260311150000_helpatl_georgia_general_assembly_source.sql)
- [atlanta-civic-humanitarian-v5.json](/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json)

## Source model

Official surfaces used:
- `https://www.legis.ga.gov/schedule/senate`
- `https://www.legis.ga.gov/api/authentication/token`
- `https://www.legis.ga.gov/api/meetings`

Events captured:
- House committee meetings
- Senate committee meetings
- chamber-process meetings and subcommittee hearings

Reason this source was selected:
- Georgia SOS and State Election Board pages remain access-blocked in this runtime
- the Georgia General Assembly public schedule shell is a SPA, but it uses a stable official meetings API behind the public frontend
- this gives HelpATL official statewide process coverage without brittle DOM scraping

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_georgia_general_assembly.py
python3 -m py_compile sources/georgia_general_assembly.py tests/test_georgia_general_assembly.py
python3 main.py --source georgia-general-assembly --allow-production-writes --skip-launch-maintenance

source /Users/coach/Projects/LostCity/.env >/dev/null 2>&1
source /Users/coach/Projects/LostCity/.env.local >/dev/null 2>&1
psql "$DATABASE_URL" -f /Users/coach/Projects/LostCity/database/migrations/444_helpatl_georgia_general_assembly_source.sql

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json --activate
```

Channel refresh:

```bash
cd /Users/coach/Projects/LostCity/web
set -a && source ../.env >/dev/null 2>&1 && source ../.env.local >/dev/null 2>&1
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

Refresh result:

```json
{
  "portalId": "8d479b53-bab7-433f-8df6-b26cf412cd1d",
  "startDate": "2026-03-11",
  "endDate": "2026-07-09",
  "channelsConsidered": 20,
  "eventsScanned": 1403,
  "matchesWritten": 2960,
  "startedAt": "2026-03-11T22:26:20.181Z",
  "completedAt": "2026-03-11T22:26:30.409Z"
}
```

## Measured result

Crawler / DB result:
- `17` active upcoming General Assembly events in the source
- `17` landed in `Georgia Democracy Watch` within the next 30 days

Representative lane items now include:
- `Senate: Appropriations: Criminal Justice and Public Safety Subcommittee`
- `Senate: Appropriations: Government Operations Subcommittee`
- `House: AGRICULTURE AND CONSUMER AFFAIRS`
- `House: JUDICIARY NON-CIVIL`
- `House: Education Subcommittee on Curriculum and Academic Achievement`
- `Join us at the March 18 State Election Board Meeting`
- `COMMISSION MEETING: March 30, 2026`

`Georgia Democracy Watch` next-30-day count:
- before: `4`
- after: `21`

Portal state after refresh:
- HelpATL status: `active`
- active live event sources: `37`
- active channels: `20`
- materialized event-channel matches: `2960`

## Decision

Decision: `continue`

This closes the statewide process authority gap without violating the “no brittle scraping” guardrail.

## Outcome

`Now / A` on the finish board is now closed.
