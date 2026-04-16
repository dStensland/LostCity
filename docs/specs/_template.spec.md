# {Feature / Surface Name}

**Scope:** {one sentence — what this spec covers and nothing else}
**Owner:** {name or handle}
**Created:** {YYYY-MM-DD}
**Status:** draft | approved | shipped

---

## Why this exists

{2-3 sentences. What problem does this surface solve for users? Which north-star bet does it serve? Don't restate the feature name — justify its existence.}

---

## 1. Visual

**Source of truth:** Pencil comp(s).

- **Desktop:** `docs/design-system.pen` node `{nodeId}` — extracted spec at `docs/design-specs/{name}.md`
- **Mobile:** `docs/design-system.pen` node `{nodeId}` — extracted spec at `docs/design-specs/{name}-mobile.md`

If a variant (portal theme, tier, loading state) diverges from the default, list each variant with its Pencil node.

> Template linter requires at least one Pencil node ID OR an explicit `N/A because: {reason}` line.

---

## 2. Motion

Follow the Motion tokens in `docs/quality-bar.md` (durations, easings, distances). Cinematic minimalism — camera not cartoon.

**Entrance**
- What appears: {element(s)}
- Trigger: mount | in-view (IntersectionObserver at N% threshold) | user-action
- Duration + easing: `--motion-{token}` + `--ease-{token}`
- Distance / property: `{e.g. opacity 0→1 + translateY(8px)→(0)}`

**Hover / focus**
- For every interactive element: `{element}` → `{response}` at `--motion-fast`
- Focus indicators (a11y): {describe — not just "browser default" unless that's the approved choice}

**Scroll-triggered reveals** (if below the fold)
- Sections: {list}
- Trigger: IntersectionObserver at 15% visibility
- One-shot (not re-triggering on scroll-back)

**State transitions**
- {collapsed → expanded, tab → tab, loading → loaded, etc.} with duration + easing

> If this surface has no motion (static text page), write `N/A because: {reason}`. Otherwise every subsection must be filled.

---

## 3. Data contract

**Source:** {server loader / API route / direct Supabase query — name the exact function}

**Fields read:**

| Field | Type | Required | Fallback if missing |
|---|---|---|---|
| `example_field` | string | yes | render "—" |

**Live-DB coverage** (run and paste the query + result):

```sql
SELECT count(*) AS total,
       count(image_url) AS with_image,
       count(image_url)::float / count(*) * 100 AS image_coverage_pct
FROM {table}
WHERE {filter}
;
```
Result: {paste result table}

**Data hallucination check:** Confirm this surface does NOT use hardcoded placeholder arrays or mock data at runtime. Every field shown to the user must trace to a real column.

> The coverage query is not optional. A component that assumes 95% image coverage but has 40% will ship broken.

---

## 4. States

Every state must be specified (not "we'll add it later"):

- **Loading** — skeleton? Spinner? Instant render with progressive data? Describe and reference Pencil node if designed.
- **Empty** — no data for this slice. User-facing copy + CTA (if any). Design must exist — "it won't happen" is not a state spec.
- **Error** — API failure, data error, render failure. User-facing copy. Recovery CTA. Monitoring hook if required.
- **Partial** — some fields missing (e.g., no image, no description). What renders gracefully vs what is required.
- **No-results** (for filtered / searched / paginated surfaces) — user-facing copy, suggested next action.

> "Happy path only" = not shippable. A user WILL hit an edge state within 10 sessions.

---

## 5. Responsive

- **Breakpoints:** {list the widths this surface cares about — e.g., `<= 640px`, `641-1024px`, `> 1024px`}
- **Behavior per breakpoint:** {brief description of how layout adapts}
- **Touch targets:** every interactive element ≥ 44×44px on mobile. List any exceptions with rationale.
- **Mobile-specific components:** {e.g., drawer instead of popover, bottom-sheet instead of modal} — reference Pencil mobile node(s).
- **Browser viewport note:** `mcp__claude-in-chrome__resize_window` does NOT change the web viewport. Mobile verification requires a real narrow window or device — not an MCP screenshot.

---

## 6. A11y

- **Keyboard nav order:** {describe tab order for interactive elements; confirm logical visual-to-DOM mapping}
- **Focus indicators:** {describe — ring, outline, background-shift; must be visible on the surface's colors}
- **Screen reader labels:** every icon-only button has `aria-label`; every `img` has `alt`; semantic landmarks (`<nav>`, `<main>`, `<article>`) used correctly.
- **Contrast ratios:** text ≥ 4.5:1 (7:1 for small text on dark), UI elements ≥ 3:1. Verify with extracted colors — don't eyeball.
- **Reduced motion:** `prefers-reduced-motion: reduce` → animations fall back to {opacity-only | instant | specify}.

---

## 7. Non-goals

{List what this surface is NOT doing, to prevent scope creep during implementation. Reference adjacent surfaces that handle the excluded concerns.}

---

## 8. Open questions

{Any unresolved design / data / behavior questions. Block plan approval until resolved.}

---

## Approval checklist

Before marking this spec `approved`:

- [ ] All 6 spec sections complete OR explicit "N/A because:" noted
- [ ] At least one Pencil node ID referenced in §1
- [ ] Data coverage query run and result pasted in §3
- [ ] Every state in §4 has a user-facing copy OR a reference to a designed state
- [ ] Motion spec in §2 uses tokens from `docs/quality-bar.md`, not hardcoded values
- [ ] Non-goals in §7 explicitly exclude at least one adjacent concern
- [ ] Read by one other agent or reviewer and counter-signed
