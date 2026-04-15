# Web Lint Debt Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive `npm run lint` to zero errors in `web/`, unblocking CI for all future PRs. **220 errors, 153 warnings** as of 2026-04-14 on main. Warnings out of scope — only errors get fixed in this pass.

**Architecture:** Phased execution ordered by risk (low → high). Each phase has its own verification gate (lint scoped to the touched files, then full lint, then tsc, then tests). Per-file subagent granularity for mechanical phases; per-error careful analysis for the React hook phase. One branch, phased commits, admin-merge at the end.

**Tech Stack:** TypeScript, Next.js 16, React 19, ESLint with @typescript-eslint and @next/next rulesets, Vitest.

---

## Scope — What's Getting Fixed

**Error distribution** (as of 2026-04-14, main at `df4bc766`):

| Rule | Count | Phase | Risk |
|---|---|---|---|
| `@next/next/no-html-link-for-pages` | 82 | 2 | Low — mechanical `<a>` → `<Link>` in 3 goblin files |
| `@typescript-eslint/no-explicit-any` | 79 | 5 | Medium — per-call-site typing |
| `react-hooks/set-state-in-effect` | ~25 | 6 | High — may be real bugs |
| `react/jsx-no-comment-textnodes` | 15 | 4 | Low — move comments out of JSX |
| `prefer-const` | 12 | 3 | Low — mechanical |
| `react-hooks/refs-during-render` | ~2 | 6 | High |
| `react-hooks/purity` | ~1 | 6 | High |
| `react-hooks/render-purity` | ~1 | 6 | High |
| `react-hooks/rules-of-hooks` | 1 | 6 | High — real bug |
| Misc | ~2 | 6 | Case-by-case |
| **Total** | **220** | | |

**File hotspots:**
- `components/goblin/GoblinDayPage.tsx` — 28 `no-html-link-for-pages` errors
- `app/goblinday/queue/[slug]/GoblinQueuePublicView.tsx` — 27 `no-html-link-for-pages`
- `app/goblinday/log/[slug]/GoblinLogPublicView.tsx` — 27 `no-html-link-for-pages`
- `app/goblinday/log/[slug]/page.tsx` — 10 `no-explicit-any`
- `scripts/seed-goblin-movies.ts` — 7 `no-explicit-any`
- `app/goblinday/queue/[slug]/page.tsx` — 7 `no-explicit-any`
- `app/api/goblinday/queue/[slug]/route.ts` — 7 `no-explicit-any`
- `app/api/goblinday/log/[slug]/route.ts` — 7 `no-explicit-any`

**The goblin feature is where most of the debt lives.** 82 `<a>` errors + 40+ `any` errors = 122 of 220 (55%) in the goblin subtree alone. Phase 2 + a chunk of Phase 5 will tackle this concentrated cluster.

---

## Ground Rules

**What to fix vs. what to `// eslint-disable-next-line`:**

1. **Fix if mechanical.** `prefer-const`, `no-html-link-for-pages`, `jsx-no-comment-textnodes` — always fix, never disable.
2. **Fix `any` with real types** when the type is locally derivable (function signature, response parser, etc.). If the underlying library returns `any` and you can't find a real type, use `unknown` with a cast at the usage site — NOT `any`. Never use `// @ts-expect-error` or `// eslint-disable` for these.
3. **React hook rule errors need per-case analysis.** Some are real bugs (`setState` cascading renders causing loops); some are false positives (the loading-state pattern where `setState` in effect is the right answer). For each: read the component, decide fix vs. disable-with-justification-comment. If disabling, the comment must explain *why* the rule is wrong for this case, in one sentence.

**Zero tolerance for:**
- `// eslint-disable` without a justification comment
- Blanket `any` → `unknown` sed passes that change runtime semantics
- Deleting tests or `.test.ts` files to make lint pass
- `// @ts-nocheck` at file level

**Branch and commit strategy:**
- One branch: `chore/web-lint-debt-cleanup`
- Worktree at `.claude/worktrees/web-lint-debt`
- Phased commits (one per phase, or per-file within Phase 5/6 if subagent granularity warrants it)
- Expected commit count: 10-20 commits
- Squash-merge at the end (clean main history)

**Per-phase verification gate:**
After each phase, run:
```bash
cd web && npm run lint 2>&1 | grep -c 'error' && npx tsc --noEmit && npm test -- --run
```
If any step regresses, stop and diagnose before continuing.

**Rollback criteria:**
- If `npx tsc --noEmit` fails after a phase, revert the phase's commits before continuing
- If `npm test` fails after Phase 5 or 6, isolate the broken file and revert just that file
- If a React hook fix causes a runtime regression (caught by tests OR browser smoke-test), revert and add `// eslint-disable-next-line` with justification instead

