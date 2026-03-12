# Atlanta Civic Source-Pack Completion 001

- Date: 2026-03-07
- Scope: targeted completion pass for provisioning manifest integrity

## Completed

1. Added manifest-backed civic source pack:
   - `docs/portal-factory/manifests/atlanta-civic-volunteer-v1.json`
2. Standardized seed pack to explicit source slugs for:
   - City/county meetings
   - Volunteer organizations
3. Added hard-gate validator script to verify:
   - crawlable support (crawler module or profile)
   - DB source row presence and active status

## Remaining Gaps

1. School-board coverage is still tag-fallback (`school-board-watch`), not source-backed.
2. Dedicated source slugs for Atlanta/Fulton/DeKalb school boards are not yet integrated into this pack.
3. DB active-state blockers for current pack:
   - `atlanta-city-meetings`
   - `fulton-county-meetings`
   - `dekalb-county-meetings`
   - `united-way-atlanta`
   - `atlanta-community-food-bank`
   - `atlanta-toolbank`

## Next Source-Pack Increment (v2)

1. Add school-board source family:
   - `atlanta-public-schools-board`
   - `fulton-schools-board`
   - `dekalb-schools-board`
2. Replace tag-only school-board rule with source-backed rules.
3. Re-run validator + dry-run provisioning gate before any write execution.

Validation commands:

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v1.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v1.json --dry-run
```
