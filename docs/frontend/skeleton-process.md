# Portal Skeleton Process

## Goal
Keep loading skeletons aligned with the real portal experience for every vertical (`city`, `hotel`, `film`, `hospital`) as product surfaces evolve.

## Contract
Skeleton coverage is treated as a contract in code:
- Registry and resolver: `web/lib/skeleton-contract.ts`
- Contract tests: `web/lib/skeleton-contract.test.ts`
- Route marker guard tests: `web/app/[portal]/_components/__tests__/skeleton-process.test.ts`

Required route surfaces:
- `portal-root`
- `feed-view`
- `find-view`
- `community-view`
- `event-detail`
- `happening-now`

## Implementation pattern
1. Add `data-skeleton-route` + `data-skeleton-vertical` markers on the root of each skeleton branch.
2. Use `resolveSkeletonVertical(...)` from `web/lib/skeleton-contract.ts` in client loading files.
3. Keep vertical-specific skeleton branches for `hotel`, `film`, `hospital`, with `city` fallback.
4. If adding a new route-level skeleton surface, add it to:
   - `PORTAL_SKELETON_ROUTES`
   - `PORTAL_SKELETON_REGISTRY`
   - route marker tests

## Dev workflow
Before merging portal UI changes:
1. `cd web && npm run test:skeletons`
2. `cd web && npm run lint`
3. `cd web && npm run build`
4. Manually sanity check at least one portal per vertical.

CI also enforces this through `.github/workflows/web-quality.yml` for all PRs and pushes that touch `web/**`.

## PR checklist (recommended)
- [ ] Skeleton updated to match new real layout structure
- [ ] Route and vertical markers present
- [ ] Contract tests updated for new route/vertical needs
- [ ] `npm run test:skeletons` passes
