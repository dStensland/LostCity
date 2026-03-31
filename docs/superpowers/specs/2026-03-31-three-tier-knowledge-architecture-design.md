# Three-Tier Knowledge Architecture

**Date:** 2026-03-31
**Status:** Approved

## Problem

The agent instruction system has three compounding failures:

1. **Quality consistency:** Agents ship broken TypeScript, violate portal attribution, and ignore patterns because all rules are advisory. Nothing enforces compliance at edit-time.
2. **Context efficiency:** MEMORY.md is 253 lines mixing universal working-style rules, feature build logs, domain-specific gotchas, and stale project status. Agents parse all of it every session but miss the 3 rules that matter for their task.
3. **Institutional learning:** Architectural decisions are flattened into MEMORY.md one-liners that lose the reasoning. Agents re-propose rejected ideas (specials in the feed, personalization, follows) because they see the decision but not the *why*.

## Solution

A three-tier knowledge system with deterministic enforcement hooks and lightweight decision records.

---

## Tier 1: Always-Loaded Constitution

**Files:** `MEMORY.md` (index), `.claude/north-star.md` (unchanged)

MEMORY.md becomes a routing index. Every entry is one line under 150 chars pointing to a topic file. Only universal, session-independent guidance stays inline.

### What stays inline in MEMORY.md (~70 lines total)

**Working Style block (~20 lines):**
- Strategic over technical
- Critical partner, not yes-machine
- Product smell test before building
- Bias toward building is a failure mode
- Agent cross-checking
- North star = dual mission (events + destinations + programs)
- Build cost recalibrated
- Production launches, not demos
- Architecture before components
- Subagent integration checkpoint (NEW: run tsc + browser-test after first 2-3 subagent tasks before dispatching more)
- No smoke and mirrors
- Scope discipline
- Planning-as-progress warning
- Challenge strategy docs proactively

**Project Structure (~5 lines):**
- Monorepo: web/ (Next.js 16), crawlers/ (Python)
- Supabase for DB; use `as never` for insert/update ops
- Pre-commit hooks run vitest + pytest
- Vercel deploys from main branch on push

**Hard Constraints (~3 lines):**
- Opt-out venues: Tiny Doors ATL — never reference in descriptions, tracks, or content
- Enrichment scripts are crawler failures — fix the crawler instead
- No redundant filter shortcuts — don't duplicate filter options as standalone buttons

**Index entries (~40 lines):**
One-line pointers to decision records, topic memory files, and external references. Format: `- [Title](path) — one-line hook`

### What gets removed from MEMORY.md

| Content | Destination |
|---|---|
| Tailwind v4 typography gotcha | `web/CLAUDE.md` Known Gotchas |
| TypeScript build issues | `web/CLAUDE.md` Known Gotchas |
| CSP + Next.js streaming | `web/CLAUDE.md` Known Gotchas |
| Regulars tab patterns | `web/CLAUDE.md` Known Gotchas |
| Pencil property gotchas | `web/CLAUDE.md` Known Gotchas |
| Client/server module split | Already in `web/CLAUDE.md`, remove duplicate |
| Feed philosophy | `docs/decisions/2026-02-21-feed-philosophy.md` |
| Specials = venue metadata | `docs/decisions/2026-03-05-specials-are-venue-metadata.md` |
| Portal naming convention | `docs/decisions/2026-03-12-portal-naming-convention.md` |
| Follows → friendships | `docs/decisions/2026-03-12-follows-to-friendships.md` |
| Destination inclusion bar | `docs/decisions/2026-03-11-destination-inclusion-bar.md` |
| Portal ecosystem strategy | `docs/decisions/2026-03-11-portal-ecosystem-strategy.md` |
| Cinematic minimalism design | `docs/decisions/2026-03-08-cinematic-minimalism-design.md` |
| Source 1177 cleanup | `docs/decisions/2026-03-05-specials-source-1177-cleanup.md` |
| Nightlife + Explore details | Archived (code is source of truth) |
| HelpATL CSS details | Archived (code is source of truth) |
| Hangs + Profiles implementation | Archived (topic file stays as cold reference) |
| Editorial Mentions implementation | Archived (topic file stays as cold reference) |
| Explore City Tracks details | Archived (code is source of truth) |
| Portal Data Isolation details | Archived (rule preserved as ADR index entry) |
| Hooky data buildout log | Archived (topic file stays as cold reference) |
| Dev Plan summary | Removed (stale snapshot — DEV_PLAN.md is authoritative) |
| Elevate workflow | Removed (skill definition is authoritative) |
| Platform Header | Archived (code is source of truth) |
| Design System reference | Kept as index entry pointing to topic file |
| Figma MCP reference | Kept as index entry pointing to topic file |
| Key Patterns block | Removed (duplicates web/CLAUDE.md) |

