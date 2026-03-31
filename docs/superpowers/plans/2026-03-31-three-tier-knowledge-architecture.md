# Three-Tier Knowledge Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure agent instructions into a tiered knowledge system with deterministic enforcement hooks and lightweight decision records.

**Architecture:** Tier 1 (MEMORY.md index + north-star.md) fires every session. Tier 2 (domain CLAUDE.md files) fires when agents work in that directory. Tier 3 (topic memory files) is cold reference loaded on demand. Hooks enforce critical rules at edit-time.

**Tech Stack:** Claude Code hooks (settings.json), Markdown files, shell scripts

**Spec:** `docs/superpowers/specs/2026-03-31-three-tier-knowledge-architecture-design.md`

---

### Task 1: Create Decision Records Directory and ADR Template

**Files:**
- Create: `docs/decisions/README.md`

**Why first:** ADRs must exist before MEMORY.md can link to them in Task 5.

- [ ] **Step 1: Create the decisions directory with README**

```markdown
# Architecture Decision Records

Lightweight records of architectural decisions and their reasoning.

## Template

Each ADR follows this structure:

- **Date:** When the decision was made
- **Status:** Accepted, Deprecated, or Superseded by [link]
- **Context:** What forced this decision (1-3 sentences)
- **Decision:** What we decided (1 sentence)
- **Consequences:** What gets easier, harder, or constrained
- **Supersedes:** Link to prior decision, or None

## How Agents Use ADRs

- MEMORY.md index has one-line entries linking here
- Before proposing a feature, check if a prior decision covers it
- To overturn a decision, argue with the reasoning — don't just re-propose
- New ADRs: copy the template, fill it in, add an index entry to MEMORY.md
```

Run: `ls docs/decisions/README.md`
Expected: File exists

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/README.md
git commit -m "docs: create ADR directory with template"
```

---

### Task 2: Write Feed Philosophy ADR

**Files:**
- Create: `docs/decisions/2026-02-21-feed-philosophy.md`

- [ ] **Step 1: Write the ADR**

```markdown
# ADR: Feed Is an Access Layer, Not a Recommendation Engine

**Date:** 2026-02-21
**Status:** Accepted

## Context

Early feed designs drifted toward personalization ("We think you'd like this") and curated tiny lists. This conflicts with LostCity's mission — the city should feel alive and comprehensive, not filtered through an algorithm. Users need agency, not recommendations.

## Decision

The feed organizes the city for you right now. It does not decide what you should do.

## Consequences

- Scoring influences display order, never exclusion. Low-score items still appear, just further down.
- Every section has "See all" linking to the full unfiltered Find view. Quick links are shortcuts, not curated lists.
- Editorial tone ("Atlanta's biggest food festival starts today") rather than algorithmic ("We think you'd like this").
- Wild card sorting breaks filter bubbles intentionally.
- CityPulse context engine drives what sections appear and in what order, but the user always has access to everything.
- Personalization features (if ever built) must be opt-in overlays, not default behavior.

## Supersedes

None
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/2026-02-21-feed-philosophy.md
git commit -m "docs: ADR — feed is access layer, not recommendation engine"
```

---

### Task 3: Write Specials ADR

**Files:**
- Create: `docs/decisions/2026-03-05-specials-are-venue-metadata.md`

- [ ] **Step 1: Write the ADR**

```markdown
# ADR: Specials Are Venue Metadata, Not Discovery Items

**Date:** 2026-03-05
**Status:** Accepted

## Context

Venue specials (happy hours, brunches, deals) were initially ingested as events and proposed as a feed section. This failed the product smell test: data was too thin (~60 records), not curated, and mixing venue attributes with event discovery confused intent. The specials section was technically sound but product-wise worthless — a cautionary example of "bias toward building."

## Decision

Specials are venue attributes that render on venue detail pages via `VenueSpecialsSection`. They are not events and do not appear in the feed.

