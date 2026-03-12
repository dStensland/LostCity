# HelpATL Provisioning Run 001

- Date: 2026-03-07
- Portal slug: `helpatl`
- Mode: draft provisioning (not activated)

## Actions Executed

1. Reactivated blocked source rows:
   - `atlanta-city-meetings`
   - `fulton-county-meetings`
   - `dekalb-county-meetings`
   - `united-way-atlanta`
   - `atlanta-community-food-bank`
   - `atlanta-toolbank`
2. Applied DB migrations required for Interest Channels:
   - `database/migrations/284_interest_channels.sql`
   - `database/migrations/286_event_channel_matches.sql`
3. Ran source-pack validation (DB-gated): pass.
4. Ran manifest provisioning (write mode, draft): pass.
5. Ran manual match materialization for portal: pass.

## Provisioning Verification

- Portal ID: `8d479b53-bab7-433f-8df6-b26cf412cd1d`
- Portal status: `draft`
- Active source subscriptions: `8`
- Active channels: `5`
- Channel rules: `6`

Manual refresh result:
- Events scanned: `17`
- Matches written: `7`
- Window: `2026-03-07` through `2026-07-05`

## Residual Notes

1. School-board coverage is still tag-fallback (`school-board-watch`) and should be upgraded to source-backed coverage in a follow-up manifest revision.
2. Activation to `active` should happen only after stakeholder sign-off on content quality and channel precision.
