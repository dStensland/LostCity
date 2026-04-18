# LostCity

**Local discovery data infrastructure.** Four first-class entities — events, places, programs, exhibitions — feeding bespoke portals. The consumer product *is* the mission; the B2B platform funds it. Full brief: `.claude/north-star.md`.

---

## Reading Order (every session)

1. **This file** — auto-loaded.
2. **`.claude/north-star.md`** — mission, bets, decision filters, anti-patterns.
3. **`docs/quality-bar.md`** — the elite standards every output must clear.
4. **`docs/design-truth.md`** — product spirit, component registry, anti-pattern gallery. **Required for any UI task.**
5. **`.claude/agents/_shared-architecture-context.md`** — load-bearing architecture + transitional state.
6. **Subsystem CLAUDE.md** for the work domain: `web/CLAUDE.md`, `crawlers/CLAUDE.md`, `database/CLAUDE.md`.

---

## Design Quality (UI work)

- **Pencil comp → spec → code → verify.** No UI implementation without a Pencil comp node ID + extracted spec path (from `/design-handoff extract`) + motion spec reference. If a comp doesn't exist, design one first — prose specs produce SaaS-template slop (Live Tonight Plan 2 lesson).
- **Subagent dispatch for UI work must include** `docs/design-truth.md` reference + Pencil node ID + spec path in the prompt. A `PreToolUse` hook enforces this — it is not advisory.
- **`product-designer` verdict binds.** Plan and PR review return `VERDICT: BLOCK | PASS-WITH-NOTES | PASS`. Treat as gate, not opinion.
- **After every 2–3 UI features land**, consider running a cross-feature coherence check manually (formal `/coherence` skill is future work).

---

## Always-On Rules

- **No smoke and mirrors.** Data layer first; browser-verify every UI change; no hardcoded placeholders masking missing data. Details: `docs/quality-bar.md` § Data Layer, `web/CLAUDE.md` § Shipping Standards.
- **Portal attribution mandatory.** `sources.owner_portal_id NOT NULL`; events inherit `portal_id` via trigger. Cross-portal leakage = P0. Details: `AGENTS.md` § Non-Negotiable Rules.
- **First-pass crawler capture.** One visit extracts events, programs, recurring series, specials, hours, metadata. Enrichment scripts = crawler failure. Details: `crawlers/CLAUDE.md` § Core Philosophy.
- **Scope discipline.** Do what was asked. Don't gold-plate. Note adjacent issues separately. No planning-as-progress.

---

## Hard Constraints

- **Tiny Doors ATL opt-out** — never reference in descriptions, tracks, or content.
- **`places`, not `venues`** (renamed March 2026). Use `place_id`, `place_type`.
- **No new `content_kind='exhibit'`** — use `events.exhibition_id` FK.
- **Exhibitions are cross-vertical** — `exhibitions` table, not Arts-only.
- **No `mask-fade-x` on carousels** — obscures edge cards.

---

## Doc Map

| Concern | Source of truth |
|---|---|
| Mission, bets, decision filters | `.claude/north-star.md` |
| Hypotheses + principles | `STRATEGIC_PRINCIPLES.md` |
| Elite standards | `docs/quality-bar.md` |
| Design spirit, registry, anti-patterns | `docs/design-truth.md` |
| Architecture + transitional state | `.claude/agents/_shared-architecture-context.md` |
| Repo guidelines + non-negotiable rules | `AGENTS.md` |
| Active work status | `DEV_PLAN.md` |
| Parallel agent claims | `ACTIVE_WORK.md` |
| Subsystem rules | `{web,crawlers,database}/CLAUDE.md` |
| Decision records | `docs/decisions/` |
| In-flight plans | `docs/superpowers/plans/` |

---

**Status:** initial creation 2026-04-18. Minimal-viable version scoped to design quality enforcement. Broader consolidation (deduplicating cross-doc content, subdir CLAUDE.md trims, `/coherence` skill) deferred per `docs/superpowers/specs/2026-04-18-design-quality-operational-system.md` MVF scope. Revisit if rule architecture continues to fragment.
