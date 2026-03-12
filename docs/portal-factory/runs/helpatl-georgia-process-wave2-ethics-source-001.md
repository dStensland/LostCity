# HelpATL Georgia Process Wave 2: Ethics Source 001

- Date: 2026-03-11
- Portal: `helpatl`
- Workstream: `Now / A` statewide process authority
- Goal: deepen `Georgia Democracy Watch` with an official statewide process source that does not rely on brittle scraping

## What shipped

Added `georgia-ethics-commission` as a new official HelpATL live event source.

Files:
- [georgia_ethics_commission.py](/Users/coach/Projects/LostCity/crawlers/sources/georgia_ethics_commission.py)
- [test_georgia_ethics_commission.py](/Users/coach/Projects/LostCity/crawlers/tests/test_georgia_ethics_commission.py)
- [443_helpatl_georgia_ethics_commission_source.sql](/Users/coach/Projects/LostCity/database/migrations/443_helpatl_georgia_ethics_commission_source.sql)
- [20260311140004_helpatl_georgia_ethics_commission_source.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260311140004_helpatl_georgia_ethics_commission_source.sql)
- [atlanta-civic-humanitarian-v5.json](/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json)

## Source model

Official surfaces used:
- `https://ethics.ga.gov/feed/`
- `https://ethics.ga.gov/`

Events captured:
- official commission meetings
- official ethics / campaign-finance trainings

Reason this source was selected:
- Georgia SOS and State Election Board pages remain access-blocked in this runtime
- Georgia General Assembly schedule pages remain SPA / brittle-JS territory
- Ethics provides accessible official public pages and a feed with dated statewide-process events

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_georgia_ethics_commission.py
python3 -m py_compile sources/georgia_ethics_commission.py tests/test_georgia_ethics_commission.py
python3 main.py --source georgia-ethics-commission --allow-production-writes --skip-launch-maintenance

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json --activate
```

DB / lane refresh:
- applied [443_helpatl_georgia_ethics_commission_source.sql](/Users/coach/Projects/LostCity/database/migrations/443_helpatl_georgia_ethics_commission_source.sql) against the remote database
- refreshed HelpATL event-channel matches through `refreshEventChannelMatchesForPortal(...)`

## Measured result

Crawler result:
- `6` events found
- `6` new
- `0` updated

New statewide process items from the source:
- `GMA Newly Elected Officials Conference (Tifton)` on `2026-03-18`
- `GAVERO Conference (Athens)` on `2026-03-23`
- `COMMISSION MEETING: March 30, 2026`
- plus three later-dated training events outside the next-30-day window

`Georgia Democracy Watch` next-30-day count:
- before: `1`
- after: `4`

Next-30-day lane contents now:
- `Join us at the March 18 State Election Board Meeting` via `common-cause-georgia`
- `GMA Newly Elected Officials Conference (Tifton)` via `georgia-ethics-commission`
- `GAVERO Conference (Athens)` via `georgia-ethics-commission`
- `COMMISSION MEETING: March 30, 2026` via `georgia-ethics-commission`

Portal state after reprovision:
- HelpATL status: `active`
- active live event sources: `36`
- active channels: `20`
- materialized event-channel matches: `2943`

## Decision

Decision: `continue`

This wave materially improved statewide process authority without violating the “no brittle scraping” guardrail.

## Remaining blocker

The lane still misses the finish-board threshold of `5+` useful next-30-day items.

Remaining blocked surfaces:
- Georgia SOS / State Election Board official pages
- Georgia General Assembly official schedule pages

Those are still not defensible direct-crawl targets in this runtime, so the next move should be:
- find one more stable official or clearly high-trust statewide process source, or
- explicitly accept `4` as the best clean authority state until those official surfaces become accessible
