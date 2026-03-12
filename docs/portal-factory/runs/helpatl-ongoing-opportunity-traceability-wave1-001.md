# HelpATL Ongoing Opportunity Traceability Wave 1

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer` + `platform`
- Goal: reduce source-null ongoing opportunities by activating/creating the right backing sources and linking the existing structured roles to them

## Scope

Targets:

- `canopy-atlanta-documenter`
- `hope-community-kitchen-volunteer`
- `hope-donation-sorting-support`
- `irc-donations-volunteer`
- `irc-esl-class-assistant`
- `irc-volunteer-driver`
- `irc-youth-afterschool-tutor`
- `fair-fight-volunteer-team`
- `fair-fight-election-day-opportunities`
- `new-georgia-project-volunteer`
- `new-georgia-project-peanut-gallery`

Backing sources:

- `canopy-atlanta`
- `hope-atlanta`
- `irc-atlanta`
- `fair-fight`
- `new-georgia-project`

## Intended outcome

1. Add the five source slugs to HelpATL's `Ongoing Opportunity Sources` inventory.
2. Activate/create those source records under HelpATL ownership.
3. Link the `11` existing org-first opportunities to those source records.
4. Drop HelpATL's source-null opportunity count from `11` to `0`.

## Verification plan

1. Validate the source pack manifest.
2. Apply the live data change.
3. Recount source-null active HelpATL opportunities.
4. Verify the five sources resolve through `portal_source_access`.

## Result

Live state after the service-role apply:

- `canopy-atlanta` created as an active HelpATL-owned source
- `hope-atlanta`, `irc-atlanta`, `fair-fight`, and `new-georgia-project` reactivated as active HelpATL-owned sources
- all `11` targeted opportunities now have non-null `source_id`
- remaining source-null active HelpATL opportunities: `0`
- all five backing sources resolve through `portal_source_access`

Manifest state:

- HelpATL `Ongoing Opportunity Sources` inventory now includes all five slugs
- source-pack validation passes with:
  - `Missing: none`
  - `Inactive: none`
  - `Inaccessible: none`

Provisioning state:

- dry-run passes cleanly against the updated manifest

## Commands run

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json --dry-run
```

Live data writes were applied through the Supabase service-role path because this environment does not expose a direct Postgres connection for running the SQL migration files.
