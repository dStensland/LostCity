# HelpATL City/Fulton Crossover Repair And Mobilize Enrichment 001

Date: 2026-03-10
Portal: `helpatl`
Surface: `consumer`
Scope: jurisdiction routing, activist/civic source normalization

## Why this run happened

After re-auditing activist and Mobilize-hosted civic-process events, two things were true:

1. The Atlanta/Fulton crossover routing rules had silently drifted out of the source pack and were being deactivated on reprovision.
2. The shared Mobilize parser still needed stronger jurisdiction/process tags so future civic-process events carry more stable metadata upstream.

The first issue was a real portal regression. The second was an upstream data-quality hardening step.

## Changes shipped

### 1. Restored Atlanta/Fulton crossover rules to the manifest

Updated:

- `/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`

Changes:

- `atlanta-city-government` now explicitly includes an `expression` rule requiring:
  - `all_tags = ["government", "public-meeting"]`
  - title terms like `city district`, `councilmember`, `city council`, `atlanta city hall`
- `fulton-county-government` now explicitly includes an `expression` rule requiring:
  - `all_tags = ["government", "public-meeting"]`
  - title terms like `fulton county`, `board of registrations`, `board of elections`, `board of commissioners`

This brings the manifest back in line with the intended live routing behavior.

### 2. Repaired live DB rule state

Added:

- `/Users/coach/Projects/LostCity/database/migrations/352_helpatl_city_fulton_expression_rule_reactivate.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260310023000_helpatl_city_fulton_expression_rule_reactivate.sql`

Behavior:

- reactivates the Atlanta and Fulton crossover expression rules if present
- inserts them if missing

### 3. Hardened shared Mobilize civic-process tagging

Updated:

- `/Users/coach/Projects/LostCity/crawlers/sources/mobilize_api.py`
- `/Users/coach/Projects/LostCity/crawlers/tests/test_mobilize_api.py`

Behavior:

- keeps civic-process detection for:
  - `government`
  - `public-meeting`
  - `school-board`
  - `election`
- adds stable jurisdiction/process tags that survive current taxonomy validation
- verified against live Mobilize updates

## Verification

### Validation / provisioning

```bash
python3 -m json.tool docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json >/dev/null

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts \
  --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json

npx tsx scripts/portal-factory/provision-portal.ts \
  --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Results:

- source-pack validation passed
- reprovision completed with `deactivate = 0`

### Web contract tests

```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- \
  lib/interest-channel-matches.test.ts \
  lib/interest-channels.test.ts \
  lib/portal-scope.test.ts \
  lib/portal-attribution-guard.test.ts \
  lib/portal-query-context.test.ts
```

Result:

- `48` tests passed

### Mobilize parser verification

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_mobilize_api.py
python3 -m py_compile sources/mobilize_api.py tests/test_mobilize_api.py
python3 main.py --source mobilize-us --allow-production-writes --skip-launch-maintenance
```

Result:

- parser tests passed
- live `mobilize-us` crawl completed: `17 found, 0 new, 17 updated`

## Live outcomes

### Refreshed HelpATL materialization

- events scanned: `1738`
- matches written: `3560`

### Restored jurisdiction crossover matches

Event `100672`:

- `Join the Fulton County Board of Commissioners Meetings`
- matches:
  - `civic-engagement`
  - `civic-training-action-atl`
  - `fulton-county-government`

Event `100673`:

- `Fulton County: Join us for the Board of Registrations and Elections Meeting`
- matches:
  - `civic-engagement`
  - `civic-training-action-atl`
  - `fulton-county-government`

Event `119303`:

- `Fulton County: Join us for the Board of Registrations and Elections Meeting`
- matches:
  - `civic-engagement`
  - `civic-training-action-atl`
  - `fulton-county-government`

Event `119308`:

- `Support Neighbors in Atlanta City District 2 with Kelsea Bond`
- matches:
  - `atlanta-city-government`
  - `civic-engagement`
  - `civic-training-action-atl`
  - `education`

Event `100679`:

- `Public School Strong: Atlanta School Board Meeting`
- matches:
  - `civic-engagement`
  - `civic-training-action-atl`
  - `education`
  - `school-board-watch`

### Upstream Mobilize tag outcome

Verified live examples:

- `100672` now carries:
  - `fulton-county`
  - `fulton`
  - `public-meeting`
  - `government`
- `100673` now carries:
  - `fulton-county`
  - `fulton`
  - `public-meeting`
  - `government`
  - `election`
- `100679` now carries:
  - `atlanta`
  - `school-board`
  - `public-meeting`
  - `government`
  - `education`

## Current read

This run fixed a real source-of-truth problem:

- Atlanta and Fulton crossover routing is now stable across reprovisioning

It also improved the shared upstream source:

- Mobilize civic-process events now carry more useful jurisdiction/process tags in live data

That is the right balance for HelpATL: fewer portal-specific surprises, better classifier input at the source.
