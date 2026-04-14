# Entity Graph Rollout Workstream

> **Status as of 2026-04-14:** Surgical update for schema drift — `venues` → `places`, `venue_specials` → `place_specials`, `search_unified()` replaces legacy unified-search stack, four-entity model (events/places/programs/exhibitions) replaces the older three-entity framing, `content_kind='exhibit'` deprecated in favor of `events.exhibition_id` FK. Strategic/operational content below is preserved unchanged. For active execution status see `DEV_PLAN.md`. For mission see `.claude/north-star.md`. For current architecture reference see `.claude/agents/_shared-architecture-context.md`.

**Surface:** `consumer`

This is the execution workstream for rolling LostCity from an event-centric implementation toward a real multi-entity platform across Atlanta and the content pillar portals.

The goal is not more architecture discussion. The goal is to make `programs`, `exhibitions`, `open_calls`, and shared `destination_details` live, source-backed, portal-safe, and measurable in production.

## Scope

This workstream covers:

- schema rollout for the new entity families
- representative crawler conversion to typed entity lanes
- production backfills for high-value existing inventory
- guardrails so the codebase does not drift back to ad hoc event-only behavior

This workstream does **not** cover:

- new consumer UI beyond what is required to validate data availability
- admin surface work
- speculative new entity tables beyond the current contract

## Operating Rules

1. Data layer first. Do not ship UI against tables or routes that are not live.
2. Convert source patterns, not one-off snowflakes.
3. Preserve portal attribution on every new entity write path.
4. Do not “fix” `open_calls.organization_id` until the live `organizations.id` contract is reconciled.
5. Any touched crawler should move closer to first-pass multi-entity capture.
6. Update [ACTIVE_WORK.md](/Users/coach/Projects/LostCity/ACTIVE_WORK.md) when claiming files.

## Phase Gates

- `Gate 1`: staging and production schema support the entity contract
- `Gate 2`: one additional Family source, one additional Arts source, and one real Adventure source are on typed lanes
- `Gate 3`: backfills produce meaningful live inventory in `programs` and `venue_destination_details`
- `Gate 4`: schema drift and source-capability guardrails are in place

## Track A: Schema and DB

### A1. Deploy pending entity migrations to staging

**Owner:** Data platform

**Files**

- [database/migrations/498_exhibitions_table.sql](/Users/coach/Projects/LostCity/database/migrations/498_exhibitions_table.sql)
- [database/migrations/499_open_calls_table.sql](/Users/coach/Projects/LostCity/database/migrations/499_open_calls_table.sql)
- [database/migrations/500_venue_destination_details.sql](/Users/coach/Projects/LostCity/database/migrations/500_venue_destination_details.sql)
- [database/migrations/502_programs_metadata.sql](/Users/coach/Projects/LostCity/database/migrations/502_programs_metadata.sql)
- [database/migrations/503_destination_details_contract.sql](/Users/coach/Projects/LostCity/database/migrations/503_destination_details_contract.sql)
- matching files under [supabase/migrations](/Users/coach/Projects/LostCity/supabase/migrations)

**Acceptance**

- `exhibitions`, `open_calls`, and `venue_destination_details` exist in staging
- `programs.metadata` exists in staging
- the destination-details contract columns exist in staging

**Validation SQL**

```sql
select table_name
from information_schema.tables
where table_name in ('exhibitions', 'open_calls', 'venue_destination_details');

select column_name
from information_schema.columns
where table_name = 'programs' and column_name = 'metadata';

select column_name
from information_schema.columns
where table_name = 'venue_destination_details'
order by ordinal_position;
```

### A2. Reconcile the `organizations.id` contract

**Owner:** Data platform

**Files**

- [database/schema.sql](/Users/coach/Projects/LostCity/database/schema.sql)
- [database/migrations/001_portals.sql](/Users/coach/Projects/LostCity/database/migrations/001_portals.sql)
- [database/migrations/499_open_calls_table.sql](/Users/coach/Projects/LostCity/database/migrations/499_open_calls_table.sql)
- [supabase/migrations/20260314183003_open_calls_table.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260314183003_open_calls_table.sql)