## Consequences

- Specials live in the `venue_specials` table, not `events`.
- Source 1177 was cleaned up: 207 food/drink events migrated to venue_specials, source deactivated. 12 specials created, 34 real events kept.
- Shared utils in `web/lib/specials-utils.ts` (VenueSpecial type, isActiveNow, formatDays, etc.) use ISO 8601 day convention (1=Mon, 7=Sun).
- Future: could become a Find filter ("show venues with active specials") when data is 10x richer.
- Prevents re-proposing specials in feed sections.

## Supersedes

None
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/2026-03-05-specials-are-venue-metadata.md
git commit -m "docs: ADR — specials are venue metadata, not discovery items"
```

---

### Task 4: Write Remaining 6 ADRs

**Files:**
- Create: `docs/decisions/2026-03-12-portal-naming-convention.md`
- Create: `docs/decisions/2026-03-12-follows-to-friendships.md`
- Create: `docs/decisions/2026-03-11-destination-inclusion-bar.md`
- Create: `docs/decisions/2026-03-11-portal-ecosystem-strategy.md`
- Create: `docs/decisions/2026-03-08-cinematic-minimalism-design.md`
- Create: `docs/decisions/2026-03-05-specials-source-1177-cleanup.md`

- [ ] **Step 1: Write portal naming convention ADR**

```markdown
# ADR: "Lost ___" Naming Convention for First-Party Portals

**Date:** 2026-03-12
**Status:** Accepted

## Context

First-party portals needed a brand architecture. Options considered: independent brand names, "LostCity + descriptor", and "Lost ___" pattern. Each portal has a completely different visual language (mercurial brand identity) — different fonts, colors, border styles, corner radii. The naming convention needed to unify the brand while allowing visual diversity.

## Decision

All first-party portals use "Lost City: X" as the formal name, with "Lost ___" as the brand shorthand. Each name has a positive double-meaning:
- Lost Citizen (civic) — "Show up"
- Lost Track (adventure) — "Wander over yonder"
- Lost Youth (family) — "Play hooky"
- Lost Arts (creative) — "Scene, surfaced"

Root page tagline: "FIND YOUR THING AND DO IT" (not "Find Your People" — too cliche/social-focused).

## Consequences

- White-labeling demonstrated through B2B clients (FORTH, Gozio), not first-party name variety.
- Each portal's design system is completely bespoke: Citizen (teal, serif, rounded), Track (terracotta, Space Grotesk, sharp corners), Youth (field sage, Plus Jakarta Sans, warm rounded), Arts (copper, monospace + italic serif, zero radius, stroke borders).
- Never build a theme/config system — generate bespoke frontends on a clean API.

## Supersedes

None
```

- [ ] **Step 2: Write follows-to-friendships ADR**

```markdown
# ADR: Mutual Friendships as Social Primitive Over Follows

**Date:** 2026-03-12
**Status:** Accepted

## Context

The social layer needed a core relationship primitive. Follows (one-way, asymmetric like Twitter) vs friendships (mutual, symmetric like Facebook) serve different purposes. LostCity's mission is getting people out together — coordination requires mutual trust, not broadcast audiences.

## Decision

Mutual friendships are the social primitive. `get_friend_ids()` RPC gates all social features (hangs, activity feed, plans). The `follows` table is retained only for venue/org follows, not person-to-person relationships.

## Consequences

- Hangs, friend activity, plans, and social proof all require mutual friendship.
- No follower counts, no public follow lists, no asymmetric social dynamics.
- Higher friction to connect (must accept request) but higher signal when connected.
- Block propagation: `enforce_block_unfriend` trigger cascades blocks to unfriend + unfollow.

## Supersedes

None
```

- [ ] **Step 3: Write destination inclusion bar ADR**

```markdown
# ADR: Inclusive Destination Bar — "Would Someone Plan to Go Here?"

