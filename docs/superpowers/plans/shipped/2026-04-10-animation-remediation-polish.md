# Animation Remediation & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical animation issues (oval hero, spinning border, duplicate grain), wire up incomplete integrations (pointer glow, display font), and add polish (modal animations, CursorGlow removal, aurora fix, tab transitions).

**Architecture:** All tasks are independent single-file or multi-file edits — no shared state or ordering dependencies. Critical fixes first, then important fixes, then polish.

**Tech Stack:** CSS utilities, React hooks, View Transitions API, `@starting-style`

---

### Task 1: Remove mask-vignette from DetailHero

**Files:**
- Modify: `web/components/detail/DetailHero.tsx:152`

- [ ] **Step 1: Remove mask-vignette class**

In `web/components/detail/DetailHero.tsx`, line 152, change:

```tsx
className={`relative w-full ${aspectClass} sm:rounded-xl overflow-hidden mask-vignette ${heroAccentClass?.className ?? ""}`}
```

to:

```tsx
className={`relative w-full ${aspectClass} sm:rounded-xl overflow-hidden ${heroAccentClass?.className ?? ""}`}
```

- [ ] **Step 2: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/components/detail/DetailHero.tsx
git commit -m "fix(animation): remove mask-vignette from DetailHero — clips image into oval"
```

---

### Task 2: Fix gradient-border on HeroCard

**Files:**
- Modify: `web/components/feed/HeroCard.tsx:113`

- [ ] **Step 1: Replace gradient-border with gradient-border-subtle**

In `web/components/feed/HeroCard.tsx`, line 113, change:

```tsx
"block relative w-full rounded-card overflow-hidden hover-lift gradient-border animate-page-enter",
```

to:

```tsx
"block relative w-full rounded-card overflow-hidden hover-lift gradient-border-subtle animate-page-enter",
```

- [ ] **Step 2: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/HeroCard.tsx
git commit -m "fix(animation): use static gradient-border-subtle on HeroCard instead of animated spin"
```

---

### Task 3: Delete duplicate grain system + dead suppression rules

**Files:**
- Modify: `web/app/globals.css:1417-1455`

- [ ] **Step 1: Delete the old body::after grain block and its suppression rules**

In `web/app/globals.css`, delete lines 1417-1455 entirely. This is the block starting with:

```css
/* Subtle grain texture overlay - can be disabled via --grain-opacity: 0 */
body::after {
```

And ending after:

```css
body:has([data-vertical="hospital"])::after {
  opacity: 0;
}
```

Delete everything from the `/* Subtle grain texture overlay` comment through the `hospital` suppression rule. The PNG-based `.grain-overlay` in the portal layout is the replacement.

- [ ] **Step 2: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/globals.css
git commit -m "fix(animation): delete duplicate body::after grain system and dead suppression rules"
```

---

### Task 4: Wire usePointerGlow to SeriesCard + FestivalCard

**Files:**
- Modify: `web/components/SeriesCard.tsx`
- Modify: `web/components/FestivalCard.tsx`

- [ ] **Step 1: Add usePointerGlow to SeriesCard**

In `web/components/SeriesCard.tsx`, add the import alongside existing hooks:

```typescript
import { usePointerGlow } from "@/lib/hooks/usePointerGlow";
```

Inside the component function body, add the hook call:

```typescript
const glowRef = usePointerGlow<HTMLDivElement>();
```

Find the comfortable-density outer `<div>` (the one with `pointer-glow` in its className, around line 263). Add `ref={glowRef}` to it.

- [ ] **Step 2: Add usePointerGlow to FestivalCard**

In `web/components/FestivalCard.tsx`, add the import:

```typescript
import { usePointerGlow } from "@/lib/hooks/usePointerGlow";
```

Inside the component function body, add the hook call:

```typescript
const glowRef = usePointerGlow<HTMLAnchorElement>();
```

Find the comfortable-density `<Link>` element (the one with `pointer-glow` in its className, around line 158-165). This `<Link>` is inside a `<>` fragment — attach `ref={glowRef}` directly to the `<Link>`, NOT the fragment.

- [ ] **Step 3: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/components/SeriesCard.tsx web/components/FestivalCard.tsx
git commit -m "fix(animation): wire usePointerGlow to SeriesCard and FestivalCard for cursor tracking"
```

---

### Task 5: Apply Bricolage Grotesque to card titles via .font-display

**Files:**
- Modify: `web/components/EventCard.tsx:326,528`
- Modify: `web/components/SeriesCard.tsx:373`
- Modify: `web/components/FestivalCard.tsx:238`
- Modify: `web/components/feed/StandardRow.tsx:103`

