---
description: Design and implement motion, interaction, and micro-animation patterns. Use when a page feels static/stiff, when adding hover states, entrance animations, scroll-triggered reveals, loading transitions, or gesture feedback. Commands - `/motion audit <page-or-url>` to identify missing interactions, `/motion design <component>` to create a motion spec, `/motion apply <spec>` to implement.
---

# Motion & Interaction Design

$ARGUMENTS

## Usage

- `/motion audit <page-or-url>` — Audit a page for missing interaction patterns. Browser-test and identify where motion would improve the experience.
- `/motion design <component-or-page>` — Create a motion spec defining animations, transitions, states, and timing for a component or page.
- `/motion apply <component>` — Implement motion patterns on a built component using the motion design system.
- `/motion system` — Review and extend the motion design system tokens and patterns.

## Why This Exists

Static Pencil comps translated literally produce dead-feeling UIs. A premium app experience isn't just correct pixels — it's how those pixels move, respond, and feel. This skill fills the gap between visual design and lived experience.

**This is a design step, not an afterthought.** Motion should be designed with the same rigor as typography and color. "Add some animations" after implementation produces inconsistent, gratuitous motion. Designed motion has purpose, consistency, and restraint.

---

## Motion Design System

### Principles (Cinematic Minimalism)

LostCity's motion language follows the cinematic minimalism aesthetic:

1. **Camera, not cartoon.** Motion should feel like camera movement — slow, deliberate, atmospheric. No bouncing, no elastic overshoot, no playful wobble (save that for family/youth portals).

2. **Reveal, don't announce.** Content appears like fog lifting or lights coming up. Subtle, inevitable, natural. Never "ta-da!"

3. **Respond, don't react.** Hover states should feel like a spotlight finding you — a subtle lift, a shadow deepening. Not a color explosion.

4. **One motion per moment.** Never animate multiple properties in competing directions. If something rises, it fades in. If it slides, nothing else moves.

5. **Stillness is design.** Not everything needs to move. Static elements provide contrast that makes motion meaningful. Over-animation is worse than no animation.

### Motion Tokens

```
/* Duration */
--motion-instant: 100ms    /* button press, toggle snap */
--motion-fast: 200ms       /* hover response, color shift */
--motion-normal: 300ms     /* state transitions, tab switches */
--motion-slow: 400ms       /* entrance animations, section reveals */
--motion-dramatic: 600ms   /* page transitions, overlay enter/exit */

/* Easing */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)     /* entrances — fast start, gentle stop */
--ease-in: cubic-bezier(0.55, 0, 1, 0.45)     /* exits — gentle start, fast finish */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1) /* state changes — symmetric */

/* Distance */
--motion-shift-sm: 4px     /* subtle lift (hover) */
--motion-shift-md: 8px     /* entrance rise */
--motion-shift-lg: 16px    /* overlay slide */
--motion-shift-xl: 24px    /* page transition */

/* Stagger */
--stagger-tight: 40ms      /* dense lists (nearby rows, connection rows) */
--stagger-normal: 60ms     /* card lists (events, artists) */
--stagger-wide: 80ms       /* section-level reveals */
```

### Pattern Library

#### 1. Entrance: Fade Up
**When:** Content sections appearing on first render or scroll-reveal.
**What:** opacity 0→1, translateY shift-md→0
**Duration:** --motion-slow (400ms)
**Easing:** --ease-out
**Trigger:** IntersectionObserver at threshold 0.1, or on mount

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(var(--motion-shift-md)); }
  to { opacity: 1; transform: translateY(0); }
}
.motion-fade-up {
  animation: fadeUp var(--motion-slow) var(--ease-out) both;
}
```

#### 2. Entrance: Stagger Children
**When:** Lists of items (connection rows, artist cards, nearby venues).
**What:** Each child gets fade-up with increasing delay.
**Stagger:** --stagger-normal (60ms) between items.

```css
.motion-stagger > * {
  animation: fadeUp var(--motion-slow) var(--ease-out) both;
}
.motion-stagger > *:nth-child(1) { animation-delay: 0ms; }
.motion-stagger > *:nth-child(2) { animation-delay: 60ms; }
.motion-stagger > *:nth-child(3) { animation-delay: 120ms; }
/* ... up to 8 children, then all share the 8th delay */
```

#### 3. Hover: Card Lift
**When:** Interactive cards (event cards, connection rows, venue cards, artist cards).
**What:** translateY -shift-sm, shadow deepens, subtle border brightens.
**Duration:** --motion-fast (200ms)
**Easing:** --ease-out

```css
.motion-hover-lift {
  transition: transform var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-fast) var(--ease-out);
}
.motion-hover-lift:hover {
  transform: translateY(calc(-1 * var(--motion-shift-sm)));
  box-shadow: var(--shadow-card-md);
}
```

#### 4. Hover: Glow
**When:** Primary CTA buttons, featured elements.
**What:** Box-shadow glow appears around the element.
**Duration:** --motion-fast (200ms)

```css
.motion-hover-glow:hover {
  box-shadow: 0 0 20px var(--coral-glow, rgba(255, 107, 122, 0.3));
}
```

#### 5. Press: Scale
**When:** Buttons on click/tap.
**What:** scale(0.97) on :active, snap back.
**Duration:** --motion-instant (100ms)

```css
.motion-press:active {
  transform: scale(0.97);
  transition: transform var(--motion-instant) ease-in;
}
```

#### 6. Scroll Reveal
**When:** Sections below the fold on detail pages.
**What:** IntersectionObserver triggers fade-up entrance on first intersection.
**One-shot:** Don't re-trigger on scroll back up.

```tsx
// React hook
function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, revealed };
}

