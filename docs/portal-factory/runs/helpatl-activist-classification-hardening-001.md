# HelpATL Activist Classification Hardening 001

Date: 2026-03-10 16:07:49 EDT
Portal: `helpatl`
Surface: `consumer`

## Why this pass

After activating Georgia Equality and Indivisible ATL, the activist lane had a classification quality problem:

- activist-hosted public meetings were collapsing into `Civic Training & Action` only
- Indivisible ATL events carried weak tags (`activism,ticketed`) regardless of actual event type
- Indivisible detail pages were incorrectly stored as `ticket_url`

## What changed

### 1. Indivisible ATL source enrichment

Updated [`crawlers/sources/indivisible_atl.py`](/Users/coach/Projects/LostCity/crawlers/sources/indivisible_atl.py) to:

- derive tags from title + description
- infer `community` vs `learning` category
- tag government/election/public-meeting crossover events correctly
- tag workshop/poster-making events as `education`
- tag ICE/immigration actions as `immigration` + `advocacy`
- stop emitting `ticket_url` for generic event detail pages

Added tests in [`crawlers/tests/test_indivisible_atl.py`](/Users/coach/Projects/LostCity/crawlers/tests/test_indivisible_atl.py).

### 2. Indivisible ticket URL cleanup

Added [`database/migrations/348_indivisible_ticket_url_cleanup.sql`](/Users/coach/Projects/LostCity/database/migrations/348_indivisible_ticket_url_cleanup.sql) and [`supabase/migrations/20260310019000_indivisible_ticket_url_cleanup.sql`](/Users/coach/Projects/LostCity/supabase/migrations/20260310019000_indivisible_ticket_url_cleanup.sql) to clear stale future `ticket_url = source_url` rows for Indivisible ATL.

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_indivisible_atl.py tests/test_song.py tests/test_georgia_stand_up.py
python3 -m py_compile sources/indivisible_atl.py tests/test_indivisible_atl.py
python3 main.py --source indivisible-atl --allow-production-writes --skip-launch-maintenance

cd /Users/coach/Projects/LostCity
set -a && source .env >/dev/null 2>&1
psql "$DATABASE_URL" -f database/migrations/348_indivisible_ticket_url_cleanup.sql
```

## Measured outcome

Future Indivisible ATL rows with non-null `ticket_url`:

- before cleanup: `7`
- after cleanup: `0`

Sample corrected rows:

- `Home Depot Loves ICE-New Northside Dr. & 285`
  - category: `community`
  - tags: `rally, advocacy, immigration, activism, civic-engagement, attend`
  - ticket_url: `NULL`

- `Fulton County: Join us for the Board of Registrations and Elections Meeting`
  - category: `community`
  - tags: `government, public-comment, activism, civic-engagement, free, public-meeting, attend, election`
  - ticket_url: `NULL`

- `Make a Poster for NO KINGS!`
  - category: `learning`
  - tags: `activism, civic-engagement, attend, education`
  - ticket_url: `NULL`

## Remaining structural gap

This pass improved source truth, but it did **not** make activist-hosted public meetings join county/jurisdiction channels.

Current channel-model limitation:

- `school-board-watch` has tag rules, so activist-hosted school-board events can join it when tagged correctly
- county/jurisdiction government channels are still source-only
- that means activist-hosted public meetings like `Fulton County: Join us for the Board of Registrations and Elections Meeting` will remain in `Civic Training & Action` unless the channel matcher or channel rules are expanded

## Next best move

- Add a safe routing path for activist-hosted government meetings into the jurisdiction channels without opening broad false positives.
