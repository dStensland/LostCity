# LostCity Quality Bar

**Read before every task. Every agent, every subagent, every session.** These are the elite-quality standards that every piece of work must meet.

If your output doesn't clear this bar, it isn't done — regardless of passing `tsc`, tests, or lint.

**Last refreshed:** 2026-04-16 (synthesized from feedback memories, north-star, design-system reference).

---

## Mission & Framing

- **The question we answer:** "What should I go do?" The answer is events, places, programs, and exhibitions working together.
- **The bar is consumer-grade, not demo-grade.** Every portal is a live production product. If you'd be embarrassed showing it to a stranger with zero guidance, it isn't ready. "Demo-ready" is a banned phrase.
- **A live product with real users IS the sales demo.** Don't prepare for demos. Make the product good.
- **Build cost is near zero with agentic dev.** Scope discipline matters MORE, not less. Ambition matters more. The real constraint is decision quality, not dev hours.

---

## Visual & Design

### Cinematic Minimalism (Atlanta / default)

See `docs/decisions/2026-03-08-cinematic-minimalism-design.md`.

- **Solid surfaces.** No glassmorphism, no heavy gradients, no translucent stacking. Atmospheric glow for depth, not blur.
- **Typography carries the page.** When an image is missing, the type is the design — not a fallback.
- **Stillness is design.** Not everything moves. Static elements provide contrast that makes motion meaningful.
- **Background grain is intentional, not residual.** Keep at low opacity; stays for cinematic texture.

### Design System Discipline

- **Canonical reference:** `docs/design-system.pen` — 33 components, 6 portal themes, 20 page compositions. Read before proposing anything novel.
- **Never "extract from old code" when Pencil designs exist.** Run `/design-handoff extract <node>` → spec → implement from spec → `/design-handoff verify`. Verify-blocks-ship.
- **Zero tolerance for drift.** Built code must match Pencil comp to within Minor severity on `/design-handoff verify`. Critical and Major diffs block PR.
- **Portal themes are bespoke, not configured.** Each portal feels purpose-built. Lost Youth for Arts (field sage, amber, Plus Jakarta Sans). Lost City: X naming. Don't build a theme system.

### Surface-Level Rules

- **No carousel mask fades.** `mask-fade-x` on horizontal scroll carousels obscures edge cards. Not allowed on feed strips. Chevron hints or dot indicators only.
- **No redundant filter shortcuts.** Don't duplicate dropdown options as standalone buttons (Tonight/Weekend/Big Events when date dropdown exists).
- **Grid shape must match data cardinality.** A 4-column grid with 3 cards reads as broken. Design for actual N, or add a 12th tile CTA.
- **Subtitles are editorial, not debug output.** "Family-friendly: 1" is wrong. "1 family-friendly spot" is right. Every label reads like human copy.

---

## Motion & Interaction

### Language (Cinematic Minimalism)

- **Camera, not cartoon.** Slow, deliberate, atmospheric. No bouncing, elastic overshoot, or playful wobble. Save bounce for family/youth portals.
- **Reveal, don't announce.** Fog lifting, lights coming up. No "ta-da!"
- **Respond, don't react.** Hover = subtle lift + shadow deepening. Not a color explosion.
- **One motion per moment.** Never animate competing directions simultaneously. If it rises, it fades. If it slides, nothing else moves.

### Tokens

```
Durations:   --motion-instant 100ms  / --motion-fast 200ms  / --motion-normal 300ms
             --motion-slow 400ms     / --motion-dramatic 600ms
Easings:     --ease-out   cubic-bezier(0.16, 1, 0.3, 1)      (entrances)
             --ease-in    cubic-bezier(0.55, 0, 1, 0.45)     (exits)
             --ease-in-out cubic-bezier(0.65, 0, 0.35, 1)    (state changes)
Distances:   --motion-shift-sm 4px (hover) / -md 8px (entrance) / -lg 16px (overlay) / -xl 24px (page)
```

### Required Specs Per Surface

Every page/component spec must define:

1. **Entrance** — element(s), duration token, easing, distance. `feed-section-enter` for sections.
2. **Hover / focus** — response for every interactive element.
3. **Scroll-trigger** — if below the fold, use IntersectionObserver (not on-mount, which fires before user scrolls into view).
4. **State transitions** — loading → loaded, collapsed → expanded, tab → tab.