**Date:** 2026-03-11
**Status:** Accepted

## Context

Early destination curation filtered through a tourism/uniqueness lens — only "interesting" or "Atlanta-specific" venues made the cut. This excluded chains (Dave & Buster's, Round 1), malls, entertainment centers, and other places people legitimately plan to visit. The filter was editorial snobbery disguised as curation.

## Decision

Include any place people would choose to spend their time. The bar is "would someone plan to go here?" not "is this unique to Atlanta?"

## Consequences

- Chains, entertainment centers, malls, arcades all qualify as destinations.
- The data layer gets broader and more useful for distribution portals (hotels especially need chain restaurants and family entertainment).
- Curation/editorial quality comes from enrichment (descriptions, occasions, editorial mentions) — not exclusion.
- Prevents agents from filtering destinations through a tourism lens.

## Supersedes

None
```

- [ ] **Step 4: Write portal ecosystem strategy ADR**

```markdown
# ADR: Content Pillars Produce Entities, Distribution Portals Consume

**Date:** 2026-03-11
**Status:** Accepted

## Context

First-party portals could be just filtered views of the same event data (cheaper, faster) or independent content factories with unique entity types (richer, more defensible). The platform's network effect depends on each portal enriching the shared data layer, not just viewing it differently.

## Decision

Each first-party portal is a two-sided content factory. Niche content stays in-portal (SAG meetings, open calls, trailhead conditions). General-interest content (festivals, concerts, openings) federates to the base layer and distribution portals. Content pillars (Citizen, Family, Adventure, Arts, Sports) produce unique entities. Distribution portals (FORTH hotels, Convention Companion) consume the enriched aggregate.

## Consequences

- Every new portal must have a unique entity type or it's just a search preset, not a content pillar.
- Portal-specific data models required: programs (Family), destinations (Adventure), exhibitions/open calls (Arts), team schedules (Sports).
- Federation rules determine what flows between portals — facts are global, preferences are local.
- More portals = richer data = more value per portal (network effect).
- Portals without unique entity types should not be built.

## Supersedes

None
```

- [ ] **Step 5: Write cinematic minimalism design ADR**

```markdown
# ADR: Cinematic Minimalism Design Direction

**Date:** 2026-03-08
**Status:** Accepted

## Context

The Atlanta portal's design evolved through glassmorphism (backdrop-blur cards, high-opacity glows) which looked striking in mockups but performed poorly in practice — blur is expensive, glass effects are inconsistent across browsers, and the overall effect felt "tech demo" rather than "city guide."

## Decision

Solid surfaces with elevation shadows and subtle atmospheric glow. No backdrop-blur on cards. "City at night" glow — atmospheric and distant, not decorative neon.

## Consequences

- `glass_enabled: false` on all dark presets. `.glass-card`, `.glass-panel`, `.glass-wet` all use solid `--night` fills + shadow elevation.
- Glow dialed down: blur 8-20px, opacity 0.06-0.14 (was 0.15-0.35).
- Chip glow: single 0.08-0.12 atmospheric shadow (was 0.4/0.2 dual-shadow).
- Three core accents: coral (action/CTA), gold (time/featured), neon-green (free/success).
- Influences: Linear Design (precision minimalism), tactile rebellion (anti-AI warmth).
- Anti-patterns: neo-brutalism (wrong fit for a city guide), Apple Liquid Glass (can't replicate on web).

## Supersedes

None (glassmorphism was never a formal decision — it was the initial direction that evolved)
```

- [ ] **Step 6: Write specials source cleanup ADR**

```markdown
# ADR: Source 1177 Specials Cleanup — Events to Venue Metadata

**Date:** 2026-03-05
**Status:** Accepted

## Context

Source 1177 had ingested 207 food/drink items as events when they were actually venue specials (happy hours, brunch deals, daily food specials). These cluttered the event feed with non-events and confused the discovery experience.

## Decision

Migrate source 1177 items: real events stay as events, venue specials move to `venue_specials` table, source deactivated.

## Consequences

- 12 venue specials created from the 207 items, 34 real events retained.
- Source 1177 deactivated — no new ingestion.
- Prevents future re-ingestion of specials as events from this source.
- Established the pattern: if it's a recurring venue attribute (happy hour, daily special), it's a special, not an event.

## Supersedes

None (follows from the specials-are-venue-metadata decision)
```

- [ ] **Step 7: Commit all 6 ADRs**

```bash
git add docs/decisions/2026-03-12-portal-naming-convention.md \
        docs/decisions/2026-03-12-follows-to-friendships.md \
        docs/decisions/2026-03-11-destination-inclusion-bar.md \
        docs/decisions/2026-03-11-portal-ecosystem-strategy.md \
        docs/decisions/2026-03-08-cinematic-minimalism-design.md \
        docs/decisions/2026-03-05-specials-source-1177-cleanup.md
git commit -m "docs: 6 ADRs — portal naming, friendships, destinations, ecosystem, design, specials cleanup"
```

---

### Task 5: Add Known Gotchas to web/CLAUDE.md

**Files:**
- Modify: `web/CLAUDE.md` (append after line 836, the end of Common Gotchas section)

**Context:** web/CLAUDE.md already has Tailwind v4 typography (lines 287-317), the `text-[var()]` warning (line 302), `as never` pattern (line 813), and `@theme inline` / `@utility` details (lines 289-300, 649). We're adding what's NOT already there: CSP, additional TypeScript gotchas, client-side filter patterns, and Pencil property names.

- [ ] **Step 1: Append Known Gotchas section to web/CLAUDE.md**

Add after the closing of the existing Common Gotchas section (after line 836):

```markdown

---

## Known Gotchas (Agent-Critical)

These are bugs that have bitten agents multiple times. They live here (not in MEMORY.md) so agents editing web/ files see them automatically.

### CSP + Next.js 16 Streaming

Next.js 16 streaming scripts (`$RC`, `$RS`, `__next_f.push`) have NO nonce attribute. If CSP `script-src` uses a nonce, these inline scripts are blocked, causing the **entire site to render blank** — only `<template>` elements visible, all Suspense boundaries stuck.

- **Fix:** Use `'unsafe-inline'` instead of nonce for `script-src`. Keep nonces for `style-src` (Next.js does add nonces to `<style>` tags).
- **Symptom:** Page loads 200 with full HTML, but `animate-page-enter` div has height 0. All `<template id="B:N">` elements have hidden `<div id="S:N">` content never swapped in.
- **File:** `web/lib/csp.ts` — `script-src` line must NOT include `'nonce-...'`.

### TypeScript / Next.js 16 Build Gotchas

In addition to the `as never` pattern in Common Gotchas above:

- **Supabase `.maybeSingle()` returns `never`:** After null checks on `.maybeSingle()` or `.select()` results, TypeScript infers the type as `never`. Fix: cast with `as { field: type }` after the guard.
- **SupabaseClient double-cast:** `supabase as SupabaseClient<Schema>` fails. Need: `as unknown as SupabaseClient<Schema>`.
- **PostgrestError is not LogContext:** `logger.warn()` accepts `LogContext`, not `PostgrestError`. Wrap: `{ error: pgError.message }`.
- **`headers()` is async:** Next.js 16 `headers()` returns `Promise<ReadonlyHeaders>` — must be awaited.
- **`RemotePattern.protocol`:** Needs `as const` literal type assertion.
- **`AnimationEffect.setKeyframes`:** Must cast to `KeyframeEffect` first.
- **Re-exports aren't local:** `export { X } from "./mod"` does NOT make `X` available in the current file. Must also `import { X }` separately.
- **Always run `npx tsc --noEmit`** before pushing to catch ALL errors at once, not just the first one Vercel reports.

### Client-Side Filter Patterns

- **Never use `router.push()` for filter state.** It triggers a full Next.js navigation cycle through Suspense. Use `useState` + `window.history.replaceState()` for instant filter toggling.
- **`days_of_week` ISO convention:** DB stores ISO 8601 (1=Mon, 7=Sun). JavaScript `getDay()` returns 0=Sun, 6=Sat. Always convert with `jsToIsoDay()`.
- Day badge counts must reflect the active activity filter.
- Active filter chips must remain visible even at 0 count (so users can clear them).

### Pencil MCP Property Names

When using Pencil MCP tools (`batch_design`), these property names are NOT what you'd guess:

| What you want | Correct property | Wrong (will silently fail) |
|---|---|---|
| Text color | `fill` (string) | `fills` (array) |
| Frame background | `fill` (string) | `fills` (array) |
| Stroke | `{fill, thickness}` | `{color, width}` |
| Layout direction | `layout: "vertical"` | `layoutMode` |
| Padding | `[top, right, bottom, left]` or `[v, h]` or number | Object `{top, right, ...}` |
| Clip content | `clip: true` | `clipsContent` |
```

- [ ] **Step 2: Verify the file is valid**

Run: `wc -l web/CLAUDE.md`
Expected: ~890 lines (was 836 + ~55 new)

- [ ] **Step 3: Commit**

```bash
git add web/CLAUDE.md
git commit -m "docs(web): add Known Gotchas section — CSP, TS build, filters, Pencil"
```

---

### Task 6: Add Hooks to Settings

**Files:**
- Modify: `.claude/settings.local.json` (add `hooks` key)

**Context:** The file currently has only a `permissions` object. We're adding a `hooks` key at the top level. Claude Code hooks run shell commands after tool use, providing immediate feedback to the agent.

- [ ] **Step 1: Create the migration parity check script**

Create `.claude/hooks/check-migration-parity.sh`:

```bash
#!/bin/bash
# Advisory check: when a migration is edited in one directory,
# remind the agent to update the other directory and schema.sql

FILE="$1"
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ "$FILE" == *"database/migrations/"* ]]; then
    BASENAME=$(basename "$FILE" | sed 's/^[0-9]*_//')
    MATCH=$(find "$PROJECT_DIR/supabase/migrations" -name "*$BASENAME" 2>/dev/null | head -1)
    if [ -z "$MATCH" ]; then
        echo "⚠️  Migration parity: No matching file found in supabase/migrations/ for $BASENAME"
        echo "   Every schema migration needs files in BOTH database/migrations/ AND supabase/migrations/"
        echo "   Also update database/schema.sql"
    fi
