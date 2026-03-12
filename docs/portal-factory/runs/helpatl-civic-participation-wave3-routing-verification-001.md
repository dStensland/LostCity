# HelpATL Civic Participation Wave 3 Routing Verification 001

Date: 2026-03-09
Portal: `helpatl`
Manifest context: `atlanta-civic-humanitarian-v5.json`

## Objective

Verify that `mobilize-us` events materialize into HelpATL's `civic-training-action-atl`
channel after the Wave 3 fallback rollout.

## Result

A clean rematerialization through `refreshEventChannelMatchesForPortal(...)` wrote the
expected `mobilize-us` rows into `event_channel_matches`.

- `matchesWritten`: `3097`
- `eventsScanned`: `1534`
- `civic-training-action-atl`: `38` matches

Source mix for `civic-training-action-atl` after refresh:

- `mobilize-us`: `14`
- `marta-army`: `14`
- `civic-innovation-atl`: `5`
- `common-cause-georgia`: `3`
- `lwv-atlanta`: `2`

Representative event verification:

- event `100674` (`Youth at the Capitol`) now materializes to:
  - `civic-training-action-atl`
  - `civic-engagement`
  - `public-safety`

## Verification

- direct refresh via `refreshEventChannelMatchesForPortal(...)`
- targeted DB check on `event_channel_matches` for event `100674`
- targeted source-mix query for `civic-training-action-atl`
- regression test added in `web/lib/interest-channel-matches.test.ts`

## Notes

The earlier mismatch was stale materialization state, not a reproduced matcher defect.
`atlanta-municipal-clerk` remains blocked by `403 Access Denied` and is still the next
official-source gap in the civic participation layer.