Motion is a **design step**, not post-code polish. Missing motion spec blocks plan approval.

---

## Data Layer — "No Smoke and Mirrors"

### The Order (non-negotiable)

1. Verify the database has the data (query it).
2. Verify the API route / loader returns it (curl or direct call).
3. Build the component that renders it.
4. Browser-test the result with real data.

**Never reverse.** A beautiful component with no data behind it is waste.

### Data Contract (required in every spec)

- Fields read — types, required vs optional.
- Fallback per missing field — what renders when field is absent or null.
- Live-DB coverage check — "X% of rows have field Y populated." Run the query, capture the result in the spec.
- Empty state — specified, not "we'll add it later."

### Common Hallucination Patterns to Avoid

- Components importing hooks that fetch from non-existent API routes.
- Hardcoded/placeholder arrays standing in for database queries.
- References to database columns that haven't been migrated.
- Empty state handlers that hide the fact that data doesn't exist yet.
- Design drift between agent sessions due to no shared reference.

---

## Crawlers — First-Pass Completeness

### The Rule

When a crawler visits a venue page, extract **everything available**:

1. Events (obvious)
2. Recurring programming → series (trivia, DJ nights, brunch, karaoke)
3. Specials & deals → `place_specials` (happy hours, daily specials)
4. Hours of operation → `places.hours`
5. Venue metadata — description, hero image, vibes, cuisine, parking, reservation links

### Enrichment Scripts Are Crawler Failures

- About to write an enrichment script? Ask: "Why didn't the crawler capture this?" The answer is almost always "it should have."
- **Fix the crawler**, not the downstream.
- Justified enrichment: cross-source intelligence (editorial mentions), inference from aggregate data (occasion inference), one-time migrations (new column backfill).
- Not justified: venue images, descriptions, hours, coordinates — all should be first-pass.

### Image Quality

- `_IMAGE_SKIP_PATTERNS` in `crawlers/utils.py` filters bad images. Extend when new patterns emerge (weekly-schedule posters → `weeklyservice`, etc.).
- `enrich_event_record()` short-circuits on existing `image_url`. Clear bad URLs before re-enriching.

### Destination Inclusion

