# Yonder Source-Pack Activation Checklist

**Parent docs:** `prds/034c-yonder-source-audit.md`, `docs/portal-factory/PROVISIONING_PROCESS.md`  
**Status:** Draft  
**Purpose:** Convert the Yonder source audit into an operational activation sequence that can be executed through migrations, validation, and portal provisioning.

---

## 1. Why This Exists

The Yonder source audit showed that some of the best-fit outdoor sources already exist in crawler code but are not available in the live source registry.

That means Yonder’s first content task is not “build more crawlers.”

It is:

- register missing sources
- ensure active sources have valid ownership
- validate crawlability
- provision the source pack cleanly

This checklist is the bridge from strategy to execution.

---

## 2. Non-Negotiable Rules

From `database/CLAUDE.md`:

- every active source must have `owner_portal_id`
- active-source attribution is enforced by DB constraint
- source activation should be done through migrations, not ad hoc DB patching

From portal factory:

- no source pack should be provisioned without `validate-source-pack.ts`
- no portal should rely on unvalidated or inactive source rows

---

## 3. Current Status Snapshot

## 3.1 Missing from live `sources`

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `rei-atlanta`
- `atlanta-parks-rec`

## 3.2 Present but inactive

- `monday-night-run-club`
- `bicycle-tours-atlanta`
- `south-river-forest`

## 3.3 Present and active

- `chattahoochee-riverkeeper`
- `chattahoochee-nature`
- `dunwoody-nature`
- `park-pride`
- `trees-atlanta`
- `beltline-fitness`
- `big-peach-running`
- `meetup`
- `central-rock-gym-atlanta`
- `piedmont-park`

Important nuance:

- `beltline-fitness` is active in the live registry but is not currently portal-factory-ready because no local crawler module/profile is discovered for that slug during source-pack validation
- `meetup` is the actual source slug; any `meetup.outdoors` targeting should happen through downstream tags/subcategory logic, not source-row provisioning

---

## 4. Activation Strategy

Yonder should treat source activation in three lanes.

### Lane A: Register missing high-fit sources immediately

These are the best source-pack recovery candidates because they already exist as crawler modules and fit Yonder’s thesis directly.

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `rei-atlanta`
- `atlanta-parks-rec`

### Lane B: Decide whether to reactivate dormant sources

These should be reviewed deliberately, not automatically included.

- `monday-night-run-club`
- `bicycle-tours-atlanta`
- `south-river-forest`

### Lane C: Preserve and subscribe the current strong core

- `meetup`
- `chattahoochee-nature`
- `piedmont-park`
- `big-peach-running`
- `trees-atlanta`
- `chattahoochee-riverkeeper`
- `park-pride`
- `central-rock-gym-atlanta`
- `dunwoody-nature` (watchlist)

Operational note:

- keep `beltline-fitness` in the broader Yonder content strategy, but do not put it in the first portal-factory manifest until local crawlability support exists

---

## 5. Source Ownership Decision

Before creating migrations for missing sources, decide the ownership model.

### Recommended default

For Atlanta / metro Georgia sources that strengthen the shared Atlanta data layer:

- set `owner_portal_id` to the Atlanta portal
- federate into Yonder via subscriptions / source-sharing

Why:

- keeps “facts global” instead of making Yonder the only owner of broadly useful local sources
- aligns with the existing federation model
- avoids creating a siloed regional source set unnecessarily

### Yonder-owned exception

Use Yonder ownership only if a source is truly Yonder-specific or would create confusing ownership if attached to Atlanta.

Examples that may justify Yonder ownership later:

- regional camping aggregations created for Yonder
- North Georgia adventure-specific source packs with no city-portal use

---

## 6. Checklist: Missing Source Registration

Run this sequence for each missing source.

### 6.1 Migration

Create a DB migration that:

- inserts or upserts the `sources` row
- sets:
  - `slug`
  - `name`
  - `url`
  - `source_type`
  - `crawl_frequency`
  - `is_active = true`
  - `integration_method`
  - `owner_portal_id`