// Usage
function Section({ children }) {
  const { ref, revealed } = useScrollReveal();
  return (
    <div ref={ref} className={revealed ? "motion-fade-up" : "opacity-0"}>
      {children}
    </div>
  );
}
```

#### 7. Sticky Bar Appear
**When:** DetailStickyBar on mobile, triggered by scroll past CTA.
**What:** translateY 100%→0, opacity 0→1.
**Duration:** --motion-normal (300ms)
**Easing:** --ease-out

```css
.motion-sticky-enter {
  animation: slideUp var(--motion-normal) var(--ease-out) both;
}
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

#### 8. Overlay Enter/Exit
**When:** Detail overlay opening from feed card click.
**What:** 
  - Enter: backdrop fade 0→1 (dramatic), panel slide from bottom on mobile / fade+scale on desktop.
  - Exit: reverse.
**Duration:** --motion-dramatic (600ms) enter, --motion-normal (300ms) exit.

#### 9. Skeleton → Content Crossfade
**When:** Data loading complete, replacing skeleton with real content.
**What:** Skeleton fades out, content fades in simultaneously.
**Duration:** --motion-normal (300ms)

```css
.motion-crossfade-enter {
  animation: fadeIn var(--motion-normal) var(--ease-out) both;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

#### 10. Tab/Pill Switch
**When:** Date pills in ShowtimesSection, day tabs in FestivalSchedule.
**What:** Active indicator slides to new position. Old content fades out, new content fades in.
**Duration:** --motion-fast (200ms) for indicator, --motion-normal (300ms) for content.

---

## Audit Flow (`/motion audit`)

### Process

**Pre-flight memory check (mandatory — 16GB RAM + 0 swap = browser-test crashes the machine):**

```bash
vm_stat | awk '/Pages free/ {gsub(/\./,"",$3); printf "free: %d MB\n", $3*16384/1048576}'
```

If free memory < 200 MB, **abort** and ask the user to quit Spotify, close non-essential Chrome tabs, and close any other MCP browser sessions.

**Browser budget:** Max 4 screenshots per audit. Open ONE tab at desktop (1440×900), take the shots you need, then close the tab. Do not keep the tab alive "just in case" — held tabs with infinite animations (pulse-glow, shimmer) continue burning GPU memory even when you're not interacting.

**Mobile viewport audits are currently unavailable via this skill.** `mcp__claude-in-chrome__resize_window` resizes the macOS window frame but does NOT change the web viewport — any "mobile" screenshot captures a desktop-rendered page at reduced size. If mobile motion needs review, ask the user to open the page at 390px wide in a real Chrome window or on a device. See `docs/feed-audit-2026-04-16.md` §10.

1. **Open one browser tab** at desktop width (Chrome automation or manual).
2. **Scroll through the page using 3 jump-scrolls** (top, mid, bottom — `window.scrollTo(0, y)`, not incremental `scrollBy` loops). Note every element that:
   - Appears without any entrance animation (just pops in)
   - Has no hover response (cards, buttons, links feel dead)
   - Loads with a layout shift (skeleton doesn't match content)
   - Transitions between states without animation (tab switch, expand/collapse)
   - Has a sticky element that appears/disappears abruptly
3. **Interact with the page** (short session — hover 2-3 key elements, click 1-2 CTAs). Note every element that:
   - Gives no press/click feedback (buttons don't respond to touch)
   - Has no focus indicator (keyboard navigation is invisible)
   - Scrolls jankily (not smooth-scrolling to sections)
4. **Close the tab.** Then output a motion audit report:

```markdown
# Motion Audit: [Page Name]

## Missing Entrances
- [ ] Hero content has no entrance animation — appears instantly
- [ ] Section headers pop in without fade
- [ ] Connection rows appear all at once (no stagger)