---

## Tier 2: Domain-Embedded Knowledge

**Files:** `web/CLAUDE.md`, `crawlers/CLAUDE.md`, `database/CLAUDE.md`

Gotchas and patterns live where agents encounter them. An agent editing web/ components gets the Tailwind v4 warning automatically.

### web/CLAUDE.md additions

New section appended: "Known Gotchas"

```markdown
## Known Gotchas

### Tailwind v4 Typography
- `text-[var(--text-*)]` generates `color:` not `font-size:` — NEVER use arbitrary value syntax for font sizes
- Use clean classes: text-2xs, text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl
- `text-2xs` is custom (@utility in globals.css). Standard sizes overridden via @theme inline.
- `@theme inline` namespace: `--text-*` is correct for font-size overrides. `--font-size-*` does NOT work.
- `@theme inline` cannot create new utilities — only override existing ones. Only `@utility` works for new sizes.

### TypeScript / Next.js 16
- Supabase `.maybeSingle()` infers as `never` after null checks → cast with `as { field: type }`
- `SupabaseClient` cast needs double-cast: `as unknown as SupabaseClient<Schema>`
- `PostgrestError` is not `LogContext` — wrap: `{ error: pgError.message }`
- `headers()` returns `Promise<ReadonlyHeaders>` — must be awaited
- `RemotePattern.protocol` needs `as const` literal type
- `AnimationEffect.setKeyframes` — cast to `KeyframeEffect` first
- Re-exports aren't local: `export { X } from "./mod"` doesn't make X available in current file
- Always run `npx tsc --noEmit` before pushing

### CSP + Next.js Streaming
- Next.js 16 streaming scripts ($RC, $RS, __next_f.push) have NO nonce attribute
- If CSP script-src uses a nonce, streaming breaks — entire site renders blank
- Fix: Use `unsafe-inline` for script-src, keep nonces for style-src only
- CSP file: `web/lib/csp.ts` — script-src line must NOT include nonce

### Client-Side Filter Patterns
- Never use `router.push()` for filter state — use useState + window.history.replaceState()
- router.push() triggers full Next.js navigation cycle through Suspense
- `days_of_week`: DB stores ISO 8601 (1=Mon, 7=Sun). JS getDay() returns 0=Sun. Convert with jsToIsoDay().
- Day badge counts must reflect active activity filter
- Active filter chips must remain visible even at 0 count (so users can clear them)

### Pencil Property Names
- Text color = `fill` (string), NOT `fills` (array)
- Frame background = `fill` (string), NOT `fills`
- Stroke = `{fill, thickness}`, NOT `{color, width}`
- Layout = `layout: "vertical"`, NOT `layoutMode`
- Padding = array `[top, right, bottom, left]` or `[vertical, horizontal]` or single number
- Clip = `clip: true`, NOT `clipsContent`
```

### crawlers/CLAUDE.md — No changes needed

Already comprehensive with first-pass rules, capture-everything philosophy, and validation checklist. MEMORY.md entries about crawler patterns were duplicates.

### database/CLAUDE.md — No changes needed

Already has three-file migration requirement, parity audit, and portal attribution rules.

---

## Tier 3: Cold Memory (Retrieved on Demand)

**Location:** `/Users/coach/.claude/projects/-Users-coach-Projects-LostCity/memory/`

Existing topic files remain as cold reference:
- `project_places_refactor.md`
- `project_unified_find.md`
- `project_lost_youth_design.md`
- `project_arts_portal_research.md`
- `project_groups_feature.md`
- `project_taxonomy_v2.md`
- `project_playwright_conversion.md`
- `project_forth_scoring_next.md`
- `reference_design_system.md`
- `reference_figma_mcp_capture.md`
- Various feedback files (already well-structured)

These are loaded into context only when MEMORY.md index entries trigger retrieval. They are NOT loaded every session.

---

## Deterministic Enforcement: Hooks

Added to `.claude/settings.local.json`:

### Hook 1: TypeScript check after web file edits

**Trigger:** PostToolUse on Edit or Write when file matches `web/**/*.ts` or `web/**/*.tsx`
**Action:** `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`
**Purpose:** Catch type errors at edit-time so agents self-correct in-session. This is the #1 documented pain point.

### Hook 2: ESLint after web file edits

**Trigger:** PostToolUse on Edit or Write when file matches `web/**/*.ts` or `web/**/*.tsx`
**Action:** `cd web && npx eslint --fix --quiet <file> 2>&1 | head -10`
**Purpose:** Catch lint violations at edit-time. Combined with Hook 1, every web edit gets immediate type + lint feedback.

### Hook 3: Migration three-file reminder

