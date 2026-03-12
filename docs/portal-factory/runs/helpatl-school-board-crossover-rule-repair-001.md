# HelpATL School Board Crossover Rule Repair 001

Date: 2026-03-10
Portal: `helpatl`
Surface: `consumer`
Scope: portal channel routing, civic participation classification

## Why this run happened

After the Mobilize civic-process enrichment pass, activist-hosted school board events were carrying the right `school-board` tag but were still not materializing into HelpATL's `school-board-watch` channel.

The root cause was data drift:

- the live `school-board-watch` fallback tag rule existed in `interest_channel_rules`
- but it was `is_active = false`
- and the current manifest did not declare the fallback rule, so reprovisioning would not restore it

This was a routing/data-contract issue, not a crawler-tagging issue.

## Changes shipped

### 1. Restored source-of-truth manifest coverage

Updated:

- `/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`

Change:

- added a `tag` rule for `school-board-watch` with payload `{ "tag": "school-board" }`
- kept official school-board source rules in place as the primary match path

### 2. Repaired live database state

Added:

- `/Users/coach/Projects/LostCity/database/migrations/351_helpatl_school_board_tag_rule_reactivate.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260310022000_helpatl_school_board_tag_rule_reactivate.sql`

Behavior:

- reactivates the existing `school-board-watch` tag rule if present
- inserts the fallback rule if it is missing
- normalizes payload and priority to the expected shape

## Verification

### Manifest / provisioning

```bash
cd /Users/coach/Projects/LostCity
python3 -m json.tool docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json >/dev/null

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts \
  --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json

npx tsx scripts/portal-factory/provision-portal.ts \
  --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Result:

- source-pack validation passed
- HelpATL reprovision completed

### Live rule-state check

After repair, `school-board-watch` rules are:

- `source` rule for:
  - `atlanta-public-schools-board`
  - `fulton-county-schools-board`
  - `dekalb-county-schools-board`
- `tag` rule:
  - `{ "tag": "school-board" }`
  - `priority = 50`
  - `is_active = true`

### Match refresh

```bash
cd /Users/coach/Projects/LostCity/web
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_KEY" npx tsx -e "..."
```

Materialization result:

- events scanned: `1738`
- matches written: `3555`

### Target event confirmation

Event:

- `100679`
- `Public School Strong: Atlanta School Board Meeting`

Post-refresh matches:

- `civic-training-action-atl`
- `education`
- `school-board-watch`
- `civic-engagement`

### Channel-level outcome

- `school-board-watch`: `13 -> 14`

## DeKalb crossover audit

I also checked whether the same crossover treatment was justified for `dekalb-county-government`.

Result:

- no live activist-hosted DeKalb public-meeting events were currently materialized in `civic-training-action-atl`
- DeKalb government coverage is still coming from official county meeting sources

Conclusion:

- no DeKalb crossover rule was added in this run
- waiting for a real live example is the correct move

## Current state

The civic-process enrichment stack is now coherent in three places:

- Fulton activist-hosted government meetings can flow into `fulton-county-government`
- Atlanta city activist-hosted government meetings can flow into `atlanta-city-government`
- activist-hosted school board meetings with `school-board` tags can flow into `school-board-watch`

That keeps HelpATL honest: official sources still anchor each institutional lane, while clearly tagged activist-hosted public-process events can join the same lanes when they are truly relevant.
