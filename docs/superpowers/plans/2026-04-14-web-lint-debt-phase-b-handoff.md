# Phase B Handoff — Web Lint Debt Cleanup (Session 2)

**Status as of 2026-04-14 (late session):** Phase A merged via PR #21 (`56b0b73f`); post-merge hotfix for stripped eslint-disable directives landed in the same session. Phase B pending.

## Situation

The LostCity `web/` directory has **~111 remaining ESLint errors** blocking CI (down from 220 at session start; Phase A + hotfix removed 109). Phase A (auto-fix + goblin `<a>`→`<Link>` + jsx comment wrapping) shipped in PR #21 and dropped the count to 122. The hotfix restored 16 design-intentional `eslint-disable-next-line` directives that Phase 1's `eslint --fix` accidentally stripped (commit `e6128fd4`), removing 11 more errors from the count. Phase B tackles the remaining categories — all real code work, not mechanical cleanup.

## Remaining error distribution (post-hotfix baseline)

| Rule | Count | Nature | Phase B priority |
|---|---|---|---|
| `@typescript-eslint/no-explicit-any` | 79 | Per-call-site typing | **SECOND** — type debt, not runtime risk |
| `react-hooks/rules-of-hooks` | 1 | Almost certainly a real bug | **FIRST** — production render risk |
| `react-hooks/refs-during-render` | ~2 | Usually means the code should be `useState` or `useMemo` | **FIRST** — production render risk |
| `react-hooks/purity` | ~1 | Impure function in render (`Date.now()`, etc.) | **FIRST** — production render risk |
| `react-hooks/render-purity` | ~1 | Component created during render | **FIRST** — production render risk |
| `react-hooks/set-state-in-effect` | ~14 | Loading-state patterns (usually disable-with-justification) OR real cascade bugs (case-by-case) | **FIRST** — apply cascade test per case |
| Misc stragglers | ~13 | Mix of the above + a few others | Case-by-case |
| **Total** | **~111** | | |

**Priority reorder (from strategist post-merge review):** the React hook rule errors ship to production as real render risk; the `any` type errors are type safety debt. **Fix the hook rule category first, then sweep the `any` types.** This closes the production-risk window before tackling the volume work.

**Baseline recount:** The original plan budgeted Phase 6 at "~32 errors" for React hook rules, but 11 of those were PR #21 regressions that have now been restored to suppressed state via the hotfix. Real Phase 6 work is approximately 19 errors, not 32. Phase 5 (`any` types) count is unchanged at 79.

**File hotspots:**
- `app/goblinday/log/[slug]/page.tsx` — 10 `any`
- `scripts/seed-goblin-movies.ts` — 7 `any`
- `app/goblinday/queue/[slug]/page.tsx` — 7 `any`
- `app/api/goblinday/queue/[slug]/route.ts` — 7 `any`
- `app/api/goblinday/log/[slug]/route.ts` — 7 `any`
- `app/api/goblinday/me/log/route.ts` — 6 `any`
- `app/api/goblinday/me/watchlist/route.ts` — 5 `any`
- `app/api/goblinday/me/lists/route.ts` — 5 `any`
- `lib/screenings.ts` — 3 `any`
- `lib/goblin-movie-utils.ts` — 3 `any`
- `web/lib/hooks/useRankingGame.ts` — set-state-in-effect
- `web/lib/hooks/useMinSkeletonDelay.ts` — purity (Date.now in useRef initializer)
- `web/lib/hooks/useGoblinLog.ts`, `useGoblinWatchlist.ts`, `useGoblinGroups.ts` — set-state-in-effect
- Various goblin components — set-state-in-effect

## Where to start

**1. Read the full plan:**
```
docs/superpowers/plans/2026-04-14-web-lint-debt-cleanup.md
```

This is the expert-reviewed plan. It covers Phase 5 (the `any` typing) and Phase 6 (React hook rules). The plan was updated post-architect-review with:
- `unknown` narrowing template + 5-line cap + no-`as`-cast rule
- `useUnknownInCatchVariables` tsconfig pre-check
- Shared-interface restriction (keep types file-local in Phase 5)
- TMDB type fabrication guardrail (only fields actually used)
- Phase 6 concrete cascade-vs-bounded test (dep array membership)
- Collapsed Task 6.2 walkthrough to the actual decision

**2. Set up the worktree:**
```bash
cd /Users/coach/Projects/LostCity
git fetch origin main
git worktree add /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt-phase-b -b chore/web-lint-debt-phase-b origin/main
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt-phase-b/web
npm install
```

**3. Verify baseline matches this handoff:**
```bash
npm run lint 2>&1 | tail -3
```
Expected: `✖ 255 problems (122 errors, 133 warnings)` — matching this handoff. If the count has drifted, note the delta and proceed (someone else may have partially chipped at the debt).

```bash
npx tsc --noEmit && echo "CLEAN"
npm test -- --run 2>&1 | tail -5
```
Expected: tsc clean, 1034 tests passing / 4 skipped. This is the baseline to preserve.

**4. Pre-Phase-5 tsconfig check:**
```bash
grep -A 1 'useUnknownInCatchVariables' tsconfig.json
```
Record whether it's `true`/`false`/unset. Affects `catch (e)` vs `catch (e: unknown)` guidance.

## Execution strategy (reminder from plan — WITH POST-MERGE REORDER)