---

## Pre-Work: Worktree Setup

- [ ] **Step 1: Create the worktree**

From the main working tree:
```bash
cd /Users/coach/Projects/LostCity
git worktree add /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt -b chore/web-lint-debt-cleanup main
```

Expected: new worktree created on a new branch from `main`.

- [ ] **Step 2: Verify baseline lint state**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npm run lint 2>&1 | tail -3
```

Expected: `✖ 373 problems (220 errors, 153 warnings)` (or similar; the counts may have drifted slightly).

Record the exact baseline count in the Phase 7 verification step for comparison.

- [ ] **Step 3: Verify baseline tsc and tests**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npx tsc --noEmit 2>&1 | tail -5
npm test -- --run 2>&1 | tail -10
```

Expected:
- tsc: clean (0 errors) — this is critical; we're measuring "does the codebase currently typecheck?"
- tests: some may fail pre-existing. **Record which tests fail at baseline.** A test that fails at baseline and still fails after our work is NOT a regression. A test that passes at baseline but fails after our work IS a regression.

---

## Phase 1: Auto-Fix Sweep

**Goal:** Fix everything ESLint can fix itself, get the quick wins out of the way.

### Task 1.1: Run `--fix` on the whole project

**Files:** potentially many (`web/**/*.{ts,tsx,mjs}`)