The `.font-display` class already exists in globals.css and sets `font-family: var(--font-display), system-ui, sans-serif`. Add it to `<span>` and `<p>` card titles that don't already get Bricolage Grotesque from the global `h1,h2,h3` rule. Do NOT add to `<h3>` elements (already covered).

- [ ] **Step 1: Add font-display to EventCard titles**

In `web/components/EventCard.tsx`:

Line 326 — compact density `<span>` title. Add `font-display` to className:
```tsx
<span className="block text-base sm:text-base font-semibold font-display leading-[1.2] line-clamp-2 sm:line-clamp-1 text-[var(--cream)] group-hover:text-[var(--accent-color)] transition-colors">
```

Line 528 — desktop `<span>` title. Add `font-display` to className:
```tsx
<span className="text-[var(--text-primary)] font-semibold font-display text-lg transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight">
```

- [ ] **Step 2: Add font-display to SeriesCard desktop title**

In `web/components/SeriesCard.tsx`, line 373 — desktop `<span>` title. Add `font-display`:
```tsx
<span className="text-[var(--cream)] font-semibold font-display text-lg transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight">
```

- [ ] **Step 3: Add font-display to FestivalCard desktop title**

In `web/components/FestivalCard.tsx`, line 238 — desktop `<span>` title. Add `font-display`:
```tsx
<span className="text-[var(--cream)] font-semibold font-display text-lg transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight">
```

- [ ] **Step 4: Add font-display to StandardRow title**

In `web/components/feed/StandardRow.tsx`, line 103 — `<p>` title. Add `font-display`:
```tsx
<p className="text-sm font-medium font-display text-[var(--cream)] truncate leading-snug group-hover:text-white transition-colors">
```

- [ ] **Step 5: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add web/components/EventCard.tsx web/components/SeriesCard.tsx web/components/FestivalCard.tsx web/components/feed/StandardRow.tsx
git commit -m "feat(typography): apply Bricolage Grotesque to card titles via .font-display"
```

---

### Task 6: Apply animate-enter-scale to ConfirmDialog + CreateCollectionModal

**Files:**
- Modify: `web/components/ConfirmDialog.tsx:77,86`
- Modify: `web/components/CreateCollectionModal.tsx:151`

- [ ] **Step 1: Update ConfirmDialog**

In `web/components/ConfirmDialog.tsx`:

Line 86 — panel div. Replace `animate-in scale-in` with `animate-enter-scale`:
```tsx
className="w-full max-w-sm bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl shadow-2xl animate-enter-scale"
```

Line 77 — backdrop div. Remove `animate-in fade-in` (the backdrop doesn't need entry animation — it appears instantly):
```tsx
className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
```

- [ ] **Step 2: Update CreateCollectionModal**

In `web/components/CreateCollectionModal.tsx`, line 151 — panel div. Replace `animate-in fade-in scale-in` with `animate-enter-scale`:
```tsx
className="relative bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 max-w-md w-full shadow-2xl animate-enter-scale"
```

- [ ] **Step 3: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/components/ConfirmDialog.tsx web/components/CreateCollectionModal.tsx
git commit -m "feat(animation): use @starting-style animate-enter-scale on modals"
```

---

### Task 7: Remove CursorGlow + dead code cleanup

**Files:**
- Delete: `web/components/CursorGlow.tsx`
- Modify: `web/components/ClientEffects.tsx`
- Modify: `web/app/globals.css`
- Modify: `web/app/[portal]/_surfaces/feed/AmbientSuppression.tsx`
- Modify: `web/app/[portal]/map/page.tsx`
- Modify: `web/app/[portal]/_components/dog/DogDeepPageShell.tsx`
- Delete: `web/lib/visual-settings-context.tsx` (if it exists — confirmed dead code)

- [ ] **Step 1: Remove CursorGlow from ClientEffects**

In `web/components/ClientEffects.tsx`:
- Delete the dynamic import line: `const CursorGlow = dynamic(() => import("@/components/CursorGlow"), { ssr: false });`
- Delete the `<CursorGlow />` render in the JSX

- [ ] **Step 2: Delete CursorGlow.tsx**

```bash
rm web/components/CursorGlow.tsx
```

- [ ] **Step 3: Delete visual-settings-context.tsx**

```bash
rm web/lib/visual-settings-context.tsx 2>/dev/null; echo "done"
```

- [ ] **Step 4: Clean up .cursor-glow CSS references**

In `web/app/globals.css`, find the suppression rules at ~lines 1434-1441. These rules suppress `.cursor-glow`, `.rain-overlay`, and `.ambient-glow` on detail pages. Remove only the `.cursor-glow` selectors from these rules, keeping the `.rain-overlay` and `.ambient-glow` suppressions. After edit, the rules should look like:

```css
body:has(main[data-festival-detail="true"]) .rain-overlay,
body:has(main[data-festival-detail="true"]) .ambient-glow,
body:has(main[data-clean-detail="true"]) .rain-overlay,
body:has(main[data-clean-detail="true"]) .ambient-glow {
  display: none !important;
}
```

Note: After Task 3 deletes the `body::after` block, these lines will have shifted. Search for `.cursor-glow` in globals.css to find the current location.

- [ ] **Step 5: Clean up .cursor-glow in other files**

In each of these files, search for `cursor-glow` and remove the reference. Read each file first to understand the context — it's likely a `display: none` suppression rule:
- `web/app/[portal]/_surfaces/feed/AmbientSuppression.tsx`
- `web/app/[portal]/map/page.tsx`
- `web/app/[portal]/_components/dog/DogDeepPageShell.tsx`

Also check `web/styles/portals/film.css` and `web/lib/portal-animation-config.ts` for any `.cursor-glow` references and clean them up.

- [ ] **Step 6: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit && grep -rn "cursor-glow\|CursorGlow" --include="*.tsx" --include="*.ts" --include="*.css" . | grep -v node_modules | grep -v .next
```

Should return zero results (or only this plan file / the spec).

- [ ] **Step 7: Commit**

```bash
git add -A web/components/CursorGlow.tsx web/components/ClientEffects.tsx web/app/globals.css web/lib/visual-settings-context.tsx
git add web/app/\\[portal\\]/_surfaces/feed/AmbientSuppression.tsx web/app/\\[portal\\]/map/page.tsx web/app/\\[portal\\]/_components/dog/DogDeepPageShell.tsx web/styles/portals/film.css web/lib/portal-animation-config.ts
git commit -m "feat(animation): remove CursorGlow + dead visual-settings-context + cursor-glow CSS refs"
```

---

### Task 8: Fix AuroraBackground blob sizing

**Files:**
- Modify: `web/components/ambient/AuroraBackground.tsx`

- [ ] **Step 1: Update default blob sizes and drift ranges**

In `web/components/ambient/AuroraBackground.tsx`, read the file first. Then update the CSS template string:

Change all `width: 60vmax` and `height: 60vmax` on `.aurora-blob` to `width: 40vmax` and `height: 40vmax`.

Update the keyframes drift distances:
- `aurora-drift-*-1`: `translate(5vw, 3vh)` → `translate(15vw, 10vh)`
- `aurora-drift-*-2`: `translate(-4vw, -2vh)` → `translate(-12vw, -8vh)`
- `aurora-drift-*-3`: `translate(3vw, -4vh)` → `translate(10vw, -12vh)` and scale to `scale(1.15)`

Also update the third blob size from `40vmax` to `30vmax` (it should be smaller than the primary blobs).

- [ ] **Step 2: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/components/ambient/AuroraBackground.tsx
git commit -m "fix(animation): reduce aurora blob size, increase drift range for visible motion"
```

---

### Task 9: Tab switching animation in LineupSection

**Files:**
- Modify: `web/components/feed/LineupSection.tsx`

- [ ] **Step 1: Wrap tab switch in startViewTransition**

In `web/components/feed/LineupSection.tsx`, find the `handleTabClick` callback (around line 302):

```typescript
const handleTabClick = useCallback(async (tabId: string) => {
  setActiveTabId(tabId);
```

Replace with:

```typescript
const handleTabClick = useCallback(async (tabId: string) => {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
      setActiveTabId(tabId);
    });
  } else {
    setActiveTabId(tabId);
  }
```

The type cast is needed because TypeScript's DOM types may not include `startViewTransition` yet. The existing view transition CSS (`::view-transition-old(root)` / `::view-transition-new(root)` in globals.css) will handle the crossfade automatically. Unsupported browsers fall through to the instant swap.

- [ ] **Step 2: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/LineupSection.tsx
git commit -m "feat(animation): add view transition crossfade on LineupSection tab switch"
```

---

### Task 10: Increase button press feedback

**Files:**
- Modify: `web/app/globals.css` (btn-* utility classes)

- [ ] **Step 1: Update active scale on button utilities**

In `web/app/globals.css`, find the button utility classes (around line 2050-2090). They currently use `active:scale-[0.98]`. Change to `active:scale-[0.96]` for more noticeable tactile feedback:

Find and replace (5 occurrences):
```css
active:scale-[0.98]
```
with:
```css
active:scale-[0.96]
```

These are in `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-accent`, `.btn-success`.

- [ ] **Step 2: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(animation): increase button press feedback from scale-0.98 to scale-0.96"
```
