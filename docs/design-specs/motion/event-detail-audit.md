# Motion Audit: Event Detail Page

**Page:** `/atlanta/events/179139` (Into the Burrow — Alliance Theatre)
**Date:** 2026-04-15
**Audited by:** Code inspection + browser hover testing

---

## Current State

The page has **zero entrance animations**, **minimal hover states** (color-only transitions), **no scroll-triggered reveals**, **no press feedback**, and **no loading transitions**. Every element appears instantly and remains static. The only motion on the entire page is:
- `transition-colors duration-300` on buttons (hover color change only)
- `transition-opacity duration-300` on hero image loading (skeleton → loaded)
- `hover:opacity-90` on CTA (barely perceptible)
- `hover:bg-[var(--twilight)]/50` on secondary action buttons and connection rows

The page feels like a PDF.

---

## Missing Entrances

- [ ] **Hero image** — appears instantly. Should fade in with the gradient overlay establishing atmosphere.
- [ ] **Identity zone** (title, venue, date, price) — pops in. Should fade-up after hero loads, staggered: title first, metadata rows follow.
- [ ] **CTA + action buttons** — appear instantly. Should fade-up after identity.
- [ ] **Each content section** (About, Show Info, Connections, Getting There) — all appear simultaneously. Sections below the fold should scroll-reveal with fade-up.
- [ ] **Connection rows** — appear all at once. Should stagger (60ms intervals).
- [ ] **Show Info grid cards** — appear simultaneously. Should stagger (40ms, tight).

## Missing Hover States

- [ ] **Connection rows** — have `hover:bg-[var(--twilight)]/50` (background color only). Missing: translateY lift (-4px), shadow deepening, arrow icon opacity increase. Should use `motion-hover-lift`.
- [ ] **CTA "Get Tickets" button** — has `hover:opacity-90` (slight dim). Missing: coral glow radiating outward (`box-shadow: 0 0 20px rgba(255,107,122,0.3)`). Should use `motion-hover-glow`.
- [ ] **RSVP circle button** — has `hover:bg-[var(--twilight)]/50`. Missing: any lift or scale feedback.
- [ ] **Secondary action buttons** (save, invite, calendar, share) — have `hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50`. Missing: lift, icon scale-up on hover.
- [ ] **Venue link** in identity zone — has `hover:text-[var(--coral)]` (color only). Missing: underline or any spatial movement.
- [ ] **"Tickets available" link** in Show Info — no hover state visible.
- [ ] **Show Info grid cards** — no hover state at all. Should brighten border on hover.

## Missing Transitions

- [ ] **Page load** — content appears all at once in a flash. Should have a orchestrated reveal: hero → identity → CTA → first content section, with each following the previous by ~100ms.
- [ ] **DetailStickyBar** (bottom) — on desktop, it's permanently visible. On mobile, it should slide up on scroll. Currently appears without animation when scroll threshold is met.
- [ ] **Section divider bands** — 8px night bands are static. They could serve as "gates" between sections where content reveals on crossing them.

## Missing Feedback

- [ ] **CTA button press** — no `:active` state. Should scale(0.97) on press for tactile feedback.
- [ ] **Secondary buttons press** — no `:active` state. Same scale feedback needed.
- [ ] **Connection row press** — no press feedback. Should have subtle scale or background pulse.
- [ ] **Save/share icon tap** — no confirmation animation. After saving, the icon should briefly pulse or check-animate.

## Missing Loading States

- [ ] **Section content** — no skeleton → content crossfade. Content appears in full when the client fetch resolves. Should crossfade from skeleton to real content.
- [ ] **Connection rows** — render instantly from server data. No issue for SSR path, but overlay path shows a momentary blank before data arrives.

## Desktop-Specific Issues

- [ ] **Back button** — the `NeonBackButton` renders as a chunky coral "← BACK" pill at top-left on desktop canonical pages. This is a mobile overlay pattern that looks out of place on desktop. Should be a subtle text link or breadcrumb on desktop, or hidden entirely on canonical pages (browser back handles it).
- [ ] **DetailStickyBar on desktop** — if visible, it's a full-width coral bar pinned at the bottom of the viewport. This is a mobile pattern. On desktop, the CTA is already visible in the sidebar — the sticky bar is redundant and wastes vertical space.

---

## Recommended Motion Spec

### Phase 1: Page Load Orchestration
```
0ms:   Hero image fade-in (opacity 0→1, 400ms ease-out)
100ms: Identity zone fade-up (title, then venue/date/price stagger at 60ms)
300ms: CTA + actions fade-up
400ms: First content section (About) fade-up
```

### Phase 2: Scroll Reveals (below fold)
```
Each section wrapped in useScrollReveal:
- threshold: 0.1
- animation: motion-fade-up (400ms ease-out)
- stagger children: connection rows at 60ms, show info cards at 40ms
```

### Phase 3: Hover States
```
Connection rows:     motion-hover-lift (translateY -4px, shadow-card-md, 200ms)
CTA button:          motion-hover-glow (coral glow shadow, 200ms)
RSVP button:         motion-hover-lift (translateY -2px, 200ms)
Secondary buttons:   icon scale(1.1) on hover (200ms)
Show Info cards:     border-color brighten on hover (200ms)
Venue link:          underline-offset animation (200ms)
```

### Phase 4: Press Feedback
```
All buttons:         motion-press (scale 0.97, 100ms ease-in)
Connection rows:     motion-press (scale 0.98, 100ms)
```

### Phase 5: Desktop Fixes
```
Back button:         Hide on canonical desktop pages, or render as subtle text breadcrumb
Sticky bar:          Hide on desktop (CTA is in sidebar), show only on mobile
```

---

## Priority Order

1. **Scroll reveals for sections** — highest-impact, lowest-risk. Sections below fold fade in as user scrolls. Transforms a static wall of content into a guided reveal.
2. **Connection row hover-lift** — the most interactive element on the page has no feedback. Users don't know these are tappable.
3. **CTA glow on hover** — the money moment needs to feel alive.
4. **Page load orchestration** — identity zone staggering in after hero creates a cinematic moment.
5. **Press feedback on all buttons** — tactile response makes the app feel responsive.
6. **Desktop back button + sticky bar fixes** — remove elements that are mobile patterns misapplied to desktop.
