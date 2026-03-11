# HelpATL Civic Participation Wave 2 001

- Date: 2026-03-09
- Portal slug: `helpatl`
- Manifest: `docs/portal-factory/manifests/atlanta-civic-humanitarian-v4.json`
- Decision: `go`

## What Shipped

Added `Common Cause Georgia` to HelpATL as a real civic action event source and seeded two new structured civic participation opportunities:

1. `common-cause-georgia-volunteer-team`
2. `canopy-atlanta-documenter`

This wave extends the civic participation layer in two truthful directions:

1. dated democracy and advocacy events
2. recurring civic participation pathways

## Code + Data Changes

Files:

1. `crawlers/sources/common_cause_georgia.py`
2. `database/migrations/309_helpatl_civic_participation_wave2.sql`
3. `supabase/migrations/20260309930000_helpatl_civic_participation_wave2.sql`
4. `docs/portal-factory/manifests/atlanta-civic-humanitarian-v4.json`
5. `web/components/volunteer/VolunteerProfilePanel.tsx`
6. `web/app/[portal]/volunteer/opportunities/page.tsx`

## Validation

Passed:

```bash
python3 -m py_compile /Users/coach/Projects/LostCity/crawlers/sources/common_cause_georgia.py
python3 -m json.tool /Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v4.json

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v4.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v4.json --dry-run
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v4.json
npm run lint -- 'app/[portal]/volunteer/opportunities/page.tsx' 'components/volunteer/VolunteerProfilePanel.tsx'
```

DB migration applied:

```bash
set -a && source .env && psql "$DATABASE_URL" -f database/migrations/309_helpatl_civic_participation_wave2.sql
```

Source crawl applied:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source common-cause-georgia --allow-production-writes
```

Channel refresh applied twice:

1. after initial v4 provisioning
2. after fixing false volunteer tagging on Common Cause events

## Resulting HelpATL State

After provisioning:

- active source subscriptions: `29`
- active channels: `19`
- channel rules: `52`

After final match refresh:

- `eventsScanned: 1534`
- `matchesWritten: 3083`

## Civic Participation Impact

### `civic-training-action-atl`

- total matches: `24`
- source mix:
  - `marta-army: 14`
  - `civic-innovation-atl: 5`
  - `common-cause-georgia: 3`
  - `lwv-atlanta: 2`

### `neighborhood-participation-atl`

- total matches: `138`
- source mix:
  - `atlanta-city-planning: 138`

### `ongoing-opportunities-atl`

- total matches: `63`
- includes `1` Common Cause recurring civic action event (`Democracy Squad`) via training-style tagging

## Structured Opportunity Impact

HelpATL structured volunteer/civic opportunities now total `19`.

Cause mix now includes:

- `civic_engagement: 2`
- `immigrant_refugee: 4`
- `environment: 3`
- `housing: 2`
- `legal_aid: 2`
- `youth_education: 2`
- `food_security: 2`
- `family_support: 1`
- `education: 1`

New civic participation opportunities:

1. `common-cause-georgia-volunteer-team`
2. `canopy-atlanta-documenter`

## Important Fix During Rollout

The initial Common Cause crawler version was leaking page-chrome text into event tags and incorrectly routing civic action events into `Volunteer This Week`.

That was corrected before finalization by removing the false `volunteer` tagging path and re-running the source crawl plus channel refresh.

Final Common Cause event routing:

1. all `3` events match `civic-training-action-atl`
2. all `3` events also match the older `civic-engagement` cause channel
3. the `Democracy Squad` call also matches `ongoing-opportunities-atl`
4. Common Cause events no longer pollute `Volunteer This Week`

## Residual Risk

`Atlanta municipal clerk` is still not onboarded. The public notices page currently returns `403 Access Denied` even under Playwright, so the boards-and-commissions layer remains incomplete.

## Next Move

The next highest-leverage step is either:

1. solve `atlanta-municipal-clerk` access and add official boards / commissions / public notice coverage, or
2. add `Canopy Atlanta`-adjacent civic meeting assignments and `Documenters` workshop depth if the public source surface can be modeled cleanly.
