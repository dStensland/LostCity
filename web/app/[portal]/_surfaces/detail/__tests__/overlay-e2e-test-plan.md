# Overlay E2E Test Plan

Acceptance-gate scenarios from `docs/plans/explore-overlay-architecture-2026-04-18.md` § Testability. Deferred to a dedicated Playwright workstream — `@playwright/test` is installed as a dep but the `web/` subproject has no Playwright config, run script, or test directory. Adding all of that is infrastructure outside Phase 7's scope.

Each scenario below is ready to lift into a Playwright spec when that workstream starts.

---

## 1. Depth-3 swap-and-back

**Intent:** in-overlay entity clicks swap, don't stack. Browser back traverses the chain.

```
Open /atlanta
Click first event card          → URL becomes /atlanta?event=A
                                  overlay A visible
Click an event link inside      → URL becomes /atlanta?event=B
overlay A                         overlay B visible (A is gone, not stacked)
Click another                    → URL becomes /atlanta?event=C
                                  overlay C visible
Press browser back              → URL becomes /atlanta?event=B
                                  overlay B visible
Press browser back              → URL becomes /atlanta?event=A
                                  overlay A visible
Press browser back              → URL becomes /atlanta
                                  lane visible, no overlay
```

Assertion per step: `page.url()` matches AND `page.locator('[role="dialog"]')` presence matches expected.

---

## 2. Shared-link canonical

**Intent:** cold-loading a canonical detail URL in a fresh tab renders the full page, not the overlay.

```
Fresh context, navigate to /atlanta/events/[id]
Expect: no [role="dialog"] on the page
Expect: url still /atlanta/events/[id] (no redirect to ?event=)
Expect: event content renders via canonical page shell, not overlay shell
```

Distinction: the SAME url with `?event=` is overlay (e.g., `/atlanta?event=123`). Canonical path `/atlanta/events/123` must never open as overlay even on overlay-capable surfaces.

---

## 3. Escape closes overlay

**Intent:** keyboard-accessible close.

```
Open /atlanta
Click event card                → overlay A open
Press Escape
Expect within 500ms: url = /atlanta (?event= cleared)
Expect: no [role="dialog"] in DOM
Expect: focus returned to the triggering card (by href selector)
```

Note the 500ms upper bound — there's a defensive fallback timer in `AnimatedDetailWrapper` for environments where `animationend` stalls (background-throttled tabs, animation-blockers). The close path must complete within that budget.

---

## 4. Browser back chain on 5 swaps

**Intent:** history is linear with one entry per swap; back walks backward one-at-a-time.

```
Open /atlanta
Click 5 different event cards in sequence (each click swaps to a new overlay)
For i in [4, 3, 2, 1, 0]: press back, expect url to match the ith opened event
One more back: url = /atlanta, no overlay
```

---

## 5. Portal mismatch — redirect to canonical 404

**Intent:** overlay-target must respect portal attribution. Cross-portal slug resolves to canonical 404.

```
Navigate to /forth/explore?event=<atlanta-only-event-id>
Expect redirect to /forth/events/<id> OR equivalent canonical path
Expect: canonical page returns 404 (the event doesn't belong to the forth portal)
Expect: no [role="dialog"] — never rendered as an overlay on the wrong portal
```

This backs up the Phase 5 P0 fix (`getCanonicalPortalRedirect`) with an end-to-end check.

---

## 6. Depth-cap → canonical navigation (Phase 7 addition)

**Intent:** after 5 consecutive swaps, the 6th entity-link click is a full-page canonical nav, not another overlay swap.

```
Open /atlanta
Swap 5 times (click 5 entity links, each inside the previous overlay)
Confirm: url after each swap is /atlanta?event= or ?spot= etc.
Click one more entity link inside the 5th overlay
Expect: url becomes /atlanta/events/<id> (canonical path, NOT a ?event= query)
Expect: no [role="dialog"] on the resulting page
Expect: page renders full canonical detail shell
```

---

## Workstream gate

When the Playwright workstream starts, verify each scenario above passes in CI before calling the overlay architecture "fully tested." Until then, the functional scenarios are covered by manual browser verification on `feat/overlay-phase-7-seeding` (see PR #73 body).
