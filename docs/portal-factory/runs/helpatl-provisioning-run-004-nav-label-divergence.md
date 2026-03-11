# HelpATL Provisioning Run 004 — Nav Label Divergence Lock

- Date: 2026-03-07
- Operator: Codex
- Goal: enforce portal-level nav semantics split between `atlanta` (discovery) and `helpatl` (civic action), and align manifest + runtime behavior.

## Changes Applied

1. Added nav-label compatibility resolver for `feed/find/community` plus legacy `events/spots`.
2. Wired resolver into all major header/nav surfaces:
   - `web/components/MainNav.tsx`
   - `web/components/headers/StandardHeader.tsx`
   - `web/components/headers/BrandedHeader.tsx`
   - `web/components/headers/ImmersiveHeader.tsx`
   - `web/components/UnifiedHeader.tsx`
3. Extended nav label typing contracts:
   - `web/lib/portal-context.tsx`
   - `web/lib/admin/portal-edit-context.tsx`
   - `web/lib/experience-compiler/types.ts`
   - `web/lib/experience-compiler/schema.ts`
4. Updated HelpATL manifest nav labels to canonical keys:
   - `feed=Act`
   - `find=Calendar`
   - `community=Groups`
5. Added idempotent data migration for portal nav labels:
   - `database/migrations/289_portal_nav_labels_split.sql`
   - `supabase/migrations/20260307140000_portal_nav_labels_split.sql`

## Commands Run

1. Apply nav-label migration:
```bash
source .env >/dev/null 2>&1
psql "$DATABASE_URL" -f database/migrations/289_portal_nav_labels_split.sql
```

2. Re-apply HelpATL manifest (activate):
```bash
source .env >/dev/null 2>&1
npx tsx web/scripts/portal-factory/provision-portal.ts \
  --manifest docs/portal-factory/manifests/atlanta-civic-volunteer-v1.json \
  --activate
```

3. Verify DB nav label state:
```bash
source .env >/dev/null 2>&1
psql "$DATABASE_URL" -Atc \
  "select slug, settings->'nav_labels' from portals where slug in ('atlanta','helpatl') order by slug;"
```

## Verification Results

1. Migration result:
   - `UPDATE 1` (`atlanta`)
   - `UPDATE 1` (`helpatl`)
2. Manifest re-provision result:
   - portal `helpatl` active
   - sections `insert=0, update=3`
   - channels `insert=0, update=5`
   - rules `insert=0, update=0, deactivate=0`
3. Runtime nav labels in DB:
   - `atlanta`: `{"feed":"Discover","find":"What's On","community":"Scene","events":"Stuff","spots":"Places"}`
   - `helpatl`: `{"feed":"Act","find":"Calendar","community":"Groups","events":"Calendar","spots":"Community Spots"}`
4. Code validation:
   - targeted `eslint` passed
   - `vitest` passed for:
     - `lib/nav-labels.test.ts`
     - `lib/portal-query-context.test.ts`
     - `lib/portal-scope.test.ts`
     - `lib/portal-attribution-guard.test.ts`