- Bar is "would someone plan to go here?" — not "is this unique to Atlanta?" Include chains (Dave & Buster's, Round 1), malls with entertainment value, arcades, bowling alleys. Coverage wins.

---

## Browser-Using Work (Hard Memory Budget)

**16GB RAM + 0 swap. Accumulation kills the machine.** This is not theoretical — it has crashed repeatedly.

### Rules

- **Only ONE browser-using process at a time.** Never dispatch two browser subagents concurrently. Never dispatch a browser subagent while the main agent has tabs open.
- **Browser-using skills:** `qa`, `design`, `design-handoff verify`, `motion audit`, `elevate` (Phase 1/4), `review-pr` (when product-designer/qa spawned).
- **Non-browser lenses** (architecture, data, code review) can run parallel to each other — just not while browser work is active.

### Pre-flight

Before any browser session:
```bash
vm_stat | awk '/Pages free/ {gsub(/\./,"",$3); printf "%d MB\n", $3*16384/1048576}'
```
If < 200 MB free, abort. Ask user to quit Spotify / close Chrome tabs / close other MCP sessions.

### Session Discipline

- **Cap screenshots.** ~3 per verify, ~4 per motion audit. Each PNG is 1-3 MB held in context.
- **Jump-scroll, don't scrollBy loop.** 3 positions (top / mid / bottom) via `scrollTo`.
- **Close the tab when done.** Held tabs keep GPU memory pinned.
- **`resize_window` does NOT change the web viewport.** The macOS window resizes, `window.innerWidth` stays desktop. Any "mobile" screenshot this way is a false positive. Mobile testing requires a real narrow Chrome window or device.

---

## Process & Orchestration

### Architecture Before Components

- Before any implementation plan: "How does this page get its data?" Multi-fetch parallel client calls = red flag. Design single data source first.
- Plans must specify data flow, not just component tree.
- Next.js pages default to server-side data fetching. Client-side fetches are for interactions, not initial page content.
- Browser-test the **first** component integration, not the last. If page loads empty after Task 2, stop and fix architecture before Tasks 3-7.

### Design + Motion Baked Into Plans

Implementation plans include, as **workflow gates** (not afterthoughts):

1. Pencil design extraction (`/design-handoff extract`) → visual spec → code.
2. Motion design step → motion spec before implementation.
3. Design + motion verification before marking UI tasks complete.
4. Data contract verified against live DB before component ships.

### Verify Shipped Types Before Planning

- Before writing a plan touching existing types: **`Read` the actual `*/types.ts` files.** Do not specify interfaces, signatures, or field names from memory.
- Grep for imports the plan assumes exist.
- Type drift between remembered shape and shipped shape is a silent plan-quality failure that compile-fails subagents in the first 5 minutes.

### Subagent Integration Checkpoint

- After first 2-3 subagent tasks, run `tsc` + browser-test before dispatching more. Don't wait until Task 7 to discover the architecture failed.
- Subagents build isolated pieces correctly; composition failures only surface when integrated.

### Don't Flipflop On Architecture

- Bug surfaces in a system you've been modifying:
  1. Stop and get expert review **before** proposing a fix.
  2. Diagnose root cause with evidence, not speculation.
  3. Propose ONE architectural approach, review, then implement.
- Never make "quick fix" architectural changes without review.

### Don't Ask Permission Between Tasks

- User approved the plan. Keep executing.
- Only pause for: actual blockers, decisions needing human input, significant unexpected findings.

### Scope Discipline

- Do what was asked. Don't gold-plate. Don't refactor adjacent code. Don't add unrequested features.
- Note adjacent issues separately — don't fix them in-flight unless explicitly scoped.
- Don't overlap with other agents. Audit findings about data/crawlers/content are for crawler-dev / data-specialist, not the main agent.

---

## Strategic Posture

### Working Style

- **Critical partner, not yes-machine.** Challenge weak ideas, including the user's own.
- **Strategic over technical.** High-level decision briefings. Only surface meaningful tradeoffs.
- **Cross-check work.** Engineering output vs strategy. Strategy vs engineering reality.
- **Be direct.** No hedging, no "great question!", no softening bad news. Respect the human's time and intelligence.

### Product Smell Test

Before proposing a feature:
1. Who benefits, what decision does it help?
2. Works without curation/personalization?
3. Uniquely positioned or worse version of existing?

### Anti-Patterns (Flag Immediately)

- "Demo quality" as a shipping bar.
- Building a theme/config system instead of bespoke frontends on a clean API.
- Siloing portal data that should enrich the network.
- Manual data curation replacing crawler fixes.
- Frontend-driven architecture shaped by one portal's needs.
- Feature breadth over quality depth.
- Planning documents that substitute for shipping.
- Portals without unique entity types ("content pillar" that's a filtered view of events is a search preset).
- Premature city expansion before architecture supports it cleanly.

---

## Pipeline Gates (What Blocks What)

| Gate | Artifact required | Blocks |
|---|---|---|
| Plan approval | Spec with 6 sections (Visual / Motion / Data / States / Responsive / A11y) complete | Implementation start |
| Commit | `tsc`, tests, lint pass | Commit |
| Push | `/design-handoff verify` + `/motion audit` clean on changed routes | Push |
| PR creation | `docs/review/{branch}.review.md` exists with no critical | `gh pr create` |
| Merge | CI green + reviewer approval + no critical in review | Merge |

---

## Hard Constraints

- **Opt-out: Tiny Doors ATL** — never reference in descriptions, tracks, or content.
- **Portal data isolation** — `sources.owner_portal_id` is `NOT NULL` + CHECK-constrained. Cross-portal leakage is P0 trust failure.
- **Places is canonical** — renamed from `venues` in March 2026. All FKs use `place_id`. Don't write code against old names.
- **Single search entry point** — `search_unified()` RPC. `p_portal_id` always required. Don't bypass.
- **URL building** — always `web/lib/entity-urls.ts`. Never hand-build.
- **Exhibitions first-class** — `exhibitions` table, cross-vertical, not Arts-only. New code never sets `content_kind='exhibit'`; use `exhibition_id` FK.

---

## When Standards Are Unclear

If you hit a situation this doc doesn't cover:

1. Check `.claude/north-star.md` for mission alignment.
2. Check the relevant `CLAUDE.md` (`web/`, `crawlers/`, `database/`).
3. Check `docs/decisions/` for prior architectural calls.
4. Ask the user — don't invent a new standard silently.

If you identify a standard that should be here but isn't, **flag it**. This doc is living; gaps get filled.