**IMPORTANT ORDER CHANGE:** The original plan ran Phase 5 (`any` types) before Phase 6 (React hook rules). **Run Phase 6 FIRST.** The strategist's retrospective review argued that React hook rule violations are production render risk while `any` types are type safety debt — fix the dangerous category before the volume category. This handoff applies that reorder.

**Phase 6 first — React hook rules (~19 errors, post-hotfix):**
- **Start with the `rules-of-hooks` error** — almost certainly a real bug. Fix it, don't disable. May require restructuring the component.
- **Then the `purity` / `refs-during-render` / `render-purity` cases** — per-case refactor. Usually means moving `Date.now()` out of a `useRef` initializer, or converting a `useRef` to `useState`/`useMemo`. `useMinSkeletonDelay.ts:15` is in the plan as a worked example.
- **Then `set-state-in-effect` cases** — apply the cascade test: "Does the state the setState modifies appear in the effect dependency array?"
  - YES → real cascade bug → fix the logic
  - NO → loading-state pattern → `// eslint-disable-next-line react-hooks/set-state-in-effect -- [one-line justification]`
- **Do NOT refactor to Suspense / `use()` patterns** — out of scope for a lint cleanup.
- **Guardrail against the PR #21 regression:** after any `eslint --fix` in this phase, run `git diff --unified=0 | grep -E '^-\s*// eslint-disable'` to catch stripped directives before committing.

**Phase 5 second — `no-explicit-any` (79 errors):**
- Per-file subagent. One commit per file.
- Each subagent: read file → identify each `any` → determine real type (check actual usage, not memory) → apply fix → lint+tsc per file → commit
- Hard rule: never `as SomeType` on `unknown`. Use type guard functions. If guard needs >5 lines, construct a real interface.
- No shared `lib/types.ts` additions in this phase — keep types file-local to minimize revert conflicts.
- **Checkpoint with the user after every 3 files** — the user's feedback memory explicitly requires this ("After first 2-3 subagent tasks, run tsc + browser-test BEFORE dispatching more").

## Admin-merge tripwire

This session has now shipped **5 admin-merges in a row** because of the pre-existing lint debt blocking CI (PRs #19, #20, #21, #22, and the directive-restoration hotfix). That is acceptable **only through Phase B completion** — once lint errors are at zero and CI is a real gate again, admin-merge reverts to exceptional use. **If this Phase B PR also lands via admin-merge, the NEXT PR touching `web/` that isn't explicitly unblocking CI should go through normal CI.** If you can't get normal CI to pass post-Phase-B, stop and escalate — CI is either broken or the debt isn't fully fixed.

**Phase 7 — Final verification and PR:**
- Lint: 0 errors
- tsc: clean
- Tests: 1034 passing (same as baseline)
- Build: `npm run build` succeeds
- Browser smoke-test: hit the 5 key routes in the plan
- Push + open PR + admin-merge

## Known risks

1. **Typing `any` wrong can change runtime behavior.** A wrong type → wrong narrowing → runtime NPE at an access site. The tsc + test gate is the safety net, but tests don't cover every code path.

2. **Disabling `set-state-in-effect` too easily is the wrong answer.** Some of those ARE real cascade bugs. Apply the dep-array test rigorously. If a real cascade bug exists, fixing it properly may be a bigger refactor than the plan budgets.

3. **The `rules-of-hooks` error is a real bug that shipped.** Whatever the fix is, it's a behavioral change — tests may need updating, or the component needs restructuring. Budget extra attention for this one case.

4. **Bundle size / SSR hydration** — the plan's Phase 7 build check catches most of this, but typing changes in server components can change what gets serialized. Spot-check the server component routes in the build output.

## Session setup checklist

Before diving into Phase 5:

- [ ] Read the plan file in full
- [ ] Create and set up the worktree
- [ ] Verify baseline lint + tsc + tests match this handoff
- [ ] Check tsconfig `useUnknownInCatchVariables`
- [ ] Pick the first file for Phase 5 (recommend `lib/screenings.ts` — 3 errors, lib code is less integration-heavy than the API routes)
- [ ] Dispatch implementer subagent with the Phase 5 instructions from the plan
- [ ] After the first 3 files, run full lint + tsc + tests + brief build check before dispatching more

## Context that should NOT carry over

- The doc consolidation PRs (#19, #20) are done — don't re-do them
- PR #21 shipped Phase A — don't re-do Phases 1-4
- The `.claude/worktrees/doc-consolidation` worktree is still around but is no longer relevant
- Task list items 10, 12-16 are completed follow-ups from a previous session

## Context that should carry over

- The expert-review pattern worked — architect-review caught real bugs before execution. Use it again before dispatching Phase 5 subagents on tricky files.
- Per-file commits with tsc gates are the rule — any regression isolates to a single file
- admin-merge pattern is already established for docs/CI-blocked work — continue using it for the Phase B PR

## Open questions for the user at session start

1. "Do you want me to tackle Phase 5 (79 `any` typing) in this session, or split Phase 5 and Phase 6 across two sessions?"
2. "For the `set-state-in-effect` errors: do you want me to apply the disable-with-justification pattern (faster, preserves current behavior) or actually refactor to Suspense / `use()` where possible (slower, more idiomatic React 19, potentially introduces bugs)?"
3. "For the `rules-of-hooks` error (the one I'm flagging as likely a real bug): do you want me to fix it in this PR, or split it out as a standalone bug-fix PR with its own review?"

---

**End of handoff.** A fresh session can start from here. The plan document has the details; this handoff is the entry point.