- [ ] **Step 1: Run eslint with --fix**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npx eslint --fix .
```

Expected: ESLint applies fixes to the 12 errors and 20 warnings it knows how to auto-fix. Exit code may still be 1 (remaining errors).

- [ ] **Step 2: See what changed**

```bash
git status --short
git diff --stat
```

Record the files touched. Expected: a mix of `prefer-const` auto-fixes, unused imports removed, and some other mechanical fixes.

- [ ] **Step 3: Re-run lint to see new count**

```bash
npm run lint 2>&1 | tail -3
```

Expected: error count drops by ~12 (from 220 to ~208) and warning count drops by ~20 (from 153 to ~133).

- [ ] **Step 4: Verify tsc still passes**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean. If tsc regresses, one of the auto-fixes introduced a type error — revert with `git checkout -- .` and STOP. Report the failure before proceeding.

- [ ] **Step 5: Verify tests still pass**

```bash
npm test -- --run 2>&1 | tail -10
```

Expected: same failure set as baseline. No new failures.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(lint): auto-fix sweep — prefer-const and mechanical fixes

Phase 1 of web lint debt cleanup. Ran `npx eslint --fix .` to apply the
auto-fixable subset of the 220 errors currently on main. Expected drop:
~12 errors + ~20 warnings.

No manual edits. Verified tsc clean and tests unchanged from baseline.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Goblin `<a>` → `<Link>` Conversion (82 errors, 3 files)

**Goal:** Convert all `<a href>` pointing to internal `/goblinday/*` routes to `<Link>` from `next/link` in the three hotspot files.

**Context:** The `@next/next/no-html-link-for-pages` rule requires using Next.js `<Link>` component for internal navigation, so prefetching and client-side routing work. External URLs (`http://`, `https://`) should stay as `<a>`. External rel attributes stay unchanged. 82 errors, concentrated in 3 files: `GoblinDayPage.tsx` (28), `GoblinQueuePublicView.tsx` (27), `GoblinLogPublicView.tsx` (27).

### Task 2.1: Fix `components/goblin/GoblinDayPage.tsx`

**Files:**
- Modify: `web/components/goblin/GoblinDayPage.tsx`

- [ ] **Step 1: Read the file to understand the `<a>` usage patterns**

Read `/Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web/components/goblin/GoblinDayPage.tsx` in full.

- [ ] **Step 2: Identify each `<a href="/goblinday/...">` occurrence**

Run:
```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
grep -n '<a href="/goblinday' components/goblin/GoblinDayPage.tsx
```

Record each line with its href target. Expected: ~28 matches.

- [ ] **Step 3: Add the `Link` import if not present**

Find the existing imports at the top of the file. Add (or merge into an existing line):
```typescript
import Link from "next/link";
```

If `Link` is already imported, skip this step.

- [ ] **Step 4: Convert each `<a href="/goblinday/...">` to `<Link href="/goblinday/...">`**

**Rules for the conversion:**
- `<a href="/goblinday/foo" className="...">text</a>` → `<Link href="/goblinday/foo" className="...">text</Link>`
- Preserve className, style, aria-*, data-*, id attributes verbatim
- Preserve children (text, JSX, components) verbatim
- Closing tag: `</a>` → `</Link>`
- **Do NOT change** `<a href="https://...">` (external links — keep as `<a>`)
- **Do NOT change** `<a href="mailto:...">`, `<a href="tel:...">` (non-navigation)
- **Do NOT change** `<a href="#..."`> or `<a href="">` (hash-only / empty — these are not actually internal nav and the rule doesn't flag them, but a careless regex might pick them up; verify the rule is active on each line before converting)
- **Do NOT add** `target="_blank"` or `rel="noopener"` — those are for external, we're touching internal
- **Do NOT add** `prefetch={false}` unless the existing code already disables prefetch — default is fine

**Cases that require STOP-and-ASK-for-review (do NOT auto-convert):**
- `<a>` with an `onClick` handler — especially ones that call `e.preventDefault()` followed by manual navigation (`router.push`, `window.location = ...`). These patterns break client-side routing silently if converted to `<Link>`. **Flag for manual review.** If you find one, leave it alone and record it in the Phase 2 report for the controller to decide.
- `<a>` inside `dangerouslySetInnerHTML` content — that's raw HTML, not JSX. Skip.
- `<a>` with `target="_blank"` or `download` attributes — `<Link>` supports these but the semantic is different; preserve as `<a>` unless you're sure.

Use `Edit` tool with `replace_all=false` for each conversion. If you find a pattern that repeats identically across multiple places, you can use `replace_all=true` for that specific exact match.

- [ ] **Step 5: Verify the conversion for this file**

```bash
npx eslint components/goblin/GoblinDayPage.tsx 2>&1 | grep -c 'no-html-link-for-pages'
```

Expected: `0`. If non-zero, find the missed cases and fix them.

- [ ] **Step 6: Verify tsc on the touched file**

```bash
npx tsc --noEmit 2>&1 | grep 'GoblinDayPage'
```

Expected: no output. If there are type errors, the most likely cause is a missing `import Link from "next/link"` or an attribute that `<Link>` doesn't accept. Investigate and fix.

- [ ] **Step 7: Commit**

```bash
git add components/goblin/GoblinDayPage.tsx
git commit -m "$(cat <<'EOF'
fix(lint): convert <a> to <Link> in GoblinDayPage — no-html-link-for-pages

Phase 2 of web lint debt cleanup. 28 internal /goblinday/* navigation
links converted from <a> to Next.js <Link> for client-side routing and
prefetching. External links (https://), mailto:, and tel: preserved as <a>.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.2: Fix `app/goblinday/queue/[slug]/GoblinQueuePublicView.tsx`

**Files:**
- Modify: `web/app/goblinday/queue/[slug]/GoblinQueuePublicView.tsx`

Apply the same 7 steps as Task 2.1, substituting the file path. 27 conversions expected. Commit message: `fix(lint): convert <a> to <Link> in GoblinQueuePublicView — no-html-link-for-pages`.

### Task 2.3: Fix `app/goblinday/log/[slug]/GoblinLogPublicView.tsx`

**Files:**
- Modify: `web/app/goblinday/log/[slug]/GoblinLogPublicView.tsx`

Apply the same 7 steps as Task 2.1, substituting the file path. 27 conversions expected. Commit message: `fix(lint): convert <a> to <Link> in GoblinLogPublicView — no-html-link-for-pages`.

### Task 2.4: Phase 2 verification gate

- [ ] **Step 1: Verify no `no-html-link-for-pages` errors remain anywhere**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npm run lint 2>&1 | grep -c 'no-html-link-for-pages'
```

Expected: `0`.

- [ ] **Step 2: Verify error count dropped by 82**

```bash
npm run lint 2>&1 | tail -3
```

Expected: ~126 errors remaining (208 - 82 = 126).

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 4: Verify tests**

```bash
npm test -- --run 2>&1 | tail -10
```

Expected: same failure set as baseline.

- [ ] **Step 5: Completeness grep — zero remaining `<a href="/goblinday`**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
grep -rn '<a href="/goblinday' components/goblin/ app/goblinday/ 2>&1
```

Expected: **zero matches.** If any remain, they're either legit internal links that were missed OR the STOP-and-ASK cases (onClick handlers etc.) that were flagged for review. Either way, they need human attention before Phase 2 is complete.

- [ ] **Step 6: Build + bundle-size sanity check**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npm run build 2>&1 | tail -40
```

Expected: build succeeds. Visual inspection of the output:
- Look for the goblin routes (`/goblinday/log/[slug]`, `/goblinday/queue/[slug]`) in the route table
- Note the First Load JS size for each goblin route
- **Record these numbers in the Phase 2 report** — if Phase 6 or Phase 7 shows a huge jump, we'll know Phase 2 was responsible
- If the build fails, it's most likely a missing `import Link from "next/link"` or a `<Link>` attribute that the JSX type system doesn't accept. Fix and retry.

- [ ] **Step 7: Browser smoke-test — visit each converted file's rendered output**

Start the dev server:
```bash
npm run dev &
```

Visit:
- `http://localhost:3000/atlanta/goblinday` (or wherever GoblinDayPage renders) — click several different link types (menu nav, entry links, footer links) to confirm client-side routing
- `http://localhost:3000/atlanta/goblinday/queue/<any-slug>` — click several links
- `http://localhost:3000/atlanta/goblinday/log/<any-slug>` — click several links

Check browser devtools console for errors on each page. Note any hydration warnings.

If any navigation breaks, the link is the broken case — inspect, fix.

Stop the dev server: `kill %1`

---

## Phase 3: `prefer-const` Remainders

**Goal:** Fix any `prefer-const` errors that the Phase 1 auto-fix didn't catch.

### Task 3.1: Find and fix remaining `prefer-const`

- [ ] **Step 1: List remaining `prefer-const` errors**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npm run lint 2>&1 | grep 'prefer-const' | head -20
```

Expected: possibly 0 (Phase 1 should have caught them all). If non-zero, list the files.

- [ ] **Step 2: For each remaining error, read the file and fix**

For each `file.ts:line  error  'foo' is never reassigned. Use 'const' instead`:
- Read the file
- Verify the variable is genuinely never reassigned (not even by `foo.push(...)`, which is fine with `const`)
- Change `let foo =` to `const foo =`

- [ ] **Step 3: Verify**

```bash
npm run lint 2>&1 | grep -c 'prefer-const'
```

Expected: `0`.

- [ ] **Step 4: tsc check**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 5: Commit (skip if nothing to fix)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(lint): prefer-const remainders

Phase 3 of web lint debt cleanup. Manual fixes for prefer-const errors
the auto-fixer didn't catch.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If there's nothing to commit (Phase 1 caught them all), skip to Phase 4 and note in the Phase 7 report that Phase 3 was empty.

---

## Phase 4: `jsx-no-comment-textnodes` (15 errors)

**Goal:** Fix comment-like text in JSX. The rule catches things like:
```jsx
<div>
  // This looks like a comment but it's a text node
  hello
</div>
```
Which renders as literal text "// This looks like a comment but it's a text node hello".

### Task 4.1: Find and fix all `jsx-no-comment-textnodes`

- [ ] **Step 1: List all errors**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npm run lint 2>&1 | grep -B2 'jsx-no-comment-textnodes' | grep '^/' | sort -u
```

Record the files. Expected: ~5-15 files.

- [ ] **Step 2: For each file, read it and find the comment-like text**

For each flagged file and line, the fix is one of:
- **If it was meant to be a comment:** wrap in JSX comment syntax — `{/* ... */}`
- **If it was meant to be text:** escape or reword so it doesn't start with `//` — e.g., change `// optional` to `(optional)` or `{"// optional"}`
- **If it was meant to be HTML comment in JSX:** JSX doesn't support `<!-- -->` — use `{/* */}` instead

