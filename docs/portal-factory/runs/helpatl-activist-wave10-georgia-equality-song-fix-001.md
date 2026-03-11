# HelpATL Activist Wave 10: Georgia Equality rollout + SONG parser fix

Date: 2026-03-10 16:07:49 EDT
Portal: `helpatl`
Surface: `consumer`

## Why this wave

The next two highest-leverage activist-source moves were:

1. Fix the SONG crawler's year-rollover bug so stale event pages stop fabricating 2027 futures.
2. Promote Georgia Equality into HelpATL's `Civic Training & Action` lane because it already has a live, dated calendar feed.

## What changed

### 1. SONG parser fix

- Updated [`crawlers/sources/song.py`](/Users/coach/Projects/LostCity/crawlers/sources/song.py) so explicit years are preserved.
- Yearless dates now only roll into next year when they are clearly far-past placeholders.
- Added targeted tests in [`crawlers/tests/test_song.py`](/Users/coach/Projects/LostCity/crawlers/tests/test_song.py).

Result:
- SONG no longer fabricates `2027-*` event dates.
- Dry-run now resolves the page to stale `2025` events with `past_date` warnings, which is the truthful behavior.

### 2. Georgia Equality HelpATL activation

- Added a HelpATL federation subscription in [`database/migrations/346_helpatl_georgia_equality_subscription.sql`](/Users/coach/Projects/LostCity/database/migrations/346_helpatl_georgia_equality_subscription.sql) and [`supabase/migrations/20260310017000_helpatl_georgia_equality_subscription.sql`](/Users/coach/Projects/LostCity/supabase/migrations/20260310017000_helpatl_georgia_equality_subscription.sql).
- Added `georgia-equality` to HelpATL's source pack and civic-action routing in [`docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`](/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json).
- Ran the live Georgia Equality crawl, reprovisioned HelpATL, and refreshed event-channel matches.

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_song.py tests/test_georgia_stand_up.py tests/test_atlanta_dsa.py
python3 -m py_compile sources/song.py tests/test_song.py scripts/content_health_audit.py
python3 main.py --source song --dry-run
python3 main.py --source georgia-equality --allow-production-writes --skip-launch-maintenance

cd /Users/coach/Projects/LostCity
set -a && source .env >/dev/null 2>&1
psql "$DATABASE_URL" -f database/migrations/346_helpatl_georgia_equality_subscription.sql

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Match refresh result:

```json
{
  "portalId": "8d479b53-bab7-433f-8df6-b26cf412cd1d",
  "startDate": "2026-03-10",
  "endDate": "2026-07-08",
  "channelsConsidered": 19,
  "eventsScanned": 1730,
  "matchesWritten": 3535
}
```

## Live outcome

- HelpATL active source subscriptions: `47`
- HelpATL total event-channel matches: `3535`
- `civic-training-action-atl`: `79` matches
- Georgia Equality future dated events: `4`
- Georgia Equality matches in `civic-training-action-atl`: `4`

## Product read

- Georgia Equality is a good fit for HelpATL's activist/civic-action layer right now.
- SONG is **not** ready for HelpATL promotion yet, not because of crawler quality, but because the public events page currently resolves to stale 2025 events.

## Next best move

- Audit the next activist sources already present in the repo before building more new crawlers:
  - `indivisible-atl`
  - `song` once the public events page is current again
  - `progeorgia` if its public action surface becomes event-usable
