# Yonder Artifact Reference Contract

**Parent docs:** `prds/034s-yonder-artifact-landmark-quest-research.md`, `prds/034t-yonder-artifact-source-and-linking-strategy.md`, `prds/034u-yonder-artifact-candidate-sheet.md`  
**Status:** Draft  
**As of:** 2026-03-12  
**Purpose:** Define the minimum product and data contract for showing Atlas Obscura, Atlanta Trails, Explore Georgia, and similar external references on Yonder artifact and destination pages.

---

## 1. Strategic Read

Yonder does not need a brand-new artifact-source system to start showing high-signal guide references.

The repo already has a usable pattern:

- `editorial_mentions` in the database
- `AccoladesSection` in the spot detail UI
- existing source-label and mention-type treatment

The right first move is to extend that pattern for Yonder instead of inventing a separate artifact-reference stack.

That keeps the work aligned with the platform:

- one reference model
- different portal tone and placement
- reusable outbound-credit behavior

---

## 2. Product Jobs

Artifact and guide references need to do three jobs:

1. validate why a thing is worth caring about
2. give users a deeper route/story read without Yonder trying to own every long-form guide
3. clearly credit strong external curators

That means references should be:

- visible enough to be useful
- secondary to Yonder's own summary
- explicitly outbound

---

## 3. Recommended Reuse Path

## Phase 1: reuse `editorial_mentions`

Treat artifact-supporting guide references as editorial mentions.

That means:

- no new table at first
- no artifact-only component at first
- just allow new `source_key` values and use the existing detail-section pattern

## Phase 2: add artifact-specific structure only if needed

Only graduate to a dedicated artifact-reference table if Yonder later needs fields like:

- `artifact_id`
- `quest_id`
- `reason_for_inclusion`
- `reference_role` like `story`, `route`, `history`, `safety`

Right now, that is premature.

---

## 4. Minimum Data Shape

For Phase 1, the current `editorial_mentions` shape is enough if we use it consistently.

Minimum fields:

- `source_key`
- `article_url`
- `article_title`
- `mention_type`
- `guide_name`
- `snippet`
- `published_at`

Recommended Yonder usage:

- `guide_name`: optional human-facing collection or guide label
  - example: `Waterfalls`
  - example: `Unusual Atlanta`
- `snippet`: one-line why-this-matters blurb, not a copied summary
  - example: `Good for the story behind the site`
  - example: `Best route-depth guide for this waterfall`

---

## 5. Source Keys To Add

The most important source keys to allow next are:

- `atlas_obscura`
- `atlanta_trails`
- `explore_georgia`

Second-tier candidates later:

- `only_in_georgia`
- `ajc_outdoors`
- `roadtrippers`

The allowlist should stay deliberate.

---

## 6. Mention-Type Recommendation

The existing mention types are close enough for Phase 1.

Recommended usage:

- `feature`
  - use for story-rich references like Atlas Obscura
- `guide_inclusion`
  - use for route or list-based references like Atlanta Trails or Explore Georgia guide pages
- `best_of`
  - use sparingly for ranking/list prestige if genuinely useful

Avoid overusing:

- `opening`
- `closing`
- `review`

Those are not the right fit for Yonder artifacts.

---

## 7. UI Placement

## 7.1 Card-level cue

Use a very small cue only when it adds signal.

Examples:

- `Seen in Atlas Obscura`
- `Guide: Atlanta Trails`
- `Hidden Gem: Explore Georgia`

This should be:

- optional
- one-line
- secondary to the artifact blurb

## 7.2 Detail-page section

On artifact or destination detail pages, use the existing accolade-style section with Yonder tone.

Recommended section labels:

- `Further Reading`
- `Field Guides`
- `Seen In Guides`

Do not force the label `Accolades` on Yonder if it reads too restaurant-like.

The structure can be the same even if the heading changes.

## 7.3 Quest pages

Quest pages should be allowed to surface references too, but only if they help planning.

Examples:

- one route-depth guide
- one story/history guide
- one official logistics source

Do not stack five outbound links under every quest item.

---

## 8. Reference Roles

Even if the Phase 1 implementation stays inside `editorial_mentions`, the product team should still think in terms of reference role.

Useful internal roles:

- `story`
- `route`
- `history`
- `logistics`

Recommended mapping by source:

- Atlas Obscura -> mostly `story`
- Atlanta Trails -> mostly `route`
- Explore Georgia -> mostly `story` or `trip framing`
- official park/operator pages -> `logistics`

This matters because Yonder should not show three sources that all do the same job.

---

## 9. Launch Rules

For launch, an artifact or destination should usually have no more than:

- `1` official logistics source
- `1` route-depth guide
- `1` story or travel guide

That is enough.

The goal is useful confidence, not bibliography.

---

## 10. Recommended First Implementation

The next implementation step should be:

1. expand the `editorial_mentions` source allowlist
2. add the three Yonder source keys
3. let Yonder detail pages reuse the existing section with a renamed heading
4. optionally add a tiny card-level source cue for artifact cards only

That yields immediate value without schema sprawl.

---

## 11. What This Enables

Once this contract exists, Yonder can:

- credit Atlas Obscura on oddity pages
- link Atlanta Trails on waterfall and overlook artifacts
- link Explore Georgia on scenic and statewide “hidden gem” artifacts
- reuse the same pattern later for quest pages and destination pages

That is enough to make artifact references feel intentional and productized.
