# HelpATL Provisioning Run 008 — Source-Backed Volunteer Sections

- Date: 2026-03-09
- Portal slug: `helpatl`
- Scope: make volunteer sections source-backed instead of tag-only
- Decision: `go`

## Why

The volunteer v2 source pack improved channel coverage, but the consumer feed sections were still mostly tag-driven. That made `Commit to a Cause` too dependent on sparse event tags and hid the stronger source-backed `ongoing` lane.

## Changes

1. Added `source_slugs` support to portal feed `auto_filter` resolution in:
   - `web/app/api/portals/[slug]/feed/route.ts`
2. Updated `docs/portal-factory/manifests/atlanta-civic-volunteer-v2.json` to:
   - constrain `Volunteer This Week` to the high-volume drop-in source family
   - add a visible `Ongoing Opportunities` section
   - constrain `Commit to a Cause` to the commitment-oriented source family
3. Re-provisioned `helpatl` from the updated v2 manifest.

## Verification

1. `npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts`: pass
2. `npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v2.json`: pass
3. `npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v2.json --dry-run`: pass
4. Write provisioning result:
   - sections `insert=1`, `update=4`
   - channels `insert=0`, `update=7`

Visible HelpATL section stack after apply:

1. `Volunteer This Week`
2. `Ongoing Opportunities`
3. `Commit to a Cause`
4. `Government Meetings`
5. `School Board Watch`

Hidden legacy section:

1. `Volunteer Opportunities`

## Notes

1. This is a platform improvement, not just a HelpATL one: source-backed section filters are now available anywhere portal manifests need explicit source families.
2. The direct route invocation could not be executed outside Next request scope because `cookies()` is request-bound, so verification relied on provisioning output, DB state, and targeted tests instead.