elif [[ "$FILE" == *"supabase/migrations/"* ]]; then
    BASENAME=$(basename "$FILE" | sed 's/^[0-9]*_//')
    MATCH=$(find "$PROJECT_DIR/database/migrations" -name "*$BASENAME" 2>/dev/null | head -1)
    if [ -z "$MATCH" ]; then
        echo "⚠️  Migration parity: No matching file found in database/migrations/ for $BASENAME"
        echo "   Every schema migration needs files in BOTH database/migrations/ AND supabase/migrations/"
        echo "   Also update database/schema.sql"
    fi
fi

# Always exit 0 — this is advisory, not blocking
exit 0
```

Run: `chmod +x .claude/hooks/check-migration-parity.sh`

- [ ] **Step 2: Create the tsc debounce wrapper**

Create `.claude/hooks/tsc-check.sh`:

```bash
#!/bin/bash
# Run tsc --noEmit but skip if it ran within the last 30 seconds
# This prevents multiple consecutive edits from each triggering a full type check

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOCKFILE="/tmp/lostcity-tsc-last-run"

# Check if tsc ran within the last 30 seconds
if [ -f "$LOCKFILE" ]; then
    LAST_RUN=$(cat "$LOCKFILE")
    NOW=$(date +%s)
    ELAPSED=$((NOW - LAST_RUN))
    if [ "$ELAPSED" -lt 30 ]; then
        exit 0
    fi
