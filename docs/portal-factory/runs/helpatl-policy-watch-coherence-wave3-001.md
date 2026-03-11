# HelpATL Policy Watch Coherence Wave 3 001

- Date: 2026-03-11
- Portal: `helpatl`
- Workstream: `Now / B` policy spine coherence
- Goal: make HelpATL's policy/news layer read as one intentional feature instead of a generic inherited news feed

## What changed

Added a HelpATL-only `Policy Watch` module in the civic feed that uses only HelpATL-local network sources.

Files:
- [route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/[slug]/network-feed/route.ts)
- [NetworkFeedSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/NetworkFeedSection.tsx)
- [CivicFeedShell.tsx](/Users/coach/Projects/LostCity/web/components/feed/CivicFeedShell.tsx)

## Product shape

New behavior:
- network feed API supports `source_scope=local|parent|all`
- `Policy Watch` on HelpATL uses:
  - local-only sources
  - categories `news`, `civic`, `politics`
  - default tab `civic`
- the existing `Civic Updates` module remains the broader merged local + parent civic/news view

Why this helps:
- HelpATL’s four local policy sources are now visible as a deliberate editorial spine
- Atlanta can stay lighter
- HelpATL can stay broader by inheriting city coverage while still giving policy-heavy users a focused entry point

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- 'app/api/portals/[slug]/network-feed/route.ts' 'components/feed/sections/NetworkFeedSection.tsx' 'components/feed/CivicFeedShell.tsx'
npx tsx scripts/portal-factory/validate-network-feed-inheritance.ts helpatl,atlanta
```

## Measured state

HelpATL local policy/news sources:
- `atlanta-civic-circle`
- `georgia-recorder`
- `capitol-beat`
- `gbpi`

Local HelpATL policy/news posts in 30 days:
- total: `46`
- by source:
  - `georgia-recorder`: `29`
  - `capitol-beat`: `11`
  - `atlanta-civic-circle`: `4`
  - `gbpi`: `2`

Network inheritance after the change:
- HelpATL local active sources: `4`
- HelpATL parent active sources: `15`
- HelpATL resolved posts in 30 days: `187`
- Atlanta resolved posts in 30 days: `141`

## Decision

Decision: `continue`

This closes the product-coherence part of the policy spine workstream. The remaining open issue is not whether HelpATL has a coherent policy feature. It is whether statewide process authority can clear the final `Georgia Democracy Watch` threshold without brittle scraping.