- [ ] **Step 3: Per-file fix, verify, commit**

For each file:
```bash
npx eslint <file> 2>&1 | grep 'jsx-no-comment-textnodes'
```
Expected: 0 after fix.

- [ ] **Step 4: Verify whole project**

```bash
npm run lint 2>&1 | grep -c 'jsx-no-comment-textnodes'
```

Expected: `0`.

- [ ] **Step 5: tsc + tests**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm test -- --run 2>&1 | tail -10
```

Expected: clean tsc, same failure set as baseline.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(lint): jsx-no-comment-textnodes — move JSX comments outside text nodes

Phase 4 of web lint debt cleanup. 15 errors where // or /* text appeared
as a JSX text node (rendering as literal text instead of a comment).
Converted to JSX comment syntax {/* */} or reworded to non-comment-like
prose.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: `@typescript-eslint/no-explicit-any` (79 errors)

**Goal:** Replace every `any` with a real type (or `unknown` + narrow at usage).

**This is the most time-consuming phase.** 79 errors across ~15 files, each requiring the subagent to read the function, understand what's being typed, and find or construct the real type. **Per-file subagent granularity.**

### Strategy per file

**Before starting Phase 5, check the tsconfig once:**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
grep -A 1 'useUnknownInCatchVariables' tsconfig.json
```

If `useUnknownInCatchVariables: true` → `catch (e)` and `catch (e: unknown)` are equivalent; prefer the shorter form.
If `useUnknownInCatchVariables: false` or not set → removing `: any` from `catch (e: any)` will implicitly type `e` as `any`, which still lints. Must write `catch (e: unknown)` explicitly.

