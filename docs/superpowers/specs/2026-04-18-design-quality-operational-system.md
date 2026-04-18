# Design: LostCity Operational Context + Design Quality System

> ## ⚠ MVF Addendum (2026-04-18, post-expert-review)
>
> **Status as of expert review:** Three independent reviews (architect, devil's advocate, strategic lens) converged on two findings:
>
> 1. **Enforcement isn't binding without a hook.** `VERDICT: BLOCK` as an agent output is advisory prose — the main agent can still skip invoking `product-designer` under time pressure. This rebuilds the exact failure mode that produced Plan 2 slop, just with more syntax.
> 2. **Scope is too wide for the acute problem.** The 18-row canonical-source consolidation is hygiene for drift that didn't cause Plan 2. Strategic reviewer flagged this as the "planning-as-progress" anti-pattern from the user's own north-star.
>
> **Decision:** cut to MVF. The full 6-layer design below is preserved as a future-reference / "if MVF isn't enough, here's the next step."
>
> ### MVF Scope (executing now)
>
> 1. Rewrite `.claude/agents/product-designer.md` — strip stale aesthetic, add `VERDICT:` format, add SaaS Smell Test with Plan 2 as rejected exemplar.
> 2. Create `docs/design-truth.md` — product spirit + component registry (with Pencil IDs) + anti-pattern gallery. ≤250 lines.
> 3. Create minimal root `CLAUDE.md` — ≤60 lines with just reading order + design-quality rule + doc map pointer. Full 180-line version deferred.
> 4. Add first-read line to `.claude/skills/{design,motion,design-handoff,elevate}/SKILL.md`.
> 5. Add one `PreToolUse` hook on the `Task` tool that refuses UI subagent dispatch without `docs/design-truth.md` + a Pencil node ID in the prompt. This is the binding property.
> 6. Regression test — mock Plan 2-style plan through `product-designer` Plan Review mode; verify `VERDICT: BLOCK`.
>
> ### Explicitly deferred (from the full spec below)
>
> - The 18-row canonical-source consolidation matrix (Layer 0b).
> - Absorption/deletion of `ai-base-instructions-v1.md`.
> - Retirement of `web/.claude/rules/figma-design-system.md` to thin stub.
> - Subdir `CLAUDE.md` trims.
> - Agent reading-order standardization across all agents.
> - `/coherence` skill and associated refresh cadence infrastructure.
> - `pr-reviewer` extension for live-vs-comp verify dispatch.
>
> **Revisit trigger:** if the MVF doesn't measurably change design quality within two weeks (measured by whether another Plan 2-style failure ships), execute the deferred layers starting with consolidation.
>
> **Strategic lens pushback to resolve empirically:** strategic reviewer argued FORTH/Gozio buyers may not inspect portal polish as a deal signal, making even MVF questionable. User confirmed "yes" to MVF-and-hook; empirical test is whether the next portal ships better.
>
> ---
>
> **Full 6-layer design below — preserved for future reference if MVF proves insufficient.**
>
> ---

**Status:** MVF (cut from full spec per expert review 2026-04-18). Implementation in progress.
**Date:** 2026-04-18
**Author:** Claude (main agent) + user
**Project:** LostCity

---

## Problem

Two failures surfaced this week, one acute and one architectural.

**Acute: design quality is degrading.** Live Tonight Plan 2 shipped as "SaaS-template slop" (user verdict) — count badges, enum chip labels, a 3617px widget. Motion landed in three post-hoc polish commits. The `product-designer` agent's system prompt still references burgundy/glassmorphism — aesthetic rules banned since the March 2026 cinematic minimalism decision. Rules exist, skills exist, verdicts are advisory, nothing refuses; the build ships because no step physically blocks.

**Architectural: the rule landscape is scattered and duplicating.** There are 10+ docs covering overlapping territory, no root `CLAUDE.md` (so cross-cutting rules have no always-loaded home), and cross-doc duplication of mission / entity types / design tokens / portal attribution / first-pass capture / working style. Each subdir `CLAUDE.md` carries a copy-pasted "Recent Architectural Shifts (as of 2026-04-14)" block that will rot independently. `ai-base-instructions-v1.md` is 85% overlap with `AGENTS.md` and carries a version mismatch (filename v1, title v2). The `product-designer` staleness is a *symptom* of this deeper architecture issue — agents can't know what's canonical because nothing is canonical.

The acute and architectural problems compound. Fixing design quality without fixing the rule architecture means the new rules join the scatter and rot the same way.

A secondary requirement surfaced during brainstorm: the product lacks **coherence**. Each feature clears the quality bar individually, but stitched together the product feels like "agentic slop stitched together" (user verdict) — no common narrative or spirit. Apple-grade outcomes come from a creative director, a bypass-hostile pattern library, an anti-pattern gallery, cross-feature critique, and ruthless editing. None of these exist operationally today.

---

## Goal

Ship a unified operational context that makes the rule architecture *bite* — rules are canonical, always-loaded where they must be, binding at plan/impl/PR gates, and refreshed on a cadence. Specifically:

1. **Context spine** — create a root `CLAUDE.md` that's always loaded, points to all canonical sources, carries only the cross-cutting always-on rules, and establishes the reading order.
2. **Consolidation** — per-doc actions to de-duplicate content across the 10+ existing docs, picking a canonical source per concept.
3. **Design truth** — a tight, always-first-read reference for UI work: spirit, component registry (including Pencil IDs), anti-pattern gallery.
4. **Operational gates** — binding enforcement at plan approval, subagent dispatch, and PR review, keyed on a new `product-designer` verdict format.
5. **Coherence cadence** — an on-demand `/coherence` skill for cross-feature drift audits.
6. **Refresh ritual** — explicit monthly + event-triggered refresh protocol so this doesn't rot like what it's replacing.

---

## Non-goals

- **No settings.json hooks.** Enforcement stays at the agent/skill layer. If gates still leak after two weeks of use, add hooks as a follow-up (deferred Option B).
- **No plugin skill modifications.** `superpowers:writing-plans`, `superpowers:subagent-driven-development`, etc. stay as-is. Enforcement lives in agents and root `CLAUDE.md`, not in plugin skills.
- **No automated `/coherence` cron.** On-demand only.
- **No memory migration.** User owns `.claude/projects/.../memory/`. This spec documents the policy-in-memory discrepancy but defers the migration.
- **No Pencil file restructure.** Registry referenced here; canonical design system lives in `docs/design-system.pen` and changes to it are out of scope.
- **No tech-debt cleanup.** `TECH_DEBT.md` (globals.css growth, etc.) is a separate workstream.
- **No DEV_PLAN.md refresh.** Separate workstream.

---

## Design

Six layers. Layer 0 (context spine + consolidation) is the new foundation; Layers 1–4 are the design quality system; Refresh cadence prevents rot.

### Layer 0a — Root `CLAUDE.md` (context spine)

New file at `/Users/coach/Projects/LostCity/CLAUDE.md`. Auto-loaded by Claude Code for every session regardless of working directory.

**Constraint:** keep under 180 lines. This is the always-on index + the cross-cutting rules — not a content dump.

**Content (full proposed file):**

```markdown
# LostCity

**Local discovery data infrastructure.** Four first-class entities (events, places, programs, exhibitions) feeding bespoke portals. The B2B platform funds the mission; the consumer product *is* the mission.

Full brief: `.claude/north-star.md`.

---

## Reading Order (every session, start here)

1. **This file** — auto-loaded.
2. **`.claude/north-star.md`** — mission, bets, decision filters.
3. **`docs/quality-bar.md`** — the elite standards every output must clear.
4. **`docs/design-truth.md`** — product spirit, component registry, anti-patterns. Required for any UI task.
5. **`.claude/agents/_shared-architecture-context.md`** — load-bearing architecture + transitional state.
6. **Subsystem CLAUDE.md** for the work domain:
   - `web/CLAUDE.md` — auth, design system contract, API routes, gotchas.
   - `crawlers/CLAUDE.md` — first-pass capture, destination philosophy.
   - `database/CLAUDE.md` — migrations, schema, adding sources.

---

## Always-On Rules

### Quality
- **No smoke and mirrors.** Data layer first. Browser-verify every UI change. No hardcoded placeholders masking missing data. Full rule: `docs/quality-bar.md` § Data Layer.
- **Consumer-grade, never demo-grade.** If a stranger would have a bad unsupervised experience, it's not done. No walkthrough scripts.
- **Every portal is a live product.** Not a demo, not a proof-of-concept.

### Platform Integrity
- **Portal attribution mandatory.** `sources.owner_portal_id NOT NULL`; events inherit `portal_id` via trigger. Cross-portal leakage = P0. Details: `AGENTS.md` § Non-Negotiable Rules.
- **URL builders via `web/lib/entity-urls.ts`.** Never hand-build entity URLs.
- **Single search entry: `search_unified()`.** `p_portal_id` always required.
- **Surface separation.** Consumer vs admin is a hard boundary. Details: `docs/portal-surfaces-contract.md`.

### Crawlers
- **First-pass capture.** One visit extracts events, programs, recurring series, specials, hours, metadata. Enrichment scripts = crawler failure. Details: `crawlers/CLAUDE.md` § Core Philosophy.

### Design Quality (UI work)
- **Pencil comp → spec → code → verify.** No UI implementation without: Pencil comp ID + extracted spec path + motion spec. If a comp doesn't exist, design it first. Full pipeline: `docs/design-truth.md` + `.claude/skills/design-handoff/` + `.claude/skills/motion/`.
- **`product-designer` verdict binds.** Plan and PR gates return `VERDICT: BLOCK | PASS-WITH-NOTES | PASS`. Treat as gate, not opinion.
- **Coherence audit cadence.** After every 2–3 features land on main, run `/coherence` to catch cross-feature drift.

### Working Style
- **Critical partner, not yes-machine.** Challenge weak ideas — including the user's own. Be direct. No hedging.
- **Strategic framing first.** Surface decisions at "what and why." Handle "how" autonomously unless meaningful tradeoff.
- **Scope discipline.** Do what was asked. Don't gold-plate. Note adjacent issues separately.
- **No planning-as-progress.** Specs and plans don't substitute for shipping.

---

## Hard Constraints

- **Tiny Doors ATL opt-out.** Never reference in descriptions, tracks, or content.
- **No new `content_kind='exhibit'`.** Deprecated. Use `events.exhibition_id` FK.
- **`places`, not `venues`.** Renamed March 2026. All new code uses `place_id`, `place_type`, `places` table.
- **Exhibitions are cross-vertical.** `exhibitions` table. Not Arts-only.
- **No `mask-fade-x` on carousels.** Obscures edge cards.

---

## Doc Map (canonical source per concern)

| Concern | Source of truth |
|---|---|
| Mission, bets, decision filters | `.claude/north-star.md` |
| Hypotheses + strategic principles | `STRATEGIC_PRINCIPLES.md` |
| Elite standards (visual / motion / data / crawler / browser / process) | `docs/quality-bar.md` |
| Design spirit, component registry, anti-patterns | `docs/design-truth.md` |
| Architecture (canonical patterns + transitional state) | `.claude/agents/_shared-architecture-context.md` |
| Repo guidelines + non-negotiable rules + verification matrix | `AGENTS.md` |
| Surface contract | `docs/portal-surfaces-contract.md` |
| Active work status | `DEV_PLAN.md` |
| Parallel agent claims | `ACTIVE_WORK.md` |
| Open tech debt | `TECH_DEBT.md` |
| Decision records | `docs/decisions/` |
| Subsystem rules | `{web,crawlers,database}/CLAUDE.md` |
| In-flight plans | `docs/superpowers/plans/` |

---

## Multi-Agent Coordination

When multiple Claude Code sessions work in parallel, check `ACTIVE_WORK.md` before starting. Don't modify files claimed by another agent.

Migrations: use `python3 database/create_migration_pair.py <name>` — handles sequential numbering. Every schema/data migration needs parity between `database/migrations/` and `supabase/migrations/`. Before finishing migration-heavy work: `python3 database/audit_migration_parity.py --fail-on-unmatched`.

---

## Gate Discipline

- **Commit:** `tsc` + tests + lint pass (pre-commit hook enforces).
- **Push:** `/design-handoff verify` + `/motion audit` clean on changed UI routes.
- **PR:** `pr-reviewer` verdict has no Critical.
- **Merge:** reviewer approval + CI green + design verdict PASS or PASS-WITH-NOTES.

---

## Refresh Cadence

This file and the canonical docs rot without a ritual.

- **Monthly** — review this file, north-star, quality-bar, design-truth, _shared-arch. Update dates, reconcile any drifted content, delete dead references.
- **After a major architectural shift** — update `_shared-architecture-context.md` § Transitional State. Subdir `CLAUDE.md`s reference it (don't duplicate).
- **After a `/coherence` run** — update design-truth's anti-pattern gallery with new observations.
- **When the same rule is violated twice** — promote the implicit rule to written form at the canonical source.

If duplication creeps back — same concept in two docs — consolidate to canonical and leave a pointer.

---

**Last refreshed:** 2026-04-18 (initial creation; consolidation from scattered rules in AGENTS.md, ai-base-instructions-v1.md, subsystem CLAUDE.mds, and memory).
```

### Layer 0b — Consolidation (per-doc actions)

The matrix below drives the implementation plan. Every row is a concrete file action.

#### Canonical source assignments

| Concept | Canonical | Others |
|---|---|---|
| Mission / "what we are" | `.claude/north-star.md` | AGENTS, STRATEGIC_PRINCIPLES, _shared-arch → 1-line + link |
| Hypotheses + strategic principles | `STRATEGIC_PRINCIPLES.md` | north-star's "5 bets" summary stays; other docs link |
| Four first-class entities (narrative) | `.claude/north-star.md` | _shared-arch keeps FK-level technical detail; others link |
| Standards bar (elite quality) | `docs/quality-bar.md` | Others link; no inline duplicates |
| Design spirit + registry + anti-patterns | `docs/design-truth.md` (NEW) | web/CLAUDE, quality-bar link |
| Design tokens + typography scale + recipes | `web/CLAUDE.md` § Design System Contract | AGENTS removes duplicate; figma-design-system-rules retired to thin stub |
| Pencil component IDs | `docs/design-truth.md` § Component Registry | figma-design-system-rules retires (IDs migrate) |
| "No smoke and mirrors" | `docs/quality-bar.md` § Data Layer | web/CLAUDE keeps the WEB-specific browser-verify checklist; AGENTS, ai-base-instructions → link |
| First-pass crawler capture | `crawlers/CLAUDE.md` § Core Philosophy | quality-bar summarizes; AGENTS, ai-base-instructions → link |
| Portal attribution | `AGENTS.md` § Non-Negotiable Rules | crawlers/CLAUDE, database/CLAUDE keep subsystem wiring; _shared-arch, ai-base-instructions → link |
| `search_unified()` / `entity-urls.ts` | `_shared-architecture-context.md` § Canonical Patterns | web/CLAUDE keeps TS signature details; database/CLAUDE keeps RPC/migration details |
| Multi-agent coordination (`ACTIVE_WORK.md` cadence) | root `CLAUDE.md` | Three subdir CLAUDE.mds remove the duplicate |
| Working style / scope discipline | `.claude/north-star.md` + root `CLAUDE.md` always-on reminder | AGENTS, STRATEGIC_PRINCIPLES remove duplicates |
| Strategic anti-patterns | `.claude/north-star.md` + `STRATEGIC_PRINCIPLES.md` (keep both — different scope) | quality-bar links; memory stops duplicating |
| Design anti-patterns | `docs/design-truth.md` § Anti-Pattern Gallery | quality-bar links |
| "Recent Architectural Shifts" narrative | `_shared-architecture-context.md` § Transitional State | Subdir CLAUDE.mds delete their copies and link |
| Reading order | root `CLAUDE.md` § Reading Order | _shared-arch, AGENTS, individual agent prompts all defer |
| Hard constraints (opt-outs, deprecations) | root `CLAUDE.md` § Hard Constraints | Memory stops carrying them (not migrated here; noted as discrepancy) |

#### Per-file actions

**`AGENTS.md`** — keep as non-negotiable-rules home.
- KEEP: non-negotiable rules (portal contract, surface separation, portal surface architecture, data ownership, event presentation), verification matrix, build/test/dev commands, coding style & naming.
- TRIM: "What We Are" preamble → 1-line + link to north-star.
- DELETE: design system contract block (~50 lines) → link to `web/CLAUDE.md`.
- DELETE: "Shipping Standards" block → link to `docs/quality-bar.md` § Data Layer.
- DELETE: "Crawler Standards" block → link to `crawlers/CLAUDE.md` § Core Philosophy.
- DELETE: "Working Style" block → link to root `CLAUDE.md`.
- ABSORB: from `ai-base-instructions-v1.md` — "Decision Order", "Required Delivery Checklist", "Default No-Go Conditions" (content not already covered).
- Update header: "Last refreshed: 2026-04-18".

**`STRATEGIC_PRINCIPLES.md`** — keep as hypotheses + principles home.
- KEEP: hypotheses 1–5, principles 1–12, decision framework, anti-patterns.
- TRIM: mission preamble (~2 paragraphs) → 1-line + link to north-star.
- Update header pointer: "Read after north-star."

**`.claude/north-star.md`** — canonical mission doc.
- KEEP: mission, 5 bets, brand architecture, decision filters, anti-patterns, tone & working style.
- TRIM: "Current Priorities" → reference `DEV_PLAN.md`.
- TRIM: "Current Architecture Anchor" → reference `_shared-architecture-context.md` § Transitional State (it's the same content, redundantly maintained).
- Add pointer at top: "See root CLAUDE.md for doc map and reading order."

**`.claude/agents/_shared-architecture-context.md`** — canonical architecture doc.
- KEEP: first-class entity types (technical), canonical patterns, transitional state.
- REWRITE: "Required reading order" section → "See root CLAUDE.md § Reading Order."
- ABSORB: "Recent Architectural Shifts (as of 2026-04-14)" content from `web/CLAUDE.md`, `crawlers/CLAUDE.md`, `database/CLAUDE.md` into the Transitional State section. This becomes the single home for the narrative.
- Update header: "Last refreshed: 2026-04-18."

**`docs/quality-bar.md`** — canonical standards doc.
- KEEP: all section content (Visual & Design, Motion & Interaction, Data Layer, Crawlers, Browser-Using Work, Process & Orchestration, Strategic Posture, Pipeline Gates, Hard Constraints).
- TRIM: mission/context preamble → link to north-star.
- ADD: pointers to canonical sources throughout ("Full rule: AGENTS.md § X" etc.) — make this doc a synthesis that *references*, not *duplicates*.
- ADD: "Refresh triggers" section matching root CLAUDE.md cadence.

**`docs/ai-base-instructions-v1.md`** — delete after absorption.
- ACTION: absorb non-duplicate content into `AGENTS.md` (Decision Order; Required Delivery Checklist; Default No-Go Conditions; any rules not covered elsewhere).
- ACTION: update references in `pr-reviewer.md` and `quality-bar.md` to point to new homes.
- ACTION: grep verify no other references remain.
- ACTION: delete the file.

**`docs/portal-surfaces-contract.md`** — unchanged.

**`web/CLAUDE.md`** — keep as web subsystem doc; canonical for design system contract.
- KEEP: all portal surface architecture rules (canonical), auth patterns, design system contract (canonical for tokens/typography/recipes), WEB-specific browser-verify checklist, images/SmartImage, common gotchas, TypeScript gotchas.
- DELETE: "Multi-Agent Coordination" section → link to root CLAUDE.md.
- DELETE: "Recent Architectural Shifts (as of 2026-04-14)" → link to `_shared-architecture-context.md` § Transitional State.
- Add pointer at top: "Root CLAUDE.md loaded first — see it for doc map. This file is web-specific detail."

**`crawlers/CLAUDE.md`** — canonical for first-pass capture.
- KEEP: multi-agent coordination trimmed (crawlers-specific), core philosophy (canonical first-pass capture), seasonal-only patterns, crawler pattern, data health, series grouping, Atlanta focus areas.
- DELETE: generic "Multi-Agent Coordination" preamble → link to root CLAUDE.md.
- DELETE: "Recent Architectural Shifts" → link to `_shared-arch` § Transitional State.
- Add pointer at top.

**`database/CLAUDE.md`** — keep as database subsystem doc.
- KEEP: migration numbering, commands, architecture overview, adding new sources, environment variables.
- DELETE: "Multi-Agent Coordination" preamble → link to root CLAUDE.md.
- DELETE: "Recent Architectural Shifts" → link to `_shared-arch` § Transitional State.
- Add pointer at top.

**`web/.claude/rules/figma-design-system.md`** — mostly retire.
- MIGRATE: Pencil component IDs + Atlanta portal page composition IDs → `docs/design-truth.md` § Component Registry.
- MIGRATE: Figma Code Connect mappings → keep (Figma-specific workflow value).
- DELETE: all duplicated design token / typography / recipe content.
- REWRITE as thin stub:
  - "For product design and implementation: see `docs/design-truth.md` (registry) and `web/CLAUDE.md` (tokens, recipes)."
  - Retain only Figma MCP workflow notes + Code Connect mappings.
- Target size: ≤60 lines.

**`docs/design-truth.md`** — new. See Layer 1.

**`.claude/agents/product-designer.md`** — full rewrite. See Layer 3.

**`.claude/agents/pr-reviewer.md`** — extension. See Layer 3.

**`.claude/agents/_shared-architecture-context.md`** referenced by other agents — agents standardize to: "Required reading: root CLAUDE.md (which establishes reading order)." See Layer 3 agent updates.

**`.claude/skills/coherence/SKILL.md`** — new. See Layer 4.

**Memory** — untouched. Discrepancy noted: some `feedback_*.md` files carry project policy (portal isolation, Tiny Doors opt-out, portal naming) that now has canonical homes. Memory explicitly warns "verify before asserting." Migration deferred.

### Layer 1 — `docs/design-truth.md`

≤1 page, always loaded for UI tasks per root CLAUDE.md.

**Six sections:**

1. **Product spirit** — 5 lines. "Camera, not cartoon. Cinematic minimalism. Portals are bespoke, never configured. Typography carries when images don't. Stillness is design."

2. **Component registry** — cross-portal patterns ONLY. Each entry: name, shipped code path, Pencil node ID, use-for / don't-use-for. Intended entries:
   - Atoms: Badge (I7NUV), FilterChip (olqzW), Button (GBoOR), Dot (CsjTB), CountBadge (xDCna), IconBox (W2bkv)
   - Molecules: EventCard (ViqPG), EventCard/compact (pjp57), VenueCard (h5zDT), FeaturedCard (CX6oB), FeedSectionHeader (v1ON6), MetadataGrid (YYhn1), SectionHeader (vBfLD), DescriptionTeaser (2ZOe9), SocialProofStrip (gaiuv), ScheduleRow (t5jrF)
   - Organisms: DetailHero (fupdn), InfoCard (cwCFk), DetailStickyBar (wEQon), MobileFilterSheet (q6CvR), FeedSection carousel (yt3B5), FeedSection list (Bo2iQ), Modal (InHlJ)
   - Page-level: HeaderNav (u7MOk), MobileHeader (rEX9y), Footer (gJVuG), MobileTabBar (8LoLi), NeighborhoodCard (eoLUe)
   - Shipped compositions (code only, no Pencil ID): Now Showing widget, LiveTonightHeroStrip, DetailActions, ConnectionsSection
   - Atlanta portal page compositions (desktop + mobile IDs) migrated from figma-design-system.md: Feed, Events view, Places view, Venue detail, Event detail, Series detail, Regulars, Neighborhoods, Search, Calendar, Map, Profile, Saved, Community
   - Full 33-component Pencil system lives in `docs/design-system.pen`; registry is the platform DNA subset.

3. **Cross-portal patterns** — sub-list of registry entries annotated "platform DNA." Compose from these across verticals, don't reinvent.

4. **Anti-pattern gallery** — citations only (no screenshots in v1):
   - Plan 2: count badges ("68 SHOWS"), enum labels ("FLAGSHIP"), widget giantism (3617px), mid-word truncation → `feedback_no_comp_no_implementation.md`
   - `mask-fade-x` on carousels → `feedback_no_carousel_mask_fades.md`
   - Redundant filter shortcuts → `feedback_no_redundant_filters.md`
   - Placeholder hides missing data → `feedback_no_smoke_and_mirrors.md`
   - Glassmorphism / burgundy / neon decor → `decisions/2026-03-08-cinematic-minimalism-design.md`

5. **Aesthetic decisions index** — one-liners with links to north-star, cinematic minimalism decision, quality-bar, motion skill, portal naming decision.

6. **Coherence check** — two binding questions:
   - Before approving a plan: *"Would this feel like it belongs next to Now Showing and DetailHero?"*
   - Before merging a PR: *"Put this screenshot beside three other features. Is it the same product?"*

**Size target:** ≤250 lines. Always-loaded cost matters.

### Layer 2 — Operational gates

Three binding enforcement points. Each is enforced by an agent verdict or a root CLAUDE.md rule the main agent follows.

**Plan gate.** UI plans (touching `web/components/**` or `web/app/**`) must have three sections before approval:

1. **Design Prerequisites** — Pencil comp node ID + extracted spec path + motion spec path. Absent or "TBD" = BLOCK.
2. **Component Reuse Check** — which registry entries used/extended. Net-new patterns require justification against existing registry.
3. **Narrative Tie** — 1–2 sentences connecting to product spirit. Generic product-marketing copy that could apply to any feature = BLOCK.

Enforcement: after plan drafted, main agent invokes `product-designer` in new Plan Review mode. `VERDICT: BLOCK` blocks dispatch.

**Implementation gate.** Before dispatching any UI subagent:
- Prompt must include: extracted spec file path, screenshot path, `docs/design-truth.md` path, relevant registry entries.
- No prose-only UI specs. Spec-or-stop.

Enforcement: root CLAUDE.md rule. Plugin skills (`subagent-driven-development`) stay untouched; discipline lives in the main agent following the always-loaded rule.

**PR gate.** `pr-reviewer` extends its flow:
1. Existing code-quality review (unchanged).
2. Diff touches UI paths → dispatch `/design-handoff verify <route>` per changed route. Block on Critical/Major.
3. Diff adds motion-relevant surfaces → dispatch `/motion audit <route>`. Block on missing entrance/hover for interactives.
4. Diff touches ≥2 related surfaces → coherence snapshot (Layer 4).
5. Code review flags any new component in `web/components/**` overlapping registry.

Browser budget: these subagents run sequentially (per `feedback_no_parallel_browser_subagents`). Pre-flight `vm_stat`.

### Layer 3 — Agent rewrites

#### `product-designer` — taste director

File: `.claude/agents/product-designer.md`. Full rewrite.

- **First-read line:** "Read root CLAUDE.md → design-truth.md → quality-bar.md § Visual & Design + § Motion & Interaction before any review."
- **Strip stale sections:** Platform Aesthetic (burgundy/glassmorphism), Design Tokens (HSL), Category colors, any 2025-era references.
- **Add SaaS Smell Test** — auto-BLOCK patterns with concrete examples tagged to design-truth/quality-bar sections.
- **Add Taste Exemplars** — 3–5 accepted (Now Showing, DetailHero, Lost Youth Arts header, LiveTonightHeroStrip post-polish), 3–5 rejected (Plan 2 initial ship, mask-fade carousels).
- **Add Plan Review mode** — takes a plan file path, checks for Layer 2 required sections + strength, returns VERDICT.
- **Output format:** every response starts with `VERDICT: BLOCK | PASS-WITH-NOTES | PASS` + evidence cited by section. Callers key on the verdict line.

#### `pr-reviewer` — add visual/motion/coherence dispatch

File: `.claude/agents/pr-reviewer.md`. Additive changes; existing code review preserved.

- After code review, if diff touches `web/components/**` or `web/app/**`:
  - Grep changed routes (`app/**/page.tsx`).
  - Dispatch browser subagent running `/design-handoff verify` per changed route.
  - Dispatch `/motion audit` for the same routes.
  - Registry-reuse check during code review pass.
  - Compile results; any Critical from visual / motion / registry blocks merge.
- Sequential dispatch only. Pre-flight memory.

#### Other agents — standardize reading order

For each of `full-stack-dev`, `crawler-dev`, `data-specialist`, `qa`, `business-strategist`, `lint-fixer`, `test-runner`:

- REPLACE per-agent "required reading" block (currently varies: some say "read north-star and _shared-arch", some say just north-star) with a single line:
  > "Before any task: read root `CLAUDE.md` (auto-loaded). It establishes the reading order for `.claude/north-star.md`, `docs/quality-bar.md`, `docs/design-truth.md`, `_shared-arch`, and subsystem CLAUDE.md."
- Agent-specific guidance below that line stays untouched.
- `qa` additionally keeps its browser memory budget block (load-bearing).

#### Skill first-reads

One-line update to each of `.claude/skills/{design,motion,design-handoff,elevate}/SKILL.md`:

> "First read: root `CLAUDE.md` → `docs/design-truth.md`."

### Layer 4 — Coherence cadence

New skill: `.claude/skills/coherence/SKILL.md` (command: `/coherence`).

**Scope:** on-demand only. Single browser subagent at a time.

**Trigger:** user invokes after every 2–3 feature plans land, or when drift is suspected. `/coherence <route1> <route2> ...` or `/coherence --recent` (uses `git log --name-only` on recent UI routes).

**Process:**
1. Pre-flight `vm_stat` check; abort if < 200 MB.
2. Pick 3–5 related surfaces (argument or recent).
3. Single tab, desktop 1440×900. Sequential screenshots, close between. Max 5 total.
4. Five coherence dimensions: typography vocabulary, card shape+density, motion vocabulary, header tier consistency, spacing rhythm.
5. Drift Report written to `docs/coherence/YYYY-MM-DD-drift.md`:
   - Consistent dimensions
   - Drift dimensions (specific gaps)
   - Fragmenting patterns (patterns that should share but don't)
   - Spirit drift (surfaces no longer feeling like the same product)
   - Recommended follow-ups (filed as tasks, NOT fixed in-flight)
6. Optionally updates `docs/design-truth.md`: new anti-patterns observed, new registry candidates.

---

## Defaults for open questions

1. **Enforcement ceiling** — no settings.json hooks. Agent-level enforcement only. Revisit in two weeks.
2. **`/coherence` scope** — on-demand, not cron.
3. **Anti-pattern gallery format** — citations + feedback memory links in v1; screenshots only when words fail.
4. **`ai-base-instructions-v1.md`** — absorb content into `AGENTS.md`, delete file.
5. **`figma-design-system.md`** — migrate Pencil IDs to design-truth; keep thin stub for Figma Code Connect mappings.
6. **Memory** — leave alone; document discrepancy for future migration.

---

## Risks

- **Main-agent discipline is the ceiling.** Without hooks, a forgetful main agent can skip gates. Mitigations: root CLAUDE.md top-level rules, `product-designer` VERDICT visibility, feedback memory on violations.
- **Browser budget pressure.** PR gate adds 2–3 browser subagent runs per UI PR. Mitigation: strict sequencing + pre-flight `vm_stat` per `feedback_browser_memory_budget`.
- **Plan bloat.** UI plans get three additional required sections. Mitigation: sections are short (1–3 lines); registry reuse reduces new-pattern justifications over time.
- **Consolidation rot.** Canonical sources can drift back to duplication if maintenance slips. Mitigation: refresh cadence section + explicit "consolidate duplicates back to canonical" rule in root CLAUDE.md.
- **Document deletion risk.** Deleting `ai-base-instructions-v1.md` is one-way. Mitigation: grep-verify no references remain; absorb content first, then delete in a separate commit that's easy to revert.
- **Figma workflow disruption.** Retiring `figma-design-system.md` might break Figma MCP auto-discovery. Mitigation: keep thin stub at the same path; migrate valuable content rather than deleting.
- **False verdict confidence.** `VERDICT: PASS` means "no rule violated," not "this is S-tier." Taste is judgment. Mitigation: explicit note in product-designer prompt; coherence cadence catches rule-passing-but-drifting work.
- **Memory discrepancy.** Policy in memory may conflict with post-consolidation canonical docs. Mitigation: memory explicitly says "verify before asserting"; no enforcement action required in this spec.
- **Plugin skills stay untouched, so implementation-gate enforcement is advisory.** `subagent-driven-development` can't be modified. Mitigation: root CLAUDE.md rule + main-agent practice.

---

## Acceptance criteria

1. Root `/CLAUDE.md` exists, ≤180 lines, contains: reading order, always-on rules, hard constraints, doc map, multi-agent coordination, gate discipline, refresh cadence. Auto-loaded by Claude Code (verified by starting a fresh session at repo root and confirming it's in context).
2. `docs/design-truth.md` exists, ≤250 lines, contains six sections with Pencil component IDs migrated from figma-design-system.md.
3. `product-designer` agent output always starts with `VERDICT: BLOCK | PASS-WITH-NOTES | PASS`. System prompt contains zero references to burgundy/glassmorphism/HSL values.
4. A UI plan missing any of the three Design Prerequisites sections gets `VERDICT: BLOCK` from `product-designer` in Plan Review mode (regression-tested with a mock Plan 2-style plan).
5. A PR touching `web/components/**` without a recent `/design-handoff verify` artifact causes `pr-reviewer` to spawn one and block on Critical/Major.
6. `/coherence` skill exists, runs on-demand, writes `docs/coherence/YYYY-MM-DD-drift.md`.
7. `AGENTS.md` no longer contains duplicated shipping-standards / crawler-standards / design-system blocks; those sections link to canonical sources.
8. `ai-base-instructions-v1.md` deleted; no grep hits for references.
9. `figma-design-system.md` is a thin stub (≤60 lines) containing only Figma MCP workflow + Code Connect mappings.
10. `_shared-architecture-context.md` contains the single "Recent Architectural Shifts" / Transitional State narrative; subdir CLAUDE.mds no longer carry duplicated blocks.
11. Each subdir CLAUDE.md has a top-level pointer: "Root CLAUDE.md loaded first."
12. All other agent system prompts (full-stack-dev, qa, etc.) reference root CLAUDE.md rather than repeating reading-order instructions.
13. `docs/quality-bar.md` has a refresh-cadence note and cross-doc pointers replacing inline duplications.
14. A fresh-session reading-order spot check: starting cold in `crawlers/` and asking a UI-related question, the main agent loads root CLAUDE.md → design-truth as the first two reads (verifiable from tool-call log).

---

## Refresh cadence

Established in root CLAUDE.md § Refresh Cadence. Summary:

- **Monthly:** root CLAUDE.md, north-star, quality-bar, design-truth, _shared-arch. Update dates. Reconcile drift.
- **After a major architectural shift:** `_shared-arch` § Transitional State (single home). Subdir CLAUDE.mds only link.
- **After every `/coherence` run:** design-truth anti-pattern gallery and registry.
- **Rule-violation-twice trigger:** promote implicit rule to written form at canonical source.
- **Consolidation trigger:** if duplication creeps back, consolidate to canonical and leave pointer.

---

## Out of scope (future work)

- settings.json `PostToolUse` hooks to enforce gates at the harness level (Option B).
- Automated `/coherence` cron.
- Pencil file (`docs/design-system.pen`) restructure or audit.
- Memory migration (move project policy from `memory/feedback_*.md` to canonical docs).
- `TECH_DEBT.md` cleanup (globals.css growth, migration count growth, etc.).
- `DEV_PLAN.md` refresh.
- Taste training data or model fine-tuning.

---

## Implementation notes (for writing-plans)

The plan sequences into phases with clear dependencies:

**Phase A — Foundation (must land first):**
1. Commit this spec.
2. Create root `/CLAUDE.md`.
3. Create `docs/design-truth.md` (with Pencil IDs migrated from figma-design-system).

**Phase B — Consolidation (per-doc edits, mostly parallelizable after Phase A):**
4. Trim `AGENTS.md` + absorb `ai-base-instructions-v1.md` content.
5. Delete `ai-base-instructions-v1.md` (after grep-verify references updated).
6. Trim `STRATEGIC_PRINCIPLES.md` preamble.
7. Trim `.claude/north-star.md` (remove duplicated architecture anchor; keep mission/bets/filters/style).
8. Expand `_shared-architecture-context.md` (absorb transitional-state from subdir CLAUDE.mds; standardize reading-order pointer).
9. Trim `docs/quality-bar.md` + add refresh triggers + cross-doc pointers.
10. Trim `web/CLAUDE.md` (remove multi-agent-coord + architectural-shifts sections; add root pointer).
11. Trim `crawlers/CLAUDE.md` (same).
12. Trim `database/CLAUDE.md` (same).
13. Retire `web/.claude/rules/figma-design-system.md` to thin stub (migrate Pencil IDs to design-truth; keep Code Connect mappings + Figma MCP notes).

**Phase C — Agent rewrites:**
14. Rewrite `.claude/agents/product-designer.md` (full rewrite).
15. Extend `.claude/agents/pr-reviewer.md` (additive; UI-dispatch logic).
16. Standardize reading-order block in other agents (`full-stack-dev`, `crawler-dev`, `data-specialist`, `qa`, `business-strategist`, `lint-fixer`, `test-runner`).
17. Add first-read line to four skills (`design`, `motion`, `design-handoff`, `elevate`).

**Phase D — New skill:**
18. Create `.claude/skills/coherence/SKILL.md`.

**Phase E — Verification:**
19. Regression test: mock Plan 2-style plan → `product-designer` returns `VERDICT: BLOCK` with expected citation.
20. Audit: every acceptance criterion confirmed.
21. Grep sweep: no orphaned references to deleted `ai-base-instructions-v1.md` or removed sections.
22. Feedback memory: document the new architecture (what's canonical where; refresh cadence; how to handle rule violations).

Phase A is sequential. Phases B's items are mostly independent and can parallelize (each is a different file). Phase C depends on Phase A. Phase D is independent. Phase E depends on everything.

Ballpark: Phase A ~30 min. Phase B ~1.5 hours (10 file edits). Phase C ~1 hour. Phase D ~20 min. Phase E ~30 min. Total ~3.5–4 hours of bite-sized task work.