**Acceptance**

- one explicit answer: `organizations.id` is `text` or `uuid`
- repo schema and migration intent match that answer
- no follow-up migration depends on an unresolved assumption here

**Validation SQL**

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'organizations' and column_name = 'id';
```

### A3. Deploy the entity migrations to production

**Owner:** Data platform

**Acceptance**

- production schema passes the same checks as staging
- migration head matches expected rollout
- no failed or partially applied migration steps

### A4. Add schema drift detection

**Owner:** Data platform

**Files**

- [database/schema.sql](/Users/coach/Projects/LostCity/database/schema.sql)
- new check script or CI wiring under [database](/Users/coach/Projects/LostCity/database) or [scripts](/Users/coach/Projects/LostCity/scripts)

**Acceptance**

- drift between `database/migrations`, `supabase/migrations`, and canonical schema is machine-detectable
- the check is documented and runnable by an agent

## Track B: Crawler Conversions

### B1. Convert Atlanta family programs to typed program lane

**Owner:** Crawler platform

**Files**

- [crawlers/sources/atlanta_family_programs.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_family_programs.py)
- pattern reference: [crawlers/sources/dekalb_family_programs.py](/Users/coach/Projects/LostCity/crawlers/sources/dekalb_family_programs.py)

**Acceptance**

- event behavior remains unchanged
- `programs` are written via [crawlers/entity_persistence.py](/Users/coach/Projects/LostCity/crawlers/entity_persistence.py)
- source portal attribution is preserved on program writes
- targeted source test exists

**Validation**

```bash
python3 -m pytest crawlers/tests/test_atlanta_family_programs.py
python3 -m py_compile crawlers/sources/atlanta_family_programs.py
```

### B2. Convert the next Arts source to typed exhibition lane

**Owner:** Crawler platform

**Selection rule**

- choose a source that already behaves like “exhibitions as events” today
- prefer a source that either already dual-writes or clearly emits exhibit-shaped inventory

**Files**

- one source under [crawlers/sources](/Users/coach/Projects/LostCity/crawlers/sources)
- shared helpers in [crawlers/entity_lanes.py](/Users/coach/Projects/LostCity/crawlers/entity_lanes.py)
- shared persistence in [crawlers/entity_persistence.py](/Users/coach/Projects/LostCity/crawlers/entity_persistence.py)

**Acceptance**

- exhibitions persist through the shared lane path
- event rows, if still needed, remain explicit
- exhibition rows carry source and portal attribution
- targeted source test exists

**Discovery command**

```bash
# Note: content_kind='exhibit' is deprecated as of 2026-04-14; exhibitions
# are now first-class via the `exhibitions` table and `events.exhibition_id` FK.
# Historical `content_kind='exhibit'` rows remain in some sources and are part
# of the audit target.
rg -n "insert_exhibition|exhibition_id|content_kind.*exhibit" crawlers/sources
```

### B3. Convert one real Adventure/Yonder source to destination lanes

**Owner:** Crawler platform

**Selection rule**

- do not pick another fallback-only source
- pick a source that can emit destination richness directly from first-pass crawl data

**Files**

- one source under [crawlers/sources](/Users/coach/Projects/LostCity/crawlers/sources)
- shared destination helpers in [crawlers/entity_lanes.py](/Users/coach/Projects/LostCity/crawlers/entity_lanes.py) and [crawlers/db/destination_details.py](/Users/coach/Projects/LostCity/crawlers/db/destination_details.py)

**Acceptance**

- source writes `destination_details`
- source writes at least one attached destination lane such as `venue_features`
- no separate enrichment script is required for the same captured fields

### B4. Add source capability audit

**Owner:** Crawler platform

**Files**

- [crawlers/entity_lanes.py](/Users/coach/Projects/LostCity/crawlers/entity_lanes.py)
- new audit script under [crawlers/scripts](/Users/coach/Projects/LostCity/crawlers/scripts)

**Acceptance**

- audit output shows declared lane capabilities
- audit output identifies sources still emitting only events where richer lanes are expected

## Track C: Backfills

### C1. Backfill Hooky `programs`

**Owner:** Data migration

**Inputs**

- top Hooky-owned family sources currently represented only in `events`

**Acceptance**

- `programs` has meaningful non-zero live inventory
- duplicate control is handled by content hash / existing program dedupe
- event coverage is not reduced

**Validation SQL**

```sql
select count(*) from programs;