**Rules for shared interfaces:**
- Do NOT introduce shared interfaces in `lib/types.ts` or similar during Phase 5. Keep all type definitions FILE-LOCAL.
- If a type is needed across files, leave it duplicated for now and note it as a Phase 5 follow-up. Shared interfaces in this pass create revert-conflict risk if one consumer's file has to be rolled back.

**Hard rule on `unknown`:**
- `unknown` is allowed as a fallback for truly external, unknowable data (e.g., `JSON.parse()` without a schema, an arbitrary plugin hook return).
- **NEVER `const x = someUnknown as SomeType;`** — that defeats the purpose entirely. Use a type guard function instead:
  ```typescript
  function isTmdbMovie(v: unknown): v is TmdbMovie {
    return typeof v === 'object' && v !== null && 'id' in v && 'title' in v;
  }
  // Usage:
  const data: unknown = await res.json();
  if (!isTmdbMovie(data)) throw new Error('Unexpected TMDB response shape');
  // data is now narrowed to TmdbMovie
  ```
- **HARD CAP:** if narrowing an `unknown` requires more than 5 lines of guard code, STOP and construct a proper local interface instead. The `unknown` → guard → narrow pattern is for truly dynamic data, not for "I don't want to write an interface."

**For each file with `any` errors:**

1. Read the file in full
2. For each `any`, determine what the value actually is:
   - Response from a known library (Supabase, fetch, TMDB API) → find/construct the real type. For TMDB specifically: **only include fields that are actually accessed in this file.** Verify each field name by reading the code that uses the result. Do NOT include fields from memory — TMDB types are hallucination-prone.
   - Internal data structure → define an interface at the top of the file (file-local, per the rule above)
   - Truly unknown external data → `unknown` + type guard function (per the template above, within the 5-line cap)
   - Error handler catch → match the tsconfig discovery from the pre-phase check
3. Apply the fix
4. Re-run ESLint on the file — expect 0 `no-explicit-any` errors
5. Run `tsc --noEmit` — **this is the critical gate.** Wrong typing = tsc failure. Revert the file and retry with a different approach if tsc fails.

### Task 5.1: `scripts/seed-goblin-movies.ts` (7 errors)

**Files:**
- Modify: `web/scripts/seed-goblin-movies.ts`

This is a seed script. The `any` errors are at lines 97, 101, 107, 117, 121, 127 (7 errors). Likely involve TMDB API response parsing or Supabase return values.

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Examine each `any` occurrence**

```bash
npx eslint scripts/seed-goblin-movies.ts 2>&1 | grep 'no-explicit-any'
```

- [ ] **Step 3: For each occurrence, determine the real type**