## Missing Hover States  
- [ ] Connection rows have no hover response
- [ ] CTA button has no hover glow
- [ ] Venue cards in nearby section are flat

## Missing Transitions
- [ ] Sticky bar appears without animation
- [ ] Tab/pill switch has no active indicator motion
- [ ] Overlay opens without backdrop fade

## Missing Feedback
- [ ] Buttons have no press/active scale
- [ ] Save/share icons have no click confirmation

## Recommended Patterns
- Connection rows → motion-hover-lift + motion-stagger
- Sections below fold → scroll-reveal (motion-fade-up)
- CTA button → motion-hover-glow + motion-press
- Sticky bar → motion-sticky-enter
```

---

## Design Flow (`/motion design`)

### Process

1. **Read the visual spec** for the component (from `/design-handoff extract`).
2. **Identify interactive elements** — anything clickable, hoverable, or state-dependent.
3. **Assign patterns** from the motion pattern library. Don't invent new patterns unless none fit.
4. **Define timing** — which elements animate first? What's the stagger order? What triggers what?
5. **Write the motion spec** as an addendum to the visual spec:

```markdown
## Motion Spec: [Component Name]

### Entrance
- Component container: motion-fade-up on mount (400ms ease-out)
- Child rows: motion-stagger at 60ms intervals
- First visible after: 100ms (debounce for data loading)

### Hover States
- Row container: motion-hover-lift (translateY -4px, shadow deepens)
- Arrow icon: opacity 0.4 → 1.0 on row hover (200ms)
- Gold accent rows: border-color intensifies on hover (#FFD93D33 → #FFD93D66)

### Active/Press
- Entire row: motion-press (scale 0.97, 100ms)

### Transitions
- Selected state change: background-color transition 200ms ease-in-out
- Content swap (tab switch): crossfade 300ms

### Scroll Behavior
- Appears via scroll-reveal when section enters viewport (threshold 0.1)
- One-shot: does not re-trigger
```

---

## Apply Flow (`/motion apply`)

### Process

1. **Read the motion spec** for the target component.
2. **Check if motion tokens exist** in `globals.css`. If not, add them first.
3. **Check if utility classes exist** (`.motion-fade-up`, `.motion-hover-lift`, etc.). If not, add them to `globals.css`.
4. **Check if `useScrollReveal` hook exists** at `web/lib/hooks/useScrollReveal.ts`. If not, create it.
5. **Apply patterns to the component:**
   - Add CSS classes for hover/press states
   - Wrap scroll-revealed sections with the hook
   - Add stagger classes to list containers
   - Add entrance animation classes to mount-rendered content
6. **Browser-test** the result — motion should feel natural, not gratuitous.
7. **Verify reduced-motion** — all motion must respect `prefers-reduced-motion: reduce`. Wrap keyframe animations in `@media (prefers-reduced-motion: no-preference)`.

### Accessibility: Reduced Motion

Every motion pattern MUST be disabled when the user prefers reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .motion-fade-up,
  .motion-hover-lift,
  .motion-hover-glow,
  .motion-press,
  .motion-stagger > * {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## Integration with Design Pipeline

The motion step fits between visual design and implementation:

```
1. Visual design (Pencil comps) — static layout ✓
2. Visual spec extraction (/design-handoff extract) ✓  
3. Motion design (/motion design) — interaction patterns, timing ← NEW
4. Implementation from visual + motion spec
5. Motion application (/motion apply) — if motion wasn't in initial impl
6. Visual verification (/design-handoff verify) ✓
7. Motion verification (/motion audit to confirm no dead spots)
```

For the detail page rearchitecture: the SectionWrapper, ConnectionsSection, DetailHero, and DetailActions components should all have motion specs before the next implementation pass.

---

## Anti-Patterns

**Don't:**
- Animate everything — stillness provides contrast
- Use bounce/elastic easing on LostCity Atlanta portal — that's for family/youth portals
- Add animation duration > 600ms — feels sluggish
- Animate layout-triggering properties (width, height, top, left) — use transform/opacity only
- Add motion without `prefers-reduced-motion` support
- Use different easing curves for the same category of motion (all entrances should use --ease-out)
- Stagger more than 8 items — after 8, all share the same delay

**Do:**
- Use transform + opacity exclusively for animations (GPU-accelerated)
- Keep entrance animations one-shot (don't re-trigger on scroll back)
- Make hover states instantaneous enough to not feel laggy (≤200ms)
- Test on 60Hz displays — animations that look smooth at 120Hz can stutter at 60Hz
- Prefer CSS animations over JS-driven animation (fewer repaints)
- Use the motion token scale — don't invent arbitrary durations