### 6.2 Sharing rules

If source ownership is Atlanta:

- ensure `source_sharing_rules` allow Yonder to consume it when needed

### 6.3 Local crawlability validation

Run:

```bash
cd web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest <yonder-manifest>
```

This should confirm:

- module or profile exists
- source row exists in DB
- source is active

### 6.4 Dry-run crawl validation

Run:

```bash
cd crawlers
python3 main.py --source <slug> --dry-run
```

Record:

- success / failure
- found count
- obvious quality issues

### 6.5 Provisioning readiness

Do not include the source in the Yonder manifest until:

- DB source row exists
- source validates
- dry-run is at least non-broken

Current read after execution:

- source-row registration is complete for `atlanta-outdoor-club`, `blk-hiking-club`, `rei-atlanta`, and `atlanta-parks-rec`
- three of the four recovery sources are now producing after crawler follow-up:
  - `atlanta-outdoor-club`: large upcoming inventory from the live event table
  - `blk-hiking-club`: `2 found`
  - `atlanta-parks-rec`: now backed by the stronger ACTIVENet crawler
- `rei-atlanta` remains below launch bar:
  - hard failure on `rei.com`
  - removed from the launch manifest until fixed

Implication:

- Yonder can be provisioned as a draft portal now
- Yonder’s recovery work is now mostly crawler hardening for REI, not a broad source-pack problem

---

## 7. Checklist: Inactive Source Review

For each inactive source:

- inspect last known reason for inactivity
- run dry-run locally
- decide one of:
  - reactivate now
  - keep inactive for Yonder V1
  - deprecate from Yonder planning

### Recommended current posture

#### `monday-night-run-club`

- likely useful for Yonder’s urban social movement lane
- worth a reactivation review

#### `bicycle-tours-atlanta`

- lower-priority reactivation
- useful for experience variety, but not a core launch dependency

#### `south-river-forest`

- value is thematic and mission-aligned
- lower urgency unless Yonder wants a stronger environmental-justice / stewardship identity

---

## 8. Proposed Yonder V1 Source Pack

Manifest note:

- subscribe to `meetup`
- filter outdoor Meetup inventory by tags / downstream subcategory logic
- do not subscribe to a nonexistent `meetup.outdoors` source slug

### Core V1 source pack

- `meetup`
- `chattahoochee-nature`
- `piedmont-park`
- `big-peach-running`
- `trees-atlanta`
- `chattahoochee-riverkeeper`
- `park-pride`
- `central-rock-gym-atlanta`

### Recovery sources to add before or during V1

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `rei-atlanta`
- `atlanta-parks-rec`

### Optional V1.5 / V2 review

- `dunwoody-nature`
- `monday-night-run-club`
- `bicycle-tours-atlanta`
- `south-river-forest`

---

## 9. Gating Criteria

The Yonder source pack should not be considered ready until:

1. zero required source slugs are missing from `sources`
2. zero required source slugs are inactive
3. `validate-source-pack.ts` passes
4. each required source has at least one of:
   - successful dry-run
   - documented reason it is source-backed but currently seasonal
5. the pack contains enough volume to support the “this weekend” promise

---

## 10. Immediate Work Queue

### Highest priority

1. add live source rows for:
   - `atlanta-outdoor-club`
   - `blk-hiking-club`
   - `rei-atlanta`
   - `atlanta-parks-rec`

2. build first Yonder manifest draft using:
   - active core sources
   - these four recovery sources

3. validate with:
   - `validate-source-pack.ts`
   - dry-run crawls

### Secondary

4. review dormant reactivation candidates
5. tune source mix for signal, not just volume

---

## 11. Bottom Line

Yonder does not need a giant new crawler program to start.

It needs a disciplined source-pack activation pass.

That is good news: this is a solvable operational problem, and fixing it will make the next portal provisioning cycle stronger too.
