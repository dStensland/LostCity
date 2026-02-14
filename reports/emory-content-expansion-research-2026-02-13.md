# Emory Content Expansion Research (2026-02-13)

## What was implemented

1. Added new crawler modules:
   - `crawlers/sources/cdc.py`
   - `crawlers/sources/ga_dph.py`
   - `crawlers/sources/fulton_board_health.py`
2. Added migration:
   - `database/migrations/205_public_health_tier1_sources.sql`
   - Registers `cdc`, `ga-dph`, `fulton-board-health`
   - Shares all three via federation
   - Subscribes Emory portal variants (`emory-demo`, `emory-test`, `emory`)
3. Added migration:
   - `database/migrations/206_emory_content_expansion_subscriptions.sql`
   - Expands Emory subscriptions with:
     - `fulton-library`
     - `mjcca`
     - `college-park-main-street`
     - `fernbank`
     - `childrens-museum`
4. Applied the source/subscription upserts directly in Supabase and refreshed `portal_source_access`.

## Live crawl results

Executed:
- `python3 main.py --source cdc`
- `python3 main.py --source ga-dph`
- `python3 main.py --source fulton-board-health`

Outcomes:
- `cdc`: 0 upcoming (CDC Museum page currently indicates temporary closure)
- `ga-dph`: 0 upcoming (Georgia DPH events page currently has no upcoming list entries)
- `fulton-board-health`: 1 upcoming event inserted (March 5, 2026 career fair)

## Emory venue coverage (2-mile radius)

After running `npm run seed:emory-venues`:

- `emory-university-hospital`: total 231 (restaurants 74, coffee 28, lodging 21, services 55)
- `emory-university-hospital-midtown`: total 798 (restaurants 261, coffee 70, lodging 72, services 105)
- `emory-saint-josephs-hospital`: total 182 (restaurants 59, coffee 30, lodging 22, services 56)
- `emory-johns-creek-hospital`: total 115 (restaurants 40, coffee 22, lodging 14, services 39)

Run stats:
- Unique places processed: 552
- Inserted: 14
- Updated: 538
- Failed: 0

## Access scope snapshot (Emory demo portal)

- Active source subscriptions: 34
- Accessible sources in `portal_source_access`: 57
- Upcoming events across subscribed sources: 1091
- New Tier-1 sources are now in access scope:
  - `cdc`
  - `ga-dph`
  - `fulton-board-health`

## Added content expansion subscriptions (with current upcoming counts)

1. `fulton-library`: 555
2. `mjcca`: 286
3. `college-park-main-street`: 50
4. `fernbank`: 39
5. `childrens-museum`: 28

Guardrail:
- Keep UX relevance filters active (distance, persona/moment, care context) so this added volume stays useful rather than noisy.
