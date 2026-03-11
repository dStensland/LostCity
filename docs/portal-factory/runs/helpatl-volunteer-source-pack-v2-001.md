# HelpATL Volunteer Source-Pack V2 001

- Date: 2026-03-09
- Portal slug: `helpatl`
- Scope: aggressive same-day volunteer coverage expansion for Atlanta
- Decision: `go` for pack assembly and source registration; `go` for staged provisioning after validation

## Objective

Shift HelpATL from a generic civic/volunteer bundle to a volunteer system with two clear lanes:

1. `Volunteer This Week`: high-conversion drop-in shifts and near-term service projects.
2. `Commit to a Cause`: orientations, trainings, and recurring roles that lead into longer-term service.

This serves the North Star better than broadening the portal with more generic listings. It increases action density and gives users a ladder from casual service into repeat civic belonging.

## V2 Source Lanes

### Lane A: Volunteer This Week (`P0`)

These are the sources that should make the feed feel alive every day.

1. `hands-on-atlanta`
2. `united-way-atlanta`
3. `atlanta-community-food-bank`
4. `open-hand-atlanta`
5. `trees-atlanta`
6. `concrete-jungle`
7. `habitat-for-humanity-atlanta`
8. `chattahoochee-riverkeeper`
9. `park-pride`
10. `atlanta-mission`

### Lane B: Commit to a Cause (`P0/P1 hybrid`)

These are the sources that let HelpATL represent longer-term service without waiting for a separate volunteer-product rewrite.

1. `big-brothers-big-sisters-atl`
2. `everybody-wins-atlanta`
3. `habitat-for-humanity-atlanta`
4. `atlanta-mission`
5. `trees-atlanta`
6. `park-pride`
7. `chattahoochee-riverkeeper`

### Reserve Commitment Source Family (`P1 follow-on`)

Register now, activate once source quality is proven or structured opportunity support is ready.

1. `atlanta-casa`
2. `laamistad`

## Why This Pack

1. It leans on sources that are already local, attributable, and mostly crawlable in-repo today.
2. It maximizes drop-in inventory first because that is the fastest way to make HelpATL useful.
3. It still surfaces longer-term commitments through orientations, trainings, mentorship, and recurring programs instead of pretending every commitment source is a normal events feed.
4. It avoids national marketplace sprawl while still using Hands On Atlanta and United Way as trusted local aggregators.

## Same-Day Execution Plan

### Track 1: Data Pack

1. Register missing volunteer source rows required by the v2 pack.
2. Add crawlable source profiles for reserve commitment sources.
3. Validate local crawlability with `validate-source-pack.ts`.

### Track 2: HelpATL Provisioning

1. Apply `docs/portal-factory/manifests/atlanta-civic-volunteer-v2.json`.
2. Rebuild source subscriptions for HelpATL.
3. Materialize channel matches.
4. Confirm the new volunteer channels render non-empty results.

### Track 3: Quality Gates

1. Check duplicate pressure across:
   - `hands-on-atlanta`
   - `united-way-atlanta`
   - direct hosts (`park-pride`, `trees-atlanta`, `atlanta-community-food-bank`, `open-hand-atlanta`)
2. Confirm canonical signup paths prefer direct hosts where both direct and marketplace listings exist.
3. Verify the feed has both immediate action and deeper commitment coverage.

## Launch Bar For “Excellent”

Use these bars the same day the pack is provisioned:

1. `40+` upcoming volunteer opportunities in the next 14 days.
2. `10+` opportunities attributable to direct hosts, not only aggregators.
3. `10+` records tagged with `orientation`, `training`, or `mentorship` in the next 30 days.
4. `<10%` obvious user-visible duplicates in the top of feed.
5. `80%+` of surfaced volunteer records have a viable direct signup path.

## Execution Notes

1. `atlanta-casa` and `laamistad` are registered as reserve sources because they matter strategically, but they should not block same-day launch quality.
2. `atlanta-toolbank` drops out of the v2 live pack because it is lower-yield for drop-in conversion than the direct hosts and aggregators above.
3. The volunteer pack should be treated as a living source family. Same-day success is source density plus trust, not perfect schema completion.

## Commands

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v2.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v2.json --dry-run
```