fi

# Record this run
date +%s > "$LOCKFILE"

# Run tsc from the web directory
cd "$PROJECT_DIR/web" && npx tsc --noEmit --pretty 2>&1 | head -30

# Exit with tsc's exit code so Claude sees errors
exit ${PIPESTATUS[0]}
```

Run: `chmod +x .claude/hooks/tsc-check.sh`

- [ ] **Step 3: Add hooks to settings.local.json**

The current `.claude/settings.local.json` has this structure:
```json
{
  "permissions": {
    "allow": [ ... ]
  }
}
```

Add the `hooks` key as a sibling to `permissions`:

```json
{
  "permissions": {
    "allow": [ ... existing permissions ... ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "if": "Edit(web/**/*.ts)|Edit(web/**/*.tsx)|Write(web/**/*.ts)|Write(web/**/*.tsx)",
            "command": ".claude/hooks/tsc-check.sh",
            "timeout": 60
          },
          {
            "type": "command",
            "if": "Edit(database/migrations/**)|Edit(supabase/migrations/**)|Write(database/migrations/**)|Write(supabase/migrations/**)",
            "command": ".claude/hooks/check-migration-parity.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Note:** ESLint hook omitted from initial rollout. The tsc hook is higher leverage and adding both at once risks slowing down every edit. We can add ESLint later after confirming tsc hook performance is acceptable.

- [ ] **Step 4: Verify hooks directory**

Run: `ls -la .claude/hooks/`
Expected: `check-migration-parity.sh` and `tsc-check.sh`, both executable

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/check-migration-parity.sh .claude/hooks/tsc-check.sh .claude/settings.local.json
git commit -m "feat: add PostToolUse hooks — tsc type-check and migration parity"
```

---

### Task 7: Restructure MEMORY.md

**Files:**
- Modify: `/Users/coach/.claude/projects/-Users-coach-Projects-LostCity/memory/MEMORY.md`

**Why last:** Depends on ADRs existing (Tasks 1-4) and web/CLAUDE.md updates (Task 5) so we can link correctly and confirm nothing is lost.

- [ ] **Step 1: Verify all ADR files exist**

Run: `ls docs/decisions/*.md | wc -l`
Expected: 9 (README + 8 ADRs)

- [ ] **Step 2: Verify web/CLAUDE.md has the gotchas**

Run: `grep -c "Known Gotchas" web/CLAUDE.md`
Expected: 1

- [ ] **Step 3: Rewrite MEMORY.md**

Replace the entire contents of `/Users/coach/.claude/projects/-Users-coach-Projects-LostCity/memory/MEMORY.md` with:

```markdown
# LostCity Project Memory

## Working Style
- **Strategic over technical**: High-level decision briefings. Handle implementation autonomously. Only surface meaningful tradeoffs.
- **Critical partner, not yes-machine**: Challenge weak ideas — INCLUDING USER'S OWN. No sycophancy, no hedging.
- **Product smell test**: (1) Who benefits, what decision does it help? (2) Works without curation/personalization? (3) Uniquely positioned or worse version of existing?
- **Bias toward building is a failure mode**: "Technically feasible" ≠ "worth having." Empty space is not a problem to solve.
- **Agent cross-checking**: Engineering reviewed against strategy. Strategy checked against engineering reality.
- **Build cost recalibrated**: With agentic dev, "should we build this?" = "is this worth having in the product?"
- **Production launches, not demos**: [feedback_production_not_demo.md](feedback_production_not_demo.md) — Every portal is live. No "demo-ready." No walkthroughs.
- **Architecture before components**: [feedback_architecture_before_components.md](feedback_architecture_before_components.md) — Data architecture BEFORE UI dispatch.
- **Subagent integration checkpoint**: After first 2-3 subagent tasks, run tsc + browser-test BEFORE dispatching more. See [feedback_subagent_system_review.md](feedback_subagent_system_review.md).
- **No smoke and mirrors**: [feedback_no_smoke_and_mirrors.md](feedback_no_smoke_and_mirrors.md) — Data layer first, browser-test everything, no hardcoded placeholders.
- **Enrichment scripts are crawler failures**: [feedback_enrichment_debt.md](feedback_enrichment_debt.md) — Fix the crawler, not the downstream.
- **No redundant filter shortcuts**: [feedback_no_redundant_filters.md](feedback_no_redundant_filters.md) — Don't duplicate dropdown options as standalone buttons.
- **Scope discipline**: Do what was asked. Don't gold-plate. Note adjacent issues separately.
- **Planning-as-progress warning**: Call out when planning work substitutes for shipping.
- **Challenge strategy docs**: If a principle isn't working or reality has diverged, flag it and propose updates.

## Project Structure
- Monorepo: `web/` (Next.js 16), `crawlers/` (Python)
- Supabase for DB; use `as never` for insert/update ops
- Pre-commit hooks run vitest + pytest; PostToolUse hooks run tsc after web edits
- Vercel deploys from `main` branch on push
- `web/CLAUDE.md` has design system, gotchas, security patterns
- `crawlers/CLAUDE.md` has first-pass rules, pipeline architecture
- `database/CLAUDE.md` has migration parity rules

## Hard Constraints
- **Opt-out: Tiny Doors ATL** — never reference in descriptions, tracks, or content
- **North star**: `.claude/north-star.md` — all agents reference before every task

## Decisions (docs/decisions/)
- [Feed = access layer, not recommendations](../../docs/decisions/2026-02-21-feed-philosophy.md) — no personalization, scoring ≠ exclusion
- [Specials = venue metadata](../../docs/decisions/2026-03-05-specials-are-venue-metadata.md) — not feed items, render on venue detail
- [Source 1177 cleanup](../../docs/decisions/2026-03-05-specials-source-1177-cleanup.md) — 207 events → venue_specials table
- [Cinematic minimalism](../../docs/decisions/2026-03-08-cinematic-minimalism-design.md) — solid surfaces, no glass, atmospheric glow
- [Destination inclusion](../../docs/decisions/2026-03-11-destination-inclusion-bar.md) — "would someone plan to go?" not uniqueness filter
- [Portal ecosystem](../../docs/decisions/2026-03-11-portal-ecosystem-strategy.md) — pillars produce entities, distribution consumes
- [Portal naming "Lost ___"](../../docs/decisions/2026-03-12-portal-naming-convention.md) — mercurial brand identity per portal
- [Friendships over follows](../../docs/decisions/2026-03-12-follows-to-friendships.md) — mutual friendships gate all social features

## Project References
- [Places refactor](project_places_refactor.md) — venues → places, PostGIS, place_profile tables
- [Unified Find tab](project_unified_find.md) — Happening + Places merged, vertical-aware cards
- [Taxonomy v2](project_taxonomy_v2.md) — 19 categories, hybrid classification, audience gating
- [Lost Youth design](project_lost_youth_design.md) — field sage, amber, Plus Jakarta Sans
- [Arts portal research](project_arts_portal_research.md) — Open Calls wedge, confidence tiers
- [Groups feature](project_groups_feature.md) — Crews, PRD-036, feature-flagged
- [Crawler pipeline redesign](project_playwright_conversion.md) — Playwright sprint, profile-first pipeline
- [FORTH scoring](project_forth_scoring_next.md) — proximity sections next iteration
- [Design system](reference_design_system.md) — Pencil design system, 33 components, 6 portal themes
- [Figma MCP](reference_figma_mcp_capture.md) — localhost capture recipe, CSP changes needed
```

- [ ] **Step 4: Verify line count**

Run: `wc -l /Users/coach/.claude/projects/-Users-coach-Projects-LostCity/memory/MEMORY.md`
Expected: ~65-75 lines

- [ ] **Step 5: Verify all links resolve**

Run: `cd /Users/coach/.claude/projects/-Users-coach-Projects-LostCity/memory && for f in feedback_production_not_demo.md feedback_architecture_before_components.md feedback_subagent_system_review.md feedback_no_smoke_and_mirrors.md feedback_enrichment_debt.md feedback_no_redundant_filters.md project_places_refactor.md project_unified_find.md project_taxonomy_v2.md project_lost_youth_design.md project_arts_portal_research.md project_groups_feature.md project_playwright_conversion.md project_forth_scoring_next.md reference_design_system.md reference_figma_mcp_capture.md; do [ -f "$f" ] && echo "OK: $f" || echo "MISSING: $f"; done`
Expected: All OK (no MISSING)

Run: `for f in docs/decisions/2026-02-21-feed-philosophy.md docs/decisions/2026-03-05-specials-are-venue-metadata.md docs/decisions/2026-03-05-specials-source-1177-cleanup.md docs/decisions/2026-03-08-cinematic-minimalism-design.md docs/decisions/2026-03-11-destination-inclusion-bar.md docs/decisions/2026-03-11-portal-ecosystem-strategy.md docs/decisions/2026-03-12-portal-naming-convention.md docs/decisions/2026-03-12-follows-to-friendships.md; do [ -f "$f" ] && echo "OK: $f" || echo "MISSING: $f"; done`
Expected: All OK (no MISSING)

- [ ] **Step 6: No git commit** (MEMORY.md is in .claude/ project memory, not the repo)

---

### Task 8: Verify the Complete System

**Files:** None (verification only)

- [ ] **Step 1: Verify MEMORY.md is under 100 lines**

Run: `wc -l /Users/coach/.claude/projects/-Users-coach-Projects-LostCity/memory/MEMORY.md`
Expected: Under 100

- [ ] **Step 2: Verify ADR files all exist with correct structure**

Run: `for f in docs/decisions/*.md; do echo "=== $f ==="; head -5 "$f"; echo; done`
Expected: Each file has a title line starting with `# ADR:` (or `# Architecture` for README)

- [ ] **Step 3: Verify web/CLAUDE.md has all gotcha sections**

Run: `grep -n "^### " web/CLAUDE.md | tail -10`
Expected: See "CSP + Next.js 16 Streaming", "TypeScript / Next.js 16 Build Gotchas", "Client-Side Filter Patterns", "Pencil MCP Property Names"

- [ ] **Step 4: Verify hooks are configured**

Run: `cat .claude/settings.local.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('hooks' in d and 'PostToolUse' in d['hooks'])"`
Expected: `True`

- [ ] **Step 5: Verify hook scripts are executable**

Run: `ls -la .claude/hooks/*.sh`
Expected: Both files have `x` permission

- [ ] **Step 6: Test tsc hook manually**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Either clean output or known errors (verifies the command works)

- [ ] **Step 7: Final commit if any fixups needed**

Only if verification revealed issues that needed fixing.

---

## Task Dependency Graph

```
Task 1 (ADR directory) ──┐
Task 2 (Feed ADR)   ─────┤
Task 3 (Specials ADR) ───┼──→ Task 7 (MEMORY.md restructure) ──→ Task 8 (Verify)
Task 4 (6 more ADRs) ────┤
Task 5 (web gotchas) ────┘
Task 6 (Hooks) ──────────────────────────────────────────────────→ Task 8 (Verify)
```

**Parallelizable:** Tasks 1-4 (all ADR work), Task 5 (web gotchas), Task 6 (hooks) are independent.
**Sequential:** Task 7 depends on Tasks 1-5. Task 8 depends on all.
