# HelpATL Civic Action Wave 8: Atlanta DSA 001

- Date: 2026-03-10
- Portal: `helpatl`
- Source: `atlanta-dsa`
- Decision: `live`

## Goal

Add a real issue-organizing / activist source to HelpATL's civic participation layer.

## Why ATL DSA

Atlanta Democratic Socialists of America is a strong fit for the gap HelpATL still had:

- issue-based organizing
- chapter / branch meetings
- trainings and political education
- public civic-action events outside official government-watch lanes

The official events page at `https://atldsa.org/events/` exposes multiple public
Google Calendars, making this a clean trackable source instead of a manual watchlist.

## What shipped

### Source ingestion

Added a new crawler at:

- `crawlers/sources/atlanta_dsa.py`

The crawler:

- fetches `https://atldsa.org/events/`
- extracts public Google Calendar IDs from embedded calendar links
- ingests dated events from the public iCal feeds
- tags them into civic-action / organizing lanes
- removes stale future rows after a successful crawl

### Source registration

Added registration migrations:

- `database/migrations/343_helpatl_atlanta_dsa_source.sql`
- `supabase/migrations/20260310015000_helpatl_atlanta_dsa_source.sql`

These:

- register `atlanta-dsa` under HelpATL ownership
- share it with the Atlanta parent portal
- create the source subscriptions
- seed an organization venue record

### Portal wiring

Updated manifest:

- `docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`

Changes:

- add `atlanta-dsa` to source subscriptions
- add `atlanta-dsa` to the `Civic Training & Action` section
- add `atlanta-dsa` to the `civic-training-action-atl` interest channel rule

## Quality hardening in the source

Before writing live rows, the crawler was tightened to:

- skip already-past events instead of relying on a grace window
- strip decorative leading / trailing emoji from titles so consumer surfaces stay readable

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_atlanta_dsa.py
python3 -m py_compile sources/atlanta_dsa.py tests/test_atlanta_dsa.py
python3 main.py --source atlanta-dsa --dry-run
python3 main.py --source atlanta-dsa --allow-production-writes --skip-launch-maintenance

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json --dry-run
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Manual post-provision rematerialization:

- refreshed event-channel matches for HelpATL through `refreshEventChannelMatchesForPortal(...)`

## Measured outcome

- ATL DSA future events ingested: `32`
- HelpATL active source subscriptions: `44`
- HelpATL rematerialized matches: `3512`
- ATL DSA events matched anywhere in HelpATL: `78` match rows
- ATL DSA events matched into `civic-training-action-atl`: `32`
- ATL DSA events matched into legacy `civic-engagement`: `32`

## Notes

This is intentionally an advocacy / organizing source, not an official public-process source.
It belongs in `Civic Training & Action`, not in `Government Meetings` or other official lanes.