select p.slug, count(*)
from programs pr
join portals p on p.id = pr.portal_id
group by p.slug
order by count(*) desc;
```

### C2. Backfill shared `venue_destination_details`

**Owner:** Data migration

**Inputs**

- seeded destination metadata
- existing destination-first venue enrichments
- fallback-derived richness such as SCAD FASH catalog data

**Acceptance**

- Yonder has live rows in shared `venue_destination_details`
- core fields are materially populated for top destinations

**Validation SQL**

```sql
select count(*) from venue_destination_details;

select
  count(*) filter (where destination_type is not null) as with_type,
  count(*) filter (where commitment_tier is not null) as with_commitment,
  count(*) filter (where weather_fit_tags is not null and array_length(weather_fit_tags, 1) > 0) as with_weather_tags
from venue_destination_details;
```

### C3. Audit exhibit-shaped events vs first-class exhibitions

**Owner:** Data migration

**Acceptance**

- written classification rule for what remains an event vs what becomes an exhibition vs what belongs in destination-attached richness
- top offending sources identified
- follow-up migration or crawler targets listed

## Track D: API and Production Validation

### D1. Validate live entity routes

**Owner:** API/platform

**Files**

- [web/app/api/programs/route.ts](/Users/coach/Projects/LostCity/web/app/api/programs/route.ts)
- [web/app/api/exhibitions/route.ts](/Users/coach/Projects/LostCity/web/app/api/exhibitions/route.ts)
- [web/app/api/open-calls/route.ts](/Users/coach/Projects/LostCity/web/app/api/open-calls/route.ts)

**Acceptance**

- live rows return through portal-safe routes
- no cross-portal leakage
- any temporary fallback behavior is documented

**Validation**

```bash
cd web && npx vitest run lib/portal-isolation.test.ts lib/portal-query-context.test.ts lib/portal-scope.test.ts
```

### D2. Audit production attribution on new entity rows

**Owner:** API/platform

**Acceptance**

- null rates for `portal_id` and source attribution are known for `programs`, `exhibitions`, and `open_calls`
- any missing attribution has a clear fix owner

## Recommended Execution Order

1. `A1` Deploy entity migrations to staging
2. `A2` Reconcile `organizations.id`
3. `A3` Deploy entity migrations to production
4. `B1` Convert Atlanta family programs
5. `B2` Convert next Arts source
6. `B3` Convert one Yonder source
7. `C1` Backfill Hooky programs
8. `C2` Backfill shared destination details
9. `D1` Validate live entity routes
10. `D2` Audit production attribution
11. `A4` Add schema drift detection
12. `B4` Add source capability audit
13. `C3` Audit exhibit-shaped event debt

## Definition of Done

This workstream is done when all of the following are true:

- production schema supports the entity contract
- Hooky has meaningful live `programs`
- Arts has at least two real sources writing `exhibitions` through typed lanes
- Adventure/Yonder has at least one real source writing shared `destination_details`
- entity routes are live and portal-safe
- schema drift and lane-capability guardrails are in place

## Verification Matrix

**Crawler verification**

```bash
cd crawlers && pytest
cd crawlers && python3 -m py_compile sources/atlanta_family_programs.py
```

**Portal/API verification**

```bash
cd web && npx vitest run lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts
```

**Full web verification when API changes are touched**

```bash
cd web && npm run lint && npx tsc --noEmit && npx vitest run
```
