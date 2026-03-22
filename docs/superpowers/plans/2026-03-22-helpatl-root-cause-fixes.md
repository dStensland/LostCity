# HelpATL Root Cause Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the two root causes of content leakage on the HelpATL civic portal: (1) shared pipeline infrastructure serving entertainment content to civic portals, (2) overloaded "community" category mixing civic and entertainment events. Also wire the interest channel routing to make subscriptions functional.

**Architecture:** Three independent fixes. Fix 1 adds a content policy to PortalManifest (pipeline-level section suppression). Fix 2 adds civic intent scoring (tag-based event filtering + source trust). Fix 3 wires channel routing rules (SQL migration). All independently shippable.

---

## Task 1: Pipeline Content Policy (Fix 1)

**Files:**
- Modify: `web/lib/portal-manifest.ts` — add ContentPolicy type + resolver
- Modify: `web/lib/city-pulse/pipeline/fetch-enrichments.ts` — skip queries per policy
- Modify: `web/lib/city-pulse/pipeline/build-sections.ts` — filter suppressed sections
- Modify: `web/lib/city-pulse/pipeline/resolve-portal.ts` — replace quick links for civic
- Modify: `web/lib/city-pulse/quick-links.ts` — add civic quick link set

**Steps:**

- [ ] Read `web/lib/portal-manifest.ts` to understand the manifest structure and `buildPortalManifest`
- [ ] Add `ContentPolicy` type with `suppressedSections`, `skipEnrichments`, `quickLinkMode`
- [ ] Add `resolveContentPolicy(vertical)` that returns civic policy for `community` vertical
- [ ] Wire into `buildPortalManifest` so contentPolicy is on every manifest
- [ ] Read `web/lib/city-pulse/pipeline/fetch-enrichments.ts` and skip specials + weather queries when policy says to
- [ ] Read `web/lib/city-pulse/pipeline/build-sections.ts` and filter suppressed section types after assembly
- [ ] Read `web/lib/city-pulse/pipeline/resolve-portal.ts` and replace quick links when `quickLinkMode === 'civic'`
- [ ] Add `getCivicQuickLinks(portalSlug)` to `quick-links.ts`: Volunteer Today, City Meetings, School Board, Groups, Support
- [ ] Verify TypeScript builds clean
- [ ] Verify Atlanta portal still works (no content policy applied to `city` vertical)
- [ ] Commit

## Task 2: Civic Intent Filter (Fix 2)

**Files:**
- Create: `supabase/migrations/20260322300000_civic_verified_source_flag.sql`
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts` — add `filterCivicIntent`
- Modify: `web/lib/city-pulse/pipeline/resolve-portal.ts` — load civic_verified source IDs
- Modify: `crawlers/tag_inference.py` — add missing civic signal tag patterns

**Steps:**

- [ ] Write migration adding `civic_verified` boolean to sources, set true for ~30 known civic sources
- [ ] Read `web/lib/city-pulse/pipeline/fetch-events.ts` and add `filterCivicIntent()` post-fetch filter
- [ ] The filter: community-category events must have a civic signal tag OR come from a civic_verified source. Non-community passes through. Events with entertainment tags are rejected.
- [ ] Civic signal tags: volunteer, government, public-meeting, civic-engagement, advocacy, school-board, npu, zoning, cleanup, mutual-aid, organizing, town-hall, drop-in, service, civic, election, voter-registration, transit, food-security, housing, environment, health
- [ ] Entertainment signal tags: watch-party, happy-hour, bar-games, karaoke
- [ ] Load civic_verified source IDs in resolve-portal.ts and attach to pipeline context
- [ ] Add missing civic tag patterns in `crawlers/tag_inference.py`: public-meeting, mutual-aid, npu, town-hall
- [ ] Verify TypeScript builds clean
- [ ] Verify "March Madness Watch Party" would be filtered out
- [ ] Commit

## Task 3: Channel Routing Wiring (Fix 3)

**Files:**
- Create: `supabase/migrations/20260322300001_helpatl_channel_routing_completion.sql`

**Steps:**

- [ ] Reactivate `volunteer-opportunities-atl` channel
- [ ] Add source rules to `georgia-democracy-watch`: mobilize-us, fair-fight, fair-count, new-georgia-project, common-cause-georgia, lwv-atlanta
- [ ] Add source rules to `food-security`: open-hand-atlanta, concrete-jungle
- [ ] Add source rule to `atlanta-city-government`: atlanta-city-council (IQM2)
- [ ] Verify school-board-watch already has rules for all 7 school board sources (add Cobb/Gwinnett/Clayton/Cherokee if missing)
- [ ] Use ON CONFLICT / WHERE NOT EXISTS guards to prevent dupes
- [ ] Commit
