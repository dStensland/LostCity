# HelpATL Provisioning Run 007 — Volunteer V2

- Date: 2026-03-09
- Portal slug: `helpatl`
- Mode: write provisioning + manual match refresh
- Decision: `go`

## Actions Executed

1. Applied `database/migrations/304_helpatl_volunteer_source_pack_v2.sql` against the live database.
2. Verified the newly required source rows were active:
   - `open-hand-atlanta`
   - `atlanta-casa`
   - `laamistad`
3. Ran source-pack validation against `docs/portal-factory/manifests/atlanta-civic-volunteer-v2.json`: pass.
4. Ran provisioning dry run against the v2 manifest: pass.
5. Applied the v2 manifest in write mode to `helpatl`.
6. Manually refreshed event-channel matches for `helpatl`.
7. Hid the legacy `volunteer-opportunities` section and deactivated the legacy `volunteer-opportunities-atl` channel.
8. Re-ran manual event-channel match refresh after legacy cleanup.

## Verification

- Portal ID: `8d479b53-bab7-433f-8df6-b26cf412cd1d`
- Portal status: `draft`
- Active source subscriptions: `19`
- Active channels: `17`
- Active channel rules: `46`
- Materialized event-channel matches: `2867`

Volunteer lane coverage after final refresh:

1. `volunteer-this-week-atl`: `1174` matches
2. `ongoing-opportunities-atl`: `60` matches
3. `commit-to-a-cause-atl`: `7` matches

Visible section order after cleanup:

1. `Volunteer This Week`
2. `Commit to a Cause`
3. `Government Meetings`
4. `School Board Watch`

Hidden legacy section:

1. `Volunteer Opportunities`

## Notes

1. The v2 pack is now live on the HelpATL draft portal and materially improves volunteer density.
2. `Commit to a Cause` is present but still lower-volume than the drop-in lane. That is expected with the current source mix.
3. Reserve commitment sources (`atlanta-casa`, `laamistad`) are now registered and available for follow-on source quality work.
