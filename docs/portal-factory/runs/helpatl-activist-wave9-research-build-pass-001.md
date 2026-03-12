# HelpATL Activist Wave 9 Research + Build Pass 001

Date: 2026-03-10

## Goal

Expand HelpATL's activist and issue-organizing coverage with truthful source modeling:

- use dated event crawlers only where the official public surface actually supports them
- use structured civic-engagement opportunities where organizations expose volunteer and action intake without a durable public calendar

## Research Read

### ATL DSA

- Official events page: `https://atldsa.org/events/`
- Public calendar embeds are live and crawlable
- Good fit for `Civic Training & Action`
- Already onboarded before this wave

### Fair Count

- Official site: `https://faircount.org/`
- Official public event path is linked from the site itself: `https://www.mobilize.us/faircount/`
- Live result during this wave: `5` future dated public events
- Clear fit for a live event source plus structured civic-engagement roles

### Georgia STAND-UP

- Official volunteer page: `https://www.georgiastandup.org/volunteer`
- Official public events page: `https://www.georgiastandup.org/event-list`
- Current rendered state on March 10, 2026: `No events at the moment`
- Correct model: keep it as a tracked event source with graceful zero-yield handling, and seed structured volunteer pathways now

### New Georgia Project

- Old events page is dead: `https://newgeorgiaproject.org/events/` returns a 404 page
- Live volunteer page: `https://newgeorgiaproject.org/get-involved/`
- Live voter-protection page: `https://newgeorgiaproject.org/vopro/`
- The volunteer page links to `https://www.mobilize.us/ngp/`, but that org landing page currently resolves to a Mobilize `Page not found` shell in both plain fetch and real-browser checks
- Correct model today: structured civic-engagement opportunities, not a live event feed

### Fair Fight

- Official volunteer page: `https://fairfight.com/volunteer`
- Public surface is a volunteer intake form, not a dated event calendar
- The form exposes concrete volunteer lanes:
  - textbank
  - phonebank
  - canvassing
  - research
  - in-person opportunities
  - election-day opportunities
- Correct model: structured civic-engagement opportunities

## What Shipped

### New / Updated Crawler Paths

- Added Georgia STAND-UP crawler:
  - `crawlers/sources/georgia_stand_up.py`
  - `crawlers/tests/test_georgia_stand_up.py`
- Added `fair-count -> sources.mobilize` override in:
  - `crawlers/main.py`

### Source / Opportunity Migration

- `database/migrations/344_helpatl_activist_sources_wave9.sql`
- `supabase/migrations/20260310016000_helpatl_activist_sources_wave9.sql`

This migration:

- registered `fair-count` as an active HelpATL source
- registered `georgia-stand-up` as an active HelpATL source
- updated `new-georgia-project` away from its dead `/events` URL to the live volunteer page
- registered `fair-fight` for future attribution and structured modeling
- seeded `8` structured `civic_engagement` opportunities:
  - `2` Georgia STAND-UP
  - `2` New Georgia Project
  - `2` Fair Fight
  - `2` Fair Count

### HelpATL Manifest Wiring

- Updated `docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`
- Added `fair-count` and `georgia-stand-up` to:
  - source subscriptions
  - `Civic Training & Action` section source filters
  - `civic-training-action-atl` channel source rules

## Verification

### Targeted code checks

- `cd crawlers && python3 -m pytest tests/test_georgia_stand_up.py tests/test_atlanta_dsa.py`
- `cd crawlers && python3 -m py_compile sources/georgia_stand_up.py tests/test_georgia_stand_up.py sources/atlanta_dsa.py tests/test_atlanta_dsa.py`
- `python3 -m json.tool docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`

### Crawl checks

- `cd crawlers && python3 main.py --source georgia-stand-up --dry-run`
- `cd crawlers && python3 main.py --source fair-count --dry-run`
- `cd crawlers && python3 main.py --source georgia-stand-up --allow-production-writes --skip-launch-maintenance`
- `cd crawlers && python3 main.py --source fair-count --allow-production-writes --skip-launch-maintenance`

### Provisioning / portal checks

- `cd web && npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`
- `cd web && npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json --dry-run`
- `cd web && npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`
- rematerialized HelpATL event-channel matches through `refreshEventChannelMatchesForPortal(...)`

## Live Outcome

### Source yield

- `fair-count`: `5` future dated events
- `georgia-stand-up`: `0` future dated events, but now tracked cleanly

### HelpATL state after provisioning + refresh

- active source subscriptions: `46`
- active channels: `19`
- channel rules: `55`
- total event-channel matches: `3527`
- `civic-training-action-atl`: `75` matches
- `fair-count` contribution to `civic-training-action-atl`: `5`
- structured `civic_engagement` opportunities: `24`
- total structured opportunities: `61`

### New structured activist-org opportunity counts

- `fair-count`: `2`
- `fair-fight`: `2`
- `georgia-stand-up`: `2`
- `new-georgia-project`: `2`

## Product Read

This was the correct shape.

- `Fair Count` is now a real live activist event source.
- `Georgia STAND-UP` is now monitored as an official activist source, even though its current event board is empty.
- `New Georgia Project` and `Fair Fight` are represented honestly in the structured civic-engagement layer instead of being forced into fake event coverage.

That increases HelpATL's activist breadth without degrading trust.

## Remaining Gaps

1. `New Georgia Project`
   - the volunteer page still links to a broken Mobilize org landing page
   - if that official event path comes back, it should be reconsidered as a live event source

2. `Georgia STAND-UP`
   - no current public events means no event-layer yield yet
   - structured coverage is carrying the representation for now

3. `Next activist wave`
   - strongest next candidates remain:
     - New Georgia Project if official live events return
     - Fair Fight only if a real dated event surface appears
     - other Georgia advocacy orgs with clean public event feeds, not just intake forms
