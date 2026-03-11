# HelpATL Network Feed Merge Model 001

- Date: 2026-03-11
- Scope: network/news source access model for `atlanta` and `helpatl`
- Surface: `consumer`
- Decision: `go`

## 1) What changed

### Shared merge contract

The network-feed path no longer resolves as:

1. child local sources only
2. otherwise parent sources only

It now resolves as:

1. child local network-source pool
2. plus parent network-source pool when present

Files:

- [network-feed-access.ts](/Users/coach/Projects/LostCity/web/lib/network-feed-access.ts)
- [network-feed-access.test.ts](/Users/coach/Projects/LostCity/web/lib/network-feed-access.test.ts)
- [route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/[slug]/network-feed/route.ts)
- [validate-network-feed-inheritance.ts](/Users/coach/Projects/LostCity/web/scripts/portal-factory/validate-network-feed-inheritance.ts)

### Policy sources moved into HelpATL's local pool

Moved:

1. `georgia-recorder`
2. `capitol-beat`

Migration files:

- [422_helpatl_network_policy_sources.sql](/Users/coach/Projects/LostCity/database/migrations/422_helpatl_network_policy_sources.sql)
- [20260311131400_helpatl_network_policy_sources.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260311131400_helpatl_network_policy_sources.sql)

Live data was also updated directly via service-role writes in this environment.

## 2) Verified live state

After the move:

- `helpatl` local active network sources: `2`
- `helpatl` parent active network sources: `16`
- HelpATL accessible feed portals: `helpatl, atlanta`
- HelpATL local posts in last `30` days: `39`
- HelpATL resolved posts in last `30` days: `182`

- `atlanta` local active network sources: `16`
- Atlanta accessible feed portals: `atlanta`
- Atlanta local posts in last `30` days: `143`

This is the intended shape:

1. Atlanta keeps the lighter city-news pool
2. HelpATL adds the wonkier policy sources locally
3. HelpATL still inherits Atlanta's broader city-news coverage

## 3) Atlanta tone

Atlanta’s home-feed network teaser is still presentation-filtered to a lighter mix through:

- [CityPulseShell.tsx](/Users/coach/Projects/LostCity/web/components/feed/CityPulseShell.tsx)
- [NetworkFeedSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/NetworkFeedSection.tsx)

That keeps Atlanta from feeling like a policy blog at the top of the feed even while the deeper network/news system gets more capable.

## 4) Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- 'app/api/portals/[slug]/network-feed/route.ts' 'scripts/portal-factory/validate-network-feed-inheritance.ts' 'lib/network-feed-access.ts' 'lib/network-feed-access.test.ts' 'components/feed/CityPulseShell.tsx' 'components/feed/sections/NetworkFeedSection.tsx'
npm run test -- lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts lib/network-feed-access.test.ts
npx tsx scripts/portal-factory/validate-network-feed-inheritance.ts helpatl,atlanta
```

## 5) Residual risk

Two caveats remain:

1. the migration files exist in-repo, but this environment still does not expose a direct Postgres path for updating the Supabase migration ledger
2. a direct in-process route invocation using `NextRequest` failed because that path did not have the public Supabase env loaded the same way the real app runtime does

Neither caveat changes the verified live state above.
