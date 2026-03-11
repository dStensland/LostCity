# HelpATL Fulton Crossover Expression Rule 001

Date: 2026-03-10 16:07:49 EDT
Portal: `helpatl`
Surface: `consumer`

## Why this pass

After activist-source hardening, HelpATL still had a structural routing gap:

- activist-hosted Fulton public meetings were correctly tagged as `government` + `public-meeting`
- but `fulton-county-government` was source-only, so those events stayed trapped in `Civic Training & Action`

## What changed

### 1. Minimal expression-rule support

Updated [`web/lib/interest-channel-matches.ts`](/Users/coach/Projects/LostCity/web/lib/interest-channel-matches.ts) to support a minimal `expression` rule shape:

- `all_tags`
- `any_tags`
- `any_title_terms`
- `title_regex`

This keeps the matcher generic without adding portal-specific code.

### 2. Fulton-specific crossover rule

Added [`database/migrations/349_helpatl_fulton_expression_rule.sql`](/Users/coach/Projects/LostCity/database/migrations/349_helpatl_fulton_expression_rule.sql) and [`supabase/migrations/20260310020000_helpatl_fulton_expression_rule.sql`](/Users/coach/Projects/LostCity/supabase/migrations/20260310020000_helpatl_fulton_expression_rule.sql) to let clearly identified activist-hosted Fulton public meetings join `fulton-county-government`.

Rule shape:

- required tags: `government`, `public-meeting`
- title terms:
  - `fulton county`
  - `board of registrations`
  - `board of elections`
  - `board of commissioners`

### 3. Test coverage

Added expression-rule coverage in [`web/lib/interest-channel-matches.test.ts`](/Users/coach/Projects/LostCity/web/lib/interest-channel-matches.test.ts).

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/interest-channel-matches.test.ts lib/interest-channels.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts
npm run lint -- 'lib/interest-channel-matches.ts' 'lib/interest-channel-matches.test.ts'

cd /Users/coach/Projects/LostCity
set -a && source .env >/dev/null 2>&1
psql "$DATABASE_URL" -f database/migrations/349_helpatl_fulton_expression_rule.sql
```

Match refresh result:

```json
{
  "portalId": "8d479b53-bab7-433f-8df6-b26cf412cd1d",
  "startDate": "2026-03-10",
  "endDate": "2026-07-08",
  "channelsConsidered": 19,
  "eventsScanned": 1737,
  "matchesWritten": 3553
}
```

## Measured outcome

Target event:

- `Fulton County: Join us for the Board of Registrations and Elections Meeting`

Matched channels after refresh:

- `civic-engagement`
- `civic-training-action-atl`
- `fulton-county-government`

Channel totals:

- `fulton-county-government`: `3`
- HelpATL total event-channel matches: `3553`

## Remaining gap

This solved the proven Fulton crossover case only.

Still not covered:

- DeKalb activist-hosted public meetings into `dekalb-county-government`
- City of Atlanta activist-hosted public meetings into `atlanta-city-government`

Those should use the same expression-rule pattern if real examples justify them.