The fix strategy depends on the context:
- **TMDB API response:** TMDB has a known schema. Import or define types like `TmdbMovieSearchResult`, `TmdbMovieDetail`. If no type exists, define `interface TmdbMovieSearchResult { id: number; title: string; ... }` at the top of the file with only the fields actually used.
- **Supabase insert/update return:** Use `as never` (the project's existing pattern from `web/CLAUDE.md`) — this is not `any`, it's a required workaround for Supabase's strict types.
- **Untyped function parameter:** type as the parameter's actual shape based on how it's used in the function body.

- [ ] **Step 4: Apply fixes, verify**

```bash
npx eslint scripts/seed-goblin-movies.ts 2>&1 | grep -c 'no-explicit-any'
npx tsc --noEmit 2>&1 | grep 'seed-goblin-movies'
```

Both expected: `0` / no output.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-goblin-movies.ts
git commit -m "fix(lint): type TMDB and seed script responses in seed-goblin-movies.ts"
```

### Tasks 5.2 – 5.N: Remaining `no-explicit-any` files

Apply the same per-file pattern (read → identify each `any` → type it → verify → commit) to each remaining file. **One commit per file** for Phase 5 so that any regression is isolated.

**Files to process** (from highest error count to lowest):

- `app/goblinday/log/[slug]/page.tsx` — 10 errors
- `app/goblinday/queue/[slug]/page.tsx` — 7 errors
- `app/api/goblinday/queue/[slug]/route.ts` — 7 errors
- `app/api/goblinday/log/[slug]/route.ts` — 7 errors
- `app/api/goblinday/me/log/route.ts` — 6 errors
- `app/api/goblinday/me/watchlist/route.ts` — 5 errors
- `app/api/goblinday/me/lists/route.ts` — 5 errors
- `lib/screenings.ts` — 3 errors (lines 284, 315, 331)
- `lib/goblin-movie-utils.ts` — 3 errors
- Plus the long tail: any remaining files with 1-2 `no-explicit-any` errors

**For each file, dispatch a fresh subagent** with the file path, error line numbers, and the Phase 5 strategy above. The subagent reads the file, determines correct types, applies fixes, verifies, and commits.

### Task 5.N+1: Phase 5 verification gate

- [ ] **Step 1: Verify zero `no-explicit-any` errors**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npm run lint 2>&1 | grep -c 'no-explicit-any'
```

Expected: `0`.

- [ ] **Step 2: tsc**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 3: Full test run**

```bash
npm test -- --run 2>&1 | tail -10
```

Expected: same failure set as baseline. If any new failure, identify the file, investigate, likely a mis-typing — either fix the type or revert the file.

- [ ] **Step 4: Error count check**

```bash
npm run lint 2>&1 | tail -3
```

Expected: ~47 errors remaining (126 - 79 = 47), all in Phase 6 territory (React hook rules + stragglers).

---

## Phase 6: React Hook Rules (~32 errors — HIGH RISK)

**Goal:** Fix the React hook rule errors. **Some of these are real bugs; some are false positives.** Each error needs per-case analysis.

**Rule types:**
- `react-hooks/set-state-in-effect` (~25 errors): setState called synchronously inside useEffect body
- `react-hooks/refs-during-render` (~2): useRef accessed during render
- `react-hooks/purity` (~1): impure function called in render (`Date.now()`, `Math.random()`)
- `react-hooks/render-purity` (~1): component created during render
- `react-hooks/rules-of-hooks` (1): hook called conditionally or in a loop — **likely a real bug**

### Decision framework per error

For each error, ask:
1. **Is this a genuine cascading-render bug?** **Concrete test:** does the state field that the `setState` call modifies appear in the effect's dependency array? If YES → it's a cascade bug; fix the logic. If NO → the cascade is bounded (one setState → one re-render → effect deps unchanged → effect doesn't re-run) → it's the loading-state pattern, disable-with-justification is acceptable.
2. **Is this a loading-state pattern?** (See test above.) If yes: disable with `// eslint-disable-next-line react-hooks/set-state-in-effect -- [one-line justification explaining why the cascade is bounded]`. **Do NOT refactor to Suspense / `use()` / async handlers.** That's a data-fetching architecture change out of scope for a lint cleanup.
3. **Is this a useRef accessed during render that should be a useState or useMemo?** Usually yes — `useRef` is for mutable values that don't trigger re-render; accessing `.current` during render is reading stale state. Refactor to `useState` or `useMemo`.
4. **Is this a `Date.now()` or `Math.random()` in a ref initializer?** Move to `useState(() => Date.now())` lazy initializer or to inside a `useEffect`.
5. **Is this the one `rules-of-hooks` error?** Almost certainly a real bug. Find the conditional/loop/early-return and refactor.

### Strategy: per-file analysis, per-file commit

### Task 6.1: `web/lib/hooks/useMinSkeletonDelay.ts` — purity rule

**File:** `web/lib/hooks/useMinSkeletonDelay.ts`
**Error:** line 15, `Date.now()` called in `useRef` initializer.

- [ ] **Step 1: Read the file in full.**

- [ ] **Step 2: Understand the current behavior**

The ref tracks when loading started, so it can compute elapsed time for the minimum-skeleton-display logic.

- [ ] **Step 3: Apply the fix**

The cleanest fix is to initialize the ref to `0` and set it in the effect on first run:

```typescript
// Before (line 15):
const loadStartRef = useRef<number>(isLoading ? Date.now() : 0);

// After:
const loadStartRef = useRef<number>(0);

// Then inside the existing useEffect, ensure the first-run branch sets
// loadStartRef.current = Date.now() when isLoading is true — which the
// existing code already does at line 19. So the fix is simply removing
// the Date.now() from the initializer.
```

- [ ] **Step 4: Verify behavior is preserved**

The behavioral change: on first render where `isLoading=true`, `loadStartRef.current` starts at 0 instead of `Date.now()`. The effect fires immediately after render and sets it to `Date.now()`. During that brief render-to-effect gap, the ref is 0, but nothing reads it during that gap (only `showSkeleton` is read, which is initialized to `isLoading`). So the behavior is equivalent.

- [ ] **Step 5: Lint and tsc the file**

```bash
npx eslint lib/hooks/useMinSkeletonDelay.ts
npx tsc --noEmit 2>&1 | grep useMinSkeletonDelay
```

Expected: zero errors, no tsc output.

- [ ] **Step 6: Commit**

```bash
git add lib/hooks/useMinSkeletonDelay.ts
git commit -m "fix(hooks): move Date.now() out of useRef initializer in useMinSkeletonDelay

react-hooks/purity rule flagged Date.now() called during render. Moved
initialization to the existing useEffect that runs on mount — same net
behavior (the ref is set to Date.now() on the first isLoading=true render
via the effect) but the initializer is now pure."
```

### Task 6.2: `web/lib/hooks/useRankingGame.ts` — set-state-in-effect

**File:** `web/lib/hooks/useRankingGame.ts`
**Error:** line 57, setState inside useEffect body.

**Classification:** loading-state pattern. The effect deps are `[fetchGame, fetchMyEntries, fetchParticipants]` (useCallback-wrapped), not `loading`. The setState targets `loading`, which does not appear in the deps → cascade is bounded → disable-with-justification per the Phase 6 framework. **Do NOT refactor.**

- [ ] **Step 1: Read the file and confirm the loading-state pattern**

The target effect is around lines 56-61:
```typescript
useEffect(() => {
  setState((prev) => ({ ...prev, loading: true }));
  Promise.all([fetchGame(), fetchMyEntries(), fetchParticipants()]).then(() => {
    setState((prev) => ({ ...prev, loading: false }));
  });
}, [fetchGame, fetchMyEntries, fetchParticipants]);
```

Confirm: `loading` is not in the dep array. If this has changed, re-apply the framework test.

- [ ] **Step 2: Add the disable comment**

Use `Edit` to insert the comment immediately above line 57:

```typescript
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading-state pattern: sets loading:true before 3 parallel fetches, flips to false on resolve. Cascade is bounded — loading is not in the dep array, so the state update doesn't re-run this effect.
  setState((prev) => ({ ...prev, loading: true }));
  Promise.all([fetchGame(), fetchMyEntries(), fetchParticipants()]).then(() => {
    setState((prev) => ({ ...prev, loading: false }));
  });
}, [fetchGame, fetchMyEntries, fetchParticipants]);
```

- [ ] **Step 3: Verify**

```bash
npx eslint lib/hooks/useRankingGame.ts 2>&1 | grep -c 'set-state-in-effect'
```
Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useRankingGame.ts
git commit -m "fix(hooks): justify set-state-in-effect disable in useRankingGame loading pattern"
```

### Tasks 6.3 – 6.N: Remaining hook rule errors

For each remaining hook rule error:

1. **Dispatch a subagent with the file path and the decision framework above.**
2. The subagent's prompt MUST include:
   - The file path
   - The specific error line(s) and rule name(s)
   - The decision framework (fix the bug vs refactor vs disable-with-justification)
   - Instructions to prefer "disable with one-line justification" for loading-state-pattern `set-state-in-effect` errors, and "real fix" for other cases
   - Instructions to commit per file
   - Instructions to NEVER use blanket `eslint-disable` without a justification comment

**Files to process (estimate):**
- All files in the hooks directory with errors: ~5-8 files
- Components with setState-in-effect errors: ~5-10 files (many goblin components)
- Stragglers with purity / refs / hooks errors: 2-5 files

**Expected outcome after Phase 6:** ~0 errors remaining. Warning count unchanged (we're not touching warnings).

### Task 6.N+1: Phase 6 verification gate

- [ ] **Step 1: Full lint**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npm run lint 2>&1 | tail -3
```

Expected: `0 errors` (153 warnings OK).

- [ ] **Step 2: Inventory of eslint-disable comments added**

```bash
git diff main..HEAD -- '*.ts' '*.tsx' | grep 'eslint-disable-next-line' | wc -l
```

Record the count. Every single disable comment MUST have a `-- reason` after it. Spot-check 3 random ones:

```bash
git diff main..HEAD | grep -A 1 'eslint-disable-next-line' | head -30
```

Verify each has a meaningful justification, not just the rule name.

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 4: Full test run**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: **same failure set as baseline.** If any new failure, it's a regression from Phase 5 or 6 — isolate the file via `git bisect`, investigate, fix or revert.

- [ ] **Step 5: Browser smoke test**

Start dev server and hit the goblin pages (GoblinDayPage, GoblinQueuePublicView, GoblinLogPublicView) plus 2-3 other changed components. Click around. Verify no runtime errors in console, no visual regressions.

```bash
npm run dev &
# Visit in browser:
#   http://localhost:3000/atlanta
#   http://localhost:3000/atlanta/goblinday (or the goblin entry point)
#   http://localhost:3000/atlanta/goblinday/log/<any-slug>
# Check the browser console for errors
# kill %1 when done
```

---

## Phase 7: Final Verification and PR Prep

### Task 7.1: Full verification pass

- [ ] **Step 1: Zero-errors check**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt/web
npm run lint 2>&1 | tail -3
```

Expected: `0 errors`. Warning count should be unchanged or slightly reduced (from Phase 1's auto-fix of warnings).

- [ ] **Step 2: tsc clean**

```bash
npx tsc --noEmit
```

Expected: clean exit (0). No output.

- [ ] **Step 3: Tests at or below baseline failure count**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: pass count ≥ baseline pass count. No NEW failures compared to the baseline recorded in Pre-Work Step 3.

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds. A successful build is stronger than tsc alone because it runs Next.js's full type + module resolution.

- [ ] **Step 5: Browser smoke test**

Start `npm run dev`. Visit these pages and check for console errors:
- `/atlanta` (homepage)
- `/atlanta/goblinday` (any entry point for the goblin feature)
- A goblin queue detail page
- A goblin log detail page
- An event detail page (non-goblin sanity check)
- A place detail page (spot page)

Verify: navigation works, pages render, no red errors in browser console.

### Task 7.2: Open PR

- [ ] **Step 1: Push branch**

```bash
cd /Users/coach/Projects/LostCity/.claude/worktrees/web-lint-debt
git push -u origin chore/web-lint-debt-cleanup
```

- [ ] **Step 2: Open PR via `gh`**

Use a PR body that:
- Summarizes each phase and the error counts it fixed
- Lists every `// eslint-disable-next-line` added (with justifications)
- Calls out any files where typing was `unknown` instead of a real type
- Notes which tests were failing at baseline vs added
- Notes that CI will still fail (this PR fixes the failing CI for FUTURE PRs, but the current PR hits the same admin-merge pattern as PR #19 and PR #20)

- [ ] **Step 3: Wait for CI (or decide)**

Run:
```bash
gh run list --branch chore/web-lint-debt-cleanup --limit 1
```

If CI passes: normal merge.
If CI fails on something other than the lint we just fixed: investigate the new failure, fix it or explain it.
If CI fails on ONLY the lint we just fixed (unlikely but possible — means we missed a file): fix and retry.

### Task 7.3: Merge

- [ ] **Step 1: Merge (squash) to main**

```bash
gh pr merge <pr-number> --squash --delete-branch=false
```

If branch protection blocks and the only failing check is unrelated pre-existing CI flakiness, use `--admin` with the same justification pattern as PR #19 and PR #20.

- [ ] **Step 2: Verify main**

```bash
cd /Users/coach/Projects/LostCity
git checkout main
git pull origin main
npm --prefix web run lint 2>&1 | tail -3
```

Expected: `0 errors`.

- [ ] **Step 3: Clean up worktree**

```bash
git worktree remove .claude/worktrees/web-lint-debt
```

---

## Self-Review Checklist

- [ ] Every phase has a verification gate (lint + tsc + tests)
- [ ] Every subagent-dispatched task has concrete file paths and error line counts
- [ ] Phase 5 and Phase 6 use per-file commits so regressions are isolated
- [ ] The decision framework for Phase 6 is explicit (fix vs. disable with justification)
- [ ] No blanket "fix all X" instructions without the per-file read-analyze-fix pattern
- [ ] Rollback criteria are documented for each phase
- [ ] The plan acknowledges that some `set-state-in-effect` errors are false positives and should be disabled-with-justification, not refactored
- [ ] Baseline tests are recorded in Pre-Work so regression detection is meaningful
- [ ] PR description requirements are listed

---

## Expected Outcome

- **Before:** `npm run lint` → 220 errors, 153 warnings. CI blocked.
- **After:** `npm run lint` → 0 errors, ≤153 warnings. CI unblocked for all future PRs.
- **Commits:** ~15-25 commits (phased + per-file in Phase 5/6)
- **Code changes:** Real. TypeScript types tightened, `<a>` → `<Link>` throughout goblin feature, React hook patterns analyzed per-case
- **Risk:** Medium — bounded by per-file commits, tsc gates, test gates, and browser smoke tests

## Follow-ups this plan intentionally does NOT do

- **Warning cleanup** — 153 warnings remain. Not failing CI. Worth a separate low-priority pass.
- **Test failure cleanup** — if baseline has failing tests, this plan preserves the failure set. Fixing baseline test failures is its own project.
- **Refactoring the goblin feature** — lots of the `any` errors and hook rule errors suggest the goblin feature could use a typing/architecture refresh. Out of scope.
- **Auto-fixing the whole Next.js 16 migration** — some React 19 patterns (use(), Suspense data fetching) could replace the disabled-with-justification patterns. Out of scope for a lint-debt cleanup.