**Trigger:** PostToolUse on Edit or Write when file matches `database/migrations/**` or `supabase/migrations/**`
**Action:** Script that checks whether matching files exist in both migration directories and whether `database/schema.sql` was recently modified.
**Purpose:** Advisory reminder (not a hard block) to maintain migration parity.

### Hooks NOT added (and why)

- **Prettier:** ESLint `--fix` covers formatting. Redundant.
- **PreToolUse migration block:** Too aggressive. Agents create migrations legitimately.
- **Python ruff/pytest:** Pre-commit hook already catches these. Not worth per-edit overhead.
- **PostToolUse on Bash:** Too noisy. File edits only.

---

## Decision Records

**Location:** `docs/decisions/`

### Template

```markdown
# ADR: [Title]

**Date:** YYYY-MM-DD
**Status:** Accepted | Deprecated | Superseded by [link]

## Context
[1-3 sentences: what forced this decision]

## Decision
[1 sentence: what we decided]

## Consequences
- [what gets easier]
- [what gets harder]
- [what constraints this creates]

## Supersedes
[link to older decision, or "None"]
```

### Initial ADRs (migrated from MEMORY.md)

| File | Decision | Key reasoning preserved |
|---|---|---|
| `2026-02-21-feed-philosophy.md` | Feed is access layer, not recommendation engine | Prevents personalization proposals; scoring influences order, never exclusion |
| `2026-03-05-specials-are-venue-metadata.md` | Specials are venue attributes, not feed items | Failed product smell test; data too thin for discovery |
| `2026-03-12-portal-naming-convention.md` | "Lost ___" pattern for first-party portals | Brand architecture; mercurial identity (each portal looks completely different) |
| `2026-03-12-follows-to-friendships.md` | Mutual friendships as social primitive | Follows deprioritized; get_friend_ids() gates all social features |
| `2026-03-11-destination-inclusion-bar.md` | Include any place people would plan to go | Not a tourism/uniqueness lens; chains and entertainment centers included |
| `2026-03-11-portal-ecosystem-strategy.md` | Content pillars produce entities, distribution portals consume | Two-sided content factories; niche stays in portal, general-interest federates |
| `2026-03-08-cinematic-minimalism-design.md` | Solid surfaces + atmospheric glow, no glass | Evolved past glassmorphism; anti-patterns: neo-brutalism, Liquid Glass |
| `2026-03-05-specials-source-1177-cleanup.md` | Source 1177 migrated to venue_specials table | 207 food/drink events → 12 specials + 34 real events; prevents re-ingestion |

---

## Subagent Integration Checkpoint

Not a new tool or agent. A documented workflow rule added to MEMORY.md working style:

**Rule:** After the first 2-3 subagent tasks return in a parallel dispatch, the coordinator must:
1. Run `npx tsc --noEmit` — do the parts type-check together?
2. Browser-test the first integrated feature — does it actually render?
3. Quick check: does data flow end-to-end (API shape matches what consumers expect)?

If the checkpoint fails, fix integration issues before dispatching remaining tasks. This prevents the cascade where all agents build on a broken assumption.

**Rationale:** Documented in `feedback_subagent_system_review.md` — subagent-driven dev produces correct parts that fail together. The fix is verification at the first integration point, not the last.

---

## Files Changed

```
Modified:
  .claude/settings.local.json                              — 3 hooks added
  /Users/coach/.claude/.../memory/MEMORY.md                — restructured to ~70 lines
  web/CLAUDE.md                                            — Known Gotchas section appended

Created:
  docs/decisions/2026-02-21-feed-philosophy.md
  docs/decisions/2026-03-05-specials-are-venue-metadata.md
  docs/decisions/2026-03-12-portal-naming-convention.md
  docs/decisions/2026-03-12-follows-to-friendships.md
  docs/decisions/2026-03-11-destination-inclusion-bar.md
  docs/decisions/2026-03-11-portal-ecosystem-strategy.md
  docs/decisions/2026-03-08-cinematic-minimalism-design.md
  docs/decisions/2026-03-05-specials-source-1177-cleanup.md

Not changed:
  .claude/north-star.md                                    — already correct shape
  crawlers/CLAUDE.md                                       — already comprehensive
  database/CLAUDE.md                                       — already has migration rules
  Agent definitions                                        — already solid
  Superpowers skills                                       — integration checkpoint is a MEMORY.md rule
```

## Success Criteria

1. MEMORY.md is under 100 lines and loads in <2 seconds of LLM processing
2. An agent editing web/ files sees Tailwind and TypeScript gotchas without parsing MEMORY.md
3. TypeScript errors are caught at edit-time via hooks, not at deploy-time
4. An agent proposing "personalization in the feed" encounters the feed philosophy ADR with full reasoning
5. After first 2-3 subagent tasks, integration is verified before remaining tasks dispatch
